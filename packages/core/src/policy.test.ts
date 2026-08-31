import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ToolRegistry, TransientToolError, type ToolResultFail } from "./tools.js";
import type { Tool } from "./types.js";

// ============================================================
// Step 2 执行策略层测试（FR-12~14/FR-17，DESIGN §11.2）
// 无 policy 的行为回归由 tools.test.ts（Step 1 用例）覆盖
// ============================================================

type CityTool = Tool<z.ZodObject<{ city: z.ZodString }>>;

/** 剧本工具工厂：按剧本依次失败/成功，记录执行次数 */
function scripted(
  script: Array<"ok" | "transient" | "boom">,
  policy?: Tool["policy"],
): { tool: CityTool; getCalls(): number } {
  let calls = 0;
  return {
    getCalls: () => calls,
    tool: {
      name: "scripted",
      description: "剧本工具",
      schema: z.object({ city: z.string() }),
      ...(policy ? { policy } : {}),
      execute: async (args) => {
        calls++;
        const act = script[Math.min(calls - 1, script.length - 1)] ?? "ok";
        if (act === "transient") throw new TransientToolError(`下游抖动(第${calls}次)`);
        if (act === "boom") throw new Error(`确定性故障(第${calls}次)`);
        return { city: args.city };
      },
    },
  };
}

async function run(tool: Tool): Promise<ToolResultFail | { ok: true; data: unknown }> {
  const reg = new ToolRegistry();
  reg.register(tool);
  return JSON.parse(await reg.execute(tool.name, '{"city":"北京"}'));
}

test("超时：挂死工具到点返回超时信封，registry 不挂死（FR-12）", async () => {
  const hang: CityTool = {
    name: "hang",
    description: "永不 resolve",
    schema: z.object({ city: z.string() }),
    policy: { timeoutMs: 40 },
    execute: () => new Promise(() => {}), // 永不 settle
  };
  const out = (await run(hang)) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.match(out.error, /超时.*40/);
});

test("超时属可重试失败：首次慢到必超时，重试成功 → ok（FR-13）", async () => {
  let calls = 0;
  const slowThenFast: CityTool = {
    name: "slow",
    description: "首次超时，重试飞快",
    schema: z.object({ city: z.string() }),
    policy: { timeoutMs: 30, retries: 1 },
    execute: async () => {
      calls++;
      if (calls === 1) await new Promise((r) => setTimeout(r, 200));
      return { fast: true };
    },
  };
  const out = await run(slowThenFast);
  assert.deepEqual(out, { ok: true, data: { fast: true } });
  assert.equal(calls, 2);
});

test("瞬时失败重试成功：flaky1 + retries=1 → 执行 2 次拿正常数据（FR-12/13）", async () => {
  const made = scripted(["transient", "ok"], { retries: 1, retryDelayMs: 1 });
  const out = await run(made.tool);
  assert.deepEqual(out, { ok: true, data: { city: "北京" } });
  assert.equal(made.getCalls(), 2);
});

test("瞬时失败耗尽：retries=2 → 信封含 retriesUsed=2 与降级提示（FR-14）", async () => {
  const made = scripted(["transient"], { retries: 2, retryDelayMs: 1 });
  const out = (await run(made.tool)) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.equal(out.retriesUsed, 2);
  assert.match(out.error, /已重试 2 次/);
  assert.equal(made.getCalls(), 3); // 首调 + 2 次重试
});

test("普通异常不可重试：retries=2 也只执行 1 次（FR-13）", async () => {
  const made = scripted(["boom"], { retries: 2, retryDelayMs: 1 });
  const out = (await run(made.tool)) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.match(out.error, /确定性故障/);
  assert.equal(made.getCalls(), 1);
});

test("schema 失败不进执行段：retries 再大也不执行（FR-13）", async () => {
  let calls = 0;
  const strict: Tool<z.ZodObject<{ n: z.ZodNumber }>> = {
    name: "strict",
    description: "参数必须是数字",
    schema: z.object({ n: z.number() }),
    policy: { retries: 3 },
    execute: async () => {
      calls++;
      return null;
    },
  };
  const reg = new ToolRegistry();
  reg.register(strict);
  const out = JSON.parse(await reg.execute("strict", '{"n":"不是数字"}')) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.equal(calls, 0);
});

test("线性退避：retryDelayMs=20 首次重试前等待 ≥20ms（DESIGN §11.2）", async () => {
  const t0 = Date.now();
  const made = scripted(["transient", "ok"], { retries: 1, retryDelayMs: 20 });
  await run(made.tool);
  assert.ok(Date.now() - t0 >= 20, "应有退避等待");
});

test("超时后工具能收到 abort 信号（FR-17：signal 传递与清理语义）", async () => {
  let observedAbort = false;
  const cooperative: CityTool = {
    name: "cooperative",
    description: "监听 signal，被 abort 时清理退出",
    schema: z.object({ city: z.string() }),
    policy: { timeoutMs: 20 },
    execute: async (_args, ctx) => {
      // 不主动 resolve，等 abort 通知——模拟"尊重取消信号的工具"
      await new Promise<void>((resolve) => {
        ctx?.signal?.addEventListener("abort", () => {
          observedAbort = true;
          resolve();
        }, { once: true });
      });
      throw new TransientToolError("清理后退出");
    },
  };
  const out = (await run(cooperative)) as ToolResultFail;
  assert.equal(out.ok, false);
  assert.match(out.error, /超时.*20/); // registry 侧按超时报（工具的迟到 rejection 被放弃）
  await new Promise((r) => setTimeout(r, 20)); // 给 abort 监听器执行时间
  assert.equal(observedAbort, true, "工具应观测到 abort");
});
