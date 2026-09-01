# 第 4 章 兜底：弱模型生存指南

> 本章目标：把上一章裸奔的工具层封成**打不死的安全外壳**（错误信封 + 分类重试 +
> 超时），给失控的循环装保险丝（触顶降级），最后学会"故障注入"这一验收利器。
> 你将理解全书最重要的一条工程哲学：**模型的不可靠是常态，可靠是工程做出来的**。
> 预计 1 天。

---

## 4.1 残酷现实课：4B 模型有多蠢

先建立对手认知。以下全部是参考实现（Qwen3.5-4B，temperature 0.7）的真机实录：

| 失败形态 | 实录 |
|---|---|
| **复读** | "反复核对北京上海天气"任务里，模型连续 4 轮发起**完全相同**的调用（同名同参），白白烧轮数（真实采样：6 个诱发任务命中 1 个） |
| **发呆** | 返回空内容且不举手——既不回答也不调工具（日常任务实测 0/10，低频但存在） |
| **格式崩坏** | 让它走纯文本协议（第 7 章），75% 的任务它会把格式写歪：Action 拼错、JSON 断在半截、把 Observation 自己编了 |
| **思考烧穿** | 开思考模式后，简单数数题内耗 1251 token（90 秒），关思考 131 token（7.9 秒）**且答得更对** |
| **过度自信** | 工具明确报错"无火星数据"后，仍有概率编一段火星天气出来 |

结论不是"4B 不能用"——结论是：**每一类失败都有对应的工程对策**，本章把对策表
的前三行做出来，剩下的（复读/发呆/截断）在进阶章展开。这张表请先记住形状：

| 模型失败 | 工程对策 | 章节 |
|---|---|---|
| 工具抛异常/参数烂 | 错误信封：永不崩溃，失败数据化 | 本章 |
| 瞬时故障（网络/超时） | 分类重试：只重试值得重试的 | 本章 |
| 循环失控 | 触顶降级：协议级没收工具 | 本章 |
| 复读/发呆/截断 | 循环守卫 | 第二册 |
| 思考不收敛 | 请求级开关 + 预算 | 第二册 |
| 格式纪律差 | 受限解码 | 第二册 |

## 4.2 错误信封：永不崩溃的执行外壳

第 3 章实验 2 的崩溃还疼吗？`JSON.parse` 一炸，整个 agent 死给用户看。
修法：把 `execute` 包成**四段安全流程**，每段的失败都不抛、都变成结构化错误：

```ts
// packages/core/src/tools.ts —— execute 的完全体

export interface ToolResultOk { ok: true; data: unknown }
export interface ToolResultFail { ok: false; error: string }
export type ToolResultEnvelope = ToolResultOk | ToolResultFail;

/** 业务工具抛这个异常 = 声明"我是瞬时故障，值得重试"（4.3 用） */
export class TransientToolError extends Error {
  constructor(message: string) { super(message); this.name = "TransientToolError"; }
}

async executeEnvelope(name: string, argsJson: string): Promise<ToolResultEnvelope> {
  // 段 1：工具名存在吗（确定性失败，不重试）
  const tool = this.tools.get(name);
  if (!tool) return { ok: false, error: `unknown tool: ${name}（可用: ${this.names().join(", ")}）` };

  // 段 2：arguments 是合法 JSON 吗（确定性失败——模型逐 token 生成的文本可能残缺）
  let raw: unknown;
  try { raw = JSON.parse(argsJson); }
  catch { return { ok: false, error: `arguments 不是合法 JSON: ${argsJson.slice(0, 120)}` }; }

  // 段 3：参数符合 schema 吗（确定性失败，附 issues 帮模型自我纠正）
  const parsed = tool.schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "参数校验失败", issues: parsed.error.issues.map((i) => ({
      path: i.path.map(String).join(".") || "(root)", message: i.message,
    }))};
  }

  // 段 4：真正执行（try/catch + 策略层：超时/重试，见 4.3）
  return runWithPolicy(tool, parsed.data);
}

async execute(name: string, argsJson: string): Promise<string> {
  return JSON.stringify(await this.executeEnvelope(name, argsJson));
}
```

**为什么"永不抛"是对的**：execute 的结果要回填给模型看。崩溃用户看不懂，
信封模型看得懂——`{"ok":false,"error":"参数校验失败","issues":[{"path":"city",
"message":"城市名不能为空"}]}` 就是给模型的**纠错提示词**。第 3 章场景 5 的
"失败后如实回答"，靠的就是这层。

**信封恒不抛契约**（从此是工具层的宪法）：调用方永远拿到 JSON 字符串。
对应测试：

```ts
test("契约：无论成败，execute 返回的恒是可解析 JSON 字符串（永不 throw）", async () => {
  const reg = new ToolRegistry();
  reg.register({ name: "bomb", description: "", schema: z.object({}),
                 execute: async () => { throw new Error("业务代码炸了"); } });
  const result = await reg.execute("bomb", "{}");
  assert.doesNotThrow(() => JSON.parse(result));        // 可解析
  assert.equal(JSON.parse(result).ok, false);           // 失败被信封接住
});
```

## 4.3 分类重试：只重试值得重试的

失败分两类，对策完全不同：

- **瞬时（transient）**：网络抖一下、超时、服务 502——**环境问题，重试有意义**
- **确定性（fatal）**：参数错、工具名错、业务规则不允许——**重试一万次结果相同**，
  只会让模型白等、上下文白涨

判定的责任分给两侧：**业务工具最懂自己的失败**——它用 `TransientToolError`
声明"我这错是瞬时的"；四段外壳里除执行外的失败（名字/JSON/schema）天然是确定性的。
超时自动归瞬时。

`runWithPolicy`（接在段 4，策略层）：

```ts
import type { Tool, ToolExecPolicy } from "./types.js";

export interface ToolExecPolicy {
  timeoutMs?: number;     // 单次执行超时（毫秒），超时视为可重试失败
  retries?: number;       // 可重试失败的重试次数（默认 0）
  retryDelayMs?: number;  // 线性退避基数：第 n 次重试前等 n × retryDelayMs
}

async function runWithPolicy(tool: Tool, args: unknown): Promise<ToolResultEnvelope> {
  const policy: ToolExecPolicy = tool.policy ?? {};
  const attempts = (policy.retries ?? 0) + 1;
  let lastTransient: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    // 每次尝试独立的 AbortController：超时只放弃当次尝试，不污染重试
    const controller = new AbortController();
    const outcome = await attemptOnce(tool, args, controller, policy.timeoutMs);

    if (outcome.ok) return { ok: true, data: outcome.data };
    if (outcome.kind === "fatal") return { ok: false, error: outcome.err.message };
    lastTransient = outcome.err;                    // 瞬时：歇一下再试
    if (attempt < attempts) await sleep(attempt * (policy.retryDelayMs ?? 0));
  }
  // 重试耗尽：错误消息要劝模型"别再调了，想别的办法"
  return { ok: false, error: `瞬时故障持续：${lastTransient?.message}
（已重试 ${policy.retries} 次仍失败，不建议再次调用；请向用户如实说明或改用其他方案）`,
    retriesUsed: policy.retries };
}

function attemptOnce(tool, args, controller, timeoutMs) {
  // Promise.race：工具本体 vs 超时定时器，先到先得
  const timeout = timeoutMs
    ? new Promise((resolve) =>
        setTimeout(() => { controller.abort();
          resolve({ ok: false, kind: "transient",
                    err: new TransientToolError(`执行超时（${timeoutMs}ms）`) });
        }, timeoutMs))
    : new Promise(() => {});                        // 无超时：永不 settle
  return Promise.race([
    tool.execute(args, { signal: controller.signal }).then(
      (data) => ({ ok: true as const, data }),
      (err) => err instanceof TransientToolError
        ? { ok: false as const, kind: "transient" as const, err }
        : { ok: false as const, kind: "fatal" as const, err },
    ),
    timeout,
  ]);
}
```

三个讲究：

- **abort 信号传给工具**：超时先 `controller.abort()` 通知工具自我清理
  （挂起的网络请求、定时器要能被叫停），而不是干等到 race 判负
- **线性退避**（1×、2×、3× 延迟）：立刻重连常常撞同一块抖动，歇一下成功率更高
- **重试耗尽的文案写给模型**：错误消息就是下一轮的 prompt——"不建议再次调用"
  直接改变模型行为。这不是玄学，是信封设计的直接回报

测试（剧本化，不依赖真时间）：

```ts
test("分类重试：flaky 前 2 次瞬时失败、第 3 次成功 → 自动自愈", async () => {
  let calls = 0;
  const flaky: Tool<z.ZodObject<{}>> = {
    name: "flaky", description: "", schema: z.object({}),
    policy: { retries: 2, retryDelayMs: 0 },
    execute: async () => { if (++calls <= 2) throw new TransientToolError("抖"); return "好了"; },
  };
  const reg = new ToolRegistry(); reg.register(flaky);
  assert.equal(JSON.parse(await reg.execute("flaky", "{}")).ok, true);
  assert.equal(calls, 3);
});
```

## 4.4 触顶降级：循环的保险丝

第 3 章实验 3 还欠着答案：`maxIterations` 用尽，模型没收尾，用户拿到空气。
最直觉的修法是往 messages 里塞一句"请直接给出最终回答"再请求一次——
**这是 prompt 恳求，靠不住**（模型仍然可以再举手）。

工程做法：**协议级保证**。降级请求**不带 `tools` 字段**——说明书没给它，
它物理上无法再发起 `tool_calls`（引擎没有工具可调）。这不是说服，是没收：

```ts
// loop.ts 的循环出口（for 循环正常走完 = 轮数用尽）
// 触顶降级：追加一次【无 tools】请求，逼模型基于已有结果作答
messages.push({ role: "user", content:
  "（系统注入：已达工具调用次数上限，不要再请求工具，请基于已获得的工具结果直接给出最终回答）" });

let degradeText = "";
for await (const ev of client.stream({ messages, temperature: 0 })) {  // 注意：不传 tools
  if (ev.type === "text-delta") degradeText += ev.delta;
}
messages.push({ role: "assistant", content: degradeText });
```

注意两处：注入用 **user 角色**（system 只能在开头的模板限制——第二册的
移动端章有实证）；即便如此仍带上"不要调工具"的文案——**协议保证为主，
prompt 提示为辅**，双保险但不互相依赖。

什么时候真会触顶？——第 3 章的复读实录就是现场：模型连点 4 次相同调用后
轮数耗尽。降级让用户至少拿到"基于已有数据的诚实总结"而不是空气。

## 4.5 故障注入：验收兜底真的兜得住

以上代码"看起来对"不算数（纪律 6）。验收方法：**把工具故意搞坏，看系统反应**。
做一个壳层的故障注入器（`apps/cli/src/faults.ts`）：

```ts
// TAGENT_FAULTS=get_weather:hang,get_weather:flaky:2,get_weather:down
//   hang     永不 resolve（只听 abort）→ 验证超时
//   flaky:N  前 N 次抛 TransientToolError → 验证重试自愈
//   down     恒抛 TransientToolError → 验证重试耗尽后的劝退文案
export function withFaults(tool: Tool, spec: string | undefined): Tool {
  if (!spec) return tool;
  const [_, kind, n] = spec.split(":");  // 简版：每种工具一个剧本
  let calls = 0;
  return { ...tool, async execute(args, ctx) {
    calls++;
    if (kind === "hang") return new Promise(() => { ctx?.signal?.addEventListener("abort", () => {}, { once: true }); });
    if (kind === "down" || (kind === "flaky" && calls <= Number(n ?? 1)))
      throw new TransientToolError(`[faults] 第 ${calls} 次注入瞬时故障`);
    return tool.execute(args, ctx);
  }};
}
```

三个验收场景（每个都是一次真机运行 + 存证）：

```powershell
# Windows PowerShell
$env:TAGENT_FAULTS = "get_weather:flaky:2"
node apps/cli/dist/main.js
你> 查北京天气
#   期望：⚙ 调用 → ✖ 瞬时故障（第1次）→ 自动重试 → ✖（第2次）→ 重试 → ✔ 成功 → 正常回答
#   观察点：用户端无感，transcript 里有 retriesUsed: 2

$env:TAGENT_FAULTS = "get_weather:down"     # 重试耗尽
你> 查北京天气
#   期望：模型读到"不建议再次调用"→ 转为如实告知用户，而不是无脑再调

$env:TAGENT_FAULTS = "get_weather:hang"     # 配 policy.timeoutMs = 3000 验证
你> 查北京天气
#   期望：3 秒后超时判定 → 走重试/耗尽链路 → 用户拿到解释而非卡死
```

故障注入的哲学：**兜底代码的测试覆盖率不能靠运气**——等真故障来验收你的
重试代码，那是生产事故；主动制造故障，才是工程。

## 4.6 对照表：七类失败 × 七层对策

本章收束成表（全书引用最多的一张表，来自参考实现 FALLBACK.md 的教程版）：

| # | 模型失败 | 工程层 | 核心原则 |
|---|---|---|---|
| 1 | 工具抛异常 | 错误信封 | 永不崩溃；失败写成模型能读的 JSON |
| 2 | 瞬时故障 | 分类重试 | 只重试瞬时（TransientToolError 声明制）；线性退避 |
| 3 | 执行卡死 | 超时 + abort | race 判定 + 信号通知工具自清 |
| 4 | 循环失控 | 触顶降级 | **协议级没收工具**（不传 tools），prompt 提示只是双保险 |
| 5 | 上下文爆炸 | 裁剪/压缩 | 第二册第 5 章（回合完整 + user 原则钉住） |
| 6 | 静默失败（发呆/复读/截断） | 循环守卫 | 第二册第 6 章（有限次 + 可观测） |
| 7 | 格式纪律差 | 受限解码 | 第二册第 7 章（GBNF 语法锁） |

贯穿的原则只有一条：**把"模型的自觉"换成"协议的保证"**——能没收的不恳求，
能数据化的不崩溃，能注入验收的不靠运气。

## 4.7 本章完整可抄清单

```
packages/core/src/
├── types.ts      # + ToolExecPolicy
├── tools.ts      # ToolRegistry 完全体：executeEnvelope 四段 + runWithPolicy + attemptOnce + TransientToolError
└── tools.test.ts # 信封契约 / 分类重试 / 重试耗尽 / 超时 四组测试
apps/cli/src/
├── faults.ts     # 故障注入器（env: TAGENT_FAULTS）
└── main.ts       # + 注册工具时包 withFaults；启动横幅显示注入状态
```

参考实现对照：tagent 的 `tools.ts` + `faults.ts` 即本章完全体
（互斥键与并行执行在第二册第 7 章加上）。

## 4.8 自测清单

- [ ] 能背出失败二分法：瞬时 vs 确定性，以及为什么确定性失败重试无意义
- [ ] 能解释信封契约的三重价值：不崩用户、可读模型、可测试
- [ ] 重试三讲究（abort 通知 / 线性退避 / 耗尽文案）各自解决什么
- [ ] 能说清触顶降级为什么"不传 tools"比"prompt 恳求"可靠——协议保证 vs 模型自觉
- [ ] 三个故障注入场景都真机跑过并各有一份存证；能指出 transcript 里 retriesUsed 的位置
- [ ] 看着 4.1 的失败实录表，能说出每行的对策在第几章——包括还没学的三行

---

## 第一册收官

到这里你已经拥有：一个跑在本地的推理引擎、一个零依赖的手写客户端（HTTP+SSE）、
一个会自主调工具的 agent 循环、一套打不死的工具层。**这就是一个能干活且兜得住
的真 agent**——第一册承诺的东西全部在案，且每一步都有存证可查。

下一步（第二册预告）：让它记性好（上下文管理与记忆）、缰绳在手（思考开关、
打断、守卫）、并行动作（ReAct 与并行执行）、装进手机（移动端大作业），
以及让它自己证明"我做完了"（验收自动化）。
