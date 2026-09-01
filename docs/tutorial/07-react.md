# 第 7 章 换种方式驱动：ReAct 与并行执行

> 本章目标：亲手实现经典 **ReAct 文本协议**（不用 tool_calls 字段，纯文本指挥
> 工具），学会**受限解码**（GBNF 语法锁，让弱模型一个字都写不歪），跑一次
> 三种驱动方式的对照实验；再把工具执行升级为**并行 + 互斥键队列**。
> 预计 1-2 天。

---

## 7.1 为什么要第二种驱动方式

第 3 章的 native tool_calls 是协议一等公民，为什么还要文本协议？

1. **历史与生态**：ReAct（Yao et al. 2022, "ReAct: Synergizing Reasoning and
   Acting"）先于 OpenAI function calling 出现，大量模型/框架只认它
2. **兼容性**：不是所有引擎都实现了 tool_calls（第 8 章手机直连场景就会遇到）
3. **教学价值**：自己实现一遍，你会明白 tool_calls 字段帮你做了什么——
   以及它藏了什么（格式解析的全部痛苦）

**ReAct 的形态**：模型输出一段结构化文本，我们解析后执行：

```
Thought: 我需要先查北京天气
Action: get_weather
Action Input: {"city": "北京"}
```
我们执行工具后，把结果以 user 消息追加（注意：没有 tool 角色，文本协议没有它）：
```
Observation: {"tempC": 28, "condition": "晴"}
```
模型继续，直到输出：
```
Thought: 两个城市都查完了
Final Answer: 上海更热，31 度。
```

循环出口从 `finish_reason` 检查变成**文本解析**——痛苦由此开始（这正是第 4 章
实录里"4B 文本协议 75% 失败"的现场）。

## 7.2 手写 ReAct 引擎

`packages/core/src/react.ts` 的骨架（完整版见章末清单；与 runAgent 同事件契约，
壳零改动）：

```ts
export const REACT_SYSTEM_PROMPT = `你是一个使用 ReAct 协议的助手。每轮严格按以下格式之一输出：

Thought: <你的思考>
Action: <工具名>
Action Input: <JSON 参数>

或（任务完成时）：

Thought: <你的思考>
Final Answer: <最终回答>

可用工具：
{TOOLS}

注意：Action 必须是列出的工具名；Action Input 必须是合法 JSON。`;

/** 从 assistant 文本里抠出 Action/Action Input/Final Answer */
export function parseAction(text: string): ActionParse {
  const action = text.match(/Action:\s*(\S+)/);
  const input = text.match(/Action Input:\s*([\s\S]*?)(?:\n|$)/);
  const final = text.match(/Final Answer:\s*([\s\S]*)/);
  if (final) return { kind: "final", answer: final[1].trim() };
  if (action && input) {
    // 参数解析失败不抛——生成"纠错 Observation"回填，模型下一轮自己修（自愈）
    try { JSON.parse(input[1].trim()); return { kind: "action", name: action[1], args: input[1].trim() }; }
    catch { return { kind: "parse-error", message: `Action Input 不是合法 JSON: ${input[1].slice(0, 80)}` }; }
  }
  return { kind: "parse-error", message: "未找到 Action/Final Answer，请严格按格式输出" };
}
```

三个实现要点：

- **工具说明书进 system prompt**（`{TOOLS}` 占位替换），请求**不传 tools 字段**——
  行动完全靠文本
- **Observation 用 user 角色回填**——文本协议里没有 tool 消息，模型把 Observation
  当"系统返回的观察"理解
- **解析失败也是 Observation**：格式错不崩溃、不重试，把错误描述喂回去让模型
  自纠——第 4 章"失败是给模型的提示词"原则的极致应用

引擎主循环照抄第 3 章三拍（请求→解析→执行回填），出口判定换成
`parseAction(text).kind === "final"`。事件契约保持一致（tool-call/tool-result
照发），壳与存证零改动——**契约的价值在此刻兑现**。

## 7.3 受限解码：用语法锁代替祈祷

文本协议的 75% 失败率还能救吗？能——**不从模型身上救，从解码器上救**。

llama.cpp 支持请求级 `response_format`（OpenAI 规范的 JSON 模式扩展）：

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "react_step",
      "schema": {
        "type": "object",
        "properties": {
          "thought": { "type": "string" },
          "action": { "type": "string", "enum": ["get_weather", "calculate", "final_answer"] },
          "action_input": { "type": "object" }
        },
        "required": ["thought", "action"]
      }
    }
  }
}
```

引擎把这个 JSON Schema 编译成 **GBNF 语法**（llama.cpp 的格式约束文法），
在**解码每一步**只允许采样满足语法的 token——模型想写歪，物理上写不出来。

这就是**受限解码（constrained decoding）**：格式纪律由解码器保证，而不是
prompt 恳求 + 事后修补。协议形态升级为"单步一个 JSON"：

```json
{ "thought": "先查北京", "action": "get_weather", "action_input": { "city": "北京" } }
```

注意 schema 里的 `enum`——**工具名单锁死在语法里**，连工具名拼错都不可能发生
（第 4 章实录里 get_wether 的拼写错误在语法层绝迹）。工具列表变化时 schema
要动态生成（工具枚举 = registry 当前名单）。

## 7.4 对照实验：三种驱动，谁能救活 4B

真机数据（链式任务 × 3 采样，temperature 0.7，Qwen3.5-4B → 9B）：

| 驱动方式 | 4B 成功率 | 9B 成功率 | 观察结论 |
|---|---|---|---|
| native tool_calls | **100%** | 100% | 协议一等公民恒最优；最省 token |
| react-json（受限解码） | **100%** | 100% | 格式零失败——语法锁是弱模型的救生圈 |
| react-text（经典文本） | 75% | **100%** | 格式纪律随模型规模解决；4B 的三种死法：Action 拼错 / JSON 断裂 / 自编 Observation |

两条反直觉结论（第二册最值得带走的知识）：

1. **受限解码把"能力问题"变成了"工程问题"**：4B 在文本协议上的全部失败都是
   格式失败，锁住格式后它与 native 打平——弱模型 + 强约束 ≥ 强模型 + 无约束
2. **9B 没有消除工程对策的价值**：9B 文本协议满分，但受限解码在两代模型上都
   满分且更省——"模型升级"与"工程兜底"是互补不是替代（第 4 章总纲的实证）

## 7.5 并行执行与互斥键队列

native 模式一帧可以包含多个 tool_calls（第 3 章 slots 按 index 排序就为此准备的）。
串行执行浪费：三个查询 300ms×3；并行只要 300ms。升级循环第三拍：

```ts
// 并行执行整批（吞吐 = max 而非 sum）；结果按源序回填与发事件
const executions = toolCalls.map((tc) => registry.execute(tc.function.name, tc.function.arguments, ctx));
const results = await Promise.all(executions);
for (let i = 0; i < toolCalls.length; i++) {
  const tc = toolCalls[i];
  if (!tc) continue;
  yield { type: "tool-result", id: tc.id, /* ... */ };
  messages.push({ role: "tool", tool_call_id: tc.id, content: results[i] ?? "" });
}
```

两个必须想清楚的问题：

**Q1：事件按源序还是完成序？** 按源序。transcript 是存证与验收（第 9 章）的
物理基础，**确定性优先于实时感**——吞吐收益已经拿到，显示乱序零收益。

**Q2：两个工具同时写同一个文件呢？** 写竞态（race condition）。解法是
**互斥键队列**（pi 项目的 file-mutation-queue 泛化）：工具声明 `serialize` 键，
registry 对同键执行自动 FIFO 串行，异键/无键不受约束：

```ts
export interface Tool { /* ... */ serialize?: string }   // 如 remember 声明 "memory-store"

// registry 内部：每键一条 Promise 链
const prev = this.keyQueues.get(key) ?? Promise.resolve();
const chained = prev.then(() => runWithPolicy(...));      // 恒不抛（信封契约），链安全
this.keyQueues.set(key, chained.then(noop, noop));        // 吞异常防断链
```

为什么 JSONL 记忆工具（第 5 章）需要它：两个 remember 并发 `appendFileSync`
会交错写出坏行——**真实写竞态，不是教学表演**。而天气/计算这类只读工具不声明键，
白得并行收益。

真机验收："一次性查北京上海广州三城天气"——观察一帧三个 ⚙ 连发、总耗时≈单次、
事件按源序、`/dump` 配对完整。

## 7.6 故意搞坏

- **实验 1（文本协议裸奔）**：用 react-text 模式跑 10 个链式任务，统计格式失败
  种类——亲手复现 75%，把每种死法的原始报文收进存证（这是理解受限解码价值
  的最短路径）
- **实验 2（语法锁的边界）**：故意在 response_format 的 schema 里写错一个工具名
  ——模型会永远调不出那个工具（语法层禁止）。受限解码约束的是格式，
  **schema 本身的正确性成了新的单点**，工具列表必须动态生成
- **实验 3（并行竞态复现）**：写一个计数器文件工具（读-改-写），同帧两次调用
  并行执行——观察丢更新；声明 serialize 键后串行，计数正确

## 7.7 本章完整可抄清单

```
packages/core/src/
├── react.ts      # REACT_SYSTEM_PROMPT / parseAction / runReAct /
│                 #  reactJsonResponseFormat(registry)（schema 动态生成含工具 enum）
├── types.ts      # Tool.serialize?: string / AgentConfig.reactMode / reactFormat
├── tools.ts      # 互斥键 FIFO 队列（keyQueues）
└── loop.ts       # 并行执行 + 源序回填
apps/cli/src/
└── main.ts       # --react / --react-format json|text 开关
```

参考实现对照：tagent `react.ts` 与 `tools.ts`（Step 5/12 完全体）；
三驱动实验数据在 `captures/step5-react/`、`step8-react-9b/`。

## 7.8 自测清单

- [ ] 能默写 ReAct 的四行协议与两种出口；知道 Observation 用 user 角色回填及原因
- [ ] 能解释受限解码的原理层级：JSON Schema → GBNF → 逐 token 采样约束，
      以及 enum 锁工具名为什么连拼写错误都绝迹
- [ ] 三驱动对照表的两条反直觉结论能复述并给出数据出处
- [ ] 并行三问能答：为什么源序回填、互斥键怎么工作、什么工具不需要键
- [ ] 三个搞坏实验都做过——特别是实验 1，亲手数出格式失败的种类
