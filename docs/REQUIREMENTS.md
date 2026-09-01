# 需求清单

> 版本：v1.1（Step 1 ✅ + Step 2 增补）｜ 日期：2026-08-31
> 上游文档：[TECH_STACK.md](../TECH_STACK.md) ｜ 下游文档：[ARCHITECTURE.md](ARCHITECTURE.md)、[DESIGN.md](DESIGN.md)

## 1. 项目目标

在无 agent 框架的前提下，用 TypeScript 从零实现一个可用的终端 agent（tagent），通过亲手实现每个环节来理解 agent 的核心原理。**本清单限定 Step 1（最小 agent loop）范围**，Step 2-8 的需求在各自阶段再行增补。

用户与使用场景：开发者本人在终端与本地 LLM（MLX server，OpenAI 兼容接口）进行多轮对话，agent 能自主决定调用工具、执行工具、基于结果继续推理，最终给出回答。

## 2. 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-1 | LLM 对话客户端 | 通过 OpenAI 兼容 HTTP API（`/v1/chat/completions`）与本地引擎通信；`baseUrl`/`model` 可配置 | P0 |
| FR-2 | 流式输出 | 解析 SSE 流式响应，token 级实时渲染到终端；思考内容（`reasoning`）与正文分开渲染 | P0 |
| FR-3 | 工具定义体系 | 用 zod 定义工具的名称、描述、参数 schema，自动生成 JSON Schema 传给模型；工具执行函数与定义绑定 | P0 |
| FR-4 | tool call 解析与执行 | 解析模型返回的 `tool_calls`（含流式分片累积），校验参数（zod safeParse），执行工具，把结果以 `role: "tool"` 消息回填 | P0 |
| FR-5 | Agent 主循环 | 多轮"请求→工具调用→结果回填"循环，直到模型给出最终回答或达到迭代上限 | P0 |
| FR-6 | 内建工具（Step 1） | ① `get_weather`：城市天气查询（本地 mock 数据，返回 JSON）② `calculate`：四则运算表达式求值（禁止 eval，自实现解析） | P0 |
| FR-7 | 终端交互 | readline 交互式会话；斜杠命令：`/exit` 退出、`/reset` 清空上下文、`/tools` 列出工具、`/dump` 导出本轮原始消息 | P0 |
| FR-8 | 思考模式开关 | 支持 `/nothink` 切换：在用户消息尾部注入/移除 `/no_think` 标记 | P1 |
| FR-9 | 会话记录 | 每轮完整消息序列追加写入 JSONL 文件（`logs/transcript-*.jsonl`），供事后逐帧检查 agent 行为 | P1 |
| FR-10 | 基础错误处理 | 工具执行失败/参数非法时，不抛出崩溃，而是将错误信息作为工具结果回填给模型使其自我纠正；HTTP 请求失败重试 1 次 | P1 |
| FR-11 | 调试视图 | `--debug` 启动：打印每轮请求/响应的原始 JSON（学习时观察 prompt 组装与模型输出） | P1 |

## 3. 非功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| NFR-1 | core 零依赖 | `packages/core` 运行时依赖仅允许 zod；不得引入 HTTP 库（用内置 `fetch`）、不得引入框架 | P0 |
| NFR-2 | 类型安全 | TypeScript `strict: true`；工具参数类型由 zod 推导，编译期与运行期双重校验 | P0 |
| NFR-3 | 平台可移植 | 只使用跨平台 API（node:readline、node:fs、fetch），不依赖 macOS 专属能力；Windows/Linux 可直接运行 | P0 |
| NFR-4 | 可观测性 | agent 的每一轮决策（发了什么、模型回了什么、执行了什么）都可通过 transcript/`--debug` 完整还原 | P0 |
| NFR-5 | 测试性 | agent 循环逻辑可在无真实 LLM server 的情况下测试（mock 的 LLMClient 按脚本回放 tool call 序列） | P0 |
| NFR-6 | 性能 | core 自身每轮开销（消息拼装、解析、执行）< 10ms；端到端延迟由引擎决定，不在此约束 | P2 |
| NFR-7 | 引擎无关 | 同一份 core 代码可对接 MLX server 与 llama.cpp server，无需修改 | P1 |

## 4. Step 1 验收标准

全部用真实 MLX server（127.0.0.1:8081）手动验收：

| ID | 场景 | 通过标准 |
|---|---|---|
| AC-1 | 「北京今天天气怎么样？」 | 调用一次 `get_weather`（参数 `{"city":"北京"}`），基于 mock 结果给出自然语言回答 |
| AC-2 | 「3.7 乘以 12 再减 8.2 等于多少？」 | 调用 `calculate`，回答中的数值与工具返回完全一致（36.2） |
| AC-3 | 「你好，介绍一下你自己」 | **不调用任何工具**，直接流式回答（验证模型没有工具滥用） |
| AC-4 | 「对比一下北京和上海的天气」 | 同一轮出现两次 `get_weather` 调用（或两个循环轮次），最终汇总对比 |
| AC-5 | 构造无效参数（如 `get_weather("火星")`） | agent 不崩溃；错误信息回填后模型向用户说明或换参数重试 |
| AC-6 | `/dump` 导出 | JSONL 中可逐帧看到：用户消息 → assistant(tool_calls) → tool 结果 → assistant(最终回答) 的完整链路 |

## 5. 明确不做（Out of Scope，Step 1）

- 长期记忆 / 会话持久化恢复（Step 6）
- 上下文长度裁剪策略（Step 3；Step 1 依赖引擎 16K 上下文 + 短会话）
- 联网类工具（web search / HTTP 请求工具）
- 子 agent、并行任务编排（Step 7）
- 流式过程中的中途取消（AbortController 预留接口但 UI 不暴露）
- 任何 GUI；任何云 API 对接（只对接本地引擎）
- 认证、多用户、部署

## 6. Step 2 需求增补：多工具错误处理的执行策略层（2026-08-31）

> 背景：Step 1 已把「工具失败 → 错误信封回填 → 模型自愈」跑通（FR-10/AC-5）。
> Step 2 补齐三种**执行策略**缺失：工具挂死无超时、瞬时失败无重试（模型自愈要花一整轮 LLM）、迭代触顶直接报错而非降级作答。
> 实验方法论沿用项目原则：**故意搞坏一次，观察 agent 怎么失败/恢复**。

### 6.1 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-12 | 工具执行策略 | `Tool.policy`：`timeoutMs`（单次执行超时）、`retries`（瞬时失败重试次数，默认 0）、`retryDelayMs`（线性退避基数）；由 ToolRegistry 统一施加，业务工具无感 | P0 |
| FR-13 | 错误可重试分类 | 仅两类可重试：① 工具抛 `TransientToolError`（业务自报瞬时故障）② 执行超时。**不可重试**：未知工具 / JSON 残缺 / schema 校验失败 / 普通异常（确定性失败，重试必得同果） | P0 |
| FR-14 | 重试耗尽的降级信封 | 重试耗尽后的错误信封携带 `retriesUsed`，错误文案明示「已重试 N 次仍失败」，提示模型不要再调、转向如实说明或换方案 | P0 |
| FR-15 | 迭代上限降级终答 | 触达 maxIterations 仍要工具时，追加一次**无 tools 参数**的请求（协议级禁止再调工具）+ 注入降级提示，迫使模型基于已有工具结果给出文本终答；`AgentConfig.degradeOnCap` 可关（默认开，关闭则维持 Step 1 报错行为） | P0 |
| FR-16 | 故障注入实验开关 | CLI 环境变量 `TAGENT_FAULTS`（如 `get_weather:hang` / `get_weather:flaky:2` / `get_weather:down`），把内建工具按剧本搞坏——实验工具，只进壳（apps/cli）不进 core | P1 |
| FR-17 | 超时的取消语义 | 超时通过 `ToolContext.signal`（AbortController）通知工具；尊重 signal 的工具可提前清理，不尊重的仅被放弃（结果丢弃） | P1 |

### 6.2 非功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| NFR-8 | core 依赖红线不动 | 策略层纯 TS（Promise.race + AbortController + setTimeout），core 依赖仍只有 zod | P0 |
| NFR-9 | 策略对 loop 透明 | 超时/重试都发生在 registry.execute 内部，loop 与事件流契约不变（tool-result 事件仅增可选 `retriesUsed` 字段） | P0 |

### 6.3 Step 2 验收标准（AC2-x，真实引擎 + 故障注入）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC2-1 | 工具挂死（`get_weather:hang`） | 到 `timeoutMs` 后返回超时信封回填，agent **不挂死**，模型向用户如实说明 |
| AC2-2 | 瞬时故障自愈（`get_weather:flaky:1`，retries=1） | registry 内部重试成功，模型**一轮**拿到正常天气数据（LLM 视角无感知） |
| AC2-3 | 瞬时故障耗尽（`get_weather:down`） | 重试耗尽信封带 `retriesUsed`；模型不再重调该工具，向用户说明失败 |
| AC2-4 | 迭代上限降级（`--max-iterations 1` + 天气问题） | 第 1 轮工具执行后触顶 → 无 tools 降级请求 → 模型基于已有工具结果给出文本终答（而非报错死掉） |
| AC2-5 | 回归 | 单测全绿；Step 1 六场景行为不变 |

### 6.4 明确不做（Step 2）

- 工具级熔断/限流（连续失败后临时摘除工具）——等真实需求出现再说（YAGNI）
- 指数退避/jitter（线性退避已够学习用途，复杂度先不引入）
- 并行工具执行的并发策略（Step 1 即串行回填，保持协议顺序）

## 7. Step 3 需求增补：上下文管理——历史裁剪与 KV cache 复用（2026-08-31）

> 背景：REPL 长会话中 messages 无限增长，最终撞引擎 16K 上下文上限（finish_reason=length，回答被截）。
> 更深一层的矛盾：**裁剪历史会改变请求前缀，而 llama.cpp/MLX 的 prompt cache 都按前缀命中**——
> 裁剪策略与 KV cache 复用天然冲突，Step 3 的核心就是量化并调和这对矛盾。

### 7.1 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-18 | token 估算器 | 手写启发式（CJK ≈ 1 token/字，其他 ≈ 1 token/4字符，消息固定开销），**不引入 tokenizer 依赖**（core 零依赖红线）。估算器只需单调 + 量级正确，用于水位判断 | P0 |
| FR-19 | 回合完整的历史裁剪 | 以「回合」（user → assistant(tool_calls) → tool… → assistant 终答）为最小裁剪单位，**永不拆散 tool 配对**（协议硬约束）；system 永远保留；最后一回合永远保留 | P0 |
| FR-20 | 双水位裁剪 | 超过高水位（预算）才触发，一次裁到低水位（预算一半）——而不是每轮裁一点。目的：两次裁剪之间请求前缀完全稳定，KV cache 持续命中（ amortized 裁剪） | P0 |
| FR-21 | 裁剪可观测 | `context-trimmed` 事件进事件流（裁掉消息数、前后估算 token）；transcript 与 CLI 渲染消费；裁剪即遗忘——messages 仍是唯一事实来源，只是被有意压缩 | P0 |
| FR-22 | 预算可配 | `--max-context-tokens N` 启动参数；缺省 = 不裁剪（Step 1/2 行为不变） | P0 |

### 7.2 非功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| NFR-10 | 裁剪在 loop 内施加 | 架构扩展点落地：每轮请求前检查（ARCHITECTURE §6 预留的 contextStrategy 位置）；策略函数纯函数化（memory.ts），loop 只调用 | P0 |
| NFR-11 | 估算器可校准 | 用引擎 usage.prompt_tokens 实测校准误差并记录（验收产物），为后续调参留证据 | P1 |

### 7.3 Step 3 验收标准（AC3-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC3-1 | 估算器 | 单测：中英混合文本估算单调、量级合理；真机校准：同请求估算值 vs usage.prompt_tokens 误差 ≤ ±50% 且如实记录 |
| AC3-2 | 回合完整性 | 单测：裁剪后无孤立 tool 消息、无拆散的 tool_calls 配对；真机 /dump 实证消息链完整 |
| AC3-3 | 触发裁剪 | 小预算长对话（CLI 多轮提问）→ transcript 出现 context-trimmed，之后请求体消息数显著下降，对话仍正常完成 |
| AC3-4 | KV cache 复用实测 | 连续轮次 cache_n 前缀命中增长；人为"每轮裁一点"的对照请求 cache_n 骤降（前缀破坏实证）；双水位裁剪后新前缀恢复命中——timings 字段三段证据 |
| AC3-5 | 回归 | 单测全绿；无预算时行为与 Step 2 完全一致 |

## 8. Step 4 需求增补：思考模式实验与请求级开关（2026-08-31）

> 前置考据已完成（PROTOCOL §10 待考据闭环）：Qwen3.5 的 `/no_think` 消息标记在两引擎均失效；
> 正确开关 = **请求级 `chat_template_kwargs.enable_thinking`**（llama.cpp 实测双向有效：
> 默认服务器上 false 关思考、off 服务器上 true 开思考），或服务器级 `--reasoning on|off`。

### 8.1 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-23 | 请求级思考开关 | core 支持请求体携带 `chat_template_kwargs`（`ChatRequest.chatTemplateKwargs`）；`AgentConfig.thinking?: boolean` 经 loop 下发为 `{enable_thinking}`——**修复 FR-8 的 /no_think 失效实现** | P0 |
| FR-24 | CLI 思考命令 | `/think` / `/nothink` 切换 `config.thinking`（不再注入 `/no_think` 后缀——已证无效且污染用户消息）；横幅显示当前模式 | P0 |
| FR-25 | A/B 实验羻具 | `scripts/thinking-ab.mjs`：同一服务器按请求切换思考开/关，任务集 × 多采样，自动判定成功，产出成功率/耗时/token 成本三维护度 | P0 |

### 8.2 实验设计（AC4 判据的基础）

- **任务集 11 题**：5 道多步算术（有唯一数值解）、3 道常识/传递推理（关键词判定）、2 道工具任务（判 tool_calls 选择与参数）、1 道工具滥用对照（应零调用）
- **采样**：temp=0.7（agent 生产温度，保留采样随机性）每题每组建 3 份——成功率粒度 0/33/67/100%，粒度限制如实记录
- **判据**：数值题=答案含期望值；常识题=含关键词；工具题=首轮 tool_calls 名称正确且参数可解析出期望值；滥用对照=零 tool_calls
- **维度**：成功率、completion_tokens（成本）、端到端耗时

### 8.3 验收标准（AC4-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC4-1 | 请求级开关 | 单测：kwargs 进请求体；默认(不设 thinking)不携带该字段；CLI /think /nothink 生效 |
| AC4-2 | A/B 实验 | 双组各 33 样本全部跑完并存证；开组有 reasoning、关组无（抽样核验） |
| AC4-3 | 结论 | 成功率/成本/耗时三维对比表 + 至少一条非平凡观察（如思考对多步算术的提升 vs token 成本倍数） |
| AC4-4 | 回归 | 全套测试绿；默认路径（不设 thinking）与 Step 3 行为一致 |

## 9. Step 5 需求增补：ReAct 文本协议与双模式对比（2026-08-31）

> 学习目标：把「行动」从协议原生 tool_calls 换成**手写文本协议**（Thought/Action/Observation），
> 亲手实现经典 ReAct 循环；同一 ToolRegistry 复用（校验/策略/信封全继承），
> 实测对比两种驱动方式在**链式任务**（前一步结果是后一步参数）上的表现。

### 9.1 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-26 | ReAct 文本协议 | 系统提示规定输出格式（Thought/Action/Action Input 与 Final Answer）；Observation 以 user 角色追加（经典 ReAct 无 tool 消息）；**不传 tools 参数**（行动靠文本而非协议） | P0 |
| FR-27 | 手写 Action 解析器 | 从 assistant 文本提取 Action/Action Input（JSON）/Final Answer；格式错误时生成纠错 Observation 回填（自愈，继承 Step 2 哲学），不崩溃 | P0 |
| FR-28 | ReAct 引擎 | runReAct 与 runAgent 同契约：同 events（CLI 渲染/transcript 零改动）、同 messages 原地演化、同 maxIterations/思考开关/降级配置；工具执行仍走 ToolRegistry（复用全部安全层） | P0 |
| FR-29 | CLI 模式开关 | `--react` 启动文本协议模式（缺省 = 原生 tool_calls 模式）；横幅显示当前模式 | P1 |
| FR-30 | 双模式对比实验 | 链式任务集（天气→计算依赖链）× 双模式 × 3 采样，成功率/轮次/token 三维对比 + 存证 | P0 |

### 9.2 链式任务集（判据程序化）

| ID | 任务 | 依赖链 | 期望终答含 |
|---|---|---|---|
| S1 | 对比北京和上海的天气 | get_weather ×2（并列） | 两城各有数值 |
| S2 | 先查北京天气，把温度乘以 2 告诉我 | get_weather → calculate(28*2) | **56** |
| S3 | 北京和上海哪个更热？温差多少？ | get_weather ×2 → 算术 | **上海** 与 **3** |
| S4 | 杭州温度减去广州温度再除以 2 | get_weather ×2 → calculate((30-33)/2) | **-1.5** |

### 9.3 验收标准（AC5-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC5-1 | 解析器 | 单测：规范 Action/多行 JSON/Final Answer/畸形输出（缺 Action、坏 JSON）四类全过 |
| AC5-2 | 引擎 | 单测：mock 回放 ReAct 剧本（act→observation→final），messages 演化与事件契约正确；格式错误自愈路径 |
| AC5-3 | 真机 | CLI `--react` 模式跑通 S2 链式任务（weather→calculate），存证完整 |
| AC5-4 | 对比实验 | 双模式 24 样本全跑完；至少一条非平凡结论（链式任务成功率/轮次/成本） |
| AC5-5 | 回归 | 全套测试绿；原生模式行为不变 |

## 10. Step 6 需求增补：记忆机制——短期与长期的实现与取舍（2026-08-31）

> 上游铺垫：Step 1 明确把「会话持久化恢复」推迟到本步；Step 3 的裁剪是「遗忘」，
> 本步做它的对偶面「记住」。架构预留（ARCHITECTURE §6）：记忆模块 = messages 的前缀注入器。

### 10.1 概念界定

| 层 | 载体 | 生命周期 | 已有/新增 |
|---|---|---|---|
| 短期记忆 | messages 数组（会话内多轮上下文） | 单会话，受 Step 3 预算裁剪 | 已有（Step 1/3） |
| 短期持久化 | 会话快照文件（messages 序列化） | 跨进程重启，手动 | **新增**（/save /load） |
| 长期记忆 | 蒸馏事实库（追加式 JSONL） | 跨会话永久 | **新增**（remember/recall + 注入） |

### 10.2 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-33 | 长期事实库 | core `MemoryStore`：追加式 JSONL（id/ts/content/tag），load/append 持久化；**零依赖**（手写关键词召回评分：字符 bigram 重叠 + 词元交集，无向量库） | P0 |
| FR-34 | 记忆工具 | `remember(content)`：写事实；`recall(query)`：按评分取 top-K 回 JSON 信封（空结果也是合法信封）——经 ToolRegistry，继承全部安全层 | P0 |
| FR-35 | 会话持久化 | `/save [名]` 序列化当前 messages 到 `logs/saved/<名>.json`；`/load <名>` 恢复（替换 messages，system 不重复插）；`/sessions` 列出 | P0 |
| FR-36 | 启动注入（静态） | `--memory N`：会话启动时把最近 N 条事实注入 system prompt 尾部（**会话内前缀稳定**，cache 友好）；缺省 0=不注入，靠工具召回 | P1 |
| FR-37 | 记忆与预算交互 | 注入块计入估算（memory.ts 的估算器天然覆盖）；事实库无上限增长时注入块被预算裁剪兜住——交互行为单测锁定 | P1 |

### 10.3 验收标准（AC6-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC6-1 | 存储单测 | append/load 往返、召回评分排序（相关>无关）、空库召回、持久化跨实例 |
| AC6-2 | 工具单测 | remember/recall 信封（含空结果）；zod 校验 |
| AC6-3 | 跨会话真机 | 会话1「记住我喜欢喝美式咖啡」→ /exit；**新进程**会话2 问「我喜欢喝什么？」→ recall/注入命中 → 正确回答；全程存证 |
| AC6-4 | 取舍分析 | 注入策略对比表入档（静态注入 vs 工具召回 vs 逐问注入）——引用 Step 3 cache 实测数据；记忆增长×预算交互说明 |
| AC6-5 | 回归 | 全套测试绿；无 --memory 时行为与 Step 5 一致 |

## 11. Step 7 需求增补：子 agent 与编排（2026-08-31）

> 架构预留兑现（ARCHITECTURE §6）：子 agent = 一个工具。`delegate(task)` 的 execute
> 内部再起 runAgent——**上下文隔离**（子 agent 独立 messages，只拿任务描述，返回摘要），
> 这是 Step 3 裁剪之外的另一种上下文管理手段：隔离 vs 遗忘。

### 11.1 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-38 | delegate 工具 | `delegate(task)`：内部起子 agent（独立 messages + 独立 system prompt + 缩小的 maxIterations），返回终答摘要 + 子过程统计（轮次/工具调用数） | P0 |
| FR-39 | 递归防护 | 子 agent 的 registry **不含 delegate**（深度锁定 1 层）——子 agent 不能再开子 agent | P0 |
| FR-40 | 上下文隔离 | 子任务细节不进父上下文（父只收到摘要信封）；子 agent 看不到父对话（task 必须自包含）；子过程证据由 wire 记录器在 fetch 层自动保全（token 溯源不断链） | P0 |
| FR-41 | 编排能力 | 同轮多个 delegate 调用 = 并行分解（协议原生）；结果按协议顺序回填聚合——**顺序执行**保证配对顺序（真并行执行明确不做，见 DESIGN） | P1 |
| FR-42 | CLI 开关 | `--delegate` 启用委托工具（缺省不注册，保持前序验收可复现） | P1 |

### 11.2 验收标准（AC7-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC7-1 | 单测 | mock：delegate 返回子终答；子 registry 无 delegate（递归锁）；父 messages 无子过程细节泄漏 |
| AC7-2 | 真机委托 | `--delegate` + 多城市任务：父 agent 委托子任务（或同轮多委托），聚合出正确结论（如最热城市） |
| AC7-3 | 隔离与成本 | 存证显示子调用独立 session 单元；对比同任务直做 vs 委托的轮次/token（隔离的代价或收益） |
| AC7-4 | 回归 | 全套测试绿；无 --delegate 时行为与 Step 6 一致 |

## 12. Step 8 需求增补：模型能力对比——4B → 9B（2026-08-31，收官步）

> 目标（README 学习路线）：观察能力上限对 agent 行为的影响。**复用前七步的实验羻具**，
> 同方法学重跑，4B 数据全部已在库（step4-thinking-ab / step5-react / win-ac-*）。

### 12.1 范围决策（如实）

- **9B（Qwen3.5-9B-UD-Q4_K_XL，5966MB）**：32GB 内存无压力，CPU 预计 ~5-6 tok/s——可跑全量实验
- **27B 明确不做**：纯 CPU 预计 <2 tok/s（带宽线性缩放），实验电池不可行；留待 GPU 环境（边界如实记录）

### 12.2 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-43 | 模型覆盖参数 | 实验羻具（thinking-ab / react-vs-native）支持 `AB_MODEL`/`RN_MODEL` 环境变量覆盖模型路径——同一羻具跑任意模型 | P0 |
| FR-44 | 9B 回归验收 | 六场景验收（acceptance-win.sh）在 9B 上复跑全过——能力上限提升不破坏基础行为 | P0 |
| FR-45 | 思考 A/B 复测 | Step 4 实验原样重跑（11 题×3×开关）：重点检验「思考不收敛烧预算」是否 4B 特有 | P0 |
| FR-46 | 三方驱动复测 | Step 5 实验原样重跑（S1~S4×3×三模式）：react-text 在更强模型上是否仍失败 | P0 |
| FR-47 | 行为差异复查 | AC-5 火星场景在 9B 上的行为（4B 拒绝调用 / Mac-MLX 会调用）——工具谨慎度是否随能力变化 | P1 |

### 12.3 验收标准（AC8-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC8-1 | 9B 基准 | llama-bench 数据入库（与 4B 同表）；六场景验收全过存证 |
| AC8-2 | 思考 A/B | 双组 33 样本跑完；与 4B 结论对照（成功率/成本/失败模式是否变化） |
| AC8-3 | 三方驱动 | 36 样本跑完；react-text 成功率对比 4B 的 75% |
| AC8-4 | 综合结论 | 4B vs 9B 对比报告：至少三条能力上限带来的 agent 行为变化（或不变），全部有存证 |

## 13. R3 需求增补：移动瘦客户端（2026-09-01，路线收官后的扩展方向）

> 学习路线八步收官后选定的扩展方向。**手机只做壳**：HTTP 客户端 + 渲染，
> agent 大脑（循环/工具/记忆）仍在家庭服务器——验证「大脑与壳经协议解耦」
> 能否跨到第三种壳语言（Java/Android，前两种：TypeScript CLI、curl）。
> v1 边界：单轮直答（无工具循环）、历史内存态（无持久化）、明文 HTTP（仅局域网 adb reverse）。

### 13.1 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-48 | 零依赖 LLM 通道 | `HttpURLConnection` + 内置 org.json 手写 SSE（与 core/client.ts 同构：`data:` 帧、`[DONE]` 收尾、reasoning/reasoning_content 双认）——不引入任何第三方库 | P0 |
| FR-49 | 思考开关（防过度思考） | 请求级 `chat_template_kwargs.enable_thinking` 开关交还用户，**默认关**——Step 4/8 已实证弱模型思考不收敛，移动端 CPU 场景更亏 | P0 |
| FR-50 | 渲染节流 | token 增量先入缓冲，~120ms 批量刷屏——逐 delta 全量重排是 O(n²)，千级增量可压垮主线程（AC9-3 实证） | P0 |
| FR-51 | JSON null 安全 | SSE delta 的 null 字段（llama.cpp 首帧常带）不得渲染为字面量 `"null"`（org.json `optString` 陷阱） | P0 |

### 13.2 验收标准（AC9-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC9-1 | 管道 | 真机发消息 → llama.cpp 日志出现对应请求并完成（服务器侧 ground truth） |
| AC9-2 | 中文多轮 | 中文消息连续多轮往返；prompt eval token 数远小于全量提示 KV cache 前缀命中（历史确实在累积） |
| AC9-3 | 防过度思考 | 同一挑战题：思考开 vs 关的 token/耗时对照（服务器日志），关思考且答案正确 |
| AC9-4 | 视觉核验 | 截图存证 + 独立视觉模型逐字读屏复核（用户消息/回复/开关状态如实可读） |
| AC9-5 | 环境归还 | 自动化用输入法（ADBKeyboard）测后还原用户原输入法 |

## 14. Step 9 需求增补：循环守卫（2026-09-01，调研驱动步）

> 来源：docs/SURVEY.md §5 缺口 1（hermes-agent/pi 的循环鲁棒性守卫）。弱模型实测行为：
> 发呆（空内容无调用）、复读（相同工具调用反复发）、被 max_tokens 截断出残缺调用
> （Step 4 思考烧穿即此场景）。这三类失败**不抛错但也不干活**，现有 loop 只能等它
> 跑满 maxIterations。守卫原则沿用 FALLBACK.md：对策全部可观测、可关闭、有限次。

### 14.1 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-52 | 空响应守卫 | 模型轮空内容且无工具调用 → 注入 user 提示（nudge）让其继续；连续 3 次空响应放弃守卫按 final 诚实收场；nudge 进 messages（真实发生的上下文注入必须入档） | P0 |
| FR-53 | 重复检测 | 工具调用批次签名（name+规范化参数）连续相同：第 3 批执行后附警告注入；第 5 批不再执行、直接走触顶降级终答（视为卡死） | P0 |
| FR-54 | length 截断判错 | finish_reason=length 且解析出 tool_calls → **不执行**（协议说截断即不猜完整性），逐个回填错误 tool 结果让模型重发（pi 契约：框架不猜，模型重发）；无 tool_calls 的截断终答发 guard 事件标注内容可能不完整 | P0 |
| FR-55 | 守卫可观测可关闭 | 三守卫动作均发 `guard` 事件进事件流（transcript 存证）；`config.guards` 三开关默认全开、可逐项关闭（实验对照组） | P0 |

### 14.2 验收标准（AC10-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC10-1 | 空响应 | LLM 层故障注入 2 次空响应后恢复 → 2 条 nudge 入 messages 且 guard 事件可见、任务完成；连续 3 次空 → final 诚实收场 |
| AC10-2 | 重复 | 注入重复工具调用 → 第 3 批出现警告注入事件、第 5 批前停止执行、降级终答产出 |
| AC10-3 | length | 注入截断 tool_calls → 未执行（registry 零调用）、回填错误结果、下轮重发成功、任务完成 |
| AC10-4 | 回归 | guards 全关 = Step 8 行为（既有测试全绿）；真机六场景验收不回归 |

## 15. Step 10 需求增补：Steering 打断通道（2026-09-01，调研驱动步）

> 来源：docs/SURVEY.md §5 缺口 2（pi steer/followUp 双队列；hermes redirect 保持缓存前缀）。
> 现状：CLI 生成期间 `rl.pause()` 拒绝输入，agent 在错误方向跑满 maxIterations 才停——
> 本地 CPU 推理一轮几十秒，打断通道的体验价值比云端更高。
> 语义取 pi 的 steer：**注入不硬中断**——用户指令排队，在下一次 LLM 请求前生效；
> 追加注入保持前缀稳定（只 append，不动历史，KV cache 前缀命中不受损）。

### 15.1 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-56 | SteeringChannel 注入通道 | `runAgent` 可选第 4 参：每轮 LLM 请求前 `take()` 取走排队指令，以 user 消息追加进 messages（role 交替合法、前缀只增不改）；**第 1 轮不注入**（首轮时用户最新意图就是初始消息本身） | P0 |
| FR-57 | steering 事件 | 每条注入发 `steering` 事件进事件流（transcript 存证可回放） | P0 |
| FR-58 | CLI 生成期接收输入 | 生成期间不再 pause：普通输入进 steering 队列（渲染确认提示），`/` 命令仍即时生效；生成结束时队列若有余量，按 followUp 语义转为下一轮提问（不丢弃用户输入） | P0 |

### 15.2 验收标准（AC11-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC11-1 | 注入生效 | 单测：round 2 的 llm-request 在 tool 结果后含注入的 user 消息 + steering 事件可见；round 1 永不注入 |
| AC11-2 | 真机改向 | CLI 生成期间注入"改成查上海"→ 第二轮请求含该指令（transcript 可证）→ 模型实际改查上海 |
| AC11-3 | followUp 余量 | 生成结束后队列余量转为下一轮提问，不静默丢弃 |
| AC11-4 | 回归 | 无 steering 通道时行为与 Step 9 完全一致（既有测试全绿）；六场景验收不回归 |

边界（如实）：本步只做"注入"不做"硬取消"（中断进行中的流/工具是取消语义，AbortSignal
留待并发步）；runReAct 不接 steering（ReAct 引擎留待需要时）。

## 16. Step 11 需求增补：摘要压缩（2026-09-01，调研驱动步）

> 来源：SURVEY.md 缺口 3（与 hermes/pi 存在代差：我们只有丢弃式裁剪）。
> 三家公共内核取来：确定性 pre-pass 先于 LLM（能省一次调用就省）、LLM 摘要
> 保标识符、**用户消息永不压缩**。层次语义：**压缩优先（保信息），丢弃兜底（保预算）**。

### 16.1 边界裁决（用户观点入档，2026-09-01）

- **相邻去重：可以做，但仅限字节级完全相同的 user 消息**（手滑重发/队列重放）。
  "意思一样就合并"是语义判断 = 改写，不做。
- **语气词/错别字：不改写。** 三个结构性理由：① 破坏溯源链——llm-request 存证
  发的是清理版，用户手敲原文，任务级复现（TRACEABILITY §6）直接断掉；② 风险
  不对称——错别字可能承载意图（方言/缩写/黑话被"修正"即改意），语气词是指令
  强度信息，清理只省几十 token；③ 弱模型判断错别字不可靠，改错风险大于收益。
- **丢弃 ≠ 改写**：钉住的 user 原文若极端超预算，允许被"整轮丢弃"（Step 3 既有
  行为，裁剪即遗忘且明示），但仍不允许被摘要吞掉或改写一个字。

### 16.2 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-59 | 相邻去重（阶段 0） | 字节级完全相同的相邻 user 消息只保留第一条；不同内容/不相邻不动 | P0 |
| FR-60 | 确定性 pre-pass（阶段 1） | 超预算时从最旧开始把 tool 结果降级为一行（`[工具结果已降级｜原文约N字] 前120字…`）；降级后达标则**不发起 LLM 调用**（零 LLM 成本路径） | P0 |
| FR-61 | LLM 摘要（阶段 2） | pre-pass 不够时：按 trim 同款边界选出旧轮，一次 LLM 调用生成事实性摘要；产物 = 各轮 **user 原文钉住** + 一条 system 摘要消息；摘要函数依赖注入（core 不做 LLM 调用），异常时退回纯裁剪（兜底） | P0 |
| FR-62 | 轻量 Anchor Index | 被摘要文本程序性抽取文件路径与长数字串（去重前 10 条）附在摘要尾部——摘要模型漏掉的标识符兜底 | P1 |
| FR-63 | context-compacted 事件 | 压缩动作可观测：去重数/降级数/摘要轮数/fromTokens/toTokens 进事件流 | P0 |

### 16.3 验收标准（AC12-x）

| ID | 场景 | 通过标准 |
|---|---|---|
| AC12-1 | 阶梯触发 | 单测：不超预算零动作；超预算 pre-pass 达标则零 LLM 调用；仍超才摘要 |
| AC12-2 | 用户消息钉住 | 摘要产物中被压缩轮的 user 消息与原文逐字节一致；语气词/错别字原样 |
| AC12-3 | 兜底链 | summarize 异常 → 退回纯裁剪（Step 3 行为）；钉住后仍超预算 → trim 兜底 |
| AC12-4 | 真机长会话 | --compact 小预算多轮任务：context-compacted 事件出现、摘要调用报文入 wire 存证、任务仍完成；六场景回归不回归 |
