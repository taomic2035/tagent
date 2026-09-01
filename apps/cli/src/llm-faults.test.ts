import test from "node:test";
import assert from "node:assert/strict";
import type { LLMClient, StreamEvent } from "@tagent/core";
import { parseLlmFaults, withLlmFaults, describeLlmFaults } from "./llm-faults.js";

// ============================================================
// LLM 层故障注入测试（Step 9，AC10 验收道具的道具测试）
// ============================================================

async function take(gen: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

/** 真实 client 替身：记录调用次数，返回可识别的正常流 */
function realClient(): LLMClient & { calls: number } {
  let call = 0;
  return {
    get calls() {
      return call;
    },
    async *stream() {
      call++;
      yield { type: "text-delta", delta: "真实响应" };
      yield { type: "done", finishReason: "stop" };
    },
  };
}

test("parseLlmFaults：三种剧本与非法配置", () => {
  const f = parseLlmFaults("empty,repeat:3,length:1");
  assert.deepEqual(f.get("empty"), { kind: "empty", n: 1 });
  assert.deepEqual(f.get("repeat"), { kind: "repeat", n: 3 });
  assert.deepEqual(f.get("length"), { kind: "length", n: 1 });
  assert.equal(parseLlmFaults(undefined).size, 0);
  assert.throws(() => parseLlmFaults("oops"), /条目非法/);
  assert.throws(() => parseLlmFaults("empty:x"), /次数非法/);
  assert.equal(describeLlmFaults(parseLlmFaults("empty:2")), "empty:2");
});

test("注入倒数：前 N 次合成流，之后放行真实 client", async () => {
  const real = realClient();
  const client = withLlmFaults(real, parseLlmFaults("empty:2"));
  const r1 = await take(client.stream({ messages: [] }));
  assert.equal(r1.length, 1);
  assert.ok(r1[0]);
  assert.equal(r1[0].type, "done");
  const r2 = await take(client.stream({ messages: [] }));
  assert.ok(r2[0]);
  assert.equal(r2[0].type, "done");
  assert.equal(real.calls, 0, "前两次不触达真实 client");
  const r3 = await take(client.stream({ messages: [] }));
  assert.ok(r3[0]);
  assert.equal(r3[0].type, "text-delta");
  assert.equal(real.calls, 1, "第三次放行");
});

test("剧本形态：repeat 吐完整 tool_call + tool_calls；length 吐截断 args + length", async () => {
  const rep = await take(withLlmFaults(realClient(), parseLlmFaults("repeat:1")).stream({ messages: [] }));
  const repDelta = rep[0];
  const repDone = rep[1];
  assert.ok(repDelta && repDelta.type === "tool-call-delta");
  assert.equal(repDelta.name, "get_weather");
  assert.equal(repDelta.argsDelta, '{"city":"北京"}'); // 完整可解析（会被真实执行）
  assert.ok(repDone && repDone.type === "done" && repDone.finishReason === "tool_calls");

  const len = await take(withLlmFaults(realClient(), parseLlmFaults("length:1")).stream({ messages: [] }));
  const lenDelta = len[0];
  const lenDone = len[1];
  assert.ok(lenDelta && lenDelta.type === "tool-call-delta" && lenDelta.argsDelta);
  assert.ok(!lenDelta.argsDelta.endsWith("}"), "args 是被截断的 JSON");
  assert.ok(lenDone && lenDone.type === "done" && lenDone.finishReason === "length");
});

test("无注入时原样透传（零开销路径）", async () => {
  const real = realClient();
  const client = withLlmFaults(real, new Map());
  assert.equal(client, real, "零剧本直接返回原 client，不包一层");
});
