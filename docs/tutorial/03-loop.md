# 第 3 章 心跳：最小 agent 循环

> 本章目标：写出全书的中心——agent 主循环。模型第一次**自己决定**调用工具，
> 你的程序执行它、把结果喂回去、拿到最终回答。二十几行循环 + 一个工具注册表。
> 预计 1-2 天。这一章写完，你做的就已经是真 agent 了。

---

## 3.1 协议：模型怎么"举手要工具"

先看一次真实的工具调用往返（原始报文，第 1 章的存证方法抓的）。

**请求**（我们发给引擎的，注意新增的 `tools` 字段）：

```json
{
  "model": "D:/LLM/models/<文件名>.gguf",
  "messages": [{ "role": "user", "content": "北京今天多少度？" }],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "查询指定城市的实时天气",
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

**响应**（模型不直接回答，而是举手）：

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

盯住三件事：

1. `finish_reason` 变成了 **`"tool_calls"`**——"我要调工具"。它就是循环的分叉信号
2. `arguments` 是**JSON 字符串**不是对象（模型逐 token 生成的是文本，拼完才能
   parse——0.3 术语表预告过的坑，第 4 章会见到没拼完的残缺形态）
3. `id: "call_abc123"`——这次调用的唯一编号。**配对不拆纪律**：接下来回填结果
   时必须带着同一个 id，模型才知道哪份结果对应哪次举手

**回填**（我们执行完工具后，下一轮请求的 messages 长这样）：

```json
{ "messages": [
  { "role": "user", "content": "北京今天多少度？" },
  { "role": "assistant", "content": null,
    "tool_calls": [{ "id": "call_abc123", "type": "function",
      "function": { "name": "get_weather", "arguments": "{\"city\":\"北京\"}" } }] },
  { "role": "tool", "tool_call_id": "call_abc123",
    "content": "{\"tempC\": 28, \"condition\": \"晴\"}" },
  ...
] }
```

role 为 `tool` 的消息就是工具结果，`tool_call_id` 指回那次举手。然后模型再生成——
这次它有了数据，`finish_reason: "stop"`，正常作答。

**agent 循环的全部真相**：把上面这轮"请求→举手→执行→回填→再请求"放进 while
循环，直到 `finish_reason` 不再是 `tool_calls`。没有别的了。

## 3.2 工具注册表：zod 一行，说明书自动生成

模型不能调用函数本身——它只能看到**说明书**（name + description + JSON Schema）。
所以每个工具要有两副面孔：给模型看的 schema，给我们执行的函数。

用 zod 把两副面孔写在一处（`packages/core/src/tools.ts`）：

```ts
import { z } from "zod";

// 工具的协议形态（给模型看的）
export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

// 工具的完整定义（给我们用的）
export interface Tool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: T;                        // zod 声明参数
  execute: (args: z.infer<T>) => Promise<unknown>;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) throw new Error(`duplicate tool name: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  /** 全部工具的协议形态（直接塞进请求的 tools 字段） */
  schemas(): ToolDef[] {
    return [...this.tools.values()].map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: z.toJSONSchema(t.schema),   // zod schema → JSON Schema，永不失同步
      },
    }));
  }

  /** 执行一次调用（第 4 章会把它加厚成安全外壳，本章先裸奔） */
  async execute(name: string, argsJson: string): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return JSON.stringify({ ok: false, error: `unknown tool: ${name}` });
    const parsed = tool.schema.safeParse(JSON.parse(argsJson));
    if (!parsed.success) return JSON.stringify({ ok: false, error: "参数校验失败" });
    return JSON.stringify({ ok: true, data: await tool.execute(parsed.data) });
  }
}
```

三个设计决定，每个都有讲究：

- **zod → JSON Schema 自动转换**：参数规则只声明一次。手写 schema 迟早和实现对不上，
  自动生成物理性杜绝"说明书骗人"
- **execute 返回 JSON 字符串**：工具结果终将进 messages（协议要求字符串），统一出口
- **校验用 safeParse 不用 parse**：模型给的参数**是不可信的外部输入**（纪律），
  错了不能抛异常炸掉循环，要变成模型能读懂的错误消息回填——这是第 4 章
  错误信封的雏形

写第一个真工具（`apps/cli/src/builtin-tools/weather.ts`）——**模拟数据**，
教学不需要真 API：

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
  description: "查询指定城市的实时天气（支持：北京/上海/广州）",
  schema: z.object({ city: z.string().describe("城市名，如：北京") }),
  execute: async (args) => ({ city: args.city, ...DB[args.city] }),
};
```

> `.describe()` 的文案会进 JSON Schema 的 description——**写给模型看的 prompt**，
  越明确模型越少猜错。

## 3.3 心跳三拍：runAgent 主循环

`packages/core/src/loop.ts`——全书的心脏，值得逐行读懂：

```ts
import type { ChatMessage, LLMClient } from "./client.js";
import type { ToolRegistry } from "./tools.js";

// assistant 消息在本章扩展出 tool_calls（协议见 3.1）
// 完整类型定义见章末清单（与 2.2 的 ChatMessage 合并）

export async function* runAgent(
  deps: { client: LLMClient; registry: ToolRegistry; maxIterations: number },
  messages: ChatMessage[],
): AsyncGenerator<AgentEvent> {
  for (let round = 1; round <= deps.maxIterations; round++) {
    // ---- 第一拍：请求模型 ----
    let text = "";
    const slots = new Map<number, { id?: string; name?: string; args: string }>();
    let finishReason: "stop" | "tool_calls" | "length" = "stop";

    for await (const ev of deps.client.stream({
      messages,
      tools: deps.registry.schemas(),
    })) {
      if (ev.type === "text-delta") text += ev.delta;
      else if (ev.type === "tool-call-delta") {
        // 工具调用同样流式分片到达：同 index 的 id/name/args 逐段拼
        const slot = slots.get(ev.index) ?? { args: "" };
        if (ev.id) slot.id = ev.id;
        if (ev.name) slot.name = ev.name;
        if (ev.argsDelta) slot.args += ev.argsDelta;
        slots.set(ev.index, slot);
      } else finishReason = ev.finishReason;
    }

    // assistant 轮入档（messages 是唯一事实来源——不管后面发生什么，先记录）
    const toolCalls = [...slots.entries()].sort(([a], [b]) => a - b).map(([i, s]) => ({
      id: s.id ?? `slot_${i}`,
      type: "function" as const,
      function: { name: s.name ?? "", arguments: s.args },
    }));
    messages.push({
      role: "assistant",
      content: text === "" ? null : text,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });

    // ---- 第二拍：出口判定 ----
    if (finishReason !== "tool_calls" || toolCalls.length === 0) {
      return;   // 模型不再要工具 → 对话完成（最终回答就在刚入档的 assistant 里）
    }

    // ---- 第三拍：执行全部工具，结果逐一回填 ----
    for (const tc of toolCalls) {
      const result = await deps.registry.execute(tc.function.name, tc.function.arguments);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
    // 回到第一拍：带着结果再问模型
  }
  // 轮数用尽（第 4 章的"触顶降级"在这里展开）
}
```

读懂后的三个检查题（答案都在注释里）：

1. 为什么 assistant 消息要在执行工具**之前**入档？
   ——messages 是唯一事实来源；且协议要求 tool 消息必须跟在带 tool_calls 的
   assistant 后面（配对不拆）
2. `slots` 为什么要按 index 排序？——一帧里可能有多个工具调用（并行调用），
   index 是模型给的顺序，执行与回填都按它
3. 循环什么时候停？——`finish_reason !== "tool_calls"`（模型自觉收工）或
   轮数用尽（`maxIterations`，防失控的保险丝）

### 事件流：让壳看得见心跳

注意 `runAgent` 是 `AsyncGenerator<AgentEvent>`——循环里每做一件事就 `yield`
一个事件（round-start / text-delta / tool-call / tool-result / final……完整类型见
章末清单）。壳消费事件流做渲染，存证记录器消费同一事件流做归档——
**一份事件流，多个观察者**，这是全书可观测性的地基（第 9 章的验收自动化也在它上面）。

## 3.4 历史性一刻

壳接上循环（`apps/cli/src/main.ts` 改造，完整版章末）：

```powershell
node apps/cli/dist/main.js
你> 北京今天多少度？
⚙ get_weather {"city":"北京"}
  ↳ {"ok":true,"data":{"city":"北京","tempC":28,"condition":"晴"}}
北京今天 28 度，晴。
```

**没人告诉它要调工具**。是模型读了工具说明书、理解了你的意图、自己举的手。
你写的那二十几行循环，把"模型的意图"变成了"被执行的动作"——这就是 agent。

再试多步的（模型会连续调用）：

```
你> 北京和上海哪边热？热多少度？
⚙ get_weather {"city":"北京"}
  ↳ ...28度晴
⚙ get_weather {"city":"上海"}
  ↳ ...31度多云
上海热，比北京高 3 度。
```

注意观察：这次模型先调北京，**拿到结果后**才决定再调上海——每一步的决策都基于
上一步的真实结果。这就是 ReAct（Reason + Act）范式的天然形态，第 7 章再见它。

## 3.5 验收：六个场景

从本章起，每章用固定场景集验收（参考实现的六场景，一直沿用到书末）：

| # | 场景 | 你输入 | 期望行为 |
|---|---|---|---|
| 1 | 单工具 | 查一下北京天气 | 调 get_weather，回答含 28 |
| 2 | 参数正确 | 上海呢？ | city="上海"（不是"上海呢"） |
| 3 | 不滥用工具 | 你好，介绍一下你自己 | **不调工具**，直接回答 |
| 4 | 多工具编排 | 北京上海哪边热？ | 连续两次调用，比较后回答 |
| 5 | 错误自愈 | 火星天气呢？ | 调用失败（库里没火星）→ 如实说查不了，**不编造** |
| 6 | 会话导出 | /dump | 打印完整 messages，检查配对完整 |

场景 3 和场景 5 最有含金量：**知道什么时候不用工具、失败时诚实**，比会调工具
更难。每个场景照第 1 章方法存证（request/response 落盘），这是纪律。

场景 5 你会看到我们的模拟工具返回 `{"ok":false,...}`（库里没有"火星"）——
工具**不抛异常**而是数据化失败，模型读到后如实告知。这个设计决定第 4 章展开。

## 3.6 故意搞坏

**实验 1：模型给了不存在的工具名**。在 registry 里临时改名为别的（或自己伪造一条
assistant 消息带假工具调用推进 messages），执行时走到 `unknown tool` 分支：
```
↳ {"ok":false,"error":"unknown tool: get_wether（可用: get_weather）"}
```
错误消息里带正确工具名——模型下一轮会自己改对。**失败信息是给模型的提示词**。

**实验 2：参数是残缺 JSON**。`execute` 里 `JSON.parse('{"city":"北')` 直接抛：
```
SyntaxError: Unexpected end of JSON input
```
循环炸了！——这就是 execute 还不算"安全外壳"的原因，第 4 章第一件事就是封住它。

**实验 3：maxIterations 设成 1**。问"北京上海哪边热？"——第一轮调完北京就被
迫停机，没有最终回答。亲手体会为什么需要"触顶降级"（下一章）。

## 3.7 本章完整可抄清单

```
packages/core/src/
├── types.ts     # ChatMessage（含 assistant.tool_calls / tool 消息）/ ToolCallData / Tool / ToolDef / AgentConfig
├── client.ts    # + tool-call-delta 事件（sseEvents 里解析 delta.tool_calls 分片）
├── tools.ts     # ToolRegistry（3.2 全文）
├── loop.ts      # runAgent + AgentEvent（3.3 全文 + 各处 yield）
└── loop.test.ts # 剧本化 mock：见下
apps/cli/src/
├── main.ts      # 装配 + 渲染（⚙ 与 ↳ 的输出就来自事件流）
└── builtin-tools/weather.ts
```

**怎么测循环而不赌真模型**——剧本化 mock client（参考实现同款手法，值得学）：

```ts
// scriptedClient：每次 stream() 弹出剧本的下一轮事件；剧本耗尽即抛错（防测试静默通过）
function scriptedClient(script: StreamEvent[][]): LLMClient {
  let call = 0;
  return { async *stream() {
    const round = script[call++];
    if (!round) throw new Error(`剧本耗尽：第 ${call} 次请求无对应剧本`);
    for (const ev of round) yield ev;
  }};
}
// 测试就能精确断言：给"举手→工具→收工"剧本，断言 messages 里配对完整、轮数正确
```

参考实现对照：tagent 的 `loop.ts` 是本章完全体（守卫/steering/并行在第 4-7 章逐层加上）。

## 3.8 自测清单

- [ ] 能对着 3.1 的三段报文讲完整轮往返：tools 说明书 → tool_calls 举手 →
      tool 消息回填 → stop 收工
- [ ] 能解释：arguments 为什么是字符串、tool_call_id 配对纪律、
      assistant 为什么在执行前入档、slots 按 index 排序的原因
- [ ] 六场景全过且各有存证；场景 3（不滥用）与场景 5（失败诚实）专门看过
- [ ] 三个搞坏实验都做过；实验 2 的裸奔崩溃你**亲手看到并理解为什么必须修**
- [ ] 理解事件流"一份流多个观察者"，以及 scriptedClient 为什么不赌真模型

下一章：把裸奔的 execute 封成打不死的工具层，再给失控的循环装上保险丝——
弱模型的失败，从此都有对策。
