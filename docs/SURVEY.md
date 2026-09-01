# SURVEY.md —— 三个开源 agent 项目的核心机制调研

> 调研日期：2026-09-01 ｜ 调研对象：[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)、
> [earendil-works/pi](https://github.com/earendil-works/pi)、[zts212653/clowder-ai](https://github.com/zts212653/clowder-ai)
>
> **调研纪律**：只看核心机制（主循环/工具系统/上下文管理/子 agent/记忆/协议抽象/安全/可观测性），
> 明确忽略 UI、主题、插件市场、品牌周边、部署脚本。所有结论基于源码原文（raw.githubusercontent.com）
> 与仓库内 docs 抓取，关键机制附文件路径；巨文件（>200KB）只能读到头部时已如实标注。
>
> **对照基准**：本项目（tagent）八步学习路线已收官的能力——自研 loop（maxIterations+触顶降级）、
> zod→JSON Schema 工具 + 错误信封 + 分类重试、双水位裁剪（回合完整/前缀稳定，KV 命中 78%）、
> 请求级思考开关、ReAct 双协议 vs native、三层记忆、delegate 子 agent、
> trace (seq→frame→line→byte) 三方印证存证制度（见 docs/ACCEPTANCE.md、FALLBACK.md）。

---

## 0. 三个项目的一句话定性

| 项目 | 语言/规模 | 定位 | 它的"本体" |
|---|---|---|---|
| hermes-agent | Python 巨石（run_agent.py ~463KB、cli.py ~1MB、conversation_loop.py ~3900 行） | 自改进的远程常驻个人 agent（$5 VPS + Telegram/Discord 网关） | **上下文经济学**：四层压缩体系 + 把 KV/prompt cache 命中当作贯穿一切设计的硬约束 |
| pi | TypeScript monorepo（packages/ai、agent、coding-agent 等） | "AI agent toolkit"：统一 LLM API + agent loop + TUI + coding CLI | **干净的核心 + 一切非核心推出去**：steering 打断、会话树、jiti 热插拔扩展系统 |
| clowder-ai | TS monorepo（api/web/mcp-server，493 commits、30+ domain） | 多猫（多 CLI agent：claude/codex/gemini/kimi...）协作平台 | **多 agent 责任治理**：没有自研 loop（spawn CLI 子进程），全部工程押在"谁该行动、谁完成了、失败归谁" |

定性本身就是第一条结论：**tagent 与 hermes 同族**（自研 loop + 本地引擎），差距集中在上下文管理深度；
**tagent 与 pi 同语言同分层**，差距集中在核心循环语义的丰富度；**clowder 的本体（多 agent 编排）
是平台级工程**，学习项目不背，但它的责任治理原则单件可抄。

---

## 1. hermes-agent（NousResearch）——上下文经济学的极端形态

### 1.1 主循环（agent/conversation_loop.py、iteration_budget.py）

- 结构：`run_conversation()` 驱动一个 user turn；turn 前置 prologue（`build_turn_context`）：
  用户消息消毒、system prompt 恢复/重建、**压缩预检**（超时直接以 `compression_exhausted` 提前结束）。
  每次迭代：排空中途改向 → 检查点管理器 `new_turn()` → 中断检查 → 迭代预算检查 → 模型调用 → 工具分发。
- 循环谓词：`while (api_call_count < max_iterations and iteration_budget.remaining > 0) or agent._budget_grace_call`
  ——**预算耗尽后额外给一次 grace call 让模型收尾**。
- 预算：`IterationBudget` 线程安全计数器（consume/refund）；亮点是 **`execute_code` 的迭代会被 refund 不占预算**
  （机制上鼓励模型用程序化调用）。文档两处对默认上限表述不一（500 vs sys.maxsize），
  后者场景靠 `_MAX_OUTER_LOOP_ERRORS = 8`（一个 turn 内最多 8 次外层异常）兜底。
- **循环鲁棒性守卫**（细粒度，本项目暂无对应物）：
  `empty_response_guard.py`（空响应 → 注入"处理上面的工具结果并继续"）、
  `repetition_guard.py`（重复循环检测）、丢工具调用时注入"现在请发出实际工具调用"的 nudge、
  `bounded_response.py`、`deadline.py`。
- **中途改向（redirect）**：用户在 agent 工作中途发新消息不排队，`_apply_active_turn_redirect`
  插入 checkpoint + 修正指令，且**显式保持 role 交替与缓存前缀不变**。

### 1.2 工具系统（tools/registry.py、toolsets.py、code_execution_tool.py）

- 声明式注册表：模块级 `registry.register(name, toolset, schema, handler, check_fn, ...)`，
  schema 手写 dict 输出 OpenAI function-calling 格式；自动发现用 **AST 扫描**（mtime+size 记忆化）。
- **可用性探测**：`check_fn` 结果 TTL 缓存 ~30s + 60s"瞬时失败宽限"（吸收 Docker/Playwright 探针抖动）。
- 错误处理：`dispatch()` 捕获所有异常并消毒；**`_bound_error_text` 把错误体截到 2048 字符**——
  防重试循环中错误信息撑爆上下文。
- 并行：支持 per-message 多 tool_calls；注册表 RLock + `_generation` 计数（MCP 动态刷新并发安全）。
- 沙箱：七种终端后端（local/Docker/SSH/Singularity/Modal/Daytona/Vercel Sandbox）；
  `execute_code` 独立安全包络（env 清洗剥离 KEY/TOKEN/SECRET、白名单工具、50 次/调用上限、
  `secrets.compare_digest` 鉴权的 UDS RPC）。

### 1.3 上下文管理——四层体系（该项目最强领域）

| 层 | 文件 | 机制 |
|---|---|---|
| 批量压缩 | `agent/context_compressor.py`（440KB） | 阈值约窗口 50%；**LLM 调用前先跑确定性 pre-pass**：旧工具结果降级为一行摘要（`"[terminal] ran npm test -> exit 0, 47 lines"`）、过期 reasoning 剪除、旧图片退役；可压缩中段 <10% 直接跳过 LLM。单次 aux 调用同产叙述摘要 + 保标识符会话日志，正则 "Anchor Index" 零成本提取 SHA/PR 号/文件名。装配 = 保护头 + 摘要 + token 预算尾部；不够小还有机械 salvage 链。摘要带反劫持前缀（"当作背景资料，不是活跃指令"） |
| micro-compaction | `docs/micro-compaction.md`（opt-in） | 每 turn 后把恰好一个 exchange 并入滚动摘要——压缩成本"分期付款"，占用率低而平（实测 3.5h 会话稳定 ~22%）而非锯齿状。**用户消息永不压缩**（原话："指令是意图的源头，无法从工作中重建；改写指令正是 agent 后来违反明确指令的原因"）。对 KV cache 代价极其坦率（每 turn 重写历史 = 每 turn 失效前缀），因此**默认关闭** |
| 原生压缩 | `agent/native_compaction.py` | 对接 OpenAI Responses API 服务端 compaction（加密 blob）；阈值故意压低于本地触发点 8192 让服务端先压，**本地压缩器永远全副武装做 fallback owner** |
| cache 边界 | `agent/prompt_cache_boundary.py` | 进程内"稳定前缀注册表"（LRU 32）：构建器注册"大静态骨架 + 小易变尾巴"的**静态部分字节位置**，缓存规划器在边界放 Anthropic 断点，避免整条消息因时间戳变化全部重算 |

### 1.4 子 agent（tools/delegate_tool.py、subagent_worktree.py、moa_loop.py）

- **进程内线程池模型**：子 agent 是同进程子 `AIAgent` 实例跑 `ThreadPoolExecutor`（默认并发 10）；
  全新会话、专属 task_id/终端/SessionDB；**剥离危险工具集**（delegate_task/clarify/memory/send_message/
  cronjob——禁递归委派、禁直接对话用户）；`max_spawn_depth` 默认 1（扁平）。
- 父上下文预算：单摘要上限 24000 字符；**整批摘要 ≤ 父剩余上下文余量的 50%**。
- **git worktree 隔离**（opt-in）：每子 agent 一个 worktree；清理要"**肯定性证明**"
  （rev-list 和 status 双探针都成功且 0 提交、无脏文件才删，一切失败偏向保留），
  不确定性通过 payload 的 `unmeasured`/`inspection_failed` 字段显式传给父 agent。
- **MoA 顾问层**（`moa_loop.py`）：参考模型（≤8 线程）**只咨询不执行**（对话压平成纯文本视图），
  聚合后由普通 agent 循环执行——执行权不分裂。

### 1.5 记忆——"self-improving"产品主张（memory_manager.py、background_review.py、curator.py）

- 存储 = 文件（MEMORY.md / USER.md，`§` 分块）；写入**全部后台化**（单 worker 串行，写失败彼此隔离）。
- 召回：turn 前 prefetch；召回内容包在 fenced block 并标注"**是召回数据，不是新的用户输入**"（防注入），
  流式 scrubber 从输出剥离这些块。
- **background_review（最有意思）**：每 turn 结束后在守护线程 fork 一个自己，问
  "这轮是否暴露了该存的偏好？该补什么 skill？"——**故意继承父的模型与缓存的 system prompt**
  （命中同一 prefix cache，廉价热读）；新用户 turn 到来时取消 in-flight 审查。
- **curator**：空闲触发（≥7 天未整理且空闲 ≥2h）；确定性规则不花 LLM（30 天标 stale、90 天归档）；
  **永不删除只归档**；"use_count=0 是证据缺失，不是过时证据"。

### 1.6 Provider 抽象（providers/base.py、chat_completion_helpers.py）

- `ProviderProfile` 纯声明式 dataclass（"描述行为，不拥有 client 构建"）；未知 provider 回退 generic
  OpenAI 兼容。钩子处理各家怪癖（OpenRouter extra_body vs Kimi 顶层字段、`OMIT_TEMPERATURE` 哨兵）。
- 流式：自备容错 SSE 解析器（处理 provider 发 `event: error` 带**非 JSON** data）；
  工具调用 delta 跨块拼接 + `_repair_tool_call_arguments` 修复；`<think>` 内联回退提取；
  **stale 流断路器**（连续 5 次放弃）、TTFB/idle/墙钟三重 watchdog。
- **auxiliary client**：便宜模型专槽（压缩/审批/策展），主会话与辅助任务解耦。

### 1.7 安全与可观测（tools/approval.py、estop.py、checkpoint_manager.py）

- 审批流水线：命令**归一化**（ANSI 剥离、NFKC、`$IFS` 展开）防混淆 → hardline floor（--yolo 也拦：
  mkfs/dd/根删除/fork 炸弹）→ 用户 deny 规则 → ~47 条危险 pattern → 审批面板；
  **YOLO 标志 import 时冻结**（每调用重读环境变量构成"prompt injection 提权路径"）。
- estop：哨兵文件全局急停（`~/.hermes/ESTOP`），stat 出错 **fail-safe 判定为已暂停**。
- 可观测：observer hook 契约（`hermes.observer.v1`，六族只读 hook + 稳定关联 ID）；
  SessionDB（SQLite，FTS5 全文索引，压缩**软归档不删数据**）；**checkpoint_manager**：
  单一共享影子 git 库快照工作目录（内容寻址跨项目去重），restore 前先快照（可撤销撤销），
  safe mode 用 sha256 台账确保**用户手工改过的文件绝不被回滚覆盖**，LLM 完全不可见此机制。

### 1.8 独有设计（别的项目没有的）

1. **`execute_code` 程序化工具调用**（code_execution_tool.py，104KB）：LLM 不发 N 个工具调用，
   而是写一段 Python，经 UDS RPC 回调父进程的真实工具函数；**只有脚本 stdout 进入上下文，
   中间工具结果永不进入 context window**；本地路径走会话级持久 kernel（变量/imports 跨调用存活）；
   迭代预算还 refund 这次调用——对"上下文窗口是稀缺资源"最激进的回答。
2. **KV/prompt cache 意识作为全局纪律**：不是一个模块而是散布各处的决策纪律
   （前缀注册表 / background_review 继承缓存 prompt / curator 走 aux 模型"不碰主会话缓存" /
   micro-compaction 因缓存代价默认关闭）。
3. **有损但可恢复**：压缩 stub 带恢复指针 + FTS5 保持可检索（压缩从"灾难性信息损失"变成"索引问题"）
   + 影子 git 快照把"agent 犯错"变成廉价可回滚。

---

## 2. pi（earendil-works）——干净核心 + 扩展点哲学

### 2.1 主循环（packages/agent/src/agent-loop.ts）

- 双层循环：外层处理 follow-up 队列，内层 `while (hasMoreToolCalls || pendingMessages)`；
  `prepareNextTurn` 允许**每轮中途换 context/model/thinkingLevel**。
- 终止：stopReason error/aborted；`shouldStopAfterTurn` 回调；**工具批次全部返回 terminate: true（AND 语义）**；
  无 tool call 且无排队消息。**无内置 maxTurns**——轮数控制交给宿主回调。
- **Steering / Follow-up 双队列（最核心的设计）**：`agent.steer()` 在**工具还在跑时**注入打断消息
  （下轮 LLM 调用前生效），`followUp()` 在无工具调用时排队追加；各有 one-at-a-time / all 排空模式。
  动机：交互式 agent 的核心痛点是"agent 在错误方向上跑太久"，打断必须是 loop 语义而非 UI hack。
- **截断防护**：stopReason=length 时 `failToolCallsFromTruncatedMessage` 把流式抢救出的不完整工具调用
  全部判错，错误文案指示模型 "Re-issue the tool call with complete arguments"——**由模型重发而非框架猜测**。
- 边界纪律：全程 `AgentMessage`，只在 LLM 调用边界转 `Message[]`（UI-only 消息永不进入 LLM 边界）。

### 2.2 工具系统（packages/agent/src/types.ts、harness/tools/）

- TypeBox schema 声明（非 zod）；默认 `parallel`——逐个 `prepareToolCall` 校验后以 thunk 收集、
  `Promise.all` 执行、**结果按 assistant 源顺序回填**；任一工具声明 sequential 则整批串行。
- 错误语义：**工具失败必须抛异常**（"Throw on failure instead of encoding errors in content"），
  框架捕获转 `isError: true` 结果。
- **写竞态序列化**（file-mutation-queue.ts）：按 canonical path（符号链接/相对路径归一）建 Promise 链
  FIFO 队列，`WeakMap<ExecutionEnv>` 按环境隔离——并行调用对同一文件的写自动串行，不同文件互不阻塞。
- 钩子：`beforeToolCall` 可 `{ block: true, reason }` 拦截；审批类功能（permission-gate、
  confirm-destructive）全是官方扩展，建在这对钩子上，**框架本身不内置审批**。

### 2.3 上下文管理（harness/compaction/、api/openai-prompt-cache.ts）

- 触发：`contextTokens > contextWindow - reserveTokens`（默认 reserve 16384、keepRecent 20000）；
  拒绝连续压缩。
- **token 估算混合策略**：优先取最后一条 assistant 消息的**真实 usage**（缓存 token 计入窗口），
  尾部用 chars/4 启发式 + 图片折 4800 字符。
- **切点约束**：合法切点只能是 user/assistant/执行/摘要边界——**toolResult 永不做切点**
  （不拆 call/result 对；与本项目"回合完整"同构）；切点落在回合中间则回合前缀单独摘要。
- **增量摘要**：已有摘要时走 UPDATE 提示词（首条规则 "PRESERVE all existing information"）；
  输出结构化模板（Goal/Constraints/Progress 勾选/Key Decisions/Next Steps/Critical Context）；
  **文件账本**（readFiles/modifiedFiles）跨压缩延续。
- **自包含检查点**：compaction entry 内嵌 `retainedTail`（逐字保留的近期消息），可独立重建上下文。
- KV cache 意识在 provider 层：`StreamOptions.sessionId` → `prompt_cache_key`（提高前缀命中）；
  Usage 完整记录 cacheRead/cacheWrite，有 cache-stats 跟踪命中率。

### 2.4 子 agent（官方扩展，非核心）

- 每次 spawn 独立 pi 进程（`pi --mode json -p --no-session`）——**进程级隔离**；
  父视角是普通工具，逐行解析子进程 stdout 的 JSON 事件流。
- 三种编排：single / chain（`{previous}` 占位符）/ parallel（并发上限 4、任务上限 8、单任务输出截 50KB）。
- agent 定义是 markdown（planner/scout/worker/reviewer），项目级 agent 因 repo 可控，运行前弹确认。
- 中断传播：父 AbortSignal → SIGTERM，5s 后 SIGKILL。
- 进程内替代：**lane 机制**（同一会话树上开并行分支）。

### 2.5 记忆——刻意没有认知记忆

- `session/memory.ts` 只是进程内存版 SessionStorage（测试基线），命名有误导。
- 长期"记忆"由三件事承担：会话可 resume/**fork**；**Skills 渐进披露**（SKILL.md frontmatter 的
  name+description 以 XML 格式进系统提示，完整指令由模型用 read 工具**按需加载**——
  "only descriptions are always in context"）；AGENTS.md 上下文注入。
- 无向量召回、无自动跨会话摘要注入——刻意边界。

### 2.6 Provider 抽象（packages/ai）——最厚的一层

- 两层抽象：`Api`（10 种协议）× `Provider`（40 家厂商），`KnownApi | (string & {})` 开放自定义
  （保留 IDE 补全又允许任意字符串）。
- **compat 条件类型**：`Model<TApi>["compat"]` 按 API 分发方言差异（thinkingFormat/maxTokensField/
  cacheControlFormat/supportsStrictMode）——**一个 adapter 适配各家方言**，而非每家一个 adapter。
- 流式契约：AssistantMessageEvent 12 种变体（text/thinking/toolcall 各 start/delta/end），关键契约
  "request/model/runtime failures should be encoded in the returned stream, not thrown"。
- **llama.cpp 是专用 provider**（非通用兼容路径）：对接 llama-server 路由模式，按需加载/卸载 GGUF、
  从 HF 搜索下载量化版；工具调用要求服务端 `--jinja`；"does not silently unload models"。
- 附加：constrainedSampling（json_schema strict 或 Lark/regex grammar——与本项目受限解码同思想）、
  deferred tools（异步工具跨进程持久句柄）、thinkingSignature（推理内容跨轮回传）。

### 2.7 安全（docs/security.md、project-trust.ts）

- **有意不内置沙箱**（作者明确反对进程内"部分沙箱"误导用户）；真隔离外置（micro-VM/Docker/策略沙箱）。
- **Project trust**：默认 ask，只决定是否加载项目本地的 `.pi/` 资源（防仓库偷改 agent 配置）——
  "input-loading guard, not a sandbox"。
- 供应链加固值得抄：依赖锁精确版本、`min-release-age=2`（拒绝当天发布的依赖）、
  lockfile 变更需环境变量放行、CI `--ignore-scripts`。

### 2.8 可观测与会话格式（docs/session-format.md）

- `~/.pi/agent/sessions/**/*.jsonl`：首行 SessionHeader，条目以 id/parentId 构成**树**；
  每条 assistant 消息带完整 usage（含 cacheRead/cacheWrite 与分项 cost）；bash 执行带 exitCode/
  完整输出落盘路径；**压缩与分支摘要的生成 usage 也计入会话总额**。
- 重放/分支：`branch(entryId)` 原地回退、`branchWithSummary()` 为被放弃分支生成摘要、`/fork` 记录父会话。
- `onPayload/onResponse` 钩子拿到发给 provider 的原始请求/响应——**把"抓原始报文"做成 LLM 层标准接口**
  （与本项目 trace 制度等价，方向相反：我们制度先行于框架）。

### 2.9 独有设计

1. **Steering 双队列**（见 2.1）。
2. **会话树 + 带摘要的分支 + 自包含 compaction 检查点**：探索-回退不丢信息；上下文工程的每次手术
   （压缩/分支/回退）可持久化、可重建、不破坏工具配对。
3. **Self-extension**：扩展是进程内 TS 模块经 jiti（moduleCache: false）动态编译——无需构建步骤，
   `.ts` 即写即用；可 `registerTool/registerProvider/registerCommand/registerMessageRenderer`；
   agent 可以**在会话中给自己写一个扩展并加载**（70+ 官方示例：subagent、permission-gate、plan-mode
   全是扩展而非核心代码）——把一切非核心推出核心，核心只留稳定扩展点。
4. **（进行中）可步进 harness**：`drive: "manual"` + ActionInfo 步骤枚举（append_entry/stream_assistant/
   execute_tool/hook/sleep…），宿主 peekAction/executeAction 逐步驱动——**确定性重放与测试**：
   agent 运行变成可单步、可注入、可验证的状态机。当前为 API 骨架，契约值得关注。

---

## 3. clowder-ai（zts212653）——多 agent 责任治理平台

### 3.0 定性纠偏

**clowder-ai 不是手写 agent loop 的项目**。默认路径 = spawn 现成 agent CLI 子进程
（claude/codex/gemini/kimi/opencode/antigratomy）+ 解析 NDJSON 事件流；loop 本体（含压缩）是 CLI 内部黑盒。
决策依据 `docs/decisions/001-agent-invocation-approach.md`：纯 API 路线"失去 agent 能力"被否决，
SDK 路线"只能 API key 付费、无法用 Max/Plus/Pro 订阅额度"被否决 → "CLI 子进程 + MCP 回传"。
唯一例外是 opt-in 的 **CatAgentService（F159）**——直连 Anthropic API 的自建 agentic loop，
硬性限制为只读工具集（15 轮上限、单 prompt 起步、严格 SSE fail-closed、手写 Anthropic 流解析）。
定位："轻量任务省 CLI 启动开销"，比本项目 core 简单一个量级。

### 3.1 编排内核——A2A 投递（docs/architecture/a2a-protocol.md）

建立在恰好三个对象上：Queue Entry（持久化排队输入）、Chat History Message（共享时间线，order key）、
Active Run（内存中一次 admitted 调用）。核心不变量：

- **单一 admission 事务**：排队输入→历史消息→processing 气泡→Active Run 在一个持久事务里切换；
  "顺序、副作用、谁下一个行动只在切换点改变"。
- **事件驱动 drain（非定时器）**：只在实际改变队头可执行性的事件后触发 + dirty-bit；
  结构不变量："不可能稳定停留在 队列非空+头可执行+无 Active Run+无 drain"。
- **一 run 一 terminal**：completed/failed/canceled 幂等（重启后合成 interrupted 走失败路径）；
  已提交 terminal 的 same-generation replay 返回已提交结果。

### 3.2 @mention 路由六层（docs/architecture/at-mention-routing-system.md）

解析（**只有行首 @ 才路由**；剥离代码块/URL/引号；≤2 目标/消息）→ 目标解析 → 回退梯级
（显式@→@all→最近 5 条用户消息→最后健康回复者→线程偏好→默认）→ 分发（默认串行交接链；
并行 multi-mention 状态机；**护栏：链深 10、同轮去重合并、乒乓检测（同一对猫来回踢球 N 轮后
注入警告逼它做决定）、3-20min 超时**）→ 上下文组装（约 20 条/2000 token，大消息 40% 头+60% 尾截断，
注入身份+队友花名册）→ **LLM 判断层（接/退/升三选一）**——误 @ 的裁决权在接收方模型，不在路由器。

### 3.3 球权引擎 Ball Custody（domains/ball-custody/，~90 文件）

多 agent 责任的**事件溯源单一事实源**：append-only 事件日志 + 可重建 projection +
7 态纯函数状态机（new/active/blocked/parked/dead/void/zombie/resolved）。衍生机制：
- `ActionSuccessorLease`：TTL=0 Redis CAS + generation fence（防陈旧持有者）。
- **typed terminal predicate（全项目最深的一条）**：任务"完成"由机器可检证据裁决
  （pr_merged/ci_passed/task_done 的持久化 revision、canonical Git OID）；**carrier 退出码 0、
  响应文本、Queue 投递成功都只是 carrier 事实，不裁决 action 成功**。
- F280 AwaitState：等 PR/CI 的"醒来"是一等生命周期对象（predicate admission、owner fence、
  one-shot consume）。
- 失败分类三层：process-poison / session-poison / turn-transient。

### 3.4 上下文管理——不控制 loop，改做外层治理

（CLI 内部 KV cache 管不到，这是该架构的先天让渡。）

- **容量解析**（config/context-capacity.ts）：手动配置 vs carrier 上报（可信上报会**限制**更大的手动值）
  vs 模型目录 vs `unresolved`——**未知绑定宁可标 unresolved 也不猜**。
- **会话策略**（config/session-strategy.ts）：handoff（到阈值封存会话开新会话，默认）/ compress /
  hybrid；阈值 per-provider（Google 0.55/0.65 比 Anthropic 0.8/0.9 激进）；六层 lookup 链带 provenance。
- **压缩穿越（F24）**：pre-compact hook 调 API 封存会话；post-compact hook 注入"压缩后引导包"：
  SOP 阶段书签恢复（**"重新加载 skill，别凭记忆继续"**）+ "不要假设用户批准过任何操作"。
- **压缩权威性**：只有被端到端动态证明的 carrier 才能推进 context epoch——
  "capability 声明不等于事件路由"；"binding 存在 ≠ provider 真的 resume 了"。
- warn 提示注入：进入 warn 区时注入一次性 hint，让**模型自己**三轴自检决定 handoff/续/冲刺。

### 3.5 记忆——全项目最重的子系统（docs/architecture/memory-system-overview.md，39KB）

- 底座 F102：`evidence.sqlite`（FTS5 BM25 + vec0 向量，本地 Qwen3-Embedding-0.6B sidecar）
  三路检索（lexical/semantic/hybrid=RRR k=60 融合），embedding 不可用 fail-open 退化 lexical 并标 degraded。
- **LSM 式摘要压缩**：L0 实时拼接（零成本）→ L1 30min 调度器对 quiet thread 生成摘要
  （`[decision]`/`[lesson]` 标记由**程序解析**，不强迫模型输出 JSON）→ L2 rollup 预留。
- **typed truth lanes**：decision/taste/event/user profile/entity 修订账本/人物关系——每类独立 owner。
- **两张机会平面**：Write Opportunity（detector 只报事实，agent 必须 propose/defer/abstain——
  "detector 不判重要性，producer 不拥有 truth"）与 Recall Opportunity（closed typed catalog →
  有界 cue，agent 可 drill 可忽略）**分开**——合并会让"提示旧记忆"和"建议建新记忆"共享错误的权力语义。
- **Derived View Contract**：一切摘要/索引只能是有 lineage 的 cache；stale 必须回 canonical source 重建——
  十条硬边界全是反模式防御（防自动 RAG、防第二真相库、防 prompt 洗权）。

### 3.6 工具治理与安全

- MCP 工具**治理证书**：每个工具携带 operation contract（authorizationPaths + risk）、
  implementation binding（module digest）、policy（risk/hints），缺证书直接抛错；
  按 runtime profile（full/readonly/agent-key/desktop）投影可用工具集。
- Approval Hub（F246）：统一人审中心，approve/reject 走 CAS；只有 assign_work 类产生审批，
  fyi/coordinate 自动投递（效应类分级）。
- Claude 实际以 bypassPermissions 跑（家庭信任环境）——粒度在"提案→人审→CAS 生效"慢路径上。

### 3.7 可观测

- `CliRawArchive`：每次 invocation 的原始 NDJSON 事件存档 + 脱敏——他们版的 captures 制度，
  但粒度是 CLI 事件级，**没有 token 级三方印证**。
- BallCustodyEventLog 事件溯源 + projection 可 rebuild。
- `PreparedProviderRequestV1`：发给 provider 前冻结请求快照——"模型实际看到什么"的留痕。
- eval 纪律：`main ≠ live ≠ UAT ≠ verdict` 四态分别取证（与本项目"真机验收必须引用 trace"同源）。

---

## 4. 横向对照总表（含本项目）

| 核心机制 | hermes-agent | pi | clowder-ai | **tagent（本项目）** |
|---|---|---|---|---|
| 自研主循环 | ✅ 工程化（预算+守卫+改向） | ✅ 双层+steering | ❌ CLI 子进程（CatAgent 受限支线） | ✅ maxIterations+触顶降级 |
| 循环守卫（空响应/重复/nudge） | ✅ 三件套 | 部分（length 判错） | — | ❌ **缺** |
| 预算 grace call | ✅ | — | — | ❌ **缺**（降级方向对，无收尾） |
| 用户中途打断 | ✅ redirect 保前缀 | ✅ steer/followUp 原语 | —（多 agent 消息队列） | ❌ **缺** |
| 上下文压缩（摘要式） | ✅✅ 四层 | ✅ 增量+账本+检查点 | 外层治理（穿越/epoch） | ❌ 只有丢弃式双水位裁剪 |
| KV cache 意识 | ✅✅ 全局纪律 | ✅ provider 层 | ❌（黑盒让渡） | ✅ 双水位为此设计 |
| 并行工具执行 | ✅ | ✅+写路径 FIFO 队列 | ❌ 串行 | ❌ 串行（**缺**） |
| 工具错误处理 | ✅ 信封+2048 截断 | ✅ 抛异常契约 | ✅ 执行边缘判 status | ✅ 错误信封+分类重试 |
| 子 agent | ✅ 线程池+worktree+MoA | ✅ 官方扩展（进程隔离） | ✅✅ 本体（A2A+球权） | ✅ delegate（子 agent=工具） |
| 多 agent 责任治理 | — | — | ✅✅ 本体 | ❌（学习项目不背） |
| 记忆 | ✅ 文件+后台审查+curator | 刻意无（skills 披露） | ✅✅ typed lanes+机会平面 | ✅ 三层（朴素 bigram 召回） |
| 任务完成裁决 | — | — | ✅✅ 机器谓词 | ❌ 人看 transcript |
| Provider 抽象 | ✅ 声明式+容错流 | ✅✅ 10 协议×40 厂商 | 十几个 carrier | 刻意单一 OpenAI 兼容（双引擎实证） |
| 受限解码 | —（有 constrainedSampling 邻近物） | ✅ grammar/json_schema | — | ✅ GBNF json_schema（Step 5） |
| 报文溯源 | hook 契约+SQLite 归档 | ✅ onPayload/onResponse | CLI 事件级存档 | ✅✅ token 级三方印证（最强项之一） |
| 工具审批/沙箱 | ✅✅ 分层+归一化 | 刻意无（外置） | ✅ 证书+人审中心 | ❌（YAGNI，本地三工具） |
| 影子快照/回滚 | ✅ 影子 git | 会话树分支 | 事件溯源 rebuild | ❌ |

## 5. tagent 缺口分析（按值得抄的程度分梯队）

### 第一梯队：小件、纯核心、直接补在现有 core 上

**缺口 1：循环守卫三件套 + 截断防护**
- 空响应守卫（hermes `empty_response_guard.py`）：模型返回空 → 注入"处理上面的工具结果并继续"，
  不计失败。我们的弱模型实验中模型发呆/丢工具调用均撞过此场景，当时靠采样绕开。
- 重复检测（hermes `repetition_guard.py`）：连续相同工具+相同参数 → 打断。弱模型复读的硬防线。
- 预算 grace call（hermes 主循环谓词）：预算耗尽给一次收尾调用——与现有"触顶降级"互补：
  降级保证有终答，grace call 保证终答体面。
- length 截断判错（pi `failToolCallsFromTruncatedMessage`）：stopReason=length 时残缺 tool_calls
  判错并指示重发——Step 4 思考烧穿实验（max_tokens 含 thinking）正是这个场景，当时靠提预算绕开，
  机制上应兜住。
- 落点：`packages/core/src/loop.ts`；全部可单测，预估与 Step 2 同量级。

**缺口 2：Steering 打断通道**
- pi 的 steer/followUp 双队列 + hermes 的 redirect（**打断时保持 role 交替与缓存前缀**）。
- 我们的 CLI 一轮内无法打断，agent 在错误方向跑满 maxIterations。本地 CPU 推理一轮几十秒，
  打断通道的体验价值比云端更高（每秒都是真金白银的 wall-clock）。
- 落点：core loop 加注入队列 + CLI 信号处理；hermes 的"前缀不变"约束与双水位裁剪天然对齐。

**缺口 3：摘要式压缩（compaction）——与 hermes/pi 存在代差**
- 现状：双水位裁剪 = 纯丢弃。是"遗忘"，不是"有损保留"。
- 抄法（取三家的公共内核）：**确定性 pre-pass 先于 LLM**（旧工具结果降级一行摘要，可压缩量小就
  跳过 LLM 调用）→ 一次 aux 调用生成保标识符摘要（正则 Anchor Index 零成本抽 SHA/文件名/报错）
  → 保近期原文（pi 切点约束：toolResult 永不做切点 = 我们的"回合完整"，同构）。
- **必抄的戒律：用户消息永不压缩**（hermes 原话："改写指令正是 agent 后来违反明确指令的原因"）——
  我们的双水位若裁掉 user 轮正是此坑，Step 11 时先修边界再谈摘要。
- 落点：`packages/core/src/memory.ts` 扩展 + aux 调用复用现有 client。

**缺口 4：并行工具执行 + 写路径序列化**
- pi：默认并行、结果按源顺序回填、canonical path FIFO 队列（同文件写自动串行）。
- native 模式一帧多 tool_calls 我们逐个跑；weather+calculate 类只读工具白得并行收益，
  未来有文件工具时写队列防竞态。
- 落点：`packages/core/src/tools.ts` 执行循环改造。

### 第二梯队：单件可做、机制新颖

**缺口 5：Skills 渐进披露**（pi）：系统提示只放 name+description，正文按需 read——
与 Step 6 结论（工具召回 > 静态注入 > 逐问注入）直接衔接，是同一实验方向的自然延伸。

**缺口 6：任务完成的机器谓词**（clowder 最深一条）："LLM 说做完了不算数，退出码 0 也不算数"——
完成由类型化证据裁决。我们的验收全靠人看 transcript；给任务挂可机检谓词（文件存在/diff 匹配/
工具调用序列断言）是 FALLBACK.md 工程哲学的下一步：兜模型的行为，也兜 agent 的自证。

**缺口 7：压缩后引导包**（clowder F24）：恢复/压缩后注入一次性 hint——"重新加载规则，别凭记忆继续" +
"不要假设用户批准过任何操作"。小而准，/save /load 会话恢复场景直接可用。

**缺口 8：工具结果长度上限**（hermes 2048 截断）与**错误 status 执行边缘判定**（clowder KD-38：
工具合法返回 "Error: 200 OK" 不许被内容启发式误判）——都是十行级小改，错误信封的补强。

### 明确不缺的（边界论证，防误判）

- **报文溯源**：我们的 (seq→frame→line→byte) 三方印证比 clowder 的 CLI 事件级细一个量级，
  与 pi 的 onPayload/onResponse 制度等价——这是本项目制度优势，不是缺口。
- **KV cache 意识**：双水位就是为此设计（78% 实测命中）；hermes 把它升为全局纪律的**思维方式**值得学，
  但机制内核已有。
- **多 provider 抽象**：单一 OpenAI 兼容是刻意边界（llama.cpp/MLX 双引擎零改动已实证）；
  pi 的 40 厂商注册表对学习项目是负债。
- **多 agent 编排**：clowder 的球权/mention 路由是平台级工程；delegate 在学习项目尺度正确。
  它的**护栏设计**（乒乓检测、链深上限、"一个事实一个 owner"、终端谓词）在将来做多 agent 时直接抄。
- **工具审批/沙箱**：本地学习项目、工具就三个，YAGNI；hermes 的命令归一化与"YOLO 冻结"在
  引入 shell 类工具时再抄不迟。

## 6. 建议路线（与现有 Step 编号衔接）

| 步 | 内容 | 抄自 | 件量 |
|---|---|---|---|
| Step 9 | 循环守卫三件套 + grace call + length 截断判错 | hermes + pi | 小（core/loop.ts，测试好写） |
| Step 10 | Steering 打断通道（loop 双队列 + CLI 信号） | pi + hermes | 小-中 |
| Step 11 | 摘要压缩（pre-pass 降级 + aux 摘要 + 用户轮保护） | hermes + pi | 中（动 memory.ts，A/B 实验必备） |
| Step 12 | 并行工具执行 + canonical path 写队列 | pi | 小-中 |
| 插空 | Skills 渐进披露 / 完成谓词 / 压缩后引导包 | pi / clowder / clowder | 各单件 |

每步沿用项目纪律：需求增补（REQUIREMENTS）→ 实现 + 单测 → 真机验收（引用 trace）→ FALLBACK.md 沉淀。

---

## 附录：关键源码文件索引

**hermes-agent**（main @ f98f5e7 附近）：
`agent/conversation_loop.py`（主循环）、`agent/iteration_budget.py`、`agent/empty_response_guard.py`、
`agent/repetition_guard.py`、`agent/context_compressor.py`（440KB）、`docs/micro-compaction.md`、
`agent/native_compaction.py`、`agent/prompt_cache_boundary.py`、`tools/delegate_tool.py`（236KB）、
`tools/subagent_worktree.py`、`agent/moa_loop.py`、`agent/memory_manager.py`、`agent/background_review.py`、
`agent/curator.py`、`tools/code_execution_tool.py`（104KB）、`tools/approval.py`（270KB）、`agent/estop.py`、
`tools/checkpoint_manager.py`（89KB）。

**pi**（main @ 853a80d）：
`packages/agent/src/agent-loop.ts`、`packages/agent/src/agent.ts`、`packages/agent/src/types.ts`、
`packages/agent/src/harness/tools/file-mutation-queue.ts`、`packages/agent/src/harness/compaction/compaction.ts`、
`.../compaction/branch-summarization.ts`、`packages/agent/src/harness/session/`（JSONL 树）、
`packages/ai/src/types.ts`（compat 条件类型）、`packages/ai/src/api/openai-prompt-cache.ts`、
`packages/coding-agent/src/core/extensions/loader.ts`（jiti）、`packages/coding-agent/examples/extensions/subagent/`、
`docs/session-format.md`、`docs/security.md`、`docs/harness.md`（步进 harness，进行中）。

**clowder-ai**：
`docs/decisions/001-agent-invocation-approach.md`、`docs/architecture/a2a-protocol.md`、
`docs/architecture/at-mention-routing-system.md`、`docs/architecture/memory-system-overview.md`、
`docs/decisions/020-f102-memory-system-architecture.md`、
`packages/api/src/domains/cats/services/agents/providers/`（各 CLI carrier）、
`.../providers/catagent/CatAgentService.ts`、`packages/api/src/config/context-capacity.ts`、
`packages/api/src/config/session-strategy.ts`、`packages/api/src/domains/ball-custody/`、
`packages/mcp-server/src/tool-governance-types.ts`、`.claude/hooks/f24-{pre-compact,post-compact-bootstrap}.sh`。

> 证据边界（如实）：巨文件（>200KB）抓取只能读到开头，相关结论基于模块级 docstring 与可见代码；
> hermes 两处对 max_iterations 默认值的表述存在文档性出入（已标注）；pi 的步进 harness 是 API 骨架
> （运行时抛 Not Implemented），生产实现在 coding-agent。调研方法：WebFetch 抓 raw 源码与 docs 原文，
> 三路独立进行，未运行任何被调研代码。
