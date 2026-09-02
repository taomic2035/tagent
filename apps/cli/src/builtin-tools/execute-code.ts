import { z } from "zod";
import type { Tool, ToolContext } from "@tagent/core";
import { runCodeCell, type CellResult } from "@tagent/core";

// ============================================================
// execute_code 工具（Step 16 集成验收）：hermes PTC 的 tagent 版
//
// 模型写一段 JS 脚本，脚本里调 tools.xxx(...) 经回调回到宿主 registry。
// **只有脚本的 return 值进入上下文**——中间工具结果永不进入 context window
// （把 N 次工具往返坍缩为 1 次推理 turn）。
//
// 关键语义（CellAuthority）：
// - 持久 context：变量/导入跨 execute_code 调用存活（调用方持有）
// - 权限不持久：每 cell 结束 retire，迟到调用拒绝
// - 工具白名单：只允许白名单内的工具（防任意调用）
// ============================================================

export interface CodeToolDeps {
  callTool: (name: string, argsJson: string) => Promise<string>;
  allowedTools: string[];
  /** 持久沙箱（跨调用存活的全局变量区）——调用方持有 */
  persistentContext?: Record<string, unknown>;
}

export function makeExecuteCodeTool(deps: CodeToolDeps): Tool<z.ZodObject<{ code: z.ZodString }>> {
  return {
    name: "execute_code",
    description:
      "编写一段 JavaScript 脚本，可以批量调用其他工具（如 tools.get_weather、tools.calculate）。" +
      "变量跨调用持久存活（globalThis 上定义的值下次还在）。" +
      "必须用 return 返回最终结果（只有 return 值会进入对话）。" +
      "适合：需要多次工具调用的循环/条件/批量任务——一次搞定而不是多次往返。",
    schema: z.object({
      code: z.string().min(1).describe("JavaScript 代码，可调 tools.xxx(...)，须 return 结果"),
    }),
    policy: { timeoutMs: 30_000 },
    execute: async (args): Promise<unknown> => {
      const result: CellResult = await runCodeCell(args.code, {
        callTool: async (name, argsJson) => {
          // 经宿主 registry 分发（信封/重试/守卫全生效——工具安全层不绕过）
          return deps.callTool(name, argsJson);
        },
        allowedTools: deps.allowedTools,
        callBudget: 20,
      }, {
        context: deps.persistentContext,
      });
      return {
        result: result.returnValue,
        toolCallsUsed: result.toolCallsUsed,
        note: "中间工具结果未进入上下文——只有此 return 值可见",
      };
    },
  };
}
