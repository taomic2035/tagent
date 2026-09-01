import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { runAgent, type AgentEvent, type AgentDeps } from "./loop.js";
import { ToolRegistry } from "./tools.js";
import type { LLMClient } from "./client.js";
import type { AgentConfig, ChatMessage, StreamEvent, Tool } from "./types.js";

// ============================================================
// 测试基建：剧本化 mock client（NFR-5：不依赖真实引擎测循环逻辑）
// ============================================================

/** 每次 stream() 调用按序弹出剧本的下一"轮"事件；剧本耗尽即抛错（防止测试静默通过） */
function scriptedClient(script: StreamEvent[][]): LLMClient & { calls: number } {
  let call = 0;
  return {
    get calls() {
      return call;
    },
    async *stream() {
      const round = script[call];
      call++;
      if (!round) throw new Error(`剧本耗尽：第 ${call} 次请求无对应剧本`);
      for (const ev of round) yield ev;
    },
  };
}

/** 注册一个 echo 工具（记录调用顺序，供断言） */
function makeRegistry(order: string[] = []): ToolRegistry {
  const reg = new ToolRegistry();
  const tool: Tool<z.ZodObject<{ text: z.ZodString }>> = {
    name: "echo",
    description: "原样返回 text",
    schema: z.object({ text: z.string() }),
    execute: async (args) => {
      order.push("echo");
      return { echoed: args.text };
    },
  };
  reg.register(tool);
  return reg;
}

const config: AgentConfig = {
  baseUrl: "http://mock",
  model: "mock",
  maxIterations: 4,
  temperature: 0.7,
  systemPrompt: "你是测试助手",
};

function makeDeps(
  client: LLMClient,
  registry: ToolRegistry,
  cfg: AgentConfig = { ...config, systemPrompt: "" }, // 默认无 system prompt，聚焦循环机制本身
): AgentDeps {
  return { client, registry, config: cfg };
}

async function collect(
  gen: AsyncGenerator<AgentEvent>,
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

const toolDelta = (index: number, id: string, args: string, name = "echo"): StreamEvent => ({
  type: "tool-call-delta",
  index,
  id,
  name,
  argsDelta: args,
});
const done = (fr: "stop" | "tool_calls" | "length"): StreamEvent => ({ type: "done", finishReason: fr });

// ============================================================
// 场景测试
// ============================================================

test("场景·直接回答：无工具，一轮结束", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "你好" }];
  const events = await collect(
    runAgent(makeDeps(scriptedClient([[{ type: "text-delta", delta: "你好！" }, done("stop")]]), makeRegistry()), messages),
  );
  const kinds = events.map((e) => e.type);
  assert.deepEqual(kinds, ["round-start", "llm-request", "text-delta", "final"]);
  const final = events.at(-1) as Extract<AgentEvent, { type: "final" }>;
  assert.equal(final.rounds, 1);
  // 不变量1：messages 记录完整现场；不变量4：reasoning 不出现
  assert.deepEqual(messages, [
    { role: "user", content: "你好" },
    { role: "assistant", content: "你好！" },
  ]);
});

test("场景·单工具调用：执行、回填、第二轮作答", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "echo 一下 hello" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [toolDelta(0, "id-1", '{"text":"hello"}'), done("tool_calls")],
          [{ type: "text-delta", delta: "已回显" }, done("stop")],
        ]),
        makeRegistry(),
      ),
      messages,
    ),
  );
  // 事件链完整：两个 round-start、tool-call、tool-result、final
  assert.equal(events.filter((e) => e.type === "round-start").length, 2);
  assert.ok(events.some((e) => e.type === "tool-call" && (e.name === "echo")));
  assert.ok(events.some((e) => e.type === "tool-result"));
  // 不变量2：assistant(tool_calls) 后紧跟 id 配对的 tool 消息
  const a = messages.findIndex((m) => m.role === "assistant");
  const toolMsg = messages[a + 1];
  assert.equal(toolMsg?.role, "tool");
  assert.equal(toolMsg?.role === "tool" && toolMsg.tool_call_id, "id-1");
  assert.match(toolMsg?.role === "tool" ? toolMsg.content : "", /"echoed":"hello"/);
  // 第二轮 assistant 是最终回答
  assert.deepEqual(messages.at(-1), { role: "assistant", content: "已回显" });
});

test("场景·同轮双工具乱序分片：按 index 顺序执行并回填", async () => {
  const order: string[] = [];
  const reg = new ToolRegistry();
  const mk = (name: string): Tool<z.ZodObject<{ v: z.ZodString }>> => ({
    name,
    description: name,
    schema: z.object({ v: z.string() }),
    execute: async (args) => {
      order.push(`${name}:${args.v}`);
      return { ran: name };
    },
  });
  reg.register(mk("alpha"));
  reg.register(mk("beta"));

  const messages: ChatMessage[] = [{ role: "user", content: "跑两个" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [toolDelta(1, "id-b", '{"v":"2"}', "beta"),  // index 1 先到（乱序）
            toolDelta(0, "id-a", '{"v":"', "alpha"),     // index 0 的参数分两片
            { type: "tool-call-delta", index: 0, argsDelta: '1"}' },
            done("tool_calls")],
          [{ type: "text-delta", delta: "完成" }, done("stop")], // 终答须有内容，否则触发空响应守卫
        ]),
        reg,
      ),
      messages,
    ),
  );
  // 执行顺序按 index：alpha 在 beta 前
  assert.deepEqual(order, ["alpha:1", "beta:2"]);
  // 两条 tool 消息按序回填且 id 各自配对
  const toolMsgs = messages.filter((m) => m.role === "tool");
  assert.deepEqual(
    toolMsgs.map((m) => (m.role === "tool" ? m.tool_call_id : "")),
    ["id-a", "id-b"],
  );
  const final = events.at(-1) as Extract<AgentEvent, { type: "final" }>;
  assert.equal(final.rounds, 2);
});

test("场景·reasoning 透传但不入档", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "hi" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [{ type: "reasoning-delta", delta: "思考中" }, { type: "text-delta", delta: "答案" }, done("stop")],
        ]),
        makeRegistry(),
      ),
      messages,
    ),
  );
  assert.ok(events.some((e) => e.type === "reasoning-delta" && e.delta === "思考中"));
  const asst = messages.find((m) => m.role === "assistant");
  assert.ok(asst && !("reasoning" in asst && asst.reasoning));
});

test("场景·maxIterations 触顶（degradeOnCap:false）：error 事件兜底，无 final（Step 1 行为）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "循环吧" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [toolDelta(0, "id-1", '{"text":"a"}'), done("tool_calls")],
          [toolDelta(0, "id-2", '{"text":"b"}'), done("tool_calls")],
        ]),
        makeRegistry(),
        { ...config, systemPrompt: "", maxIterations: 2, degradeOnCap: false }, // 剧本正好 2 轮，触顶退出
      ),
      messages,
    ),
  );
  const last = events.at(-1);
  assert.equal(last?.type, "error");
  // 不变量2 在极端场景依然成立：每个 assistant(tool_calls) 都有配对回填
  const toolMsgs = messages.filter((m) => m.role === "tool");
  assert.equal(toolMsgs.length, 2);
  assert.ok(!events.some((e) => e.type === "final"));
});

test("场景·finish_reason=length：正常出口，正文保留", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "长文" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([[{ type: "text-delta", delta: "截断的回答…" }, done("length")]]),
        makeRegistry(),
      ),
      messages,
    ),
  );
  assert.equal(events.at(-1)?.type, "final");
  assert.equal(messages.at(-1)?.role === "assistant" && messages.at(-1)?.content, "截断的回答…");
});

test("场景·usage 跨轮累加", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "x" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [toolDelta(0, "id-1", '{"text":"a"}'), { type: "done", finishReason: "tool_calls", usage: { promptTokens: 10, completionTokens: 5 } }],
          [{ type: "text-delta", delta: "答" }, { type: "done", finishReason: "stop", usage: { promptTokens: 20, completionTokens: 7 } }],
        ]),
        makeRegistry(),
      ),
      messages,
    ),
  );
  const final = events.at(-1) as Extract<AgentEvent, { type: "final" }>;
  assert.deepEqual(final.usage, { promptTokens: 30, completionTokens: 12 });
});

test("场景·system prompt 只插一次（多轮会话复用 messages 不重复）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "第一轮" }];
  const deps = makeDeps(
    scriptedClient([
      [{ type: "text-delta", delta: "ok" }, done("stop")],
      [{ type: "text-delta", delta: "ok" }, done("stop")], // 第二轮会话也消耗一次请求
    ]),
    makeRegistry(),
    config, // 这里用带 systemPrompt 的完整 config
  );
  await collect(runAgent(deps, messages));
  await collect(runAgent(deps, messages)); // 同一会话第二轮
  const sysCount = messages.filter((m) => m.role === "system").length;
  assert.equal(sysCount, 1);
  assert.equal(messages[0]?.role, "system");
});

// ============================================================
// Step 2：迭代触顶降级（FR-15，DESIGN §11.3）
// ============================================================

test("降级·触顶后追加无 tools 请求，模型给出文本终答（默认开启）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "echo 一下" }];
  const seen: Array<{ tools?: unknown; msgs: ChatMessage[] }> = [];
  const recording = {
    async *stream(req: { messages: ChatMessage[]; tools?: unknown }): AsyncGenerator<StreamEvent> {
      seen.push({ tools: req.tools, msgs: [...req.messages] });
      const call = seen.length;
      if (call === 1) {
        yield toolDelta(0, "id-1", '{"text":"hi"}');
        yield done("tool_calls");
      } else {
        yield { type: "text-delta", delta: "根据已有结果回答" };
        yield done("stop");
      }
    },
  };
  const events = await collect(
    runAgent(
      { client: recording, registry: makeRegistry(), config: { ...config, systemPrompt: "", maxIterations: 1 } },
      messages,
    ),
  );
  // 降级请求：不传 tools（协议级禁止），并注入降级提示（副本拼接）
  assert.equal(seen.length, 2);
  assert.equal(seen[1]?.tools, undefined);
  const lastMsg = seen[1]?.msgs.at(-1);
  assert.equal(lastMsg?.role === "user" && lastMsg.content.includes("上限"), true);
  // 调用方 messages 未被注入污染（不变量1），末条是降级终答 assistant
  assert.ok(!messages.some((m) => m.role === "user" && m.content.includes("上限")));
  assert.equal(messages.at(-1)?.role === "assistant" && messages.at(-1)?.content, "根据已有结果回答");
  const final = events.at(-1) as Extract<AgentEvent, { type: "final" }>;
  assert.equal(final.type, "final");
  assert.equal(final.rounds, 2); // 1 轮工具 + 1 轮降级
});

test("降级·降级请求中模型仍吐 tool_calls 分片（协议矛盾）：按终答处理不回填", async () => {
  // 防御性用例：无 tools 时模板不该产生 tool_calls；若引擎异常吐出，
  // 降级轮按 finishReason!==tool_calls 或空 toolCalls 的既有出口规则收尾
  const messages: ChatMessage[] = [{ role: "user", content: "x" }];
  const weird = {
    async *stream(): AsyncGenerator<StreamEvent> {
      yield { type: "text-delta", delta: "尽力回答" };
      yield toolDelta(0, "id-x", '{"text":"a"}'); // 声称要工具
      yield done("stop"); // 但 finish_reason 是 stop
    },
  };
  const events = await collect(
    runAgent(
      { client: weird, registry: makeRegistry(), config: { ...config, systemPrompt: "", maxIterations: 1 } },
      messages,
    ),
  );
  assert.equal(events.at(-1)?.type, "final");
  assert.ok(!messages.some((m) => m.role === "tool")); // 没执行也没回填
});

// ============================================================
// Step 3：上下文预算裁剪（FR-20/21，DESIGN §12.3）
// ============================================================

test("裁剪·预算触发：context-trimmed 事件 + messages 原地替换 + 请求消息数下降", async () => {
  // 构造带超长历史的会话：system + 5 个历史回合 + 本轮 user
  const messages: ChatMessage[] = [{ role: "user", content: "第一轮".repeat(30) }];
  // 直接预置历史（模拟多轮会话后的 messages）
  messages.push({ role: "assistant", content: "第一轮回答".repeat(30) });
  for (let i = 2; i <= 5; i++) {
    messages.push({ role: "user", content: `第${i}轮的很长的问题`.repeat(20) });
    messages.push({ role: "assistant", content: `第${i}轮的很长的回答`.repeat(20) });
  }
  messages.push({ role: "user", content: "现在 echo 一下 hello" });
  const messagesRef = messages; // 引用不变断言用

  const requests: number[] = [];
  const client = {
    async *stream(req: { messages: ChatMessage[] }): AsyncGenerator<StreamEvent> {
      requests.push(req.messages.length);
      yield toolDelta(0, "id-1", '{"text":"hello"}');
      yield done("tool_calls");
    },
  };
  // 只跑 1 轮。Step 13 钉住语义：预算须装得下 user 群（120 会走溢出报错，独立用例覆盖）
  // 1150 保 user 群（约 880）+ 最近工作单元前提下裁旧轮工作
  const events = await collect(
    runAgent(
      { client, registry: makeRegistry(), config: { ...config, systemPrompt: "", maxIterations: 1, contextBudgetTokens: 1150 } },
      messages,
    ),
  );
  const trimmed = events.find((e) => e.type === "context-trimmed");
  assert.ok(trimmed, "应产生 context-trimmed 事件");
  if (trimmed?.type === "context-trimmed") {
    assert.ok(trimmed.removedMessages >= 1, "至少裁掉一轮工作");
    assert.ok(trimmed.toTokens < trimmed.fromTokens);
  }
  assert.equal(messages, messagesRef, "messages 引用不变（原地替换）");
  assert.ok(messages[0]?.role === "user", "裁剪后首条应是 user（无 system 配置时）");
  assert.equal(messages.at(-1)?.role, "assistant", "runAgent 结束后末条是终答 assistant");
  assert.ok(requests[0] !== undefined && requests[0]! < 11, "请求消息数应显著小于裁剪前");
  // user 绝不丢（Step 13 钉住语义）：含当前轮共 6 条 user 全保留
  assert.equal(messages.filter((m) => m.role === "user").length, 6);
  assert.ok(messages.some((m) => m.role === "user" && m.content.includes("echo")));
});


test("裁剪·溢出拒续（Step 13）：预算装不下 user 总量 → error 事件，绝不静默丢指令", async () => {
  const messages: ChatMessage[] = [
    { role: "user", content: "很长的指令".repeat(40) },
    { role: "assistant", content: "回答" },
    { role: "user", content: "又一条很长的指令".repeat(40) },
  ];
  let calls = 0;
  const client = {
    async *stream(): AsyncGenerator<StreamEvent> {
      calls++;
      yield { type: "text-delta", delta: "不应到达" };
      yield done("stop");
    },
  };
  const events = await collect(
    runAgent(
      { client, registry: makeRegistry(), config: { ...config, systemPrompt: "", maxIterations: 2, contextBudgetTokens: 100 } },
      messages,
    ),
  );
  const err = events.find((e): e is Extract<AgentEvent, { type: "error" }> => e.type === "error");
  assert.ok(err, "应产生 error 事件");
  assert.match(err?.message ?? "", /user 消息绝不丢弃/);
  assert.equal(calls, 0, "拒续：一次 LLM 请求都不发");
  assert.equal(messages.filter((m) => m.role === "user").length, 2, "user 一条没少");
});

test("裁剪·无预算零事件（回归：Step 1/2 行为不变）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "你好" }];
  const events = await collect(
    runAgent(makeDeps(scriptedClient([[{ type: "text-delta", delta: "好" }, done("stop")]]), makeRegistry()), messages),
  );
  assert.ok(!events.some((e) => e.type === "context-trimmed"));
});

test("思考开关（Step 4）：config.thinking 经 loop 下发为 chat_template_kwargs，缺省不携带", async () => {
  const seen: unknown[] = [];
  const client = {
    async *stream(req: { chatTemplateKwargs?: unknown }): AsyncGenerator<StreamEvent> {
      seen.push(req.chatTemplateKwargs);
      yield { type: "text-delta", delta: "ok" };
      yield done("stop");
    },
  };
  await collect(runAgent({ client, registry: makeRegistry(), config: { ...config, systemPrompt: "", thinking: false } }, [{ role: "user", content: "q" }]));
  await collect(runAgent({ client, registry: makeRegistry(), config: { ...config, systemPrompt: "" } }, [{ role: "user", content: "q" }]));
  assert.deepEqual(seen, [{ enable_thinking: false }, undefined]);
});

// ============================================================
// 循环守卫（Step 9，FR-52~55）
// ============================================================

const guardEvents = (events: AgentEvent[]) => events.filter((e): e is Extract<AgentEvent, { type: "guard" }> => e.type === "guard");

test("守卫·空响应 nudge 恢复：两次发呆后正常作答，nudge 入档且事件可见（FR-52）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "任务" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [done("stop")], // 第 1 轮：空内容无调用
          [done("stop")], // 第 2 轮：又是发呆
          [{ type: "text-delta", delta: "恢复了" }, done("stop")],
        ]),
        makeRegistry(),
      ),
      messages,
    ),
  );
  const guards = guardEvents(events);
  assert.equal(guards.length, 2);
  assert.ok(guards.every((g) => g.guard === "empty-response"));
  // 两条 nudge 都进了 messages（真实发生的上下文注入必须入档）
  const nudges = messages.filter((m) => m.role === "user" && m.content.startsWith("（系统注入"));
  assert.equal(nudges.length, 2);
  const final = events.at(-1) as Extract<AgentEvent, { type: "final" }>;
  assert.equal(final.rounds, 3);
  assert.equal(final.message.role === "assistant" && final.message.content, "恢复了");
});

test("守卫·连续 3 次空响应：放弃 nudge，final 诚实收场（FR-52）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "任务" }];
  const events = await collect(
    runAgent(
      makeDeps(scriptedClient([[done("stop")], [done("stop")], [done("stop")]]), makeRegistry()),
      messages,
    ),
  );
  const guards = guardEvents(events);
  assert.equal(guards.length, 2); // 第 3 次不再 nudge（上限守卫自身也要兜底）
  const final = events.at(-1) as Extract<AgentEvent, { type: "final" }>;
  assert.equal(final.rounds, 3);
  assert.equal(final.message.role === "assistant" && final.message.content, null); // 空终答如实交付
});

test("守卫·重复检测：第 3 批执行后附警告注入（FR-53）", async () => {
  const order: string[] = [];
  const reg = makeRegistry(order);
  const batch = (id: string) => [toolDelta(0, id, '{"text":"same"}'), done("tool_calls")];
  const messages: ChatMessage[] = [{ role: "user", content: "任务" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          batch("id-1"),
          batch("id-2"),
          batch("id-3"), // streak=3 → 警告
          [{ type: "text-delta", delta: "改策略了" }, done("stop")],
        ]),
        reg,
      ),
      messages,
    ),
  );
  assert.equal(order.length, 3, "前三批都执行（结果给全，警告只是点破）");
  const warns = guardEvents(events).filter((g) => g.guard === "repetition");
  assert.equal(warns.length, 1);
  const warned = messages.find((m) => m.role === "user" && m.content.includes("完全相同的工具调用"));
  assert.ok(warned, "警告以 user 消息注入 messages");
  assert.ok(events.at(-1)?.type === "final");
});

test("守卫·重复卡死：第 5 批不执行、回填配对结果、强制降级终答（FR-53）", async () => {
  const order: string[] = [];
  const reg = makeRegistry(order);
  const batch = (id: string) => [toolDelta(0, id, '{"text":"same"}'), done("tool_calls")];
  const messages: ChatMessage[] = [{ role: "user", content: "任务" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          batch("id-1"),
          batch("id-2"),
          batch("id-3"),
          batch("id-4"),
          batch("id-5"), // streak=5 → 本批不执行
          [{ type: "text-delta", delta: "降级终答" }, done("stop")], // 降级轮（无 tools）
        ]),
        reg,
        { ...config, systemPrompt: "", maxIterations: 8 }, // 装得下 5 批 + 降级
      ),
      messages,
    ),
  );
  assert.equal(order.length, 4, "第 5 批未执行");
  // 不变量2：第 5 批的 tool_calls 也有配对 tool 消息（未执行说明）
  const skipped = messages.filter((m) => m.role === "tool" && m.content.includes("本批未执行"));
  assert.equal(skipped.length, 1);
  // 降级终答产出
  const final = events.at(-1) as Extract<AgentEvent, { type: "final" }>;
  assert.equal(final.message.role === "assistant" && final.message.content, "降级终答");
  assert.ok(guardEvents(events).some((g) => g.guard === "repetition" && g.detail.includes("卡死")));
});

test("守卫·length 截断：残缺调用不执行，回填错误，下轮重发成功（FR-54）", async () => {
  const order: string[] = [];
  const reg = makeRegistry(order);
  const messages: ChatMessage[] = [{ role: "user", content: "echo 一下 hello" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          // 第 1 轮：args JSON 被截断 + length
          [toolDelta(0, "id-1", '{"text":"hel'), done("length")],
          // 第 2 轮：模型重发完整调用
          [toolDelta(0, "id-2", '{"text":"hello"}'), done("tool_calls")],
          [{ type: "text-delta", delta: "已回显" }, done("stop")],
        ]),
        reg,
      ),
      messages,
    ),
  );
  assert.deepEqual(order, ["echo"], "截断的残缺调用从未执行，只有重发的那次执行");
  const truncGuards = guardEvents(events).filter((g) => g.guard === "length-truncated");
  assert.equal(truncGuards.length, 1);
  // 回填的错误 tool 结果与 assistant 的 tool_call 配对
  const errTool = messages.find((m) => m.role === "tool" && m.content.includes("未执行"));
  assert.equal(errTool?.role === "tool" && errTool.tool_call_id, "id-1");
  // 传输层改写：历史里截断 args 必须已换成合法 {}（llama.cpp 500 规避），
  // 原始字节片段保存在 tool 结果文本里（溯源不丢）
  const truncatedCall = messages.find(
    (m) => m.role === "assistant" && m.tool_calls?.some((c) => c.id === "id-1"),
  );
  const rawCall = truncatedCall?.role === "assistant" && truncatedCall.tool_calls?.[0];
  assert.ok(rawCall);
  assert.equal(rawCall.function.arguments, "{}");
  assert.ok(errTool?.role === "tool" && errTool.content.includes('{"text":"hel'), "原始截断片段保留在 tool 结果中");
  const final = events.at(-1) as Extract<AgentEvent, { type: "final" }>;
  assert.equal(final.message.role === "assistant" && final.message.content, "已回显");
});

test("守卫·全关回归：guards 显式关闭 = Step 8 行为（FR-55）", async () => {
  // 关闭后：空响应立即按 final 收场，不再 nudge
  const messages: ChatMessage[] = [{ role: "user", content: "任务" }];
  const cfg: AgentConfig = { ...config, systemPrompt: "", guards: { emptyResponse: false, repetition: false, lengthTruncation: false } };
  const client = scriptedClient([[done("stop")]]);
  const events = await collect(runAgent(makeDeps(client, makeRegistry(), cfg), messages));
  assert.equal(guardEvents(events).length, 0);
  assert.equal(client.calls, 1, "守卫关闭时一次请求即收场");
  assert.ok(events.at(-1)?.type === "final");
});

// ============================================================
// Steering 打断通道（Step 10，FR-56~58）
// ============================================================

test("steering·注入生效：round 2 请求在 tool 结果后含注入指令 + 事件可见（FR-56/57）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "查北京天气" }];
  // take() 只在 round≥2 被调用：第一次吐一条指令，之后吐空
  let calls = 0;
  const steering = {
    take: () => {
      calls++;
      return calls === 1 ? ["改成查上海天气"] : [];
    },
  };
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [toolDelta(0, "id-1", '{"text":"北京"}'), done("tool_calls")],
          [{ type: "text-delta", delta: "好的，改查上海" }, done("stop")],
        ]),
        makeRegistry(),
      ),
      messages,
      undefined,
      steering,
    ),
  );
  // steering 事件可见（可观测，transcript 可回放）
  const steers = events.filter((e): e is Extract<AgentEvent, { type: "steering" }> => e.type === "steering");
  assert.equal(steers.length, 1);
  assert.ok(steers[0]);
  assert.equal(steers[0].message, "改成查上海天气");
  // round 2 的 llm-request 快照：tool 结果之后、assistant 之前是注入的 user 消息
  const requests = events.filter((e): e is Extract<AgentEvent, { type: "llm-request" }> => e.type === "llm-request");
  assert.equal(requests.length, 2);
  const r2req = requests[1];
  const r1req = requests[0];
  assert.ok(r2req && r1req);
  const r2 = r2req.messages;
  const last = r2[r2.length - 1];
  assert.ok(last && last.role === "user" && last.content === "改成查上海天气");
  // messages 事实来源：注入指令入档（真实发生的上下文注入）
  assert.ok(messages.some((m) => m.role === "user" && m.content === "改成查上海天气"));
  // 前缀只增不改：round 1 的请求消息仍是 round 2 请求消息的前缀
  assert.deepEqual(r2.slice(0, r1req.messages.length), r1req.messages);
});

test("steering·首轮不注入：take() 在 round 1 不被调用（FR-56）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "直接回答" }];
  let taken = 0;
  const events = await collect(
    runAgent(
      makeDeps(scriptedClient([[{ type: "text-delta", delta: "答" }, done("stop")]]), makeRegistry()),
      messages,
      undefined,
      { take: () => (taken++, []) },
    ),
  );
  assert.equal(taken, 0, "单轮即终答，take 从未被调用");
  assert.ok(events.at(-1)?.type === "final");
});

test("steering·多轮注入与守卫共存：nudge/steering 都是 user 追加，结构合法（FR-56 × FR-52）", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "查天气" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [done("stop")], // round 1：空响应 → nudge（user）
          [toolDelta(0, "id-1", '{"text":"北京"}'), done("tool_calls")], // round 2：执行工具
          [{ type: "text-delta", delta: "完成" }, done("stop")], // round 3：终答（前有 steering 注入）
        ]),
        makeRegistry(),
      ),
      messages,
      undefined,
      (() => {
        let taken = false; // 真实队列语义：取走即清
        return { take: () => (taken ? [] : ((taken = true), ["顺便也看看上海"])) };
      })(), // round 2 前注入（一次性）
    ),
  );
  assert.ok(events.some((e) => e.type === "steering" && e.message === "顺便也看看上海"));
  assert.ok(events.some((e) => e.type === "guard" && e.guard === "empty-response"));
  // 结构合法：nudge（round1 末）与 steering（round2 首）是两条相邻 user 消息——
  // 协议允许连续 user（模板拼接渲染），保留两条使注入来源各自可溯（transcript 事件区分）
  const roles = messages.map((m) => m.role);
  assert.deepEqual(roles, ["user", "assistant", "user", "user", "assistant", "tool", "assistant"]);
});

// ============================================================
// 摘要压缩集成（Step 11，FR-63）：loop 内事件与零 LLM 路径
// ============================================================

test("压缩集成·loop 触发：大 tool 结果超预算 → context-compacted 事件（降级路径零 LLM 调用）", async () => {
  const bigText = "z".repeat(600); // echo 工具会原样回显 → tool 结果 ~600 字
  const messages: ChatMessage[] = [{ role: "user", content: "任务" }];
  const summarizeCalls: string[] = [];
  const deps: AgentDeps = {
    client: scriptedClient([
      // 两轮工具：第一轮的旧大结果可降级，第二轮的最近结果受保护
      [toolDelta(0, "id-1", JSON.stringify({ text: bigText })), done("tool_calls")],
      [toolDelta(0, "id-2", JSON.stringify({ text: bigText })), done("tool_calls")],
      [{ type: "text-delta", delta: "完成" }, done("stop")],
    ]),
    registry: makeRegistry(),
    config: { ...config, systemPrompt: "", compaction: true, contextBudgetTokens: 300, maxIterations: 4 },
    summarize: async (raw) => (summarizeCalls.push(raw), "不应被调用的摘要"),
  };
  const events = await collect(runAgent(deps, messages));
  const compacted = events.find((e): e is Extract<AgentEvent, { type: "context-compacted" }> => e.type === "context-compacted");
  assert.ok(compacted, "超预算触发压缩事件");
  assert.ok((compacted?.degradedToolResults ?? 0) >= 1, "tool 结果被降级");
  assert.equal(compacted?.summarizedTurns, 0, "降级已达标，零 LLM 摘要调用");
  assert.equal(summarizeCalls.length, 0);
  assert.ok(messages.some((m) => m.role === "tool" && m.content.includes("[工具结果已降级")), "messages 里可见降级标注");
  // 压缩在第二轮工具完成后、第三轮请求前触发（单条工具结果时它是"最近一条"受保护，
  // 两条才可降旧保新）——第三轮请求带的是降级后的上下文
  const requests = events.filter((e): e is Extract<AgentEvent, { type: "llm-request" }> => e.type === "llm-request");
  const r3 = requests[2];
  assert.ok(r3, "三轮请求齐全");
  assert.ok(r3.messages.some((m) => m.role === "tool" && m.content.includes("[工具结果已降级")), "第三轮请求可见降级标注");
  assert.ok(events.at(-1)?.type === "final");
});

// ============================================================
// 并行执行（Step 12，FR-64/67）
// ============================================================

test("并行·同批多工具并发执行：吞吐=max 而非 sum，结果按源序回填（FR-64）", async () => {
  const order: string[] = [];
  const reg = new ToolRegistry();
  const mk = (name: string, ms: number): Tool<z.ZodObject<{ v: z.ZodString }>> => ({
    name,
    description: name,
    schema: z.object({ v: z.string() }),
    execute: async (args) => {
      order.push(`start-${name}`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`end-${name}`);
      return { r: args.v };
    },
  });
  reg.register(mk("slow", 60)); // index 0（源序在前）
  reg.register(mk("fast", 10)); // index 1（先完成）
  const messages: ChatMessage[] = [{ role: "user", content: "并行跑" }];
  const t0 = Date.now();
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [toolDelta(0, "id-slow", '{"v":"a"}', "slow"), toolDelta(1, "id-fast", '{"v":"b"}', "fast"), done("tool_calls")],
          [{ type: "text-delta", delta: "完成" }, done("stop")],
        ]),
        reg,
      ),
      messages,
    ),
  );
  const elapsed = Date.now() - t0;
  // 并行：两个 start 先于任一 end（fast 先完成但事件/回填仍按源序）
  assert.deepEqual(order.slice(0, 2), ["start-slow", "start-fast"]);
  assert.ok(elapsed < 110, `总耗时 ${elapsed}ms 应接近 max(60,10) 而非 sum(70)+开销`);
  // 事件源序：tool-call 顺序 slow,fast；tool-result 也按源序（slow 在前，尽管它后完成）
  const calls = events.filter((e): e is Extract<AgentEvent, { type: "tool-call" }> => e.type === "tool-call");
  assert.deepEqual(calls.map((c) => c.name), ["slow", "fast"]);
  const results = events.filter((e): e is Extract<AgentEvent, { type: "tool-result" }> => e.type === "tool-result");
  assert.deepEqual(results.map((r) => r.name), ["slow", "fast"]);
  // messages 配对按源序（不变量2）
  const toolMsgs = messages.filter((m) => m.role === "tool");
  assert.deepEqual(
    toolMsgs.map((m) => (m.role === "tool" ? m.tool_call_id : "")),
    ["id-slow", "id-fast"],
  );
});

test("并行·同帧两个 remember 走互斥键串行（FR-66，registry 队列经 loop 全链路）", async () => {
  const reg = new ToolRegistry();
  const timeline: string[] = [];
  const remember: Tool<z.ZodObject<{ c: z.ZodString }>> = {
    name: "remember",
    description: "写入",
    schema: z.object({ c: z.string() }),
    serialize: "memory-store",
    execute: async (args) => {
      timeline.push(`start-${args.c}`);
      await new Promise((r) => setTimeout(r, 20));
      timeline.push(`end-${args.c}`);
      return { saved: true };
    },
  };
  reg.register(remember);
  const messages: ChatMessage[] = [{ role: "user", content: "记住两件事" }];
  await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [toolDelta(0, "id-1", '{"c":"甲"}', "remember"), toolDelta(1, "id-2", '{"c":"乙"}', "remember"), done("tool_calls")],
          [{ type: "text-delta", delta: "记好了" }, done("stop")],
        ]),
        reg,
      ),
      messages,
    ),
  );
  // 并行批次内部，同键的两个写被队列串行化（时间线无交错）
  assert.deepEqual(timeline, ["start-甲", "end-甲", "start-乙", "end-乙"]);
});
