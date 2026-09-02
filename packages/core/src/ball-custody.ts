// ============================================================
// 球权引擎（Step 16 FR-93，clowder Ball Custody 的教学复现）
//
// clowder 核心思想：把"谁该做下一步"从隐式对话状态变成**可审计、可重建
// 的投影**——append-only 事件日志 + 纯函数状态机。
//
// 档位：[60] 8 态状态机 + 事件日志 + 幂等键
//       [80] 守卫 resolver（hold_expired 的 fireAt 匹配 / zombie grace）
//       [100] 事件永不 TTL + 投影重建 + ingest 串行化
//
// 状态机实为 8 态（源码事实，修正"7 态"的常见误记）：
//   new / active / blocked / parked / dead / void / zombie / resolved
// ============================================================

export type BallState =
  | "new" | "active" | "blocked" | "parked"
  | "dead" | "void" | "zombie" | "resolved";

export type BallEventKind =
  | "handed"            // 球被交给某 holder
  | "picked_up"         // holder 接球
  | "blocked"           // 等外部条件
  | "parked"            // 搁置
  | "hold_expired"      // 等待超时
  | "heartbeat"         // 活性信号
  | "resolved"          // 终态（完成）
  | "frozen" | "degraded" | "abandoned"; // "安乐死"三态（语义独立、转移共享）

export interface BallEvent {
  /** [60] 幂等键：同 key 事件全局去重（clowder 的 route:{msgId}:{catId} 设计
   *  防多目标去重吞掉——这里教学化为必填字段） */
  sourceEventId: string;
  subjectKey: string;
  kind: BallEventKind;
  at: number;
  payload?: { fireAt?: number; holder?: string; reason?: string };
}

export interface BallSnapshot {
  state: BallState;
  holder?: string;
  heldUntil?: number;
  lastStateChangeAt: number;
  appliedEventCount: number;
}

export type BallTransitionResult =
  | { ok: true; next: BallState }
  | { ok: false; reason: "bad_payload" | "invalid_transition" };

/** zombie 宽限期：死球迟到心跳在窗口内可复活（clowder 600s 的教学值） */
export const DEAD_BALL_ZOMBIE_GRACE_MS = 600_000;

/**
 * [60/80] 纯函数状态机（零 IO，表 + resolver 双驱动——clowder 同构）。
 * 三个最有教学价值的守卫：
 * - hold_expired 的 fireAt 必须匹配当前 heldUntil（防旧 reminder 误杀新 hold）
 * - heartbeat 在 dead 后的 zombie grace 内可复活
 * - frozen/degraded/abandoned 三 kind 共享转移（语义独立）
 */
export function applyBallEvent(
  event: BallEvent,
  snapshot: BallSnapshot,
): BallTransitionResult {
  const current = snapshot.state;
  switch (event.kind) {
    case "handed":
    case "picked_up":
      return current === "new" || current === "active" || current === "parked" || current === "blocked" || current === "zombie"
        ? { ok: true, next: "active" }
        : { ok: false, reason: "invalid_transition" };

    case "blocked":
      return current === "active" ? { ok: true, next: "blocked" } : { ok: false, reason: "invalid_transition" };

    case "parked":
      return current === "active" || current === "blocked" ? { ok: true, next: "parked" } : { ok: false, reason: "invalid_transition" };

    case "hold_expired": {
      // [80] 守卫：fireAt 必须等于快照里的 heldUntil——旧 reminder 不杀新 hold
      const fireAt = event.payload?.fireAt;
      if (typeof fireAt !== "number") return { ok: false, reason: "bad_payload" };
      return current === "active" && snapshot.heldUntil === fireAt
        ? { ok: true, next: "dead" }
        : { ok: false, reason: "invalid_transition" };
    }

    case "heartbeat": {
      if (current === "active") return { ok: true, next: "active" };
      // [80] zombie grace：死球迟到心跳复活
      if (current === "dead") {
        const sinceDeath = event.at - snapshot.lastStateChangeAt;
        return sinceDeath > 0 && sinceDeath <= DEAD_BALL_ZOMBIE_GRACE_MS
          ? { ok: true, next: "active" }
          : { ok: false, reason: "invalid_transition" };
      }
      return { ok: false, reason: "invalid_transition" };
    }

    case "resolved":
      return current !== "resolved" ? { ok: true, next: "resolved" } : { ok: false, reason: "invalid_transition" };

    case "frozen":
    case "degraded":
    case "abandoned":
      // [80] "安乐死"三 kind：任何非终态 → resolved（语义由 kind 区分，转移共享）
      return current !== "resolved" ? { ok: true, next: "resolved" } : { ok: false, reason: "invalid_transition" };
  }
}

/**
 * [60/100] 事件日志 + 投影：append-only，幂等键去重（seen SET + push 同步做），
 * 投影可全量重建（rebuild），事件永不 TTL（clowder 铁律 LL-048 的教学化）。
 */
export class BallCustodyEventLog {
  private events: BallEvent[] = [];
  private seen = new Set<string>();

  append(event: BallEvent): boolean {
    if (this.seen.has(event.sourceEventId)) return false; // 幂等
    this.seen.add(event.sourceEventId);
    this.events.push(event);
    return true;
  }

  /** 投影：全量重放（纯函数链）——"projections are rebuildable" */
  project(subjectKey: string): BallSnapshot {
    let snap: BallSnapshot = { state: "new", lastStateChangeAt: 0, appliedEventCount: 0 };
    for (const e of this.events) {
      if (e.subjectKey !== subjectKey) continue;
      const r = applyBallEvent(e, snap);
      if (r.ok) {
        snap = {
          state: r.next,
          holder: e.payload?.holder ?? snap.holder,
          heldUntil: e.kind === "blocked" ? e.at + 60_000 : snap.heldUntil,
          lastStateChangeAt: e.at,
          appliedEventCount: snap.appliedEventCount + 1,
        };
      }
    }
    return snap;
  }

  /** [100] ingest 串行化保护说明：投影是 read-modify-save，同 subject 并发
   *  apply 会 clobber（clowder 用 promise chain 串行——单线程 JS 教学版
   *  天然串行，此处以注释立约） */
  get allEvents(): readonly BallEvent[] { return this.events; }
}
