import test from "node:test";
import assert from "node:assert/strict";
import { applyBallEvent, BallCustodyEventLog, DEAD_BALL_ZOMBIE_GRACE_MS } from "./ball-custody.js";
import type { BallSnapshot, BallEvent } from "./ball-custody.js";

const snap = (state: BallSnapshot["state"], over: Partial<BallSnapshot> = {}): BallSnapshot =>
  ({ state, lastStateChangeAt: 0, appliedEventCount: 0, ...over });

test("[60] 状态机：handed → active → resolved", () => {
  const e = (kind: BallEvent["kind"], at = 1): BallEvent =>
    ({ sourceEventId: `e${at}`, subjectKey: "ball:t1", kind, at });
  assert.deepEqual(applyBallEvent(e("handed"), snap("new")), { ok: true, next: "active" });
  assert.deepEqual(applyBallEvent(e("resolved"), snap("active")), { ok: true, next: "resolved" });
  assert.deepEqual(applyBallEvent(e("handed"), snap("resolved")), { ok: false, reason: "invalid_transition" });
});

test("[80] hold_expired 守卫：fireAt 必须匹配 heldUntil（防旧 reminder 误杀新 hold）", () => {
  const s = snap("active", { heldUntil: 5000 });
  const old = { sourceEventId: "x", subjectKey: "b", kind: "hold_expired" as const, at: 10, payload: { fireAt: 3000 } };
  const cur = { sourceEventId: "y", subjectKey: "b", kind: "hold_expired" as const, at: 11, payload: { fireAt: 5000 } };
  assert.deepEqual(applyBallEvent(old, s), { ok: false, reason: "invalid_transition" }, "旧 fireAt ≠ heldUntil → 拒绝");
  assert.deepEqual(applyBallEvent(cur, s), { ok: true, next: "dead" }, "匹配 → dead");
});

test("[80] zombie grace：死球迟到心跳复活", () => {
  const dead = snap("dead", { lastStateChangeAt: 1000 });
  const within = { sourceEventId: "h1", subjectKey: "b", kind: "heartbeat" as const, at: 1000 + DEAD_BALL_ZOMBIE_GRACE_MS - 1 };
  const beyond = { sourceEventId: "h2", subjectKey: "b", kind: "heartbeat" as const, at: 1000 + DEAD_BALL_ZOMBIE_GRACE_MS + 1 };
  assert.deepEqual(applyBallEvent(within, dead), { ok: true, next: "active" });
  assert.deepEqual(applyBallEvent(beyond, dead), { ok: false, reason: "invalid_transition" });
});

test("[60] 事件日志：幂等 + 投影可重建", () => {
  const log = new BallCustodyEventLog();
  log.append({ sourceEventId: "e1", subjectKey: "b", kind: "handed", at: 1 });
  assert.equal(log.append({ sourceEventId: "e1", subjectKey: "b", kind: "handed", at: 1 }), false, "同 sourceEventId 去重");
  log.append({ sourceEventId: "e2", subjectKey: "b", kind: "resolved", at: 2 });
  assert.equal(log.project("b").state, "resolved", "投影 = 重放结果");
});
