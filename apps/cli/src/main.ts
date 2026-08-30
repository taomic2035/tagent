// ============================================================
// tagent CLI：终端 REPL，装配 core 三件套（ARCHITECTURE.md：壳不含 agent 逻辑）
// ============================================================
import { createInterface } from "node:readline";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  OpenAIClient,
  ToolRegistry,
  runAgent,
  type AgentConfig,
  type AgentEvent,
  type ChatMessage,
  type Tool,
} from "@tagent/core";
import { z } from "zod";
import { calculateTool } from "./builtin-tools/calculate.js";
import { weatherTool } from "./builtin-tools/weather.js";
import { paint, writeChunk, writeLine } from "./ui.js";

// ---- 启动参数：CLI 参数 > 环境变量 > 默认值（泛化：不硬编码本机信息）----
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] ?? "";
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

const config: AgentConfig = {
  baseUrl: args["base-url"] ?? process.env.TAGENT_BASE_URL ?? "http://127.0.0.1:8081/v1",
  // 注意：MLX server 的 model 字段是本地模型路径（PROTOCOL.md §2），
  // 必须通过 TAGENT_MODEL 或 --model 提供
  model: args.model ?? process.env.TAGENT_MODEL ?? "",
  maxIterations: Number(args["max-iterations"] ?? 8),
  temperature: 0.7,
  systemPrompt: [
    "你是 tagent，一个运行在用户本地终端上的助手。",
    "你可以使用提供的工具来获取信息或进行计算。",
    "规则：",
    "- 需要工具才能回答时，调用工具并等待结果，不要编造工具会提供的数据",
    "- 工具返回错误时，向用户如实说明，或修正参数后重试",
    "- 无需工具的日常对话直接回答",
    "- 回答使用用户使用的语言（默认中文）",
  ].join("\n"),
};

// ---- 装配：壳依赖脑，脑不知道壳（依赖注入，ARCHITECTURE.md §4）----
const client = new OpenAIClient(config.baseUrl, config.model);
const registry = new ToolRegistry();
registry.register(weatherTool);
registry.register(calculateTool);
const messages: ChatMessage[] = [];

// ---- transcript：每个事件一行 JSON（NFR-4 可观测性）----
const logsDir = join(process.cwd(), "logs");
mkdirSync(logsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const transcriptPath = join(logsDir, `transcript-${stamp}.jsonl`);
const record = (ev: AgentEvent): void => {
  appendFileSync(transcriptPath, JSON.stringify({ ts: new Date().toISOString(), ev }) + "\n");
};

// ---- 事件渲染 ----
function render(ev: AgentEvent, state: { toolStart: number }): void {
  switch (ev.type) {
    case "reasoning-delta":
      writeChunk(paint.dim(ev.delta)); // 思考：暗灰
      break;
    case "text-delta":
      writeChunk(ev.delta); // 正文：默认色
      break;
    case "round-start":
      if (ev.round > 1) writeLine(); // 多轮间空行分隔
      break;
    case "tool-call":
      state.toolStart = Date.now();
      writeLine();
      writeLine(paint.cyan(`⚙ ${ev.name} ${JSON.stringify(ev.args)}`));
      break;
    case "tool-result": {
      const ms = Date.now() - state.toolStart;
      writeLine(paint.dim(`✔ ${ms}ms`));
      break;
    }
    case "final":
      writeLine();
      writeLine(
        paint.dim(`— 完成（${ev.rounds} 轮 · prompt ${ev.usage.promptTokens} + 生成 ${ev.usage.completionTokens} tokens）—`),
      );
      break;
    case "error":
      writeLine(paint.red(`✖ ${ev.message}`));
      break;
    case "llm-request":
      if (process.env.TAGENT_DEBUG) {
        writeLine(paint.yellow(`[debug] 发送 ${ev.messages.length} 条消息`));
      }
      break;
  }
}

// ---- 斜杠命令 ----
function handleCommand(line: string): boolean {
  if (!line.startsWith("/")) return false;
  switch (line) {
    case "/exit":
      writeLine(paint.dim("再见。"));
      process.exit(0);
    case "/reset":
      messages.length = 0;
      writeLine(paint.dim("上下文已清空。"));
      break;
    case "/tools":
      for (const t of registry.schemas()) {
        writeLine(paint.bold(t.function.name) + paint.dim(` — ${t.function.description}`));
      }
      break;
    case "/dump":
      writeLine(JSON.stringify(messages, null, 2));
      break;
    case "/nothink": {
      noThink = !noThink;
      writeLine(paint.dim(`思考提示已${noThink ? "开启" : "关闭"}（下一条用户消息生效）`));
      break;
    }
    default:
      writeLine(paint.yellow(`未知命令 ${line}（可用：/exit /reset /tools /dump /nothink）`));
  }
  return true;
}
let noThink = false;

// ---- REPL 主循环 ----
async function chat(input: string): Promise<void> {
  messages.push({
    role: "user",
    content: noThink ? `${input} /no_think` : input,
  });
  const state = { toolStart: 0 };
  for await (const ev of runAgent({ client, registry, config }, messages)) {
    record(ev); // 每个事件落盘（制度：NFR-4）
    render(ev, state);
  }
}

function main(): void {
  writeLine(paint.bold("tagent") + paint.dim(" · 本地手搓 agent · /tools 查看工具，/exit 退出"));
  if (!config.model) {
    writeLine(paint.yellow("⚠ 未设置模型路径：--model <path> 或环境变量 TAGENT_MODEL（MLX server 要求 model 为本地路径）"));
  }
  writeLine(paint.dim(`引擎: ${config.baseUrl} · transcript: ${transcriptPath}`));

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: paint.green("你> ") });
  rl.prompt();
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }
    if (handleCommand(text)) {
      rl.prompt();
      return;
    }
    rl.pause(); // 模型生成期间停止接受输入
    chat(text)
      .catch((err) => writeLine(paint.red(`✖ ${err.message}`)))
      .finally(() => {
        writeLine();
        rl.resume();
        rl.prompt();
      });
  });
}

main();
