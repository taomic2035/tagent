import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWireRecorder } from "./wire.js";
import { OpenAIClient } from "@tagent/core";

// ============================================================
// 原始报文记录器测试（复盘修复：session 存证必须是引擎原始字节）
// ============================================================

/** 一段"脏"的真实风格 SSE：含 keepalive、reasoning_content（llama.cpp 字段）、
 *  id/created 元数据、分片 tool_call、[DONE]——旧 recorder 会把这些归一化丢真 */
const RAW_SSE = [
  `: keepalive 1/2`,
  ``,
  `data: {"id":"chatcmpl-abc","created":1788163779,"system_fingerprint":"b10621-c1d0e7a00","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"想想"}}]}`,
  ``,
  `data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{"content":"答"}}]}`,
  ``,
  `data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"get_weather","arguments":"{\\"city\\":\\"北京\\"}"}}]}}]}`,
  ``,
  `data: {"id":"chatcmpl-abc","choices":[{"index":0,"finish_reason":"tool_calls","delta":{}}]}`,
  ``,
  `data: [DONE]`,
  ``,
].join("\n");

function fakeEngine(body = RAW_SSE): typeof fetch {
  return (async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          // 故意切成不均匀的两块，验证 tee 不依赖 chunk 边界
          const bytes = Buffer.from(body, "utf8");
          c.enqueue(bytes.subarray(0, 120));
          c.enqueue(bytes.subarray(120));
          c.close();
        },
      }),
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    )) as unknown as typeof fetch;
}

test("字节保真：request.json / response.sse 与线上字节逐字节一致", async () => {
  const root = mkdtempSync(join(tmpdir(), "wire-"));
  const wire = createWireRecorder(root, { fetchImpl: fakeEngine() });
  const client = new OpenAIClient("http://mock", "test-model", wire.fetchImpl);

  const events = [];
  for await (const ev of client.stream({
    messages: [{ role: "user", content: "北京天气" }],
    temperature: 0,
  })) {
    events.push(ev);
  }

  const dir = join(wire.sessionDir, "call-001");
  // 请求体 = OpenAIClient 实际发送的 JSON 字符串（逐字节）
  const req = JSON.parse(readFileSync(join(dir, "request.json"), "utf8"));
  assert.equal(req.model, "test-model");
  assert.equal(req.messages[0].content, "北京天气");
  // 响应体 = 引擎原始字节（keepalive/reasoning_content/id/created 全部原样保留）
  assert.equal(readFileSync(join(dir, "response.sse"), "utf8"), RAW_SSE);
  // 事件流解析不受影响（客户端拿到了 reasoning 与 tool_call 事件）
  assert.ok(events.some((e) => e.type === "reasoning-delta"));
  assert.ok(events.some((e) => e.type === "tool-call-delta"));
  const done = events.at(-1);
  assert.equal(done?.type === "done" ? done.finishReason : "", "tool_calls");
});

test("溯源从原始字节生成：seq→(line,byte) 指向 response.sse 原件", async () => {
  const root = mkdtempSync(join(tmpdir(), "wire-"));
  const wire = createWireRecorder(root, { fetchImpl: fakeEngine() });
  const client = new OpenAIClient("http://mock", "m", wire.fetchImpl);
  for await (const _ev of client.stream({ messages: [{ role: "user", content: "q" }] })) {
    void _ev;
  }
  const dir = join(wire.sessionDir, "call-001");
  const traceLines = readFileSync(join(dir, "response.trace.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  // 三个增量 token：reasoning / text / tool-call 参数
  assert.deepEqual(traceLines.map((t) => t.kind), ["reasoning", "text", "tool-call"]);
  // byte/line 定位回原件：抽查第一个 token 的字节处确有其帧
  const raw = readFileSync(join(dir, "response.sse"));
  const first = traceLines[0];
  const frameStart = raw.subarray(first.byte).toString("utf8");
  assert.ok(frameStart.startsWith("data:"), "byte 应指向帧起始");
  assert.ok(frameStart.includes("想想"));
});

test("多次调用递增编号且目录隔离", async () => {
  const root = mkdtempSync(join(tmpdir(), "wire-"));
  const wire = createWireRecorder(root, { fetchImpl: fakeEngine() });
  const client = new OpenAIClient("http://mock", "m", wire.fetchImpl);
  for await (const _ of client.stream({ messages: [{ role: "user", content: "a" }] })) void _;
  for await (const _ of client.stream({ messages: [{ role: "user", content: "b" }] })) void _;
  const calls = readdirSync(wire.sessionDir).sort();
  assert.deepEqual(calls, ["call-001", "call-002"]);
});
