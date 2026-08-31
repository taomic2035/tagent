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
