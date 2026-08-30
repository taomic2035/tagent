import type { ChatMessage, StreamEvent, ToolDef, Usage } from "./types.js";

// ============================================================
// 错误类型
// ============================================================

/** HTTP 状态非 2xx。4xx 不重试（参数错误重试无意义）。 */
export class LLMHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`LLM HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = "LLMHttpError";
  }
}

/** 流在 [DONE] 之前结束 —— 视为连接截断（DESIGN.md §2）。 */
export class LLMStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMStreamError";
  }
}

// ============================================================
// LLMClient 接口与 OpenAI 兼容实现
// ============================================================

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
}

export interface LLMClient {
  stream(req: ChatRequest): AsyncIterable<StreamEvent>;
}

const RETRY_DELAY_MS = 500;

export class OpenAIClient implements LLMClient {
  constructor(
    private baseUrl: string,
    private model: string,
    /** 注入点：测试时替换为 mock fetch（NFR-5） */
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    const res = await this.fetchWithRetry(req);
    if (!res.body) throw new LLMStreamError("response has no body");
    yield* sseEvents(res.body);
  }

  /** 仅对「连接失败 / 5xx」重试 1 次（重试只发生在拿到响应之前；
   *  流一旦开始传输就无法安全重试）。 */
  private async fetchWithRetry(req: ChatRequest): Promise<Response> {
    const url = `${this.baseUrl}/chat/completions`;
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        tools: req.tools,
        temperature: req.temperature,
        stream: true,
      }),
    };
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, init);
      } catch (err) {
        if (attempt === 0) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw err;
      }
      if (!res.ok) {
        const body = await res.text();
        if (res.status >= 500 && attempt === 0) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new LLMHttpError(res.status, body);
      }
      return res;
    }
  }
}

// ============================================================
// SSE 协议解析（DESIGN.md §2 算法的实现）
//
// 职责边界：本函数只做「协议字节流 → StreamEvent」的翻译，
// 不维护跨 chunk 的 tool_calls 合并状态 —— 那是 loop 的职责
// （ARCHITECTURE.md：client 是纯协议适配器）。
// ============================================================

/** MLX server 实测（fixtures/*.sse）：
 *  - 注释行 ": keepalive n/m" 需跳过
 *  - 思考 delta 字段为 reasoning（非流式消息里是 reasoning_content，两者都认）
 *  - 流式响应没有 usage 字段
 *  - 以 "data: [DONE]" 结尾；缺失视为连接截断 */
export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = ""; // 行缓冲：chunk 可能在任意字节处断开，必须攒到出现 \n
  let finishReason: "stop" | "tool_calls" | "length" | undefined;
  let usage: Usage | undefined;
  let sawDone = false;

  const handleLine = (line: string): StreamEvent[] => {
    const events: StreamEvent[] = [];
    // SSE 注释行（如 keepalive）与空行：协议规定非 "data:" 行一律忽略
    if (!line.startsWith("data:")) return events;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") {
      sawDone = true;
      return events;
    }
    let chunk: unknown;
    try {
      chunk = JSON.parse(payload);
    } catch {
      throw new LLMStreamError(`invalid JSON in SSE data: ${payload.slice(0, 120)}`);
    }
    const choice = getChoice(chunk);
    const delta = isObj(choice?.delta) ? choice.delta : {};
    // 思考内容：兼容 reasoning（MLX 流式实测）与 reasoning_content（OpenAI 惯例）
    const reasoning = pickStr(delta, "reasoning") ?? pickStr(delta, "reasoning_content");
    if (reasoning !== undefined) events.push({ type: "reasoning-delta", delta: reasoning });
    const content = pickStr(delta, "content");
    if (content !== undefined) events.push({ type: "text-delta", delta: content });
    const toolCalls = delta["tool_calls"];
    if (Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        if (!isObj(tc)) continue;
        const fn = isObj(tc["function"]) ? tc["function"] : {};
        const index = typeof tc["index"] === "number" ? tc["index"] : 0;
        events.push({
          type: "tool-call-delta",
          index,
          id: pickStr(tc, "id"),
          name: pickStr(fn, "name"),
          argsDelta: pickStr(fn, "arguments"),
        });
      }
    }
    const fr = choice?.finish_reason;
    if (fr === "stop" || fr === "tool_calls" || fr === "length") finishReason = fr;
    usage = extractUsage(chunk) ?? usage;
    return events;
  };

  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      for (const ev of handleLine(line)) yield ev;
    }
  }
  buffer += decoder.decode(); // 冲刷 UTF-8 多字节尾字节
  // 容错：最后一行若无换行符（部分实现如此），也处理掉
  if (buffer.trim() !== "") {
    for (const ev of handleLine(buffer)) yield ev;
    buffer = "";
  }
  if (!sawDone) {
    throw new LLMStreamError("stream ended without [DONE] (connection truncated?)");
  }
  yield { type: "done", finishReason: finishReason ?? "stop", usage };
}

// ---- 小工具：安全取值（NFR-2/noUncheckedIndexedAccess 下的防御式解析） ----

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

function getChoice(chunk: unknown): Record<string, unknown> | undefined {
  if (!isObj(chunk)) return undefined;
  const choices = chunk["choices"];
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0]; // noUncheckedIndexedAccess: 类型是 unknown | undefined
  return isObj(first) ? first : undefined;
}

function pickStr(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v !== "" ? v : undefined;
}

function extractUsage(chunk: unknown): Usage | undefined {
  if (!isObj(chunk)) return undefined;
  const u = chunk["usage"];
  if (!isObj(u)) return undefined;
  const p = u["prompt_tokens"];
  const c = u["completion_tokens"];
  if (typeof p !== "number" || typeof c !== "number") return undefined;
  return { promptTokens: p, completionTokens: c };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
