import type { AgentConfig, ChatMessage, ToolContext, Usage } from "./types.js";
import type { LLMClient } from "./client.js";
import type { ToolRegistry } from "./tools.js";

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
  | { type: "tool-result"; id: string; name: string; result: string }
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
 * - 出口仅两个：finishReason!=="tool_calls"（含 stop/length）或轮次触顶（不变量3）
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
      yield { type: "tool-result", id: tc.id, name: tc.function.name, result };
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }

  yield {
    type: "error",
    message: `已达最大迭代次数 ${config.maxIterations}，模型仍未给出最终回答（可能陷入工具循环）`,
    recoverable: false,
  };
}

/** tool-call 事件里的 args 尽力解析成对象，失败时保留原始字符串（仅展示用，执行以原始串为准） */
function tryParse(argsJson: string): unknown {
  try {
    return JSON.parse(argsJson);
  } catch {
    return argsJson;
  }
}
