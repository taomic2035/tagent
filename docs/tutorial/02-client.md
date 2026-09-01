# 第 2 章 工具底座：手写 HTTP 与 SSE 客户端

> 本章目标：搭起 monorepo 骨架，用**零依赖的 TypeScript** 手写一个 OpenAI 兼容
> 客户端——原生 fetch 发请求、手写 SSE 流式解析，最后套一个命令行聊天壳。
> 你将拥有第一个"本地版命令行 ChatGPT"。预计 1 天，是第一册技术密度最高的一章。

---

## 2.1 装 Node 与 pnpm，建 monorepo

### 安装

- **Node.js**（nodejs.org，选 LTS 版，≥20）：装完验证
  ```powershell
  node -v    # 期望 v20.x 或更高
  npm -v
  ```
- **pnpm**（更快的包管理器，原生懂 monorepo）：
  ```powershell
  npm install -g pnpm
  pnpm -v
  ```
  > Mac 附注：`brew install node pnpm`。后面所有命令两边完全一致——本教程不绑定平台。

### monorepo 骨骨与"为什么分家"

建目录（本书代码总目录建议单独建，如 `D:\code\my-agent`）：

```
my-agent/
├── package.json            # 根：只管脚本，不放依赖
├── pnpm-workspace.yaml     # 声明这是 monorepo
├── tsconfig.base.json      # 共享 TS 编译配置
├── packages/
│   └── core/               # 大脑（零依赖红线：只准 zod）
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
└── apps/
    └── cli/                # 壳
        ├── package.json
        ├── tsconfig.json
        └── src/
```

逐个文件抄（完整可抄清单在章末）：

`pnpm-workspace.yaml`：
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

根 `package.json`（关键片段）：
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

`packages/core/package.json`：
```json
{
  "name": "@my-agent/core",
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "build": "tsc",
    "test": "node --test \"dist/**/*.test.js\""
  },
  "dependencies": { "zod": "^4.5.4" },
  "devDependencies": { "typescript": "^5.9.0", "@types/node": "^24.0.0" }
}
```

**零依赖红线**：core 的 `dependencies` 永远只有 zod（第 3 章用它生成 JSON Schema）。
HTTP 用 Node 内置 fetch，解析全手写。这不是行为艺术——大脑零依赖意味着它可以被
任何壳（CLI/手机/网页）直接带走，第 8 章移动端大作业的底气全在这。

`tsconfig.base.json`（严格模式全开，一次到位）：
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
> `strict` + `noUncheckedIndexedAccess` 会让编译器对"可能为空"的地方斤斤计较。
> 新手会觉得烦——**这是好事**，它替你拦下的每一个错都是真实会发生的错。
> 参考实现曾经因为构建校验写错而静默漏检，教训见纪律 6。

## 2.2 第一个请求：原生 fetch

`packages/core/src/client.ts` 第一版——非流式（先跑通，下一节再上流式）：

```ts
// 类型先行：协议里的消息（OpenAI 规范的最小子集）
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null };

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  stream?: boolean;
}

export class OpenAIClient {
  constructor(private baseUrl: string, private model: string) {}

  async complete(req: ChatRequest): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        temperature: req.temperature,
        stream: req.stream ?? false,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string | null } }>;
    };
    return json.choices[0]?.message?.content ?? "";
  }
}
```

逐段讲：

- **类型即协议**：`ChatMessage` 是 0.3 术语表里 messages 的 TS 化。`content` 在
  assistant 时可为 null（模型可以只发工具调用不说话——第 3 章会见到）
- `fetch` 是 Node 18+ 内置的，**不需要 axios**。`${this.baseUrl}/chat/completions`
  拼出端点；baseUrl 记得带 `/v1`（`http://127.0.0.1:8081/v1`）
- **错误信封思想第一次出场**（后面整章反复用）：HTTP 非 2xx 时我们**不静默**，
  把状态码+响应体前 200 字装进异常抛出。看第 1 章实验 2 的报错——就是这行代码
  让它以人话形态出现在你面前
- `json.choices[0]?.message?.content ?? ""`：链上每一步都可能空，`?.` 和 `??`
  是 strict 模式下的标准防身术

先写**测试**（纪律 4——用 Node 内置 test runner，零测试框架）：

`packages/core/src/client.test.ts`：
```ts
import test from "node:test";
import assert from "node:assert/strict";

test("非 2xx 抛错且带响应体摘要", async () => {
  // 依赖注入的最小形态：fetch 行为可替换（正式的 fetchImpl 注入点见章末完整版）
  const fakeFetch = async () =>
    new Response(JSON.stringify({ error: "boom" }), { status: 500 });
  const client = new OpenAIClient("http://mock", "m");
  // @ts-expect-error 测试专用注入
  (client as any)["fetchImpl"] = fakeFetch;
  await assert.rejects(client.complete({ messages: [] }), /LLM HTTP 500: .*boom/);
});
```

跑：
```powershell
cd packages/core
pnpm build
pnpm test
# 期望：pass 1  fail 0
```

## 2.3 手写 SSE 流式解析（全书核心一课）

### 为什么模型是"一个字一个字"吐的

生成式模型逐 token 产出，服务端不等全部生成完就边产边发——传输格式就是 SSE
（0.3 术语表）。流式的好处：首字延迟从"全部生成完"缩到"第一个 token"，
还能边收边渲染。

### 先看原始字节（别怕，很短）

第 1 章的请求加 `"stream": true`，用 curl 存一份原文：

```powershell
curl -s -N http://127.0.0.1:8081/v1/chat/completions `
  -H "Content-Type: application/json" `
  -d '{ "model": "D:/LLM/models/<文件名>.gguf", "messages": [{"role":"user","content":"数到三"}], "temperature": 0, "stream": true }' `
  -o stream-raw.txt
```

打开 `stream-raw.txt`，你会看到（真实样例，逐帧对齐过）：

```
data: {"choices":[{"delta":{"role":"assistant"}}]}

data: {"choices":[{"delta":{"content":"1"}}]}

data: {"choices":[{"delta":{"content":"，"}}]}

data: {"choices":[{"finish_reason":"stop","delta":{}}]}

data: [DONE]

```

SSE 规范要点（对着原文看）：

1. 每帧一行，以 `data: ` 前缀开头（冒号后有个**空格**）
2. **帧与帧之间用一个空行分隔**（`\n\n`）——这是帧边界，解析的锚点
3. `delta` 是增量：本帧新到的那一小段文本。全部 delta 拼起来才是完整回答
4. 最后一帧 `data: [DONE]` 是哨兵：流结束（OpenAI 扩展，非 SSE 标准）
5. 以 `:` 开头的行是**注释帧**（llama.cpp 用它发 keepalive 心跳），要跳过

### 手写解析器

现在把它写成代码——`packages/core/src/client.ts` 里加（完整版见章末）：

```ts
export type StreamEvent =
  | { type: "text-delta"; delta: string }        // 正文增量
  | { type: "done"; finishReason: "stop" | "length" };  // 流结束

/** 把 SSE 字节流解析成事件流（AsyncGenerator） */
export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";                 // 行缓冲：网络分片不保证按行到达
  let finishReason: "stop" | "length" = "stop";

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {       // 凑齐一行才处理
      const line = buffer.slice(0, nl).replace(/\r$/, "");  // 兼容 CRLF
      buffer = buffer.slice(nl + 1);

      if (line.startsWith(":")) continue;            // 注释帧（keepalive）
      if (!line.startsWith("data:")) continue;       // 空行等
      const payload = line.slice(5).trim();          // 去掉 "data:"（含空格）
      if (payload === "[DONE]") {                    // 哨兵
        yield { type: "done", finishReason };
        return;
      }
      // JSON 帧解析（容错：非 JSON 行跳过，不崩）
      try {
        const obj = JSON.parse(payload) as {
          choices?: Array<{
            delta?: { content?: unknown };
            finish_reason?: unknown;
          }>;
        };
        const choice = obj.choices?.[0];
        const content = choice?.delta?.content;
        if (typeof content === "string" && content !== "") {
          yield { type: "text-delta", delta: content };
        }
        const fr = choice?.finish_reason;
        if (fr === "stop" || fr === "length") finishReason = fr;
      } catch {
        // 非 JSON 行（如错误页），跳过但原始报文仍在存证里
      }
    }
  }
  buffer += decoder.decode();   // 冲刷：UTF-8 多字节字符可能跨分片被截断
}
```

**逐段讲清楚四个难点**（新手卡点全部在此）：

1. **为什么要 buffer（行缓冲）**：网络按"块"到达，一块里可能有半行、
   一行半、三行。只有凑到 `\n` 才是一行完整的帧。`indexOf("\n")` 循环就是把
   已到的完整行全部消化掉，剩下的半行留在 buffer 里等下一块
2. **`\r$ 兼容**：Windows 系服务可能发 CRLF（`\r\n`）行尾，剥掉 `\r` 防止
   JSON.parse 悲剧
3. **`decode(chunk, { stream: true })` 与最后的 `decode()`**：一个中文字在
   UTF-8 里是 3 个字节，可能恰好被网络分片劈成两半——`stream: true` 告诉
   decoder"后面还有字节，别急着报乱码"，流结束再无参冲刷一次。**忘了这个，
   中文场景偶发乱码，极难排查**（真实踩坑）
4. **不抛异常的 catch**：流里混进非 JSON 行（代理错误页、引擎警告）时跳过继续。
   原始字节在第 1 章的存证里永远查得到，解析器的责任是"尽量往前走"

### 给 client 装上流式接口

`OpenAIClient` 加方法（fetch 注入点这次写正式版）：

```ts
export interface LLMClient {
  stream(req: ChatRequest): AsyncIterable<StreamEvent>;
}

export class OpenAIClient implements LLMClient {
  private fetchImpl: typeof fetch = fetch;   // 注入点：测试替换为 mock

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

**为什么要 `LLMClient` 接口**：第 3 章的 agent 循环只依赖这个接口，不依赖
`OpenAIClient` 类。将来换引擎、套存证记录器、注故障，都是外面再包一层——
大脑一行不改。这就是 0.2 说的依赖注入，两行代码的版本。

### SSE 的测试（不依赖真引擎）

`client.test.ts` 追加：

```ts
test("SSE 解析：分片/注释帧/CRLF/[DONE] 全兼容", async () => {
  const raw =
    ': keepalive 1/2\r\n\r\ndata: {"choices":[{"delta":{"content":"你"}}]}\r\n\r\n' +
    'data: {"choices":[{"delta":{"content":"好"}}]}\r\n\r\n' +
    'data: {"choices":[{"finish_reason":"stop","delta":{}}]}\r\n\r\ndata: [DONE]\r\n\r\n';
  // 故意把字节切成奇怪的分片（1 字节一段），验证行缓冲与 UTF-8 冲刷
  const bytes = new TextEncoder().encode(raw);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 7) {
        c.enqueue(bytes.slice(i, i + 7));   // 7 字节一块：必劈开中文与换行
      }
      c.close();
    },
  });
  const events = [];
  for await (const ev of sseEvents(stream)) events.push(ev);
  assert.deepEqual(events, [
    { type: "text-delta", delta: "你" },
    { type: "text-delta", delta: "好" },
    { type: "done", finishReason: "stop" },
  ]);
});
```

把 `i += 7` 改成 `i += 1` 再跑一遍——**每个字节单独一块都能过**，你的解析器
才算真的对。这就是纪律 4 的意义：测试定义行为。

## 2.4 命令行聊天壳

三件套的第三件来了。`apps/cli/src/main.ts`（壳只做三件事：读输入、调大脑、渲染）：

```ts
import { createInterface } from "node:readline";
import { OpenAIClient } from "@my-agent/core";

const MODEL = process.env.TAGENT_MODEL ?? "D:/LLM/models/<文件名>.gguf";
const client = new OpenAIClient("http://127.0.0.1:8081/v1", MODEL);

const history: Array<{ role: "user" | "assistant"; content: string }> = [];
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt("你> ");
rl.prompt();

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) return rl.prompt();
  history.push({ role: "user", content: text });

  process.stdout.write("ai> ");
  let full = "";
  // 历史带上下文重发——这就是"多轮对话"的全部秘密：没有魔法，只有重发
  for await (const ev of client.stream({ messages: history, temperature: 0 })) {
    if (ev.type === "text-delta") {
      process.stdout.write(ev.delta);      // 边收边打印（流式的意义）
      full += ev.delta;
    }
  }
  history.push({ role: "assistant", content: full });
  process.stdout.write("\n\n");
  rl.prompt();
});
```

`apps/cli/package.json` 的依赖里加 `"@my-agent/core": "workspace:*"`，
根目录跑：

```powershell
pnpm install
pnpm build
node apps/cli/dist/main.js
```

和它聊几句（"我叫小明"→"我叫什么？"）。**你刚拥有了第一个本地聊天程序**，
而且你看得见它的每一行。

## 2.5 故意搞坏

**实验 1：引擎中途被杀**。聊到一半回引擎终端 Ctrl-C 杀掉，再发一句：

```
✖ LLM HTTP -1: fetch failed（或 fetch failed，取决于 Node 版本）
```
连接层错误和 HTTP 错误不同：连状态码都没有。第 4 章会教"连接失败值得重试一次，
4xx 不值得"——现在先认识它。

**实验 2：baseUrl 忘了 /v1**。把 baseUrl 改成 `http://127.0.0.1:8081`：
```
✖ LLM HTTP 404: {"error":{"code":404,"message":"invalid URL path"}}
```
404 = 路径错，不是引擎没起（对比第 1 章实验 1 的 connection refused）。

**实验 3：超长输入**。粘一段几万字的文本发过去——观察引擎终端的
`prompt eval` 日志变慢。CPU 处理 prompt 的速度约 60-90 token/秒，
几万字要等很久。这不是 bug，是第 5 章（上下文管理）存在的理由。

## 2.6 本章完整可抄清单

本章结束时代码结构（每处与讲解一致的完整文件）：

```
packages/core/src/
├── client.ts        # ChatMessage / ChatRequest / StreamEvent / sseEvents / LLMClient / OpenAIClient（流式版）
├── client.test.ts   # HTTP 错误信封测试 + SSE 分片测试
└── index.ts         # export 上述全部
apps/cli/src/
└── main.ts          # 聊天壳（本节代码即全部）
```

与参考实现的对照：tagent 的 `packages/core/src/client.ts` 是本章代码的完全体
（多了 usage 提取、timings 回退、AbortSignal——分别在第 4/5/6 章逐步加上）。

## 2.7 自测清单

- [ ] 能画出 monorepo 结构图，说出 core 零依赖红线的理由
- [ ] 能解释：行缓冲为什么必须有、`decode()` 最后冲刷解决什么问题、
      `data: [DONE]` 与 `: keepalive` 各怎么处理
- [ ] SSE 测试里分片改成 1 字节一段依然全绿
- [ ] 聊天壳能多轮对话，且你知道"多轮"的本质是**历史重发**
- [ ] 三个搞坏实验都做过，能区分 connection refused / 404 / HTTP 500 三种错
- [ ] 能说出 LLMClient 接口存在的意义（第 3 章 agent 循环只认它）

下一章是全书高潮：给模型装上工具，写出那二十几行的 agent 循环——
从此它不再只是聊天，它开始干活。
