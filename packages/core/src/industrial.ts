import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ToolContext, Tool, ToolExecPolicy, ChatMessage } from "./types.js";

// ============================================================
// 工业模式复现（Step 16，FR-80/81/82/91）：从 tagent 教程第 11 章的
// 三个 hermes/pi 机制，按 60/80/100 三档复现。代码内 [60]/[80]/[100]
// 注释标档，测试按档分层（见同目录 *.test.ts）。
//
// 模式一（FR-80）terminate 批规则 —— pi：当且仅当批内所有工具结果
//   都带 terminate 时，run 直接以工具结果收尾，不再请求下一轮 assistant。
//   动机原文："否则每个这样的 run 都要为一个唯一目的是停下来的模型轮买单。"
//
// 模式二（FR-81）recover-don't-rerun —— hermes：输出溢出不是坏消息，
//   全文 spill 到内容寻址文件，信封直接给恢复配方（分页读取路径）。
//   动机：CPU 上重跑 90 秒脚本只为看第 200 行不可接受。
//
// 模式三（FR-91）execute_code + CellAuthority —— hermes PTC 的教学版：
//   受限 vm 里跑 JS，工具经闭包回调宿主 registry；只有脚本返回值进
//   上下文（中间结果永不进）；持久 context（变量跨调用存活）但
//   **权限必须不持久**——每 cell 一个 authority token，结束即 retire，
//   迟到调用一律拒绝。
//   动机原文："Interpreter state persists across cells; RPC authority must not."
// ============================================================

// ---------------- 模式一：terminate 批规则（FR-80） ----------------

/**
 * [60] 信封级 terminate 声明：工具结果自带"这是终答交付"语义。
 * 工具在返回信封里带 terminate: true（如 submit_final_result 类工具）。
 */
export interface TerminateCapableEnvelope {
  ok: boolean;
  terminate?: boolean; // [60] 声明交付即完成
}

/**
 * [60] 批规则判定（纯函数）：当且仅当批内**所有**结果都 terminate 才收尾。
 * [80] 混合批（部分 terminate）正确忽略——pi 语义精确复刻。
 * @returns true = 循环应直接以工具结果收尾，不再请求下一轮
 */
export function shouldTerminateByTools(results: string[]): boolean {
  if (results.length === 0) return false;
  return results.every((r) => {
    try {
      const env = JSON.parse(r) as TerminateCapableEnvelope;
      return env.terminate === true;
    } catch {
      return false; // 非信封结果不参与 terminate 判定
    }
  });
}

// ---------------- 模式二：recover-don't-rerun（FR-81） ----------------

export interface SpillMeta {
  spilled: boolean;
  spillPath?: string;
  fullBytes?: number;
  keptBytes?: number;
}

/** [80] head 40% + tail 60% 窗口截断（deque 滚动保尾的直译） */
export function headTailWindow(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = Math.floor(limit * 0.4);
  const tail = limit - head;
  return `${text.slice(0, head)}\n…[截断：全文已溢写，见信封 spillPath]…\n${text.slice(-tail)}`;
}

/**
 * [60] 超限 spill 落盘（内容寻址）+ [80] 窗口截断 + [100] 结构化元数据。
 * 返回截断后的文本与元数据——信封的 data 里带 spill 指引。
 */
export function spillIfOversized(
  output: string,
  opts: { limitBytes?: number; spillDir?: string } = {},
): { text: string; meta: SpillMeta } {
  const limit = opts.limitBytes ?? 4096;
  if (output.length <= limit) return { text: output, meta: { spilled: false } };

  // [80] 内容寻址：sha256 前 12 位，相同输出只存一份（hermes 同款）
  const digest = createHash("sha256").update(output).digest("hex").slice(0, 12);
  const dir = opts.spillDir ?? join(process.cwd(), "logs", "spill");
  const path = join(dir, `out-${digest}.txt`);
  if (!existsSync(path)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, output, "utf-8");
  }

  const kept = headTailWindow(output, limit);
  // [100] 结构化截断元数据（而非仅文本标记——标记可能被上层再截断）
  return {
    text: kept,
    meta: {
      spilled: true,
      spillPath: path,
      fullBytes: Buffer.byteLength(output),
      keptBytes: Buffer.byteLength(kept),
    },
  };
}

/** 工具包装器：execute 结果超限自动 spill（挂到 registry 的工具上用） */
export function withSpill<T extends Tool>(tool: T, limitBytes = 4096): T {
  const inner = tool.execute.bind(tool);
  return {
    ...tool,
    async execute(args: never, ctx: ToolContext) {
      const result = await inner(args, ctx);
      const s = JSON.stringify(result);
      if (s.length <= limitBytes) return result;
      const { text, meta } = spillIfOversized(s, { limitBytes });
      return {
        truncated: true,
        preview: text,
        recovery: `全文 ${meta.fullBytes} 字节已溢写至 ${meta.spillPath}（内容寻址，重复输出自动复用）——用文件读取工具分页取回，不要重跑`,
        ...meta,
      };
    },
  } as T;
}

// ---------------- 模式三：execute_code + CellAuthority（FR-91） ----------------

/**
 * CellAuthority：[80] 每 cell 一个不透明 token；[100] retire 后迟到调用拒绝。
 * 状态（vm context）跨 cell 存活；权限（authority）必须不。
 */
export class CellAuthority {
  private retired = false;
  readonly token: string;

  constructor() {
    // [80] 随机 token：cell 生命期内回调凭它过闸
    this.token = createHash("sha256")
      .update(`${Date.now()}-${Math.random()}`)
      .digest("hex")
      .slice(0, 16);
  }

  retire(): void {
    this.retired = true;
  }

  /** [100] 迟到调用拒绝：cell 结束后的任何回调都抛（hermes 语义直译） */
  checkAlive(): void {
    if (this.retired) {
      throw new Error(
        "[CellAuthority] cell 已结束，迟到的工具调用被拒绝——" +
          "状态可以跨 cell 存活，权限必须不（防止后台遗留代码用过期身份执行）",
      );
    }
  }
}

export interface ExecuteCodeDeps {
  /** 工具回调通道：脚本里调 tools.xxx(...) 经此回到宿主 registry */
  callTool: (name: string, argsJson: string, token: string) => Promise<string>;
  /** [80] 工具白名单：不在名单内的调用直接拒（hermes SANDBOX_ALLOWED_TOOLS） */
  allowedTools?: string[];
  /** 每 cell 工具调用预算（hermes 默认 50） */
  callBudget?: number;
}

export interface CellResult {
  returnValue: string; // 只有返回值进上下文（中间结果永不进——PTC 核心）
  stdout: string;
  authorityRetired: boolean;
  toolCallsUsed: number;
}

/**
 * [60] 单次受限执行：node:vm，无 require/process/fs 全局；
 * [80] 持久 context（调用方持有 context 对象跨 cell 复用）+ authority；
 * [100] retire 后拒绝 + 白名单 + 预算。
 */
export function runCodeCell(
  code: string,
  deps: ExecuteCodeDeps,
  opts: { context?: Record<string, unknown> } = {},
): Promise<CellResult> {
  // 此处用动态 import 保持 core 的静态可树摇性（vm 是 node 内置，不算外部依赖）
  return import("node:vm").then((vm) => {
    const authority = new CellAuthority();
    let callsUsed = 0;
    const budget = deps.callBudget ?? 50;

    const toolsProxy: Record<string, (arg: unknown) => Promise<string>> = new Proxy(
      {},
      {
        get(_t, name: string) {
          return async (arg: unknown): Promise<string> => {
            authority.checkAlive(); // [100] 迟到拒绝（retire 后 get 到的函数仍可能被调）
            if (deps.allowedTools && !deps.allowedTools.includes(name)) {
              throw new Error(`[execute_code] 工具 ${name} 不在白名单内`);
            }
            if (++callsUsed > budget) {
              throw new Error(`[execute_code] 超出本 cell 工具调用预算 ${budget}`);
            }
            const argJson = typeof arg === "string" ? arg : JSON.stringify(arg ?? {});
            return deps.callTool(name, argJson, authority.token);
          };
        },
      },
    );

    // [80] 持久沙箱：调用方传入的 context 对象跨 cell 复用（变量存活）
    //      每次注入新鲜的 tools（权限不持久）。
    //      关键：vm.createContext 让 context 对象成为真正的持久 V8 realm——
    //      globalThis 赋值会落到 context 上，跨 cell 存活
    if (opts.context && !vm.isContext(opts.context)) {
      vm.createContext(opts.context);
    }
    const sandbox: Record<string, unknown> = opts.context ?? {};
    // 每次注入新鲜 tools（权限不持久——状态活权限死）
    sandbox.tools = toolsProxy;
    sandbox.console = { log: () => {}, error: () => {} };
    sandbox.JSON = JSON;
    sandbox.Math = Math;
    // runInContext 要求 contextified 对象——无持久 context 时也须 createContext
    if (!vm.isContext(sandbox)) vm.createContext(sandbox);

    // vm 不支持顶层 await——包一层 async IIFE。注意：块体 arrow 需要显式
    // return 才有返回值（与 hermes kernel 同语义：脚本作者负责 return）
    const wrapped = "(async () => {\n" + code + "\n})()";
    const result = vm.runInContext(wrapped, sandbox, {
      timeout: 10_000,
      displayErrors: true,
    });

    return Promise.resolve(result).then((returnValue) => {
      authority.retire(); // [80] 结算即 retire
      return {
        returnValue:
          returnValue === undefined
            ? "(undefined)"
            : typeof returnValue === "string"
              ? returnValue
              : JSON.stringify(returnValue),
        stdout: "",
        authorityRetired: true,
        toolCallsUsed: callsUsed,
      };
    });
  });
}

// ---------------- 模式四（FR-82）：effect sandwich 孤儿检测 ----------------

export interface OrphanReport {
  orphanToolCallIds: string[]; // 有意图（assistant tool_calls）无结算（tool 消息）
  orphanToolMsgIds: string[];  // 有结算无意图（重建/损坏场景）
}

/**
 * [60] 孤儿检测（纯函数）：意图（assistant.tool_calls）与结算（tool 消息）配对审计。
 * pi 语义："唯一不确定窗口 = 意图已持久化而结算缺席"——孤儿 tool_call 就是这个窗口的化石。
 * [80] 反向孤儿（结算无意图）也报——损坏/手编 messages 的信号。
 */
export function auditEffectSandwich(messages: ChatMessage[]): OrphanReport {
  const calls = new Map<string, boolean>(); // id -> settled?
  const results = new Set<string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) if (!calls.has(tc.id)) calls.set(tc.id, false);
    } else if (m.role === "tool") {
      results.add(m.tool_call_id);
      if (calls.has(m.tool_call_id)) calls.set(m.tool_call_id, true);
    }
  }
  return {
    orphanToolCallIds: [...calls.entries()].filter(([, settled]) => !settled).map(([id]) => id),
    orphanToolMsgIds: [...results].filter((id) => !calls.has(id)),
  };
}

// ---------------- 模式七（FR-86）：AwaitState 统一等待契约 ----------------

export interface AwaitState<S extends string, P extends string> {
  readonly v: 1;
  readonly generation: number;          // 乐观并发
  readonly subjectRef: S;               // 如 "task:42"
  readonly when: readonly P[];          // 谓词（最多 4 个，kind 不重复——受理约束）
  readonly then: string;                // 唤醒后的续跑说明
  readonly expiresAt: number;
  readonly baseline?: unknown;          // [80] 等待开始时的世界快照
  readonly ownerFence?: { kind: "containing_task" | "action_successor"; id: string; generation: number }; // [100]
}

export type AwaitTransition<P extends string> =
  | { to: "fulfilled"; by: P }
  | { to: "expired" }
  | { to: "unchanged"; reason: "generation_mismatch" | "already_terminal" };

/**
 * [60] 纯函数转移：**expiry 优先于谓词匹配**（过期了一律终结，即使条件同时满足——
 * clowder 原语义）；[100] one-shot：终结即消费（调用方应置 await: undefined）。
 */
export function transitionAwait<S extends string, P extends string>(
  state: AwaitState<S, P>,
  event: { at: number; matched?: P; generation: number },
): AwaitTransition<P> {
  if (event.generation !== state.generation) return { to: "unchanged", reason: "generation_mismatch" };
  if (event.at >= state.expiresAt) return { to: "expired" }; // 优先级铁律
  if (event.matched !== undefined && state.when.includes(event.matched)) {
    return { to: "fulfilled", by: event.matched };
  }
  return { to: "unchanged", reason: "already_terminal" };
}

/** [80] baseline diff：唤醒只给相对量，不重放全量（clowder "只给 diff"） */
export function baselineDiff(baseline: Record<string, unknown>, current: Record<string, unknown>):
  Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    if (baseline[k] !== current[k]) {
      out[k] = { from: baseline[k], to: current[k] };
    }
  }
  return out;
}

// ---------------- 模式九（FR-88）：声明-动作一致性（假完成检测） ----------------

export interface VerdictClaim {
  claimed: boolean;     // 终答里声称了"已完成 X"
  acted: boolean;       // 本 run 确实调用过对应工具
  detail?: string;
}

/**
 * [60] 假完成检测（纯函数）：终答声称完成但全程无对应工具调用。
 * clowder verdict-detect 的教学版：关键词收紧到过去时（"已保存/已完成"），
 * 防意图陈述误报——原项目 eval 实测 6.7% 误报后收窄的教训直接内置。
 */
export function detectFalseCompletion(
  finalText: string,
  toolNamesCalled: string[],
  claims: Record<string, RegExp> = {
    remember: /(已记住|已保存到记忆|已经记住)/,
    get_weather: /(已查询到|查询到了)/,
    calculate: /(已计算出|计算得出)/,
  },
): VerdictClaim[] {
  const called = new Set(toolNamesCalled);
  const out: VerdictClaim[] = [];
  for (const [tool, re] of Object.entries(claims)) {
    const claimed = re.test(finalText);
    if (!claimed) continue;
    out.push({ claimed: true, acted: called.has(tool), detail: tool });
  }
  return out;
}
