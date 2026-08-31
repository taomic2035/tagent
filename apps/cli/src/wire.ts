import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { traceSse } from "./trace.js";

// ============================================================
// 原始报文记录器（Step 3 期间升级，TRACEABILITY §1/§4）
//
// 旧 recorder 在 stream 层从解析后事件"重建"SSE 帧——字段名被归一化
// （llama.cpp 的 reasoning_content 记成 reasoning）、keepalive/指纹/timings
// 全部丢失，"原始字节"的制度宣称对 session 存证不成立（2026-08-31 复盘发现）。
//
// 现改为 fetch 层 tee：请求体与响应体按**原始字节**落盘，core 一行不动
// （OpenAIClient 的 fetchImpl 注入点，NFR-5 的另一个受益者）。
// response-headers 是 fetch 解析结果的重建（fetch 拿不到头字节原件；
// 头字节原件仍以 curl -D 的 captures/ 三件套为准——残余边界，见 TRACEABILITY §1）。
// ============================================================

export interface WireRecorder {
  /** 注入 OpenAIClient 的 fetch：每次调用落一个存证单元（call-NNN/） */
  fetchImpl: typeof fetch;
  /** 存证会话目录（CLI 横幅/验收归档用） */
  sessionDir: string;
}

export function createWireRecorder(
  root: string,
  opts: { fetchImpl?: typeof fetch } = {},
): WireRecorder {
  const realFetch = opts.fetchImpl ?? fetch;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const sessionDir = join(root, stamp);
  let callNo = 0;

  const fetchImpl: typeof fetch = async (input, init) => {
    const dir = join(sessionDir, `call-${String(++callNo).padStart(3, "0")}`);
    mkdirSync(dir, { recursive: true });

    // 1) 请求体原件：OpenAIClient 传入的 body 就是最终发送的字符串，逐字节落盘
    writeFileSync(join(dir, "request.json"), String(init?.body ?? ""));

    // 2) 真正发出
    const res = await realFetch(input, init);

    // 3) 响应头（解析重建，见文件头注释）
    const headerLines = [`HTTP ${res.status} ${res.statusText}`];
    res.headers.forEach((v, k) => headerLines.push(`${k}: ${v}`));
    writeFileSync(join(dir, "response-headers.txt"), headerLines.join("\n") + "\n");

    if (!res.body) return res;

    // 4) 响应体 tee：原始字节逐块追加落盘，同时原样转发给消费方（client.ts）
    const ssePath = join(dir, "response.sse");
    writeFileSync(ssePath, "");
    const chunks: Uint8Array[] = [];
    const reader = res.body.getReader();
    const teed = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          // 5) 流结束：从原始字节生成 token 级溯源（seq→frame→line→byte 指向原件）
          const raw = concat(chunks);
          if (raw.length > 0) {
            const t = traceSse(raw);
            writeFileSync(join(dir, "response.trace.jsonl"), t.jsonl);
            writeFileSync(join(dir, "response.trace.md"), t.md);
          }
          return;
        }
        chunks.push(value);
        appendFileSync(ssePath, value);
        controller.enqueue(value);
      },
      cancel(reason) {
        void reader.cancel(reason);
      },
    });

    return new Response(teed, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };

  return { fetchImpl, sessionDir };
}

function concat(chunks: Uint8Array[]): Buffer {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = Buffer.alloc(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
