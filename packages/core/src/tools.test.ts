import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  ToolRegistry,
  type ToolResultEnvelope,
  type ToolResultFail,
  type ToolResultOk,
} from "./tools.js";
import type { Tool } from "./types.js";

/** 测试用工具：城市查询（schema 要求 city 非空字符串） */
const weatherTool: Tool<z.ZodObject<{ city: z.ZodString }>> = {
  name: "get_weather",
  description: "查询城市天气",
  schema: z.object({ city: z.string().min(1) }),
  execute: async (args) => ({ city: args.city, tempC: 25 }),
};

/** 测试用工具：会抛异常的业务代码 */
const boomTool: Tool<z.ZodObject<{}>> = {
  name: "boom",
  description: "总是抛异常",
  schema: z.object({}),
  execute: async () => {
    throw new Error("数据库连接失败");
  },
};

function makeRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.register(weatherTool);
  reg.register(boomTool);
  return reg;
}

// ---- schemas()：zod → JSON Schema ----

test("schemas：zod schema 被翻译成标准 JSON Schema", () => {
  const defs = makeRegistry().schemas();
  assert.equal(defs.length, 2);
  const w = defs.find((d) => d.function.name === "get_weather");
  assert.equal(w?.type, "function");
  assert.equal(w?.function.description, "查询城市天气");
  const params = w?.function.parameters as Record<string, unknown>;
  assert.equal(params.type, "object");
  assert.deepEqual(params.required, ["city"]);
});

test("register：重名工具是程序员错误，启动期直接 throw", () => {
  const reg = makeRegistry();
  assert.throws(() => reg.register(weatherTool), /duplicate tool name/);
});

// ---- execute()：四段流程，每段的失败路径（信封恒为 JSON 字符串） ----

test("execute 第1段：未知工具 → 错误信封（附可用工具列表）", async () => {
  const out = JSON.parse(
    await makeRegistry().execute("no_such_tool", "{}"),
  ) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.match(out.error, /unknown tool: no_such_tool/);
  assert.match(out.error, /get_weather/); // 错误信息帮模型选对工具
});

test("execute 第2段：arguments 不是合法 JSON → 错误信封", async () => {
  const out = JSON.parse(
    await makeRegistry().execute("get_weather", '{"city": "北京"'), // 少了右括号
  ) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.match(out.error, /不是合法 JSON/);
});

test("execute 第3段：参数缺字段 → 错误信封带 issues", async () => {
  const out = JSON.parse(
    await makeRegistry().execute("get_weather", "{}"),
  ) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.equal(out.issues?.length, 1);
  assert.equal(out.issues?.[0]?.path, "city");
});

test("execute 第3段：参数类型错误 → 错误信封", async () => {
  const out = JSON.parse(
    await makeRegistry().execute("get_weather", '{"city": 123}'),
  ) as ToolResultFail;
  assert.equal(out.ok, false);
});

test("execute 第4段：业务代码抛异常 → 兜底为错误信封", async () => {
  const out = JSON.parse(
    await makeRegistry().execute("boom", "{}"),
  ) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.equal(out.error, "数据库连接失败");
});

test("execute 成功路径：data 原样返回", async () => {
  const out = JSON.parse(
    await makeRegistry().execute("get_weather", '{"city": "北京"}'),
  ) as ToolResultOk;
  assert.equal(out.ok, true);
  assert.deepEqual(out.data, { city: "北京", tempC: 25 });
});

test("契约：无论成败，execute 返回的恒是可解析 JSON 字符串（永不 throw）", async () => {
  const reg = makeRegistry();
  for (const [name, args] of [
    ["no_such_tool", "{}"],
    ["get_weather", "not-json"],
    ["get_weather", "{}"],
    ["boom", "{}"],
    ["get_weather", '{"city":"上海"}'],
  ] as const) {
    const out = JSON.parse(await reg.execute(name, args)) as ToolResultEnvelope;
    assert.ok(out.ok === true || out.ok === false, "信封形态合法");
  }
});
