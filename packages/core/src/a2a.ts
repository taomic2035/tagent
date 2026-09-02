import { z } from "zod";
import type { ChatMessage, Tool, ToolContext } from "./types.js";
import { z as zod } from "zod";

// ============================================================
// A2A 投递内核 + 机械路由 + ping-pong 熔断（Step 16 FR-92/98/99，
// clowder 多 agent 协同的教学复现）
//
// clowder 五原则原文：
//   One owner per fact / Change on one cutover /
//   Don't infer one fact from another (dispatched ≠ seen; settled ≠ handled) /
//   One terminal per run / Projections are rebuildable; fail closed
//
// 档位：[60] 三对象 + 单一 admission 事务
//       [80] 机械路由（行首 @ + 剥代码块 + ≤2 目标）+ ping-pong 熔断
//       [100] processing bubble 顺序栅栏 + 事件驱动 drain 不变量
// ============================================================

// ---------------- [80] 机械路由（零智能，可测） ----------------

export interface RouteTargets {
  handles: string[];      // 命中的 @ 句柄（按出现顺序，≤2）
  text: string;           // 剥离后的正文
}

/**
 * clowder 路由层设计宣言："简单、可预测、零歧义"——
 * 只有**行首** @handle 才路由；代码块/行内代码/URL/引号内不路由；
 * 每消息最多 2 个目标（第三及以后静默忽略）。
 */
export function extractRouteTargets(raw: string, knownHandles: string[]): RouteTargets {
  // 剥代码块（``` 围栏）、行内代码、URL、引号内容
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/"[^"]*"/g, "");

  const handles: string[] = [];
  for (const line of cleaned.split("\n")) {
    const m = line.match(/^@(\S+)/);
    if (!m) continue;
    const handle = m[1];
    if (handle && knownHandles.includes(handle) && !handles.includes(handle)) {
      handles.push(handle);
      if (handles.length >= 2) break; // ≤2 目标
    }
  }
  return { handles, text: cleaned.trim() };
}

// ---------------- [80] ping-pong 熔断（含 substantive 豁免） ----------------

export interface PingPongConfig {
  warnThreshold: number;   // clowder: 2
  blockThreshold: number;  // clowder: 4
  substantiveOutputLen: number; // clowder: 200 字符
  routingTools: string[];  // 显式排除为非实质（防 breaker 被打穿）
}

export const DEFAULT_PINGPONG: PingPongConfig = {
  warnThreshold: 2,
  blockThreshold: 4,
  substantiveOutputLen: 200,
  routingTools: ["post_message", "multi_mention", "hold_ball"],
};

export type PingPongVerdict = { action: "ok" } | { action: "warn"; streak: number } | { action: "block"; streak: number };

/**
 * substantive 豁免（clowder 最有教学价值的细节）：上家本轮有实质工具调用
 * （非路由类）或输出 > substantiveOutputLen，streak **重置为 1** 而非 +1——
 * "3 short + 1 substantive + 1 short 若不重置仍会在第 5 轮熔断"。
 */
export function pingPongUpdate(
  pairKey: string,               // 无序对键（A↔B 同键）
  streaks: Map<string, number>,
  lastTurn: { toolNames: string[]; outputLen: number },
  cfg: PingPongConfig = DEFAULT_PINGPONG,
): PingPongVerdict {
  const substantive =
    lastTurn.toolNames.some((t) => !cfg.routingTools.includes(t)) ||
    lastTurn.outputLen > cfg.substantiveOutputLen;
  const streak = substantive ? 1 : (streaks.get(pairKey) ?? 0) + 1;
  streaks.set(pairKey, streak);
  if (streak >= cfg.blockThreshold) return { action: "block", streak };
  if (streak >= cfg.warnThreshold) return { action: "warn", streak };
  return { action: "ok" };
}

// ---------------- [60/100] A2A 投递内核 ----------------

export type QueueEntryStatus = "queued" | "admitted" | "skipped";
export interface QueueEntry {
  id: string;
  fromHandle: string;
  text: string;
  targets: string[];
  at: number;
  status: QueueEntryStatus;
}

export interface HistoryMessage {
  id: string;
  queueEntryId: string;
  fromHandle: string;
  text: string;
  at: number;
}

export interface ActiveRun {
  id: string;
  historyMessageId: string;
  agentHandle: string;
  startedAt: number;
  outcome?: "completed" | "failed" | "aborted"; // one terminal per run
}

/**
 * [60] 单一 admission 事务（clowder A2A 内核教学版）：
 * "A public input lives only in the Queue — invisible to the chat panel and
 *  to other agents' context — until a single admission step materializes
 *  it into History."
 * 一个 admit() 调用原子完成：队列条目升级 + History 物化 + Active Run 创建。
 * [100] processing bubble 顺序栅栏：同 bubble 内前一个未终结，后一个不受理
 * （"后完成的猫不能插队"）。
 */
export class A2ABoard {
  private queue: QueueEntry[] = [];
  private history: HistoryMessage[] = [];
  private runs: ActiveRun[] = [];
  private bubble = new Map<string, string>(); // handle -> activeRunId（顺序栅栏）

  enqueue(fromHandle: string, text: string, targets: string[]): QueueEntry {
    const e: QueueEntry = { id: `q${this.queue.length + 1}`, fromHandle, text, targets, at: Date.now(), status: "queued" };
    this.queue.push(e);
    return e;
  }

  /** 单切面：Queue → History → Active Run 一个事务（失败则整体不发生） */
  admit(entryId: string): { message: HistoryMessage; run: ActiveRun } | { refused: "bubble_busy" | "not_found" } {
    const entry = this.queue.find((e) => e.id === entryId && e.status === "queued");
    if (!entry) return { refused: "not_found" };
    // [100] 顺序栅栏：同 agent 有未终结 run 时拒绝受理（后完成不插队）
    const blocking = entry.targets.find((t) => this.bubble.has(t));
    if (blocking) return { refused: "bubble_busy" };

    entry.status = "admitted";
    const msg: HistoryMessage = { id: `h${this.history.length + 1}`, queueEntryId: entry.id, fromHandle: entry.fromHandle, text: entry.text, at: Date.now() };
    this.history.push(msg);
    const run: ActiveRun = { id: `r${this.runs.length + 1}`, historyMessageId: msg.id, agentHandle: entry.targets[0] ?? entry.fromHandle, startedAt: Date.now() };
    this.runs.push(run);
    this.bubble.set(run.agentHandle, run.id);
    return { message: msg, run };
  }

  /** one terminal per run：终态幂等（已终结的再终结返回原终态） */
  settle(runId: string, outcome: ActiveRun["outcome"]): boolean {
    const run = this.runs.find((r) => r.id === runId);
    if (!run || run.outcome) return false; // 幂等：已终态
    run.outcome = outcome;
    this.bubble.delete(run.agentHandle);
    return true;
  }

  /** [100] drain 不变量："不可能稳定停在 队列非空+头可执行+无 Active Run+无 drain" */
  drain(): number {
    let admitted = 0;
    for (const e of [...this.queue]) {
      if (e.status !== "queued") continue;
      const r = this.admit(e.id);
      if ("message" in r) admitted++;
    }
    return admitted;
  }

  get queued(): readonly QueueEntry[] { return this.queue.filter((e) => e.status === "queued"); }
  get messages(): readonly HistoryMessage[] { return this.history; }
  get activeRuns(): readonly ActiveRun[] { return this.runs.filter((r) => !r.outcome); }
}

// ---------------- [FR-96] faux provider：可编程确定性 LLM 模拟器 ----------------

export interface FauxStep {
  /** 静态消息 或 工厂函数（可按调用次数/上下文编程） */
  respond: (ctx: { callCount: number; messages: ChatMessage[] }) => {
    text?: string;
    toolCalls?: Array<{ name: string; args: string }>;
    finishReason: "stop" | "tool_calls";
  };
}

export interface FauxUsage {
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;   // [核心] 连 prompt cache 都模拟
  cacheWriteTokens: number;
}

/**
 * pi faux provider 的教学版：脚本化步骤 + **prompt cache 模拟**
 * （按前缀指纹记住上次 prompt，公共前缀长度 → cacheRead/cacheWrite）。
 * 整个 agent 栈的测试不需要真 LLM——且缓存行为也可确定性测试。
 */
export class FauxClient {
  private callCount = 0;
  private lastPromptFingerprint: string | null = null;
  readonly usageLog: FauxUsage[] = [];

  constructor(private steps: FauxStep[]) {}

  async *stream(req: { messages: ChatMessage[] }): AsyncGenerator<
    | { type: "text-delta"; delta: string }
    | { type: "tool-call-delta"; index: number; id: string; name: string; argsDelta: string }
    | { type: "done"; finishReason: "stop" | "tool_calls"; usage?: { promptTokens: number; completionTokens: number } }
  > {
    const step = this.steps[Math.min(this.callCount, this.steps.length - 1)];
    if (!step) throw new Error("faux: 无步骤");
    this.callCount++;
    const r = step.respond({ callCount: this.callCount, messages: req.messages });

    // prompt cache 模拟：公共前缀 → cacheRead
    const fingerprint = JSON.stringify(req.messages);
    let common = 0;
    if (this.lastPromptFingerprint) {
      const a = this.lastPromptFingerprint, b = fingerprint;
      while (common < Math.min(a.length, b.length) && a[common] === b[common]) common++;
    }
    const promptTokens = Math.ceil(fingerprint.length / 4);
    const cacheRead = Math.ceil(common / 4);
    const usage: FauxUsage = {
      promptTokens, completionTokens: (r.text?.length ?? 0) + 20,
      cacheReadTokens: cacheRead, cacheWriteTokens: promptTokens - cacheRead,
    };
    this.usageLog.push(usage);
    this.lastPromptFingerprint = fingerprint;

    if (r.text) yield { type: "text-delta", delta: r.text };
    for (const [i, tc] of (r.toolCalls ?? []).entries()) {
      yield { type: "tool-call-delta", index: i, id: `faux-${this.callCount}-${i}`, name: tc.name, argsDelta: tc.args };
    }
    yield { type: "done", finishReason: r.finishReason, usage: { promptTokens, completionTokens: usage.completionTokens } };
  }
}
