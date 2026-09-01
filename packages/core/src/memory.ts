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

// ---------------- 摘要压缩（Step 11，FR-59~63）----------------

export interface CompactPolicy {
  /** 高水位：估算 token 超过此值触发压缩（与 trim 同义） */
  budget: number;
  /** 目标低水位比例（默认 0.5，与 trim 的双水位同节奏：一次手术、之后前缀稳定） */
  lowRatio?: number;
  /** 摘要函数（依赖注入，core 不做 LLM 调用）：输入被压缩轮的原文，返回事实性摘要 */
  summarize?: (raw: string) => Promise<string>;
  /** tool 结果降级阈值：content 长于此值才降级（默认 160 字符） */
  degradeThreshold?: number;
}

export interface CompactResult {
  messages: ChatMessage[];
  /** 相邻去重删掉的完全重复 user 消息数（FR-59） */
  dedupedUsers: number;
  /** pre-pass 降级的 tool 结果数（FR-60） */
  degradedToolResults: number;
  /** 被摘要替换的用户轮数；0 = 未走 LLM 路径（FR-61） */
  summarizedTurns: number;
  beforeTokens: number;
  afterTokens: number;
  /** 是否发生任何变更（去重/降级/摘要任一） */
  changed: boolean;
}

/**
 * 摘要压缩（阶梯：去重 → 确定性降级 → LLM 摘要；纯函数风格，返回新数组）。
 *
 * 层次语义：压缩优先（保信息），丢弃兜底（保预算）——本函数【只压缩不丢弃】，
 * 返回的 messages 可能仍超预算，由调用方走 trimMessages 兜底并以 context-trimmed
 * 事件可见（丢弃 ≠ 改写，也不冒充压缩，见 REQUIREMENTS §16.1 与 AC12 复盘）。
 * user 消息永不改写：去重只删字节级完全相同的相邻项；摘要轮的 user 原文逐字保留。
 */
export async function compactMessages(messages: ChatMessage[], policy: CompactPolicy): Promise<CompactResult> {
  const { budget, lowRatio = 0.5, summarize, degradeThreshold = 160 } = policy;
  const beforeTokens = estimateMessagesTokens(messages);
  let dedupedUsers = 0;
  let degradedToolResults = 0;
  let summarizedTurns = 0;

  // ---- 阶段 0：相邻去重（字节级完全相同的 user 消息，FR-59）----
  let work: ChatMessage[] = [];
  for (const m of messages) {
    const prev = work[work.length - 1];
    if (m.role === "user" && prev?.role === "user" && prev.content === m.content) {
      dedupedUsers++;
      continue;
    }
    work.push(m);
  }

  if (estimateMessagesTokens(work) <= budget) {
    return finish(work, messages, { dedupedUsers, degradedToolResults: 0, summarizedTurns: 0, beforeTokens });
  }

  // ---- 阶段 1 试探：确定性降级（纯函数）能否独立达标（FR-60 零 LLM 路径）----
  const low = Math.ceil(budget * lowRatio);
  const degraded = degradeOldToolResults(work, { low, degradeThreshold });

  if (estimateMessagesTokens(degraded.messages) <= budget || !summarize) {
    // 降级够了（或没有摘要通道可用）——用降级结果，不发起 LLM 调用
    work = degraded.messages;
    degradedToolResults = degraded.count;
    return finish(work, messages, { dedupedUsers, degradedToolResults, summarizedTurns, beforeTokens });
  }

  // ---- 阶段 2：LLM 摘要（FR-61/62）——注意从【原文】取被压缩区间：
  //      降级会砍掉尾部标识符，摘要输入必须信息无损（anchor 才能抽到）----
  const t = trimMessages(work, { budget, lowRatio });
  if (t.removed.length > 0) {
    const pinnedUsers = t.removed.filter((m) => m.role === "user");
    const raw = t.removed.map(renderForSummary).join("\n");
    const anchors = extractAnchors(raw);
    // 头部 system 手工前置（t.kept 里也带着，需去重避免掉到中间）
    const headSystem = work[0]?.role === "system" ? [work[0]] : [];
    const keptBody = t.kept.filter((m, i) => !(i === 0 && m.role === "system"));

    // 摘要划算预检（真机实证 2026-09-01：钉住的 user 原文占大头、被压工作小时，
    // 摘要产物可比原文还大——327→362 越压越大）：摘要产物上限可估（前导语 ~35 字 +
    // 摘要 150 字 + anchor ≤10 条 ≈ 340 token，占位须用 CJK 字符——估算器对英文
    // 按 1/4 折算，'x'.repeat 会低估 4 倍）；产物预估不小于原文就直接裁剪兜底，省一次 LLM 调用
    const projected = estimateMessagesTokens([
      ...headSystem,
      ...pinnedUsers,
      { role: "user", content: "占".repeat(340) },
      ...keptBody,
    ]);
    if (projected >= estimateMessagesTokens(work)) {
      // 摘要不划算，不动作——丢弃兜底由调用方的 trimMessages 做（本函数只压缩
      // 不丢弃：丢了东西必须以"裁剪"事件可见，不能冒充压缩）
    } else {
      try {
        const summary = await summarize(raw);
        const anchorNote = anchors.length > 0 ? `\n\n关键标识符（程序提取，摘要如已包含可忽略）：${anchors.join("、")}` : "";
        // 角色必须用 user：Qwen chat 模板（llama.cpp --jinja 实测 2026-09-01）要求
        // system 只能出现在开头，非头部 system 直接 HTTP 500（PROTOCOL §8）——
        // 与 nudge/steering 的注入惯例一致：user 角色 + （系统注入：…）标注
        const summaryMsg: ChatMessage = {
          role: "user",
          content: `（系统注入：历史工作摘要｜上方 ${pinnedUsers.length} 条用户指令所触发的工作已被压缩为下面这段，指令原文保持不动）${summary}${anchorNote}`,
        };
        work = [...headSystem, ...pinnedUsers, summaryMsg, ...keptBody];
        summarizedTurns = countTurns(t.removed);
      } catch {
        // 摘要失败：保持压缩前状态（降级结果/原文），丢弃兜底由上层 trim 做——
        // 压缩是增益不是依赖（错误信封思想），失败只影响增益不影响兜底
        summarizedTurns = 0;
      }
    }
  }

  // 摘要产物若仍超预算，对保留区再做确定性降级（最后一轮永不降级）
  if (estimateMessagesTokens(work) > budget) {
    const d2 = degradeOldToolResults(work, { low, degradeThreshold });
    work = d2.messages;
    degradedToolResults += d2.count;
  }
  return finish(work, messages, { dedupedUsers, degradedToolResults, summarizedTurns, beforeTokens });
}

function finish(
  work: ChatMessage[],
  original: ChatMessage[],
  counts: { dedupedUsers: number; degradedToolResults: number; summarizedTurns: number; beforeTokens: number },
): CompactResult {
  return {
    messages: work,
    dedupedUsers: counts.dedupedUsers,
    degradedToolResults: counts.degradedToolResults,
    summarizedTurns: counts.summarizedTurns,
    beforeTokens: counts.beforeTokens,
    afterTokens: estimateMessagesTokens(work),
    changed: work.length !== original.length || JSON.stringify(work) !== JSON.stringify(original),
  };
}

/** 确定性降级（纯函数）：从最旧开始把超阈值 tool 结果压成一行，直到 ≤low 或无敌可降；
 *  最近一条 tool 结果（正在使用的工作状态）永不降级 */
function degradeOldToolResults(
  messages: ChatMessage[],
  opts: { low: number; degradeThreshold: number },
): { messages: ChatMessage[]; count: number } {
  let out = messages;
  let count = 0;
  for (let i = 0; i < out.length; i++) {
    if (estimateMessagesTokens(out) <= opts.low) break;
    const m = out[i];
    if (!m) continue;
    if (m.role === "tool" && m.content.length > opts.degradeThreshold && !isLastToolResult(out, i)) {
      const sliced = m.content.slice(0, 120);
      const total = m.content.length;
      out = out.map((x, j) => (j === i ? { ...x, content: `[工具结果已降级｜原文约${total}字] ${sliced}…` } : x));
      count++;
    }
  }
  return { messages: out, count };
}

/** index 是否是最近一条 tool 结果（刚拿到的工作状态保持完整，其余轮内旧结果可降级）。
 *  注意不是"最后一个用户轮"——单轮多回合任务里全部结果同属一轮，按轮保护会把
 *  降级整体禁死（loop 集成测试实证的缺陷）；按"最近一条"保护语义刚好 */
function isLastToolResult(messages: ChatMessage[], index: number): boolean {
  for (let i = messages.length - 1; i > index; i--) {
    if (messages[i]?.role === "tool") return false;
  }
  return true;
}

/** 渲染为摘要输入的一行（保留角色与 tool 配对标识，助手模型看得懂结构） */
function renderForSummary(m: ChatMessage): string {
  if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
    const calls = m.tool_calls.map((tc) => `${tc.function.name}(${tc.function.arguments})`).join("; ");
    return `assistant 调用工具: ${calls}${m.content ? ` 附言: ${m.content}` : ""}`;
  }
  if (m.role === "tool") return `工具结果(${m.tool_call_id}): ${m.content}`;
  return `${m.role}: ${m.content}`;
}

function countTurns(messages: ChatMessage[]): number {
  return messages.filter((m) => m.role === "user").length;
}

/** 轻量 Anchor Index（FR-62）：文件路径与长数字串，去重取前 10 */
function extractAnchors(raw: string): string[] {
  const paths = raw.match(/[A-Za-z]:[\\/][^\s"'，。；、）]+/g) ?? [];
  const nums = raw.match(/\d[\d._-]{3,}/g) ?? [];
  return [...new Set([...paths, ...nums])].slice(0, 10);
}
