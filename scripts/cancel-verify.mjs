#!/usr/bin/env node
// ============================================================
// 硬取消真机验证（Step 14，AC15-3）
//
// 平台限制（如实）：Windows 下 Node 无法从外部进程注入 CTRL_C_EVENT
// （libuv 限制；交互终端手动 Ctrl-C 可用），故不经 readline SIGINT 层，
// 直接验证取消通道全链路：真引擎 + 真 SSE 流 + AbortController。
//
// 步骤：
//   1. 真引擎跑长任务（多城天气分析），3.5s 后 abort
//   2. 断言：interrupted 事件、耗时远小于完整生成、messages 停在完整状态
//   3. 同一会话（同 messages）续问新任务 → 正常 final（会话可续）
// 产出：captures/step14-cancel/{events.jsonl, result.json}
// ============================================================
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runAgent, OpenAIClient, ToolRegistry } from "../packages/core/dist/index.js";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
const { z } = require2("../packages/core/node_modules/zod/index.js");

const OUT = "captures/step14-cancel";
mkdirSync(OUT, { recursive: true });
const MP = execFileSync("sh", ["-c", "grep -m1 '^MODEL_PATH=' captures/.env.local | cut -d= -f2-"], { encoding: "utf-8" }).trim();

// 天气工具（与内建同款语义的精简版）
const WEATHER = { 北京: { tempC: 28, cond: "晴" }, 上海: { tempC: 31, cond: "多云" }, 广州: { tempC: 33, cond: "雷阵雨" }, 深圳: { tempC: 32, cond: "阵雨" }, 杭州: { tempC: 30, cond: "晴转多云" } };
const registry = new ToolRegistry();
registry.register({
  name: "get_weather",
  description: "查询城市天气",
  schema: z.object({ city: z.string() }),
  execute: async (args) => WEATHER[args.city] ?? { error: `无 ${args.city} 数据` },
});

const client = new OpenAIClient("http://127.0.0.1:8081/v1", MP);
const messages = [
  { role: "system", content: "你是 tagent 助手，可用工具查天气，用中文回答。" },
];
const events = [];

async function runOnce(userMsg, signal, msBudget) {
  messages.push({ role: "user", content: userMsg });
  const t0 = Date.now();
  let finalContent = null;
  let interrupted = false;
  for await (const ev of runAgent(
    { client, registry, config: { baseUrl: "http://127.0.0.1:8081/v1", model: MP, maxIterations: 6, temperature: 0.7, systemPrompt: "" } },
    messages,
    { signal },
  )) {
    events.push({ phase: msBudget ? "cancel-run" : "resume-run", t: Date.now() - t0, type: ev.type, ...(ev.partialText !== undefined ? { partialLen: ev.partialText.length } : {}) });
    if (ev.type === "interrupted") interrupted = true;
    if (ev.type === "final") finalContent = ev.message;
  }
  return { ms: Date.now() - t0, interrupted, finalContent };
}

// ---- 1. 取消运行 ----
const controller = new AbortController();
setTimeout(() => controller.abort(), 3500);
const r1 = await runOnce("详细对比北京、上海、广州、深圳、杭州五个城市的天气，逐一深入分析并给出综合建议", controller.signal, true);
console.log(`[1] 取消运行：${r1.ms}ms，interrupted=${r1.interrupted}`);

// ---- 2. 续问（同会话） ----
const r2 = await runOnce("刚才的分析不用继续了。现在只用一句话总结北京的天气", undefined, false);
console.log(`[2] 续问运行：${r2.ms}ms，final=${r2.finalContent?.role === "assistant" ? String(r2.finalContent.content).slice(0, 60) : "无"}`);

// ---- 3. 断言与存证 ----
const msgsAfter = messages.map((m) => m.role);
const result = {
  cancelRun: r1,
  resumeRun: { ms: r2.ms, hasFinal: r2.finalContent !== null },
  messagesRoles: msgsAfter,
  checks: {
    interruptedFired: r1.interrupted,
    cancelWasFast: r1.ms < 20000,
    resumeSucceeded: r2.finalContent !== null,
    noOrphanTool: (() => {
      // 校验 tool 配对完整性
      const idsWithCall = new Set(messages.flatMap((m) => (m.role === "assistant" && m.tool_calls ? m.tool_calls.map((t) => t.id) : [])));
      return messages.every((m) => m.role !== "tool" || idsWithCall.has(m.tool_call_id));
    })(),
  },
};
writeFileSync(`${OUT}/events.jsonl`, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
console.log("\n== 检查 ==\n" + JSON.stringify(result.checks, null, 2));
const ok = Object.values(result.checks).every(Boolean);
console.log(ok ? "✔ AC15-3 全链路验证通过" : "✖ 存在未通过项");
process.exit(ok ? 0 : 1);
