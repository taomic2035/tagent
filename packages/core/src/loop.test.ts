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
          [
            toolDelta(1, "id-b", '{"v":"2"}', "beta"),  // index 1 先到（乱序）
            toolDelta(0, "id-a", '{"v":"', "alpha"),     // index 0 的参数分两片
            { type: "tool-call-delta", index: 0, argsDelta: '1"}' },
            done("tool_calls"),
          ],
          [done("stop")],
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

test("场景·maxIterations 触顶：error 事件兜底，无 final", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "循环吧" }];
  const events = await collect(
    runAgent(
      makeDeps(
        scriptedClient([
          [toolDelta(0, "id-1", '{"text":"a"}'), done("tool_calls")],
          [toolDelta(0, "id-2", '{"text":"b"}'), done("tool_calls")],
        ]),
        makeRegistry(),
        { ...config, systemPrompt: "", maxIterations: 2 }, // 剧本正好 2 轮，触顶退出
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
          [{ type: "done", finishReason: "stop", usage: { promptTokens: 20, completionTokens: 7 } }],
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
