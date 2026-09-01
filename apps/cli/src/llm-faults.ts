import type { LLMClient, StreamEvent } from "@tagent/core";

// ============================================================
// LLM 层故障注入（Step 9，AC10 验收道具；手法与 faults.ts 同源——
// 装饰器只进壳，core 的守卫对它无感知，这正是"守卫对模型行为设防"
// 的验证方式：把"弱模型的坏行为"剧本化，复现不需要赌真模型抽风）
//
// 用法: TAGENT_LLM_FAULTS=empty:2,repeat:5,length:1
// 剧本（前 N 次 stream() 返回合成流，之后放行真实引擎）:
//   empty:N   空响应（done stop，无内容无调用）→ 验空响应守卫
//   repeat:N  每次返回相同 get_weather 调用（模拟复读）→ 验重复检测
//   length:N  返回参数被截断的 tool_call 分片 + done length → 验截断判错
//
// 存证边界（如实）：注入轮的流是合成的，不经 fetch——wire 存证只覆盖
// 放行后的真实引擎轮；注入轮的证据在 transcript（guard 事件 + 回填结果）。
// ============================================================

export interface LLMFaultScript {
  kind: "empty" | "repeat" | "length";
  n: number; // 前 N 次注入
}

/** 解析 TAGENT_LLM_FAULTS；非法条目直接 throw（实验配置写错应立刻暴露） */
export function parseLlmFaults(spec: string | undefined): Map<string, LLMFaultScript> {
  const faults = new Map<string, LLMFaultScript>();
  if (!spec) return faults;
  for (const item of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [kind, n] = item.split(":");
    if (!kind || !["empty", "repeat", "length"].includes(kind)) {
      throw new Error(`TAGENT_LLM_FAULTS 条目非法: ${item}（应为 empty:N|repeat:N|length:N）`);
    }
    const count = Number(n ?? 1);
    if (!Number.isInteger(count) || count < 1) throw new Error(`TAGENT_LLM_FAULTS 次数非法: ${item}`);
    faults.set(kind, { kind: kind as LLMFaultScript["kind"], n: count });
  }
  return faults;
}

/** 合成一轮"坏模型"流 */
function* faultRound(kind: LLMFaultScript["kind"]): Generator<StreamEvent> {
  if (kind === "empty") {
    yield { type: "done", finishReason: "stop" };
  } else if (kind === "repeat") {
    // 与内建天气工具同形：整批签名固定 → 触发重复检测
    yield { type: "tool-call-delta", index: 0, id: `fault-${Date.now()}`, name: "get_weather", argsDelta: '{"city":"北京"}' };
    yield { type: "done", finishReason: "tool_calls" };
  } else {
    // args JSON 被截断（无闭合）+ length → 触发截断判错
    yield { type: "tool-call-delta", index: 0, id: "fault-length", name: "get_weather", argsDelta: '{"city":"北' };
    yield { type: "done", finishReason: "length" };
  }
}

/** 装饰器：按剧本把前 N 次 stream() 换成合成故障流 */
export function withLlmFaults(inner: LLMClient, faults: Map<string, LLMFaultScript>): LLMClient {
  if (faults.size === 0) return inner;
  const remaining = new Map<string, number>();
  return {
    async *stream(req) {
      for (const [name, f] of faults) {
        const left = remaining.get(name) ?? f.n;
        if (left > 0) {
          remaining.set(name, left - 1);
          yield* faultRound(f.kind);
          return;
        }
      }
      yield* inner.stream(req);
    },
  };
}

/** 启动横幅用：人读的故障清单 */
export function describeLlmFaults(faults: Map<string, LLMFaultScript>): string {
  return [...faults.values()].map((f) => `${f.kind}:${f.n}`).join(", ");
}
