// ============================================================
// tagent CLI：终端 REPL，装配 core 三件套（ARCHITECTURE.md：壳不含 agent 逻辑）
// ============================================================
import { createInterface } from "node:readline";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  OpenAIClient,
  ToolRegistry,
  runAgent,
  runReAct,
  type AgentConfig,
  type AgentEvent,
  type ChatMessage,
} from "@tagent/core";
import { z } from "zod";
import { MemoryStore } from "@tagent/core";
import { calculateTool } from "./builtin-tools/calculate.js";
import { weatherTool } from "./builtin-tools/weather.js";
import { makeMemoryTools } from "./builtin-tools/memory.js";
import { makeDelegateTool } from "./builtin-tools/delegate.js";
import { createWireRecorder } from "./wire.js";
import { parseFaults, withFaults, describeFaults } from "./faults.js";
import { parseLlmFaults, withLlmFaults, describeLlmFaults } from "./llm-faults.js";
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
  // Step 3（FR-22）：上下文预算（估算 token），超出触发双水位裁剪；缺省不裁剪
  ...(args["max-context-tokens"] ? { contextBudgetTokens: Number(args["max-context-tokens"]) } : {}),
  // Step 5（FR-29）：--react = 文本协议模式（Thought/Action/Observation）；缺省原生 tool_calls
  reactMode: args.react !== undefined,
  // CLI 层默认 json（弱模型鲁棒）；--react-format text 选经典文本协议
  ...(args.react !== undefined ? { reactFormat: (args["react-format"] === "text" ? "text" : "json") as "text" | "json" } : {}),
  // Step 6（FR-36）：--memory N = 启动时把最近 N 条长期记忆静态注入 system prompt
  memoryInject: Number(args.memory ?? 0),
  // Step 7（FR-42）：--delegate 启用子 agent 委托工具
  delegate: args.delegate !== undefined,
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
// wire 记录器在 fetch 层 tee 原始字节（复盘修复：session 存证必须是引擎原始
// 报文而非重建帧，TRACEABILITY.md §1/§4）；core 经 fetchImpl 注入点一行动不改
const wire = createWireRecorder(join(process.cwd(), "logs", "sessions"));
// Step 9：LLM 层故障注入（AC10 验收道具）——包在 OpenAIClient 外，
// 注入轮返回合成流（不经 fetch），放行轮才产生真实 wire 存证
const llmFaults = parseLlmFaults(process.env.TAGENT_LLM_FAULTS);
const client = withLlmFaults(new OpenAIClient(config.baseUrl, config.model, wire.fetchImpl), llmFaults);
const registry = new ToolRegistry();
// 故障注入（FR-16）：TAGENT_FAULTS 按剧本把内建工具搞坏，实验工具只进壳
const faults = parseFaults(process.env.TAGENT_FAULTS);
registry.register(withFaults(weatherTool, faults));
registry.register(withFaults(calculateTool, faults));
// Step 6：长期记忆（跨会话事实库 + remember/recall 工具）
const memoryStore = new MemoryStore(join(process.cwd(), "logs", "memory.jsonl"));
for (const t of makeMemoryTools(memoryStore)) registry.register(t);
// Step 7：委托工具（--delegate）。子 registry 不含 delegate 本身——递归锁（FR-39）
if (config.delegate) {
  const clientForSub = client;
  registry.register(
    makeDelegateTool({
      client: clientForSub,
      makeSubRegistry: () => {
        const sub = new ToolRegistry();
        for (const t of makeMemoryTools(memoryStore)) sub.register(t);
        sub.register(withFaults(weatherTool, faults));
        sub.register(withFaults(calculateTool, faults));
        return sub;
      },
      config,
    }),
  );
}
// 静态注入（FR-36）：最近 N 条事实进 system prompt 尾部——会话内前缀稳定（cache 友好）
if ((config.memoryInject ?? 0) > 0) {
  const recent = memoryStore.all().slice(-(config.memoryInject ?? 0));
  if (recent.length > 0) {
    const block = ["", "", "## 长期记忆（最近 " + recent.length + " 条）", ...recent.map((f) => `- ${f.content}`)].join("\n");
    config.systemPrompt += block;
  }
}
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
    case "context-trimmed":
      writeLine(paint.yellow(`⚡ 上下文已裁剪：${ev.fromTokens} → ${ev.toTokens} 估算 token（移除 ${ev.removedMessages} 条消息；裁剪即遗忘，旧回合不再可见）`));
      break;
    case "guard":
      writeLine(paint.yellow(`🛡 守卫[${ev.guard}]：${ev.detail}`));
      break;
    case "tool-call":
      state.toolStart = Date.now();
      writeLine();
      writeLine(paint.cyan(`⚙ ${ev.name} ${JSON.stringify(ev.args)}`));
      break;
    case "tool-result": {
      const ms = Date.now() - state.toolStart;
      const retry = ev.retriesUsed !== undefined ? `（重试 ${ev.retriesUsed} 次后仍失败）` : "";
      writeLine(paint.dim(`✔ ${ms}ms${retry}`));
      writeLine(paint.dim(`  ↳ ${ev.result.slice(0, 140)}`)); // Observation 预览（ReAct/原生共用）
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
    case "/memories": {
      const all = memoryStore.all();
      if (all.length === 0) writeLine(paint.dim("（长期记忆为空）"));
      for (const f of all.slice(-20)) writeLine(paint.dim(`  [${f.id}] ${f.content}`));
      break;
    }
    case "/save": {
      const name = line.split(" ")[1] ?? `session-${Date.now()}`;
      mkdirSync(join(logsDir, "saved"), { recursive: true });
      writeFileSync(join(logsDir, "saved", `${name}.json`), JSON.stringify({ savedAt: new Date().toISOString(), messages }, null, 2));
      writeLine(paint.dim(`已保存会话：${name}（${messages.length} 条消息，/load ${name} 恢复）`));
      break;
    }
    case "/load": {
      const name = line.split(" ")[1] ?? "";
      const file = join(logsDir, "saved", `${name}.json`);
      if (!name || !existsSync(file)) {
        writeLine(paint.yellow(`未找到会话 ${name}。可用：`));
        for (const f of readdirSync(join(logsDir, "saved")).filter((n) => n.endsWith(".json"))) writeLine(paint.dim(`  ${f.replace(/\.json$/, "")}`));
        break;
      }
      const data = JSON.parse(readFileSync(file, "utf8")) as { messages: ChatMessage[] };
      messages.length = 0;
      messages.push(...data.messages);
      writeLine(paint.dim(`已恢复会话 ${name}（${data.messages.length} 条消息）`));
      break;
    }
    case "/think":
      config.thinking = true;
      writeLine(paint.dim("思考模式已开启（请求级 enable_thinking=true）"));
      break;
    case "/nothink":
      config.thinking = false;
      writeLine(paint.dim("思考模式已关闭（请求级 enable_thinking=false；旧 /no_think 标记已废弃——两引擎实测无效，PROTOCOL §10）"));
      break;
    default:
      writeLine(paint.yellow(`未知命令 ${line}（可用：/exit /reset /tools /dump /think /nothink /memories /save /load）`));
  }
  return true;
}
// ---- REPL 主循环 ----
async function chat(input: string): Promise<void> {
  messages.push({ role: "user", content: input });
  const state = { toolStart: 0 };
  const engine = config.reactMode ? runReAct : runAgent; // 两引擎同事件契约（FR-28）
  for await (const ev of engine({ client, registry, config }, messages)) {
    record(ev); // 每个事件落盘（制度：NFR-4）
    render(ev, state);
  }
}

function main(): void {
  writeLine(paint.bold("tagent") + paint.dim(" · 本地手搓 agent · /tools 查看工具，/exit 退出"));
  if (!config.model) {
    writeLine(paint.yellow("⚠ 未设置模型路径：--model <path> 或环境变量 TAGENT_MODEL（MLX server 要求 model 为本地路径）"));
  }
  if (faults.size > 0) {
    writeLine(paint.red(`⚡ 故障注入已启用: ${describeFaults(faults)}（TAGENT_FAULTS）`));
  }
  if (llmFaults.size > 0) {
    writeLine(paint.red(`⚡ LLM 故障注入已启用: ${describeLlmFaults(llmFaults)}（TAGENT_LLM_FAULTS）`));
  }
  if (config.contextBudgetTokens) {
    writeLine(paint.dim(`上下文预算: ${config.contextBudgetTokens} 估算 token（双水位裁剪）`));
  }
  if (config.thinking !== undefined) {
    writeLine(paint.dim(`思考模式: ${config.thinking ? "开" : "关"}（/think /nothink 切换）`));
  }
  if ((config.memoryInject ?? 0) > 0) {
    writeLine(paint.dim(`长期记忆：${memoryStore.all().length} 条事实，注入最近 ${config.memoryInject ?? 0} 条（/memories 查看）`));
  }
  if (config.delegate) {
    writeLine(paint.dim("委托：delegate 工具已启用（子 agent 深度锁定 1 层）"));
  }
  if (config.reactMode) {
    const fmt = config.reactFormat ?? "json";
    writeLine(paint.dim(`驱动模式: ReAct ${fmt === "json" ? "JSON 协议（受限解码，弱模型鲁棒）" : "文本协议（经典基线）"}`));
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
