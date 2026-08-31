#!/usr/bin/env node
// ============================================================
// token 级溯源工具（制度见 docs/TRACEABILITY.md）
// 实现已收编到 apps/cli/src/trace.ts（wire 记录器与命令行共用同一实现）；
// 本文件是其命令行薄包装。用法不变：node scripts/trace-sse.mjs <response.sse>
// ============================================================
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const input = process.argv[2];
if (!input) {
  console.error("用法: node scripts/trace-sse.mjs <response.sse>");
  process.exit(1);
}
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
let traceSse;
try {
  ({ traceSse } = await import(pathToFileURL(join(repoRoot, "apps/cli/dist/trace.js")).href));
} catch {
  console.error("✖ 先构建：pnpm build（trace 实现在 apps/cli/dist/trace.js）");
  process.exit(1);
}
const base = (input.split(/[\/]/).pop() ?? "response").replace(/\.sse$/, "");
const buf = readFileSync(input);
const { jsonl, md } = traceSse(buf);
const outMd = join(dirname(input), `${base}.trace.md`);
const outJsonl = join(dirname(input), `${base}.trace.jsonl`);
const { writeFileSync } = await import("node:fs");
writeFileSync(outMd, md);
writeFileSync(outJsonl, jsonl);
console.log(`trace 完成: ${jsonl.trim().split("\n").length} 个溯源条目 → ${outMd}`);
