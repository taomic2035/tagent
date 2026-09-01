# 第 2 章 会说话：v0.1 请求 → v0.2 流式 → v0.3 聊天壳

> agent 长出第一批本事。本章动手线：非流式请求、手写 SSE（撞三面墙）、
> 多轮聊天壳。原理线两节"深入一层"：**HTTP chunk 与 SSE 帧的两层边界**、
> **UTF-8 变长编码的位结构**——它们是三面墙的总根因。代码全量，每段能跑。

---

## 2.1 项目骨架（一次搭好，全书沿用）

```
my-agent/
├── package.json            # 根：只放脚本
├── pnpm-workspace.yaml     # packages/* + apps/*
├── tsconfig.base.json      # strict + noUncheckedIndexedAccess 全开
├── packages/core/          # 大脑（零依赖红线：只准 zod）
│   ├── package.json / tsconfig.json / src/
└── apps/cli/               # 壳（v0.3 建）
    └── package.json / tsconfig.json / src/
```

配置全量（`pnpm-workspace.yaml`）：

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

根 `package.json`：

```json
{
  "name": "my-agent",
  "private": true,
  "scripts": { "build": "pnpm -r build", "test": "pnpm -r test" }
}
```

`tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "noUncheckedIndexedAccess": true, "isolatedModules": true,
    "declaration": true, "skipLibCheck": true, "outDir": "dist", "rootDir": "src"
  }
}
```

`packages/core/package.json`：

```json
{
  "name": "@my-agent/core", "type": "module", "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  // main/types 不能省：没有入口声明，import "@my-agent/core" 找不到模块
  //（真机踩坑）；指向的 index.js 见本章末"导出入口"一节
  "scripts": { "build": "tsc", "test": "node --test \"dist/**/*.test.js\"" },
  "devDependencies": { "typescript": "^5.9.0", "@types/node": "^24.0.0" }
}
```

`packages/core/tsconfig.json`（**必须重声明 outDir/rootDir**——extends 语义下
这两个路径按 base 所在目录解析，不重声明编译必报 `not under 'rootDir'`，
真机验证踩过的坑）：
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" }
}
```

**为什么分家**：大脑要被多种壳带走（第 8 章手机壳直接 import packages/core），
所以物理隔离；大脑零依赖（HTTP 用内置 fetch、解析手写）是"一份大脑到处跑"
的前提——不是行为艺术，是架构承诺。

## 2.2 v0.1：第一个请求（非流式）

`packages/core/src/client.ts`（v0.1 全量）：

```ts
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null };

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
}

export class OpenAIClient {
  private fetchImpl: typeof fetch = fetch;    // 注入点：测试替换，不发真网络

  constructor(private baseUrl: string, private model: string) {}

  async complete(req: ChatRequest): Promise<string> {
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        temperature: req.temperature,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return json.choices?.[0]?.message?.content ?? "";
  }
}
```

两个决定：**错误信封第一次出场**（HTTP 非 2xx 不静默，状态码+响应体前 200 字
进异常——第 4 章整章展开）；**fetchImpl 现在就留**（测试马上用，第 3 章
剧本化测试也靠它）。

入口（临时，v0.3 换壳）`packages/core/src/main.ts`：

```ts
import { OpenAIClient } from "./client.js";
const reply = await new OpenAIClient(
  "http://127.0.0.1:8081/v1",
  process.env.TAGENT_MODEL ?? "D:/LLM/models/<文件名>.gguf",
).complete({ messages: [{ role: "user", content: "用一句话介绍你自己" }], temperature: 0 });
console.log(reply);
```

```powershell
cd packages/core && pnpm build && node dist/main.js
# 约 4 秒后一次性打印（注意是"一次性"——非流式，v0.2 解决）
```

测试先行（纪律 4，注入 fake fetch 验错误路径，不赌真引擎）：

```ts
// client.test.ts
test("非 2xx：抛错且带状态码与响应体摘要", async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ error: "boom" }), { status: 500 });
  const client = new OpenAIClient("http://mock", "m");
  (client as unknown as Record<string, unknown>)["fetchImpl"] = fakeFetch;
  await assert.rejects(client.complete({ messages: [] }), /LLM HTTP 500: .*boom/);
});
```

## 2.3 v0.2：流式——先看协议原文

请求加 `"stream": true`，curl 加 `-N` 存原文：

```
data: {"choices":[{"delta":{"role":"assistant"}}]}

data: {"choices":[{"delta":{"content":"1"}}]}

data: {"choices":[{"delta":{"content":"，"}}]}

data: {"choices":[{"finish_reason":"stop","delta":{}}]}

data: [DONE]

```

SSE（Server-Sent Events）规格四件事：每帧一行 `data: ` 前缀；**空行是帧边界**；
`delta` 是增量（全部拼起来才是完整回答）；`[DONE]` 哨兵结束。`: ` 开头的
注释帧（keepalive 心跳）要跳过。

**为什么有 SSE**：第 1 章②讲过，decode 阶段一个 token 一个 token 地生成。
非流式要等全部生成完才返回首字节；流式让服务端**每生成一点就发一点**——
首字延迟从"整篇生成完"缩到"第一个 token"。传输形态就是 SSE：一个普通
HTTP 长连接，`Content-Type: text/event-stream`，服务端单向持续写。

### 第一版（最笨）：每块按行拆

```ts
// ❌ 错的——但请亲手跑一次
for await (const chunk of body) {
  for (const line of new TextDecoder().decode(chunk).split("\n")) { /* 处理行 */ }
}
```

本地跑**大多时候通**（本地 chunk 大、恰好整行到达）——危险正在于此：
错误只在真实网络条件下间歇出现。主动复现（7 字节一块重放）：

```
data: {"c          ← 前半行
hoices":[{...
SyntaxError: Unexpected token 'c', ..."ata: {\"c"... is not valid JSON
```

## 深入一层 ①：两层边界——HTTP chunk 与 SSE 帧

这里要把第 1 章的知识接上。你拿到的 `for await (const chunk of body)` 里的
chunk，是 **HTTP 传输层的块**（chunked transfer encoding：响应体被切成若干
chunk，各带长度前缀，TCP 之上再拆包与否你管不着）。而 SSE 的**帧**边界是
字节流里的 `\n\n`。**这是两个互不相关的粒度**：

```
TCP 段:   |────────packet──────|──packet──|────────packet────────|
HTTP chunk:      |------chunk A------|------chunk B------|
SSE 帧:    |---帧1---|---帧2---|---帧3---|---帧4---|
```

一个 chunk 可能是半帧、一帧、三帧半；帧边界可能落在 chunk 中间任何字节上。
所以解析器唯一可信任的边界是**字节流内容里的 `\n`**——这就是行缓冲的由来：

```ts
let buffer = "";
for await (const chunk of body) {
  buffer += decoder.decode(chunk, { stream: true });
  let nl: number;
  while ((nl = buffer.indexOf("\n")) >= 0) {   // 只处理凑齐的行
    const line = buffer.slice(0, nl).replace(/\r$/, "");
    buffer = buffer.slice(nl + 1);             // 半行留在 buffer 等下一块
    /* 处理 line */
  }
}
```

## 深入一层 ②：UTF-8 的位结构——中文为什么会被劈坏

行缓冲修好后，跑中文的恶劣分片（1 字节/块），随机位置出现 `�`（U+FFFD
替换字符）。根因在 UTF-8 的**变长编码**：ASCII 1 字节；一个常用汉字 3 字节。
怎么区分？**首字节的前缀**就是长度声明：

```
0xxxxxxx                              → 1 字节（ASCII）
110xxxxx 10xxxxxx                     → 2 字节
1110xxxx 10xxxxxx 10xxxxxx            → 3 字节（常用汉字在这里）
11110xxx 10xxxxxx 10xxxxxx 10xxxxxx   → 4 字节（emoji 等）
```

"北"= `E5 8C 97` 三个字节。网络分片恰好从中间劈开（chunk A 尾带 `E5 8C`，
chunk B 头带 `97`）时，前 2 字节单独看是"声明了 3 字节却只剩 2 字节"的
残缺序列——默认模式的 TextDecoder 只能产替换字符。**修法**：
`decode(chunk, { stream: true })` 让 decoder 持有内部缓冲、把不完整序列
攒到下一块；流结束后再无参 `decode()` 冲刷残留。忘了最终冲刷：流的最后一个
字符永远丢——中文场景偶发丢字，极难排查（真机踩坑）。

## 第二版（正确版）：sseEvents 全量

```ts
export type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "done"; finishReason: "stop" | "length" };

export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finishReason: "stop" | "length" = "stop";

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });      // 深入②：多字节安全
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {              // 深入①：行缓冲
      const line = buffer.slice(0, nl).replace(/\r$/, "");  // CRLF 兼容
      buffer = buffer.slice(nl + 1);
      if (line.startsWith(":")) continue;                   // 注释帧（keepalive）
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        yield { type: "done", finishReason };
        return;
      }
      try {
        const obj = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }>;
        };
        const choice = obj.choices?.[0];
        const content = choice?.delta?.content;
        if (typeof content === "string" && content !== "") {
          yield { type: "text-delta", delta: content };
        }
        if (choice?.finish_reason === "stop" || choice?.finish_reason === "length") {
          finishReason = choice.finish_reason;
        }
      } catch { /* 非 JSON 行跳过；原件在存证 */ }
    }
  }
  buffer += decoder.decode();                               // 深入②：最终冲刷
}
```

> **引经据典**｜hermes-agent `agent/chat_completion_helpers.py`
> 工业级解析器面对更凶的现实：个别 provider 发 `event: error` 且 data 是
> **非 JSON 文本**；此外还有 stale 流断路器（连续 5 次无进展即放弃）与
> TTFB/idle/墙钟三重超时。我们的三面墙是它们的前传，解法同源：
> **逐行信任边界 + 容错跳过 + 状态外置**。

**为什么 yield 事件而不是字符串**：调用方只管"发生了什么"——壳要分色渲染、
存证要全量落盘、第 3 章循环还要收 tool 分片。一份事件流多个观察者，
是全书可观测性的地基。

> **引经据典**｜pi `packages/agent/src/types.ts`
> pi 把流式输出定义成 12 种事件契约（text/thinking/toolcall 各 start/delta/end），
> 铁律原话："request/model/runtime failures should be encoded in the returned
> stream, not thrown"——失败也是事件。我们的两事件是它的最小版。

测试钉死三面墙（**1 字节一块都能过才算对**）：

```ts
function chunked(raw: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(raw);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
      c.close();
    },
  });
}

test("SSE：1 字节/块下中文、行界、CRLF、注释帧全兼容", async () => {
  const raw = ': keepalive 1/2\r\n\r\n'
    + 'data: {"choices":[{"delta":{"content":"你"}}]}\r\n\r\n'
    + 'data: {"choices":[{"delta":{"content":"好"}}]}\r\n\r\n'
    + 'data: {"choices":[{"finish_reason":"stop","delta":{}}]}\r\n\r\n'
    + "data: [DONE]\r\n\r\n";
  const events = [];
  for await (const ev of sseEvents(chunked(raw, 1))) events.push(ev);
  assert.deepEqual(events, [
    { type: "text-delta", delta: "你" },
    { type: "text-delta", delta: "好" },
    { type: "done", finishReason: "stop" },
  ]);
});
```

client 装流式接口（`OpenAIClient` 类内追加，并把 `LLMClient` 接口立起来）：

```ts
// ⚠️ 拼装指令：下面骨架只为展示 stream 方法体——把 async *stream 整个方法
// 【并入】你已有的 OpenAIClient 类内（complete 之后），接口放类外。
// 整块直接粘贴会得到第二个同名类（Duplicate identifier——真机验证踩坑）
export interface LLMClient {
  stream(req: ChatRequest): AsyncIterable<StreamEvent>;
}

export class OpenAIClient implements LLMClient {
  /* complete 同前 */
  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model, messages: req.messages,
        temperature: req.temperature, stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const text = res.body ? await res.text() : "no body";
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    yield* sseEvents(res.body);
  }
}
```

`LLMClient` 现在就抽出来的原因：第 3 章循环只认接口不认类——换引擎、套存证、
注故障都是外面再包一层，大脑一行不改。

## 2.4 v0.3：多轮对话聊天壳

**多轮的本质**：引擎无状态（第 1 章②——每次请求都是独立的一次 prefill+decode，
引擎不记得你）。所谓记忆，是**我们**把历史全量重发。壳的全部工作：
攒 messages、发请求、渲染、把回答也攒进 messages。

`apps/cli/package.json`：

```json
{
  "name": "@my-agent/cli", "type": "module", "version": "0.1.0",
  "scripts": { "build": "tsc", "test": "node --test \"dist/**/*.test.js\"" },
  "dependencies": { "@my-agent/core": "workspace:*", "zod": "^4.5.4" },
  // zod 不能省：第 3 章起壳侧工具（weather.ts）直接用它声明 schema——
  // workspace 链接不透传依赖（缺它 cli 编译报 Cannot find module，真机踩坑）
  "devDependencies": { "typescript": "^5.9.0", "@types/node": "^24.0.0" }
}
```

`apps/cli/tsconfig.json`：同上结构（extends + 重声明 outDir/rootDir）

`apps/cli/src/main.ts`（v0.3 全量）：

```ts
import { createInterface } from "node:readline";
import { OpenAIClient, type ChatMessage } from "@my-agent/core";

const client = new OpenAIClient(
  "http://127.0.0.1:8081/v1",
  process.env.TAGENT_MODEL ?? "D:/LLM/models/<文件名>.gguf",
);

// system 提示词从这里就要有：真机实证无 system 时 4B 会拒绝调工具甚至编造
// （temperature 0 下行为不稳定）——"需要实时数据必须调用工具"是行为锚
const history: ChatMessage[] = [
  { role: "system", content: "你是运行在用户本地终端的助手。可以使用提供的工具获取实时信息或进行计算；需要实时或准确数据的问题必须调用工具，不要编造。" },
];
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt("你> ");
rl.prompt();

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text || text === "/exit") { rl.close(); return; }
  history.push({ role: "user", content: text });
  process.stdout.write("ai> ");
  let full = "";
  try {
    for await (const ev of client.stream({ messages: history, temperature: 0 })) {
      if (ev.type === "text-delta") {
        process.stdout.write(ev.delta);      // 打字机——流式的意义
        full += ev.delta;
      }
    }
  } catch (err) {
    process.stdout.write(`\n✖ ${(err as Error).message}\n`);
  }
  history.push({ role: "assistant", content: full });
  process.stdout.write("\n\n");
  rl.prompt();
});
```

```powershell
# 根目录
pnpm install && pnpm build
node apps/cli/dist/main.js
你> 我叫小明
ai> 你好小明！
你> 我叫什么？              ← 它"记得"：因为你全量重发了，且第二问的 cache_n
ai> 你叫小明。                 覆盖了第一问前缀（第 1 章③的观测习惯回本了）
```

### 收尾一步：core 的导出入口 index.ts

壳 `import ... from "@my-agent/core"` 的一切都从这里出（配合 package.json 的
main 字段）。此后每章给 core 加新导出，都要回这里登记：

```ts
// packages/core/src/index.ts（v0.3 版，全量）
export type { ChatMessage } from "./types.js";
export { OpenAIClient, sseEvents } from "./client.js";
export type { ChatRequest, LLMClient, StreamEvent } from "./client.js";
```

## 2.5 搞坏实验

- **引擎中途被杀**：`✖ fetch failed`——连接层错误连状态码都没有（第 4 章
  分类重试的依据）
- **baseUrl 忘 /v1**：`HTTP 404: invalid URL path`——路径错≠引擎没起，认脸
- **超长输入**：几万字粘进去，日志 prompt eval 时间暴涨——不是 bug，
  是第二册记性章的存在理由

## 2.6 自测与对照

- [ ] 两节"深入一层"能复述：chunk 与帧是两个粒度（画得出三层示意图）；
      UTF-8 首字节前缀如何声明长度、劈中间会怎样、两个修法各在哪一行
- [ ] 1 字节分片测试绿；能解释事件流优于 yield 字符串
- [ ] 多轮壳跑通且看过第二问 cache_n 变化；能说出"记忆=重发"的本质
- [ ] 三种报错认脸

**与 tagent 对照**：你的 client.ts ≈ tagent 同名文件前半（多出
usage/timings 提取、思考双认、AbortSignal——第二册逐章装上）。
下一章：把工具说明书发给模型——并第一次钻进 chat template 内部。
