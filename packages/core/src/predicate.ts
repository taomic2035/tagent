import type { ChatMessage } from "./types.js";
import type { AgentEvent } from "./loop.js";

// ============================================================
// 完成谓词（Step 15，FR-78）：任务完成由机器可检证据裁决
//
// 立场（SURVEY §3.3 clowder 的 typed terminal predicate）：
//   LLM 说"我做完了"不算数，循环正常退出也不算数——完成 = 事件流里的
//   事实满足显式断言。谓词只断言事件流事实；外部世界真实效果事件流之外
//   不可机检（诚实边界，见 REQUIREMENTS §20）。
//
// 形态：纯函数构造器，输入事件流 + messages，输出 {ok, evidence}——
// 证据必须引用具体事件（调用 id / 结果摘要 / 终答片段），供验收报告直接引用。
// ============================================================

export interface PredicateResult {
  ok: boolean;
  /** 人读证据：通过时指向满足断言的事件；失败时指明缺口 */
  evidence: string;
}

export interface TaskPredicate {
  /** DSL 序列化用（verify-task.mjs 打印） */
  describe(): string;
  check(events: AgentEvent[], messages: ChatMessage[]): PredicateResult;
}

type Args = Record<string, unknown>;

/** 深包含：spec 的每个键值都出现在实际 args 里（嵌套对象递归） */
function argsMatch(actual: unknown, spec: Record<string, unknown>): boolean {
  if (typeof actual !== "object" || actual === null) return false;
  const a = actual as Record<string, unknown>;
  for (const [k, v] of Object.entries(spec)) {
    if (!(k in a)) return false;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      if (!argsMatch(a[k], v as Record<string, unknown>)) return false;
    } else if (a[k] !== v) return false;
  }
  return true;
}

const toolCallEvents = (events: AgentEvent[]) =>
  events.filter((e): e is Extract<AgentEvent, { type: "tool-call" }> => e.type === "tool-call");
const toolResultEvents = (events: AgentEvent[]) =>
  events.filter((e): e is Extract<AgentEvent, { type: "tool-result" }> => e.type === "tool-result");

/** 断言：指定工具被调用过，且参数深包含 spec（spec 缺省 = 只查名字） */
export function toolCalled(name: string, args?: Args): TaskPredicate {
  return {
    describe: () => `toolCalled(${name}${args ? `, ${JSON.stringify(args)}` : ""})`,
    check(events) {
      const calls = toolCallEvents(events).filter((e) => e.name === name);
      if (calls.length === 0) return { ok: false, evidence: `工具 ${name} 从未被调用` };
      if (!args) {
        const c = calls[0];
        return { ok: true, evidence: `${name} 被调用 ${calls.length} 次（如 id=${c?.id}, args=${JSON.stringify(c?.args).slice(0, 80)}）` };
      }
      const hit = calls.find((e) => argsMatch(e.args, args));
      if (!hit) {
        return { ok: false, evidence: `${name} 调用 ${calls.length} 次但参数均不含 ${JSON.stringify(args)}（实际如 ${JSON.stringify(calls[0]?.args).slice(0, 120)}）` };
      }
      return { ok: true, evidence: `${name} 以满足 ${JSON.stringify(args)} 的参数被调用（id=${hit.id}）` };
    },
  };
}

/** 断言：指定工具至少一次成功（结果信封 ok:true）——调用过不等于成功过 */
export function toolResultOk(name: string): TaskPredicate {
  return {
    describe: () => `toolResultOk(${name})`,
    check(events) {
      const results = toolResultEvents(events).filter((e) => e.name === name);
      if (results.length === 0) return { ok: false, evidence: `工具 ${name} 无任何结果事件` };
      // 结果是 registry 信封 JSON：{"ok":true,...} 或 {"ok":false,...}
      const okHit = results.find((e) => {
        try {
          return JSON.parse(e.result).ok === true;
        } catch {
          return false;
        }
      });
      if (!okHit) {
        const failed = results[0];
        return { ok: false, evidence: `${name} 有 ${results.length} 个结果但无成功（如 ${failed?.result.slice(0, 100)}）` };
      }
      return { ok: true, evidence: `${name} 至少一次成功（${okHit.result.slice(0, 80)}）` };
    },
  };
}

/** 断言：存在正常终答（final 事件）且内容包含关键词（includes 缺省 = 只要有终答） */
export function finalAnswers(includes?: string): TaskPredicate {
  return {
    describe: () => `finalAnswers(${includes ? `"${includes}"` : ""})`,
    check(events) {
      const finals = events.filter((e): e is Extract<AgentEvent, { type: "final" }> => e.type === "final");
      if (finals.length === 0) {
        const errLast = events.at(-1);
        return { ok: false, evidence: `无 final 事件（末事件 ${errLast?.type ?? "无"}）` };
      }
      const f = finals[0];
      const text = f?.message.role === "assistant" ? String(f?.message.content ?? "") : "";
      if (includes && !text.includes(includes)) {
        return { ok: false, evidence: `终答不含 "${includes}"（终答前 120 字：${text.slice(0, 120)}）` };
      }
      return { ok: true, evidence: `终答存在${includes ? `且含 "${includes}"` : ""}（${text.slice(0, 80)}）` };
    },
  };
}

/** 组合：全部满足才通过（clowder 语义：一条不满足即未完成） */
export function all(...preds: TaskPredicate[]): TaskPredicate {
  return {
    describe: () => `all(${preds.map((p) => p.describe()).join(", ")})`,
    check(events, messages) {
      const failed: string[] = [];
      const evidences: string[] = [];
      for (const p of preds) {
        const r = p.check(events, messages);
        if (r.ok) evidences.push(r.evidence);
        else failed.push(`✗ ${p.describe()}：${r.evidence}`);
      }
      if (failed.length > 0) return { ok: false, evidence: failed.join("；") };
      return { ok: true, evidence: evidences.join("；") };
    },
  };
}

/** JSON DSL → 谓词（verify-task.mjs 用；非法 spec 直接 throw 暴露配置错误） */
export function predicateFromSpec(spec: unknown): TaskPredicate {
  if (typeof spec === "string") return finalAnswers(spec);
  if (typeof spec !== "object" || spec === null) throw new Error(`谓词 spec 非法: ${JSON.stringify(spec)}`);
  const s = spec as Record<string, unknown>;
  if (typeof s["finalIncludes"] === "string") return finalAnswers(s["finalIncludes"]);
  if (typeof s["toolCalled"] === "string") {
    const args = s["args"];
    return toolCalled(s["toolCalled"], args && typeof args === "object" ? (args as Args) : undefined);
  }
  if (typeof s["toolResultOk"] === "string") return toolResultOk(s["toolResultOk"]);
  if (Array.isArray(s["all"])) return all(...s["all"].map((p) => predicateFromSpec(p)));
  throw new Error(`谓词 spec 非法（可用: finalIncludes / toolCalled+args / toolResultOk / all）: ${JSON.stringify(spec)}`);
}
