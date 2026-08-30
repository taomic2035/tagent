#!/usr/bin/env node
// ============================================================
// token 级溯源工具（制度见 docs/TRACEABILITY.md）
//
// 输入: 一个 response.sse 原始报文
// 输出: 同目录 response.trace.md（人读表格）+ response.trace.jsonl（机读索引）
//       输出不含时间戳 → 重跑结果逐字节相同（git 友好、可复核）
//
// 溯源公式: 第 N 个 token → trace.jsonl 第 N 行 → (line, byte) 定位原始帧
// 用法: node scripts/trace-sse.mjs <response.sse>
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("用法: node scripts/trace-sse.mjs <response.sse>");
  process.exit(1);
}

// ---- 1. 逐行扫描，记录每行的行号与字节偏移（Buffer 保证字节级精确） ----
const buf = readFileSync(input);
const records = [];
{
  let pos = 0;
  let lineNo = 0;
  while (pos < buf.length) {
    let nl = buf.indexOf(0x0a, pos); // "\n"
    if (nl === -1) nl = buf.length;
    const line = buf.subarray(pos, nl).toString("utf8").replace(/\r$/, "");
    records.push({ lineNo: ++lineNo, startByte: pos, line });
    pos = nl + 1;
  }
}

// ---- 2. 分类：注释帧 / 数据帧 / 结束帧，为每个 delta 记一条溯源 ----
const tokens = []; // {seq, kind, frame, line, byte, text, extra?}
const stats = {
  dataFrames: 0,
  keepaliveFrames: 0,
  reasoning: 0,
  text: 0,
  toolCallDeltas: 0,
  finishReason: null,
  sawDone: false,
};
let frame = 0;

for (const rec of records) {
  const { line, lineNo, startByte } = rec;
  if (line.startsWith(":")) {
    stats.keepaliveFrames++;
    continue; // SSE 注释帧（keepalive），无 token
  }
  if (!line.startsWith("data:")) continue; // 空行等
  const payload = line.slice(5).trim();
  if (payload === "[DONE]") {
    stats.sawDone = true;
    continue;
  }
  frame++;
  stats.dataFrames++;
  let chunk;
  try {
    chunk = JSON.parse(payload);
  } catch {
    console.error(`警告: 第 ${lineNo} 行 JSON 解析失败，跳过（原始字节仍在原件中）`);
    continue;
  }
  const choice = chunk.choices?.[0] ?? {};
  const delta = choice.delta ?? {};
  const push = (kind, text, extra = {}) => {
    if (typeof text !== "string" || text === "") return;
    tokens.push({ seq: tokens.length + 1, kind, frame, line: lineNo, byte: startByte, text, ...extra });
  };

  if (typeof delta.reasoning === "string") {
    stats.reasoning++;
    push("reasoning", delta.reasoning);
  }
  if (typeof delta.reasoning_content === "string") {
    stats.reasoning++;
    push("reasoning", delta.reasoning_content);
  }
  if (typeof delta.content === "string") {
    stats.text++;
    push("text", delta.content);
  }
  if (Array.isArray(delta.tool_calls)) {
    for (const tc of delta.tool_calls) {
      stats.toolCallDeltas++;
      push("tool-call", tc.function?.arguments ?? "", {
        index: tc.index ?? 0,
        id: tc.id ?? null,
        name: tc.function?.name ?? null,
      });
    }
  }
  if (choice.finish_reason) stats.finishReason = choice.finish_reason;
}

// ---- 3. 生成机读索引（每 token 一行） ----
// 输出名随输入名派生（同目录多份原件不互相覆盖）
const base = input.split("/").pop().replace(/\.sse$/, "");
const jsonl = tokens
  .map((t) => JSON.stringify({ seq: t.seq, kind: t.kind, frame: t.frame, line: t.line, byte: t.byte, text: t.text, ...extraOf(t) }))
  .join("\n") + "\n";
function extraOf(t) {
  return t.kind === "tool-call" ? { index: t.index, id: t.id, name: t.name } : {};
}

// ---- 4. 生成人读表格 ----
const esc = (s) => JSON.stringify(s).slice(1, -1).replace(/\|/g, "\\|"); // 表格内可见空格/转义，管道符转义
const trunc = (s, n = 48) => (s.length > n ? esc(s.slice(0, n)) + `…(+${s.length - n}字)` : esc(s));

const md = `# Token 溯源表：${base}

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | ${stats.dataFrames} |
| keepalive 注释帧 | ${stats.keepaliveFrames} |
| 思考 token（reasoning） | ${stats.reasoning} |
| 正文 token（text） | ${stats.text} |
| tool_call 分片 | ${stats.toolCallDeltas} |
| finish_reason | ${stats.finishReason ?? "(无)"} |
| 收到 [DONE] | ${stats.sawDone ? "是" : "否"} |
| 文件字节数 | ${buf.length} |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
${tokens
  .map(
    (t) =>
      `| ${t.seq} | ${t.kind} | ${t.frame} | ${t.line} | ${t.byte} | ${
        t.kind === "tool-call"
          ? `name=${t.name} args=${trunc(t.text)}`
          : trunc(t.text)
      } |`,
  )
  .join("\n")}
`;

const outMd = join(dirname(input), `${base}.trace.md`);
const outJsonl = join(dirname(input), `${base}.trace.jsonl`);
writeFileSync(outMd, md);
writeFileSync(outJsonl, jsonl);
console.log(
  `trace 完成: ${tokens.length} 个溯源条目（reasoning ${stats.reasoning} / text ${stats.text} / tool ${stats.toolCallDeltas}）→ ${outMd}`,
);
