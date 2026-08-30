import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ToolRegistry } from "@tagent/core";
import type { Tool } from "@tagent/core";
import { weatherTool } from "./weather.js";

/**
 * 通过真实 registry 走完整执行链（安检门 → 工具），与运行时同路径。
 * 注意双层 ok 的语义（值得记住的设计点）：
 *   外层 ok  = 执行链成败（工具名/参数/执行是否通过安检）——loop 关心
 *   内层 ok  = 业务数据成败（城市有没有数据）——模型读到后自我决策
 * weather 对"查无此城"返回 ok:false 的业务数据（而非抛异常），
 * 让模型在上下文里读到错误与可用城市列表，自行纠正（AC-5 的设计基础）。
 */
async function execute(city: string): Promise<{ outerOk: boolean; data: Record<string, unknown> }> {
  const reg = new ToolRegistry();
  reg.register(weatherTool as Tool<z.ZodType>);
  const envelope = JSON.parse(await reg.execute("get_weather", JSON.stringify({ city })));
  return { outerOk: envelope.ok, data: (envelope.data ?? {}) as Record<string, unknown> };
}

test("已知城市：外层信封成功，业务数据完整", async () => {
  const { outerOk, data } = await execute("北京");
  assert.equal(outerOk, true);
  assert.equal(data.ok, true);
  assert.equal(data.city, "北京");
  assert.equal(typeof data.tempC, "number");
  assert.equal(typeof data.aqi, "number");
  assert.equal(data.source, "mock");
});

test("未知城市（AC-5 场景）：执行链成功但业务失败，错误与可用列表回填给模型", async () => {
  const { outerOk, data } = await execute("火星");
  assert.equal(outerOk, true); // 安检通过：名字对、参数合法、执行没抛
  assert.equal(data.ok, false); // 业务层：没有这个城市的数据
  assert.match(data.error as string, /火星/);
  const cities = data.availableCities as string[];
  assert.ok(cities.includes("北京") && cities.includes("杭州"));
});

test("五个城市都有数据", async () => {
  for (const city of ["北京", "上海", "广州", "深圳", "杭州"]) {
    const { data } = await execute(city);
    assert.equal(data.ok, true, `${city} 应有数据`);
  }
});
