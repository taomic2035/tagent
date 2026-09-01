#!/usr/bin/env node
// ============================================================
// 六场景验收·机器裁决版（Step 15，FR-79/AC16-2）
//
// 对 captures/win-ac-*/ 的 transcript 重放事件流跑完成谓词——
// "人看 stdout"升级为机器断言（LLM 自证不算数，SURVEY §3.3 立场）。
// 场景 6（/dump）是 CLI 命令验证而非 agent 任务，无谓词（如实注记）。
//
// 用法: node scripts/verify-acceptance.mjs   （需先跑 acceptance-win.sh 产出存证）
// ============================================================
import { readFileSync } from "node:fs";
import { predicateFromSpec } from "../packages/core/dist/index.js";

const SPECS = [
  ["win-ac-1-beijing-weather", { all: [{ toolCalled: "get_weather", args: { city: "北京" } }, { toolResultOk: "get_weather" }, { finalIncludes: "晴" }] }],
  ["win-ac-2-calculate", { all: [{ toolCalled: "calculate" }, { toolResultOk: "calculate" }] }],
  ["win-ac-3-self-intro", { finalIncludes: "tagent" }],
  ["win-ac-4-two-cities", { all: [{ toolCalled: "get_weather", args: { city: "北京" } }, { toolCalled: "get_weather", args: { city: "上海" } }] }],
  ["win-ac-5-mars-error", { finalIncludes: "无法" }], // 诚实说明查不了，不编造（AC-5 的验收本意）
  ["win-ac-6-dump", null], // CLI 命令验证（/dump 打印 messages），非 agent 任务，无谓词
];

let failed = 0;
for (const [dir, spec] of SPECS) {
  if (spec === null) {
    console.log(`○ ${dir}: 非任务场景（CLI 命令验证），无谓词`);
    continue;
  }
  const events = readFileSync(`captures/${dir}/transcript.jsonl`, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l).ev);
  const p = predicateFromSpec(spec);
  const r = p.check(events, []);
  if (r.ok) console.log(`✔ ${dir}\n   ${r.evidence}`);
  else {
    failed++;
    console.log(`✖ ${dir}\n   ${p.describe()}\n   ${r.evidence}`);
  }
}
console.log(failed === 0 ? "\n✔ 全部任务场景机器裁决通过" : `\n✖ ${failed} 个场景未通过`);
process.exit(failed === 0 ? 0 : 1);
