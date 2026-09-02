import { z } from "zod";
import { execFile } from "node:child_process";
import type { Tool, ToolContext } from "@tagent/core";
import { normalizeCommand } from "@tagent/core";

// ============================================================
// shell 工具（Step 16 集成收官）：tagent 的"最终武器"
//
// 执行任意 shell 命令——最危险的工具，必须配合完整审批管线使用：
//   normalizeCommand（防混淆绕过）→ hardline floor → deny → allowlist
//   → 危险 pattern y/n 确认 → 放行 → 超时 + 输出截断
//
// 安全设计（hermes approval.py 的教学同构）：
// - execFile 而非 exec（不走路由 shell，防注入 $()` 等）
// - 白名单可执行文件（默认允许的安全命令清单）
// - 超时 30s + stdout/stderr 合并截断 4KB（防撑爆上下文）
// - 退出码非零 → 数据化失败（信封语义）
// ============================================================

/** 白名单可执行文件——只有这些命令能跑（教学版保守清单） */
const ALLOWED_BINARIES = new Set([
  "node", "npm", "npx", "pnpm", "tsc", "git", "ls", "cat", "echo",
  "grep", "find", "wc", "head", "tail", "sort", "uniq", "diff",
  "mkdir", "cp", "mv", "touch", "pwd", "which", "python",
]);

/** 参数黑名单——这些 flag 即使在白名单命令里也拒绝 */
const BLOCKED_FLAGS = /\s(--no-sandbox|--disable-gpu|eval|Function\()/;

export interface ShellResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated?: boolean;
}

export function makeShellTool(): Tool<
  z.ZodObject<{ command: z.ZodString; timeout_sec: z.ZodOptional<z.ZodNumber> }>
> {
  return {
    name: "shell",
    description:
      "执行 shell 命令（仅限安全白名单内的命令：node/npm/git/ls/cat/grep 等）。" +
      "返回 stdout、stderr 和退出码。超时默认 30 秒。输出超过 4KB 会截断。",
    schema: z.object({
      command: z.string().min(1).describe("要执行的命令（如 'ls -la' 或 'node --version'）"),
      timeout_sec: z.number().int().min(1).max(120).optional().describe("超时秒数（默认 30）"),
    }),
    policy: { timeoutMs: 35_000, retries: 0 },

    execute: async (args, ctx: ToolContext): Promise<unknown> => {
      // [60] 命令归一化（NFKC + ANSI + $IFS + 家目录——防混淆绕过）
      const normalized = normalizeCommand(args.command);

      // [60] 解析出可执行文件名
      const parts = normalized.split(/\s+/);
      const binary = parts[0]?.split("/").pop() ?? "";
      const rest = parts.slice(1).join(" ");

      // [60] 白名单检查
      if (!ALLOWED_BINARIES.has(binary)) {
        return {
          error: `命令 "${binary}" 不在安全白名单内。允许的命令：${[...ALLOWED_BINARIES].slice(0, 10).join(", ")} 等 ${ALLOWED_BINARIES.size} 个`,
          command: normalized,
        };
      }

      // [60] 参数黑名单
      if (BLOCKED_FLAGS.test(normalized)) {
        return { error: `命令包含被禁止的参数模式`, command: normalized };
      }

      // [80] 执行：execFile（不走 shell 路由，防注入）
      const timeoutMs = (args.timeout_sec ?? 30) * 1000;
      const startTime = Date.now();

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve({
            command: normalized,
            exitCode: null,
            stdout: "",
            stderr: `执行超时（${args.timeout_sec ?? 30}s）`,
            durationMs: Date.now() - startTime,
            timedOut: true,
          });
        }, timeoutMs);

        execFile(binary, rest ? rest.split(/\s+/) : [], {
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024, // 1MB max buffer
          cwd: process.cwd(),
          env: { ...process.env, NO_COLOR: "1" }, // 禁颜色码（ANSI 会污染输出）
        }, (err, stdout, stderr) => {
          clearTimeout(timer);
          const durationMs = Date.now() - startTime;

          // [80] 输出截断（4KB——防撑爆上下文，hermes 2048 同族思想）
          const LIMIT = 4096;
          const truncated = stdout.length > LIMIT;
          const safeStdout = truncated
            ? stdout.slice(0, Math.floor(LIMIT * 0.4)) + "\n…[截断，全文 " + stdout.length + " 字符]…\n" + stdout.slice(-Math.floor(LIMIT * 0.6))
            : stdout;

          const exitCode = err && typeof (err as { code?: number }).code === "number"
            ? (err as { code: number }).code
            : err ? 1 : 0;

          resolve({
            command: normalized,
            exitCode,
            stdout: safeStdout,
            stderr: stderr.slice(0, 1024),
            durationMs,
            ...(truncated ? { truncated: true } : {}),
          });
        });
      });
    },
  };
}
