#!/usr/bin/env node
// ============================================================
// 思考模式 A/B 实验（Step 4，FR-25，REQUIREMENTS §8.2/8.3）
//
// 同一服务器（默认 auto），按请求切换思考开/关——组间唯一变量是
// chat_template_kwargs.enable_thinking。11 题 × 3 采样 × 2 组。
// 判据全部程序化；每样本存 request/response 原件 + 汇总 results.jsonl/summary.md。
// 用法: node scripts/thinking-ab.mjs   （需先 .\start_llm.ps1 -Detach，默认配置即可）
// 预计耗时：ON 组较慢（思考 token 多，CPU ~12 tok/s），约 30-60 分钟
// 方法论注意：max_tokens 计数含 thinking（PROTOCOL §5.3）——ON 组预算必须给足
// （首跑 640 时 T1 思考烧满被截断误判失败，实测教训，已提到 1200）
// ============================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repoRoot, "captures", "step4-thinking-ab");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.TAGENT_BASE_URL ?? "http://127.0.0.1:8081/v1";
const mp = readFileSync(join(repoRoot, "captures", ".env.local"), "utf8").split("=", 2)[1]?.trim();

// ---- 任务集（REQUIREMENTS §8.2）：judge 全程序化 ----
// 数值题：answer 含期望字符串即成功；常识题：关键词；工具题：tool_calls 判定
const WEATHER_TOOL = { type: "function", function: { name: "get_weather", description: "查询指定城市的当前天气（支持：北京/上海/广州/深圳/杭州）", parameters: { type: "object", properties: { city: { type: "string", minLength: 1 } }, required: ["city"], additionalProperties: false } } };
const CALC_TOOL = { type: "function", function: { name: "calculate", description: "计算四则运算表达式的值。支持 + - * / 与括号。", parameters: { type: "object", properties: { expression: { type: "string", minLength: 1 } }, required: ["expression"], additionalProperties: false } } };

const TASKS = [
  { id: "T1", cat: "算术", q: "3.7 乘以 12 再减 8.2 等于多少？", expect: { type: "contains", value: "36.2" } },
  { id: "T2", cat: "算术", q: "小明有 17 个苹果，给了小红 5 个，又买了 8 个，现在有几个？", expect: { type: "contains", value: "20" } },
  { id: "T3", cat: "算术", q: "一件衣服原价 240 元，先打八折再减 30 元，最终多少钱？", expect: { type: "contains", value: "162" } },
  { id: "T4", cat: "算术", q: "从 1 一直加到 100 等于多少？", expect: { type: "contains", value: "5050" } },
  { id: "T5", cat: "算术", q: "9.5 公里等于多少米？", expect: { type: "contains", value: "9500" } },
  { id: "T6", cat: "推理", q: "A 比 B 高，B 比 C 高，D 比 A 高。这四个人里谁最矮？", expect: { type: "contains", value: "C" } },
  { id: "T7", cat: "推理", q: "如果昨天是星期三，那么今天是星期几？明天呢？", expect: { type: "contains", value: "四" } },
  { id: "T8", cat: "推理", q: "所有的猫都怕水，汤姆是一只猫。汤姆怕水吗？", expect: { type: "contains", value: "怕" } },
  { id: "T9", cat: "工具", q: "北京今天天气怎么样？", tools: [WEATHER_TOOL], expect: { type: "tool", name: "get_weather", argContains: ["北京"] } },
  { id: "T10", cat: "工具", q: "帮我计算 128 乘以 4 再减 100", tools: [CALC_TOOL], expect: { type: "tool", name: "calculate", argContains: ["128"] } },
  { id: "T11", cat: "对照", q: "你好，请用一句话介绍你自己", expect: { type: "no_tool" } },
];

const SAMPLES = Number(process.env.AB_SAMPLES ?? 3);

async function runOnce(task, thinkingOn, sampleIdx) {
  const req = {
    model: mp,
    messages: [{ role: "user", content: task.q }],
    ...(task.tools ? { tools: task.tools } : {}),
    max_tokens: thinkingOn ? 1200 : 160,
    temperature: 0.7,
    stream: false,
    ...(thinkingOn ? {} : { chat_template_kwargs: { enable_thinking: false } }),
  };
  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = await res.json();
  const ms = Date.now() - t0;
  const msg = body.choices?.[0]?.message ?? {};
  const usage = body.usage ?? {};
  const reasoningLen = (msg.reasoning_content ?? "").length;

  // ---- 程序化判分 ----
  let ok = false;
  let note = "";
  const e = task.expect;
  if (e.type === "contains") {
    const text = msg.content ?? "";
    ok = text.includes(e.value);
    note = `content=${(text ?? "").slice(0, 60)}`;
  } else if (e.type === "tool") {
    const tc = msg.tool_calls?.[0];
    ok = !!tc && tc.function?.name === e.name && e.argContains.every((s) => (tc.function?.arguments ?? "").includes(s));
    note = tc ? `${tc.function?.name} ${tc.function?.arguments}` : "(无 tool_calls)";
  } else if (e.type === "no_tool") {
    ok = !msg.tool_calls && (msg.content ?? "").length > 0;
    note = msg.tool_calls ? `误调用 ${msg.tool_calls[0]?.function?.name}` : `直答 ${(msg.content ?? "").slice(0, 30)}`;
  }
  const rec = {
    task: task.id, cat: task.cat, thinking: thinkingOn ? "on" : "off", sample: sampleIdx,
    ok, ms, reasoningLen, completionTokens: usage.completion_tokens ?? 0,
    note, q: task.q,
  };
  // 存证：每样本 request+response 原件
  const tag = `${task.id}-${thinkingOn ? "on" : "off"}-${sampleIdx}`;
  const reqSan = { ...req, model: "<MODEL_PATH>" };
  writeFileSync(join(outDir, `${tag}.request.json`), JSON.stringify(reqSan, null, 2));
  const bodySan = JSON.parse(JSON.stringify(body).split(mp).join("<MODEL_PATH>"));
  writeFileSync(join(outDir, `${tag}.response.json`), JSON.stringify(bodySan, null, 2));
  writeFileSync(join(outDir, `${tag}.trace.txt`), `ok=${ok} ms=${ms} reasoning=${reasoningLen} tokens=${rec.completionTokens} | ${note}\n`);
  return rec;
}

// ---- 跑双组 ----
const results = [];
for (const group of [true, false]) {
  for (const task of TASKS) {
    for (let i = 1; i <= SAMPLES; i++) {
      try {
        const r = await runOnce(task, group, i);
        results.push(r);
        console.log(`${r.thinking.padEnd(3)} ${r.task} ${r.cat} #${i} ${r.ok ? "✅" : "❌"} ${r.ms}ms ${r.completionTokens}tok reasoning=${r.reasoningLen}`);
      } catch (err) {
        results.push({ task: task.id, cat: task.cat, thinking: group ? "on" : "off", sample: i, ok: false, ms: -1, reasoningLen: -1, completionTokens: -1, note: `ERROR ${String(err).slice(0, 80)}`, q: task.q });
        console.log(`ERROR ${task.id} ${group ? "on" : "off"} #${i}: ${String(err).slice(0, 80)}`);
      }
    }
  }
}

// ---- 汇总 ----
writeFileSync(join(outDir, "results.jsonl"), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
const stat = (group) => {
  const rs = results.filter((r) => r.thinking === group);
  const okN = rs.filter((r) => r.ok).length;
  const byCat = {};
  for (const cat of ["算术", "推理", "工具", "对照"]) {
    const c = rs.filter((r) => r.cat === cat);
    byCat[cat] = `${c.filter((r) => r.ok).length}/${c.length}`;
  }
  return {
    n: rs.length, ok: okN, rate: rs.length ? Math.round((okN / rs.length) * 100) : 0,
    byCat,
    avgMs: Math.round(rs.reduce((s, r) => s + r.ms, 0) / rs.length),
    avgTok: Math.round(rs.reduce((s, r) => s + r.completionTokens, 0) / rs.length),
    withReasoning: rs.filter((r) => r.reasoningLen > 0).length,
  };
};
const on = stat("on"), off = stat("off");
const fails = results.filter((r) => !r.ok);
const md = `# 思考模式 A/B 实验（${new Date().toISOString().slice(0, 10)}）

> 同服务器同模型（默认 auto），组间唯一变量 = chat_template_kwargs.enable_thinking。
> temp=0.7，每题每组 ${SAMPLES} 采样；判据程序化（数值 contains / 工具 tool_calls / 对照零调用）。

| 维度 | 思考 ON | 思考 OFF |
|---|---|---|
| 成功率 | ${on.ok}/${on.n} = **${on.rate}%** | ${off.ok}/${off.n} = **${off.rate}%** |
| 算术（5题） | ${on.byCat["算术"]} | ${off.byCat["算术"]} |
| 推理（3题） | ${on.byCat["推理"]} | ${off.byCat["推理"]} |
| 工具（2题） | ${on.byCat["工具"]} | ${off.byCat["工具"]} |
| 对照（1题，应零调用） | ${on.byCat["对照"]} | ${off.byCat["对照"]} |
| 平均耗时 | ${on.avgMs}ms | ${off.avgMs}ms |
| 平均 completion tokens | ${on.avgTok} | ${off.avgTok} |
| 有 reasoning 的样本 | ${on.withReasoning}/${on.n} | ${off.withReasoning}/${off.n} |

## 失败样本

${fails.length === 0 ? "（无）" : fails.map((f) => `- ${f.thinking} ${f.task}(${f.cat}) #${f.sample}: ${f.note}`).join("\n")}
`;
writeFileSync(join(outDir, "summary.md"), md);
console.log("\n" + md);
console.log(`证据已归档: ${outDir}`);
