import { z } from "zod";
import type { Tool } from "@tagent/core";
import type { MemoryStore } from "@tagent/core";

// ============================================================
// 记忆工具（Step 6，FR-34，DESIGN §15.2）
//
// 应用层工具（与 weather/calculate 同地位）：core 提供 MemoryStore，
// 工具把 store 暴露给模型。召回走「工具召回」路线（相关性高、前缀
// 追加式 cache 友好）；静态注入由 CLI 装配完成（--memory N）。
// ============================================================

export function makeMemoryTools(store: MemoryStore): Tool[] {
  const remember: Tool<z.ZodObject<{ content: z.ZodString; tag: z.ZodOptional<z.ZodString> }>> = {
    name: "remember",
    description: "把一条关于用户的持久事实写入长期记忆（跨会话保留）。仅在用户明确要求记住、或对话中出现稳定的用户偏好/事实时调用。",
    schema: z.object({
      content: z.string().min(1).describe("要记住的事实，一句话，如：用户喜欢喝美式咖啡"),
      tag: z.string().optional().describe("可选分类，如 profile/preference"),
    }),
    // 互斥键（Step 12，FR-66）：JSONL 追加写有真实并发交错风险，
    // 同帧多个 remember 由 registry 按键 FIFO 串行
    serialize: "memory-store",
    execute: async (args) => {
      const fact = store.append(args.content, args.tag);
      return { saved: true, id: fact.id, totalFacts: store.all().length };
    },
  };

  const recall: Tool<z.ZodObject<{ query: z.ZodString; k: z.ZodOptional<z.ZodNumber> }>> = {
    name: "recall",
    description: "从长期记忆中召回与查询相关的既有事实（关键词匹配）。回答涉及用户偏好/历史事实的问题前先调用。",
    schema: z.object({
      query: z.string().min(1).describe("查询词，如：用户喜欢喝什么"),
      k: z.number().int().min(1).max(20).optional().describe("最多返回条数，默认 5"),
    }),
    execute: async (args) => {
      const hits = store.recall(args.query, args.k ?? 5);
      return { matched: hits.length, facts: hits.map((h) => ({ id: h.id, content: h.content, score: h.score })) };
    },
  };

  return [remember, recall];
}
