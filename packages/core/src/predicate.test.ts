import test from "node:test";
import assert from "node:assert/strict";
import { toolCalled, toolResultOk, finalAnswers, all, predicateFromSpec } from "./predicate.js";
import type { AgentEvent } from "./loop.js";

// ============================================================
// 完成谓词测试（Step 15，FR-78/AC16-1）：正反例全覆盖
// ============================================================

/** 一段"查北京天气成功"的典型事件流 */
const okEvents: AgentEvent[] = [
  { type: "round-start", round: 1 },
  { type: "llm-request", messages: [] },
  { type: "tool-call", id: "id-1", name: "get_weather", args: { city: "北京" } },
  { type: "tool-result", id: "id-1", name: "get_weather", result: '{"ok":true,"data":{"tempC":28}}' },
  { type: "final", message: { role: "assistant", content: "北京今天晴，28 度" }, rounds: 2, usage: { promptTokens: 10, completionTokens: 5 } },
];

test("toolCalled·正例：名称与参数深包含", () => {
  const r = toolCalled("get_weather", { city: "北京" }).check(okEvents, []);
  assert.equal(r.ok, true);
  assert.ok(r.evidence.includes("id-1"));
});

test("toolCalled·反例：未调用 / 参数不符各自指出缺口", () => {
  const r1 = toolCalled("calculate").check(okEvents, []);
  assert.equal(r1.ok, false);
  assert.ok(r1.evidence.includes("从未被调用"));
  const r2 = toolCalled("get_weather", { city: "上海" }).check(okEvents, []);
  assert.equal(r2.ok, false);
  assert.ok(r2.evidence.includes("参数均不含"));
});

test("toolResultOk·调用过≠成功过：失败信封要裁决失败", () => {
  const failEvents: AgentEvent[] = [
    { type: "tool-call", id: "id-1", name: "get_weather", args: { city: "火星" } },
    { type: "tool-result", id: "id-1", name: "get_weather", result: '{"ok":false,"error":"无此城市"}' },
  ];
  assert.equal(toolResultOk("get_weather").check(failEvents, []).ok, false);
  assert.equal(toolResultOk("get_weather").check(okEvents, []).ok, true);
});

test("finalAnswers·无终答/不含关键词/正常终答三态", () => {
  const noFinal: AgentEvent[] = [{ type: "error", message: "x", recoverable: false }];
  const r1 = finalAnswers().check(noFinal, []);
  assert.equal(r1.ok, false);
  assert.ok(r1.evidence.includes("无 final 事件"));
  assert.equal(finalAnswers("上海").check(okEvents, []).ok, false);
  const r3 = finalAnswers("28 度").check(okEvents, []);
  assert.equal(r3.ok, true);
});

test("all·一条不满足即未完成，证据聚合", () => {
  const p = all(toolCalled("get_weather", { city: "北京" }), toolResultOk("get_weather"), finalAnswers("上海"));
  const r = p.check(okEvents, []);
  assert.equal(r.ok, false);
  assert.ok(r.evidence.includes("finalAnswers"));
  assert.ok(p.check([...okEvents], []).ok === false);
  const pOk = all(toolCalled("get_weather", { city: "北京" }), finalAnswers("晴"));
  assert.equal(pOk.check(okEvents, []).ok, true);
});

test("predicateFromSpec·JSON DSL 解析与非法 spec", () => {
  const p = predicateFromSpec({
    all: [{ toolCalled: "get_weather", args: { city: "北京" } }, { toolResultOk: "get_weather" }, { finalIncludes: "晴" }],
  });
  assert.equal(p.check(okEvents, []).ok, true);
  assert.equal(predicateFromSpec("晴").check(okEvents, []).ok, true, "字符串 spec = finalIncludes");
  assert.throws(() => predicateFromSpec({ 未知: 1 }), /spec 非法/);
});
