import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  LLMHttpError,
  LLMStreamError,
  OpenAIClient,
  sseEvents,
} from "./client.js";
import type { StreamEvent } from "./types.js";

// fixtures 目录在 src/ 之外（tsc 不复制资源文件），
// 测试从编译产物 dist/ 运行，故路径为 dist/../fixtures
const FIXTURE_DIR = join(import.meta.dirname, "..", "fixtures");

/** 把字符串序列变成字节流 —— 模拟 TCP 任意切割（每个字符串是一个网络 chunk） */
function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const ev of sseEvents(body)) events.push(ev);
  return events;
}

// ============================================================
// 真实报文（fixtures，与 captures/03、04 同源）
// ============================================================

test("真实流·纯对话：思考增量齐全，末帧 length，无 usage", async () => {
  const raw = await readFile(join(FIXTURE_DIR, "chat-stream.sse"), "utf8");
  const events = await collect(streamFrom([raw])); // 整文件一个 chunk（还原原始传输）
  const reasoning = events.filter((e) => e.type === "reasoning-delta");
  const text = events.filter((e) => e.type === "text-delta");
  assert.ok(reasoning.length > 0, "应解析出思考增量（Qwen3.5 默认思考）");
  // 协议教训（fixture 实录）：max_tokens=150 被思考内容全部耗尽，正文 0 token，
  // finish_reason=length —— max_tokens 的计数范围【包含】思考 token。
  // 思考模型必须给足 max_tokens，否则会在思考阶段就被截断。
  assert.equal(text.length, 0);
  const done = events.at(-1);
  assert.equal(done?.type, "done");
  assert.equal(done?.type === "done" && done.finishReason, "length");
  assert.equal(done?.type === "done" && done.usage, undefined); // MLX 流式无 usage（实测）
});

test("真实流·工具调用：tool_call 单帧完整，finish=tool_calls", async () => {
  const raw = await readFile(join(FIXTURE_DIR, "tool-stream.sse"), "utf8");
  const events = await collect(streamFrom([raw]));
  const calls = events.filter((e) => e.type === "tool-call-delta");
  assert.equal(calls.length, 1); // MLX 实测：整个 tool_call 一帧发完
  const call = calls[0];
  assert.equal(call?.type === "tool-call-delta" && call.index, 0);
  assert.equal(call?.type === "tool-call-delta" && call.name, "get_weather");
  assert.match(call?.type === "tool-call-delta" && call.argsDelta || "", /北京/);
  const done = events.at(-1);
  assert.equal(done?.type === "done" && done.finishReason, "tool_calls");
});

test("真实流·keepalive 注释帧被跳过", async () => {
  const raw = await readFile(join(FIXTURE_DIR, "chat-stream.sse"), "utf8");
  assert.match(raw, /^: keepalive/m); // 前提：fixture 里确实存在注释帧
  const events = await collect(streamFrom([raw]));
  const known = new Set(["reasoning-delta", "text-delta", "tool-call-delta", "done"]);
  assert.ok(
    events.every((e) => known.has(e.type)),
    "注释帧不应产生任何事件",
  );
});

// ============================================================
// 合成报文：协议边界（fixture 覆盖不到的 OpenAI 形态与传输异常）
// ============================================================

test("合成·跨 chunk 断行：JSON 帧被 TCP 从中间切开仍能解析", async () => {
  const frame = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n';
  const events = await collect(streamFrom([
    ": keepalive 1/2\n\n",
    frame.slice(0, 21), // 从 JSON 中间切断
    frame.slice(21),
    "data: [DONE]\n\n",
  ]));
  const text = events.filter((e) => e.type === "text-delta");
  assert.deepEqual(text, [{ type: "text-delta", delta: "Hi" }]);
  assert.equal(events.at(-1)?.type, "done");
});

test("合成·OpenAI 式分片：arguments 逐字碎片透传（合并在 loop 层做）", async () => {
  const events = await collect(streamFrom([
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"t1","type":"function","function":{"name":"calc","arguments":""}}]}}]}\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"3.7*"}}]}}]}\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"12"}}]}}]}\n\n',
    'data: {"choices":[{"finish_reason":"tool_calls","delta":{"role":"assistant"}}]}\n\n',
    "data: [DONE]\n\n",
  ]));
  const calls = events.filter((e) => e.type === "tool-call-delta");
  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.type === "tool-call-delta" && calls[0].name, "calc");
  assert.equal(calls[0]?.type === "tool-call-delta" && calls[0].id, "t1");
  assert.equal(calls[1]?.type === "tool-call-delta" && calls[1].argsDelta, "3.7*");
  assert.equal(calls[2]?.type === "tool-call-delta" && calls[2].argsDelta, "12");
});

test("合成·多工具并发调用：index 区分两个槽位", async () => {
  const events = await collect(streamFrom([
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"a","function":{"name":"f","arguments":"{}"}}]}}]}\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"b","function":{"name":"g","arguments":"{}"}}]}}]}\n\n',
    "data: [DONE]\n\n",
  ]));
  const calls = events.filter((e) => e.type === "tool-call-delta");
  assert.deepEqual(
    calls.map((c) => (c.type === "tool-call-delta" ? c.index : -1)),
    [0, 1],
  );
});

test("合成·流缺失 [DONE]：判定为连接截断并报错", async () => {
  await assert.rejects(
    collect(streamFrom(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'])),
    LLMStreamError,
  );
});

// ============================================================
// HTTP 层：重试与错误分类（mock fetch，NFR-5）
// ============================================================

/** 假 fetch：按剧本依次返回响应，记录调用次数 */
function mockFetch(script: Array<Response | Error>): {
  fetch: typeof fetch;
  calls: () => number;
} {
  let n = 0;
  const fn = ((_url: unknown, _init: unknown) => {
    const step = script[n++];
    if (step instanceof Error) throw step;
    return Promise.resolve(step);
  }) as typeof fetch;
  return { fetch: fn, calls: () => n };
}

test("HTTP·5xx 重试一次后成功", async () => {
  const okSse = streamFrom(["data: [DONE]\n\n"]);
  const okRes = new Response(okSse, { status: 200 });
  const { fetch: fake, calls } = mockFetch([
    new Response("boom", { status: 500 }),
    okRes,
  ]);
  const client = new OpenAIClient("http://x/v1", "m", fake);
  const events: StreamEvent[] = [];
  for await (const ev of client.stream({ messages: [{ role: "user", content: "hi" }] }))
    events.push(ev);
  assert.equal(events.length, 1); // 只有 done
  assert.equal(calls(), 2);
});

test("HTTP·4xx 不重试直接报错", async () => {
  const { fetch: fake, calls } = mockFetch([new Response("bad request", { status: 400 })]);
  const client = new OpenAIClient("http://x/v1", "m", fake);
  const consume = async () => {
    for await (const _ of client.stream({ messages: [{ role: "user", content: "hi" }] })) {
      // 消费到抛错为止
    }
  };
  await assert.rejects(consume(), LLMHttpError);
  assert.equal(calls(), 1);
});

// ---- Step 4：请求级思考开关（FR-23）----

test("chatTemplateKwargs 存在时进请求体，缺省时不携带（与旧版逐字节同形）", async () => {
  const bodies: string[] = [];
  const mockFetch = (async (_u: unknown, init?: RequestInit) => {
    bodies.push(String(init?.body));
    // 立即关闭的空流：fetch 发生即可，流内容本测试不关心
    return new Response(new ReadableStream({ start(c) { c.close(); } }), { status: 200 });
  }) as unknown as typeof fetch;
  const on = new OpenAIClient("http://x", "m", mockFetch);
  const off = new OpenAIClient("http://x", "m", mockFetch);
  try { for await (const _ of on.stream({ messages: [], chatTemplateKwargs: { enable_thinking: true } })) void _; } catch { /* 流体为空，异常即可 */ }
  try { for await (const _ of off.stream({ messages: [] })) void _; } catch { /* 同上 */ }
  assert.match(bodies[0] ?? "", /"chat_template_kwargs":\{"enable_thinking":true\}/);
  assert.doesNotMatch(bodies[1] ?? "", /chat_template_kwargs/);
});
