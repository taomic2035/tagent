# 第 8 章 换种驱动与并行：v0.11 ReAct、受限解码、多工具并发

> 三块能力一次装上：经典 ReAct 文本协议、受限解码（GBNF 语法锁）、
> 并行执行与互斥键。原理线两节"深入一层"：**文本协议在弱模型上崩的
> 形态学**、**GBNF 怎么在采样层锁死格式**。预计 1-2 天。

---

## 8.1 ReAct：不用协议字段，纯文本指挥工具

**ReAct**（Yao et al. 2022，"ReAct: Synergizing Reasoning and Acting"）先于
OpenAI function calling 出现，大量生态只认它。形态：

```
Thought: 我需要先查北京天气
Action: get_weather
Action Input: {"city": "北京"}
```
执行后以 **user 消息**追加（文本协议没有 tool 角色）：
```
Observation: {"tempC": 28, "condition": "晴"}
```
直到模型输出：
```
Thought: 两个城市都查完了
Final Answer: 上海更热，31 度。
```

为什么要学它：兼容性（第 9 章手机直连场景会遇到）＋教学价值——亲手实现后
你才知道 tool_calls 字段替你做了什么。引擎主循环照抄第 3 章三拍，
出口判定换成**文本解析**：

```ts
export function parseAction(text: string): ActionParse {
  const action = text.match(/Action:\s*(\S+)/);
  const input = text.match(/Action Input:\s*([\s\S]*?)(?:\n|$)/);
  const final = text.match(/Final Answer:\s*([\s\S]*)/);
  if (final) return { kind: "final", answer: final[1].trim() };
  if (action && input) {
    try { JSON.parse(input[1].trim()); return { kind: "action", name: action[1], args: input[1].trim() }; }
    catch { return { kind: "parse-error", message: `Action Input 不是合法 JSON: ${input[1].slice(0, 80)}` }; }
  }
  return { kind: "parse-error", message: "未找到 Action/Final Answer，请严格按格式输出" };
}
```

要点：说明书进 system prompt（`{TOOLS}` 占位替换）、请求**不传 tools 字段**、
**解析失败也是 Observation**（错误回填自愈——第 4 章"失败是提示词"的极致应用）。

## 深入一层 ①：文本协议在弱模型上崩的形态学

真机数据（链式任务 × 3 采样，Qwen3.5-4B → 9B）：

| 驱动 | 4B 成功率 | 9B 成功率 |
|---|---|---|
| native tool_calls | **100%** | 100% |
| react-json（受限解码） | **100%** | 100% |
| react-text（本章裸文本） | **75%** | 100% |

4B 裸文本的三种死法（存证里逐份可查）：**Action 拼错**（get_wether）、
**JSON 断在半截**（和第 3 章墙 1 同构）、**自编 Observation**（不等结果自己
把观察写了）。为什么死？回扣第 3 章②的世界观：

> **native tool_calls 的结构化字段是引擎后处理的礼物**——模型生成
> `<tool_call>` 文本段，引擎识别、解析、结构化、兜住格式错误。纯文本协议
> **没有引擎后处理这层保护**，模型生成的每个 token 直接裸露在正则面前。

由此推出对策的两条路：换更强模型（9B 确实 100%——格式纪律随规模解决），
或者**把保护层装回去**——这就是受限解码。

## 8.2 受限解码：GBNF 语法锁

请求级 `response_format`（OpenAI JSON 模式的 llama.cpp 扩展）：

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

模型输出变成单步 JSON：`{"thought":"先查北京","action":"get_weather",
"action_input":{"city":"北京"}}`。

## 深入一层 ②：GBNF 怎么在采样层锁死格式

第 1 章⑤的采样链条是 logits → softmax → 选 token。受限解码在这条链条的
**最前端**插了一道闸：

```
文法（JSON Schema 编译成 GBNF）
   ↓ 每生成一步
当前文法状态 → 计算"此位置合法的 token 集合" → 非法 token 的 logits 置 -∞
   ↓
softmax（非法 token 概率为 0）→ 采样只可能落在合法集内
```

两个机制细节值得记住：

1. **约束在 token 层不是字符层**：文法状态机消费的是 token 序列的等价字符流
   ——一个"非法 JSON"的 token（哪怕温度再高）从采样池里被物理移除。
   `enum` 锁工具名同理：词表里拼不出 get_wether 的完整形态……但能拼出
   前缀 get_w——所以实际是"每步只允许能延续合法前缀的 token"。
   **模型想写歪，写不出来**——这是第 4 章总纲"协议保证 > 模型自觉"的极致形态
2. **schema 本身成了新单点**：enum 里写错一个工具名，那个工具就被文法
   永久禁止。工具列表必须从 registry **动态生成**（schema 随注册表走）

代价：约束解码有轻微速度开销（每步多算合法集），且极端约束下可能
强制模型进入低概率路径（质量风险）——JSON 模式下实践影响很小。

> **引经据典**｜pi `packages/ai` 的 constrainedSampling
> pi 把同一能力做成 provider 级选项（json_schema strict 或 Lark/regex 文法）。
> 对照实验结论（真机）：**受限解码把 4B 从 75% 救回 100%——"能力问题"
> 被工程变成了"格式问题"，而格式问题在解码器层可解**。这是第二册
> 最重要的单条工程结论。

## 8.3 并行执行与互斥键

第 3 章墙 3 的同帧多调用，当时串行处理。现在升级：**并行执行整批，
结果按源序回填**：

```ts
const executions = toolCalls.map((tc) =>
  registry.execute(tc.function.name, tc.function.arguments, ctx));
const results = await Promise.all(executions);
for (let i = 0; i < toolCalls.length; i++) {
  const tc = toolCalls[i];
  if (!tc) continue;
  yield { type: "tool-result", id: tc.id, /* ... */ };
  messages.push({ role: "tool", tool_call_id: tc.id, content: results[i] ?? "" });
}
```

两个必须想清的问题：

**Q1：事件按源序还是完成序？** 源序。transcript 是存证与验收（第 10 章）的
物理基础，**确定性优先于实时感**——吞吐收益已经拿到（总耗时 = max 而非
sum），显示乱序零收益。

**Q2：两个工具同时写一个文件？** 写竞态。解法：**互斥键队列**（pi 的
file-mutation-queue 泛化）——工具声明 `serialize?: string`，registry 对同键
执行 FIFO 串行，异键/无键不受约束：

```ts
// registry 内部：每键一条 Promise 链
const prev = this.keyQueues.get(key) ?? Promise.resolve();
const chained = prev.then(() => runWithPolicy(...));   // 恒不抛（信封），链安全
this.keyQueues.set(key, chained.then(noop, noop));     // 吞异常防断链
```

为什么第 6 章的 remember 工具需要它：两个 remember 并发 appendFileSync
会交错写出坏行——真实写竞态，不是教学表演。只读工具（天气/计算）不声明键，
白得并行。真机验收："一次查三城天气"一帧三 ⚙、总耗时≈单次、源序回填、
配对完整。

> **引经据典**｜pi `packages/agent/src/harness/tools/file-mutation-queue.ts`
> 原版实现值得逐行读：路径先 `normalize` 成 canonical path 作键
> （`D:\a\b` 与 `D:/a/./b` 归到同一队列——**键的归一化是队列正确性的前提**），
> 再挂 Promise 链。我们泛化为任意字符串键，文件路径只是取值之一。

## 8.4 动手与搞坏

- **裸文本复现 75%**：react-text 模式跑 10 个链式任务，把每种死法的原始
  存证收档（理解受限解码价值的最短路径）
- **语法锁的边界**：enum 里故意写错一个工具名——那个工具永久调不出。
  体会"schema 是新单点"，改成动态生成
- **并行竞态复现**：写一个计数器文件工具（读-改-写），同帧两调并行——
  丢更新；声明 serialize 键后正确

## 8.5 自测与对照

- [ ] 能默写 ReAct 四行协议与两种出口；Observation 用 user 角色的原因
- [ ] 形态学能讲：三种死法 ↔ "引擎后处理缺失"的世界观回扣
- [ ] GBNF 机制能推（文法状态→合法 token 集→logits 置 -∞→采样被锁），
      且知道 schema 单点风险与动态生成
- [ ] 并行三问答得出（源序/键归一化/什么工具不需要键）

**与 tagent 对照**：`react.ts`（双协议+动态 schema）与 `tools.ts`（互斥键）；
三驱动数据在 `captures/step5-react/`、`step8-react-9b/`。
