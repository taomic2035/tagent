#!/usr/bin/env node
// ============================================================
// 任务完成机器裁决（Step 15，FR-79/AC16-2）
//
// 用法: node scripts/verify-task.mjs <transcript.jsonl> '<谓词 spec JSON>'
//   spec 形态（predicateFromSpec DSL）：
//     {"all":[{"toolCalled":"get_weather","args":{"city":"北京"}},
//              {"toolResultOk":"get_weather"},
//              {"finalIncludes":"晴"}]}
//   字符串 spec = finalIncludes
// 输出: 裁决 ✔/✖ + 证据（事件引用），非零退出 = 未完成（可接 CI/验收脚本）
// ============================================================
import { readFileSync } from "node:fs";
import { predicateFromSpec } from "../packages/core/dist/index.js";

const [path, specRaw] = process.argv.slice(2);
if (!path || !specRaw) {
  console.error("用法: node scripts/verify-task.mjs <transcript.jsonl> '<spec JSON>'");
  process.exit(2);
}

const events = readFileSync(path, "utf-8")
  .split("\n")
  .filter(Boolean)
  .map((l, i) => {
    try {
      return JSON.parse(l).ev;
    } catch {
      throw new Error(`transcript 第 ${i + 1} 行不是合法 JSON: ${l.slice(0, 80)}`);
    }
  });

const spec = JSON.parse(specRaw);
const predicate = predicateFromSpec(spec);
const result = predicate.check(events, []);
console.log(`谓词: ${predicate.describe()}`);
console.log(`${result.ok ? "✔ 任务完成（机器裁决）" : "✖ 未完成"}\n证据: ${result.evidence}`);
process.exit(result.ok ? 0 : 1);
