#!/usr/bin/env node
// ============================================================
// prompt 重放工具（制度：docs/TRACEABILITY.md §3「prompt 可再复现」）
//
// 输入: 任一存证单元的 request.json（captures/ 或 logs/sessions/）
// 行为: 原样（或带覆盖参数）重新发送给引擎，落盘为新的存证单元
// 输出: <out>/request.json + response.sse + response.trace.md/jsonl + replay.json（重放参数）
//
// 用法:
//   node scripts/replay.mjs captures/04-stream-tools/request.json
//   node scripts/replay.mjs <req.json> --temp 0 --out /tmp/rep1      # 确定性重放
//   node scripts/replay.mjs <req.json> --model $TAGENT_MODEL         # 覆盖已脱敏的模型路径
// 默认: base-url 取 TAGENT_BASE_URL 或 http://127.0.0.1:8081/v1；
//       model 为占位符 /Users/<user>/model 时自动读 captures/.env.local
// ============================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---- 参数解析 ----
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i] ?? "";
  if (a.startsWith("--")) flags[a.slice(2)] = argv[++i] ?? "";
  else positional.push(a);
}
const inputPath = positional[0];
if (!inputPath) {
  console.error("用法: node scripts/replay.mjs <request.json> [--temp N] [--model P] [--base-url U] [--out DIR]");
  process.exit(1);
}

const baseUrl = flags["base-url"] ?? process.env.TAGENT_BASE_URL ?? "http://127.0.0.1:8081/v1";
const outDir = flags.out ?? join(dirname(resolve(inputPath)), "replay");
mkdirSync(outDir, { recursive: true });

// ---- 组装请求体：原件 + 覆盖项 ----
const body = JSON.parse(readFileSync(inputPath, "utf8"));
let model = flags.model ?? body.model ?? "";
if (model.includes("/Users/<user>") || model === "") {
  // 已脱敏的存证：从 captures/.env.local 恢复本机模型路径
  try {
    model = readFileSync(join(repoRoot, "captures", ".env.local"), "utf8").split("=", 2)[1]?.trim() ?? model;
  } catch { /* 保持占位符，由引擎报错提示 */ }
}
if (flags.temp !== undefined) body.temperature = Number(flags.temp);
body.model = model;
body.stream = true;

// ---- 发送 ----
const res = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const sse = await res.text();

// ---- 落盘存证单元 ----
writeFileSync(join(outDir, "request.json"), JSON.stringify(body));
writeFileSync(join(outDir, "response.sse"), sse);
writeFileSync(
  join(outDir, "replay.json"),
  JSON.stringify({ source: resolve(inputPath), baseUrl, overrides: { temp: flags.temp ?? null }, ts: new Date().toISOString() }, null, 2),
);
const headerLines = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
writeFileSync(join(outDir, "response-headers.txt"), headerLines + "\n");

// ---- 生成 token 级溯源表（同 captures 规格） ----
execFileSync("node", [join(repoRoot, "scripts", "trace-sse.mjs"), join(outDir, "response.sse")], { stdio: "inherit" });

// ---- 摘要 ----
const frames = sse.split("\n").filter((l) => l.startsWith("data: ")).length;
const reasoning = (sse.match(/"reasoning"/g) ?? []).length;
const content = (sse.match(/"content"/g) ?? []).length;
const toolCalls = (sse.match(/"tool_calls"/g) ?? []).length;
console.log(`重放完成 → ${outDir}`);
console.log(`  帧数 ${frames} · reasoning帧 ${reasoning} · content帧 ${content} · tool_call帧 ${toolCalls}`);
