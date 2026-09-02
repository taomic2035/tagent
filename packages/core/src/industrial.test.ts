import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import {
  shouldTerminateByTools, spillIfOversized, headTailWindow,
  CellAuthority, runCodeCell, auditEffectSandwich,
  transitionAwait, baselineDiff, detectFalseCompletion,
} from "./industrial.js";
import type { ChatMessage } from "./types.js";

// ============================================================
// 工业模式复现测试（Step 16，按档分层）
// ============================================================

// ---- 模式一 terminate 批规则 ----
test("[60] terminate：全 terminate 批收尾；混合批忽略；空批/非信封不触发", () => {
  assert.equal(shouldTerminateByTools(['{"ok":true,"terminate":true}']), true);
  assert.equal(shouldTerminateByTools(['{"ok":true,"terminate":true}', '{"ok":true}']), false, "混合批：部分 terminate 忽略");
  assert.equal(shouldTerminateByTools([]), false);
  assert.equal(shouldTerminateByTools(["不是 JSON"]), false);
});

// ---- 模式二 recover-don't-rerun ----
test("[60] spill：超限落盘 + 信封带恢复路径", () => {
  const big = "x".repeat(6000);
  const { text, meta } = spillIfOversized(big, { limitBytes: 1000, spillDir: "D:/LLM/tmp/spill-test" });
  assert.equal(meta.spilled, true);
  assert.ok(meta.spillPath && meta.spillPath.includes("out-"));
  assert.ok(text.length < big.length);
  assert.ok(meta.fullBytes === 6000);
});
test("[80] 内容寻址复用：同输出只写一次", () => {
  const big = "y".repeat(5000);
  const a = spillIfOversized(big, { limitBytes: 1000, spillDir: "D:/LLM/tmp/spill-test" });
  const b = spillIfOversized(big, { limitBytes: 1000, spillDir: "D:/LLM/tmp/spill-test" });
  assert.equal(a.meta.spillPath, b.meta.spillPath, "相同内容 → 相同文件");
});
test("[80] head40/tail60 窗口", () => {
  const w = headTailWindow("A".repeat(400) + "M" + "B".repeat(600), 100);
  assert.ok(w.startsWith("A"), "head 在前");
  assert.ok(w.endsWith("B"), "tail 在后");
  assert.ok(w.includes("截断"));
});

// ---- 模式三 effect sandwich 孤儿检测 ----
test("[60] 孤儿检测：意图无结算 + 反向孤儿", () => {
  const msgs: ChatMessage[] = [
    { role: "user", content: "q" },
    { role: "assistant", content: null, tool_calls: [{ id: "a", type: "function", function: { name: "t", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "a", content: "{}" },
    { role: "assistant", content: null, tool_calls: [{ id: "b", type: "function", function: { name: "t", arguments: "{}" } }] }, // 孤儿 b
  ];
  const r = auditEffectSandwich(msgs);
  assert.deepEqual(r.orphanToolCallIds, ["b"]);
  const msgs2: ChatMessage[] = [{ role: "tool", tool_call_id: "ghost", content: "{}" }];
  assert.deepEqual(auditEffectSandwich(msgs2).orphanToolMsgIds, ["ghost"], "反向孤儿");
});

// ---- 模式七 AwaitState ----
test("[60] expiry 优先于谓词匹配 + one-shot", () => {
  const s = { v: 1 as const, generation: 1, subjectRef: "task:1", when: ["pr_merged"], then: "续跑", expiresAt: 1000 };
  const expired = transitionAwait(s, { at: 2000, matched: "pr_merged", generation: 1 });
  assert.deepEqual(expired, { to: "expired" }, "过期+谓词同时满足 → expired 优先");
  const ok = transitionAwait(s, { at: 500, matched: "pr_merged", generation: 1 });
  assert.deepEqual(ok, { to: "fulfilled", by: "pr_merged" });
  const stale = transitionAwait(s, { at: 500, matched: "pr_merged", generation: 2 });
  assert.deepEqual(stale, { to: "unchanged", reason: "generation_mismatch" });
});
test("[80] baseline diff 只给相对量", () => {
  const d = baselineDiff({ head: "a1", other: "x" }, { head: "a2", other: "x" });
  assert.deepEqual(d, { head: { from: "a1", to: "a2" } }, "未变字段不出现在 diff");
});

// ---- 模式九 假完成检测 ----
test("[60] 声称记住但没调 remember → 假完成", () => {
  const hits = detectFalseCompletion("好的，我已经记住了你的偏好", []);
  assert.ok(hits.some((h) => h.detail === "remember" && !h.acted));
  const ok = detectFalseCompletion("已经记住", ["remember"]);
  assert.ok(ok.every((h) => h.acted), "有调用则不算假完成");
  assert.equal(detectFalseCompletion("随便聊聊", []).length, 0, "无声称不触发");
});

// ---- 模式十二 execute_code + CellAuthority ----
test("[80] execute_code：脚本调工具，只有返回值出来（需显式 return——与 hermes kernel 同语义）", async () => {
  const calls: Array<[string, string]> = [];
  const r = await runCodeCell(
    `const a = await tools.get_weather('{"city":"北京"}');
     return a;`,
    { callTool: async (n, a) => { calls.push([n, a]); return '{"tempC":28}'; } },
  );
  assert.equal(r.toolCallsUsed, 1);
  assert.ok(r.returnValue.includes("28"));
  assert.equal(r.authorityRetired, true);
});
test("[80] CellAuthority：retire 后迟到调用拒绝", () => {
  const auth = new CellAuthority();
  auth.checkAlive(); // 不抛
  auth.retire();
  assert.throws(() => auth.checkAlive(), /迟到.*拒绝|拒绝/);
});
test("[80] 工具白名单 + 预算", async () => {
  await assert.rejects(
    runCodeCell(`await tools.forbidden('{}')`, { callTool: async () => "{}", allowedTools: ["ok_tool"] }),
    /不在白名单/,
  );
  await assert.rejects(
    runCodeCell(`for(let i=0;i<60;i++) await tools.ok_tool('{}')`,
      { callTool: async () => "{}", allowedTools: ["ok_tool"], callBudget: 50 }),
    /预算/,
  );
});
test("[80] 持久 context：变量跨 cell 存活，权限不", async () => {
  const ctx: Record<string, unknown> = {};
  const deps = { callTool: async () => '"x"' };
  await runCodeCell(`globalThis.acc = 42; return globalThis.acc;`, deps, { context: ctx });
  const r2 = await runCodeCell(`return globalThis.acc + 1;`, deps, { context: ctx });
  assert.equal(r2.returnValue, "43", "状态跨 cell 存活（vm.createContext 持久 realm）");
});
