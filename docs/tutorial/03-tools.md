# 第 3 章 会用工具：v0.4 最小 agent 循环

> 全书高潮。动手线：协议原文 → 最笨的循环跑通"北京天气" → 撞四面墙 →
> 循环终态 + 剧本化测试。原理线两节"深入一层"回答两个绝大多数教程从不回答的
> 问题：**chat template 到底把 tools 渲染成了什么文本**、
> **tool_calls 在模型眼里根本不是结构化数据**。读完你会知道 `--jinja`、
> arguments-是-字符串、流式分片这三件事其实是同一件事。预计 1-2 天。

---

## 3.1 协议原文：模型怎么"举手"

请求加 `tools` 字段（工具的**说明书**，JSON Schema 写的）：

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
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  }],
  "temperature": 0
}
```

响应（真实原文）：

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
        "function": { "name": "get_weather", "arguments": "{\"city\":\"北京\"}" }
      }]
    }
  }]
}
```

三件事同时发生：`finish_reason: "tool_calls"`（分叉信号：stop=说完 /
tool_calls=要干活 / length=被截断）；`content: null`（也可能与文本并存）；
**`arguments` 是 JSON 字符串不是对象**——第一面墙，原理在 3.3 讲透。

下一轮 messages 三段回填（tool 消息带 `tool_call_id` 指回举手）：

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

带着结果再问，模型才给出"北京 28 度晴"。**循环的全部真相**：
"请求→举手→执行→回填→再请求"放进 while，直到 finish_reason 不是 tool_calls。

## 深入一层 ①：chat template 把你的 JSON 渲染成了什么

第 1 章⑥留的问号。引擎收到你的 messages+tools 后，**先渲染成一段纯文本**
（模型只吃文本——第 1 章①：token 是原子，结构化字段是给程序看的）。
渲染者是 chat template（GGUF 内置的 Jinja2 模板，`--jinja` 启用）。Qwen 系
把 tools 渲染进 system 末尾，形态大致是（节选自真实渲染产物）：

```
<|im_start|>system
你是 tagent 助手。

# Tools

你可以调用以下工具：

{"type": "function", "function": {"name": "get_weather",
 "description": "查询指定城市的实时天气…", "parameters": {…}}}

调用工具时，请使用以下格式：

<tool_call>
{"name": "函数名", "arguments": {参数 JSON 对象}}
</tool_call><|im_end|>
<|im_start|>user
北京今天多少度？<|im_end|>
<|im_start|>assistant
```

看清三件事：

1. **说明书不是协议魔法**：tools 数组被模板**序列化成文本**贴进上下文——
   模型"知道有哪些工具"，靠的是读这段字（所以 4B 会把说明书念歪、把工具名
   拼错——它就是在"背课文"）
2. **调用格式是文本约定**：`<tool_call>…</tool_call>` 这个格式是模型在训练时
   学会的"输出习惯"，模板在 system 里再提醒一遍
3. **`--jinja` 生死的解释**：不开模板渲染，tools 就根本没进上下文——
   模型看不见说明书，自然永远只会 `<|im_end|>` 收尾（finish_reason 恒 stop）

## 深入一层 ②：tool_calls 的文本本质——引擎在替你"后处理"

那响应里的结构化 `tool_calls` 字段哪来的？**引擎的流式后处理器**：
模型在 decode 阶段逐 token 生成文本；当它开始吐 `<tool_call>` 时，引擎实时
识别这个标记段，**把段内的 JSON 解析出来、转成结构化 delta 再发给 HTTP 客户端**：

```
模型实际生成的文本流：          引擎后处理发给你的 SSE：
<tool_call>                    {"delta":{"tool_calls":[{"index":0,
{"name": "get_weather",          "id":"call_abc","function":{"name":"get_weather",
 "arguments": {"city": "北       "arguments":""}}]}}
                                             ↓（后续 token 逐个累积）
京"}}                           {"delta":{"tool_calls":[{"index":0,
</tool_call>                     "function":{"arguments":"{\"ci"}}]}}
```

这一层同时解释了三件"怪事"（**四面墙的前两面，现在从原理推出来**）：

- **arguments 为什么是字符串**：那就是模型逐 token 吐出的**原文片段拼接**，
  引擎没有（也不能）替它补全 JSON——参数是不是合法 JSON，取决于模型生成
  完整与否（max_tokens 掐断时就是半截，第 4 章的现场）
- **为什么流式分片**：模型本来就是一个 token 一个 token 吐的（第 1 章②），
  结构化只是外衣
- **id 从哪来**：引擎生成（它要靠 id 把后处理产物和原文配对），不是模型
  "想"出来的

由此得出本章最重要的世界观：**协议里的结构化字段是引擎对模型文本行为的
郑重承诺；模型本人只承诺文本**。agent 的一切兜底（第 4 章）与一切校验
（受限解码，第二册）都建立在这个认识上。

## 3.2 工具注册表：zod 一行，说明书自动生成

```powershell
cd packages/core && pnpm add zod
```

先做一次**类型迁移**（真机验证发现的必要步骤）：`ChatMessage` 从 client.ts
**迁到** types.ts 并扩展 tool 消息；client.ts 删除本地定义、改为
`import type { ChatMessage } from "./types.js"; export type { ChatMessage };`
（保持旧引用不断）。

`packages/core/src/types.ts`（本章终态，全量）：

```ts
import type { z } from "zod";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCallData[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolCallData {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface Tool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<unknown>;
}
```

`packages/core/src/tools.ts`（v0.4 裸奔版全量——第 4 章封壳的教材）：

```ts
import { z } from "zod";
import type { Tool, ToolDef } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) throw new Error(`duplicate tool name: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  schemas(): ToolDef[] {
    return [...this.tools.values()].map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: z.toJSONSchema(t.schema),   // zod → JSON Schema：说明书与实现永不失同步
      },
    }));
  }

  async execute(name: string, argsJson: string): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return JSON.stringify({ ok: false, error: `unknown tool: ${name}（可用: ${this.names().join(", ")}）` });
    const parsed = tool.schema.safeParse(JSON.parse(argsJson));   // ← 墙1 的裸奔点
    if (!parsed.success) return JSON.stringify({ ok: false, error: "参数校验失败" });
    return JSON.stringify({ ok: true, data: await tool.execute(parsed.data) });
  }

  private names(): string[] { return [...this.tools.keys()]; }
}
```

**zod → `z.toJSONSchema`**：参数规则声明一次，自动生成说明书——手写 schema
必然失同步，"说明书骗人"是 agent 慢性毒药。**safeParse**：模型参数是不可信
输入，校验失败不能炸循环（第 4 章制度化的种子）。

> **引经据典**｜pi `packages/agent/src/types.ts`（AgentTool）
> pi 用 TypeBox 干同一件事，且规定"工具失败必须抛异常，框架转错误结果"；
> 我们相反——信封恒不抛。哲学相反、殊途同归：**错误必须以结构化形态到达模型**。

第一个工具 `apps/cli/src/weather.ts`（模拟数据，教学不需要真 API）：

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
  execute: async (args) => {
    const hit = DB[args.city];
    if (!hit) return { error: `无 ${args.city} 的数据（支持：${Object.keys(DB).join("/")}）` };
    return { city: args.city, ...hit };
  },
};
```

`.describe()` 与 description 都是**写给模型看的 prompt**——写得越明确
（包括"其他城市无数据"），模型越少乱猜。

## 3.3 循环第一版与四面墙

v0.4 目标拆小：先假设模型规规矩矩。第一版循环（`loop.ts` naive）+ client
追加 tool 分片事件（完整 diff 见下方"终态"里已含）后跑通：

```powershell
你> 北京今天多少度？
北京今天 28 度，晴。
```

**没人告诉它调工具**——是模型读了模板渲染的说明书、理解意图、自己举的手。
你写的循环把"模型的意图"变成"被执行的动作"。现在撞墙（每面都真实）：

**墙 1：arguments 是字符串。** 模型被 max_tokens 掐断或抽风时给半截 JSON：
`JSON.parse('{"city":"北')` → `SyntaxError: Unexpected end of JSON input`，
整轮对话炸给用户。原理已讲（3.1②）：那是原文拼接。v0.4 先在 execute 里
包 try（与 schema 校验并列），第 4 章制度化成四段外壳。

**墙 2：调用是流式分片的。** 抓真实报文：

```
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_X","function":{"name":"get_weather","arguments":""}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"ci"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ty\":\"北京\"}"}}]}}]}
```

第一帧带 id/name（arguments 空），后几帧只带增量。naive 的
"有 id 就新建调用"会把增量全丢。**修法——槽位（slot）**：

```ts
const slots = new Map<number, { id?: string; name?: string; args: string }>();
// 收到分片：
const slot = slots.get(ev.index) ?? { args: "" };
if (ev.id) slot.id = ev.id;          // 有则记之
if (ev.name) slot.name = ev.name;
if (ev.argsDelta) slot.args += ev.argsDelta;   // 增量则拼之
slots.set(ev.index, slot);
```

**为什么 Map 不用数组**：index 是模型给的槽位号，帧可乱序、可稀疏——数组
按下标写会踩空，Map 按键存天然容忍。

**墙 3：一帧可能举手好几次。** "北京和上海哪边热？"4B 可能一帧双调
（index 0 和 1 各自累积）。执行与回填必须**按 index 排序**——Map 迭代序
不保证，而顺序是协议的一部分（模型给的顺序）：

```ts
const toolCalls = [...slots.entries()].sort(([a], [b]) => a - b).map(([i, s]) => ({
  id: s.id ?? `slot_${i}`,             // 引擎必须给 id；缺失时合成保配对
  type: "function" as const,
  function: { name: s.name ?? "", arguments: s.args },
}));
```

> **引经据典**｜pi `packages/agent/src/agent-loop.ts`
> 同款场景 pi 默认**并行执行**（Promise.all）、**结果按源顺序回填**——
> 原话 "results are filled back in the assistant's original order"。v0.4 先串行，
> 第二册并行章原样继承"源序"纪律。

**墙 4：配对不拆（亲手造一个 400）。** 实验：把 messages 里 assistant 的
tool_calls 删掉、只留 tool 消息（模拟"裁剪拆散"），发请求：

```
{"error":{"code":400,"message":"Invalid message: tool message without preceding tool_calls"}}
```

协议硬性要求 tool 消息紧跟带对应 id 的 assistant(tool_calls)。由此立全书
核心不变量：

> **配对不拆**：assistant(tool_calls) 与其 tool 结果在 messages 里永远成对、
> 顺序固定——第二册裁剪、压缩、重放全部服务于此。
> **先入档**：assistant 轮在执行工具**之前**入 messages。模型说过的话、举过的
> 手已经发生——messages 是唯一事实来源，事实先记录。

## 深入一层 ③：finish_reason 到底谁说了算

三值的来源各不相同（引擎停止条件的三种触发）：

| 值 | 触发 | 机制 |
|---|---|---|
| `stop` | 模型生成 **EOS token**（`<|im_end|>`） | 第 1 章⑥：模板约定了结束符，模型"学会了"说完了就吐它 |
| `tool_calls` | 后处理器检测到**工具段闭合**（`</tool_call>`） | 3.1② 的后处理在此顺手置位 |
| `length` | 生成 token 数达到 **max_tokens** 上限 | 硬预算闸——注意预算是**思考+正文+参数共享的池**（第二册思考实验的数据来源：1251 token 里 1224 是思考） |

`length` 是唯一"非自愿"的停止——所以第 4 章对它的态度是"判错重发"而不是
当终答：**协议说被截断，就不要猜内容完整性**。

## 3.4 v0.4 终态：runAgent 全量（含事件流）

```ts
// packages/core/src/loop.ts —— v0.4 终态全量
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

    let text = "";
    let finishReason: "stop" | "tool_calls" | "length" = "stop";
    const slots = new Map<number, { id?: string; name?: string; args: string }>();

    for await (const ev of deps.client.stream({
      messages,
      tools: deps.registry.schemas(),
    })) {
      if (ev.type === "text-delta") { text += ev.delta; yield ev; }
      else if (ev.type === "tool-call-delta") {
        const slot = slots.get(ev.index) ?? { args: "" };
        if (ev.id) slot.id = ev.id;
        if (ev.name) slot.name = ev.name;
        if (ev.argsDelta) slot.args += ev.argsDelta;
        slots.set(ev.index, slot);
      } else finishReason = ev.finishReason;
    }

    // 先入档（不变量）
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

    if (finishReason !== "tool_calls" || toolCalls.length === 0) {
      yield { type: "final", message: assistant, rounds: round };
      return;
    }

    // 源序执行 + 配对回填（不变量）
    for (const tc of toolCalls) {
      yield { type: "tool-call", id: tc.id, name: tc.function.name, args: tc.function.arguments };
      const result = await deps.registry.execute(tc.function.name, tc.function.arguments);
      yield { type: "tool-result", id: tc.id, name: tc.function.name, result };
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }
  // 轮数用尽 = 用户拿空气 → 第 4 章 v0.7 的教材
}
```

client.ts 的三处扩展（ChatRequest / StreamEvent / sseEvents——注意 cast 类型
也要带 tool_calls 字段，否则编译不过）：

```ts
export type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call-delta"; index: number; id?: string; name?: string; argsDelta?: string }
  | { type: "done"; finishReason: "stop" | "tool_calls" | "length" };

// sseEvents 的 try 块内，content 处理后追加：
const tcs = choice?.delta?.tool_calls;
if (Array.isArray(tcs)) {
  for (const raw of tcs) {
    if (typeof raw !== "object" || raw === null) continue;
    const t = raw as { index?: unknown; id?: unknown;
      function?: { name?: unknown; arguments?: unknown } };
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
// finish_reason 判定加 "tool_calls"（三值联合：变量声明与判定同步改）；
// sseEvents 的 cast 类型加 tool_calls?: unknown
```

**还有一处极易静默漏掉的（真机端到端抓到的坑）**：ChatRequest 加
`tools?: ToolDef[]` 字段之后，`stream` 方法的请求体序列化里必须真实插入
`tools: req.tools,` 这一行（`messages: req.messages,` 之后）。漏掉它
**编译绿、测试绿、但 tools 根本不进请求**——模型收不到说明书，4B 实测
直接编造天气数据（编得有零有整还有假图片 URL）。改完在引擎日志或请求
存证里亲眼确认 tools 在场——编译通过不算数。

壳的 v0.4 装配（`apps/cli/src/main.ts` **全量替换**——registry 组装 + 终答回填
历史；第 4 章起 weather 要包 withFaults，届时只改 register 那一行）：

```ts
import { createInterface } from "node:readline";
import { OpenAIClient, runAgent, ToolRegistry, type ChatMessage } from "@my-agent/core";
import { weatherTool } from "./weather.js";

const client = new OpenAIClient(
  "http://127.0.0.1:8081/v1",
  process.env.TAGENT_MODEL ?? "D:/LLM/models/<文件名>.gguf",
);
const registry = new ToolRegistry();
registry.register(weatherTool);

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
  let finalText = "";
  for await (const ev of runAgent({ client, registry, maxIterations: 8 }, history)) {
    if (ev.type === "text-delta") process.stdout.write(ev.delta);
    else if (ev.type === "tool-call") process.stdout.write(`\n⚙ ${ev.name} ${ev.args}`);
    else if (ev.type === "tool-result") process.stdout.write(`\n  ↳ ${ev.result.slice(0, 120)}`);
    else if (ev.type === "final" && ev.message.role === "assistant") {
      finalText = ev.message.content ?? "";      // 终答回填历史（多轮要用）
    }
  }
  history.push({ role: "assistant", content: finalText });
  process.stdout.write("\n\n");
  rl.prompt();
});
```

index.ts 登记本章新导出（追加）：

```ts
export { ToolRegistry } from "./tools.js";
export { runAgent } from "./loop.js";
export type { Tool, ToolDef, ToolCallData } from "./types.js";
```

多步任务的现场（决策链）：

```
你> 北京和上海哪边热？差几度？
⚙ get_weather {"city":"北京"}
  ↳ {"ok":true,"data":{"city":"北京","tempC":28,"condition":"晴"}}
⚙ get_weather {"city":"上海"}
  ↳ {"ok":true,"data":{"city":"上海","tempC":31,"condition":"多云"}}
上海更热，比北京高 3 度。
```

注意：**拿到北京结果后才决定查上海**——每步决策基于上一步真实结果。
（"想一步做一步"，即 ReAct 范式，第二册正式讲。）

## 3.5 测试：剧本化，不赌真模型

真模型行为有偶然性，循环逻辑必须离开引擎可测——**剧本化 client**：

```ts
// loop.test.ts 核心（全量见 tagent 对照）
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

test("单工具：分片累积→执行→配对回填→二轮收工", async () => {
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
  /* 断言：messages 角色序列 [user, assistant, tool, assistant]；
     tool 消息 tool_call_id === "id-1" 且 content 含 hello —— 两条不变量的机器版 */
});
```

**剧本耗尽即抛**防"循环多转一轮但测试看起来过了"。

## 3.6 搞坏实验

- **问火星**：`⚙ get_weather {"city":"火星"}` →
  `↳ {"error":"无 火星 的数据（支持：北京/上海/广州）}` → 模型如实转告。
  把工具改成返回 `ok:true` 却没数据，对比模型行为——**工具的失败语义直接
  决定 agent 的诚实度**（第 4/5 章的核心议题，先埋种子）
- **maxIterations=1** 问两城市对比：调完北京就停、无终答——亲手确认
  "轮数用尽=空气"，v0.7 要修的洞
- **关 --jinja 重启引擎**再问任何工具任务：finish_reason 恒 stop、模型把
  说明书当不存在——3.1① 的原理亲手复现

## 3.7 自测与对照

- [ ] 能默写模板渲染后的形态（tools 序列化进 system、`<tool_call>` 文本约定），
      并用它解释 --jinja 生死、arguments-是-字符串、分片三件事
- [ ] 能讲 finish_reason 三值的触发机制（EOS/工具段闭合/预算闸）与
      "length 唯一非自愿"的推论
- [ ] 四面墙各有现场；slots 为什么 Map、为什么排序能答
- [ ] 两条不变量能默写且知道墙 4 的 400 是亲手造出来的
- [ ] 剧本化测试通过、火星两版工具的模型行为差异观察过

**与 tagent 对照**：你的 loop.ts 是骨架（它多守卫/steering/并行/压缩/取消——
第二册各章装）；tools.ts 是裸奔版，下一章穿甲。
