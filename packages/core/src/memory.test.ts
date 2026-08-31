import test from "node:test";
import assert from "node:assert/strict";
import type { ChatMessage } from "./types.js";
import {
  estimateTokens,
  estimateMessagesTokens,
  trimMessages,
} from "./memory.js";

// ============================================================
// Step 3 上下文管理测试（FR-18~20，DESIGN §12）
// ============================================================

// ---- 估算器（FR-18）----

test("估算器：纯中文 ≈ 1 token/字", () => {
  assert.equal(estimateTokens("北京今天天气"), 6);
});

test("估算器：纯英文 ≈ 1 token/4字符（向上取整）", () => {
  assert.equal(estimateTokens("abcdefgh"), 2); // 8×0.25
  assert.equal(estimateTokens("abc"), 1); // 0.75 → ceil
});

test("估算器：混合文本单调（前缀恒 ≤ 全文，量级合理）", () => {
  const zh = "对比一下北京和上海的天气";
  const mixed = `${zh} compare weather, temperature and humidity please`;
  assert.ok(estimateTokens(zh) < estimateTokens(mixed));
  // 量级：混合文本应在 [字符数×0.1, 字符数] 区间（Qwen BPE 物理范围）
  const est = estimateTokens(mixed);
  assert.ok(est > mixed.length * 0.1 && est < mixed.length, `est=${est}`);
});

test("消息估算：含 content / tool_calls.arguments / 每条固定开销", () => {
  const msgs: ChatMessage[] = [
    { role: "system", content: "你是助手" }, // 5 + 4
    {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "id-1", type: "function", function: { name: "get_weather", arguments: '{"city":"北京"}' } },
      ],
    }, // name 11×0.25 + args 14×0.25≈4 + 4 ≈ 11（量级断言即可）
  ];
  const est = estimateMessagesTokens(msgs);
  const textOnly = estimateTokens("你是助手") + estimateTokens("");
  assert.ok(est > textOnly + 8, "固定开销与 tool_calls 应被计入");
});

// ---- 裁剪（FR-19/20）----

/** 构造 N 个完整问答回合（user → assistant(tool_calls) → tool → assistant 终答） */
function makeTurns(n: number, filler = "随便聊聊"): ChatMessage[] {
  const out: ChatMessage[] = [{ role: "system", content: "系统提示" }];
  for (let i = 1; i <= n; i++) {
    out.push({ role: "user", content: `${filler} 第${i}轮` });
    out.push({
      role: "assistant",
      content: null,
      tool_calls: [
        { id: `id-${i}`, type: "function", function: { name: "get_weather", arguments: `{"city":"北京${i}"}` } },
      ],
    });
    out.push({ role: "tool", tool_call_id: `id-${i}`, content: `{"ok":true,"data":{"i":${i}}}` });
    out.push({ role: "assistant", content: `第${i}轮回答完毕` });
  }
  return out;
}

test("未超预算：恒等返回且不动原数组（平凡轮次零成本）", () => {
  const msgs = makeTurns(3);
  const before = [...msgs];
  const r = trimMessages(msgs, { budget: 10_000 });
  assert.deepEqual(r.removed, []);
  assert.equal(r.kept.length, msgs.length);
  assert.deepEqual(msgs, before); // 原数组未被改动
});

test("超预算：从最旧回合整回合裁剪，保 system 与最后一回合", () => {
  const msgs = makeTurns(8, "这是一段比较长的对话内容用来撑大上下文");
  const total = estimateMessagesTokens(msgs);
  const budget = Math.ceil(total * 0.6); // 触发裁剪
  const r = trimMessages(msgs, { budget });
  assert.ok(r.removed.length > 0, "应有回合被裁");
  assert.equal(r.kept[0]?.role, "system", "system 永远保留");
  // 最后一回合保留：末尾还是第 8 轮的终答
  assert.deepEqual(r.kept.at(-1), msgs.at(-1));
  // 裁的是最旧的：kept 从某个 user 开始，回合序号 > 1
  const firstUser = r.kept.find((m) => m.role === "user");
  assert.match(firstUser?.role === "user" ? firstUser.content : "", /第[2-8]轮/);
  // 裁到低水位（预算一半）以内
  assert.ok(r.afterTokens <= Math.ceil(budget * 0.5), `after=${r.afterTokens} ≤ ${budget * 0.5}`);
});

test("回合完整性：裁剪后不存在孤立的 tool 消息或悬空 tool_call_id", () => {
  const msgs = makeTurns(10, "长内容占位符长内容占位符长内容占位符");
  const budget = Math.ceil(estimateMessagesTokens(msgs) * 0.5);
  const r = trimMessages(msgs, { budget });
  const idsWithCall = new Set(
    r.kept.flatMap((m) => (m.role === "assistant" && m.tool_calls ? m.tool_calls.map((t) => t.id) : [])),
  );
  for (const m of r.kept) {
    if (m.role === "tool") {
      assert.ok(idsWithCall.has(m.tool_call_id), `tool ${m.tool_call_id} 必须有配对的 tool_calls`);
    }
  }
  // 且消息链以 user 起头（system 之后），是合法对话开头
  const idx = r.kept.findIndex((m) => m.role === "user");
  assert.ok(idx >= 0 && idx <= 1, "首个非 system 消息应是 user");
});

test("极小预算：仅剩 system+最后回合也不死循环，如实返回", () => {
  const msgs = makeTurns(5, "特别长的内容".repeat(50));
  const r = trimMessages(msgs, { budget: 10 });
  assert.equal(r.kept[0]?.role, "system");
  assert.equal(r.kept.at(-1), msgs.at(-1), "最后一回合永远保留");
  // 所有中间回合都被裁掉
  assert.ok(r.kept.length <= 1 + 4 + 1, "至多 system + 最后回合 + 相邻残留");
});

test("双水位语义：预算内不裁、刚超预算一次裁到一半（不是裁一点）", () => {
  const msgs = makeTurns(6, "中等长度的对话内容占位");
  const total = estimateMessagesTokens(msgs);
  // 预算设为 total×0.95：仍会触发（> budget 的时刻不存在——此时 total>budget? 否）
  // 正确触发姿势：budget = total - 1（刚好超）
  const budget = total - 1;
  const r = trimMessages(msgs, { budget });
  assert.ok(r.afterTokens <= Math.ceil(budget * 0.5) + 40, "应一次裁到低水位附近，而非只裁一条");
  assert.ok(r.removed.length >= 4, "整回合裁剪至少移除一个完整回合（4 条消息）");
});
