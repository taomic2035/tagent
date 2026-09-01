# 第 4 章 打不死：v0.5 安全壳 → v0.6 重试 → v0.7 保险丝

> 三个机制，每个从崩溃现场推导。原理线三节"深入一层"：**错误消息为什么是
> prompt 的一部分**、**Promise.race 不取消输家——abort 的协作式本质**、
> **降级时模型看到的世界变了什么**。预计 1 天。

---

## 4.1 先认识敌人：4B 失败实录

| 失败 | 现场（真机） |
|---|---|
| 复读 | "反复核对天气"任务连续 4 轮**完全相同**调用（同名同参）白烧轮数 |
| 发呆 | 空内容且不举手——不回答也不调工具（日常 10 任务实测 0 次，低频存在） |
| 参数烂 | 第 3 章墙 1：半截 JSON，parse 直接炸 |
| 过度自信 | 工具报"无火星数据"后仍可能编一段火星气象 |
| 思考烧穿 | 简单题开思考 1251 token（90s）vs 关思考 131 token（7.9s）**且答得更对**（第二册） |

总纲：**模型的自觉靠不住，靠得住的只有协议与工程。** 能没收的不恳求、
能数据化的不崩溃、能注入验收的不赌运气。

## 4.2 v0.5 错误信封：从墙 1 的崩溃说起

```
✖ SyntaxError: Unexpected end of JSON input
```

这个崩溃的真正问题不是"JSON 坏了"（模型偶尔吐坏 JSON 正常），而是**坏消息
的形态**：一个 JS 异常炸断循环——用户看天书，模型失去自纠机会。

**正确形态**：任何失败都包装成**模型能读懂的 JSON**回填。

## 深入一层 ①：错误消息是下一轮 prompt 的一部分

回看第 3 章①：messages 会被模板**整体渲染成文本**喂给模型——tool 消息的
content（即我们的错误信封）也在其中。所以错误消息不是"日志"，是
**下一轮请求的 prompt 组成部分**：

```
…<|im_start|>tool
{"ok":false,"error":"unknown tool: get_wether（可用: get_weather）"}<|im_end|>…
```

模型读到这行字，下一轮就会把 get_wether 改成 get_weather（4B 实测自愈）。
**由此推出错误文案的写作标准**：写给模型看的行动指令——带正确名单、
带参数哪里错了（zod issues 的 path）、带"不建议再调用"的明确劝退。
这就是为什么信封不是"包一层 try"那么简单，而是**协议设计**。

四段安全外壳（`tools.ts` v0.5 终态，替换 v0.4 的 execute）：

```ts
export interface ToolResultOk { ok: true; data: unknown }
export interface ToolResultFail { ok: false; error: string }
export type ToolResultEnvelope = ToolResultOk | ToolResultFail;

export class ToolRegistry {
  /* register/schemas 不变 */

  async execute(name: string, argsJson: string): Promise<string> {
    return JSON.stringify(await this.executeEnvelope(name, argsJson));
  }

  private async executeEnvelope(name: string, argsJson: string): Promise<ToolResultEnvelope> {
    // 段 1：工具名（确定性失败——重试一万次结果相同）
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `unknown tool: ${name}（可用: ${this.names().join(", ")}）` };
    }
    // 段 2：arguments 合法 JSON（墙 1 正规处置；120 字截断防错误自己撑爆上下文）
    let raw: unknown;
    try { raw = JSON.parse(argsJson); }
    catch { return { ok: false, error: `arguments 不是合法 JSON: ${argsJson.slice(0, 120)}` }; }
    // 段 3：schema 校验（issues = 给模型的纠错材料）
    const parsed = tool.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false, error: "参数校验失败",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.map(String).join(".") || "(root)", message: i.message,
        })),
      } as ToolResultFail & { issues: unknown };
    }
    // 段 4：执行（业务异常也接住——恒不抛宪法）
    try { return { ok: true, data: await tool.execute(parsed.data) }; }
    catch (err) { return { ok: false, error: `工具执行失败: ${(err as Error).message}` }; }
  }

  private names(): string[] { return [...this.tools.keys()]; }
}
```

> **引经据典**｜hermes-agent `tools/registry.py`
> 工业级同款：`_bound_error_text` 用 `_MAX_TOOL_ERROR_CHARS = 2048` 给进入
> 模型上下文的错误体定长，注释原话 "Bound an error body destined for model
> context"——一次工具炸出 10KB 堆栈，重试三次上下文就完了。
> **给错误消息定长是弱模型系统的基本功。**

信封恒不抛宪法 + 测试：

```ts
test("契约：无论成败，execute 返回恒为可解析 JSON 字符串（永不 throw）", async () => {
  const reg = new ToolRegistry();
  reg.register({ name: "bomb", description: "", schema: z.object({}),
    execute: async () => { throw new Error("业务代码炸了"); } });
  const result = await reg.execute("bomb", "{}");
  assert.doesNotThrow(() => JSON.parse(result));
  assert.equal(JSON.parse(result).ok, false);
});
```

## 4.3 v0.6 分类重试：只重试值得重试的

失败二分法：

- **瞬时（transient）**：网络抖、超时、服务 502——环境问题，重试有意义
- **确定性（fatal）**：参数错、工具名错、业务规则不允许——重试一万次同结果，
  只让模型白等、上下文白涨

四段外壳的段 1-3 天然确定性；段 4 的失败**由业务工具声明**（它最懂自己）：

```ts
/** 抛它 = 声明"我是瞬时失败，值得重试" */
export class TransientToolError extends Error {
  constructor(message: string) { super(message); this.name = "TransientToolError"; }
}

// Tool 增加可选 policy（types.ts）：
export interface ToolExecPolicy {
  timeoutMs?: number;      // 单次超时；超时视为可重试
  retries?: number;        // 瞬时失败重试次数（默认 0）
  retryDelayMs?: number;   // 线性退避：第 n 次前等 n × retryDelayMs
}

// 段 4 替换为：return runWithPolicy(tool, parsed.data, tool.policy ?? {});
```

## 深入一层 ②：Promise.race 不取消输家——超时为什么必须配合 abort

先看直觉写法的隐患：

```ts
const outcome = await Promise.race([tool.execute(...), timeoutPromise]);
```

**race 只是"谁先到听谁的"——输的那个 Promise 仍在跑**。JS 没有任何机制能
从外部杀死一个进行中的 Promise：工具里的网络请求继续挂着、定时器继续转、
事件循环背上死重。这不是理论：一次 hang 的工具没被通知清理，连接池和定时器
就泄一次。

**abort 的协作式本质**：`AbortController.abort()` 不杀任何东西，只是**翻牌子**
——把 signal 置为 aborted 并广播。真正收尾的是**听牌子的协作方**：fetch 听、
你写的工具也得听（`ctx.signal.addEventListener("abort", …)`）。所以正确的
超时是两位一体的：race 判定胜负 + abort 通知输家自清：

```ts
async function runWithPolicy(
  tool: Tool, args: unknown, policy: ToolExecPolicy,
): Promise<ToolResultEnvelope> {
  const attempts = (policy.retries ?? 0) + 1;
  let lastTransient: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();      // 每次尝试独立：超时不污染重试
    const outcome = await attemptOnce(tool, args, controller, policy.timeoutMs);

    if (outcome.ok) return { ok: true, data: outcome.data };
    if (outcome.kind === "fatal") return { ok: false, error: outcome.err.message };
    lastTransient = outcome.err;
    if (attempt < attempts) await sleep(attempt * (policy.retryDelayMs ?? 0)); // 线性退避
  }
  return {
    ok: false,
    error: `瞬时故障持续：${lastTransient?.message}（已重试 ${policy.retries} 次仍失败，不建议再次调用；请向用户如实说明或改用其他方案）`,
    retriesUsed: policy.retries,
  } as ToolResultEnvelope;
}

function attemptOnce(
  tool: Tool, args: unknown, controller: AbortController, timeoutMs: number | undefined,
): Promise<AttemptOutcome> {
  const timeout: Promise<AttemptOutcome> = timeoutMs
    ? new Promise((resolve) => setTimeout(() => {
        controller.abort();                        // 先通知，后判负
        resolve({ ok: false, kind: "transient",
                  err: new TransientToolError(`执行超时（${timeoutMs}ms）`) });
      }, timeoutMs))
    : new Promise(() => {});                       // 无超时：永不 settle
  return Promise.race([
    tool.execute(args as never, { signal: controller.signal }).then(
      (data): AttemptOutcome => ({ ok: true, data }),
      (err): AttemptOutcome => err instanceof TransientToolError
        ? { ok: false, kind: "transient", err }
        : { ok: false, kind: "fatal", err: err instanceof Error ? err : new Error(String(err)) },
    ),
    timeout,
  ]);
}
type AttemptOutcome =
  | { ok: true; data: unknown }
  | { ok: false; kind: "transient" | "fatal"; err: Error };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
```

**线性退避的统计直觉**：瞬时故障有时间相关性（网络抖动以几十~几百毫秒为
尺度），立刻重连大概率撞同一块抖动；等 1×、2×、3× 间隔是在**等故障窗口
滑过去**。**耗尽文案是行动指令**："不建议再次调用"实测让模型转向如实告知，
而不是无脑三连调。

三组测试（剧本化，不用真等真网）：

```ts
test("分类重试：flaky 前 2 次瞬时、第 3 次成功 → 自愈", async () => {
  let calls = 0;
  const flaky = { name: "flaky", description: "", schema: z.object({}),
    policy: { retries: 2, retryDelayMs: 0 },
    execute: async () => { if (++calls <= 2) throw new TransientToolError("抖"); return "好了"; } };
  const reg = new ToolRegistry(); reg.register(flaky);
  assert.equal(JSON.parse(await reg.execute("flaky", "{}")).ok, true);
  assert.equal(calls, 3);
});

test("确定性失败不重试：fatal 一次即返回", async () => {
  let calls = 0;
  const bomb = { name: "bomb", description: "", schema: z.object({}),
    policy: { retries: 3, retryDelayMs: 0 },
    execute: async () => { calls++; throw new Error("参数性的错"); } };
  const reg = new ToolRegistry(); reg.register(bomb);
  assert.equal(JSON.parse(await reg.execute("bomb", "{}")).ok, false);
  assert.equal(calls, 1);
});

test("超时：hang 工具被 abort 唤醒（协作式收尾的证据）", async () => {
  const hang = { name: "hang", description: "", schema: z.object({}),
    policy: { timeoutMs: 50 },
    execute: async (_a, ctx) => new Promise((resolve) => {
      ctx.signal?.addEventListener("abort", () => resolve("被唤醒"), { once: true });
    }) };
  const reg = new ToolRegistry(); reg.register(hang);
  const r = JSON.parse(await reg.execute("hang", "{}"));
  assert.equal(r.ok, false); assert.match(r.error, /超时/);
});
```

## 4.4 v0.7 触顶降级：循环的保险丝

maxIterations 用尽，用户拿空气（第 3 章实验挖的洞）。直觉修法——塞一句
"请直接给出最终回答"再请求一次。**这是 prompt 恳求**：tools 照发，模型
仍可再举手，死循环换皮。

**工程做法：协议级没收**——降级请求**不传 tools 字段**。不是说服，是断粮。

## 深入一层 ③：降级时模型看到的世界变了什么

接第 3 章①：tools 是模板渲染成**文本**进上下文的。不传 tools，渲染产物里
**整段工具说明书消失**，system 里也没有 `<tool_call>` 格式提醒——模型面对
的是一个"无工具世界"的对话。它不是"被说服不调工具"，是**从来没看见过工具**：
训练分布里没有说明书就生成工具段，概率上近乎不可能。这就是"协议保证"
与"prompt 恳求"的机制级差别——前者改模型看到的世界，后者只改模型的"心情"。

`loop.ts` 的 for 循环正常走完后追加（v0.7 全量新增）：

```ts
  // ---- 触顶出口：追加一次【无 tools】请求 ----
  messages.push({
    role: "user",
    content: "（系统注入：已达工具调用次数上限，不要再请求工具，请基于已获得的工具结果直接给出最终回答）",
  });
  let degradeText = "";
  for await (const ev of deps.client.stream({ messages, temperature: 0 })) {
    if (ev.type === "text-delta") { degradeText += ev.delta; yield ev; }
  }
  const degradeAssistant: ChatMessage = { role: "assistant", content: degradeText };
  messages.push(degradeAssistant);
  yield { type: "final", message: degradeAssistant, rounds: deps.maxIterations + 1 };
```

注入用 **user 角色 + （系统注入：…）标注**：有的引擎模板要求 system 只能在
开头，非头部 system 直接 500（真机实录；第二册还会撞）。协议没收为主、
prompt 提示为辅——双保险不互相依赖。

> **引经据典**｜hermes-agent `agent/iteration_budget.py`
> 同思路的工业版：预算耗尽后额外给一次 "grace call" 让模型收尾；它还有个
> 细节值得学——`execute_code`（程序化调用）的迭代**退还**给预算，机制上
> 鼓励模型用高效路径。我们没收得更彻底（连说明书都撤）。

## 4.5 故障注入：验收兜底真的兜得住

`apps/cli/src/faults.ts`（全量）：

```ts
import { TransientToolError, type Tool } from "@my-agent/core";

// TAGENT_FAULTS=get_weather:hang|flaky:N|down
export function withFaults(tool: Tool): Tool {
  const spec = (process.env.TAGENT_FAULTS ?? "").split(",").find(
    (s) => s.startsWith(tool.name + ":"),
  );
  if (!spec) return tool;
  const kind = spec.split(":")[1] ?? "";
  const n = Number(spec.split(":")[2] ?? 1);
  let calls = 0;
  const inner = tool.execute.bind(tool);
  return {
    ...tool,
    async execute(args: never, ctx: { signal?: AbortSignal }) {
      calls++;
      if (kind === "hang") {
        return new Promise(() => { ctx.signal?.addEventListener("abort", () => {}, { once: true }); });
      }
      if (kind === "down" || (kind === "flaky" && calls <= n)) {
        throw new TransientToolError(`[faults:${kind}] 第 ${calls} 次注入瞬时故障`);
      }
      return inner(args, ctx);
    },
  };
}
```

装配：`registry.register(withFaults(weatherTool))`。三个验收场景（真机+存证）：

```powershell
$env:TAGENT_FAULTS = "get_weather:flaky:2"   # → 重试自愈，用户无感
$env:TAGENT_FAULTS = "get_weather:down"      # → 耗尽劝退 → 模型转向如实告知（不再调）
$env:TAGENT_FAULTS = "get_weather:hang"      # → 3s 超时（配 policy.timeoutMs）→ 用户拿到解释
```

第二条最有味道——它验收的是 4.2 的"错误文案改变模型行为"是否兑现。

> **引经据典**｜hermes-agent `tools/approval.py`
> 工业级把"故意搞坏"做成体系：~47 条危险 pattern、命令归一化防混淆绕过。
> 方向一致：**安全性不是设计出来的，是攻出来的**。

## 4.6 本章总表：失败 × 对策

| # | 失败 | 对策 | 机制核心 | 版本 |
|---|---|---|---|---|
| 1 | 工具抛异常/参数烂 | 错误信封 | 失败数据化；文案=prompt | v0.5 |
| 2 | 瞬时故障 | 分类重试 | 声明制+退避+劝退文案 | v0.6 |
| 3 | 执行卡死 | 超时 | race 判定 + abort 通知（协作式） | v0.6 |
| 4 | 循环失控 | 触顶降级 | 撤说明书=改模型的世界 | v0.7 |
| 5 | 上下文爆炸 | 裁剪/压缩 | 前缀稳定+user 钉住 | 二册 v0.8 |
| 6 | 静默失败 | 循环守卫 | 有限次+可观测 | 二册 v0.9 |
| 7 | 格式纪律差 | 受限解码 | 文法→token 掩码 | 二册 v0.11 |

## 4.7 自测与对照

- [ ] 能讲"错误消息是 prompt 的一部分"的链条（模板渲染→tool content 进文本）
      以及由此推出的文案三要素
- [ ] 能解释 race 不取消输家、abort 协作式本质（"翻牌子"比喻）——知道为什么
      hang 测试的 resolve 在 abort 监听里
- [ ] 能讲降级的机制级解释（说明书从渲染产物中消失 vs 恳求改心情）
- [ ] 三组重试测试+三个注入场景全过、各有一份存证

**与 tagent 对照**：你的 tools.ts ≈ tagent 完全体（多互斥键队列——二册 v0.11）。
下一章不写新代码：把 v0.1~v0.7 放进一次正式总验收。
