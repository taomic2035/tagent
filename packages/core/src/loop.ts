import type { AgentConfig, ChatMessage, ToolContext, Usage } from "./types.js";
import type { LLMClient } from "./client.js";
import type { ToolRegistry } from "./tools.js";
import { trimMessages } from "./memory.js";

// ============================================================
// AgentEvent：loop 对外暴露的事件流
// CLI 渲染与 transcript 记录器共同消费同一事件流（ARCHITECTURE.md §5）
// ============================================================

export type AgentEvent =
  | { type: "round-start"; round: number }
  | { type: "llm-request"; messages: ChatMessage[] }
  | { type: "reasoning-delta"; delta: string }
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; id: string; name: string; args: unknown }
  | { type: "tool-result"; id: string; name: string; result: string; retriesUsed?: number }
  | { type: "context-trimmed"; removedMessages: number; fromTokens: number; toTokens: number }
  | { type: "final"; message: ChatMessage; rounds: number; usage: Usage }
  | { type: "error"; message: string; recoverable: boolean };

export interface AgentDeps {
  client: LLMClient;
  registry: ToolRegistry;
  config: AgentConfig;
}

/**
 * agent 主循环：请求 → 解析 tool_calls → 执行 → 回填 → 再请求（DESIGN.md §4）
 *
 * 契约：
 * - messages 由调用方持有，loop 原地追加（不变量1：messages 是唯一事实来源）
 * - 出口：finishReason!=="tool_calls"（含 stop/length）、轮次触顶降级终答（Step 2 FR-15，
 *   degradeOnCap:false 则退回 error 事件）、流异常向上抛
 * - reasoning 只进事件流，永不进 messages（不变量4）
 * - 工具结果（含失败）必须回填，配对 tool_call_id（不变量2）
 */
export async function* runAgent(
  deps: AgentDeps,
  messages: ChatMessage[],
  ctx?: ToolContext,
): AsyncGenerator<AgentEvent> {
  const { client, registry, config } = deps;

  // system prompt：非空且头部没有 system 消息时插入一次（多轮会话不重复插）
  if (config.systemPrompt && messages[0]?.role !== "system") {
    messages.unshift({ role: "system", content: config.systemPrompt });
  }

  const totalUsage: Usage = { promptTokens: 0, completionTokens: 0 };

  for (let round = 1; round <= config.maxIterations; round++) {
    // ---- 上下文预算检查（Step 3，FR-20/21）：每轮请求前，超预算才裁，一次裁到低水位 ----
    if (config.contextBudgetTokens) {
      const t = trimMessages(messages, { budget: config.contextBudgetTokens });
      if (t.removed.length > 0) {
        // 原地替换：调用方持有的 messages 引用不变（不变量1 的载体）
        messages.length = 0;
        messages.push(...t.kept);
        yield {
          type: "context-trimmed",
          removedMessages: t.removed.length,
          fromTokens: t.beforeTokens,
          toTokens: t.afterTokens,
        };
      }
    }

    yield { type: "round-start", round };
    yield { type: "llm-request", messages: [...messages] }; // 快照，供 debug/transcript

    // ---- 一轮流式请求：透传增量，累积 tool_calls 分片 ----
    const slots = new Map<number, { id?: string; name?: string; argsBuf: string }>();
    let textBuf = "";
    let finishReason: "stop" | "tool_calls" | "length" = "stop";

    for await (const ev of client.stream({
      messages,
      tools: registry.schemas(),
      temperature: config.temperature,
    })) {
      if (ev.type === "reasoning-delta") {
        yield ev; // 透传渲染，不积累
      } else if (ev.type === "text-delta") {
        textBuf += ev.delta;
        yield ev;
      } else if (ev.type === "tool-call-delta") {
        // OpenAI 式分片：同 index 的 id/name/args 分多帧到达，逐段合并（PROTOCOL.md §5.2）
        const slot = slots.get(ev.index) ?? { argsBuf: "" };
        if (ev.id) slot.id = ev.id;
        if (ev.name) slot.name = ev.name;
        if (ev.argsDelta) slot.argsBuf += ev.argsDelta;
        slots.set(ev.index, slot);
      } else {
        finishReason = ev.finishReason;
        if (ev.usage) {
          totalUsage.promptTokens += ev.usage.promptTokens;
          totalUsage.completionTokens += ev.usage.completionTokens;
        }
      }
    }

    // ---- 组装 assistant 消息入档（reasoning 丢弃，不变量4）----
    const ordered = [...slots.entries()].sort(([a], [b]) => a - b);
    const toolCalls = ordered.map(([index, slot]) => ({
      id: slot.id ?? `slot_${index}`, // 引擎必须给 id；缺失时合成，保证 tool 消息可配对
      type: "function" as const,
      function: { name: slot.name ?? "", arguments: slot.argsBuf },
    }));

    const assistant: Extract<ChatMessage, { role: "assistant" }> = {
      role: "assistant",
      content: textBuf === "" ? null : textBuf,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    };
    messages.push(assistant);

    // ---- 出口判定（不变量3）：非工具请求，或协议矛盾（声称工具但没解析出调用）----
    if (finishReason !== "tool_calls" || toolCalls.length === 0) {
      yield { type: "final", message: assistant, rounds: round, usage: totalUsage };
      return;
    }

    // ---- 按协议顺序执行工具，结果逐一回填（不变量2）----
    for (const tc of toolCalls) {
      yield { type: "tool-call", id: tc.id, name: tc.function.name, args: tryParse(tc.function.arguments) };
      const result = await registry.execute(tc.function.name, tc.function.arguments, ctx);
      // retriesUsed 透出到事件流（NFR-9）：CLI 渲染"重试 N 次"，transcript 可观测
      const retriesUsed = pickRetriesUsed(result);
      yield { type: "tool-result", id: tc.id, name: tc.function.name, result, ...(retriesUsed !== undefined ? { retriesUsed } : {}) };
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }

  // ---- 触顶出口（不变量3 的降级形态，Step 2 FR-15）----
  if (config.degradeOnCap === false) {
    yield {
      type: "error",
      message: `已达最大迭代次数 ${config.maxIterations}，模型仍未给出最终回答（可能陷入工具循环）`,
      recoverable: false,
    };
    return;
  }

  // 降级终答：追加一次【无 tools】请求——协议层禁止再调工具（无 tools 定义
  // → 模板无工具段 → finish_reason 不可能是 tool_calls），降级靠协议保证而非 prompt 恳求。
  // 注入提示用副本拼接，不污染调用方持有的 messages（不变量1 不破）。
  if (config.contextBudgetTokens) {
    const t = trimMessages(messages, { budget: config.contextBudgetTokens });
    if (t.removed.length > 0) {
      messages.length = 0;
      messages.push(...t.kept);
      yield {
        type: "context-trimmed",
        removedMessages: t.removed.length,
        fromTokens: t.beforeTokens,
        toTokens: t.afterTokens,
      };
    }
  }
  const degradeRound = config.maxIterations + 1;
  yield { type: "round-start", round: degradeRound };
  const degradeMessages = [
    ...messages,
    {
      role: "user" as const,
      content: `（系统注入：已达工具调用次数上限 ${config.maxIterations}，不要再请求工具，请基于已获得的工具结果直接给出最终回答）`,
    },
  ];
  yield { type: "llm-request", messages: degradeMessages };

  let degradeText = "";
  for await (const ev of client.stream({
    messages: degradeMessages,
    temperature: config.temperature, // 注意：不传 tools
  })) {
    if (ev.type === "reasoning-delta" || ev.type === "text-delta") {
      if (ev.type === "text-delta") degradeText += ev.delta;
      yield ev;
    } else if (ev.type === "done" && ev.usage) {
      totalUsage.promptTokens += ev.usage.promptTokens;
      totalUsage.completionTokens += ev.usage.completionTokens;
    }
  }

  const degradeAssistant: Extract<ChatMessage, { role: "assistant" }> = {
    role: "assistant",
    content: degradeText === "" ? null : degradeText,
  };
  messages.push(degradeAssistant);
  yield { type: "final", message: degradeAssistant, rounds: degradeRound, usage: totalUsage };
}

/** 从工具结果信封里取 retriesUsed（信封是本仓库 registry 生成的 JSON，尽力解析即可） */
function pickRetriesUsed(resultJson: string): number | undefined {
  try {
    const env = JSON.parse(resultJson) as { retriesUsed?: unknown };
    return typeof env.retriesUsed === "number" ? env.retriesUsed : undefined;
  } catch {
    return undefined;
  }
}

/** tool-call 事件里的 args 尽力解析成对象，失败时保留原始字符串（仅展示用，执行以原始串为准） */
function tryParse(argsJson: string): unknown {
  try {
    return JSON.parse(argsJson);
  } catch {
    return argsJson;
  }
}
