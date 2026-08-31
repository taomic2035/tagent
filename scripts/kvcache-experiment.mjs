#!/usr/bin/env node
// ============================================================
// KV cache 复用三段对照实验（Step 3 AC3-4，DESIGN §12.4）
//
// 量化「裁剪历史 vs prompt cache 前缀命中」的矛盾：
//   A 连续追加：同会话逐轮追加（前缀不变）→ cache_n 应随轮次增长
//   B 前缀破坏：改动早期消息后重发（模拟"每轮裁一点"）→ cache_n 应骤降
//   C 双水位恢复：裁剪到新前缀后继续追加 → cache_n 从新基线重新增长
//
// 用非流式请求直读 llama.cpp 响应内建 timings.cache_n（前缀命中 token 数）。
// 证据自动归档到 captures/step3-kvcache/（含脱敏）。
// 用法: node scripts/kvcache-experiment.mjs   （需先 .\start_llm.ps1 -Detach）
// ============================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repoRoot, "captures", "step3-kvcache");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.TAGENT_BASE_URL ?? "http://127.0.0.1:8081/v1";
const mp = readFileSync(join(repoRoot, "captures", ".env.local"), "utf8")
  .split("=", 2)[1]?.trim();

// run nonce：每次运行唯一，保证 A1 冷启动（重跑不被上一轮的 slot 暖缓存污染）
const SYS = `你是缓存实验助手，请只回答一个词。（run ${Date.now()}）`;
const turns = [
  "第一个问题：天空是什么颜色？",
  "第二个问题：雪是什么颜色？",
  "第三个问题：煤是什么颜色？",
  "第四个问题：牛奶是什么颜色？",
];

let fileNo = 0;
async function ask(messages, label) {
  const req = { model: mp, messages, max_tokens: 16, temperature: 0, stream: false };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = await res.json();
  const t = body.timings ?? {};
  const usage = body.usage ?? {};
  fileNo++;
  const tag = String(fileNo).padStart(2, "0");
  writeFileSync(join(outDir, `${tag}-${label}.request.json`), JSON.stringify(req, null, 2));
  writeFileSync(join(outDir, `${tag}-${label}.response.json`), JSON.stringify(body, null, 2));
  const content = body.choices?.[0]?.message?.content ?? "";
  return { label, cacheN: t.cache_n ?? 0, promptN: t.prompt_n ?? usage.prompt_tokens ?? 0, content, promptTokens: usage.prompt_tokens ?? 0 };
}

// ---- Phase A：连续追加（前缀稳定） ----
const history = [{ role: "system", content: SYS }];
const rowsA = [];
for (let i = 0; i < turns.length; i++) {
  history.push({ role: "user", content: turns[i] });
  const r = await ask(history, `A${i + 1}-append`);
  rowsA.push(r);
  history.push({ role: "assistant", content: r.content || "（截断）" });
}

// ---- Phase B：前缀破坏（改早期消息，模拟小步裁剪/改写） ----
const broken = history.map((m, i) => (i === 1 ? { role: "user", content: "（被改写的第一个问题）：草是什么颜色？" } : m));
const rowB = await ask(broken, "B1-prefix-broken");

// ---- Phase C：双水位裁剪后恢复（丢最旧回合，新前缀上继续追加） ----
// 模拟 trimMessages 的产物：保 system + 最近回合，从新前缀继续对话
const trimmed = [history[0], ...history.slice(-4)]; // system + 最后 2 个回合（4 条）
trimmed.push({ role: "user", content: "第五个问题：海是什么颜色？" });
const rowC1 = await ask(trimmed, "C1-after-trim");
const trimmed2 = [...trimmed, { role: "assistant", content: rowC1.content || "（截断）" }, { role: "user", content: "第六个问题：墨是什么颜色？" }];
const rowC2 = await ask(trimmed2, "C2-stable-again");

// ---- 汇总表 ----
const all = [...rowsA, rowB, rowC1, rowC2];
const md = `# KV cache 复用三段对照实验（${new Date().toISOString().slice(0, 10)}）

> 引擎：llama.cpp（timings.cache_n = 命中的前缀 token 数）。
> 设计与判读见 DESIGN §12.4；max_tokens=16（本实验只关心 prompt 侧缓存行为）。

| 段 | 请求 | cache_n（命中） | prompt_n（需处理） | 命中率 = cache/(cache+prompt) |
|---|---|---|---|---|
${all
  .map((r) => `| ${r.label.startsWith("A") ? "A 连续追加" : r.label.startsWith("B") ? "B 前缀破坏" : "C 裁剪恢复"} | ${r.label} | ${r.cacheN} | ${r.promptN} | ${Math.round((r.cacheN / (r.cacheN + r.promptN)) * 100)}% |`)
  .join("\n")}

> 字段语义（实测校准）：prompt_n 是本次**实际处理**的 token 数（cache miss 部分），
> cache_n 是命中的前缀 token 数；本次总 prompt ≈ cache_n + prompt_n。

## 判读

- **A 段**：cache_n 随轮次增长（上一轮完整 prompt 成为下一轮前缀）——多轮 agent 对话的前缀复用经济学
- **B 段**：早期消息被改（等价于"每轮裁一点/改一点"的最坏习惯）→ cache_n 骤降，整段 prompt 重新处理
- **C 段**：裁剪建立新前缀（C1 部分命中/未命中），随后 C2 在新前缀上恢复高命中——双水位"一次裁到位、之后稳定"的意义
`;
writeFileSync(join(outDir, "experiment.md"), md);
// 脱敏（模型路径 → 占位符）
import { readdirSync } from "node:fs";
for (const f of readdirSync(outDir).map((n) => join(outDir, n))) {
  if (f.endsWith(".md") || f.endsWith(".json")) {
    let s = readFileSync(f, "utf8");
    const s2 = s.split(mp).join("<MODEL_PATH>");
    if (s2 !== s) writeFileSync(f, s2);
  }
}
console.log(md);
console.log(`证据已归档: ${outDir}`);
