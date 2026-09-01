# 第 6 章 开关与缰绳：思考模式与打断

> 本章目标：给 agent 装上三根缰绳——**思考模式的请求级开关**（含一个反直觉的
> A/B 实验）、**中途打断**（steering 注入 + Ctrl-C 硬取消）、**循环守卫**
> （发呆/复读/截断的对策）。预计 1 天。本章实验数据全部来自真机采样。

---

## 6.1 思考模式是什么，在哪看

思考模型在给出答案前先生成一段推理文本（Qwen 的 QwQ/3.x 系内置此能力）。
协议上它出现在独立的字段——第 2 章的 SSE 解析里我们留过伏笔：

```
data: {"choices":[{"delta":{"reasoning_content":"先分析一下题目…"}}]}
data: {"choices":[{"delta":{"content":"答案是…"}}]}
```

`reasoning_content`（llama.cpp + `--reasoning-format deepseek` 的命名；有的引擎叫
`reasoning`——**客户端要做双认**）在正文之前流出。三个工程决定跟着来：

1. **渲染分流**：思考用灰色斜体，正文正常——用户看得见模型的"草稿"
2. **思考永不入档**：reasoning 只进事件流渲染，**不进 messages**（回传思考
   既是浪费 token，部分引擎还会拒收）——`messages` 里只存 `content` 与 `tool_calls`
3. **开关必须在请求级**——见下

## 6.2 请求级开关：为什么 /no_think 是个骗局

需求很朴素：有的任务想要思考，有的不想要。模型文档说在消息里加 `/no_think`
标记即可关闭——**实测两个引擎都不认**（考据结论：Qwen3.5 的 chat template
根本不解析这个消息内标记）。这不是你操作错了，是**消息文本约定天生靠不住**：

> 工程纪律（第 4 章"协议保证 vs 模型自觉"的又一例）：能力开关要落在
> **协议字段或引擎参数**上，不落在"恳求模型的文本"上。

正确开关是请求体的扩展字段（llama.cpp 实测有效）：

```json
{
  "model": "...",
  "messages": [...],
  "chat_template_kwargs": { "enable_thinking": false }
}
```

客户端改造：`ChatRequest` 加 `chatTemplateKwargs?: Record<string, unknown>`，
**缺省不携带**——不带时请求体与旧版逐字节同形（可复现性不受影响，
这是"加字段"的礼仪）。CLI 加 `/think` `/nothink` 命令切换。

## 6.3 反直觉 A/B：小模型开思考更差（真机数据）

直觉说"想得更多答得更好"。对 4B 实测（11 题 × 3 采样 × 开/关，同引擎同温度）：

| 组 | 成功率 | 现象 |
|---|---|---|
| 思考 OFF | **94%** | 直答，快 |
| 思考 ON | 82% | 常见死法：思考烧穿 token 预算（`finish_reason: "length"`，答案根本没出来） |

更有教学价值的一个对照（单题，strawberry 里有几个 r）：

| 思考 | 生成 token | 耗时 | 结果 |
|---|---|---|---|
| ON | 1251 | 90 秒 | 思考内耗 1224 token，答案还没写完 |
| OFF | **131** | **7.9 秒** | **答对**（逐字母数出 3 个 r） |

换 9B 复测：思考组成功率 68%——**更差了**（更大的模型思考更啰嗦，有限预算下
更吃亏）。两条泛化结论（第二册反复引用）：

1. **思考是预算消费者**：token 上限是思考+答案共用的池子
2. **默认关、按需开、开就给足预算**——这是第 8 章移动端的默认配置依据

> 方法论提醒：这不是"思考无用论"（大预算/强模型/复杂数学场景思考有收益），
> 是"**先实验再配置**"。你也应该用自己的任务集跑一遍 A/B——方法第 9 章教。

## 6.4 steering：agent 干活时你插话

第 3 章的循环有个体验缺陷：一轮任务里用户毫无插嘴机会，agent 跑错方向要
等它烧完全部轮数。修法分两层，本节先做第一层（软打断）：

**语义**：不打断正在进行的行为（不杀流不杀工具），你的话排进队列，
**在下一次 LLM 请求前**以 user 消息注入——模型下一轮就知道方向变了。

```ts
// core：loop 加第 4 参（第 1 轮不注入——首轮时用户最新意图就是初始消息）
export interface SteeringChannel { take(): string[] }   // 取走即清

// 循环里，round > 1 且请求前：
if (round > 1 && steering) {
  for (const directive of steering.take()) {
    messages.push({ role: "user", content: directive });
    yield { type: "steering", message: directive };     // 可观测
  }
}
```

壳侧：生成期间输入不再忽略，进队列并提示"将在下一轮生效"；生成结束时队列
若有余量，转成下一轮提问（followUp 语义，用户的话不能静默蒸发）。

**真机验收**（这是全教程最有演示效果的一条）：

```
你> 查一下北京天气
（趁它生成时输入）改成查上海天气
↪ 已接收（队列 1 条），将在下一轮生效
⚙ get_weather {"city":"北京"}
↪ 注入用户中途指令：改成查上海天气
⚙ get_weather {"city":"上海"}      ← 模型真的改向了
```

注入的两个讲究：**注入点在裁剪之后**（新指令绝不能被本轮裁掉）；**追加而非改写**
（前缀只增不改，KV cache 不受损——第 5 章的纪律在新增功能时依然生效）。

## 6.5 硬取消：Ctrl-C 不再杀进程

steering 是"下一轮生效"，取消是"现在就停"。通道用 Web 标准 **AbortSignal**，
三层贯穿（每层都是一个可移植的工程知识点）：

```ts
// 1. fetch 层：请求体可携带 signal（内部字段，从不进 HTTP 报文）
const res = await fetch(url, { ...init, signal: req.signal });

// 2. 工具层：外层 signal 与超时 signal 组合（AbortSignal.any）——
//    单独的"只听超时"会覆盖外层，取消永远传不进工具（真实踩坑）
const signals = [controller.signal, ...(outer?.signal ? [outer.signal] : [])];
const ctx = { ...outer, signal: AbortSignal.any(signals) };

// 3. 循环层：流中断 → interrupted 事件；半截内容绝不组装回填
} catch (err) {
  if (ctx?.signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
    yield { type: "interrupted", partialText: textBuf, partialToolCalls: slots.size };
    return;   // messages 停在最后完整状态
  }
  throw err;  // 非取消异常维持原语义
}
```

**半截内容绝不回填**（第 3 章配对纪律的推广）：残缺的 tool_calls 入档就是
下次请求的定时炸弹；半截正文也不入档——但截获量记进 interrupted 事件，
存证上"它说到哪"可查。壳侧 Ctrl-C 语义：第一次取消当前生成回提示符
（会话可续，已完成的工作都在），1 秒内连按两次才退进程。

**Windows 专项（如实）**：外部脚本无法给 Node 进程注入 CTRL_C_EVENT
（libuv 限制）——教程的自动化验收用"定时 abort"替代（真引擎真流 3.5 秒后
abort），交互层的 Ctrl-C 你自己在终端里手测。

## 6.6 循环守卫：三种静默失败

第 4 章对照表欠的三行，现在补上。共同特征：**不抛错、也不干活**——
错误处理管不住它们，要在循环里设专门的检查点：

| 失败 | 检测 | 对策 | 上限 |
|---|---|---|---|
| 发呆（空内容无调用） | text=="" 且 toolCalls 空 | 注入 user nudge："请基于已有信息继续" | 连续 3 次放弃，按空终答诚实收场 |
| 复读 | 工具批次签名（name+规范化参数）连续相同 | 第 3 批附警告；第 5 批不执行、回填说明、走触顶降级 | 5 批硬上限 |
| 截断（length 且有残缺调用） | finish_reason==="length" | **不执行**（协议说截断就不猜完整性），逐个回填"参数不完整未执行，请重新发起" | — |

三条设计原则（守卫自身的兜底，比守卫本身更重要）：

1. **可观测**：每个守卫动作发 `guard` 事件进 transcript——静默的守卫等于
   没有守卫（你还以为它在工作）
2. **有限次**：nudge 无限重试 = 把发呆换成死循环；守卫自己必须有上限
3. **注入以 user 入档**：与降级/摘要注入同一惯例（0 号坑：非头部 system 会 500）

**真实采样数据**（教程为什么敢这么设计）：日常任务 10 个，空响应 **0 次**、
复读 0 次；复读诱发任务 6 个，复读 **1 次**（被守卫在第 5 批截停）；小 max_tokens
探针 8 发，截断 **0 次**（短调用在极小窗口内也完整生成——截断的真实风险集中
在思考开启+紧预算场景）。结论：三守卫频率差异巨大，但成本低、各自防住明确的
失败形态——**保留，且文档如实记录频率，不夸大威胁**。

## 6.7 故意搞坏

- **实验 1（思考烧穿复现）**：请求体手工加 `chat_template_kwargs.enable_thinking: true`
  且 `max_tokens: 400`，问一道要推理的题——观察 `finish_reason: "length"`、
  存证里整段只有 reasoning 没有 content
- **实验 2（steering 假注入）**：把注入点改到第 1 轮（round >= 1），同管道发两行
  ——第二行会在首个请求前就入队，这不是"中途打断"（验收必须区分这两种时序！）
- **实验 3（取消后的会话）**：长任务中途 Ctrl-C，然后接着问"刚才北京多少度来着"
  ——验收：会话可续、**已完成轮的工具结果还在**（取消不回滚已发生的工作）

## 6.8 本章完整可抄清单

```
packages/core/src/
├── types.ts   # AgentGuards（三开关，缺省全开）/ SteeringChannel
├── client.ts  # chatTemplateKwargs 条件携带 / reasoning_content 双认 / ChatRequest.signal
├── loop.ts    # steering 注入点 / interrupted 捕获 / 守卫三件套 / guard 事件
└── （tools.ts）# AbortSignal.any 组合 + attempt 间取消检查
apps/cli/src/
└── main.ts    # 生成期输入进队列 / SIGINT 两次语义 / /think /nothink
```

参考实现对照：tagent `loop.ts`（Step 9/10/14 的完全体）；采样数据在
`captures/step13-guard-sampling/summary.json`，A/B 在 `step8-thinking-ab-*`。

## 6.9 自测清单

- [ ] 能说清 reasoning_content 双认、思考不入档、开关走协议字段的三条理由
- [ ] 能复述 strawberry 对照实验的两组数字，并解释"思考是预算消费者"
- [ ] steering 真机改向成功；能解释"注入在裁剪后、前缀只增不改"两个讲究
- [ ] 取消三实验通过；能解释为什么半截 tool_calls 绝不回填、为什么
      AbortSignal.any 是必需的（覆盖坑）
- [ ] 三守卫的检测/对策/上限能默写，且知道真实采样频率（不夸大）
- [ ] 全书至此的注入惯例统一为：user 角色 + （系统注入：…）——能说出为什么
