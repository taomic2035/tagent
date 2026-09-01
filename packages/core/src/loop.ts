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
  | { type: "guard"; guard: "empty-response" | "repetition" | "length-truncated"; detail: string }
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

  // ---- 循环守卫（Step 9，FR-52~55）：对"不抛错但也不干活"的模型失败设防 ----
  const guards = {
    emptyResponse: config.guards?.emptyResponse !== false,
    repetition: config.guards?.repetition !== false,
    length: config.guards?.lengthTruncation !== false,
  };
  const EMPTY_GIVE_UP = 3; // 连续 3 次空响应：放弃 nudge，按 final 诚实收场
  const REPEAT_WARN = 3; // 工具批次签名连续相同第 3 批：执行后附警告
  const REPEAT_STOP = 5; // 第 5 批：不再执行，直接触顶降级（视为卡死）
  let emptyStreak = 0;
  let repeatStreak = 0;
  let lastBatchSig = "";

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
      ...(config.thinking !== undefined ? { chatTemplateKwargs: { enable_thinking: config.thinking } } : {}),
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

    // ---- length 守卫（FR-54）：协议说截断就不猜完整性——残缺调用不执行，
    //      逐个回填错误结果让模型重发（pi 契约：框架不猜，模型重发）----
    if (finishReason === "length" && toolCalls.length > 0) {
      if (guards.length) {
        yield {
          type: "guard",
          guard: "length-truncated",
          detail: `${toolCalls.length} 个工具调用因 max_tokens 截断未执行，已回填错误等待重发`,
        };
        for (const tc of toolCalls) {
          // llama.cpp 实测差异（PROTOCOL）：服务端渲染模板时会重新解析历史中
          // assistant.tool_calls.arguments 的 JSON——截断片段直接 HTTP 500
          // （OpenAI/MLX 容忍非法 JSON）。传输层改写为合法 {}，原始字节片段
          // 移入 tool 结果文本保存（溯源不丢）。
          const rawArgs = tc.function.arguments;
          tc.function.arguments = "{}";
          const truncated = `（系统：输出因 max_tokens 截断，该工具调用参数不完整，未执行。原始参数片段：${rawArgs}。请精简输出，重新发起完整的工具调用）`;
          yield { type: "tool-result", id: tc.id, name: tc.function.name, result: truncated };
          messages.push({ role: "tool", tool_call_id: tc.id, content: truncated });
        }
        continue;
      }
      // 守卫关闭：维持 Step 8 行为（执行残缺调用，由工具层错误信封兜住）
    }

    // ---- 出口判定（不变量3）：非工具请求，或协议矛盾（声称工具但没解析出调用）----
    if (finishReason !== "tool_calls" || toolCalls.length === 0) {
      // 空响应守卫（FR-52）：空内容且无调用 = 模型发呆。注入 nudge 让它继续；
      // 连续 EMPTY_GIVE_UP 次或已无轮次余量则放弃，按 final 诚实收场。
      const isEmpty = textBuf === "" && toolCalls.length === 0;
      const canNudge = guards.emptyResponse && emptyStreak < EMPTY_GIVE_UP - 1 && round < config.maxIterations;
      if (isEmpty && canNudge) {
        emptyStreak++;
        yield {
          type: "guard",
          guard: "empty-response",
          detail: `第 ${emptyStreak} 次空响应，注入提示让模型继续`,
        };
        messages.push({
          role: "user",
          content: "（系统注入：你上一轮没有产生任何内容或工具调用。请基于已有信息继续：调用工具，或直接给出最终回答）",
        });
        continue;
      }
      if (isEmpty && finishReason === "length" && guards.length) {
        yield { type: "guard", guard: "length-truncated", detail: "终答因 max_tokens 截断，内容可能不完整" };
      }
      yield { type: "final", message: assistant, rounds: round, usage: totalUsage };
      return;
    }
    emptyStreak = 0; // 有产出即清零空响应计数

    // ---- 重复检测（FR-53）：批次签名 = 每个调用 name+规范化参数。整批相同才算复读
    //      （同工具不同参数是正常行为，如翻页），误报优先级低于漏报 ----
    const batchSig = toolCalls.map((tc) => callSignature(tc.function.name, tc.function.arguments)).join(" | ");
    repeatStreak = batchSig === lastBatchSig ? repeatStreak + 1 : 1;
    lastBatchSig = batchSig;
    if (guards.repetition && repeatStreak >= REPEAT_STOP) {
      yield {
        type: "guard",
        guard: "repetition",
        detail: `连续 ${repeatStreak} 轮完全相同的工具调用，视为卡死，本批不再执行，强制进入降级终答`,
      };
      // 不变量2：assistant 的每个 tool_call 必须有配对 tool 结果——本批未执行，
      // 也回填说明（部分服务端会拒绝无配对的 tool_calls 消息）
      for (const tc of toolCalls) {
        const skipped = "（系统：检测到连续重复的相同工具调用，本批未执行。请基于已获得的结果直接给出最终回答，不要再次发起相同调用）";
        yield { type: "tool-result", id: tc.id, name: tc.function.name, result: skipped };
        messages.push({ role: "tool", tool_call_id: tc.id, content: skipped });
      }
      break; // 跳出轮次循环 → 触顶降级出口（复用 Step 2 FR-15 的协议级降级）
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

    // 重复警告（FR-53）：第 3/4 批照常执行（结果给全），回填后追加警告——
    // 模型看到的是"相同结果 + 系统点破"，给它改变策略的机会
    if (guards.repetition && repeatStreak >= REPEAT_WARN && round < config.maxIterations) {
      yield {
        type: "guard",
        guard: "repetition",
        detail: `连续 ${repeatStreak} 轮相同工具调用，已附警告`,
      };
      messages.push({
        role: "user",
        content: "（系统注入：检测到你连续多次发起完全相同的工具调用，相同参数大概率得到相同结果。请检查已获得的结果改变策略，或直接给出最终回答）",
      });
    }
  }

  // ---- 触顶出口（不变量3 的降级形态，Step 2 FR-15；重复卡死也走这里，Step 9 FR-53）----
  if (config.degradeOnCap === false) {
    yield {
      type: "error",
      message: `循环终止：迭代耗尽（上限 ${config.maxIterations}）或重复工具调用卡死，模型仍未给出最终回答`,
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
  const degradeKwargs = config.thinking !== undefined ? { chatTemplateKwargs: { enable_thinking: config.thinking } } : {};
  yield { type: "llm-request", messages: degradeMessages };

  let degradeText = "";
  for await (const ev of client.stream({
    messages: degradeMessages,
    temperature: config.temperature, // 注意：不传 tools
    ...degradeKwargs,
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

/** 键排序的稳定序列化：{"b":1,"a":2} 与 {"a":2,"b":1} 生成相同签名（FR-53） */
function stableKey(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableKey).join(",")}]`;
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableKey(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** 工具调用签名：name + 规范化参数；args 非法 JSON（如被截断）时按原文退化为 raw 形式 */
function callSignature(name: string, argsJson: string): string {
  try {
    return `${name}(${stableKey(JSON.parse(argsJson))})`;
  } catch {
    return `${name}(raw:${argsJson})`;
  }
}
