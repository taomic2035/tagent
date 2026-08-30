import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecordingClient, type LLMClientLike } from "./recorder.js";

test("RecordingClient：把一次调用落成存证单元（request/sse/trace 三件套）", async () => {
  const root = mkdtempSync(join(tmpdir(), "tagent-rec-"));

  // 内层假 client：回放一次「思考→正文→工具分片→done」
  const inner: LLMClientLike = {
    async *stream() {
      yield { type: "reasoning-delta", delta: "想想" };
      yield { type: "text-delta", delta: "回答" };
      yield { type: "tool-call-delta", index: 0, id: "t1", name: "echo", argsDelta: '{"a":' };
      yield { type: "tool-call-delta", index: 0, argsDelta: "1}" };
      yield { type: "done", finishReason: "tool_calls", usage: { promptTokens: 10, completionTokens: 5 } };
    },
  };

  const rec = new RecordingClient(inner, "/model/path", root);
  const seen: string[] = [];
  for await (const ev of rec.stream({ messages: [{ role: "user", content: "hi" }], temperature: 0.7 })) {
    seen.push(ev.type);
  }
  // 透传不丢事件
  assert.deepEqual(seen, ["reasoning-delta", "text-delta", "tool-call-delta", "tool-call-delta", "done"]);

  const sessionDir = readdirSync(root)[0] as string;
  const callDir = join(root, sessionDir, "call-001");
  assert.deepEqual(readdirSync(callDir).sort(), ["request.json", "response.sse", "response.trace.jsonl"]);

  // request.json：请求体可事后重放（含 model/messages/tools/stream）
  const req = JSON.parse(readFileSync(join(callDir, "request.json"), "utf8"));
  assert.equal(req.model, "/model/path");
  assert.equal(req.stream, true);
  assert.equal(req.messages[0].content, "hi");

  // response.sse：每帧 data: 开头，[DONE] 结尾（与引擎真实帧结构一致）
  const sse = readFileSync(join(callDir, "response.sse"), "utf8");
  assert.match(sse, /^data: /m);
  assert.match(sse, /"reasoning":"想想"/);
  assert.match(sse, /"content":"回答"/);
  assert.match(sse, /"tool_calls":\[\{[^]*"id":"t1"/);
  // name 与 arguments 同帧并存时不得丢失（spread 覆盖 bug 的回归断言）
  assert.match(sse, /"function":\{"name":"echo","arguments":"\{\\"a\\":"/);
  assert.match(sse, /"finish_reason":"tool_calls"/);
  assert.match(sse, /data: \[DONE\]\n\n$/);

  // trace.jsonl：逐 token 溯源（seq 递增，末帧 done 不占 seq）
  const traceLines = readFileSync(join(callDir, "response.trace.jsonl"), "utf8").trim().split("\n");
  assert.equal(traceLines.length, 4);
  const entries = traceLines.map((l) => JSON.parse(l));
  assert.deepEqual(entries.map((e) => e.seq), [1, 2, 3, 4]);
  assert.deepEqual(entries.map((e) => e.kind), ["reasoning", "text", "tool-call", "tool-call"]);
  assert.ok(entries.every((e) => typeof e.frame === "number" && typeof e.line === "number" && typeof e.byte === "number"));

  rmSync(root, { recursive: true, force: true });
});

test("RecordingClient：多次调用递增编号，session 目录隔离", async () => {
  const root = mkdtempSync(join(tmpdir(), "tagent-rec2-"));
  const inner: LLMClientLike = {
    async *stream() {
      yield { type: "text-delta", delta: "x" };
      yield { type: "done", finishReason: "stop" };
    },
  };
  const rec = new RecordingClient(inner, "m", root);
  for (let i = 0; i < 3; i++) {
    for await (const _ of rec.stream({ messages: [{ role: "user", content: String(i) }] })) {
      // 消费
    }
  }
  const sessionDir = join(root, readdirSync(root)[0] as string);
  assert.deepEqual(readdirSync(sessionDir).sort(), ["call-001", "call-002", "call-003"]);
  rmSync(root, { recursive: true, force: true });
});
