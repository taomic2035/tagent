// ============================================================
// token 级溯源生成（由 scripts/trace-sse.mjs 的实现收编而来，单一实现）
//
// 输入: 原始 SSE 字节
// 输出: jsonl（每 token 一行，seq→frame→line→byte 指向原件）+ md（人读表）
// 确定性：无时间戳，同输入同输出（git 友好、可复核）
// 与引擎差异双认：reasoning（MLX）/ reasoning_content（llama.cpp）
// ============================================================
export interface TraceStats {
  dataFrames: number;
  keepaliveFrames: number;
  reasoning: number;
  text: number;
  toolCallDeltas: number;
  finishReason: string | null;
  sawDone: boolean;
}

export interface TraceOutput {
  jsonl: string;
  md: string;
  stats: TraceStats;
}

interface TokenRec {
  seq: number;
  kind: string;
  frame: number;
  line: number;
  byte: number;
  text: string;
  index?: number;
  id?: string | null;
  name?: string | null;
}

export function traceSse(buf: Buffer): TraceOutput {
  // ---- 1. 逐行扫描，记录行号与字节偏移（字节级精确） ----
  const records: Array<{ lineNo: number; startByte: number; line: string }> = [];
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

  const tokens: TokenRec[] = [];
  const stats: TraceStats = {
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
    let chunk: Record<string, unknown>;
    try {
      chunk = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      continue; // 非 JSON 行（如错误页），跳过但原件仍在
    }
    const choice = firstChoice(chunk);
    const delta = isObj(choice?.delta) ? choice.delta : {};
    const push = (kind: string, text: unknown, extra: Partial<TokenRec> = {}) => {
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
        if (!isObj(tc)) continue;
        stats.toolCallDeltas++;
        const fn = isObj(tc.function) ? tc.function : {};
        push("tool-call", fn.arguments ?? "", {
          index: typeof tc.index === "number" ? tc.index : 0,
          id: typeof tc.id === "string" ? tc.id : null,
          name: typeof fn.name === "string" ? fn.name : null,
        });
      }
    }
    if (choice && typeof choice.finish_reason === "string") stats.finishReason = choice.finish_reason;
  }

  const jsonl =
    tokens
      .map((t) =>
        JSON.stringify({
          seq: t.seq,
          kind: t.kind,
          frame: t.frame,
          line: t.line,
          byte: t.byte,
          text: t.text,
          ...(t.kind === "tool-call" ? { index: t.index, id: t.id, name: t.name } : {}),
        }),
      )
      .join("\n") + "\n";

  const esc = (s: string) => JSON.stringify(s).slice(1, -1).replace(/\|/g, "\\|");
  const trunc = (s: string, n = 48) => (s.length > n ? esc(s.slice(0, n)) + `…(+${s.length - n}字)` : esc(s));
  const md = `# Token 溯源表（wire 记录器自动生成，确定性输出）

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

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
${tokens
  .map(
    (t) =>
      `| ${t.seq} | ${t.kind} | ${t.frame} | ${t.line} | ${t.byte} | ${
        t.kind === "tool-call" ? `name=${t.name} args=${trunc(t.text)}` : trunc(t.text)
      } |`,
  )
  .join("\n")}
`;

  return { jsonl, md, stats };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function firstChoice(chunk: Record<string, unknown>): Record<string, unknown> | undefined {
  const choices = chunk.choices;
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0];
  return isObj(first) ? first : undefined;
}
