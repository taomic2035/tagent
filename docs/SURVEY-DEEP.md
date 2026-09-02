# SURVEY-DEEP.md —— 三 agent 本地源码深挖成果库

> 与 SURVEY.md（网络调研）的差别：本次基于**完整本地源码**（hermes-agent 76MB /
> pi 7MB / clowder-ai 工作副本），无截断、行级可复核。所有引用给出文件路径与
> 行号；本文件是教程第 11 章的素材库，也是后续开发的参考索引。
> 调研日期：2026-09-02。

---

## 一、hermes-agent 深挖（Python 常驻个人 agent）

### 1.1 execute_code：程序化工具调用（PTC）的完整解剖

源码：`tools/code_execution_tool.py`（2486 行）、`tools/code_kernel.py`（846 行）

**核心思想**：LLM 写一段 Python 脚本，脚本 import 宿主生成的 `hermes_tools.py`
stub（每个"工具函数"是 RPC 客户端，调用送回宿主分发）。文件头：

> "Lets the LLM write a Python script that calls Hermes tools via RPC,
> **collapsing multi-step tool chains into a single inference turn**."
> "In both cases, only the script's stdout is returned to the LLM;
> **intermediate tool results never enter the context window**."

五个层层递进的机制：

1. **stub 生成**（L485-517）：从 `_TOOL_STUBS` 生成源码，只含白名单 ∩ 会话工具
   的交集（7 个：web_search/read_file/write_file/terminal 等）；内置 `json_parse`
   （容忍控制字符/BOM）、`shell_quote`、`retry`（指数退避）三个帮手（L522-561）
2. **双传输**：本地 POSIX 用 AF_UNIX（chmod 0600），Windows 回退回环 TCP；
   远程后端用**文件 RPC**（子进程写 `req_000001` 文件 tmp+rename 原子写，宿主
   轮询读→分发→base64 写回 `res_000001`——用 base64+echo 因为 "some backends
   (Modal) don't reliably deliver stdin_data"）（L1004-1143）
3. **RPC 服务端安全闸**（`_rpc_server_loop` L723-858）：token 用
   `secrets.compare_digest` **按字节**比较（str 形态遇非 ASCII 抛 TypeError）；
   每 cell 工具调用预算 50 次；terminal 危险参数（background/pty）直接 pop
4. **CellAuthority——状态与权限解耦**（code_kernel.py L175-245，安全核心）：
   > "Interpreter state persists across cells; **RPC authority must not**.
   > Each cell installs a fresh authority — captured from the CALLING thread
   > at cell start... so a tool call arriving later (a background thread the
   > cell left behind, a raced client write) is refused instead of running
   > under a stale approval/session/turn identity."
   实现：每 cell 前 `contextvars.copy_context()` 快照；结束后 `authority.retire()`，
   之后到来的 RPC 一律拒绝（L842-846 finally）
5. **哨兵帧协议**（L37-46）：内核子进程 stdout 单管道复用传协议帧与用户输出，
   帧格式 `\n<SENTINEL> <byte-length>\n<json>`，SENTINEL 每次 spawn 随机生成；
   "Bytes outside frames are raw fd-level output... **calls are serialized
   per kernel, so attribution is unambiguous**"

配套机制：
- **归属键**（L307-322）：内核按 `(owner, mode, python, cwd, tools)` 键控，owner
  是 approval session key 而非 task id（"a task-keyed kernel would neither
  survive the next user turn"）；子 agent 加 `::child::` 强制隔离
- **迭代预算 refund**（conversation_loop.py L7924-7928）：纯 PTC 迭代退还不占
  主循环预算（"cheap RPC-style calls that shouldn't eat the budget"）
- **输出溢出分页**（recover-don't-rerun）：宿主层 50KB 上限 head 40% + tail 60%
  （deque 滚动窗口），截断元数据用结构化字段（"A textual truncation marker
  can be missed or later re-truncated"）；全文 spill 到内容寻址文件
  `cache/exec/stdout-<sha256[:12]>.txt`，warning 直接给分页配方：
  > "FULL output saved to {spill_path} — page it with read_file(path=...)
  > instead of re-running."
- **生产数据驱动的错误提示**（`_sandbox_failure_hint` L430-482）：
  "Production mining (state.db): the top execute_code failure classes are
  hermes_tools import misuse (23x in one window)..."——按 stderr 正则给可操作提示

### 1.2 压缩体系细节

- **Anchor Index**（context_compressor.py L1144-1209）：七类正则（PR/issue、
  SHA、分支、路径、错误行、@handle、URL）各带独立 cap，频次排序，总预算 7000 字符：
  > "No LLM in the loop, so **nothing can be paraphrased away** — this is
  > the defense for needle-facts that honest summarization at 10:1 always loses."
  配套 `_build_recovery_footer`："treats compaction as **deferred retrieval,
  not loss**"——footer 直接给 `session_search(query=...)` 调用配方
- **pre-pass 五趟**（`_prune_old_tool_results` L4019-4320）：字节级去重（md5，
  "dedup is lossless" 与位置无关）→ 旧工具结果一行化 → 巨大 tool_call 参数
  **在解析后的 JSON 结构内截断**保持合法（"otherwise downstream providers
  400 on every subsequent turn"）→ 图像退役 → 保护尾压力降级。**ghost-skill
  防御**：刚 skill_view 过的正文在普通 pass 保留（否则"skill 加载后瞬间被压缩，
  模型还以为指令在上下文里"）。**proactive prune 的缓存迟滞**：提前跑 Phase-1
  但 reclaim ≥ min_reclaim_tokens 才提交（"PROMPT-CACHE CONTRACT"——剪枝重写
  已发送历史 = 打断缓存前缀）
- **micro-compaction 三不变量**（L6855-7360）：用户消息永不吸收（"the user's
  own words are the instructions everything else is derived from"）；交替安全
  （splice 边界必须是 user 消息，否则"strict providers reject"）；断点续传
  （从 transcript 最后一个 summary marker 恢复 cursor）
- **prompt_cache_boundary**（95 行全文）：**构造时字节登记**——builder 在生成
  消息那一刻把稳定前缀注册进进程内 LRU（32 条/4MB），请求时查命中就切成两个
  text part（稳定段带 cache_control）。为什么构造时而非请求时解析 marker：
  > "markers can legitimately appear inside skill bodies or inside event
  > payloads... any delimiter-search heuristic then either shrinks the cached
  > prefix or — worse — **silently absorbs volatile bytes into it**."

### 1.3 自进化链细节

- **background_review 的 cache-parity fork**（L1102-1392）：继承父 runtime 与
  凭据；**byte-identical** 复制 system prompt/tools/reasoning config——
  "Anthropic's cache key is namespaced by thinking presence"；路由到便宜模型时
  缓存必冷，改放摘要 digest："Same model -> full replay; different model ->
  digest. That's the whole policy."（L199-201）。实测收益 "~26% end-to-end
  cost reduction on Sonnet 4.5"。**三重持久化隔离**各有事故编号：fork 曾共享
  session_id 把评审话术写进用户真实 session——"the agent re-reads that
  injected user message as a standing instruction and **'becomes' the curator,
  refusing the actual task**"；简单禁用压缩曾导致一次评审烧 1,487,951 input
  tokens，修复 = detached in-place（"detachment, not disablement"）
- **评审 prompt 的反模式清单**（L476-613）：环境性失败（缺二进制）会被固化成
  规则；**否定断言（"browser tools do not work"）"harden into refusals the
  agent cites against itself for months after the actual problem was fixed"**
- **/learn**（237 行全文）："no separate distillation engine"——live agent 用
  既有工具自己采集与落盘。三个细节：description ≤60 字符且"模型写完自己数"
  （"anything past char 60 is silently cut and never routes"）；**author 永远
  是字面量 Hermes**（"Skills get shared and published, so an environment-derived
  name is a privacy leak"）；Trojan Source 防护（蒸馏前剥离零宽/双向 Unicode）

### 1.4 其他独特机制

- **观察者 hook 的语义分级超时**（hermes_cli/plugins.py L401-455）：
  观测类 fail-open（防线程池挂起），`pre_tool_call` fail-closed（超时必须挡）；
  每个不设超时的钩子逐个给理由（pre_gateway_dispatch "fail-open skips
  auth-like checks; fail-closed can drop legitimate messages"）
- **checkpoint 的 agent-write ledger**（L247-278）：每次成功写文件记 sha256；
  safe restore 只回滚"当前内容仍等于 agent 最后写的哈希"的文件——
  "restores can tell 'Hermes wrote this' apart from 'the user hand-edited
  this afterwards'"。数据安全较真：checkpoint 里不存在且超尺寸的文件不删——
  "an oversize path cannot be proven agent-created; leaving it costs a stale
  file, deleting it costs the file"
- **异步委托**（async_delegation.py L16-26）：完成事件 forge 成**全新 turn**，
  "never spliced between a tool result and an assistant message. That keeps
  strict message-role alternation legal and **the prompt cache intact
  (hard invariant: never mutate past context)**."
- **宠物引擎的缓存键自律**（pet/__init__.py L20-23）：
  "it adds no model tool, mutates no system prompt or toolset, **and
  therefore has zero effect on prompt caching**."——连养宠物都声明不碰缓存键

### 1.5 横向设计语言（四条）

1. **缓存键是被显式管理的资源**（六个子系统都遵守 "never mutate past context"）
2. **每个机制带事故编号与实测数字**（#93057: 1,487,951 tokens；#25322: ~26%）
3. **确定性兜底概率性**（正则 Anchor 兜 LLM 摘要；pre-pass 先行；确定性状态机先行）
4. **权限生命周期比状态短**（CellAuthority retire；fork 三重隔离；kanban env 收敛）

---

## 二、pi 深挖（TS agent toolkit）

### 2.1 会话树（生产 v3 实现）

- **entry 判别联合**：`message | model_change | thinking_level_change |
  active_tools_change | compaction | branch_summary | custom`——**模型/思考级/
  工具集的切换也是树节点**，分支回到过去时连"当时用什么模型"都能恢复
- **分支 = 移动叶子指针**（session-manager.ts L1361-1366）：`this.leafId =
  branchFromId`，一字不删
- **branchWithSummary**（L1382-1407）：摘要条目挂在**导航目标**上，fromId 记
  被放弃的叶子；摘要范围 = 旧叶到**最近公共祖先**（branch-summarization.ts
  L82-111）。摘要提示词固定六段：目标/约束与偏好/进度（勾选框）/关键决策/
  后续步骤——"保留确切的文件路径、函数名和错误消息"
- **retainedTail 自包含检查点**（harness.md §2.1）：
  > "每次压缩都存储完整的 retainedTail。**上下文永远不会读取压缩点之后的
  > 内容。**这就是让压缩成为一个自包含检查点而非指向历史指针的原因。"
  实现仅三个函数（session/context.ts L45-80）。教学点：**压缩不是删除历史，
  而是改变上下文投影**

### 2.2 可步进 harness（规格先行，含最深的抽象）

- **ActionInfo 完整清单**（agent-harness.ts L182-196）：14 种动作（append_entry/
  move_lane/consume_queue_item/stream_assistant/execute_tool/hook/sleep...），
  配 `peekAction()/executeAction()/drive:"manual"`
- **effect sandwich**（harness.md §0.3）：意图提交 → 效果 → 结算提交；
  §4.5 的金句："**整个系统唯一真正不确定的窗口，就是意图已持久化而结算缺席**"
- **实现状态如实**：AgentHarness 是规格骨架（90% 方法抛 NotImplemented）；
  已落地的是存储三层 + 三个后端 + 1016 行一致性测试套件

### 2.3 其他独特机制

- **jiti 热插拔**（loader.ts L498-519）：`moduleCache:false` 每次重新求值 =
  热替换；**virtualModules 让扩展与宿主共享同一批模块实例**（单例状态天然
  互通）；陈旧上下文毒化（旧 `pi` 对象上任何动作抛错，防悬挂引用）。
  最强证据：**llama.cpp 引擎本身就是内置扩展**
- **DeferredHandle**（ai/types.ts L405-447）：异步响应的跨进程持久句柄——
  进程死了、重启了，长任务响应句柄还在会话树里（RunOutcome 的 suspended
  分支）。Harness 状态机讲究：每次 resume 至多一次 poll；崩溃后同 poll 号
  重发（未完成的 poll 不计数）
- **addedToolNames**：工具执行中途引入的新工具，没被用过就不放进请求的
  tools 列表，需要时才装载（Anthropic 走 tool_reference 块）
- **thinkingSignature**（types.ts L344-364）：pi 的会话消息 provider 中立，
  但 OpenAI Responses/Anthropic 要求回传推理项才能续接工具轮——解法是
  **不透明 provider 载荷整包塞进 thinkingSignature 字符串**（OpenAI 整个
  ResponseReasoningItem JSON 化；被安全过滤脱敏的 thinking 也走同一字段）
- **compaction 修正**（前次网络调研记忆有误，**无 token 掩码位**）：阈值
  算术 + 切点类型判定（toolResult 永不是切点）+ split turn 双摘要 + 文件
  账本从上次 compaction 继承 + UPDATE 提示词（"PRESERVE all existing /
  ADD new / UPDATE 进度"）+ **摘要请求强制 cacheRetention:none**（摘要是一次
  性的，别污染 prompt cache）
- **terminate 工具批规则**（types.ts L371-375）："当且仅当批内所有结果都
  terminate 时，run 直接以工具结果收尾"——规格里的动机金句：
  > "否则每个这样的 run 都要**为一个唯一目的是停下来的模型轮买单**。"
- **faux provider**：可编程确定性 LLM 模拟器（脚本步骤可以是工厂函数），
  **连 prompt cache 都模拟**（按 sessionId 记住上次 prompt 算公共前缀）
- **手写 CBOR + 长度前缀分帧**（packages/protocol）：不引 ws/protobuf——
  与 tagent"手写 SSE"哲学同源
- **SQLite 围栏 writer lease**：`ON CONFLICT DO UPDATE WHERE expires_at_ms
  <= now RETURNING fence+1` 抢占过期租约；**释放必须同时匹配 owner_id +
  fence**（"陈旧的 owner 不能释放取代它的替换者"）
- **UUIDv7 + 结果 id 继承时间戳**：工具结果 id 继承其 assistant id 的 48 位
  时间戳——调用+结果组在排序下天然聚簇

---

## 三、clowder-ai 深挖（多猫协作平台）

### 3.1 球权引擎（事件溯源 + 表驱动纯函数状态机）

- **状态机实为 8 态**（new/active/blocked/parked/dead/void/zombie/resolved）
  ——修正前次"7 态"的记载；Phase C"安乐死"三事件（frozen 冷冻可解冻 /
  degraded 降级 / abandoned 终态不做了）共享转移行为、语义独立
- **幂等键设计**（ball-custody-events.ts L11-14）：一条消息行首 @ 多猫时，
  handed 的 sourceEventId 是 `route:{messageId}:{toCatId}`——
  "若只用 `route:{messageId}` 则第二只猫被全局去重**静默吞掉**"
- **守卫 resolver 的教学级注释**（state-machine.ts L79-102）：
  `hold_expired` 的 fireAt 必须匹配当前 heldUntil（"防旧 reminder 误杀新 hold"）；
  死球迟到心跳 600s grace 窗口可复活（zombie grace）
- **铁律：事件 key 永不设 TTL**（"用户可见可恢复数据默认持久化"）
- **ingest 串行化**（L36-46）：同 subject 的投影串到一条 promise chain——
  "若多个 apply 并发，后 save 基于 stale read 会 clobber 前一个"

### 3.2 ActionSuccessorLease + 能力注册表启动断言

- **Redis Lua CAS**（8 段脚本单 round-trip）：claim 先查 subject 终态
  （已 merge 的 PR 拒绝受理）→ 同 dispatch 重放幂等返回 → 别人在办安全等待；
  CAS 修订号 + 身份指针双向校验（防孤儿 lease 被误更新）
- **typed terminal predicate**：六种完成谓词，`review_delivered` 必须绑定
  精确 headSha——**完成定义绑定到不可变 revision，而不是"PR 这个东西"**
- **能力注册表 + 启动断言**（ActionTerminalPredicateCatalog.ts L195-227）：
  > "A schema shape existing in shared types is intentionally not enough:
  > admission is enabled only when canonicalization, server resolution, a
  > production completion producer, and every runtime port are named here
  > and **boot-asserted**."
  ——"类型存在 ≠ 被受理"，受理 = 全链路具名 + 启动断言钉死（fail-fast）

### 3.3 AwaitState（F280 统一等待契约）

`UnifiedAwaitStateV1`：generation（乐观并发）+ ownerFence（归属栅栏只有两种）+
**baseline（等待开始时的世界快照）** + when/then + expiresAt。三个讲究：
- **唤醒只给相对 baseline 的 diff**（不重放全量）——纯函数对比
- **expiry 优先于谓词匹配**（"event.at >= expiresAt → 一律按 expired 终结，
  即使谓词同时匹配"）
- **one-shot 消耗**：terminalize 做的是 `await: undefined` + 写 outcome——
  等待状态被一次性消耗，不可能二次唤醒
- **hold_ball 必须声明等什么**（waitSourceRef），不声明 = 400 拒绝——
  服务器侧强制等待可归因，"从入口堵住含糊的挂起"

### 3.4 @mention 路由：机械层/判断层分离的完整原文

- 路由层"故意设计成机械的、无上下文感知的"（只有行首 @ 才路由、每消息
  最多 2 只、剥代码块/URL/引号）——"让接收方 agent 自己决定接不接"
- **接/退/升三选一 prompt 原文**（l3-routing-rules.md）："接球先问：能自决吗？
  可逆（≤1 commit 回滚）+ 不影响外部用户/数据/契约 + 能翻代码查到 → 直接做"；
  **反问式 ping 非法**（"要不要 X？"/"同意吗？"）
- **球权只有第一人称**（a2a-ball-check.md）："只能声明自己持球，不能声明
  别人持球"；"收了球却说'你等着' → 球权死锁，禁止"
- **乒乓检测**（WorklistRegistry.ts L73-135）：同对 A2A 计数 ≥2 警告、
  ≥4 硬熔断；**substantive 豁免**：上家本轮有实质工具调用或输出 >200 字符，
  streak **重置为 1** 而非 +1（"3 short + 1 substantive + 1 short 若不重置
  仍会在第 5 轮熔断"）；路由类工具显式排除为非实质（防 breaker 被打穿）

### 3.5 声明-动作一致性检测器（惊喜，prompt 工程的可审计化）

- **虚空持球检测**（void-hold-detect.ts）：文本声明"持球"但本轮 tool_calls
  无 hold_ball → 球转 void
- **verdict 检测**（verdict-detect.ts）：输出了 review 结论却没传球。**注释里
  记录两次 eval 驱动的手术**：关键词从 `/\bapprove(d|s)?\b/` 收紧到过去时
  `/\bapproved\b/`（现在时多是意图陈述）；eval 发现 6.7% 误报后扫描范围从
  全文收缩到 final routing slot——**每次修改都有 eval 数据、日期和可逆性声明**

### 3.6 记忆系统的可计算治理

- **目标函数**（memory-philosophy.md）："最大化共同成长率 = 经验→记忆的
  转化率 × 记忆→行为的改变率——只优化后者的系统是图书馆，不是器官"
- **Write Opportunity Plane 的健康指标**：三选一裁决（propose/defer/abstain）
  的履行本身被度量——disposition 计数 >1 判 `contradictory_disposition`、
  一个没有判 `uninformed_silence`；`awarenessCoverage`（知情覆盖率下限）、
  `approvalCardsP95PerWorkspaceWeekCeiling`（审批负担上限）作为退出孵化的
  **量化门**——"LLM 是否履行行为契约"变成可计算指标
- **Derived View Contract**：任何缓存/摘要必须有 lineage（sourceRefs +
  sourceRevisions + dependencyPredicate）；状态机 fresh|suspect|invalidated；
  "popularity 不提升 truth"
- **压缩穿越 hooks**（f24-*.sh 完整可读）：PreCompact 调 API 封存会话；
  SessionStart(compact) 注入五段恢复包——SOP stage 恢复（"Do NOT continue
  from memory — load the skill first"）+ "不得假设用户已批准任何操作" +
  "RE-READ CLAUDE.md rules NOW. Compression degrades your adherence"；
  状态文件 TTL 30 分钟、消费即删

### 3.7 其他惊喜

- **平行世界自我意识**（l1-parallel-world.md）："同一 catId 可能在多个 thread
  并行存在——**不共享上下文、球权、状态或责任记录**——平行自己不知道你
  知道的事"；跨 feature 问题走 cross_post 给平行 thread 投证据
- **NDJSON 解析的哨兵对象**（ndjson-parser.ts 60 行）：坏行以
  `ParseError{__parseError,line,error}` yield 而非抛——**坏行不杀流**（与
  tagent 信封哲学同源）
- **A2A 单一 admission**（QueueProcessor ~6163 行）："A public input lives
  only in the Queue — invisible to the chat panel and to other agents'
  context — until a single admission step materializes it into History"；
  processing bubble 是顺序栅栏（后完成的猫不能插队）
- **Magic Word 零硬编码**：治理词汇表从治理文档正则解析（"sourced from
  injected governance, not redefined... No hardcoded word table"）
- **SOP hard_rules 可执行性分级**：`git_state_predicate`（机器判定）vs
  `manual_only`（诚实标注"operator confirmation is conversational intent,
  not yet represented as a structured event"）

---

## 四、三项目一句话总结（本地深挖版）

- **hermes**：把"缓存键永不变异"当最高戒律的上下文经济学大师——六个子系统
  都在为同一个不变量工作；每个机制带事故编号，确定性兜底概率性
- **pi**：把"会话是树、投影可重建"贯彻到存储层的设计范本——retainedTail
  自包含检查点与 effect sandwich 是崩溃恢复的两个核心抽象；规格先行的
  工程纪律本身即教学
- **clowder**：把协作中所有"靠默契"的东西变成**带幂等键的事件、带 CAS 的
  租约、带 digest 的谓词、带度量的裁决、带 lineage 的缓存**——机械层永远
  可测、判断层留给 LLM、而判断层的履约又被机械层度量
