import test from "node:test";
import assert from "node:assert/strict";
import { traceSse } from "./trace.js";

// ============================================================
// traceSse 直接测试（Step 16 审计补缺：此前仅经 wire.test 间接覆盖——
// 它是溯源制度的单一实现，(seq→frame→line→byte) 三方印证必须直接验证）
// ============================================================

/** 构造 4 帧 SSE：reasoning（llama.cpp 字段名）/ content / tool 分片 / done。
 *  用 JS 对象构造再序列化——多层转义手写 JSON 会静默改坏（本次实测踩坑）。 */
const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}`;
const SSE = [
  frame({ choices: [{ delta: { reasoning_content: "想" } }] }),
  frame({ choices: [{ delta: { content: "答" } }] }),
  frame({ choices: [{ delta: { tool_calls: [{ index: 0, id: "t1", function: { name: "get_weather", arguments: '{"city":"北' } }] } }] }),
  frame({ choices: [{ finish_reason: "tool_calls" }] }),
  "data: [DONE]",
].join("\n\n");

test("traceSse：token 记录指向原件字节（三方印证可复核）", () => {
  const SSE_BUF = Buffer.from(SSE, "utf-8"); // byte 是 Buffer 字节偏移（中文 1 码元=3 字节，string.slice 会错位）
  const { jsonl, stats } = traceSse(SSE_BUF);
  const recs = jsonl.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(recs.length, 3, "reasoning+content+tool 分片各一条");

  // byte/line 指向原件：抽验第 2 条（content）——帧首行起始字节可在原 buffer 中定位到 "data:"
  const r2 = recs[1];
  assert.ok(r2);
  assert.equal(r2.kind, "text");
  const slice = SSE_BUF.subarray(r2.byte, r2.byte + 5).toString("utf8");
  assert.equal(slice, "data:", `byte=${r2.byte} 应指向帧起始，实际 ${JSON.stringify(slice)}`);
  // line 指向帧的 data 行（1-based；第 2 帧起始行 = 第 3 行）
  assert.equal(r2.line, 3);
  assert.equal(r2.frame, 2);

  // seq 连续、kind 分类正确
  assert.deepEqual(
    recs.map((r) => r.seq),
    [1, 2, 3],
  );
  assert.equal(recs[0]?.kind, "reasoning");
  assert.equal(recs[2]?.kind, "tool-call");
  assert.equal(recs[2]?.name, "get_weather");
});

test("traceSse：stats 统计与 finishReason / DONE 识别", () => {
  const { stats } = traceSse(Buffer.from(SSE, "utf-8"));
  assert.equal(stats.dataFrames, 4); // [DONE] 不算 data 帧
  assert.equal(stats.keepaliveFrames, 0);
  assert.equal(stats.reasoning, 1);
  assert.equal(stats.text, 1);
  assert.equal(stats.toolCallDeltas, 1);
  assert.equal(stats.finishReason, "tool_calls");
  assert.equal(stats.sawDone, true);
});

test("traceSse：keepalive 注释帧与空行不计入；确定性（同输入同输出）", () => {
  const withKeepalive = ': keepalive 1/2\n\n' + SSE;
  const a = traceSse(Buffer.from(withKeepalive, "utf-8"));
  const b = traceSse(Buffer.from(withKeepalive, "utf-8"));
  assert.equal(a.stats.keepaliveFrames, 1);
  assert.equal(a.stats.dataFrames, 4);
  assert.deepEqual(a, b, "无时间戳：同输入同输出（git 友好、可复核）");
});

test("traceSse：reasoning 双认（MLX 的 reasoning 字段）", () => {
  const mlx = 'data: {"choices":[{"delta":{"reasoning":"MLX 思考"}}]}';
  const { stats, jsonl } = traceSse(Buffer.from(mlx, "utf-8"));
  assert.equal(stats.reasoning, 1);
  assert.ok(jsonl.includes("MLX 思考"));
});
