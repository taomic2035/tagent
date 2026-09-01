# 第 4 章 打不死：v0.5 安全壳 → v0.6 重试 → v0.7 保险丝

> 三面新的墙，都来自同一个敌人：**弱模型的不可靠是常态**。v0.5 把裸奔的工具层
> 封成打不死的外壳（错误信封）；v0.6 教会它"只重试值得重试的失败"；v0.7 给
> 循环装保险丝（触顶降级）。每个机制都从崩溃现场开始推导。预计 1 天。

---

## 4.1 先认识敌人：4B 会怎么坑你

参考实现（Qwen3.5-4B，temperature 0.7）的真机失败实录，认脸：

| 失败 | 现场 |
|---|---|
| **复读** | "反复核对天气"任务里，连续 4 轮发起**完全相同**的调用（同名同参）白烧轮数 |
| **发呆** | 返回空内容且不举手——不回答也不调工具（低频，日常 10 任务实测 0 次） |
| **参数烂** | 第 3 章墙 1：arguments 是半截 JSON，`JSON.parse` 直接炸 |
| **过度自信** | 工具明确报"无火星数据"后，仍有概率编一段火星天气出来 |
| **思考烧穿** | 简单题开思考内耗 1251 token（90 秒），关思考 131 token（7.9 秒）**且答得更对**（第二册第 6 章） |

本章对策覆盖前三行，后两行第二册。先立总纲（全书引用最多的一句话）：

> **模型的自觉靠不住，靠得住的只有协议与工程。** 能没收的不恳求，能数据化的
> 不崩溃，能注入验收的不赌运气。

## 4.2 v0.5 错误信封：从墙 1 的崩溃说起

第 3 章墙 1 的崩溃还欠着：

```
✖ SyntaxError: Unexpected end of JSON input
```

分析这个崩溃的**真正问题**：不是"JSON 坏了"（模型偶尔吐坏 JSON 正常），
而是**坏消息的形态错了**——一个 JS 异常炸断了整个 agent 循环，用户看到
天书，模型失去自我纠正的机会。

**正确形态**：任何失败都包装成**模型能读懂的 JSON**回填给它。模型读着
错误消息，下一轮自己修（换个参数、换个工具、或如实告诉用户）——**错误消息
就是给模型的提示词**。

四段安全外壳（`packages/core/src/tools.ts` v0.5 终态，全量替换 execute 部分）：

```ts
import { z } from "zod";
import type { Tool, ToolDef, ToolExecPolicy } from "./types.js";

// ---- 信封类型：execute 的返回恒为这两种之一，永远不抛 ----
export interface ToolResultOk { ok: true; data: unknown }
export interface ToolResultFail { ok: false; error: string }
export type ToolResultEnvelope = ToolResultOk | ToolResultFail;

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  // register/schemas 与 v0.4 相同（略——它们不变，见 3.2）

  async execute(name: string, argsJson: string): Promise<string> {
    const envelope = await this.executeEnvelope(name, argsJson);
    return JSON.stringify(envelope);           // 统一出口：恒为可解析 JSON 字符串
  }

  private async executeEnvelope(name: string, argsJson: string): Promise<ToolResultEnvelope> {
    // 段 1：工具名存在吗（确定性失败——重试一万次结果相同）
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `unknown tool: ${name}（可用: ${this.names().join(", ")}）` };
    }

    // 段 2：arguments 是合法 JSON 吗（墙 1 的正规处置）
    let raw: unknown;
    try {
      raw = JSON.parse(argsJson);
    } catch {
      return { ok: false, error: `arguments 不是合法 JSON: ${argsJson.slice(0, 120)}` };
    }

    // 段 3：参数符合 schema 吗（附 issues——给模型的纠错提示）
    const parsed = tool.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "参数校验失败",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.map(String).join(".") || "(root)",
          message: i.message,
        })),
      } as ToolResultFail & { issues: unknown };
    }

    // 段 4：真正执行（业务代码抛的异常也接住——信封的"恒不抛"宪法）
    try {
      return { ok: true, data: await tool.execute(parsed.data) };
    } catch (err) {
      return { ok: false, error: `工具执行失败: ${(err as Error).message}` };
    }
  }

  private names(): string[] { return [...this.tools.keys()]; }
}
```

**信封恒不抛契约**（工具层宪法，配测试）：

```ts
test("契约：无论成败，execute 返回的恒是可解析 JSON 字符串（永不 throw）", async () => {
  const reg = new ToolRegistry();
  reg.register({ name: "bomb", description: "", schema: z.object({}),
    execute: async () => { throw new Error("业务代码炸了"); } });
  const result = await reg.execute("bomb", "{}");
  assert.doesNotThrow(() => JSON.parse(result));
  assert.equal(JSON.parse(result).ok, false);
});
```

**错误消息的措辞是 prompt 工程**：`unknown tool: X（可用: a, b, c）`——
把正确名单给它，下一轮它自己改对。4B 实测：把 get_weather 拼错成 get_wether
后，读到错误消息下一轮自愈。

> **引经据典**｜hermes-agent `tools/registry.py`
> 工业级同款：`_bound_error_text` 把进入模型上下文的错误体截到
> `_MAX_TOOL_ERROR_CHARS = 2048`，注释原话 "Bound an error body destined for
> model context"——连错误消息本身都要防"撑爆上下文"（一次工具炸出 10KB
> 堆栈，重试三次上下文就完了）。我们的 120 字截断（段 2）同源。
> 值得现在就学：给错误消息定长，是弱模型系统的基本功。

> **引经据典**｜pi `packages/agent/src/types.ts`
> pi 的对照哲学（3.2 引过，现在更能看懂）：工具**抛异常**、框架捕获后转
> `isError: true` 的结果——"Throw on failure instead of encoding errors in
> content"。谁转不重要，**到达模型的一定是结构化错误**这一点不可妥协。

## 4.3 v0.6 分类重试：只重试值得重试的

先看两种失败在真实世界的差别：

- 引擎被杀后立刻重发 → `fetch failed` ——**一秒后引擎起来就好了**
- 模型把 city 传成 `123`（schema 要 string）→ 重试一百次还是 123

**失败二分法**：瞬时（transient，环境问题，重试有意义）vs 确定性
（fatal，重试无意义只添乱）。四段外壳的段 1-3 天然是确定性的；段 4 的失败
**由业务工具自己声明**——它最懂自己的错误。声明机制：专用异常类。

`tools.ts` 追加（v0.6 全量新增）：

```ts
/** 业务工具抛它 = 声明"我是瞬时失败，值得重试" */
export class TransientToolError extends Error {
  constructor(message: string) { super(message); this.name = "TransientToolError"; }
}

// 工具可声明执行策略（types.ts 追加）：
export interface ToolExecPolicy {
  timeoutMs?: number;      // 单次执行超时；超时视为可重试失败
  retries?: number;        // 瞬时失败重试次数（默认 0）
  retryDelayMs?: number;   // 线性退避：第 n 次重试前等 n × retryDelayMs
}

// Tool 接口加一个可选字段：
// policy?: ToolExecPolicy

// 段 4 替换为策略层调用：
//   return runWithPolicy(tool, parsed.data, policy);
```

策略层全量：

```ts
type AttemptOutcome =
  | { ok: true; data: unknown }
  | { ok: false; kind: "transient" | "fatal"; err: Error };

async function runWithPolicy(
  tool: Tool, args: unknown, policy: ToolExecPolicy,
): Promise<ToolResultEnvelope> {
  const attempts = (policy.retries ?? 0) + 1;
  let lastTransient: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    // 每次尝试独立的 AbortController：超时只放弃当次，不污染重试
    const controller = new AbortController();
    const outcome = await attemptOnce(tool, args, controller, policy.timeoutMs);

    if (outcome.ok) return { ok: true, data: outcome.data };
    if (outcome.kind === "fatal") return { ok: false, error: outcome.err.message };
    lastTransient = outcome.err;
    if (attempt < attempts) await sleep(attempt * (policy.retryDelayMs ?? 0)); // 线性退避
  }
  // 耗尽：文案写给模型——直接改变下一轮行为
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
        controller.abort();                        // 先通知工具自我清理
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
```

三个讲究，各有现场：

- **abort 先于判负**：超时不只是"放弃这次"，先 `controller.abort()` 让工具内部
  挂起的请求/定时器有机会收尾（第二册第 7 章的取消通道就建在这上面）
- **线性退避**（1×、2×、3×）：立刻重连常撞同一块抖动
- **耗尽文案**："不建议再次调用"是写给模型的行动指令——实测它读到后转向
  如实告知用户，而不是无脑再调

测试（三组，剧本化）：

```ts
test("分类重试：flaky 前 2 次瞬时、第 3 次成功 → 自愈", async () => {
  let calls = 0;
  const flaky = { name: "flaky", description: "", schema: z.object({}),
    policy: { retries: 2, retryDelayMs: 0 },
    execute: async () => { if (++calls <= 2) throw new TransientToolError("抖"); return "好了"; } };
  const reg = new ToolRegistry(); reg.register(fakyFix(flaky));
  assert.equal(JSON.parse(await reg.execute("flaky", "{}")).ok, true);
  assert.equal(calls, 3);
});

test("确定性失败不重试：fatal 一次即返回", async () => {
  let calls = 0;
  const bomb = { name: "bomb", description: "", schema: z.object({}),
    policy: { retries: 3, retryDelayMs: 0 },
    execute: async () => { calls++; throw new Error("参数性的错"); } };
  const reg = new ToolRegistry(); reg.register(fakyFix(bomb));
  assert.equal(JSON.parse(await reg.execute("bomb", "{}")).ok, false);
  assert.equal(calls, 1);       // 没有重试——重试无意义
});

test("超时：hang 工具被 abort 唤醒，判定为瞬时", async () => {
  const hang = { name: "hang", description: "", schema: z.object({}),
    policy: { timeoutMs: 50, retries: 0 },
    execute: async (_a, ctx) => new Promise((resolve) => {
      ctx.signal?.addEventListener("abort", () => resolve("被唤醒"), { once: true });
    }) };
  const reg = new ToolRegistry(); reg.register(fakyFix(hang));
  const r = JSON.parse(await reg.execute("hang", "{}"));
  assert.equal(r.ok, false);
  assert.match(r.error, /超时/);
});
```

## 4.4 v0.7 触顶降级：循环的保险丝

第 3 章挖的洞：maxIterations 用尽，用户拿到空气。最直觉的修法——往 messages
塞一句"请直接给出最终回答"再请求一次。**这是 prompt 恳求**：说明书还在
（tools 照发），模型仍然可以再举手，你再塞一句……死循环换了层皮。

**工程做法：协议级没收**。降级请求**不带 tools 字段**——没有说明书，
模型物理上无法发起 tool_calls。不是说服，是断粮：

`loop.ts` 的 for 循环正常走完之后追加（v0.7 全量新增）：

```ts
  // ---- 触顶出口（for 循环走完 = 轮数用尽）----
  // 降级：追加一次【无 tools】请求，逼模型基于已有工具结果作答
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

两处细节：

- **注入用 user 角色 + （系统注入：…）标注**——有的引擎模板要求 system 只能
  出现在开头，非头部 system 直接 500（真机实录，第二册移动端章还会撞）
- 协议没收为主，prompt 提示为辅——**双保险但不互相依赖**。hermes 把同款
  思路叫"预算耗尽后的 grace call"（多给一次收尾机会），我们没收得更彻底

## 4.5 故障注入：验收兜底真的兜得住

以上代码"看起来对"不算数（纪律 6）。做法：把工具**故意搞坏**，看系统反应。
`apps/cli/src/faults.ts`（v0.4 可用版全量，环境变量驱动）：

```ts
import { TransientToolError, type Tool } from "@my-agent/core";

// TAGENT_FAULTS=get_weather:hang|flaky:N|down
export function withFaults(tool: Tool): Tool {
  const spec = (process.env.TAGENT_FAULTS ?? "").split(",").find(
    (s) => s.startsWith(tool.name + ":"),
  );
  if (!spec) return tool;
  const kind = spec.split(":")[1]?.split(":")[0] ?? "";
  const n = Number(spec.split(":")[2] ?? 1);
  let calls = 0;
  const inner = tool.execute.bind(tool);
  return {
    ...tool,
    async execute(args: never, ctx: { signal?: AbortSignal }) {
      calls++;
      if (kind === "hang") {
        return new Promise(() => {                     // 永不 resolve，只听 abort
          ctx.signal?.addEventListener("abort", () => {}, { once: true });
        });
      }
      if (kind === "down" || (kind === "flaky" && calls <= n)) {
        throw new TransientToolError(`[faults:${kind}] 第 ${calls} 次注入瞬时故障`);
      }
      return inner(args, ctx);
    },
  };
}
```

壳装配处包一层：`registry.register(withFaults(weatherTool))`。三个验收场景
（每个真机跑一次 + 存证）：

```powershell
$env:TAGENT_FAULTS = "get_weather:flaky:2"; node apps/cli/dist/main.js
你> 查北京天气
⚙ get_weather {"city":"北京"}     ↳ ✖ 瞬时故障…（第1次）→ 自动重试 → ✔ 成功 → 正常回答
#    观察点：用户端无感。重试发生在策略层内部，最终拿到正确答案

$env:TAGENT_FAULTS = "get_weather:down"
你> 查北京天气
#    期望：模型读到"不建议再次调用"→ 转为如实告知，而不是无脑再调

$env:TAGENT_FAULTS = "get_weather:hang"      # 工具要配 policy.timeoutMs=3000
你> 查北京天气
#    期望：3 秒超时 → 判瞬时 → 重试/耗尽链路 → 用户拿到解释而非卡死
```

> **引经据典**｜hermes-agent `tools/approval.py` 的故障哲学
> 工业级把"故意搞坏"做成了体系：审批流水线里有 ~47 条危险 pattern 正则、
> 命令归一化防混淆绕过。我们本章的 faults.ts 是它最小形态——**方向一致：
> 安全性不是设计出来的，是攻出来的**。

## 4.6 本章总表：失败 × 对策（全书引用最多）

| # | 失败 | 对策 | 版本 |
|---|---|---|---|
| 1 | 工具抛异常/参数烂 | 错误信封（恒不抛，失败数据化，措辞即提示词） | v0.5 ✅ |
| 2 | 瞬时故障 | 分类重试（TransientToolError 声明制 + 线性退避 + 耗尽劝退） | v0.6 ✅ |
| 3 | 执行卡死 | 超时（race + abort 通知自清） | v0.6 ✅ |
| 4 | 循环失控 | 触顶降级（协议级没收 tools，prompt 只是双保险） | v0.7 ✅ |
| 5 | 上下文爆炸 | 裁剪/压缩（回合完整 + user 原文钉住） | 第二册 v0.8 |
| 6 | 静默失败（发呆/复读/截断） | 循环守卫（有限次 + 可观测） | 第二册 v0.9 |
| 7 | 格式纪律差 | 受限解码（GBNF 语法锁） | 第二册 v0.11 |

## 4.7 自测与对照

**自测**：
- [ ] 信封恒不抛契约能默写；错误措辞为什么是 prompt 工程能举例（unknown tool 带名单）
- [ ] 失败二分法 + 三个讲究（abort 先于判负/线性退避/耗尽文案）各自的现场
- [ ] 触顶降级能说清"没收 vs 恳求"；为什么注入用 user 角色
- [ ] 三组重试测试 + 三个注入场景全过，各有一份存证

**与 tagent 对照**：你的 tools.ts ≈ tagent 完全体（它多互斥键队列——第二册
v0.11）；faults.ts 是 tagent 同名文件的简化版（它的支持 per-工具多剧本与
启动横幅）。

第一册只剩一步：把 v0.1~v0.7 攒下的一切，放进一次正式的总验收。
