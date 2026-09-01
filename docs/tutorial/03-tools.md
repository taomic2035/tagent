# 第 3 章 会用工具：v0.4 最小 agent 循环

> 全书高潮。模型第一次**自己决定**调用工具。我们先看协议原文，写最笨的版本
> 跑通"北京天气"，然后撞四面墙——每面墙都是真实协议行为，撞完你就明白
> tool_calls 字段到底替你做了什么、藏了什么。预计 1-2 天。

---

## 3.1 先看协议：模型怎么"举手"

把第 1 章的请求加 `tools` 字段（说明书），发给引擎：

```json
{
  "model": "D:/LLM/models/<文件名>.gguf",
  "messages": [{ "role": "user", "content": "北京今天多少度？" }],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "查询指定城市的实时天气（支持：北京/上海/广州）",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string", "description": "城市名，如：北京" } },
        "required": ["city"]
      }
    }
  }],
  "temperature": 0
}
```

响应（真实原文，逐字段盯五分钟）：

```json
{
  "choices": [{
    "finish_reason": "tool_calls",
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"city\":\"北京\"}"
        }
      }]
    }
  }]
}
```

三件大事同时发生：

1. **`finish_reason: "tool_calls"`**——模型不回答，举手说"我要调工具"。
   这就是循环的分叉信号（stop=说完 / tool_calls=要干活 / length=被截断）
2. **`content: null`**——它这轮一句话没说，光举手。也可能既说话又举手
   （content 和 tool_calls 并存），后面会见到
3. **`arguments` 是 JSON 字符串，不是对象**——`"{\"city\":\"北京\"}"`。
   模型逐 token 生成的是**文本**，引擎原样放进字符串字段。这是四面墙的第一面，
   也是无数新手第一次崩溃的地方

下一轮请求的 messages 要变成三段（把工具结果喂回去）：

```json
[
  { "role": "user", "content": "北京今天多少度？" },
  { "role": "assistant", "content": null,
    "tool_calls": [{ "id": "call_abc123", "type": "function",
      "function": { "name": "get_weather", "arguments": "{\"city\":\"北京\"}" } }] },
  { "role": "tool", "tool_call_id": "call_abc123",
    "content": "{\"tempC\":28,\"condition\":\"晴\"}" }
]
```

role 为 `tool` 的消息是工具结果，`tool_call_id` 指回那次举手。带着结果再问，
模型才给出"北京 28 度晴"。

**循环的全部真相**：把"请求→举手→执行→回填→再请求"放进 while，
直到 finish_reason 不再是 tool_calls。没了。

## 3.2 工具注册表：zod 一行，说明书自动生成

模型看不懂你的函数，只看得懂**说明书**（JSON Schema）。每个工具两副面孔：
给模型看的 schema、给你执行的函数。用 zod 写在一处：

```powershell
cd packages/core && pnpm add zod
```

`packages/core/src/types.ts`（本章新增类型的全量）：

```ts
import type { z } from "zod";

// assistant 消息扩展出 tool_calls；新增 tool 消息（协议见 3.1）
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCallData[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolCallData {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// 工具的协议形态（给模型看的）
export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

// 工具的完整定义（给我们用的）
export interface Tool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<unknown>;
}
```

`packages/core/src/tools.ts`（v0.4 全量——**故意裸奔**，第 4 章封成安全壳）：

```ts
import { z } from "zod";
import type { Tool, ToolDef } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) throw new Error(`duplicate tool name: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  /** 全部工具的协议形态——直接塞进请求的 tools 字段 */
  schemas(): ToolDef[] {
    return [...this.tools.values()].map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: z.toJSONSchema(t.schema),   // zod → JSON Schema，永不失同步
      },
    }));
  }

  /** 执行一次调用（v0.4 裸奔版：任何意外直接炸——第 4 章的教材） */
  async execute(name: string, argsJson: string): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return JSON.stringify({ ok: false, error: `unknown tool: ${name}` });
    const parsed = tool.schema.safeParse(JSON.parse(argsJson));
    if (!parsed.success) return JSON.stringify({ ok: false, error: "参数校验失败" });
    return JSON.stringify({ ok: true, data: await tool.execute(parsed.data) });
  }
}
```

三个决定，各有讲究：

- **zod → `z.toJSONSchema` 自动转换**：参数规则声明一次，说明书与实现物理性
  同步。手写 schema 必然失同步，"说明书骗人"是 agent 的慢性毒药
- **`safeParse` 而非 `parse`**：模型给的参数是**不可信外部输入**（纪律），
  校验失败不该炸循环——注意这里已经悄悄埋了第 4 章的种子
- **返回 JSON 字符串**：结果终将进 messages（协议要求字符串），统一出口

> **引经据典**｜pi `packages/agent/src/types.ts`（AgentTool）
> pi 用 TypeBox 做同一件事（schema 即说明书），并且让工具声明
> `executionMode: "sequential" | "parallel"`——我们第 7 章会做到同款。
> 另一个对照值得现在记：pi 规定"工具失败**必须抛异常**，由框架转成错误结果"；
> 我们相反——工具返回信封、恒不抛。哲学相反，殊途同归：**错误必须以某种
> 结构化形态到达模型**，谁来做只是分工不同。

第一个真工具 `apps/cli/src/weather.ts`（教学用模拟数据，不调真 API）：

```ts
import { z } from "zod";
import type { Tool } from "@my-agent/core";

const DB: Record<string, { tempC: number; condition: string }> = {
  北京: { tempC: 28, condition: "晴" },
  上海: { tempC: 31, condition: "多云" },
  广州: { tempC: 33, condition: "雷阵雨" },
};

export const weatherTool: Tool<z.ZodObject<{ city: z.ZodString }>> = {
  name: "get_weather",
  description: "查询指定城市的实时天气（支持：北京/上海/广州；其他城市无数据）",
  schema: z.object({ city: z.string().describe("城市名，如：北京") }),
  execute: async (args) => ({ city: args.city, ...DB[args.city] }),
};
```

`.describe()` 的文字直接进 schema 的 description——**那是写给模型看的 prompt**，
写得越明确（包括"其他城市无数据"），模型越少乱猜。

## 3.3 循环第一版：先跑通最简单的情形

**v0.4 的目标拆小**：先假设模型规规矩矩——一次举手一个工具、参数完整、
说完就收工。这个前提下循环很短（`packages/core/src/loop.ts` v0.4-naive）：

```ts
import type { ChatMessage, LLMClient, StreamEvent } from "./client.js";
import type { ToolRegistry } from "./tools.js";

export async function runAgent(
  deps: { client: LLMClient; registry: ToolRegistry; maxIterations: number },
  messages: ChatMessage[],
): Promise<void> {
  for (let round = 1; round <= deps.maxIterations; round++) {
    // 1. 请求（带上工具说明书）
    let text = "";
    let finishReason: "stop" | "tool_calls" | "length" = "stop";
    let call: { id: string; name: string; args: string } | null = null;

    for await (const ev of deps.client.stream({
      messages,
      tools: deps.registry.schemas(),       // ← 说明书在这里
    })) {
      if (ev.type === "text-delta") text += ev.delta;
      else if (ev.type === "tool-call-delta") {
        // 先假设分片一次到齐（这行代码是墙2的现场，稍后撞）
        if (ev.id) call = { id: ev.id, name: ev.name ?? "", args: ev.argsDelta ?? "" };
      }
      else finishReason = ev.finishReason;
    }

    // 2. assistant 轮入档（messages 是唯一事实来源——先记录，后行动）
    messages.push({
      role: "assistant",
      content: text === "" ? null : text,
      ...(call ? { tool_calls: [{ id: call.id, type: "function" as const,
        function: { name: call.name, arguments: call.args } }] } : {}),
    });

    // 3. 出口判定
    if (finishReason !== "tool_calls" || !call) return;   // 收工

    // 4. 执行 + 回填
    const result = await deps.registry.execute(call.name, call.args);
    messages.push({ role: "tool", tool_call_id: call.id, content: result });
  }
}
```

等等——`ev.type === "tool-call-delta"`？我们的 `StreamEvent` 还没有这个类型。
先给 client 加上（`sseEvents` 的 JSON 帧解析里追加一段，全量 diff）：

```ts
// client.ts 的 StreamEvent 联合类型追加：
export type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call-delta"; index: number; id?: string; name?: string; argsDelta?: string }
  | { type: "done"; finishReason: "stop" | "tool_calls" | "length" };

// sseEvents 的帧解析 try 块里，content 处理之后追加：
const toolCalls = choice?.delta?.tool_calls;
if (Array.isArray(toolCalls)) {
  for (const tc of toolCalls) {
    if (typeof tc !== "object" || tc === null) continue;
    const t = tc as {
      index?: unknown; id?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    yield {
      type: "tool-call-delta",
      index: typeof t.index === "number" ? t.index : 0,
      ...(typeof t.id === "string" ? { id: t.id } : {}),
      ...(typeof t.function?.name === "string" && t.function.name !== ""
        ? { name: t.function.name } : {}),
      ...(typeof t.function?.arguments === "string" && t.function.arguments !== ""
        ? { argsDelta: t.function.arguments } : {}),
    };
  }
}
// finish_reason 判定追加 "tool_calls"：
if (choice?.finish_reason === "stop" || choice?.finish_reason === "tool_calls"
    || choice?.finish_reason === "length") finishReason = choice.finish_reason;
```

壳接上（`apps/cli/src/main.ts` 的 rl.on("line") 里改造，全量）：

```ts
import { runAgent, ToolRegistry, type ChatMessage, OpenAIClient } from "@my-agent/core";
import { weatherTool } from "./weather.js";

const registry = new ToolRegistry();
registry.register(weatherTool);

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text || text === "/exit") { rl.close(); return; }
  history.push({ role: "user", content: text });
  process.stdout.write("ai> ");
  await runAgent({ client: registry2(), registry, maxIterations: 8 }, history);
  process.stdout.write("\n\n");
  rl.prompt();
});
```

（`registry2` 顺手改掉——直接传 `client` 变量即可，这里强调装配关系。）

跑：

```powershell
pnpm build
node apps/cli/dist/main.js
你> 北京今天多少度？
北京今天 28 度，晴。
```

**没人告诉它调工具**——是模型读了说明书、理解意图、自己举的手。
你写的循环把"模型的意图"变成了"被执行的动作"。

现在，撞墙时间。**四面墙全部真实存在**，naive 版在每一面都会死。

## 3.4 墙 1：arguments 是字符串

naive 版侥幸没死（4B 这次给了完整合法的 arguments 字符串）。现在亲手让它死：
在 registry.execute 里我们已经 `JSON.parse(argsJson)` 了——如果模型吐的是
半截 JSON 呢？（"参数还没生成完就被 max_tokens 掐断"的真实形态，第 6 章常见）

```
✖ SyntaxError: Unexpected end of JSON input
```

整轮对话炸给用户看。**根因**：`JSON.parse` 面对模型生成的文本（不可信输入）
毫无防御。**修法分两层**：本章先在 execute 里把 parse 包进安全段（与 schema
校验并列为"确定性失败"）；第 4 章把它制度化成四段安全外壳。先记下现场。

## 3.5 墙 2：工具调用也是流式分片的

抓一次真实报文（第 1 章的存证方法），看 tool_calls 的流式形态：

```
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_X","function":{"name":"get_weather","arguments":""}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"ci"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ty\":\"北京\"}"}}]}}]}
```

**一次调用拆成多帧**：第一帧带 id 和 name（arguments 为空），后几帧只带
arguments 增量。naive 版的 `if (ev.id) call = {...}` 会把第一帧之后的所有
增量**全部丢掉**——你只会拿到一个空 arguments 的调用，然后在墙 1 炸得更惨。

**修法**：和文本一样累积——按 `index` 建槽位（slot），id/name/args 各自
"有则记之，增量则拼之"：

```ts
const slots = new Map<number, { id?: string; name?: string; args: string }>();
// ...
} else if (ev.type === "tool-call-delta") {
  const slot = slots.get(ev.index) ?? { args: "" };
  if (ev.id) slot.id = ev.id;
  if (ev.name) slot.name = ev.name;
  if (ev.argsDelta) slot.args += ev.argsDelta;
  slots.set(ev.index, slot);
}
```

**为什么用 Map 而不是数组**：index 是模型给的槽位号，帧可能乱序到达、
可能稀疏（先到 index 1 再到 index 0——下一面墙的现场）。数组按下标写会踩空，
Map 按键存天然容忍。

## 3.6 墙 3：一帧可能举手好几次

问"北京和上海哪边热？"——4B 可能老实分两轮调，也可能**一帧同时举两只手**：

```
data: {"choices":[{"delta":{"tool_calls":[
  {"index":0,"id":"call_A","function":{"name":"get_weather","arguments":"{\"city\":\"北京\"}"}},
  {"index":1,"id":"call_B","function":{"name":"get_weather","arguments":"{\"city\":\"上海\"}"}}
]}}]}
```

`index` 就是干这个的：槽位 0 和 1 各自独立累积。循环执行段改成遍历槽位、
**按 index 排序**（Map 迭代序不保证，执行与回填的顺序必须是模型给的顺序）：

```ts
const toolCalls = [...slots.entries()].sort(([a], [b]) => a - b).map(([i, s]) => ({
  id: s.id ?? `slot_${i}`,           // 引擎必须给 id；缺失时合成保配对
  type: "function" as const,
  function: { name: s.name ?? "", arguments: s.args },
}));
```

> **引经据典**｜pi `packages/agent/src/agent-loop.ts`
> pi 对同一帧多调用默认**并行执行**（`Promise.all`）、结果**按源顺序回填**——
> 原话："results are filled back in the assistant's original order"。
> 我们 v0.4 先串行（简单正确），第 7 章升级并行时，"源序回填"这条纪律
> 原样继承——顺序是协议的一部分，不是实现细节。

## 3.7 墙 4：配对不拆（亲手造一个 400）

最隐蔽的一面墙。做实验：把 messages 里 assistant 的 tool_calls 删掉、
只留 tool 消息（模拟"裁剪时不小心拆散"），发请求：

```
{"error":{"code":400,"message":"Invalid message: tool message without preceding tool_calls"}}
```

**根因**：协议硬性要求每个 role:tool 消息必须紧跟在带对应 tool_call_id 的
assistant(tool_calls) 之后。**由此推出全书最重要的不变量**：

> **不变量（配对不拆）**：assistant(tool_calls) 与它的 tool 结果，在 messages 里
> 永远成对出现、顺序固定。裁剪成块、压缩、重放，都不能拆散这对。

它不是理论——第 5 章的裁剪以"完整轮次"为单位、第 7 章事件按源序回填、
第 9 章存证重放，全部是这条不变量的应用。**顺手再立一条**：

> **不变量（先入档）**：assistant 轮在执行工具**之前**就 push 进 messages。
> 不管后面执行成败，模型说过的话、举过的手已经发生——messages 是唯一事实来源，
> 事实先记录。

## 3.8 v0.4 完整版：runAgent 终态 + 事件流

四面墙修完，循环定稿。同时把"返回 void"升级成**事件流**（AsyncGenerator）——
壳要渲染过程、存证要落盘、将来验收要断言，一份流三个消费者：

`packages/core/src/loop.ts`（v0.4 终态，全量）：

```ts
import type { ChatMessage, LLMClient } from "./client.js";
import type { ToolRegistry } from "./tools.js";

export type AgentEvent =
  | { type: "round-start"; round: number }
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; id: string; name: string; args: string }
  | { type: "tool-result"; id: string; name: string; result: string }
  | { type: "final"; message: ChatMessage; rounds: number };

export async function* runAgent(
  deps: { client: LLMClient; registry: ToolRegistry; maxIterations: number },
  messages: ChatMessage[],
): AsyncGenerator<AgentEvent> {
  for (let round = 1; round <= deps.maxIterations; round++) {
    yield { type: "round-start", round };

    // ---- 第一拍：请求 + 累积（墙2/墙3 的槽位法）----
    let text = "";
    let finishReason: "stop" | "tool_calls" | "length" = "stop";
    const slots = new Map<number, { id?: string; name?: string; args: string }>();

    for await (const ev of deps.client.stream({
      messages,
      tools: deps.registry.schemas(),
    })) {
      if (ev.type === "text-delta") {
        text += ev.delta;
        yield ev;                                   // 透传给壳渲染
      } else if (ev.type === "tool-call-delta") {
        const slot = slots.get(ev.index) ?? { args: "" };
        if (ev.id) slot.id = ev.id;
        if (ev.name) slot.name = ev.name;
        if (ev.argsDelta) slot.args += ev.argsDelta;
        slots.set(ev.index, slot);
      } else {
        finishReason = ev.finishReason;
      }
    }

    // ---- 第二拍：入档（不变量：先入档）----
    const ordered = [...slots.entries()].sort(([a], [b]) => a - b);
    const toolCalls = ordered.map(([i, s]) => ({
      id: s.id ?? `slot_${i}`,
      type: "function" as const,
      function: { name: s.name ?? "", arguments: s.args },
    }));
    const assistant: ChatMessage = {
      role: "assistant",
      content: text === "" ? null : text,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    };
    messages.push(assistant);

    // ---- 第三拍：出口 ----
    if (finishReason !== "tool_calls" || toolCalls.length === 0) {
      yield { type: "final", message: assistant, rounds: round };
      return;
    }

    // ---- 第四拍：执行 + 回填（墙3 的源序；墙1 的防御在 registry）----
    for (const tc of toolCalls) {
      yield { type: "tool-call", id: tc.id, name: tc.function.name, args: tc.function.arguments };
      const result = await deps.registry.execute(tc.function.name, tc.function.arguments);
      yield { type: "tool-result", id: tc.id, name: tc.function.name, result };
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
    // 回到第一拍：带着结果再问
  }
  // 轮数用尽：v0.4 到此为止，用户拿到空气——第 4 章 v0.7 的教材（触顶降级）
}
```

壳渲染事件（`main.ts` 的循环调用处，全量替换）：

```ts
import { runAgent, ToolRegistry, type AgentEvent } from "@my-agent/core";

process.stdout.write("ai> ");
for await (const ev of runAgent({ client, registry, maxIterations: 8 }, history)) {
  if (ev.type === "text-delta") process.stdout.write(ev.delta);
  else if (ev.type === "tool-call") process.stdout.write(`\n⚙ ${ev.name} ${ev.args}`);
  else if (ev.type === "tool-result") process.stdout.write(`\n  ↳ ${ev.result.slice(0, 120)}`);
}
process.stdout.write("\n\n");
rl.prompt();
```

跑多步任务（决策链的现场）：

```
你> 北京和上海哪边热？差几度？
⚙ get_weather {"city":"北京"}
  ↳ {"ok":true,"data":{"city":"北京","tempC":28,"condition":"晴"}}
⚙ get_weather {"city":"上海"}
  ↳ {"ok":true,"data":{"city":"上海","tempC":31,"condition":"多云"}}
上海更热，比北京高 3 度。
```

注意它**拿到北京结果后才决定查上海**——每步决策基于上一步真实结果。
（这个"想一步做一步"的范式叫 ReAct，第 7 章正式讲。）

## 3.9 测试：剧本化，不赌真模型

真模型行为不定（temperature 0 也有偶然性），循环逻辑必须离开引擎可测。
手法：**剧本化 client**——每次 stream() 弹出剧本的下一轮事件：

`packages/core/src/loop.test.ts`（全量）：

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { runAgent, type AgentEvent } from "./loop.js";
import { ToolRegistry } from "./tools.js";
import { OpenAIClient, type LLMClient, type StreamEvent } from "./client.js";
import type { ChatMessage, Tool } from "./types.js";

function scriptedClient(script: StreamEvent[][]): LLMClient & { calls: number } {
  let call = 0;
  return {
    get calls() { return call; },
    async *stream() {
      const round = script[call++];
      if (!round) throw new Error(`剧本耗尽：第 ${call} 次请求无剧本`);  // 防静默通过
      for (const ev of round) yield ev;
    },
  };
}

const echo: Tool<z.ZodObject<{ text: z.ZodString }>> = {
  name: "echo", description: "回显",
  schema: z.object({ text: z.string() }),
  execute: async (a) => ({ echoed: a.text }),
};

const cfg = { maxIterations: 4 };

test("直接回答：一轮结束，事件链完整", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "hi" }];
  const client = scriptedClient([
    [{ type: "text-delta", delta: "你好" }, { type: "done", finishReason: "stop" }],
  ]);
  const events: AgentEvent[] = [];
  for await (const ev of runAgent({ client, registry: reg(echo), ...cfg }, messages)) events.push(ev);
  assert.deepEqual(messages.map((m) => m.role), ["user", "assistant"]);  // 事实入档
  assert.equal(events.at(-1)?.type, "final");
});

test("单工具：分片累积（墙2）→ 执行 → 回填 → 二轮收工", async () => {
  const messages: ChatMessage[] = [{ role: "user", content: "echo 一下" }];
  const client = scriptedClient([
    [
      { type: "tool-call-delta", index: 0, id: "id-1", name: "echo", argsDelta: "" },
      { type: "tool-call-delta", index: 0, argsDelta: '{"text":"he' },   // 分片！
      { type: "tool-call-delta", index: 0, argsDelta: 'llo"}' },
      { type: "done", finishReason: "tool_calls" },
    ],
    [{ type: "text-delta", delta: "已回显" }, { type: "done", finishReason: "stop" }],
  ]);
  const reg = new ToolRegistry(); reg.register(echo);
  for await (const _ of runAgent({ client, registry: reg, ...cfg }, messages)) { /* 收集 */ }
  // 配对完整（墙4）：tool 消息紧跟 assistant(tool_calls) 且 id 相等
  assert.deepEqual(messages.map((m) => m.role), ["user", "assistant", "tool", "assistant"]);
  const toolMsg = messages[2];
  assert.equal(toolMsg?.role === "tool" && toolMsg.tool_call_id, "id-1");
  assert.ok(toolMsg?.role === "tool" && toolMsg.content.includes("hello"));
});

function reg(tool: Tool): ToolRegistry {
  const r = new ToolRegistry(); r.register(tool); return r;
}
```

**剧本耗尽即抛**是关键设计：循环多请求一轮，测试立刻红——防"看起来过了"。

## 3.10 搞坏实验

- **问火星**（库外城市）：`你> 火星天气如何？`
  ```
  ⚙ get_weather {"city":"火星"}
    ↳ {"ok":true,"data":{"city":"火星"}}        ← 注意！data 展开是 undefined
  ```
  模型拿到残缺数据，大概率如实说"查不到"。**但我们的模拟工具把无数据处理得
  太含糊了**（ok:true 却没数据）——对比改 DB 查不到时返回
  `{ok:false, error:"无火星数据（支持：北京/上海/广州）"}`，观察模型行为变化。
  工具的失败语义直接影响 agent 的诚实度——第 4 章的核心议题，先埋种子
- **maxIterations 设 1** 再问两城市对比：第一轮调完北京就停，无最终回答——
  亲手确认"轮数用尽=用户拿空气"，v0.7 要修的洞

## 3.11 自测与对照

**自测**：
- [ ] 四面墙都能讲"现场→根因→修法"；能解释 slots 为什么是 Map、为什么排序
- [ ] 两条不变量（配对不拆 / 先入档）能默写，且知道墙 4 是亲手造 400 造出来的
- [ ] 剧本化测试跑通；能解释"剧本耗尽即抛"防的是什么
- [ ] 火星实验两个版本的差异观察过

**与 tagent 对照**：你的 loop.ts ≈ tagent 的骨架（它多了守卫/steering/并行/
压缩触发/取消——第二册各章逐件装上）。你的 tools.ts 是裸奔版，下一章穿甲。

下一章：墙 1 的崩溃还欠着债——我们把工具层封成打不死的壳，再给循环上保险丝。
