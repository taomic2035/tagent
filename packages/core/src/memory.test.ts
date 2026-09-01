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

// ============================================================
// Step 11 摘要压缩测试（FR-59~63）
// ============================================================

import { compactMessages } from "./memory.js";

/** 构造一个用户轮：user + assistant(tool_calls) + tool 结果 + assistant 终答 */
function turn(user: string, toolResult: string, final: string): ChatMessage[] {
  return [
    { role: "user", content: user },
    { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "get_weather", arguments: '{"city":"北京"}' } }] },
    { role: "tool", tool_call_id: "t1", content: toolResult },
    { role: "assistant", content: final },
  ];
}

test("压缩·阶段0：相邻完全相同的 user 去重，不同内容/不相邻不去（FR-59）", async () => {
  const messages: ChatMessage[] = [
    { role: "system", content: "sys" },
    { role: "user", content: "查北京天气" },
    { role: "user", content: "查北京天气" }, // 手滑重发 → 去重
    { role: "user", content: "顺便上海也看看" }, // 不同内容 → 保留
    { role: "assistant", content: "好的" },
    { role: "user", content: "查北京天气" }, // 不相邻（语义上可能是强调）→ 保留
  ];
  const r = await compactMessages(messages, { budget: 10000 });
  assert.equal(r.dedupedUsers, 1);
  assert.equal(r.messages.filter((m) => m.role === "user" && m.content === "查北京天气").length, 2);
});

test("压缩·不超预算：零动作原样返回（阶梯的零成本路径）", async () => {
  const messages = turn("问", "短结果", "答");
  const r = await compactMessages(messages, { budget: 10000 });
  assert.equal(r.dedupedUsers + r.degradedToolResults + r.summarizedTurns, 0);
  assert.equal(r.changed, false);
  assert.deepEqual(r.messages, messages);
});

test("压缩·阶段1：超预算先降级旧 tool 结果，达标则零 LLM 调用（FR-60）", async () => {
  const longTool = "x".repeat(400);
  const messages = [...turn("第一问", longTool, "第一答"), ...turn("第二问", longTool, "第二答")];
  let llmCalls = 0;
  const r = await compactMessages(messages, {
    budget: estimateMessagesTokens(messages) - 50, // 逼降级
    summarize: async () => (llmCalls++, "摘要"),
  });
  assert.ok(r.degradedToolResults >= 1, "至少降级了一条旧 tool 结果");
  assert.equal(r.summarizedTurns, 0, "降级已达标，不发起 LLM 摘要");
  assert.equal(llmCalls, 0);
  // 降级保留前 120 字 + 标注原文长度
  const degraded = r.messages.find((m) => m.role === "tool" && m.content.includes("[工具结果已降级"));
  assert.ok(degraded);
});

test("压缩·阶段2：摘要替换结构 = system头 + user原文钉住 + system摘要 + kept尾部（FR-61）", async () => {
  const longTool = "数据 " + "细节内容 ".repeat(60) + "路径 D:/LLM/models/qwen.gguf 版本 4.1.2 ";
  const messages = [
    { role: "system" as const, content: "系统提示" },
    ...turn("第一问", longTool, "第一答"),
    ...turn("第二问", longTool, "第二答"),
    ...turn("最后一问", "短结果", "最后一答"),
  ];
  const rawInputs: string[] = [];
  const r = await compactMessages(messages, {
    budget: 150, // 压到降级也无法独立达标 → 必走 LLM 摘要路径
    summarize: async (raw) => {
      rawInputs.push(raw);
      return "两轮天气查询已完成，结果正常。";
    },
  });
  assert.equal(r.summarizedTurns, 2);
  assert.equal(rawInputs.length, 1, "一次调用摘要全部被压缩轮");
  // 结构：system 头仍在最前（不被挤到中间）
  assert.equal(r.messages[0]?.role, "system");
  assert.equal(r.messages[0]?.role === "system" && r.messages[0].content, "系统提示");
  // user 原文钉住：字节级一致，语气词原样（FR-61 + §16.1 不改写）
  assert.deepEqual(
    r.messages.slice(1, 3).map((m) => (m.role === "user" ? m.content : "")),
    ["第一问", "第二问"],
  );
  // 摘要消息存在且带 anchor（FR-62：路径与版本号程序提取）；
  // 角色是 user（Qwen 模板禁止非头部 system，真机 500 实证后修正）
  const summary = r.messages.find((m) => m.role === "user" && m.content.includes("历史工作摘要"));
  assert.ok(summary);
  assert.ok(summary.role === "user" && summary.content.includes("两轮天气查询已完成"));
  assert.ok(summary.role === "user" && summary.content.includes("D:/LLM/models/qwen.gguf"), "路径 anchor 兜底");
  assert.ok(summary.role === "user" && summary.content.includes("4.1.2"), "版本号 anchor 兜底");
  // kept 尾部完整（最后一轮原文在）
  assert.ok(r.messages.some((m) => m.role === "user" && m.content === "最后一问"));
});

test("压缩·兜底：summarize 抛异常退回纯裁剪（FR-61/AC12-3）", async () => {
  const longTool = "y".repeat(500);
  // 3 个大工作旧轮 + 最后小轮：被压区间 > 摘要上限，划算预检通过 → 真的调用 summarize
  const messages = [
    ...turn("问一", longTool, "答一"),
    ...turn("问二", longTool, "答二"),
    ...turn("问三", longTool, "答三"),
    ...turn("最后", "ok", "答"),
  ];
  const r = await compactMessages(messages, {
    budget: 150,
    summarize: async () => {
      throw new Error("引擎不可用");
    },
  });
  assert.equal(r.summarizedTurns, 0, "摘要失败不计轮");
  // 压缩函数不丢弃：历史保持原样（丢弃由上层 trim 兜底并以裁剪事件可见）
  assert.ok(r.messages.some((m) => m.role === "user" && m.content === "问一"), "压缩失败不动历史");
});

test("压缩·划算预检：被压工作小于摘要上限时不开 LLM 调用，直接裁剪兜底（真机 327→362 教训）", async () => {
  const longTool = "y".repeat(500);
  const messages = [...turn("问一", longTool, "答一"), ...turn("问二", longTool, "答二"), ...turn("最后", "ok", "答")];
  let llmCalls = 0;
  const r = await compactMessages(messages, {
    budget: 150,
    summarize: async () => (llmCalls++, "摘要"),
  });
  // 预检：钉住 user 原文 + 摘要占位(340) 不会小于原文 → 摘要不划算，省一次 LLM 调用；
  // 且不动作（丢弃交给上层 trim，不能冒充压缩）
  assert.equal(llmCalls, 0, "预检拦下，不调 LLM");
  assert.equal(r.summarizedTurns, 0);
  assert.ok(r.messages.some((m) => m.role === "user" && m.content === "问一"), "不划算时不动作，历史原样");
});
