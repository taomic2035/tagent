import { z } from "zod";
import {
  runAgent,
  type AgentConfig,
  type ChatMessage,
  type LLMClient,
  type Tool,
  type ToolRegistry,
} from "@tagent/core";

// ============================================================
// delegate 工具：子 agent 即工具（Step 7，FR-38~40，DESIGN §16.1）
//
// 架构兑现（ARCHITECTURE §6 预留）：execute 内部再起 runAgent。
// 三个关键设计：
// 1. 上下文隔离——子 agent 独立 messages（task 必须自包含），父只收摘要信封
// 2. 递归锁——makeSubRegistry() 返回的 registry 不含 delegate（深度 1 层）
// 3. 过程统计——subRounds/subToolCalls 让父可见子过程规模（细节在 wire 存证里）
// ============================================================

const SUB_SYSTEM_PROMPT = [
  "你是一个专注的子任务执行者。你只收到一个自包含的任务描述，独立完成它。",
  "需要数据时调用工具获取，不要编造。完成后给出简洁的最终答案。",
].join("\n");

export interface DelegateDeps {
  client: LLMClient;
  /** 子 agent 的 registry——必须不含 delegate（递归锁由装配方保证，见测试） */
  makeSubRegistry: () => ToolRegistry;
  config: AgentConfig;
}

export function makeDelegateTool(deps: DelegateDeps): Tool<z.ZodObject<{ task: z.ZodString }>> {
  return {
    name: "delegate",
    description:
      "把一个自包含的子任务委托给子 agent 完成（它有独立上下文与全套基础工具，看不到当前对话）。适合可独立完成的子任务，如分别查询多个城市天气、分组计算等。",
    schema: z.object({
      task: z.string().min(1).describe("子任务完整描述，必须自包含（子 agent 看不到本对话），如：查询北京的天气并返回温度数值"),
    }),
    // 子任务总预算（Step 2 策略层复用）：挂死/失控由超时兜底
    policy: { timeoutMs: 300_000 },
    execute: async (args) => {
      const subMessages: ChatMessage[] = [{ role: "user", content: args.task }];
      const subConfig: AgentConfig = {
        ...deps.config,
        systemPrompt: SUB_SYSTEM_PROMPT,
        maxIterations: Math.min(deps.config.maxIterations, 4),
      };
      let answer = "";
      let subRounds = 0;
      let subToolCalls = 0;
      // 子过程事件在此消费，不外抛（父事件流保持纯净；证据由 wire 记录器保全）
      for await (const ev of runAgent({ client: deps.client, registry: deps.makeSubRegistry(), config: subConfig }, subMessages)) {
        if (ev.type === "tool-call") subToolCalls++;
        else if (ev.type === "final") {
          answer = ev.message.content ?? "";
          subRounds = ev.rounds;
        }
      }
      return { answer, subRounds, subToolCalls };
    },
  };
}
