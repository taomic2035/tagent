# 第 2 章 会说话：v0.1 请求 → v0.2 流式 → v0.3 聊天壳

> agent 长出第一批本事：v0.1 发一个请求拿到回答；v0.2 手写 SSE 解析（要撞
> 三面墙，每面墙都是真实分片网络会坑你的地方）；v0.3 多轮对话命令行壳。
> 预计 1 天。本章代码全部给全量，**每段结束项目都能跑**。

---

## 2.1 项目骨架（一次性搭好，全书沿用）

装环境并验证：

```powershell
node -v      # ≥20（nodejs.org LTS 版）
npm install -g pnpm && pnpm -v
```
> Mac：`brew install node pnpm`。之后所有命令两平台一致。

建目录（建议 `D:\code\my-agent`，全书代码总目录）：

```
my-agent/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/core/          # 大脑（零依赖红线：只准 zod）
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
└── apps/cli/               # 壳
    ├── package.json
    ├── tsconfig.json
    └── src/
```

**为什么 monorepo、为什么分家**：大脑要被多种壳复用（第 8 章手机壳直接带走
packages/core），所以物理隔离。大脑**零依赖**（HTTP 用 Node 内置 fetch、解析
全手写、唯一例外 zod 在第 3 章讲清）——这不是行为艺术，是"一份大脑到处跑"
的前提，第 8 章兑现。

五个配置文件全量（一个字不用改）：

`pnpm-workspace.yaml`：
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
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

`tsconfig.base.json`（严格模式全开——编译器对"可能为空"斤斤计较是在帮你）：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "declaration": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

`packages/core/package.json`：
```json
{
  "name": "@my-agent/core",
  "type": "module",
  "version": "0.1.0",
  "scripts": { "build": "tsc", "test": "node --test \"dist/**/*.test.js\"" },
  "devDependencies": { "typescript": "^5.9.0", "@types/node": "^24.0.0" }
}
```

`packages/core/tsconfig.json`：
```json
{ "extends": "../../tsconfig.base.json" }
```

（`apps/cli` 的两个配置后面 v0.3 再建，内容几乎相同，届时给全量。）

## 2.2 v0.1：第一个请求（非流式）

**目标**：`node` 一跑，打印模型回答。先不管流式——**一次只长一个本事**。

类型与协议对齐（0.3 术语表的 TS 化）。`packages/core/src/client.ts`：

```ts
// ---- 协议类型（OpenAI Chat Completions 的最小子集）----
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null };

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
}

export class OpenAIClient {
  private fetchImpl: typeof fetch = fetch;   // 注入点：测试时替换，不发真网络

  async complete(req: ChatRequest): Promise<string> {
    const res = await this.fetchImpl(
      (globalThis as { __llmUrl?: string }).__llmUrl ?? "http://127.0.0.1:8081/v1",
      // ↑ 临时方案！v0.3 会改成构造函数参数——先让 v0.1 最小可跑
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: (globalThis as { __llmModel?: string }).__llmModel ?? "",
          messages: req.messages,
          temperature: req.temperature,
        }),
      },
    );
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

逐段讲：

- **错误信封思想第一次出场**（第 4 章整章展开）：HTTP 非 2xx 不静默，
  状态码+响应体前 200 字装进异常。第 1 章实验 2 的报错以人话形态出现靠的就是这两行
- `?.` 与 `??`：strict 模式下 `choices` 可能没来、`message` 可能没 content，
  链式取值每步防身
- `fetchImpl` 字段：**现在就留**。v0.1 还不用，但测试（2.2 末尾）马上要——
  依赖注入的最小形态，第 3 章循环也靠它剧本化测试

入口 `packages/core/src/main.ts`（临时，v0.3 删除）：

```ts
import { OpenAIClient } from "./client.js";

(globalThis as { __llmModel?: string }).__llmModel =
  process.env.TAGENT_MODEL ?? "D:/LLM/models/<你的模型文件名>.gguf";

const reply = await new OpenAIClient().complete({
  messages: [{ role: "user", content: "用一句话介绍你自己" }],
  temperature: 0,
});
console.log(reply);
```

跑：

```powershell
cd packages/core
pnpm build
node dist/main.js
# 我是一个可以协助你完成各种任务的语言模型……（约 3-5 秒后一次性打印）
```

**v0.1 完成**。看着不起眼——但注意它已经做对了三件事：协议类型化、错误不静默、
fetch 可注入。跑通后做第一件正事——**给错误路径写测试**（纪律 4）：

`packages/core/src/client.test.ts`：

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIClient } from "./client.js";

test("非 2xx：抛错且带状态码与响应体摘要", async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ error: "boom" }), { status: 500 });
  const client = new OpenAIClient();
  (client as unknown as Record<string, unknown>)["fetchImpl"] = fakeFetch;
  await assert.rejects(client.complete({ messages: [] }), /LLM HTTP 500: .*boom/);
});

test("choices 空缺：返回空串不崩", async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({}), { status: 200 });
  const client = new OpenAIClient();
  (client as unknown as Record<string, unknown>)["fetchImpl"] = fakeFetch;
  assert.equal(await client.complete({ messages: [] }), "");
});
```

```powershell
pnpm build && pnpm test
# ▶ 2 tests：2 pass
```

不赌真引擎就能验证错误行为——**这个手法（注入 fake fetch + 断言异常）全书沿用**。

## 2.3 v0.2：流式与 SSE——从最笨的版本开始撞墙

**目标**：模型一个字一个字往外吐，边收边打印。先看协议原文，再写"显然会错"
的第一版，然后撞墙。

### 先看原始字节

第 1 章请求加 `"stream": true`（curl 加 `-N` 禁缓冲）：

```powershell
curl -s -N http://127.0.0.1:8081/v1/chat/completions `
  -H "Content-Type: application/json" `
  -d '{ "model": "D:/LLM/models/<文件名>.gguf", "messages": [{"role":"user","content":"数到三"}], "temperature": 0, "stream": true }' `
  -o stream-raw.txt
type stream-raw.txt
```

```
data: {"choices":[{"delta":{"role":"assistant"}}]}

data: {"choices":[{"delta":{"content":"1"}}]}

data: {"choices":[{"delta":{"content":"，"}}]}

data: {"choices":[{"finish_reason":"stop","delta":{}}]}

data: [DONE]

```

对着原文记住 SSE 四件事（第 2 版解析器的规格）：

1. 每帧一行，`data: ` 前缀（冒号后**有空格**），**空行（`\n\n`）是帧边界**
2. `delta` 是增量，全部 delta 拼起来才是完整回答
3. `data: [DONE]` 哨兵 = 流结束
4. `:` 开头的行是注释帧（llama.cpp 拿它发 keepalive 心跳），要跳过

### 第一版（最笨）：每块直接按行拆

新手直觉写法——网络给一块，我就把这块按 `\n` 拆了处理：

```ts
// ❌ 第一版：错的，但值得亲手跑一次
export async function* sseEventsV1(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  for await (const chunk of body) {
    for (const line of decoder.decode(chunk).split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      const obj = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
      const c = obj.choices?.[0]?.delta?.content;
      if (c) yield c;
    }
  }
}
```

本地跑——**居然大多时候是通的**（本地连接块大，恰好整行到达）。这就是它危险
的地方：**错误只在真实网络条件下间歇出现**。我们主动复现：

```ts
// 把同一份字节按 7 字节一块重放——模拟恶劣分片
const raw = 'data: {"choices":[{"delta":{"content":"北"}}]}\n\n';
const enc = new TextEncoder();
const stream = new ReadableStream({
  start(c) {
    const bytes = enc.encode(raw);
    for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
    c.close();
  },
});
```

### 墙 1：网络分片会把一行劈成两半

7 字节一块时，第一版输出（亲手跑）：

```
data: {"c                                    ← 前半行，JSON.parse 抛异常
hoices":[{...
```

```
SyntaxError: Unexpected token 'c', ..."ata: {\"c"... is not valid JSON
```

**根因**：HTTP 流的 chunk（传输块）和 SSE 的 frame（帧）是**两个粒度**。
一个 chunk 可能是半行、一行半、三行。你唯一能信任的边界是字节流里的 `\n`。
**修法——行缓冲**：凑齐一行才处理，半行攒着等下一块：

```ts
let buffer = "";
for await (const chunk of body) {
  buffer += decoder.decode(chunk, { stream: true });
  let nl: number;
  while ((nl = buffer.indexOf("\n")) >= 0) {     // 只处理凑齐的行
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);               // 剩下的半行留在 buffer
    handleLine(line);
  }
}
```

注意 `decode(chunk, { stream: true })`——这个参数是下一面墙的伏笔，先照抄。

### 墙 2：中文被劈成乱码

行缓冲修好后，再跑一个中文场景的恶劣分片（1 字节一块最狠）。你会在某个
随机位置看到 `�`（替换字符）或异常字节——

**根因**：一个中文字在 UTF-8 里是 **3 个字节**，网络分片可能恰好从它中间劈开。
劈开的前 2 字节单看不是合法字符——`TextDecoder` 默认会把它当损坏数据处理。
**修法**：`decode(chunk, { stream: true })` 告诉 decoder"后面还有字节，拼不上
的先攒着"；流结束后再无参调一次 `decode()` 把残留冲刷出来：

```ts
buffer += decoder.decode(chunk, { stream: true });   // 跨块多字节安全
// ...循环...
buffer += decoder.decode();                           // 流结束：冲刷残留
```

忘了最终那次冲刷，流的最后半个字符永远留在 decoder 肚子里——
**中文场景偶发丢字，极难排查**（真机踩坑实录，先记脸）。

### 墙 3：CRLF、注释帧、非 JSON 行

前两面墙是"分块"教的，第三面是"真实世界"教的：

- **CRLF**：部分服务/代理发 `\r\n` 行尾——`\r` 留在行尾会让 `JSON.parse` 悲剧。
  修：`line.replace(/\r$/, "")`
- **注释帧**：llama.cpp 空闲时发 `: keepalive 1/2` 心跳。`:` 开头，跳过即可——
  但**如果你忘了跳过，它不匹配 `data:` 前缀，会自然落空**。真正要小心的是别把
  注释帧算进帧序号（第 9 章溯源要数帧）
- **非 JSON 行**：代理错误页、网关横幅可能混进流里。JSON.parse 包 try/catch
  跳过——原始字节在存证里永远查得到，解析器的责任是尽量往前走

### 第二版（正确版）：`sseEvents` 全量代码

`packages/core/src/client.ts` 顶部加入（类型 + 实现，完整）：

```ts
export type StreamEvent =
  | { type: "text-delta"; delta: string }                 // 正文增量
  | { type: "done"; finishReason: "stop" | "length" };    // 流结束

export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finishReason: "stop" | "length" = "stop";

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });        // 墙2：多字节安全
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {                // 墙1：行缓冲
      const line = buffer.slice(0, nl).replace(/\r$/, "");    // 墙3：剥 \r
      buffer = buffer.slice(nl + 1);

      if (line.startsWith(":")) continue;                     // 墙3：注释帧
      if (!line.startsWith("data:")) continue;                // 空行等
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {                             // 哨兵
        yield { type: "done", finishReason };
        return;
      }
      try {                                                    // 墙3：非 JSON 容错
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
      } catch {
        // 非 JSON 行跳过；原件在存证里
      }
    }
  }
  buffer += decoder.decode();                                 // 墙2：最终冲刷
}
```

**为什么 yield 的是事件（`{type:"text-delta"}`）而不是字符串**：调用方只管
"发生了什么"（事件流），不管"怎么显示"——第 3 章循环要在 text-delta 之外
再收 tool 分片，壳要分色渲染，存证要全量落盘。**一份事件流，多个观察者**，
这是全书可观测性的地基。

> **引经据典**｜pi `packages/agent/src/types.ts` 的流事件契约
> pi 把流式输出定义成 12 种事件的契约（text/thinking/toolcall 各自
> start/delta/end…），并立了一条铁律原文："request/model/runtime failures
> should be encoded in the returned stream, not thrown"（失败编码进流，不抛异常）。
> 我们的事件流是它的最小版——第 4 章你会看到"失败也是事件"的深意。

> **引经据典**｜hermes-agent `agent/chat_completion_helpers.py`
> 工业级的 SSE 解析器要处理更凶的现实：个别 provider 会发 `event: error`
> 且 data 是**非 JSON 文本**；还有 stale 流断路器（连续 5 次无进展就放弃）、
> TTFB/idle/墙钟三重超时。我们的三面墙是它们的前传——世界比教科书凶，
> 但解法同源：**逐行信任边界 + 容错跳过 + 状态外置**。

### 用测试把三面墙钉死

`packages/core/src/client.test.ts` 追加（**这就是 v0.2 的验收**）：

```ts
import { sseEvents } from "./client.js";

function chunked(raw: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(raw);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
      c.close();
    },
  });
}

test("SSE：恶劣分片（1 字节/块）下中文、行边界、CRLF、注释帧全兼容", async () => {
  const raw =
    ': keepalive 1/2\r\n\r\n' +
    'data: {"choices":[{"delta":{"content":"你"}}]}\r\n\r\n' +
    'data: {"choices":[{"delta":{"content":"好"}}]}\r\n\r\n' +
    'data: {"choices":[{"finish_reason":"stop","delta":{}}]}\r\n\r\n' +
    "data: [DONE]\r\n\r\n";
  const events = [];
  for await (const ev of sseEvents(chunked(raw, 1))) events.push(ev);   // ← 1 字节！
  assert.deepEqual(events, [
    { type: "text-delta", delta: "你" },
    { type: "text-delta", delta: "好" },
    { type: "done", finishReason: "stop" },
  ]);
});
```

`size` 改成 7、13 再各跑一遍。**1 字节一块都能过，你的解析器才算真的对**。

### 给 client 装流式接口

`OpenAIClient` 加方法（全量追加到类里，同时把 v0.1 的临时全局变量改成
构造参数——**偿还技术债的时刻**）：

```ts
export interface LLMClient {
  stream(req: ChatRequest): AsyncIterable<StreamEvent>;
}

export class OpenAIClient implements LLMClient {
  private fetchImpl: typeof fetch = fetch;
  constructor(private baseUrl: string, private model: string) {}

  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        temperature: req.temperature,
        stream: true,
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

`LLMClient` 接口为什么现在就抽出来：第 3 章循环只认接口不认类——将来换引擎、
套存证、注故障都是外面再包一层，大脑一行不改。

## 2.4 v0.3：多轮对话聊天壳

**目标**：`node` 起 REPL，多轮上下文连贯，流式打字机渲染。

先想清"多轮"的本质（第 1 章埋的问题）：**引擎无状态**。它不记得你上一句——
所谓记忆，是**我们**把历史全量重发。所以壳的全部工作：攒 messages、发请求、
收事件渲染、把回答也攒进 messages。

`apps/cli/package.json`（全量）：

```json
{
  "name": "@my-agent/cli",
  "type": "module",
  "version": "0.1.0",
  "scripts": { "build": "tsc", "test": "node --test \"dist/**/*.test.js\"" },
  "dependencies": { "@my-agent/core": "workspace:*" },
  "devDependencies": { "typescript": "^5.9.0", "@types/node": "^24.0.0" }
}
```

`apps/cli/tsconfig.json`：
```json
{ "extends": "../../tsconfig.base.json" }
```

`apps/cli/src/main.ts`（v0.3 全量）：

```ts
import { createInterface } from "node:readline";
import { OpenAIClient, type ChatMessage } from "@my-agent/core";

const MODEL = process.env.TAGENT_MODEL ?? "D:/LLM/models/<你的模型文件名>.gguf";
const client = new OpenAIClient("http://127.0.0.1:8081/v1", MODEL);

const history: ChatMessage[] = [];
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
    // 多轮的秘密：全量历史重发。没有魔法。
    for await (const ev of client.stream({ messages: history, temperature: 0 })) {
      if (ev.type === "text-delta") {
        process.stdout.write(ev.delta);       // 打字机效果：流式的意义
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

根目录：

```powershell
pnpm install
pnpm build
node apps/cli/dist/main.js
你> 我叫小明
ai> 你好小明！……
你> 我叫什么？
ai> 你叫小明。                            ← 它"记得"了——因为你把历史重发了
```

顺手盯一眼引擎日志：第二问的 `cache_n` 应该覆盖了第一问的前缀——
**多轮对话能跑，一半功劳是 KV cache**（第 1.5 节的观测习惯开始回本）。

**v0.3 完成**。它是个合格的本地聊天程序，但还只是聊天机器人——第 3 章让它
第一次自己动手。

## 2.5 搞坏实验

- **引擎中途被杀**：聊到一半杀引擎再发一句 → `✖ LLM HTTP -1: fetch failed`
  或裸 `fetch failed`——连接层错误连状态码都没有（第 4 章分类重试的依据）
- **baseUrl 忘 /v1**：改 `http://127.0.0.1:8081` → `HTTP 404: invalid URL path`。
  404 是路径错，connection refused 是引擎没起——两种错认脸
- **超长输入**：粘几万字 → 引擎日志 prompt eval 时间暴涨。不是 bug，
  是第 5 章存在的理由

## 2.6 本章自测与对照

**自测**：
- [ ] 三面墙各自能讲出"现场→根因→修法"；1 字节分片测试绿
- [ ] 能解释：为什么事件流优于直接 yield 字符串；LLMClient 接口现在就抽的理由
- [ ] 多轮聊天跑通，且看过第二问的 cache_n 变化
- [ ] 三种报错（refused / 404 / fetch failed）认脸

**与 tagent 对照**：你的 `client.ts` ≈ tagent 同名文件的前半（它还多了
usage/timings 提取、思考双认、AbortSignal——分别在第二册第 5/6/7 章装上）。

下一章：把工具说明书发给模型，看它第一次举手。
