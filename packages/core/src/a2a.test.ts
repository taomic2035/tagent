import test from "node:test";
import assert from "node:assert/strict";
import { extractRouteTargets, pingPongUpdate, A2ABoard, FauxClient, DEFAULT_PINGPONG } from "./a2a.js";
import type { ChatMessage } from "./types.js";

test("[80] 机械路由：行首 @ 才路由，剥代码块/URL/引号，≤2 目标", () => {
  const handles = ["cat1", "cat2", "cat3"];
  const r1 = extractRouteTargets("@cat1 帮我查一下", handles);
  assert.deepEqual(r1.handles, ["cat1"]);
  const r2 = extractRouteTargets("看这段 `@cat1` 不路由\n@cat2 继续\n@cat3 也行", handles);
  assert.deepEqual(r2.handles, ["cat2", "cat3"], "只有行首 @ 才路由");
  const r3 = extractRouteTargets("@cat1\n@cat2\n@cat3 超限", handles);
  assert.deepEqual(r3.handles, ["cat1", "cat2"], "最多 2 个（第三只忽略）");
  const r4 = extractRouteTargets("https://x.com/@cat1 不是行首", handles);
  assert.deepEqual(r4.handles, [], "URL 内不路由");
});

test("[80] ping-pong：≥2 警告 ≥4 熔断；substantive 豁免重置为 1", () => {
  const streaks = new Map<string, number>();
  const pair = "A|B";
  assert.deepEqual(pingPongUpdate(pair, streaks, { toolNames: [], outputLen: 50 }), { action: "ok" });
  assert.deepEqual(pingPongUpdate(pair, streaks, { toolNames: [], outputLen: 50 }), { action: "warn", streak: 2 });
  // substantive：实质工具调用 → 重置为 1
  assert.deepEqual(pingPongUpdate(pair, streaks, { toolNames: ["read_file"], outputLen: 50 }), { action: "ok" }, "重置");
  assert.deepEqual(pingPongUpdate(pair, streaks, { toolNames: [], outputLen: 50 }), { action: "warn", streak: 2 });
  assert.deepEqual(pingPongUpdate(pair, streaks, { toolNames: [], outputLen: 50 }), { action: "warn", streak: 3 });
  assert.deepEqual(pingPongUpdate(pair, streaks, { toolNames: [], outputLen: 50 }), { action: "block", streak: 4 }, "硬熔断");
  // 路由类工具不算 substantive（防 breaker 被打穿）
  const s2 = new Map<string, number>();
  s2.set("C|D", 3);
  assert.deepEqual(pingPongUpdate("C|D", s2, { toolNames: ["post_message"], outputLen: 50 }), { action: "block", streak: 4 }, "路由工具不算实质");
});

test("[60] A2ABoard：单一 admission + one terminal + bubble 栅栏", () => {
  const b = new A2ABoard();
  const q = b.enqueue("user", "任务 X", ["cat1"]);
  const r1 = b.admit(q.id);
  assert.ok("message" in r1 && "run" in r1);
  // bubble 栅栏：cat1 还有活跃 run → 再给 cat1 的排队被拒
  const q2 = b.enqueue("user", "任务 Y", ["cat1"]);
  const r2 = b.admit(q2.id);
  assert.deepEqual(r2, { refused: "bubble_busy" });
  // one terminal per run：幂等
  assert.equal(b.settle(r1.run.id, "completed"), true);
  assert.equal(b.settle(r1.run.id, "completed"), false, "已终态再 settle 返回 false");
  // 栅栏解除后可 admit
  const r3 = b.admit(q2.id);
  assert.ok("message" in r3);
});

test("[FR-96] faux provider：确定性步骤 + prompt cache 模拟", async () => {
  const faux = new FauxClient([
    { respond: () => ({ text: "你好", finishReason: "stop" }) },
    { respond: () => ({ text: "再次", finishReason: "stop" }) },
  ]);
  const msgs1: ChatMessage[] = [{ role: "user", content: "共同的prompt前缀" }];
  const msgs2: ChatMessage[] = [{ role: "user", content: "共同的prompt前缀" }, { role: "assistant", content: "你好" }];
  const events1 = []; for await (const ev of faux.stream({ messages: msgs1 })) events1.push(ev);
  const events2 = []; for await (const ev of faux.stream({ messages: msgs2 })) events2.push(ev);
  assert.equal(faux.usageLog[0]?.cacheReadTokens, 0, "首次无缓存");
  assert.ok((faux.usageLog[1]?.cacheReadTokens ?? 0) > 0, "第二次有前缀命中");
  assert.ok((faux.usageLog[1]?.cacheWriteTokens ?? 1) < (faux.usageLog[1]?.promptTokens ?? 0), "写入 < 全量");
});
