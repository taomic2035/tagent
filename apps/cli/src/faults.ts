import { TransientToolError, type Tool } from "@tagent/core";

// ============================================================
// 故障注入实验开关（FR-16，DESIGN §11.4）
//
// 用法: TAGENT_FAULTS=get_weather:hang,get_weather:flaky:2
// 剧本:
//   hang     永不 resolve（监听 signal，超时 abort 后安静退出）→ 超时实验
//   flaky:N  前 N 次抛 TransientToolError，之后放行真实工具 → 重试自愈实验
//   down     恒抛 TransientToolError → 重试耗尽实验
//
// 定位：实验工具，只进壳（apps/cli）不进 core——core 的策略层对它无感知，
// 这正是"策略在 registry 统一施加、业务无感"设计的验证方式。
// ============================================================

interface FaultScript {
  kind: "hang" | "flaky" | "down";
  n?: number; // flaky 的失败次数
}

/** 解析 TAGENT_FAULTS；非法条目直接 throw（实验配置写错应立刻暴露，而非静默忽略） */
export function parseFaults(spec: string | undefined): Map<string, FaultScript> {
  const faults = new Map<string, FaultScript>();
  if (!spec) return faults;
  for (const item of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [name, kind, n] = item.split(":");
    if (!name || !kind) throw new Error(`TAGENT_FAULTS 条目非法: ${item}（应为 工具名:hang|flaky:N|down）`);
    if (kind === "hang" || kind === "down") {
      faults.set(name, { kind });
    } else if (kind === "flaky") {
      const count = Number(n ?? 1);
      if (!Number.isInteger(count) || count < 1) throw new Error(`TAGENT_FAULTS flaky 次数非法: ${item}`);
      faults.set(name, { kind: "flaky", n: count });
    } else {
      throw new Error(`TAGENT_FAULTS 未知剧本: ${item}（可用: hang / flaky:N / down）`);
    }
  }
  return faults;
}

/** 工具包装器（装饰器，与 RecordingClient 同一手法）：按剧本把 execute 搞坏 */
export function withFaults(tool: Tool, faults: Map<string, FaultScript>): Tool {
  const fault = faults.get(tool.name);
  if (!fault) return tool;

  let calls = 0;
  const inner = tool.execute.bind(tool);
  const wrapped: Tool = {
    ...tool,
    async execute(args: unknown, ctx: { signal?: AbortSignal }) {
      calls++;
      if (fault.kind === "hang") {
        // 永不主动 resolve；被 abort 后安静退出（返回值会被 registry 丢弃）
        await new Promise<void>((resolve) => {
          ctx?.signal?.addEventListener("abort", () => resolve(), { once: true });
        });
        return undefined;
      }
      if (fault.kind === "down" || (fault.kind === "flaky" && calls <= (fault.n ?? 1))) {
        throw new TransientToolError(`[faults:${fault.kind}${fault.n ? `:${fault.n}` : ""}] 第 ${calls} 次调用注入瞬时故障`);
      }
      return inner(args, ctx);
    },
  };
  return wrapped;
}

/** 启动横幅用：人读的故障清单 */
export function describeFaults(faults: Map<string, FaultScript>): string {
  return [...faults.entries()]
    .map(([name, f]) => `${name}=${f.kind}${f.n ? `:${f.n}` : ""}`)
    .join(", ");
}
