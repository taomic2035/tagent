# 第 6 章 记性：v0.8 上下文管理与长期记忆

> "聊久了变傻变贵"的机制与对策。动手线：token 估算器、双水位裁剪、摘要压缩
> 阶梯、长期记忆。原理线三节"深入一层"：**长上下文为什么会变傻（注意力稀释）**、
> **裁剪策略与 KV cache 前缀的机制耦合**、**摘要"越压越大"的账**。
> 预计 1 天。

---

## 6.1 问题：上下文的三笔账

第 2 章末的实验已经让你体会过第三笔——现在把账摆全：

1. **窗口账**：上下文窗口有限（Qwen3.5 约 32K token），messages 全量重发
   （第 2 章④），迟早超窗 → 请求直接报错
2. **计算账**：每轮 prefill 全量历史（第 1 章②）——除非命中 KV cache
3. **质量账**：最反直觉的一笔——**上下文越长，模型对中段信息的利用率越低**
   （下一节）。"塞得下"不等于"用得好"

上下文管理 = 决定"模型此刻看见什么"。手段从轻到重：**裁剪**（丢弃）、
**降级**（压成一行）、**摘要**（LLM 改写）。先从度量开始。

## 6.2 token 估算器：零依赖的够用方案

精确计数需要 tokenizer（词表依赖具体模型），会击穿大脑零依赖红线。
够用方案（第 1 章①讲过"中文 1 字 1 token"的词表根据——现在写成代码）：

```ts
// packages/core/src/memory.ts
const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g;  // 汉字+中文标点+全角

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(CJK) ?? []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk + other * 0.25);      // 中文 1:1，英文 4 字符 1 token
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => {
    let t = 4;                                // 每条消息的协议固定开销（role/结构）
    if (m.role === "tool") t += estimateTokens(m.content);
    else if (m.role === "assistant") {
      t += estimateTokens(m.content ?? "");
      for (const tc of m.tool_calls ?? [])
        t += estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments) + 4;
    } else t += estimateTokens(m.content);
    return sum + t;
  }, 0);
}
```

两个必须的性质（后面所有裁剪决策可复现的前提）：**单调**（子串 ≤ 全文）、
**确定**（同输入同输出）。测试锚点：`estimateTokens("北京今天天气") === 6`、
`estimateTokens("abcdefgh") === 2`。诚实边界：与引擎 usage 误差约 ±10%
（第 1 章④的观测窗口可校准）。

## 深入一层 ①：长上下文为什么变傻——注意力稀释

第 1 章③讲过注意力的结构：每个位置的 Query 与全部前缀位置的 Key 做点积、
softmax 加权求和 Value。softmax 是**归一化**的——分给 100 个位置的注意力
权重加起来恒为 1，位置越多，平均每个位置分到的权重越薄。信息在，但
"读它的预算"被摊薄了。

实证现象（学界叫 lost in the middle）：长上下文里，开头与结尾的信息利用
最好，**中段**最差——像人读长文档只记得首尾。对 agent 的推论：
大段旧工具结果堆在中段，是**最差的存放形态**；把旧工作压成短摘要、
保持"指令（头）+ 最新工作（尾）+ 摘要（短中段）"，质量反而更好。
裁剪不只是省钱，是**主动的质量管理**。

## 6.3 双水位裁剪：遗忘也要讲工程

直觉做法"超了删最旧一条"错得有教学价值：

1. 删一条可能拆散 tool 配对（第 3 章墙 4 的 400）
2. 每轮删一点 = 每轮前缀变——下一节讲这为什么是灾难

正确姿势：**双水位（high/low water mark）**——超过高水位触发，一次裁到
低水位（预算×0.5）以下，以**完整轮次**为单位从最旧开始：

```ts
export interface TrimResult {
  kept: ChatMessage[]; removed: ChatMessage[];
  beforeTokens: number; afterTokens: number;
}
// trimMessages 的返回结构（骨架初稿引用了它但没给定义——引用完整性回填）

export interface TrimPolicy { budget: number; lowRatio?: number }   // 缺省 0.5

export function trimMessages(messages: ChatMessage[], policy: TrimPolicy): TrimResult {
  const low = Math.ceil(policy.budget * (policy.lowRatio ?? 0.5));
  // 划分"工作单元"：一次调用对（assistant(tool_calls)+其 tool 结果）或一条
  // assistant 文本；user/system 恒保；从最旧单元丢起，保最近 1 个工作单元
  // （正在用的数据不能抽走——抽了模型会当场重查，行为退化成复读）
  // 完整实现见 tagent memory.ts（含 user 钉住溢出标志，本章末清单）
}
```

三条铁律：**回合完整**（配对不拆）、**一次到位**（下次触发前前缀不变）、
**正在用的不抽**。

## 深入一层 ②：裁剪策略与 KV cache 的机制耦合

把第 1 章③的结论接到消息层。KV cache 的复用条件是**前缀逐字节相同**——
"字节"要算到 chat template 渲染后的粒度。两种策略的命运：

| 策略 | 第 N 轮请求的前缀 | cache_n | 真机对照 |
|---|---|---|---|
| 双水位 | 与第 N-1 轮在低水位内完全一致 | 覆盖旧轮全部 | **78%** 命中，prefill ≈1/5 成本 |
| 每轮删一条 | 第 N-1 轮被删的条目之后**全部位移** | ≈0 | 每轮全价 |

注意第二行的机制细节：从 messages 中删掉第 5 条，第 6 条起在渲染文本里的
**字节位置全部改变**——缓存对"位置+内容"敏感，不是对"内容"敏感。
这就是"一次裁到低水位"的全部理由：**遗忘的颗粒度，直接换算成 prefill 速度**。
观测方法就是第 1 章的 cache_n——本章实验你会亲手复现这张表。

## 6.4 设计决策课：用户消息一个字都不能动

裁剪迟早碰到 user 消息。三问三答（真机项目里真实发生过的一场裁决）：

**Q1：重复的 user 消息可以去重吗？**
可以，但**仅限字节级完全相同的相邻消息**（手滑重发）。"意思一样就合并"
是语义判断 = 改写，不做。

**Q2：语气词、错别字可以清理吗？"反正意思不变还省 token"？**
不行，三个结构性理由：
1. **破坏复现**：存证里发的请求是清理版，用户手敲的是原文——"同一任务手敲
   可复现"的制度（第 10 章）直接断裂
2. **风险不对称**：错别字可能承载意图（方言/缩写/黑话被"修正"=篡改指令）；
   语气词是指令强度（"麻烦你了"≠"赶紧！"）。清理省几十 token，改错赔整个任务
3. **改写者不可靠**：让 4B 判断什么是错别字，改错概率大于错别字本身的危害

**Q3："永不压缩"到底多强？极端超预算怎么办？**
分层：**改写——永不**；降级（工具结果压一行，消息还在）——可以；丢弃——
轮内工作可以，user 消息**宁可报错拒续也不丢**（超预算时报
"预算装不下用户指令总量"，让用户调预算或开新会话——诚实失败优于静默遗忘）。

> **引经据典**｜hermes-agent `docs/micro-compaction.md`
> 工业同款立场，原文值得一字不差地读："Your instructions are a different
> kind of thing. They're the intent everything else is derived from, and
> they cannot be reconstructed from the work that followed. Paraphrasing…
> is exactly how an agent ends up confidently doing the thing you told it
> not to, six turns later."（指令是一切的意图源头，无法从后续工作重建；
> 把它改写成摘要，正是 agent 六轮之后"自信地做你明确禁止的事"的原因。）

## 6.5 摘要压缩：阶梯式，先算账

裁剪是丢弃，摘要是有损保留。设计成阶梯，便宜手段优先：

```
阶段 0：相邻去重（字节级，零成本）
阶段 1：确定性降级——旧工具结果压一行（零 LLM 成本）：
        "[工具结果已降级｜原文约N字] 前120字…"
阶段 2：LLM 摘要——被压轮的工作交给一次模型调用改写；该轮 user 原文钉住不动，
        摘要以 user 角色注入（"（系统注入：历史工作摘要…）"——非头部 system
        会被 Qwen 模板 500 拒收，第 4 章的坑在压缩场景复现）
兜底：  摘要后仍超 → 回到裁剪（丢弃 ≠ 改写，事件上严格区分）
```

## 深入一层 ③：摘要"越压越大"的账（真机翻车 327→362）

真机实录：小预算会话触发摘要后，上下文**从 327 token 涨到 362**——白花一次
LLM 调用还更胖了。账目拆开：

```
摘要产物 = 钉住的 user 原文（~180）+ 摘要正文（上限 150 字≈150）+ 标注与 anchor（~30）
被压掉   = 轮内工作（这次只有 ~140 的工具结果）
产物 360 > 原文 327 → 负收益
```

根因：**钉住策略把 user 原文留在产物里**（Q2 的裁决），当"被压的工作 < 摘要
的固定开销"时，摘要必然越压越大。修法是**划算预检**：摘要长度上限可估
（提示词限 150 字 + anchor ≤10 条），产物预估 ≥ 原文就跳过摘要直接裁剪——
**压缩是增益不是义务，先算账再动手**。这条预检救了多少次调用？工程直觉：
小会话（被压区间小）触发频繁，预检拦下的是大多数。

## 6.6 长期记忆：跨会话的三件套

上下文管"这轮对话"，长期记忆管"跨会话"。最小够用件：

```ts
// 两个值类型先定义（骨架初稿把它们藏在注释里——引用完整性回填）：
export interface MemoryFact { id: number; ts: number; content: string; tag?: string }
export interface RecalledFact extends MemoryFact { score: number }

export class MemoryStore {
  private facts: MemoryFact[] = [];      // {id, ts, content, tag?}
  constructor(private file: string) { /* 存在则逐行加载 */ }
  append(content: string, tag?: string): MemoryFact { /* 追加文件+内存 */ }
  recall(query: string, k = 5): RecalledFact[] {
    // 手写评分：字符 bigram 交集 + 分词交集×2（中文无空格，bigram 友好）
    // 0 分不返回——无关注入比没有更糟（污染上下文+占预算）
  }
}
```

再把 remember/recall 包成工具（第 3 章 Tool 接口），模型在对话中自主决定
"这值得记"。真机 A/B 结论：**召回做成工具（模型按需调用）优于启动时静态注入**
——静态注入每轮占预算，工具按需付费；"每问一句自动召回注入"是反模式。

> **引经据典**｜pi 的 skills 渐进披露
> pi 对"长期知识"的答案更彻底：SKILL.md 只把 name+description 常驻上下文，
> 正文由模型按需 read——"only descriptions are always in context"。
> 与我们"工具召回 > 静态注入"是同一原则的两种形态：**常驻的信息越少越好，
> 取用的通道越顺越好**。

## 6.7 动手与搞坏

- **估算校准**：抓 5 份存证，比对估算器与 usage.prompt_tokens，记误差表
- **KV 命中复现**：多轮对话盯 cache_n；再把裁剪改成"每轮删一条"，看命中率
  归零、每轮变慢——6.3② 的表亲手复现
- **裁剪回归**：`--max-context-tokens 600` 聊七轮天气（每轮换城市），验收：
  无 400、配对完整、总结轮仍能说出前面城市温度（信息经压缩存活）、
  "北京多少度"会**重查而不是失忆乱编**
- **user 钉住**：预算压到装不下 user 总量——期望**报错拒续**而非静默丢话

## 6.8 自测与对照

- [ ] 三笔账能算；注意力稀释能讲（softmax 归一化→中段摊薄→lost in the middle）
- [ ] 机制耦合能推：删第 5 条 → 渲染字节位移 → cache 失效（位置敏感非内容敏感）
- [ ] 三问三答能复述，特别是"改写破坏复现"的链条
- [ ] "越压越大"的账能现场算；预检的条件是什么

**与 tagent 对照**：tagent `memory.ts` 为完全体（单元级 trim + compactMessages
阶梯 + 预检 + MemoryStore）；`REQUIREMENTS §16.1` 是 6.4 裁决的原始档案。
