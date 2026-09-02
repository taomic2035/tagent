import { z } from "zod";
import type { Tool, ToolContext } from "@tagent/core";
import { decideApproval, learnAllowRule, type ApprovalConfig } from "@tagent/core";

// ============================================================
// 审批门工具包装器（Step 16 集成）：hermes 审批流水线的 CLI 形态
//
// 包装任意工具：执行前走 decideApproval 分层判定——
//   hardline → 拒（不可越过）
//   deny 规则 → 拒
//   allowlist → 放行（不打扰）
//   危险 pattern → readline y/n 确认（批一次学一条 allowlist）
//   低风险 → 放行
//
// 用法：registry.register(withApproval(dangerousTool, {
//   prompt: async (q) => askUser(q),  // CLI 的 readline 确认
// }))
// ============================================================

export interface ApprovalGateDeps {
  /** CLI 侧的确认回调（readline y/n）；测试注入 mock */
  confirm: (question: string) => Promise<boolean>;
  /** 持久化的审批配置（allowlist 学习） */
  config: ApprovalConfig;
  /** 变更回调：allowlist 学习后通知调用方持久化 */
  onConfigChange?: (cfg: ApprovalConfig) => void;
}

export function withApproval<T extends Tool>(tool: T, deps: ApprovalGateDeps): T {
  const inner = tool.execute.bind(tool);
  return {
    ...tool,
    async execute(args: never, ctx: ToolContext) {
      // 把工具调用序列化成"命令"送入审批
      const cmd = `${tool.name} ${JSON.stringify(args)}`;
      const decision = decideApproval(cmd, deps.config);

      if (decision.action === "deny") {
        return {
          error: `审批拒绝：${decision.reason}。工具未执行。请改用其他方案或向用户说明。`,
        };
      }

      if (decision.action === "confirm") {
        const ok = await deps.confirm(
          `⚠️  ${tool.name} 触发审批：${decision.reason}\n` +
          `   参数：${JSON.stringify(args).slice(0, 120)}\n` +
          `   允许执行？(y/n) `
        );
        if (!ok) {
          return { error: "用户拒绝了此次操作。请向用户如实说明被拒原因。" };
        }
        // [80] allowlist 学习：批一次，同类不再问
        const rule = learnAllowRule(cmd);
        if (!deps.config.allowRules.includes(rule)) {
          deps.config.allowRules.push(rule);
          deps.onConfigChange?.(deps.config);
        }
      }

      return inner(args, ctx);
    },
  } as T;
}
