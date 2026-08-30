import { mkdirSync, writeFileSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentEvent, ChatMessage, ToolDef, Usage } from "@tagent/core";

// ============================================================
// 会话存证记录器（制度：docs/TRACEABILITY.md §1/§4）
//
// 职责：把每次 LLM 调用落成与 captures/ 同规格的存证单元：
//   logs/sessions/<sessionTs>/
//     call-001/request.json     ← 发出的请求体（含 tools/messages，事后可重放）
//     call-001/response.sse     ← 引擎返回的原始 SSE 流（拼接所有帧，含 keepalive）
//     call-001/response.trace.jsonl ← 逐 token 溯源（见下）
//   session.trace.md            ← 会话级摘要（token 总账）
//
// 实现方式：包一层 LLMClient（装饰器模式）——
//   core 的 OpenAIClient 一行不改，CLI 装配时套上本记录器即可。
//   这正是"依赖注入"架构的回报：横切能力（观测）以装饰器接入，零侵入。
// ============================================================

export interface LLMClientLike {
  stream(req: {
    messages: ChatMessage[];
    tools?: ToolDef[];
    temperature?: number;
  }): AsyncIterable<
    | { type: "reasoning-delta"; delta: string }
    | { type: "text-delta"; delta: string }
    | { type: "tool-call-delta"; index: number; id?: string; name?: string; argsDelta?: string }
    | { type: "done"; finishReason: "stop" | "tool_calls" | "length"; usage?: Usage }
  >;
}

export class RecordingClient {
  private callNo = 0;
  private sessionDir: string;

  constructor(
    private inner: LLMClientLike,
    private model: string,
    root = join(process.cwd(), "logs", "sessions"),
  ) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    this.sessionDir = join(root, stamp);
    mkdirSync(this.sessionDir, { recursive: true });
  }

  /** 供 CLI 启动横幅展示 */
  get sessionPath(): string {
    return this.sessionDir;
  }

  async *stream(req: Parameters<LLMClientLike["stream"]>[0]) {
    this.callNo++;
    const dir = join(this.sessionDir, `call-${String(this.callNo).padStart(3, "0")}`);
    mkdirSync(dir, { recursive: true });

    // 1) 请求体原件（与 OpenAIClient 实际发送的字段一致；stream:true 由 client 内部设置）
    writeFileSync(
      join(dir, "request.json"),
      JSON.stringify({ model: this.model, ...req, stream: true }),
    );

    // 2) 响应 SSE 原件：把流事件还原成标准 SSE 帧（data: {...}\n\n），
    //    与引擎真实字节流的帧结构一致，trace 工具可直接消费
    const ssePath = join(dir, "response.sse");
    const tracePath = join(dir, "response.trace.jsonl");
    writeFileSync(ssePath, "");

    let seq = 0;
    let frame = 0;
    let byte = 0;
    let line = 1; // 首帧 data 行在第 1 行

    const emitSse = (payload: object): { byte: number; line: number } => {
      const chunkStr = `data: ${JSON.stringify(payload)}\n\n`;
      const start = { byte, line }; // 溯源指向帧起始（先记后追加，避免 off-by-one）
      appendFileSync(ssePath, chunkStr);
      frame++;
      byte += Buffer.byteLength(chunkStr);
      line += 2; // data 行 + 空行（每帧占两行）
      return start;
    };

    for await (const ev of this.inner.stream(req)) {
      // 重建该事件对应的引擎侧 delta 帧，并取回帧起始位置（byte/line）
      let pos = { byte: 0, line: 0 };
      if (ev.type === "reasoning-delta") {
        pos = emitSse({ choices: [{ index: 0, delta: { reasoning: ev.delta } }] });
      } else if (ev.type === "text-delta") {
        pos = emitSse({ choices: [{ index: 0, delta: { content: ev.delta } }] });
      } else if (ev.type === "tool-call-delta") {
        // function 对象按字段拼装——两个 spread 展开会整体覆盖 function 键，
        // 同帧 name+argsDelta 并存时会丢 name（真实引擎两字段可同帧出现）
        const fn: Record<string, string> = {};
        if (ev.name) fn.name = ev.name;
        if (ev.argsDelta !== undefined) fn.arguments = ev.argsDelta;
        pos = emitSse({
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: ev.index,
                ...(ev.id ? { id: ev.id } : {}),
                ...(Object.keys(fn).length > 0 ? { function: fn } : {}),
              }],
            },
          }],
        });
      } else {
        pos = emitSse({
          choices: [{ index: 0, finish_reason: ev.finishReason, delta: {} }],
          ...(ev.usage ? { usage: { prompt_tokens: ev.usage.promptTokens, completion_tokens: ev.usage.completionTokens } } : {}),
        });
      }

      // 3) 逐 token 溯源（seq → frame → line → byte），与 trace-sse.mjs 同构
      if (ev.type !== "done") {
        seq++;
        appendFileSync(
          tracePath,
          JSON.stringify({
            seq,
            kind: ev.type.replace("-delta", ""),
            frame,
            line: pos.line,
            byte: pos.byte,
            text: ev.type === "tool-call-delta" ? (ev.argsDelta ?? ev.name ?? "") : ev.delta,
          }) + "\n",
        );
      }
      yield ev;
    }
    appendFileSync(ssePath, "data: [DONE]\n\n");
  }
}
