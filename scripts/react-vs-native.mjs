#!/usr/bin/env node
// ============================================================
// 驱动方式三方对比实验（Step 5，FR-30，REQUIREMENTS §9.2）
//
//   native    协议原生 tool_calls（runAgent 的驱动层）
//   react-text 经典 Thought/Action/Observation 文本协议
//   react-json 单 JSON 步骤 + 受限解码（弱模型鲁棒形态）
//
// 任务集 S1~S4（链式：前一步结果是后一步参数），temp=0.7 思考关
// （Step 4 结论），判据程序化。工具执行直接复用 apps/cli 内建工具
// （与 agent 行为完全一致）。证据归档 captures/step5-react/。
// 用法: node scripts/react-vs-native.mjs
// ============================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ToolRegistry,
  parseAction,
  parseActionJson,
  reactJsonResponseFormat,
  REACT_SYSTEM_PROMPT,
  REACT_JSON_SYSTEM_PROMPT,
} from "../packages/core/dist/index.js";
import { weatherTool } from "../apps/cli/dist/builtin-tools/weather.js";
import { calculateTool } from "../apps/cli/dist/builtin-tools/calculate.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repoRoot, "captures", "step5-react");
mkdirSync(outDir, { recursive: true });
const baseUrl = process.env.TAGENT_BASE_URL ?? "http://127.0.0.1:8081/v1";
const mp = readFileSync(join(repoRoot, "captures", ".env.local"), "utf8").split("=", 2)[1]?.trim();

const registry = new ToolRegistry();
registry.register(weatherTool);
registry.register(calculateTool);

const TASKS = [
  { id: "S1", q: "对比一下北京和上海的天气", judge: (t) => t.includes("28") && t.includes("31") },
  { id: "S2", q: "先查北京今天的天气，然后把温度乘以 2 告诉我", judge: (t) => t.includes("56") },
  { id: "S3", q: "北京和上海哪个更热？温差是多少？", judge: (t) => t.includes("上海") && /3/.test(t) },
  { id: "S4", q: "杭州的温度减去广州的温度再除以 2，等于多少？", judge: (t) => t.includes("-1.5") },
];
const MODES = ["native", "react-text", "react-json"];
const SAMPLES = Number(process.env.RN_SAMPLES ?? 3);
const MAX_ROUNDS = 5;

async function chat(messages, extra) {
  const body = {
    model: mp, messages, max_tokens: 600, temperature: 0.7, stream: false,
    chat_template_kwargs: { enable_thinking: false }, ...extra,
  };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { body, json: await res.json() };
}

/** 原生 tool_calls 驱动（模拟 runAgent 的消息演化） */
async function runNative(task) {
  const messages = [{ role: "system", content: "你是助手，用工具完成计算，不要编造数据。" }, { role: "user", content: task.q }];
  const tools = registry.schemas();
  let rounds = 0, tokens = 0;
  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const { json } = await chat(messages, { tools });
    rounds = r; tokens += json.usage?.completion_tokens ?? 0;
    const msg = json.choices[0].message;
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
    if (!msg.tool_calls?.length) return { answer: msg.content ?? "", rounds, tokens };
    for (const tc of msg.tool_calls) {
      const result = await registry.execute(tc.function.name, tc.function.arguments);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }
  return { answer: "", rounds, tokens, truncated: true };
}

/** ReAct 驱动（text/json 共用骨架，协议形态不同） */
async function runReact(task, format) {
  const useJson = format === "react-json";
  const messages = [
    { role: "system", content: useJson ? REACT_JSON_SYSTEM_PROMPT : REACT_SYSTEM_PROMPT },
    { role: "user", content: task.q },
  ];
  let rounds = 0, tokens = 0;
  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const extra = useJson ? { response_format: reactJsonResponseFormat(registry) } : {};
    const { json } = await chat(messages, extra);
    rounds = r; tokens += json.usage?.completion_tokens ?? 0;
    const text = json.choices[0].message.content ?? "";
    messages.push({ role: "assistant", content: text });
    const parsed = useJson ? parseActionJson(text) : parseAction(text);
    if (parsed.kind === "final") return { answer: parsed.answer, rounds, tokens };
    if (parsed.kind === "invalid") {
      messages.push({ role: "user", content: `Observation: {"ok":false,"error":"格式错误：${parsed.reason}"}` });
      continue;
    }
    const result = await registry.execute(parsed.name, parsed.argsJson);
    messages.push({ role: "user", content: `Observation: ${result}` });
  }
  return { answer: "", rounds, tokens, truncated: true };
}

const results = [];
let fileNo = 0;
for (const task of TASKS) {
  for (const mode of MODES) {
    for (let i = 1; i <= SAMPLES; i++) {
      const t0 = Date.now();
      let r;
      try {
        r = mode === "native" ? await runNative(task) : await runReact(task, mode);
      } catch (err) {
        r = { answer: "", rounds: -1, tokens: -1, truncated: true, error: String(err).slice(0, 100) };
      }
      const ok = task.judge(r.answer ?? "");
      const rec = { task: task.id, mode, sample: i, ok, rounds: r.rounds, tokens: r.tokens, ms: Date.now() - t0, answer: (r.answer ?? "").slice(0, 120) };
      results.push(rec);
      fileNo++;
      writeFileSync(join(outDir, `${String(fileNo).padStart(2, "0")}-${task.id}-${mode}-${i}.json`), JSON.stringify(rec, null, 2));
      console.log(`${mode.padEnd(11)} ${task.id} #${i} ${ok ? "✅" : "❌"} rounds=${r.rounds} tokens=${r.tokens} ${rec.ms}ms`);
    }
  }
}

writeFileSync(join(outDir, "results.jsonl"), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
const stat = (mode) => {
  const rs = results.filter((r) => r.mode === mode);
  const okN = rs.filter((r) => r.ok).length;
  const byTask = TASKS.map((t) => `${t.id}:${rs.filter((r) => r.task === t.id && r.ok).length}/${SAMPLES}`).join(" ");
  return {
    rate: rs.length ? Math.round((okN / rs.length) * 100) : 0,
    byTask,
    avgRounds: (rs.reduce((s, r) => s + r.rounds, 0) / rs.length).toFixed(1),
    avgTok: Math.round(rs.reduce((s, r) => s + r.tokens, 0) / rs.length),
    avgMs: Math.round(rs.reduce((s, r) => s + r.ms, 0) / rs.length),
  };
};
const N = stat("native"), T = stat("react-text"), J = stat("react-json");
const md = `# 驱动方式三方对比：native vs react-text vs react-json（${new Date().toISOString().slice(0, 10)}）

> 同模型同温度（0.7）思考关，链式任务 S1~S4 × ${SAMPLES} 采样；工具执行复用 apps/cli 内建工具。
> react-json = 单 JSON 步骤 + 受限解码（工具 enum 锁死）；react-text = 经典文本标记协议（零样本系统提示）。

| 维度 | native tool_calls | react-text | react-json |
|---|---|---|---|
| 成功率 | ${N.rate}% ｜ ${N.byTask} | ${T.rate}% ｜ ${T.byTask} | ${J.rate}% ｜ ${J.byTask} |
| 平均轮次 | ${N.avgRounds} | ${T.avgRounds} | ${J.avgRounds} |
| 平均 tokens | ${N.avgTok} | ${T.avgTok} | ${J.avgTok} |
| 平均耗时 | ${N.avgMs}ms | ${T.avgMs}ms | ${J.avgMs}ms |
`;
writeFileSync(join(outDir, "summary.md"), md);
console.log("\n" + md);
console.log(`证据已归档: ${outDir}`);
