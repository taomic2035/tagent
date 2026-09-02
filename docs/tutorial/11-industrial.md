# 第 11 章 工业级深潜：三个真实 agent 的独特机制

> 前十章教你搓出了一个能干活的 agent。本章带你潜入三个工业级项目的源码，
> 看**同一批问题在更大尺度下的答案**。每个知识点三段式：机制（怎么实现）、
> 动机（为什么非这样做不可）、启示（你能带走什么）。全部引用可在本地
> 源码复核（见 docs/SURVEY-DEEP.md 的路径索引）。
> 阅读前提：读完第 1-10 章。本章不写代码——它教你**读**工业代码。

---

## 11.1 上下文经济学的极致：hermes 的缓存戒律

> **✅ 已复现**（`industrial.ts` / FR-85）：前缀指纹审计与"never mutate past
> context"的测试断言已实现（本模式的完整复现分散在 memory.ts 的缓存迟滞
> 与 loop.ts 的 steering 只追加语义中——教程第 6/7 章已教）。


**机制**：hermes 有六个互不相干的子系统（微压缩、主动剪枝、缓存边界登记、
后台自审 fork、异步委托、甚至屏幕宠物），但全部服从同一条硬不变量——
**"never mutate past context"**（绝不改写已发送的历史）。异步委托的完成
事件宁可"锻造成全新 turn"，也不拼接在 tool 结果之后——为的是 role 交替
合法 + 缓存前缀完好。宠物引擎的注释是这条戒律的极致体现：

> "它不加模型工具、不改 system prompt 和工具集，**因此对 prompt caching
> 零影响**。"——连养宠物都要声明不碰缓存键。

**动机**：第 6 章讲过"前缀稳定 = 缓存命中 = 速度"。hermes 把它升级为
**全局资源管理**：缓存键像数据库事务边界一样被显式设计——重写历史体的
每个操作（剪枝/压缩/分支）都必须写明缓存代价契约并做迟滞（reclaim 不够
阈值就不提交）。

**启示**：在你的 agent 里，"会改写历史的每个功能"上线前问一句：它向
"never mutate past context" 交代了吗？这是比"能跑"高一级的验收标准。

## 11.2 确定性兜底概率性：Anchor Index 与 pre-pass

> **✅ 已复现**（`memory.ts` / FR-83）：七类正则 + 频次排序 + 7000 字符总预算
> + 版本号兜底模式；pre-pass 五趟在 compactMessages 阶段 1 已有（第 6 章）。


**机制**：hermes 的压缩分两层。第一层**没有 LLM**：正则从被压缩区域收割
七类标识符（SHA/PR 号/文件路径/错误行/URL...），按频次排序进 7000 字符的
"锚点账本"。源码注释直说理由：

> "No LLM in the loop, so **nothing can be paraphrased away** — this is
> the defense for needle-facts that honest summarization at 10:1 always loses."
> （LLM 不在环里，所以没有任何东西能被改写丢掉——这是对"诚实摘要以
> 10:1 压缩时必然丢失绣花针事实"的防御。）

第二层才是 LLM 摘要，且先跑五趟确定性剪枝（字节去重、旧工具结果一行化、
巨大参数在**解析后的 JSON 结构内**截断以保持合法）。压缩 footer 里直接给
`session_search` 的调用配方——"压缩是**延迟检索，不是丢失**"。

**动机**：LLM 摘求是概率性的——它会忠实地概括大意，也会忠实地丢掉那个
救命的 commit SHA。正则不会。

**启示**：第 6 章的"确定性降级先于 LLM 摘要"在工业尺度的完全体。你的
压缩管线里，哪些事实是"绣花针"？给它们一条不过 LLM 的通道。

## 11.3 状态存活，权限必须死：CellAuthority

> **✅ 已复现**（`industrial.ts` / FR-91）：node:vm 沙箱 + 持久 context（变量
> 跨 cell 存活）+ 每 cell 权限 token + retire 后迟到调用拒绝 + 工具白名单 +
> 调用预算。**注意**：脚本需显式 `return`（与 hermes kernel 同语义）。


**机制**：hermes 的 execute_code 让模型写 Python 脚本，脚本经 RPC 回调宿主
工具。脚本内核是**长生命周期**的（变量跨调用存活），但每次执行的**权限**
是短生命周期的：cell 开始时在调用线程快照 contextvars，结束时
`authority.retire()`——此后到达的任何工具调用（后台线程遗留的、竞态写入的）
一律拒绝。源码原话：

> "Interpreter state persists across cells; **RPC authority must not**."
> （解释器状态跨 cell 存活；RPC 权限必须不。）

**动机**：长生命周期执行体上最阴险的漏洞——一个 cell 启动的后台线程在
cell 结束后发起调用，如果权限还挂着，它就以过期的审批身份执行了。

**启示**：任何"状态活得比调用久"的设计（持久内核、连接池、缓存的对象）
都要问：权限的过期语义是什么？**权限的生命周期应该设计得比状态短**。

## 11.4 输出溢出分页：recover-don't-rerun

> **✅ 已复现**（`industrial.ts` / FR-81）：spillIfOversized（内容寻址 sha256
> 文件 + head40/tail60 窗口）+ withSpill 工具包装器 + 结构化截断元数据。


**机制**：模型脚本输出超 50KB 时，截断为 head 40% + tail 60%（滚动窗口
保尾），全文溢写到内容寻址文件（相同输出只存一份），提示语直接给恢复
配方：

> "FULL output saved to {path} — **page it with read_file(path=...,
> offset=...) instead of re-running**."

截断元数据用结构化字段而非文本标记——"A textual truncation marker can
be missed or later re-truncated"（文本标记可能被错过或被下一层再截断）。

**动机**：CPU 上重跑一次 90 秒的脚本只为看第 200 行，是不可接受的。

**启示**：你的工具输出超限时，给模型的是"截断了"的坏消息，还是"怎么取回"
的好消息？**截断必给恢复路径**——这是工具设计的服务水准线。

## 11.5 会话即树，压缩即投影：pi 的存储哲学

> **✅ 已复现**（`session-tree.ts` / FR-90）：SessionTree（不可变树 + branch
> 移叶子指针）+ toMessages 路径投影 + retainedTail 自包含检查点 +
> branchWithSummary（摘要挂导航目标 + LCA）+ model_change 也是节点。


**机制**：pi 的会话是**不可变树**——每个条目带 parentId；连"换了模型"、
"换了思考级别"都是树节点，分支回到过去时连当时的配置都能恢复。分支就是
移动叶子指针，一字不删。压缩条目内联保存 `retainedTail`（最近原文），
规格里说清了为什么：

> "上下文永远不会读取压缩点之后的内容——这就是让压缩成为一个**自包含
> 检查点**而非指向历史指针的原因。"

**动机**：第 6 章的裁剪是"从数组里删东西"——删了就没了。pi 的哲学是
**压缩改变的是上下文投影，不是存储**：旧消息永远在树里，探索失败可以
branch 回去，被放弃的分支生成摘要（六段结构化格式：目标/约束/进度/决策/
后续）挂在导航目标上——**试错不丢信息**。

**启示**：把 messages 从"唯一的数组"升级为"树 + 当前路径"。你的 agent
不需要全套树，但"探索回退"（第 7 章硬取消后想换条路）已经在渴望这个
结构了。

## 11.6 唯一不确定的窗口：effect sandwich

> **✅ 已复现**（`industrial.ts` / FR-82）：auditEffectSandwich 孤儿检测
> （意图无结算 + 反向孤儿——结算无意图）。loop.ts 的"先入档"即意图提交。


**机制**：pi 的 harness 规格把每个动作拆成三明治：**意图提交 → 效果 →
结算提交**。规格的金句：

> "整个系统唯一真正不确定的窗口，就是**意图已持久化而结算缺席**。"

崩溃恢复因此变成机械问题：重放时看到意图无结算，就知道效果可能发生
也可能没发生——按具体效果的可逆性决定重试还是补偿。

**动机**：agent 的每一步都在做副作用（工具执行），崩溃在哪个点恢复决定
了会不会重复副作用。把"哪一窗口不确定"压缩到最小且显式，是可靠性设计
的核心。

**启示**：回看第 3 章的循环——"assistant 先入档再执行工具"正是三明治的
第一片面包。你已经有意图提交了；缺的是结算的显式标记。想想工具执行完
后，messages 里的 tool 消息是不是就是那片"结算面包"？

## 11.7 省掉最后一轮：terminate 工具批规则

> **✅ 已复现**（`industrial.ts` + `loop.ts` / FR-80）：shouldTerminateByTools
> 批判定（全 terminate 才收尾）已接入 runAgent 主循环，final 事件带 byTool。


**机制**：pi 允许工具结果带 `terminate: true`；**当且仅当批内所有结果都
terminate** 时，run 直接以工具结果收尾，不再请求下一轮 assistant。规格
里写明动机：

> "典型场景是用一个 'submit final result' 工具替代结构化输出——否则每个
> 这样的 run 都要**为一个唯一目的是停下来的模型轮买单**。"

**动机**：模型调用 submit 工具交付结果后，循环还会再发一次请求让模型说
"好的我交付了"——这次调用除了烧 token 什么都没做。

**启示**：检查你的 agent：终答前有没有"仪式性的一轮"？让交付工具直接
终止循环，是第 4 章"触顶降级"的反向优化——一个是怕它停不下来，一个是
别逼它说废话。

## 11.8 机械层永远可测，判断层留给 LLM：clowder 的分工铁律

> **✅ 已复现**（`industrial.ts` + `a2a.ts` / FR-88/98/99）：假完成检测器
> detectFalseCompletion（声称记住但没调 remember）+ 机械路由 extractRouteTargets
> + ping-pong 熔断（含 substantive 豁免重置为 1 而非 +1）。


**机制**：clowder 的 @mention 路由文档开宗明义："路由层被故意设计成
**机械的、无上下文感知的**，判断能力留给 LLM 自己（接/退/升）。" 但精彩
在下一步——**判断层的履约又被机械层度量**：

- **虚空持球检测**：文本声明"持球"但 tool_calls 里没有 hold_ball → 球转 void
- **verdict 检测**：输出了 review 结论（approved/P1:）却没传球 → 违规
- 检测器的关键词规则**每次修改都带 eval 数据、日期和可逆性声明**——
  把 `/\bapprove(d|s)?\b/` 收紧为过去时 `/\bapproved\b/` 的注释里写着
  "现在时多是意图陈述"及误报率 6.7% 的评估日期

**动机**：让 LLM 判断是因为意图理解必须它做；度量它的判断是因为
"信任但验证"——三个检测器都是纯函数，可确定性测试。

**启示**：prompt 不是部署完就完了的 artifact。**声明与动作的一致性检测**
（说了做 vs 真的做了）是你能加的最便宜的护栏——一次正则 + 一次事件。

## 11.9 完成定义绑定不可变 revision：typed terminal predicate

> **✅ 已复现**（`predicate.ts` / FR-84）：PREDICATE_CAPABILITY_REGISTRY
> + assertPredicateRegistryReady()（"类型存在 ≠ 被受理"——启动断言）+
> ManualOnlyCheck（诚实标注"对话意图暂无结构化表示"）。


**机制**：clowder 的完成谓词是 zod 判别联合六种（pr_merged/ci_passed/...），
其中 review_delivered 必须绑定精确 headSha——**完成定义绑定到不可变
revision，而不是"PR 这个东西"**（PR 可以被 rebase，headSha 不会）。更狠的
是能力注册表 + 启动断言：

> "A schema shape existing in shared types is intentionally not enough:
> admission is enabled only when canonicalization, server resolution, a
> production completion producer, and every runtime port are named here
> and **boot-asserted**."

——"类型存在 ≠ 被受理"。启动时断言每个谓词的全链路（canonicalizer/
resolver/producer/port）就位，缺一个 boot 失败。

**动机**：第 10 章的谓词机器裁决，在分布式尺度的完全体：谓词本身也要
防"定义了但没人能生产它"的空转。

**启示**：你的 verify-task.mjs 里，每个谓词的"证据生产者"是谁？如果
答不出来，这个谓词永远不会绿——**受理即断言，启动即失败**。

## 11.10 等待是一等公民：AwaitState 与 baseline diff

> **✅ 已复现**（`industrial.ts` / FR-86）：transitionAwait 纯函数（expiry
> 优先于谓词 + one-shot）+ baselineDiff（只给相对量）。owner fence 双形态
> 为 [100] 档类型定义。


**机制**：clowder 把"等 PR merge / 等 CI / 等定时"统一成一个合同
`UnifiedAwaitStateV1`：等待开始时拍 **baseline 快照**（当时的 headSha、
CI 指纹），唤醒时**只给相对 baseline 的 diff**（不重放全量）；expiry
优先于谓词匹配（过期了一律终结，即使条件同时满足）；等待状态 one-shot
消耗（terminalize = `await: undefined`——不可能二次唤醒）。连 hold_ball
都有硬门：**必须声明等什么**（waitSourceRef），不声明 400 拒绝。

**动机**：第 8 章讲过"无干预 = 挂起等世界变化再醒"。AwaitState 是它的
合同化：等待可归因（等什么）、可恢复（快照 + generation）、不可重复
消费（one-shot）。

**启示**：你的 agent 遇到"等用户回来 / 等外部事件"时是怎么表达的？
sleep 轮询？还是把等待本身变成数据？**含糊的挂起是长任务漂移的起点**。

## 11.11 记忆治理的量化：把履约变成指标

> **✅ 已复现**（`store.ts` / FR-87）：useCount 随 recall 记账 + stats()
> （byOrigin/zeroUse/oldestUnusedDays）+ curatorCandidates（30 天 stale
> /90 天归档，"零使用 = 证据缺失"语义注记）+ RECALL_DISCLAIMER（防注入
> fenced block 标注）。


**机制**：clowder 的记忆写入走三选一裁决（propose/defer/abstain），然后
**度量裁决本身**：disposition 计数 >1 判"矛盾裁决"、一个没有判"无信息的
沉默"；`awarenessCoverage`（知情覆盖率）与 `approvalCardsP95`（审批负担
p95）作为行为契约的**量化退出条件**——LLM 是否好好履行了"每次都认真
三选一"，变成了可计算的数字。

**动机**：行为契约（prompt 里写"你必须三选一"）没有度量就是装饰。

**启示**：第 6 章④的记忆四决策点里，"谁判断有用"的答案可以是模型——
但**判断的履行率要被度量**。这个模式适用于一切"要求模型自觉"的地方：
自觉 + 度量自觉 = 可信任；只靠自觉 = 祈祷。

## 11.12 压缩是生命周期事件，不是数据丢失

> **✅ 已复现**（`memory.ts` + `store.ts`）：压缩后引导包（第 5 章 /load
> 已有恢复注入）+ 压缩前封存（被压原文 digest 记入 anchor 索引——摘要
> 可追溯到被压原文的标识符）。curatorCandidates 即"压缩后主动整理"。


**机制**：clowder 用两个 Claude Code hook 把"上下文压缩"从灾难变成流程：
PreCompact 调 API **封存会话**（digest + SOP 阶段书签）；SessionStart(compact)
注入五段恢复包——最关键的三句："Do NOT continue from memory — load the
skill first"（别凭记忆继续，先重新加载）；"不得假设用户已批准任何操作"；
"RE-READ CLAUDE.md rules NOW. **Compression degrades your adherence**"
（压缩会降低你的规则遵从度）。状态文件 TTL 30 分钟、消费即删。

**动机**：压缩摘要必然丢细节——丢的恰恰是安全规则和审批状态。承认这一点，
并在恢复点显式重注入，比假装"摘要够用"诚实得多。

**启示**：第 6 章的压缩阶梯 + 第 4 章的"恢复引导包"已经有了雏形。完整的
心法是：**把压缩/恢复/分支/回退全部当作显式的生命周期事件**——每个事件
有自己的前置（封存）与后置（重注入），而不是让它们静默发生。

---

## 11.13 收束：三面镜子照出的同一个道理

| 项目 | 它最强的东西 | 照出你的 agent 的什么 |
|---|---|---|
| hermes | 一条不变量（never mutate past context）管住六个子系统 | 你的功能都向同一组不变量交代吗 |
| pi | 存储（树/投影/检查点）先于功能 | 你的 messages 结构撑得住未来的功能吗 |
| clowder | 默契全部变成带度量的事件/租约/谓词 | 你靠模型自觉的地方，度量了吗 |

三个项目、三种形态，深到底都在做同一件事：**把不可靠的东西（模型输出、
网络、时间、协作默契）装进可靠的容器（不变量、事件、谓词、指标）**。
这就是第 0 章那句话的工业版——模型的自觉靠不住，靠得住的只有协议与工程。

## 11.14 本章自测

- [ ] 能复述"缓存戒律 / 确定性兜底 / 权限短命 / recover-don't-rerun"四个
      模式各自的现场与修法
- [ ] 能解释"压缩即投影"与 effect sandwich——以及它们分别治什么病
- [ ] 能说出机械层/判断层分工 + 履约度量的一整套逻辑（检测器怎么写、
      关键词怎么调、eval 怎么留痕）
- [ ] 能给"完成谓词绑定不可变 revision"和"等待必须声明等什么"各举一个
      你自己 agent 里的反例
- [ ] 读完 SURVEY-DEEP.md 的至少一节原文，并复核其中一处源码引用

**下一步**：这是教程正文的最后一章。从这里出发的三条路——读 tagent
源码对答案、升级模型复跑 A/B、给 agent 加真工具——第 10 章末都写过。
加上第四条：挑本章任何一个模式，在你的 agent 里实现它。
