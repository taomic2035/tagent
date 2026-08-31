import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { TransientToolError, ToolRegistry, type Tool } from "@tagent/core";
import { parseFaults, withFaults, describeFaults } from "./faults.js";

// ============================================================
// 故障注入包装器测试（FR-16，DESIGN §11.4）
// ============================================================

const baseTool: Tool<z.ZodObject<{ city: z.ZodString }>> = {
  name: "get_weather",
  description: "查询城市天气",
  schema: z.object({ city: z.string() }),
  execute: async (args) => ({ city: args.city, tempC: 28 }),
};

const ARGS = '{"city":"北京"}';

test("parseFaults：三种剧本与非法配置", () => {
  const f = parseFaults("a:hang,b:flaky:2,c:down");
  assert.deepEqual(f.get("a"), { kind: "hang" });
  assert.deepEqual(f.get("b"), { kind: "flaky", n: 2 });
  assert.deepEqual(f.get("c"), { kind: "down" });
  assert.equal(parseFaults(undefined).size, 0);
  assert.throws(() => parseFaults("a:oops"), /未知剧本/);
  assert.throws(() => parseFaults("a:flaky:x"), /次数非法/);
  assert.throws(() => parseFaults("只有名字"), /条目非法/);
});

test("withFaults：无剧本时原样返回（零开销路径）", () => {
  assert.equal(withFaults(baseTool, parseFaults("别的工具:down")), baseTool);
});

test("剧本 down：恒抛 TransientToolError（可重试类）", async () => {
  const reg = new ToolRegistry();
  reg.register(withFaults(baseTool, parseFaults("get_weather:down")));
  const out = JSON.parse(await reg.execute("get_weather", ARGS)) as { ok: boolean; error?: string };
  assert.equal(out.ok, false);
  assert.match(out.error ?? "", /faults:down/);
});

test("剧本 flaky:1：第 1 次注入瞬时故障，第 2 次放行真实工具", async () => {
  const reg = new ToolRegistry();
  reg.register(withFaults(baseTool, parseFaults("get_weather:flaky:1")));
  const r1 = JSON.parse(await reg.execute("get_weather", ARGS)) as { ok: boolean; error?: string };
  assert.equal(r1.ok, false, "第 1 次应失败");
  assert.match(r1.error ?? "", /TransientToolError|瞬时|faults/, "应为可重试类错误");
  const r2 = JSON.parse(await reg.execute("get_weather", ARGS)) as { ok: boolean; data?: { tempC: number } };
  assert.deepEqual(r2, { ok: true, data: { city: "北京", tempC: 28 } });
});

test("剧本 hang：不 resolve；超时策略触发后安静退出（配合 signal）", async () => {
  const reg = new ToolRegistry();
  const hangTool: Tool = {
    ...withFaults(baseTool, parseFaults("get_weather:hang")),
    policy: { timeoutMs: 30 },
  };
  reg.register(hangTool);
  const out = JSON.parse(await reg.execute("get_weather", ARGS)) as { ok: boolean; error?: string };
  assert.equal(out.ok, false);
  assert.match(out.error ?? "", /超时/); // registry 侧按超时收口，agent 不挂死
});

test("TransientToolError 直抛语义：未被 registry 包裹时就是普通异常", async () => {
  const t: Tool = {
    ...baseTool,
    name: "raw",
    execute: async () => {
      throw new TransientToolError("裸抛");
    },
  };
  await assert.rejects(() => t.execute({}, {}), TransientToolError);
});

test("describeFaults：人读清单", () => {
  assert.equal(describeFaults(parseFaults("get_weather:flaky:2,calculate:down")), "get_weather=flaky:2, calculate=down");
});
