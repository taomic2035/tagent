import type { z } from "zod";

// ============================================================
// 消息类型 —— OpenAI Chat 协议的 TS 化
// messages 数组是 agent 上下文的唯一事实来源（ARCHITECTURE.md 不变量 1）
// ============================================================

/** 模型发起的一次工具调用。注意 arguments 是 JSON 字符串而非对象：
 *  模型逐 token 生成 JSON 文本，流式分片必须拼完才能 parse（DESIGN.md §1）。 */
export interface ToolCallData {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      /** 思考内容只在内存事件流中使用，永不写回 messages（DESIGN.md 不变量 4）。
       *  此字段仅为对齐引擎返回而保留，解析后即被丢弃。 */
      reasoning?: string;
      tool_calls?: ToolCallData[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

// ============================================================
// 工具类型
// ============================================================

/** 传给 LLM 的 JSON Schema 形态（协议层，无 zod 依赖） */
export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * 工具执行策略（Step 2，FR-12）。由 ToolRegistry 统一施加，业务工具无感。
 * 缺省（或不设）= Step 1 行为：不超时、不重试。
 */
export interface ToolExecPolicy {
  /** 单次执行超时（毫秒）。超时视为可重试失败（FR-13） */
  timeoutMs?: number;
  /** 可重试失败的重试次数，默认 0（不重试） */
  retries?: number;
  /** 线性退避基数：第 n 次重试前等待 n × retryDelayMs */
  retryDelayMs?: number;
}

/** 工具执行上下文。signal 由 registry 的超时控制（FR-17），
 *  后续步骤按需扩展。 */
export interface ToolContext {
  signal?: AbortSignal;
}

/** registry 侧的完整工具定义：schema 用 zod 声明，类型自动推导（NFR-2） */
export interface Tool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>, ctx: ToolContext) => Promise<unknown>;
  /** 执行策略（Step 2，可缺省） */
  policy?: ToolExecPolicy;
}

// ============================================================
// 流事件 —— client 层对 SSE 的解析产物（client 是纯协议适配器，不做合并/积累）
// ============================================================

export type StreamEvent =
  | { type: "reasoning-delta"; delta: string }
  | { type: "text-delta"; delta: string }
  | {
      type: "tool-call-delta";
      index: number;
      id?: string;
      name?: string;
      argsDelta?: string;
    }
  | {
      type: "done";
      finishReason: "stop" | "tool_calls" | "length";
      /** 注意：MLX server 流式响应不含 usage（实测确认），仅非流式有 */
      usage?: Usage;
    };

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

// ============================================================
// 配置
// ============================================================

export interface AgentConfig {
  baseUrl: string;
  model: string;
  maxIterations: number;
  temperature: number;
  systemPrompt: string;
  /** 迭代触顶后的降级策略（Step 2，FR-15）：true = 追加一次无 tools 请求
   *  迫使模型基于已有结果作答；false = 维持 Step 1 行为（error 事件）。默认 true。 */
  degradeOnCap?: boolean;
  /** 上下文预算（Step 3，FR-22）：估算 token 超过此值触发双水位裁剪。
   *  缺省 = 不裁剪（Step 1/2 行为）。 */
  contextBudgetTokens?: number;
  /** 思考模式（Step 4，FR-23）：经请求级 chat_template_kwargs.enable_thinking 下发。
   *  undefined = 不干预（引擎默认）；true/false = 显式开/关。 */
  thinking?: boolean;
  /** 驱动模式（Step 5，FR-29）：true = ReAct 文本协议；false/缺省 = 原生 tool_calls。
   *  仅 CLI 装配读取，runAgent 忽略此字段。 */
  reactMode?: boolean;
  /** ReAct 协议形态（Step 5，FR-31）：json = 单 JSON 步骤 + 受限解码（弱模型鲁棒，默认）；
   *  text = 经典 Thought/Action 文本标记（学习基线，弱模型上失败模式已存档）。 */
  reactFormat?: "json" | "text";
  /** 长期记忆静态注入条数（Step 6，FR-36，CLI 装配字段）：>0 时启动注入最近 N 条 */
  memoryInject?: number;
  /** 是否注册 delegate 委托工具（Step 7，FR-42，CLI 装配字段） */
  delegate?: boolean;
  /** 循环守卫开关（Step 9，FR-52~55）：缺省全开；置 false 可逐项关闭（实验对照） */
  guards?: AgentGuards;
}

/**
 * 循环守卫开关（Step 9）。守卫对策针对"不抛错但也不干活"的模型失败
 * （空响应/复读/max_tokens 截断出残缺调用），全部动作发 guard 事件可观测。
 */
export interface AgentGuards {
  /** 空响应守卫：空内容且无工具调用 → 注入 nudge，连续 3 次放弃（诚实失败） */
  emptyResponse?: boolean;
  /** 重复检测：相同工具批次签名连续 3 批附警告、5 批强制降级终答 */
  repetition?: boolean;
  /** length 截断判错：截断的残缺 tool_calls 不执行，回填错误让模型重发 */
  lengthTruncation?: boolean;
}
