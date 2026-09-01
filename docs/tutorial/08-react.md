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
// ActionParse 的类型定义（放 parseAction 之前）：
export type ActionParse =
  | { kind: "final"; answer: string }
  | { kind: "action"; name: string; args: string }
  | { kind: "parse-error"; message: string };

export function parseAction(text: string): ActionParse {
  // 捕获组在 noUncheckedIndexedAccess 下是 string | undefined——用可选链收窄
  //（直接 [1] 索引在严格模式编译不过）
  const action = text.match(/Action:\s*(\S+)/);
  const input = text.match(/Action Input:\s*([\s\S]*?)(?:\n|$)/);
  const final = text.match(/Final Answer:\s*([\s\S]*)/);
  const finalText = final?.[1]?.trim();
  if (finalText !== undefined) return { kind: "final", answer: finalText };
  const name = action?.[1];
  const args = input?.[1]?.trim();
  if (name !== undefined && args !== undefined) {
    try { JSON.parse(args); return { kind: "action", name, args }; }
    catch { return { kind: "parse-error", message: `Action Input 不是合法 JSON: ${args.slice(0, 80)}` }; }
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

## 深入一层：从单任务循环到长时运行（"无干预 XX 小时"的工程分解）

宣称"无干预运行 XX 小时不中断"不是单一功能，是四层机制的乘积：

**层 1 循环不死**：迭代预算 + 重复/空响应守卫（本书第 4/7 章已做）之上，
工业级还要**外层异常上限**（防"异常→重试→又异常"的隐性死循环）、流级
stale 断路器、崩溃后的幂等终态（重启不重跑已提交的工作、不重复副作用——
clowder"一 run 一 terminal"）、急停与文件系统快照回滚（hermes estop +
checkpoint）。

**层 2 循环不空**：常驻 agent 的工作来源是事件驱动——消息网关（随时接
任务）、cron（闲时自派活）、**外部世界唤醒**（clowder 的 AwaitState 把
"等 PR merge / 等 CI 通过"做成一等生命周期：挂起，谓词满足再续跑）。
**"无干预"的真实含义不是空转几小时，是"提交后挂起、世界变了自动续"**。

**层 3 长任务的结构**：ReAct（每步过模型——灵活但百步任务=百次推理，
漂移机会也累积百次）之上：**Plan-and-Execute**（先出计划/DAG 再执行，
偏离预期触发重规划——便宜稳定但要定义"计划失效"信号）；**任务图**
（节点=步骤边=依赖，程序调度；clowder 用 7 态状态机区分"blocked"和
"dead"）；**会话树**（pi：探索失败 branch 回退，被弃分支生成摘要——
试错不丢信息）；**子 agent 分治**——长任务的上下文生命线：子任务拿
干净上下文只回传摘要，父上下文不随任务长度膨胀（tagent 的 delegate
是单层教学版；hermes 并发 10、深度 1、摘要 ≤ 父预算 50%）。

**层 4 边界**：先问"无干预做的是什么"（确定性任务可信，开放创作漂移
随步数累积）；无人值守对危险操作默认拒绝（另一端没人批）；长任务的
终点必须是机器可检谓词（第 10 章——否则"跑完了"和"跑飞了"无法区分）。
本书止步于单任务循环（教学核心），这张地图就是"从这里到常驻工业 agent"
的距离与路标。

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

## 深入一层：能力选型——LLM 直答 / tool / MCP / skill

四个名字不是并列竞争关系，先把它们在架构里的真实位置摆正：

| 能力 | 本质 | 一句话定位 |
|---|---|---|
| **LLM 直答** | 参数化知识的文本生成 | 默认路径——什么都不接时的兜底 |
| **tool** | 你进程里的函数（本章/第 3 章） | 模型没有的**能力**：实时数据、精确计算、副作用动作 |
| **MCP**（Model Context Protocol） | 工具的**分发协议**（JSON-RPC 独立服务：tools/list + tools/call） | 不是更高级的 tool——是 tool 的微服务化 |
| **skill** | 按需加载的**程序性知识**（SKILL.md：description 常驻、正文按需 read） | 模型没有的**流程**："这类事怎么做"的手册 |

**选型的两条轴**：

**轴一：这个子任务要的是知识还是动作？** 动作（一切副作用：查实时数据、
写文件、发请求）只能 tool——模型只生成文本（第 3 章②）。知识再分：模型
参数里有且精度够 → LLM 直答；参数里没有（实时/私有）→ 知识型工具取数；
是"怎么做"的流程性知识 → skill。

**轴二：知识的来源与复用度**（决定 tool 的实现形态）：一次性 → 直接写进
prompt；本 agent 私有且常用 → 内嵌 tool（本书做法）；跨客户端/跨团队复用、
或第三方生态 → MCP 服务化（多一层进程边界换可发现可复用——单 agent 私有
工具上 MCP 是纯开销）；流程手册 → skill（渐进披露：description 常驻几十
token，正文几千 token 按需加载）。

**谁在什么时候决策**——三层分开：**架构期**（开发者决定什么做成 tool/
MCP/skill——模型只能从你给的菜单里选，菜单质量=agent 能力上限）；**运行期**
（模型在循环里按 description 语义匹配选工具——第 3 章①的机制）；**演进期**
（经验沉淀成什么：能写成 skill/代码的绝不写成记忆——第 6 章④）。

**三个常见误区**：MCP 不会让工具更聪明（它只解决分发，代价是进程边界）；
skill 不是记忆（程序 vs 事实）；**能用直答的不要上工具**——每个工具都有
说明书 token 成本，且选择错误率随工具数上升（场景 3"不滥用工具"验收的
正是这条；pi 的 skills 渐进披露本质上是在给"菜单膨胀"止血）。

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
