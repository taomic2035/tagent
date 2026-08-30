import { z } from "zod";
import type { Tool, ToolContext, ToolDef } from "./types.js";

// ============================================================
// 工具结果信封：execute 的返回恒为 JSON 字符串，形态恒为这两种之一
// （这是 loop 能无脑回填给模型的保证，见 DESIGN.md §3）
// ============================================================
export interface ToolResultOk {
  ok: true;
  data: unknown;
}
export interface ToolResultFail {
  ok: false;
  error: string;
  /** 参数校验失败时的细节（zod issues 的精简版），帮助模型自我纠正 */
  issues?: Array<{ path: string; message: string }>;
}
export type ToolResultEnvelope = ToolResultOk | ToolResultFail;

/**
 * 工具登记与执行的安全外壳。
 *
 * 职责边界：模型输出的 tool_calls 是【不可信的外部输入】——
 * 工具名可能不存在、参数 JSON 可能残缺、参数可能不符合 schema、
 * 工具本身可能抛异常。本类把所有这些失败统一转成错误信封，
 * 交给 loop 回填给模型自我纠正（DESIGN.md §3：恒不抛异常契约）。
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  /** 登记工具。重名是程序员错误（启动期），这里允许 throw——
   *  与 execute 的"恒不抛"契约不同，不要混淆这两个场景。 */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`duplicate tool name: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  /** 全部工具的 JSON Schema 形态（传给 LLM 的 tools 参数）。
   *  zod 4 的 z.toJSONSchema 把 zod schema 翻译成标准 JSON Schema——
   *  你用 TS 类型定义一次，协议侧自动生成，两边永不失同步。 */
  schemas(): ToolDef[] {
    return [...this.tools.values()].map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: z.toJSONSchema(tool.schema),
      },
    }));
  }

  /**
   * 执行一个工具调用。四段流程，任何一段失败都返回错误信封（恒不 throw）：
   *   1. 工具名是否存在
   *   2. arguments 是否是合法 JSON（模型逐 token 生成的文本，可能残缺）
   *   3. 参数是否符合 zod schema（类型/必填/枚举）
   *   4. 真正执行（try/catch 包裹，业务代码抛异常也转成信封）
   *
   * @param name     模型给出的工具名
   * @param argsJson 模型给出的 arguments 字符串（原样透传，此处才 parse）
   * @param ctx      执行上下文（Step 1 主要是预留）
   */
  async execute(
    name: string,
    argsJson: string,
    ctx?: ToolContext,
  ): Promise<string> {
    const envelope = await this.executeEnvelope(name, argsJson, ctx);
    return JSON.stringify(envelope);
  }

  private async executeEnvelope(
    name: string,
    argsJson: string,
    ctx?: ToolContext,
  ): Promise<ToolResultEnvelope> {
    // 1. 未知工具
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `unknown tool: ${name}（可用: ${this.names().join(", ") || "无"}）` };
    }

    // 2. JSON 解析（arguments 在协议里是字符串，DESIGN.md §1）
    let raw: unknown;
    try {
      raw = JSON.parse(argsJson);
    } catch {
      return {
        ok: false,
        error: `arguments 不是合法 JSON: ${argsJson.slice(0, 120)}`,
      };
    }

    // 3. schema 校验。issues 精简为 path+message，让模型读得懂错在哪
    const parsed = tool.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "参数校验失败",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join(".") || "(root)",
          message: issue.message,
        })),
      };
    }

    // 4. 执行。业务工具随便抛异常，这里统一兜底
    try {
      const data = await tool.execute(parsed.data, ctx ?? {});
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
