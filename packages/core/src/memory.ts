import type { ChatMessage } from "./types.js";

// ============================================================
// 上下文管理（Step 3，FR-18~21，DESIGN §12）
//
// 两个职责，都围绕「messages 是唯一事实来源」：
//  1. token 估算：无 tokenizer 依赖的启发式（core 零依赖红线）
//  2. 历史裁剪：回合完整 + 双水位——裁剪即遗忘，但绝不拆散 tool 配对，
//     且两次裁剪之间请求前缀保持稳定（KV cache 复用的前提，§12.4）
// ============================================================

/** CJK 与全角标点按 1 token/字估，其余按 1 token/4字符（Qwen 系 BPE 的保守中值） */
const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(CJK) ?? []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk + other * 0.25);
}

/** 每条消息的协议固定开销（role 标记、结构字符等），量级来自 Qwen chat template 观察 */
const MESSAGE_OVERHEAD_TOKENS = 4;

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => {
    let t = MESSAGE_OVERHEAD_TOKENS;
    if (m.role === "system" || m.role === "user") t += estimateTokens(m.content);
    else if (m.role === "tool") t += estimateTokens(m.content);
    else {
      // assistant：content（可能为 null）+ tool_calls（name + arguments 都是逐 token 生成的 JSON 文本）
      t += estimateTokens(m.content ?? "");
      for (const tc of m.tool_calls ?? []) {
        t += estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments) + 4; // id/结构开销
      }
    }
    return sum + t;
  }, 0);
}

// ---------------- 裁剪（FR-19/20）----------------

export interface TrimPolicy {
  /** 高水位：估算 token 超过此值触发裁剪 */
  budget: number;
  /** 低水位比例：一次裁到 budget×lowRatio 以内（默认 0.5，双水位的关键） */
  lowRatio?: number;
}

export interface TrimResult {
  kept: ChatMessage[];
  removed: ChatMessage[];
  beforeTokens: number;
  afterTokens: number;
}

/**
 * 回合完整的历史裁剪（纯函数，不修改入参）。
 *
 * 回合定义：从 user 消息起、到下一个 user 消息前的全部消息
 * （含中间的 assistant(tool_calls)/tool 配对与 assistant 终答）。
 * system 永远保留；最后一回合永远保留；裁剪以整回合为单位从最旧开始。
 */
export function trimMessages(messages: ChatMessage[], policy: TrimPolicy): TrimResult {
  const { budget, lowRatio = 0.5 } = policy;
  const beforeTokens = estimateMessagesTokens(messages);
  if (beforeTokens <= budget) {
    return { kept: messages, removed: [], beforeTokens, afterTokens: beforeTokens };
  }
  const low = Math.ceil(budget * lowRatio);

  // 分离 system（如果有）并按回合分组
  const head = messages[0];
  const system: ChatMessage[] = head && head.role === "system" ? [head] : [];
  const body = system.length > 0 ? messages.slice(1) : messages;

  const turns: ChatMessage[][] = [];
  for (const m of body) {
    if (m.role === "user" || turns.length === 0) turns.push([]);
    turns[turns.length - 1]?.push(m);
  }
  if (turns.length === 0) {
    return { kept: messages, removed: [], beforeTokens, afterTokens: beforeTokens };
  }

  // 从最旧回合开始丢弃，直到 ≤ 低水位或只剩最后一回合（防死循环：极小预算也保最后回合）
  const removed: ChatMessage[] = [];
  let keptTurns = turns;
  while (keptTurns.length > 1) {
    const est = estimateMessagesTokens([...system, ...keptTurns.flat()]);
    if (est <= low) break;
    removed.push(...(keptTurns[0] ?? []));
    keptTurns = keptTurns.slice(1);
  }

  const kept = [...system, ...keptTurns.flat()];
  return { kept, removed, beforeTokens, afterTokens: estimateMessagesTokens(kept) };
}
