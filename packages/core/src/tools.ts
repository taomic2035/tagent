import { z } from "zod";
import type { Tool, ToolContext, ToolDef, ToolExecPolicy } from "./types.js";

// ============================================================
// 工具结果信封：execute 的返回恒为 JSON 字符串，形态恒为这两种之一
// （这是 loop 能无脑回填给模型的保证，见 DESIGN.md §3）
// ============================================================
export interface ToolResultOk {
  ok: true;
  data: unknown;
}
export interface ToolResultFail {
  ok: false;
  error: string;
  /** 参数校验失败时的细节（zod issues 的精简版），帮助模型自我纠正 */
  issues?: Array<{ path: string; message: string }>;
  /** 因瞬时失败重试耗尽时携带（Step 2 FR-14）：提示模型不要再调、转向说明或换方案 */
  retriesUsed?: number;
}
export type ToolResultEnvelope = ToolResultOk | ToolResultFail;

/**
 * 业务工具用它声明「本次失败是瞬时的」（Step 2 FR-13）。
 * 注册表只对这类异常（以及超时）重试；普通异常是确定性失败，重试必得同果。
 */
export class TransientToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientToolError";
  }
}

/** 单次尝试的失败分类（DESIGN §11.2） */
type AttemptFailure = { kind: "transient"; err: Error } | { kind: "fatal"; err: Error };

/**
 * 工具登记与执行的安全外壳。
 *
 * 职责边界：模型输出的 tool_calls 是【不可信的外部输入】——
 * 工具名可能不存在、参数 JSON 可能残缺、参数可能不符合 schema、
 * 工具本身可能抛异常。本类把所有这些失败统一转成错误信封，
 * 交给 loop 回填给模型自我纠正（DESIGN.md §3：恒不抛异常契约）。
 *
 * Step 2 起在第 4 段施加执行策略（超时/重试，FR-12~14）。
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  /** 互斥键 → 尾部 Promise（Step 12，FR-65）：同键 FIFO 串行的队列本体。
   *  链上吞异常（.then(noop, noop)）防止一次失败断掉后续排队。 */
  private keyQueues = new Map<string, Promise<void>>();

  /** 登记工具。重名是程序员错误（启动期），这里允许 throw——
   *  与 execute 的"恒不抛"契约不同，不要混淆这两个场景。 */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`duplicate tool name: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  /** 全部工具的 JSON Schema 形态（传给 LLM 的 tools 参数）。
   *  zod 4 的 z.toJSONSchema 把 zod schema 翻译成标准 JSON Schema——
   *  你用 TS 类型定义一次，协议侧自动生成，两边永不失同步。 */
  schemas(): ToolDef[] {
    return [...this.tools.values()].map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: z.toJSONSchema(tool.schema),
      },
    }));
  }

  /**
   * 执行一个工具调用。四段流程，任何一段失败都返回错误信封（恒不 throw）：
   *   1. 工具名是否存在
   *   2. arguments 是否是合法 JSON（模型逐 token 生成的文本，可能残缺）
   *   3. 参数是否符合 zod schema（类型/必填/枚举）
   *   4. 真正执行（try/catch 包裹 + Step 2 策略：超时/重试）
   *
   * @param name     模型给出的工具名
   * @param argsJson 模型给出的 arguments 字符串（原样透传，此处才 parse）
   * @param ctx      执行上下文（signal 由策略层按尝试注入，FR-17）
   */
  async execute(
    name: string,
    argsJson: string,
    ctx?: ToolContext,
  ): Promise<string> {
    const envelope = await this.executeEnvelope(name, argsJson, ctx);
    return JSON.stringify(envelope);
  }

  private async executeEnvelope(
    name: string,
    argsJson: string,
    ctx?: ToolContext,
  ): Promise<ToolResultEnvelope> {
    // 1. 未知工具（确定性失败，不重试）
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `unknown tool: ${name}（可用: ${this.names().join(", ") || "无"}）` };
    }

    // 2. JSON 解析（arguments 在协议里是字符串，DESIGN.md §1；确定性失败，不重试）
    let raw: unknown;
    try {
      raw = JSON.parse(argsJson);
    } catch {
      return {
        ok: false,
        error: `arguments 不是合法 JSON: ${argsJson.slice(0, 120)}`,
      };
    }

    // 3. schema 校验。issues 精简为 path+message，让模型读得懂错在哪（不重试）
    const parsed = tool.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "参数校验失败",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join(".") || "(root)",
          message: issue.message,
        })),
      };
    }

    // 4. 执行 + Step 2 策略（超时/重试/退避，DESIGN §11.2）；
    //    有互斥键的工具进同键 FIFO 队列（Step 12，FR-65）——校验段是纯函数不进队列
    const run = () => runWithPolicy(tool, parsed.data, ctx);
    if (!tool.serialize) return run();
    const key = tool.serialize;
    const prev = this.keyQueues.get(key) ?? Promise.resolve();
    const chained = prev.then(run); // run 恒不抛（信封契约），链安全
    this.keyQueues.set(key, chained.then(
      () => undefined,
      () => undefined,
    ));
    return chained;
  }
}

// ============================================================
// 执行策略层（Step 2）：纯 TS，无新依赖（NFR-8）
// ============================================================

/** 单次尝试的结果：成功数据 / 瞬时失败（可重试）/ 确定性失败（不可重试）。
 *  ok 为全成员判别式（true/false 字面量），保证收窄可靠。 */
type AttemptOutcome =
  | { ok: true; data: unknown }
  | { ok: false; kind: "transient" | "fatal"; err: Error };

async function runWithPolicy(
  tool: Tool,
  args: unknown,
  outerCtx: ToolContext | undefined,
): Promise<ToolResultEnvelope> {
  const policy: ToolExecPolicy = tool.policy ?? {};
  const retries = policy.retries ?? 0;
  const attempts = retries + 1;
  let lastTransient: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    // 外层取消检查（Step 14，FR-76）：用户中断后不再发起下一次尝试
    if (outerCtx?.signal?.aborted) {
      return { ok: false, error: "（执行被中断：外层取消信号已触发）" };
    }
    // 每次尝试独立的超时信号（§11.2）：超时只放弃当次尝试，不污染重试；
    // 与外层取消信号组合（Step 14 修复既有断点：此前超时 signal 直接覆盖
    // 外层 signal，取消永远传不进工具）
    const controller = new AbortController();
    const signals: AbortSignal[] = [controller.signal];
    if (outerCtx?.signal) signals.push(outerCtx.signal);
    const ctx: ToolContext = { ...outerCtx, signal: signals.length === 1 ? controller.signal : AbortSignal.any(signals) };

    const outcome = await attemptOnce(
      tool,
      args,
      ctx,
      policy.timeoutMs,
      () => controller.abort(), // 超时先通知工具清理（FR-17），race 结果不受影响
    );

    if (outcome.ok) return { ok: true, data: outcome.data };
    if (outcome.kind === "fatal") return { ok: false, error: outcome.err.message };
    lastTransient = outcome.err;
    if (attempt < attempts) {
      const delay = attempt * (policy.retryDelayMs ?? 0);
      if (delay > 0) await sleep(delay); // 线性退避：第 n 次重试前等 n × retryDelayMs
    }
  }

  return {
    ok: false,
    error: `瞬时故障持续：${lastTransient?.message ?? "unknown"}（已重试 ${retries} 次仍失败，不建议再次调用；请向用户如实说明或改用其他方案）`,
    retriesUsed: retries,
  };
}

async function attemptOnce(
  tool: Tool,
  args: unknown,
  ctx: ToolContext,
  timeoutMs: number | undefined,
  onTimeout: () => void,
): Promise<AttemptOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // 无 timeoutMs 时永不 settle：race 只看工具自身的结果
  const timeoutPromise: Promise<AttemptOutcome> = timeoutMs
    ? new Promise((resolve) => {
        timer = setTimeout(() => {
          onTimeout();
          resolve({ ok: false, kind: "transient", err: new TransientToolError(`执行超时（${timeoutMs}ms）`) });
        }, timeoutMs);
      })
    : new Promise(() => {});

  try {
    // registry 里 Tool 的泛型已被擦除为 z.ZodType，此处 cast 是策略边界的一次性妥协
    return await Promise.race([
      tool.execute(args as never, ctx).then(
        (data): AttemptOutcome => ({ ok: true, data }),
        toFailure,
      ),
      timeoutPromise,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function toFailure(err: unknown): AttemptOutcome {
  if (err instanceof TransientToolError) {
    return { ok: false, kind: "transient", err };
  }
  return { ok: false, kind: "fatal", err: err instanceof Error ? err : new Error(String(err)) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
