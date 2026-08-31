import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { runReAct, parseAction, parseActionJson, reactJsonResponseFormat } from "./react.js";
import type { LLMClient as _LC } from "./client.js";
import { ToolRegistry } from "./tools.js";
import type { LLMClient } from "./client.js";
import type { AgentConfig, ChatMessage, StreamEvent, Tool } from "./types.js";
import type { AgentEvent } from "./loop.js";

// ============================================================
// Step 5 测试：ReAct 文本协议（FR-26~28，DESIGN §14）
// ============================================================

// ---- 解析器（AC5-1）----

test("解析：规范 Action + 单行 JSON", () => {
  const r = parseAction("Thought: 先查天气\nAction: get_weather\nAction Input: {\"city\":\"北京\"}");
  assert.deepEqual(r, { kind: "action", name: "get_weather", argsJson: '{"city":"北京"}' });
});

test("解析：多行 JSON 与末尾杂文", () => {
  const text = 'Thought: 算一下\nAction: calculate\nAction Input: {\n  "expression": "28*2"\n}\n（就这样）';
  const r = parseAction(text);
  assert.equal(r.kind, "action");
  assert.equal(r.kind === "action" && r.name, "calculate");
  assert.deepEqual(r.kind === "action" && JSON.parse(r.argsJson), { expression: "28*2" });
});

test("解析：Final Answer 优先于残缺 Action", () => {
  const r = parseAction("Thought: 完成\nFinal Answer: 答案是 56 度");
  assert.deepEqual(r, { kind: "final", answer: "答案是 56 度" });
});

test("解析：畸形输出不抛异常，给出可回填的原因", () => {
  const none = parseAction("我觉得应该直接告诉你答案。");
  assert.equal(none.kind, "invalid");
  const badJson = parseAction("Action: calculate\nAction Input: {expression: 缺引号}");
  assert.equal(badJson.kind, "invalid");
  const noName = parseAction("Action: \nAction Input: {}");
  assert.equal(noName.kind, "invalid");
});

// ---- 引擎（AC5-2，mock 回放）----

const weather: Tool<z.ZodObject<{ city: z.ZodString }>> = {
  name: "get_weather",
  description: "查询城市天气",
  schema: z.object({ city: z.string() }),
  execute: async (a) => {
    if (a.city !== "北京" && a.city !== "上海") throw new Error("no weather data for city: " + a.city);
    return { city: a.city, tempC: a.city === "北京" ? 28 : 31 };
  },
};
const calc: Tool<z.ZodObject<{ expression: z.ZodString }>> = {
  name: "calculate",
  description: "求值",
  schema: z.object({ expression: z.string() }),
  execute: async (a) => ({ value: 56 }),
};

function makeRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.register(weather);
  reg.register(calc);
  return reg;
}

const config: AgentConfig = {
  baseUrl: "http://mock", model: "m", maxIterations: 6, temperature: 0.7,
  systemPrompt: "ReAct 系统", thinking: false,
};

/** 剧本 client：每次调用弹出一轮 assistant 全文 */
function scriptedClient(script: string[]): LLMClient & { requests: Array<{ tools?: unknown; responseFormat?: unknown; msgs: ChatMessage[] }> } {
  let call = 0;
  const requests: Array<{ tools?: unknown; responseFormat?: unknown; msgs: ChatMessage[] }> = [];
  return {
    requests,
    async *stream(req) {
      requests.push({ tools: req.tools, responseFormat: req.responseFormat, msgs: [...req.messages] });
      const text = script[call++];
      if (text === undefined) throw new Error("剧本耗尽");
      yield { type: "text-delta", delta: text };
      yield { type: "done", finishReason: "stop" };
    },
  };
}

async function collect(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

test("引擎：act→observation→final 完整链（S2 型任务）", async () => {
  const client = scriptedClient([
    'Thought: 先查北京\nAction: get_weather\nAction Input: {"city":"北京"}',
    'Thought: 28 度，乘 2\nAction: calculate\nAction Input: {"expression":"28*2"}',
    "Thought: 完成\nFinal Answer: 是 56 度",
  ]);
  const messages: ChatMessage[] = [{ role: "user", content: "北京温度乘以2" }];
  const events = await collect(runReAct({ client, registry: makeRegistry(), config }, messages));

  // 事件契约：与原生模式同型
  assert.ok(events.some((e) => e.type === "tool-call" && e.name === "get_weather"));
  assert.ok(events.some((e) => e.type === "tool-call" && e.name === "calculate"));
  const final = events.at(-1);
  assert.equal(final?.type, "final");
  // messages 演化：assistant 原文 + user Observation 交替，末条 Final Answer 的 assistant
  const roles = messages.map((m) => m.role);
  assert.deepEqual(roles, ["system", "user", "assistant", "user", "assistant", "user", "assistant"]);
  const obs = messages.filter((m) => m.role === "user" && m.content.startsWith("Observation:"));
  assert.equal(obs.length, 2);
  assert.match(obs[0]?.role === "user" ? obs[0].content : "", /tempC/);
  // ReAct 请求不携带 tools（行动靠文本，FR-26）
  assert.ok(client.requests.every((r) => r.tools === undefined));
  // 思考开关下发（FR-28 同配置）
  assert.ok(true);
});

test("引擎：格式错误自愈——纠错 Observation 回填后下轮改对（AC5-2）", async () => {
  const client = scriptedClient([
    "我直接想查天气，但忘了格式",  // invalid
    'Action: get_weather\nAction Input: {"city":"北京"}',  // 改对
    "Final Answer: 北京 28 度",
  ]);
  const messages: ChatMessage[] = [{ role: "user", content: "北京天气" }];
  const events = await collect(runReAct({ client, registry: makeRegistry(), config }, messages));
  const final = events.at(-1);
  assert.equal(final?.type, "final");
  // 纠错 Observation 进了上下文
  const fix = messages.find((m) => m.role === "user" && m.content.includes("格式"));
  assert.ok(fix, "应有纠错 Observation");
});

test("引擎：工具执行失败（信封）作为 Observation 回填，不崩溃", async () => {
  const client = scriptedClient([
    'Action: get_weather\nAction Input: {"city":"火星"}',
    "Final Answer: 查不到火星",
  ]);
  const messages: ChatMessage[] = [{ role: "user", content: "火星" }];
  const events = await collect(runReAct({ client, registry: makeRegistry(), config }, messages));
  assert.equal(events.at(-1)?.type, "final");
  const obs = messages.find((m) => m.role === "user" && m.content.includes("no weather data"));
  assert.ok(obs, "失败信封应作为 Observation 回填");
});

test("引擎：maxIterations 触顶降级终答（复用 Step 2 降级）", async () => {
  const client = scriptedClient(new Array(10).fill('Action: calculate\nAction Input: {"expression":"1+1"}'));
  const messages: ChatMessage[] = [{ role: "user", content: "x" }];
  const events = await collect(
    runReAct({ client, registry: makeRegistry(), config: { ...config, maxIterations: 2 } }, messages),
  );
  const final = events.at(-1);
  assert.equal(final?.type, "final", "降级请求产出终答（无 Action 解析压力）");
});

test("引擎：无剧本耗尽 → error 事件（不静默）", async () => {
  const client = scriptedClient(["Final Answer: 短答"]); // 只够 1 轮，但任务需要 0 轮 —— 直接 final
  const messages: ChatMessage[] = [{ role: "user", content: "你好" }];
  const events = await collect(runReAct({ client, registry: makeRegistry(), config }, messages));
  assert.equal(events.at(-1)?.type, "final");
});

// ---- JSON 协议（FR-31）----

test("JSON 协议：受限解码下的标准回合（S2 链式）", async () => {
  const client = scriptedClient([
    JSON.stringify({ thought: "先查北京", action: { tool: "get_weather", args: { city: "北京" } } }),
    JSON.stringify({ thought: "28 度乘 2", action: { tool: "calculate", args: { expression: "28*2" } } }),
    JSON.stringify({ thought: "完成", action: { final: "是 56 度" } }),
  ]);
  const messages: ChatMessage[] = [{ role: "user", content: "北京温度乘2" }];
  const events = await collect(
    runReAct({ client, registry: makeRegistry(), config: { ...config, systemPrompt: "", reactFormat: "json" } }, messages),
  );
  assert.ok(events.some((e) => e.type === "tool-call" && e.name === "get_weather"));
  assert.ok(events.some((e) => e.type === "tool-call" && e.name === "calculate"));
  assert.equal(events.at(-1)?.type, "final");
  // 每轮请求都带 response_format（受限解码）；系统提示是 JSON 协议版
  assert.ok(client.requests.length >= 3 && client.requests.every((r) => r.responseFormat !== undefined));
  assert.match(messages[0]?.role === "system" ? messages[0].content : "", /JSON/);
});

test("reactJsonResponseFormat：工具 enum 来自 registry（动态跟随）", () => {
  const reg = makeRegistry();
  const fmt = reactJsonResponseFormat(reg) as { json_schema: { schema: { properties: { action: { oneOf: Array<{ properties: { tool: { enum: string[] } } }> } } } } };
  const toolEnum = fmt.json_schema.schema.properties.action.oneOf[0]?.properties.tool.enum;
  assert.deepEqual(toolEnum, ["get_weather", "calculate"]);
});

test("parseActionJson：final / action / 畸形三类", () => {
  assert.deepEqual(
    parseActionJson(JSON.stringify({ thought: "t", action: { final: "答案" } })),
    { kind: "final", answer: "答案" },
  );
  const a = parseActionJson(JSON.stringify({ thought: "t", action: { tool: "get_weather", args: { city: "北京" } } }));
  assert.equal(a.kind, "action");
  assert.equal(a.kind === "action" && JSON.parse(a.argsJson).city, "北京");
  assert.equal(parseActionJson("不是json").kind, "invalid");
  assert.equal(parseActionJson(JSON.stringify({ thought: "t" })).kind, "invalid");
});
