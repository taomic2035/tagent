# 方案设计（详细设计）

> 版本：v1.0（Step 1，可直接照此实现）｜ 日期：2026-08-30
> 上游文档：[ARCHITECTURE.md](ARCHITECTURE.md) ｜ 需求溯源：[REQUIREMENTS.md](REQUIREMENTS.md)

## 1. 数据结构（types.ts）

```ts
// ---- 消息（OpenAI Chat 格式的 TS 化，agent 上下文的唯一事实来源）----
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; reasoning?: string;
      tool_calls?: ToolCallData[] }
  | { role: "tool"; tool_call_id: string; content: string };  // content = JSON 字符串

export interface ToolCallData {
  id: string;                       // 模型生成的调用 ID，回填时必须带回去
  type: "function";
  function: { name: string; arguments: string };  // arguments 是 JSON 字符串（流式分片拼完再 parse）
}

// ---- 工具 ----
export interface ToolDef {           // 传给 LLM 的 JSON Schema 形态
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ToolContext { signal?: AbortSignal; /* Step 2 起扩展 */ }

export interface Tool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: T;                                              // zod schema
  execute: (args: z.infer<T>, ctx: ToolContext) => Promise<unknown>;  // 返回值会被 JSON.stringify
}

// ---- 流事件（client 层）----
export type StreamEvent =
  | { type: "reasoning-delta"; delta: string }
  | { type: "text-delta"; delta: string }
  | { type: "tool-call-delta"; index: number; id?: string; name?: string; argsDelta?: string }
  | { type: "done"; finishReason: "stop" | "tool_calls" | "length";
      usage?: { promptTokens: number; completionTokens: number } };

// ---- 循环事件（loop 层，CLI 与 transcript 共同消费，见 ARCHITECTURE.md §5）----
export type AgentEvent =
  | { type: "round-start"; round: number }
  | { type: "llm-request"; messages: ChatMessage[] }
  | { type: "reasoning-delta"; delta: string }
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; id: string; name: string; args: unknown }
  | { type: "tool-result"; id: string; name: string; result: string }
  | { type: "final"; message: ChatMessage; rounds: number; usage: Usage }
  | { type: "error"; message: string; recoverable: boolean };

// ---- 配置 ----
export interface AgentConfig {
  baseUrl: string;          // 默认 http://127.0.0.1:8081/v1
  model: string;            // 默认 ""（MLX server 用 --model 启动时接受空串）
  maxIterations: number;    // 默认 8，防失控
  temperature: number;      // 默认 0.7
  systemPrompt: string;     // 见 §7
}
```

**设计说明**：

- `reasoning` 字段：MLX/思考模型会把思考过程放在 `reasoning_content`（非流式）/ `reasoning`（流式 delta）里。**回填上下文时丢弃 reasoning**——思考是模型的一次性草稿，历史里只保留结论，否则上下文会被思考灌爆（这也是多数框架的通行做法，值得记住）
- `tool_calls[].function.arguments` 是**字符串不是对象**：这是 OpenAI 协议的历史设计（模型逐 token 生成 JSON 文本），流式分片必须按 `index` 拼接完成后才能 `JSON.parse`

## 2. client.ts：LLMClient

```ts
export interface LLMClient {
  stream(req: { messages: ChatMessage[]; tools?: ToolDef[]; temperature?: number }):
    AsyncIterable<StreamEvent>;
}

export class OpenAIClient implements LLMClient {
  constructor(private baseUrl: string, private model: string, private fetchImpl = fetch) {}
}
```

### SSE 解析算法（手写，学习重点之一）

对 `POST {baseUrl}/chat/completions`，`stream: true` 的响应体逐行读取：

```
对每一行:
  跳过空行与 ":" 开头注释行
  以 "data: " 开头 → 取剩余部分
    "​[DONE]" → 结束
    JSON.parse → 取 choices[0].delta:
      delta.reasoning_content → emit reasoning-delta
      delta.content           → emit text-delta
      delta.tool_calls[]      → 按 index 合并：id/name/argsDelta 追加到该槽位，emit tool-call-delta
  其他行 → 忽略
流结束但未见 [DONE] → 视为异常（连接截断）
HTTP 状态非 2xx → 读 body 抛 LLMHttpError（loop 层重试 1 次）
```

实现要点：用 `response.body`（`ReadableStream`）+ `TextDecoder` + 手写行缓冲器（数据可能跨 chunk 断行，必须缓冲到出现 `\n`）——这个 40 行左右的解析器是理解"流式输出到底发生了什么"的最好练习。

### 重试

仅对「连接失败 / 5xx / 超时」重试 1 次（指数退避 500ms）；4xx 不重试（参数错误重试无意义）。

## 3. tools.ts：ToolRegistry

```ts
export class ToolRegistry {
  register<T extends z.ZodType>(tool: Tool<T>): void;
  schemas(): ToolDef[];                       // zod → JSON Schema（zod4: z.toJSONSchema）
  has(name: string): boolean;
  async execute(name: string, argsJson: string, ctx?: ToolContext): Promise<string>;
  // execute 返回值恒为 JSON 字符串，成功：{ok:true, data}；失败：{ok:false, error}
}
```

### execute 的三段校验（FR-4/FR-10 核心）

```
1. 未知工具   → 返回 {ok:false, error:"unknown tool: xxx"}（不抛异常）
2. JSON.parse 失败 → 返回 {ok:false, error:"arguments is not valid JSON"}
3. zod safeParse 失败 → 返回 {ok:false, error:"参数校验失败", issues:[...精简为 path+message]}
4. 执行 → try/catch 包裹，异常 → {ok:false, error: err.message}
成功 → {ok:true, data: await execute(parsed)}
```

**恒不抛异常**是本模块的契约：所有失败都变成字符串回填给模型，由模型决定下一步（自我纠正）。这 12 行代码是"agent 容错哲学"的浓缩。

## 4. loop.ts：runAgent

```ts
export interface AgentDeps { client: LLMClient; registry: ToolRegistry; config: AgentConfig; }

export async function* runAgent(
  deps: AgentDeps,
  messages: ChatMessage[],          // 调用方持有并复用（多轮会话），loop 内部原地追加
  ctx?: ToolContext,
): AsyncIterable<AgentEvent>
```

### 主循环伪代码

```
system prompt 为空 → messages 头部插入
for round = 1..maxIterations:
    emit round-start
    emit llm-request
    toolSlots = Map<index, {id, name, argsBuf}>     // 流式分片累积器
    textBuf / reasoningBuf = ""
    for await ev of client.stream({messages, tools: registry.schemas()}):
        分发 reasoning-delta / text-delta（透传给上层渲染）
        tool-call-delta → 并入 toolSlots
        done → 记 finishReason / usage
    // 一轮流结束，组装 assistant 消息（reasoning 只进事件流，不进 messages）
    messages.push(assistant{text: textBuf 或 null, tool_calls: toolSlots 有值时})
    if finishReason != "tool_calls" 或 toolSlots 为空:
        emit final → return
    for each slot (按 index 顺序):
        emit tool-call
        result = registry.execute(name, argsBuf)
        emit tool-result
        messages.push({role:"tool", tool_call_id: id, content: result})
emit error{maxIterations reached}   // 兜底出口
```

**单流式连接内同时到达 text 与 tool_calls 的处理**：协议允许模型先说一段话再调工具（finishReason=tool_calls 时 content 通常为空或很短）。规则：text 照常透传渲染；只要本轮有 tool_calls，text 一并作为 assistant.content 入 messages（保持协议真实性），循环继续。

**并发边界**：`tool_calls` 数组内的多个调用**按序执行**（Step 1 不做并发执行；真实并行调度是 Step 7 的话题，但协议侧"一次返回多个 tool_calls"在 AC-4 已覆盖）。

## 5. 不变量清单（实现后逐条自检）

1. 任意时刻 `JSON.stringify(messages)` 可完整重建会话现场——loop 无 messages 之外的持久状态（toolSlots/textBuf 是单请求内的瞬态）
2. assistant 消息含 `tool_calls` 时，其后**必须**紧跟与之一一对应的 `role:"tool"` 消息（id 配对）——这是 OpenAI 协议的硬约束，违反会被引擎拒绝
3. 循环出口仅两个：`finishReason === "stop"` 或轮次触顶
4. reasoning 永不进入 messages
5. registry.execute 永不 throw

## 6. 内建工具（apps/cli/builtin-tools）

### get_weather（FR-6①，mock）

```ts
schema: z.object({ city: z.string().describe("城市名，如：北京") })
```
数据源：内存字典（北京/上海/广州/深圳/杭州 五城，固定天气 JSON：`{city, condition, tempC, humidity, aqi}`）+ 当前时间戳。查无此城返回数据内明确 `{"ok":false,"error":"no data for city"}`——**AC-5 专门构造此类场景**。

### calculate（FR-6②，自研求值器）

```ts
schema: z.object({ expression: z.string().describe("四则运算表达式，如 3.7*12-8.2") })
```
实现：递归下降解析器（tokenizer → expr/term/factor 三层文法），支持 `+ - * / ( )` 与浮点数，**显式禁止 eval/Function 构造器**（安全边界 + 学习价值：50 行手写解析器正好复习文法）。除零返回 `{ok:false, error:"division by zero"}`。

## 7. System Prompt（Step 1 版）

```
你是 tagent，一个运行在用户本地终端上的助手。
你可以使用提供的工具来获取信息或进行计算。
规则：
- 需要工具才能回答时，调用工具并等待结果，不要编造工具会提供的数据
- 工具返回错误时，向用户如实说明，或修正参数后重试
- 无需工具的日常对话直接回答
- 回答使用用户使用的语言（默认中文）
```

（有意保持极简。学习实验点：后续步骤会故意改坏各条规则，观察 agent 行为退化。）

## 8. CLI（apps/cli）

- 启动参数：`--base-url` `--model` `--debug` `--max-iterations`（默认值同 AgentConfig；`TAGENT_BASE_URL`/`TAGENT_MODEL` 环境变量兜底）
- 渲染：正文白/前景色，reasoning 暗灰色前缀 `·`，工具调用行 `⚙ get_weather {"city":"北京"}`，工具结果折叠为 `✔ 12ms` 一行；ANSI 码手写（ui.ts 内 ~60 行工具函数）
- 斜杠命令：`/exit` `/reset`（重建 messages + system prompt）/ `/tools`（列出注册工具及 schema）/ `/dump`（打印 messages 全量 JSON）/ `/nothink`（切换：在**下一条**用户消息尾部附加/移除 `/no_think`）
- transcript：默认开启，追加写 `logs/transcript-YYYYMMDD-HHmmss.jsonl`，每行一个事件（`{ts, ev}`）

## 9. 测试策略

| 层 | 方式 | 工具 |
|---|---|---|
| SSE 解析 | 固定 chunk 序列（含跨 chunk 断行、[DONE] 缺失、tool_calls 分片乱序到达）断言合并结果 | node:test |
| SSE 解析 | 伪造 server 校验 | 同上 |
| registry | 三段校验各一例 + 工具抛异常一例 | node:test |
| calculate | 表达式表驱动（含除零、括号、浮点误差） | node:test |
| runAgent | **脚本化 mock client**：按剧本回放"流→tool_calls→流→stop"，断言 messages 演化满足 §5 不变量 | node:test |
| e2e（可选） | `TAGENT_E2E=1` 且 MLX server 在线时跑 AC-1~4 | node:test |

mock 剧本示例（覆盖 AC-4 多工具）：
```
剧本2: [text "让我查两个城市", tool_calls: [get_weather(北京), get_weather(上海)]] → [text "对比结果是…"]
```

## 10. 实现顺序（Step 1 施工计划）

1. pnpm workspace + tsconfig 骨架
2. `types.ts` → `client.ts`（先用 curl 手工抓一段真实 SSE 存为 fixture，再写解析器对着 fixture 测）
3. `tools.ts` + calculate（独立可测，不依赖引擎）
4. `loop.ts` + mock 回放测试（此时无引擎也能全绿）
5. CLI 壳 + get_weather + transcript
6. 真机验收 AC-1~6，逐条记录到本仓库 issue/笔记

## 11. Step 2 设计：工具执行策略层（2026-08-31，对应 REQUIREMENTS §6）

### 11.1 数据结构扩展

```ts
// types.ts
export interface ToolExecPolicy {
  timeoutMs?: number;    // 单次执行超时；超时视为可重试失败
  retries?: number;      // 可重试失败的重试次数（默认 0 = Step 1 行为）
  retryDelayMs?: number; // 线性退避：第 n 次重试等待 n × retryDelayMs
}
export interface Tool<...> {
  ...
  policy?: ToolExecPolicy;   // 缺省 = 无策略（不超时不重试）
}
export interface AgentConfig {
  ...
  degradeOnCap?: boolean;    // 迭代触顶降级终答，默认 true（FR-15）
}
```

### 11.2 错误分类与重试判定（tools.ts，FR-13 核心）

```
失败来源                     │ 可重试 │ 理由
─────────────────────────────┼────────┼──────────────────────────────
未知工具 / JSON 残缺 / schema │   ✗    │ 确定性失败：同参数重试必得同果，
                             │        │ 重试的代价应花在"让模型改参数"上
工具抛 TransientToolError    │   ✓    │ 业务自报瞬时故障（资源忙/下游抖动）
执行超时（timeoutMs 到点）    │   ✓    │ 挂死/慢查询的另一面就是瞬时性
工具抛普通 Error             │   ✗    │ 业务确定性 bug，重试无意义
```

`TransientToolError extends Error`（core 导出）：业务工具用它声明"我这次失败是瞬时的"。
执行循环（executeEnvelope 第 4 段改造）：

```
attempts = retries + 1
for n in 1..attempts:
  controller = new AbortController()          // 每次尝试独立（FR-17）
  结果 = await race( execute(args, {signal: controller.signal}),
                     sleep(timeoutMs).then(throw TimeoutError) )
  成功 → return {ok:true, data}
  失败(Transient|Timeout) 且还有尝试次数 → await sleep(n × retryDelayMs)，继续
  失败(其他) → 立即返回错误信封（不重试）
重试耗尽 → {ok:false, error:"…已重试 N 次仍失败（瞬时故障持续），建议向用户说明或改用其他方案", retriesUsed: N}
```

要点：
- **超时不强杀**：Promise.race 只能放弃不能终止；尊重 `ctx.signal` 的工具自行清理，不尊重的被放弃（其 resolve 结果丢弃，KV 无污染——registry 不回填它）
- 信封 `retriesUsed` 仅在"因瞬时失败耗尽"时携带；`tool-result` 事件增可选 `retriesUsed`（NFR-9，事件契约向后兼容）
- 无 policy 时行为与 Step 1 完全一致（回归零风险）

### 11.3 迭代触顶降级（loop.ts，FR-15）

for 循环走完（触顶且模型仍要工具）时，若 `degradeOnCap !== false`：

1. 组装降级请求：`messages.concat([{role:"user", content:"（系统注入：已达工具调用次数上限…直接给出最终回答）"}])`——**副本拼接**，不污染调用方持有的 messages（不变量 1 不破）
2. **不传 tools 参数**：协议层禁止再调工具（无 tools 定义 → 模板无工具段 → finish_reason 不可能是 tool_calls），降级是被协议保证的，不靠 prompt 恳求
3. 流式照常透传，产出 final；末条 assistant 追加进真实 messages
4. 降级请求自身失败（网络等）→ error 事件（兜底）

`degradeOnCap:false` 时维持 Step 1 行为（直接 error 事件），供对照实验。

### 11.4 故障注入（apps/cli/faults.ts，FR-16，实验工具不进 core）

`TAGENT_FAULTS=get_weather:hang,get_weather:flaky:2,get_weather:down` 语法：

| 剧本 | 行为 | 对应实验 |
|---|---|---|
| `hang` | execute 永不 resolve（且监听 signal，超时后安静退出） | AC2-1 超时 |
| `flaky:N` | 前 N 次抛 TransientToolError，之后放行真实工具 | AC2-2 重试自愈 |
| `down` | 恒抛 TransientToolError | AC2-3 重试耗尽 |

实现为 Tool 包装器（装饰器，与 RecordingClient 同一手法）；注入只作用于壳装配期，core 不感知。

### 11.5 测试增补（先行）

| 对象 | 用例 | 
|---|---|
| registry 策略 | 挂死工具+timeoutMs → 超时信封且 registry 正常返回；flaky1+retries1 → 成功且执行 2 次；恒瞬时+retries2 → 耗尽信封含 retriesUsed=2；普通异常+retries2 → 只执行 1 次；schema 失败不进执行段 |
| registry 退避 | retryDelayMs=20 两处尝试 → 时延 ≥20ms（宽松断言防 CI 抖动） |
| signal | 超时后工具内 signal.aborted 为真（FR-17） |
| loop 降级 | mock：round1 tool_calls + maxIterations=1 → 第二次请求无 tools 字段 + 含系统注入消息；messages 无注入痕迹；final 产出；degradeOnCap:false → error 事件 |
| faults | 三种剧本的包装语义各一例 |

## 12. Step 3 设计：上下文裁剪与 KV cache 复用（2026-08-31，对应 REQUIREMENTS §7）

### 12.1 token 估算器（FR-18，无依赖手写）

```
estimateTokens(text):
  cjk   = 正则 [\u4e00-\u9fff\u3000-\u303f\uff00-\uffef] 计数   → ×1.0
  other = 其余字符计数                                          → ×0.25
  return ceil(cjk + other×0.25)
estimateMessagesTokens(msgs): Σ (content/arguments 估算 + 每条消息固定开销 4)
```

Qwen 系 BPE 中文约 1~1.5 字/token、英文约 4 字符/token——估算取保守中值。
估算器的用途是**水位判断**：单调性比绝对精度重要（AC3-1 校准实验实测误差）。

### 12.2 回合分组与裁剪算法（FR-19/20）

```
trimMessages(messages, {budget, lowRatio=0.5}):
  system = messages[0] if role=system（永远保留，不计入裁剪候选）
  turns  = 其余消息按 user 切组（每组 = 一个完整问答回合）
  before = estimateMessagesTokens(messages)
  if before ≤ budget: 返回恒等（不动前缀 —— 平凡轮次零成本）
  从最旧回合开始整回合移除，直到 estimate ≤ budget×lowRatio
  永远保留最后一回合；若仅剩 system+最后回合仍超低水位，如实返回（防死循环）
  返回 { kept, removed, beforeTokens, afterTokens }
```

不变量：tool 消息与其 assistant(tool_calls) 同回合，整回合删除 ⇒ 配对永不拆散；
回合以 user 起头 ⇒ 裁剪后的消息链对新请求而言仍是合法对话开头。

### 12.3 loop 集成（NFR-10，ARCHITECTURE §6 扩展点落地）

`AgentConfig.contextBudgetTokens?: number`（缺省不裁剪）。runAgent 每轮
`client.stream` 之前（含降级轮）：

```
if (config.contextBudgetTokens) {
  const r = trimMessages(messages, { budget: config.contextBudgetTokens })
  if (r.removed.length > 0) {
    messages.length = 0; messages.push(...r.kept)   // 原地替换：调用方持有的引用不变
    yield { type: "context-trimmed", removedMessages, fromTokens, toTokens }
  }
}
```

裁剪即遗忘：messages 仍是唯一事实来源（不变量 1 的语义不变——
"现场 = messages 当前内容"，被裁内容相当于人类的工作记忆丢弃）。

### 12.4 KV cache 实验设计（AC3-4，scripts/kvcache-experiment.mjs）

用非流式请求直读 timings 字段（llama.cpp：`cache_n` = 前缀命中 token 数），
三段对照：

| 段 | 操作 | 预期 cache_n |
|---|---|---|
| A 连续追加 | 同会话逐轮追加消息（前缀不变） | 随轮次增长（上一轮 prompt 全命中） |
| B 前缀破坏 | 头部插入/删除消息后重发（模拟"每轮裁一点"） | 骤降（≈0，slot 找不到公共前缀） |
| C 双水位恢复 | 裁剪后新前缀上继续追加 | 从新基线重新增长 |

对照含义：滑动窗口式小步裁剪每轮都付全量 prompt 处理税（Windows CPU 上
32~39 tok/s 的 prompt 处理是真实成本）；双水位把这笔税摊薄成偶发一次。

### 12.5 测试增补（先行）

| 对象 | 用例 |
|---|---|
| 估算器 | 纯中文/纯英文/混合的单调性与量级区间；消息估算含 tool_calls 与固定开销 |
| 裁剪 | 未超预算恒等（同引用）；超预算裁最旧回合且保 system/末回合；tool 配对不拆散；极小预算不死循环 |
| loop | 预算触发 context-trimmed 事件 + messages 被原地替换 + 请求消息数下降；无预算零事件（回归） |
