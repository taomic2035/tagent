import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Tool } from "@tagent/core";

// ============================================================
// 文件工具（Step 16 集成验收）：tagent 的第一批"真工具"
//
// read_file：安全（只读）——不需要审批
// write_file：有副作用——在 main.ts 里用 withApproval 包一层
//
// 教学要点：
// - 路径安全：限制在 workspace 内（防 ../ 逃逸）
// - 输出限制：read 截断到 8KB（防撑爆上下文）
// - 信封语义：文件不存在是"数据化失败"不是异常
// ============================================================

/** 工作区根：CLI 启动时的 cwd（文件操作被限制在此范围内） */
const WORKSPACE_ROOT = process.cwd();

/** 路径安全：解析后必须在 workspace 内（防 ../ 逃逸攻击） */
function safeResolve(path: string): string | null {
  const full = join(WORKSPACE_ROOT, path);
  if (!full.startsWith(WORKSPACE_ROOT)) return null;
  return full;
}

export const readFileTool: Tool<z.ZodObject<{ path: z.ZodString }>> = {
  name: "read_file",
  description:
    "读取本地文件内容。路径相对于当前工作目录。文件超过 8KB 时只返回前 8KB。",
  schema: z.object({
    path: z.string().min(1).describe("文件路径（相对路径，如 src/main.ts）"),
  }),
  execute: async (args) => {
    const full = safeResolve(args.path);
    if (!full) return { error: `路径越界：${args.path}（只允许工作目录内的文件）` };
    if (!existsSync(full)) return { error: `文件不存在：${args.path}` };
    try {
      const content = readFileSync(full, "utf-8");
      // 输出限制（hermes 2048 字符错误上限的同族思想：防单次工具结果撑爆上下文）
      const LIMIT = 8192;
      if (content.length > LIMIT) {
        return {
          path: args.path,
          content: content.slice(0, LIMIT),
          truncated: true,
          fullLength: content.length,
          hint: "文件较长已截断。如需后续部分请指定更精确的路径或用 offset 参数（暂未实现）",
        };
      }
      return { path: args.path, content, length: content.length };
    } catch (e) {
      return { error: `读取失败：${(e as Error).message}` };
    }
  },
};

export const writeFileTool: Tool<z.ZodObject<{ path: z.ZodString; content: z.ZodString }>> = {
  name: "write_file",
  description:
    "写入本地文件（创建或覆盖）。路径相对于当前工作目录。注意：会覆盖已有文件。",
  schema: z.object({
    path: z.string().min(1).describe("目标文件路径（相对路径）"),
    content: z.string().describe("文件内容"),
  }),
  execute: async (args) => {
    const full = safeResolve(args.path);
    if (!full) return { error: `路径越界：${args.path}（只允许工作目录内的文件）` };
    try {
      // 自动创建父目录
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, args.content, "utf-8");
      return { path: args.path, bytes: Buffer.byteLength(args.content), status: "written" };
    } catch (e) {
      return { error: `写入失败：${(e as Error).message}` };
    }
  },
};

export const listFilesTool: Tool<z.ZodObject<{ path: z.ZodOptional<z.ZodString> }>> = {
  name: "list_files",
  description: "列出目录下的文件和子目录。路径默认为当前目录。",
  schema: z.object({
    path: z.string().optional().describe("目录路径（默认 .）"),
  }),
  execute: async (args) => {
    const dir = safeResolve(args.path ?? ".");
    if (!dir) return { error: `路径越界` };
    if (!existsSync(dir)) return { error: `目录不存在：${args.path}` };
    try {
      const { readdirSync, statSync } = await import("node:fs");
      const entries = readdirSync(dir).slice(0, 50); // 最多 50 条
      return {
        path: args.path ?? ".",
        entries: entries.map((name) => {
          const full = join(dir, name);
          try {
            return { name, type: statSync(full).isDirectory() ? "dir" : "file" };
          } catch {
            return { name, type: "unknown" };
          }
        }),
        total: entries.length,
      };
    } catch (e) {
      return { error: `列目录失败：${(e as Error).message}` };
    }
  },
};
