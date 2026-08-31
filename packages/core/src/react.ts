import type { AgentConfig, ChatMessage, ToolContext } from "./types.js";
import type { AgentEvent, AgentDeps } from "./loop.js";
import type { LLMClient } from "./client.js";
import type { ToolRegistry } from "./tools.js";

// ============================================================
// ReAct 文本协议引擎（Step 5，FR-26~28，DESIGN §14）
//
// 与 runAgent 的区别只在「行动的承载层」：
//   原生模式：tools 参数 + assistant.tool_calls + role:tool 消息（协议承载）
//   ReAct 模式：Thought/Action/Observation 全部是文本（上下文承载）
// 工具执行仍走 ToolRegistry —— 校验/执行策略/错误信封全部继承。
// 事件契约与 runAgent 完全一致（CLI 渲染与 transcript 零改动）。
// ============================================================

export const REACT_SYSTEM_PROMPT = [
  "你通过「思考-行动-观察」循环解决任务。",
  "可用工具：",
  "- get_weather(city: string)：查询城市天气，支持 北京/上海/广州/深圳/杭州",
  "- calculate(expression: string)：四则运算表达式求值",
  "",
  "每轮严格按以下格式输出（不要输出其他内容）：",
  "Thought: <一句话分析当前状态与下一步>",
  "Action: <工具名>",
  "Action Input: <一行 JSON 参数>",
  "",
  "系统会把工具结果以「Observation: <JSON>」追加给你。",
  "当你已有足够信息回答时，输出：",
  "Thought: <一句话总结>",
  "Final Answer: <给用户的最终回答>",
].join("\n");

export type ActionParse =
  | { kind: "action"; name: string; argsJson: string }
  | { kind: "final"; answer: string }
  | { kind: "invalid"; reason: string };

// ============================================================
// JSON 协议（Step 5，FR-31）：弱模型鲁棒的 ReAct 形态
//
// 每轮只输出一个 JSON 对象（受限解码保证格式），工具名由 enum 锁死：
//   {"thought":"…","action":{"tool":"get_weather","args":{"city":"北京"}}}
//   {"thought":"…","action":{"final":"给用户的回答"}}
// 设计动机（实测教训）：4B + 关思考在文本协议下要么幻觉直答、要么审议复读，
// 格式纪律指望不上——把约束下沉到解码器（GBNF），模型物理上无法跑偏。
// ============================================================

export const REACT_JSON_SYSTEM_PROMPT = [
  "你通过「思考-行动-观察」循环解决任务。",
  "每轮只输出一个 JSON 对象（系统会强制校验格式）：",
  '- 调用工具：{"thought":"一句话分析","action":{"tool":"<工具名>","args":{<参数>}}}',
  '- 给出答案：{"thought":"一句话总结","action":{"final":"给用户的最终回答"}}',
  "系统把工具结果以「Observation: <JSON>」追加给你。",
  "重要：温度、数值等数据必须来自 Observation，永远不要编造。",
].join("\n");

/** 受限解码的 response_format（工具 enum 从 registry 动态生成——工具集变化自动跟随） */
export function reactJsonResponseFormat(registry: { names(): string[] }): Record<string, unknown> {
  const tools = registry.names();
  return {
    type: "json_schema",
    json_schema: {
      name: "react_step",
      schema: {
        type: "object",
        properties: {
          thought: { type: "string" },
          action: {
            oneOf: [
              { type: "object", properties: { tool: { type: "string", enum: tools }, args: { type: "object" } }, required: ["tool", "args"], additionalProperties: false },
              { type: "object", properties: { final: { type: "string" } }, required: ["final"], additionalProperties: false },
            ],
          },
        },
        required: ["thought", "action"],
        additionalProperties: false,
      },
    },
  };
}

/** JSON 协议解析：非 JSON 或形状错误 → invalid（受限解码下不会发生，兜底保持鲁棒） */
export function parseActionJson(text: string): ActionParse {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { kind: "invalid", reason: `输出不是 JSON：${text.slice(0, 80)}` };
  }
  if (typeof v !== "object" || v === null) return { kind: "invalid", reason: "输出不是 JSON 对象" };
  const obj = v as { thought?: unknown; action?: { tool?: unknown; args?: unknown; final?: unknown } };
  const act = obj.action;
  if (typeof act !== "object" || act === null) return { kind: "invalid", reason: "缺少 action 字段" };
  if (typeof act.final === "string") return { kind: "final", answer: act.final === "" ? "(空回答)" : act.final };
  if (typeof act.tool === "string" && typeof act.args === "object" && act.args !== null) {
    return { kind: "action", name: act.tool, argsJson: JSON.stringify(act.args) };
  }
  return { kind: "invalid", reason: "action 既无 final 也无 tool/args" };
}

/** 从 assistant 全文提取行动指令（FR-27）。畸形输出不抛异常，返回可回填的原因。 */
export function parseAction(text: string): ActionParse {
  const finalIdx = text.lastIndexOf("Final Answer:");
  if (finalIdx >= 0) {
    const answer = text.slice(finalIdx + "Final Answer:".length).trim();
    return { kind: "final", answer: answer === "" ? "(空回答)" : answer };
  }

  const nameMatch = [...text.matchAll(/^Action:[ \t]*(\S+)[ \t]*$/gm)];
  const last = nameMatch.at(-1);
  if (!last || !last[1]) {
    return { kind: "invalid", reason: "未找到 Action 或 Final Answer。请按格式输出：Thought/Action/Action Input，或 Thought/Final Answer。" };
  }
  const name = last[1];
  const afterName = text.slice((last.index ?? 0) + last[0].length);

  const inputIdx = afterName.indexOf("Action Input:");
  if (inputIdx < 0) {
    return { kind: "invalid", reason: `Action ${name} 缺少 Action Input（一行 JSON）。` };
  }
  const raw = afterName.slice(inputIdx + "Action Input:".length);
  const argsJson = extractBalancedJson(raw);
  if (argsJson === null) {
    return { kind: "invalid", reason: `Action Input 不是合法 JSON：${raw.trim().slice(0, 80)}` };
  }
  return { kind: "action", name, argsJson };
}

/**
 * ReAct 主循环。契约与 runAgent 相同：
 * - messages 由调用方持有，原地演化（不变量 1）
 * - assistant 全文与 Observation 都进 messages（文本协议的全部状态就在上下文里）
 * - 工具执行复用 ToolRegistry（校验/策略/信封，Step 2 全继承）
 * - 出口：Final Answer / 降级终答 / error（降级请求无 Action 解析压力，直接终答）
 */
export async function* runReAct(
  deps: AgentDeps,
  messages: ChatMessage[],
  ctx?: ToolContext,
): AsyncGenerator<AgentEvent> {
  const { client, registry, config } = deps;

  const useJson = config.reactFormat === "json";
  const systemPrompt = config.systemPrompt || (useJson ? REACT_JSON_SYSTEM_PROMPT : REACT_SYSTEM_PROMPT);
  const head = messages[0];
  if (head?.role !== "system") messages.unshift({ role: "system", content: systemPrompt });

  let finalAnswer: string | null = null;

  for (let round = 1; round <= config.maxIterations && finalAnswer === null; round++) {
    yield { type: "round-start", round };
    yield { type: "llm-request", messages: [...messages] };

    let textBuf = "";
    for await (const ev of client.stream({
      messages,
      temperature: config.temperature,
      ...(config.thinking !== undefined ? { chatTemplateKwargs: { enable_thinking: config.thinking } } : {}),
      // JSON 协议：受限解码（FR-31）——格式纪律由解码器保证，弱模型无法跑偏
      ...(useJson ? { responseFormat: reactJsonResponseFormat(registry) } : {}),
    })) {
      if (ev.type === "text-delta") {
        textBuf += ev.delta;
        yield ev;
      } else if (ev.type === "reasoning-delta") {
        yield ev; // 思考内容只渲染不参与协议（不变量 4 同源）
      }
      // done 事件只收尾，不产出
    }

    const assistant: ChatMessage = { role: "assistant", content: textBuf };
    // JSON 协议优先按 JSON 解析；文本兜底（受限解码下 JSON 必然成功，兜底仅为对称性）
    const parsed = useJson ? parseActionJson(textBuf) : parseAction(textBuf);

    if (parsed.kind === "final") {
      finalAnswer = parsed.answer;
      messages.push({ ...assistant, content: textBuf });
      continue;
    }

    messages.push(assistant);

    if (parsed.kind === "invalid") {
      // 自愈：纠错 Observation 回填（FR-27，Step 2 哲学）
      messages.push({ role: "user", content: `Observation: {"ok":false,"error":"格式错误：${parsed.reason}"}` });
      continue;
    }

    // action：执行（继承校验/策略/信封）
    yield { type: "tool-call", id: `react-${round}`, name: parsed.name, args: tryParse(parsed.argsJson) };
    const result = await registry.execute(parsed.name, parsed.argsJson, ctx);
    const retriesUsed = pickRetriesUsed(result);
    yield { type: "tool-result", id: `react-${round}`, name: parsed.name, result, ...(retriesUsed !== undefined ? { retriesUsed } : {}) };
    messages.push({ role: "user", content: `Observation: ${result}` });
  }

  if (finalAnswer !== null) {
    yield {
      type: "final",
      message: { role: "assistant", content: finalAnswer },
      rounds: Math.min(messages.length, config.maxIterations),
      usage: { promptTokens: 0, completionTokens: 0 },
    };
    return;
  }

  // 触顶降级（复用 Step 2 语义）：无 tools 无格式要求，直接要终答
  yield { type: "round-start", round: config.maxIterations + 1 };
  const degradeMessages = [
    ...messages,
    { role: "user" as const, content: "（系统注入：已达循环上限，请直接给出基于已有 Observation 的最终回答，不要再输出 Action）" },
  ];
  let degradeText = "";
  for await (const ev of client.stream({
    messages: degradeMessages,
    temperature: config.temperature,
    ...(config.thinking !== undefined ? { chatTemplateKwargs: { enable_thinking: config.thinking } } : {}),
  })) {
    if (ev.type === "text-delta") {
      degradeText += ev.delta;
      yield ev;
    }
  }
  messages.push({ role: "assistant", content: degradeText });
  yield {
    type: "final",
    message: { role: "assistant", content: degradeText },
    rounds: config.maxIterations + 1,
    usage: { promptTokens: 0, completionTokens: 0 },
  };
}

/** 从文本中提取首个平衡的 JSON 对象（手写扫描：深度计数 + 字符串状态机）。
 *  容忍多行与 JSON 块之后的尾随杂文（模型常在块后补说明）。 */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function tryParse(argsJson: string): unknown {
  try {
    return JSON.parse(argsJson);
  } catch {
    return argsJson;
  }
}

function pickRetriesUsed(resultJson: string): number | undefined {
  try {
    const env = JSON.parse(resultJson) as { retriesUsed?: unknown };
    return typeof env.retriesUsed === "number" ? env.retriesUsed : undefined;
  } catch {
    return undefined;
  }
}

// AgentConfig 类型的使用说明：react 引擎读取 baseUrl/model 以外的行为配置；
// LLMClient/ToolRegistry 依赖注入与 runAgent 同源（ARCHITECTURE §4）
export type ReActDeps = AgentDeps & { client: LLMClient; registry: ToolRegistry; config: AgentConfig };
