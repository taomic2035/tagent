# 第 15 章 让完成可证明：v0.16 验证基础设施

> 你的 agent 说"已保存文件"、"已记住你的偏好"——你怎么知道它真的做了？
> 也许它只是**说**了这句话（模型最擅长的就是生成看起来合理的文本）。
> 本章构建三件验证武器：**能力注册表**（防空转谓词）、**假完成检测**
> （说了但没做）、**FauxClient**（确定性测试整个 agent 栈）。
> 这是全书的收官章。预计 1 天。

---

## 15.1 问题：模型的话能信几分

回顾第 10 章的谓词裁决：用 `toolCalled` + `toolResultOk` 断言任务完成。
但两个隐患：

1. **谓词本身可能是空转的**：你定义了一个 `ci_passed` 谓词，但系统里
   没有任何东西能产生 CI 结果事件——谓词永远不会绿，你也不知道为什么
2. **模型可以声称做了但没做**：终答写"已保存到记忆"但 transcript 里
   根本没有 `remember` 调用

clowder 的原则：

> "A schema shape existing in shared types is intentionally not enough:
> admission is enabled only when ... every runtime port are named here
> and **boot-asserted**."

翻译：**"类型存在"≠"被受理"**——一个谓词要真正能判定，它的全链路
（证据生产者 → 解析器 → 运行时端口）都必须具名并在启动时断言。

## 15.2 能力注册表 + 启动断言

```ts
// packages/core/src/predicate.ts（追加）

export interface PredicateCapability {
  kind: string;                 // 谓词名
  evidenceProducers: string[];  // 消费哪些 AgentEvent.type 作为证据
  schemaVersion: string;        // schema 版本（演化追踪）
}

export const PREDICATE_CAPABILITY_REGISTRY = Object.freeze([
  { kind: "toolCalled",    evidenceProducers: ["tool-call"],   schemaVersion: "1" },
  { kind: "toolResultOk",  evidenceProducers: ["tool-result"], schemaVersion: "1" },
  { kind: "finalAnswers",  evidenceProducers: ["final"],       schemaVersion: "1" },
  { kind: "all",           evidenceProducers: ["*"],           schemaVersion: "1" },
]);

export function assertPredicateRegistryReady(): void {
  const seen = new Set<string>();
  for (const cap of PREDICATE_CAPABILITY_REGISTRY) {
    if (seen.has(cap.kind)) throw new Error(`谓词 ${cap.kind} 重复注册`);
    seen.add(cap.kind);
    if (cap.evidenceProducers.length === 0) {
      throw new Error(`谓词 ${cap.kind} 无证据生产者——"类型存在 ≠ 被受理"`);
    }
  }
}
```

**用法**：应用启动时调用（比如 CLI 的 main 函数第一行）——任何一个谓词
缺生产者，boot 失败（fail-fast）。

这解决的是**静默空转**：你加了一个新谓词但忘了实现它的证据源——不启动
就发现，而不是跑了一周才发现某个验收永远不绿。

## 15.3 假完成检测：说了但没做

```ts
export function detectFalseCompletion(
  finalText: string,
  toolNamesCalled: string[],
  claims: Record<string, RegExp> = {
    remember:    /(已记住|已保存到记忆|已经记住)/,
    get_weather: /(已查询到|查询到了)/,
    calculate:   /(已计算出|计算得出)/,
  },
): VerdictClaim[] {
  const called = new Set(toolNamesCalled);
  return Object.entries(claims)
    .filter(([, re]) => re.test(finalText))
    .map(([tool]) => ({ claimed: true, acted: called.has(tool), detail: tool }));
}
```

**关键词设计**（来自 clowder verdict-detect 的 eval 实战教训）：
- 用**过去时**（"已保存"）而不是现在时（"保存"）——现在时多是意图陈述
- 每个 `P1:` / `LGTM` 这种 verdict 格式要求精确格式——防代码注释里的
  随便一个 "approve" 误报

clowder 原项目的注释里记录了两次 eval 驱动的关键词手术：
1. `/\bapprove(d|s)?\b/` 收紧为 `/\bapproved\b/`（现在时多是意图）
2. 扫描范围从全文收缩到 **final routing slot**（结构豁免代码块/引用/URL）

**每次修改都有 eval 数据、日期和可逆性声明**——关键词工程也要可审计。

## 15.4 FauxClient：确定性测试整个 agent 栈

第 3 章的 scriptedClient 解决了"不依赖真模型测循环逻辑"。但它有一个
盲区：**没有模拟 token usage 和 prompt cache**——你无法测试与缓存相关
的行为（比如第 12 章的前缀稳定断言）。

pi 的解法：**faux provider**——一个可编程的确定性 LLM 模拟器，连
prompt cache 都模拟。

```ts
export class FauxClient {
  private callCount = 0;
  private lastPromptFingerprint: string | null = null;
  readonly usageLog: FauxUsage[] = [];

  constructor(private steps: FauxStep[]) {}

  async *stream(req: { messages: ChatMessage[] }) {
    const step = this.steps[Math.min(this.callCount, this.steps.length - 1)];
    this.callCount++;
    const r = step.respond({ callCount: this.callCount, messages: req.messages });

    // prompt cache 模拟：公共前缀 → cacheRead
    const fingerprint = JSON.stringify(req.messages);
    let common = 0;
    if (this.lastPromptFingerprint) {
      const a = this.lastPromptFingerprint, b = fingerprint;
      while (common < Math.min(a.length, b.length) && a[common] === b[common]) common++;
    }
    const promptTokens = Math.ceil(fingerprint.length / 4);
    const cacheRead = Math.ceil(common / 4);
    this.usageLog.push({
      promptTokens,
      completionTokens: (r.text?.length ?? 0) + 20,
      cacheReadTokens: cacheRead,          // ← 模拟缓存命中
      cacheWriteTokens: promptTokens - cacheRead,
    });
    this.lastPromptFingerprint = fingerprint;

    // 产出事件流（与真实 client 同契约）
    if (r.text) yield { type: "text-delta", delta: r.text };
    for (const [i, tc] of (r.toolCalls ?? []).entries()) {
      yield { type: "tool-call-delta", index: i, id: `faux-${this.callCount}-${i}`,
              name: tc.name, argsDelta: tc.args };
    }
    yield { type: "done", finishReason: r.finishReason,
            usage: { promptTokens, completionTokens: (r.text?.length ?? 0) + 20 } };
  }
}
```

**FauxStep 的工厂函数**是关键——它让每一步可以根据上下文动态决定输出：

```ts
const faux = new FauxClient([
  { respond: (ctx) => ctx.callCount === 1
      ? { toolCalls: [{ name: "get_weather", args: '{"city":"北京"}' }], finishReason: "tool_calls" }
      : { text: "北京 28 度晴", finishReason: "stop" } },
]);
```

**你现在可以测试的东西**（scriptedClient 做不到的）：
- 缓存命中率：两次相同前缀的请求，`usageLog[1].cacheReadTokens > 0`
- usage 跨轮累加：`usageLog` 的总和 = final 事件的 usage
- token 预算触发：设小的 max-context-tokens，验证裁剪在正确的轮次触发

## 15.5 记忆 useCount：量化"有用"

给 MemoryStore 加使用计数（hermes use_count 同构）：

```ts
recall(query: string, k = 5): RecalledFact[] {
  const hits = /* 评分排序取前 k */;
  // useCount 记账：命中即 +1
  for (const h of hits) {
    const fact = this.facts.find((f) => f.id === h.id);
    if (fact) {
      fact.useCount = (fact.useCount ?? 0) + 1;
      fact.lastUsedAt = Date.now();
    }
  }
  return hits;
}

stats() {
  let zeroUse = 0;
  for (const f of this.facts) if ((f.useCount ?? 0) === 0) zeroUse++;
  return { total: this.facts.length, zeroUse };
}
```

**语义注记**（hermes 原话的教学化）：

> "use_count=0 是**证据缺失**，不是过时证据。"

没人用 ≠ 没用——可能只是没遇到场景。所以 curator 的规则是**永不删除只
归档**（30 天未用标 stale 候选、90 天归档候选），且 use=0 的新事实有
宽限期（刚写入的当然还没人用）。

## 15.6 把所有武器串起来：一次完整的验证流

```
启动 → assertPredicateRegistryReady()  ← 能力注册表断言（空转检测）
  ↓
对话 → agent 跑完 → transcript 落盘
  ↓
验收 → verify-task.mjs 跑谓词          ← 机器裁决（第 10 章）
  ↓
异常 → detectFalseCompletion()         ← 假完成检测
  ↓
测试 → FauxClient 注入                 ← 确定性回归（无真 LLM）
  ↓
记忆 → stats() + curatorCandidates()   ← 健康指标
```

## 15.7 测试

```ts
test("能力注册表：启动断言通过", () => {
  assert.doesNotThrow(() => assertPredicateRegistryReady());
});

test("空生产者谓词：启动断言失败", () => {
  // 模拟一个没有生产者的谓词（修改注册表后断言，然后恢复）
  // 实际测试中你不会修改 frozen 的注册表——这里测的是概念
  assert.ok(PREDICATE_CAPABILITY_REGISTRY.every(c => c.evidenceProducers.length > 0));
});

test("假完成：声称记住但没调 remember", () => {
  const hits = detectFalseCompletion("已记住你的偏好", []);
  assert.ok(hits.some(h => h.detail === "remember" && !h.acted));
});

test("假完成：有调用则不算假", () => {
  const hits = detectFalseCompletion("已记住", ["remember"]);
  assert.ok(hits.every(h => h.acted));
});

test("FauxClient：prompt cache 模拟", async () => {
  const faux = new FauxClient([
    { respond: () => ({ text: "你好", finishReason: "stop" }) },
    { respond: () => ({ text: "再次", finishReason: "stop" }) },
  ]);
  // 两次相同前缀的请求
  for await (const _ of faux.stream({ messages: [{ role: "user", content: "共同前缀" }] }));
  for await (const _ of faux.stream({ messages: [{ role: "user", content: "共同前缀" }, { role: "assistant", content: "你好" }] }));
  assert.equal(faux.usageLog[0]?.cacheReadTokens, 0);  // 首次无缓存
  assert.ok((faux.usageLog[1]?.cacheReadTokens ?? 0) > 0); // 第二次有前缀命中
});
```

## 15.8 搞坏实验

- **去掉启动断言**：加一个 `evidenceProducers: []` 的谓词，跑验收——
  它永远不会绿但也不报错（静默空转）
- **假完成检测的关键词用现在时**：把 "已记住" 改成 "记住"——模型的
  意图陈述（"我来记住这个"）也会被误判为声称完成
- **FauxClient 不记指纹**：删掉 `lastPromptFingerprint`——第二次的
  cacheRead 永远是 0，你的缓存测试全部假绿

## 15.9 全书总复习：从 v0.1 到 v0.16

| 版本 | 长出什么 | 对应的工业模式 |
|---|---|---|
| v0.1 | 发一个请求 | — |
| v0.2 | 手写 SSE | hermes 容错解析器 |
| v0.3 | 多轮对话 | — |
| v0.4 | agent 循环 | pi steer/followUp |
| v0.5 | 错误信封 | hermes 恒不抛契约 |
| v0.6 | 分类重试 + 超时 | pi "工具失败必须抛异常" |
| v0.7 | 触顶降级 | hermes grace call |
| v0.8 | 上下文管理 | hermes 四层压缩 / pi compaction |
| v0.9 | 思考开关 + 守卫 | hermes repetition_guard |
| v0.10 | steering + 硬取消 | pi 双队列 / AbortSignal |
| v0.11 | ReAct + 并行 + 受限解码 | pi TypeBox / GBNF |
| v0.12 | 谓词裁决 + 溯源 | clowder typed terminal predicate |
| **v0.13** | **SessionTree** | pi 会话树 / retainedTail |
| **v0.14** | **execute_code** | hermes PTC / CellAuthority |
| **v0.15** | **审批管线 + shell** | hermes approval.py 六层 |
| **v0.16** | **注册表 + 假完成 + FauxClient** | clowder 能力注册表 / verdict-detect |

## 15.10 大师之路

你现在有一个能干活的、打不死的、安全的、可验证的 agent。从这里到
"大师"，三条路：

1. **读工业代码**：tagent 的实现是你的答案，SURVEY-DEEP.md 是三个
   工业项目的地图。重点读 hermes 的 `context_compressor.py`（8859 行）
   和 pi 的 `harness.md`（2942 行规格）——它们比任何教程都深
2. **加真工具**：web 搜索、数据库、消息推送——每个新工具都会逼出
   新的兜底需求，你的 FALLBACK 对照表会越长越长
3. **做多 agent**：第 15 章的 A2ABoard + BallCustody 是起步——
   但真正的多 agent 系统需要消息队列、分布式锁、事件溯源……
   clowder 的源码是这条路最好的教材

**记住第 0 章的话**：慢是特性不是缺陷——每一步都看得见的系统，
才谈得上理解。**你现在看到的比大多数人多得多。**

## 15.11 自测

- [ ] 能解释"类型存在≠被受理"——启动断言防的是什么（空转谓词）
- [ ] 假完成检测的关键词为什么用过去时（意图陈述 vs 完成声称）
- [ ] FauxClient 比 scriptedClient 多了什么（prompt cache 模拟 + usage）
- [ ] "use_count=0 是证据缺失不是过时证据"——为什么这条语义很重要
- [ ] 全书 v0.1~v0.16 的版本-能力-工业模式对照表能默写 80%

**对照答案**：tagent `predicate.ts`（注册表+断言）、`industrial.ts`
（detectFalseCompletion+FauxClient）、`store.ts`（useCount+stats+curator）。
