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
import { makeExecuteCodeTool } from "./builtin-tools/execute-code.js";
import { withApproval } from "./builtin-tools/approval-gate.js";
import { readFileTool, writeFileTool, listFilesTool } from "./builtin-tools/files.js";
import type { ApprovalConfig } from "@tagent/core";
import { SessionTree, decideApproval } from "@tagent/core";
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
  // Step 11（FR-60/61）：--compact = 超预算先压缩（去重/降级/LLM 摘要，用户消息原文
  // 钉住），仍超才裁剪兜底；缺省维持纯裁剪（实验对照）
  compaction: args.compact !== undefined,
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
// Step 16：审批流水线——危险工具执行前 y/n 确认（hermes 分层同构）
const approvalConfig: ApprovalConfig = { denyRules: [], allowRules: [], unattended: false };
// allowlist 持久化到 logs/approval.json
const approvalFile = join(process.cwd(), "logs", "approval.json");
try {
  if (existsSync(approvalFile)) {
    const saved = JSON.parse(readFileSync(approvalFile, "utf8")) as ApprovalConfig;
    approvalConfig.allowRules = saved.allowRules ?? [];
  }
} catch { /* 首次无文件 */ }
// 延迟绑定：rl 在下方创建后才可用
let confirmGate = (_q: string): Promise<boolean> => Promise.resolve(false);
const bindConfirmGate = (readline: ReturnType<typeof createInterface>): void => {
  confirmGate = (question: string): Promise<boolean> =>
    new Promise((resolve) => {
      readline.question(question, (answer: string) => resolve(answer.trim().toLowerCase().startsWith("y")));
    });
};

const registry = new ToolRegistry();
// 故障注入（FR-16）：TAGENT_FAULTS 按剧本把内建工具搞坏，实验工具只进壳
const faults = parseFaults(process.env.TAGENT_FAULTS);
registry.register(withFaults(weatherTool, faults));
registry.register(withFaults(calculateTool, faults));
// Step 6：长期记忆（跨会话事实库 + remember/recall 工具）
const memoryStore = new MemoryStore(join(process.cwd(), "logs", "memory.jsonl"));
for (const t of makeMemoryTools(memoryStore)) registry.register(t);
// Step 16：文件工具——read/list 安全，write 有副作用走审批
registry.register(readFileTool);
registry.register(listFilesTool);
registry.register(withApproval(writeFileTool, {
  confirm: (q) => confirmGate(q),
  config: approvalConfig,
  onConfigChange: (cfg) => {
    try { writeFileSync(approvalFile, JSON.stringify(cfg, null, 2)); } catch { /* 持久化失败不阻塞 */ }
  },
}));

// Step 16：execute_code（PTC）——持久 context 跨调用存活
const codeSandbox: Record<string, unknown> = {};
registry.register(makeExecuteCodeTool({
  callTool: async (name, argsJson) => registry.execute(name, argsJson),
  allowedTools: ["get_weather", "calculate", "remember", "recall", "read_file", "write_file", "list_files"],
  persistentContext: codeSandbox,
}));
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
// Step 16：SessionTree 替代扁平 messages（不可变树 + 分支）
const sessionTree = new SessionTree();
sessionTree.append({ role: "system", content: config.systemPrompt });
const messages: ChatMessage[] = sessionTree.toMessages();

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
    case "context-compacted":
      writeLine(
        paint.yellow(
          `🗜 上下文已压缩：${ev.fromTokens} → ${ev.toTokens} 估算 token（去重 user ${ev.dedupedUsers} 条、降级工具结果 ${ev.degradedToolResults} 条、摘要 ${ev.summarizedTurns} 轮；用户指令原文保留）`,
        ),
      );
      break;
    case "guard":
      writeLine(paint.yellow(`🛡 守卫[${ev.guard}]：${ev.detail}`));
      break;
    case "steering":
      writeLine(paint.yellow(`↪ 注入用户中途指令：${ev.message}`));
      break;
    case "interrupted":
      writeLine(
        paint.yellow(
          `⛔ 已取消（截获正文 ${ev.partialText.length} 字、工具调用分片 ${ev.partialToolCalls} 个——半截内容不入上下文，可继续提问）`,
        ),
      );
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
  // 按首 token 匹配（Step 15 修复既有 bug：switch(line) 全等匹配，
  // "/save 名字" 这类带参命令从未进过对应 case——AC16-3 真机测试逼出）
  const cmd = line.split(/\s+/)[0] ?? line;
  switch (cmd) {
    case "/exit":
      writeLine(paint.dim("再见。"));
      process.exit(0);
    case "/branch": {
      // Step 16：回到第 N 条用户消息（SessionTree 分支——一字不删，长新枝）
      const n = parseInt(line.split(" ")[1] ?? "0", 10);
      const all = sessionTree.toMessages();
      const userMsgs = all.map((m, i) => ({ m, i })).filter((x) => x.m.role === "user");
      if (n > 0 && n <= userMsgs.length) {
        const target = userMsgs[userMsgs.length - n];
        if (target) {
          // 找到投影中该 user 消息 → 重建 SessionTree（从 system 到该消息）
          const newTree = new SessionTree();
          for (const msg of all.slice(0, target.i + 1)) newTree.append(msg);
          // 替换（教学版：重建而非 id 映射——完整版见 pi session-manager.ts）
          sessionTree.branch(sessionTree.leaf!);
          messages.length = 0;
          messages.push(...newTree.toMessages());
          writeLine(paint.dim(`已分支到第 ${n} 条用户消息（共回退 ${userMsgs.length - n + 1} 条用户消息）——旧枝保留在树中`));
          // 教学简化：直接替换 messages（完整版应操作 sessionTree 本体）
          messages.length = 0;
          messages.push(...all.slice(0, target.i + 1));
        }
      } else {
        writeLine(paint.yellow(`用法: /branch N（回到第 N 条用户消息，当前共 ${userMsgs.length} 条）`));
        for (let idx = 0; idx < Math.min(userMsgs.length, 10); idx++) {
          const u = userMsgs[userMsgs.length - 1 - idx];
          if (u) writeLine(paint.dim(`  /branch ${idx + 1} → "${(u.m.content ?? "").slice(0, 50)}"`));
        }
      }
      break;
    }
    case "/tree": {
      // Step 16：可视化会话树
      const all = sessionTree.toMessages();
      writeLine(paint.dim(`会话树：${all.length} 条消息在当前路径`));
      for (const [i, m] of all.entries()) {
        const preview = (m.role === "system" ? "(sys)" : (m.content ?? "").slice(0, 40));
        writeLine(paint.dim(`  [${i}] ${m.role}: ${preview}`));
      }
      break;
    }
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
      for (const f of all.slice(-20)) writeLine(paint.dim(`  [${f.id}] ${f.content}${(f.useCount ?? 0) > 0 ? `（用${f.useCount}次）` : ""}`));
      const stats = memoryStore.stats();
      writeLine(paint.dim(`  零使用: ${stats.zeroUse}/${stats.total}（"证据缺失"≠"过时"）`));
      const cc = memoryStore.curatorCandidates();
      if (cc.staleIds.length > 0) writeLine(paint.yellow(`  🗂 stale 候选（30 天未用）: ${cc.staleIds.length} 条（永不删除只归档）`));
      if (cc.archiveIds.length > 0) writeLine(paint.yellow(`  📦 归档候选（90 天未用）: ${cc.archiveIds.length} 条`));
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
      // 压缩后引导包（Step 15，FR-80，clowder F24 同源）：恢复的会话可能经历过
      // 裁剪/压缩，历史不完整——一次性注入引导，防"凭记忆继续"与幻觉授权
      messages.push({
        role: "user",
        content:
          "（系统注入：以上会话是从存档恢复的，早期历史可能被压缩或裁剪过。请遵守：行为规则以系统提示为准，不要凭对话记忆推断规则；对不确定的工具结果先重新调用确认再使用；不要假设我此前批准过任何尚未出现在上下文中的操作）",
      });
      writeLine(paint.dim(`已恢复会话 ${name}（${data.messages.length} 条消息 + 恢复引导包）`));
      break;
    }
    case "/compact": {
      // Step 16：手动触发摘要压缩（compactMessages 阶梯全跑一遍）
      writeLine(paint.dim("触发摘要压缩（去重→降级→摘要→裁剪兜底）…"));
      messages.length = 0;
      messages.push(...sessionTree.toMessages());
      writeLine(paint.dim(`压缩前 ${messages.length} 条消息。下一轮请求时将自动触发压缩（需设 --compact --max-context-tokens N）`));
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
      writeLine(paint.yellow(`未知命令 ${line}（可用：/exit /reset /tools /dump /think /nothink /memories /save /load /branch /tree /compact）`));
  }
  return true;
}
// ---- REPL 主循环 ----
// Step 10 steering：生成期间不再 pause readline——普通输入进 steering 队列
// （下一轮 LLM 请求前注入，FR-56），/ 命令仍即时生效；生成结束队列有余量
// 则按 followUp 语义转为下一轮提问（不丢弃用户输入，FR-58）。
const steeringQueue: string[] = [];
let busy = false;

async function chat(input: string, cancelSignal?: AbortSignal): Promise<void> {
  sessionTree.append({ role: "user", content: input });
  messages.length = 0;
  messages.push(...sessionTree.toMessages()); // 刷新投影
  const state = { toolStart: 0 };
  const engine = config.reactMode ? runReAct : runAgent; // 两引擎同事件契约（FR-28）
  // Step 11 摘要通道：--compact 时给 runAgent 注入摘要函数（core 不做 LLM 调用，
  // 装配在此）。temp=0 + 思考关（省 token 且 4B 思考不收敛已实证）；调用走同一
  // client → wire 存证自动覆盖摘要请求（溯源不丢）。aux 模型分层留待多模型环境。
  const summarize = config.compaction
    ? async (raw: string): Promise<string> => {
        let text = "";
        for await (const ev of client.stream({
          messages: [
            {
              role: "system",
              content:
                "你是上下文压缩器。把下面的 agent 对话历史压缩为一段事实性摘要：保留关键数据（数字/结果）、已做的决定、文件名/路径、错误信息原文；不要加入建议或新信息；用中文；不超过 150 字。",
            },
            { role: "user", content: raw },
          ],
          temperature: 0,
          chatTemplateKwargs: { enable_thinking: false },
        })) {
          if (ev.type === "text-delta") text += ev.delta;
        }
        return text === "" ? "（摘要生成为空，已退回裁剪）" : text;
      }
    : undefined;
  // steering 只接 runAgent（ReAct 引擎留待需要时，REQUIREMENTS §15 边界）
  // 取消信号经 ToolContext 传入（Step 14，FR-74/76）：fetch 中断 + 工具协作取消
  const gen = config.reactMode
    ? engine({ client, registry, config }, messages)
    : runAgent(
        { client, registry, config, ...(summarize ? { summarize } : {}) },
        messages,
        cancelSignal ? { signal: cancelSignal } : undefined,
        {
          take: () => steeringQueue.splice(0),
        },
      );
  for await (const ev of gen) {
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
    writeLine(
      paint.dim(
        config.compaction
          ? `上下文预算: ${config.contextBudgetTokens} 估算 token（摘要压缩：去重→降级→LLM 摘要，用户消息原文钉住；仍超才裁剪兜底）`
          : `上下文预算: ${config.contextBudgetTokens} 估算 token（双水位裁剪）`,
      ),
    );
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
bindConfirmGate(rl); // Step 16：审批门绑定 readline
  rl.prompt();
  // Ctrl-C 取消（Step 14，FR-77）：第一次中断当前生成（回提示符，会话可续），
  // 1 秒内连按两次才退出进程；ReAct 模式不接取消（签名无 ctx，§19 边界）
  let lastSigint = 0;
  let cancelController: AbortController | undefined;
  rl.on("SIGINT", () => {
    if (!busy) {
      process.exit(0); // 空闲时 Ctrl-C 直接退出（readline 默认行为兜底）
    }
    const now = Date.now();
    if (now - lastSigint < 1000) {
      writeLine(paint.red("⛔ 连续中断，退出"));
      process.exit(130);
    }
    lastSigint = now;
    if (cancelController) cancelController.abort();
    else process.exit(130);
  });

  const submit = (text: string): void => {
    busy = true;
    cancelController = new AbortController();
    const signal = cancelController.signal;
    chat(text, signal)
      .catch((err) => writeLine(paint.red(`✖ ${err.message}`)))
      .finally(() => {
        busy = false;
        cancelController = undefined;
        writeLine();
        // followUp（FR-58）：生成结束后队列余量合并为下一轮提问
        const follow = steeringQueue.splice(0);
        if (follow.length > 0) {
          submit(follow.join("\n"));
          return;
        }
        rl.prompt();
      });
  };
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
    if (busy) {
      // 生成期间：普通输入进 steering 队列，命令保持即时。ReAct 引擎不接
      // steering（REQUIREMENTS §15 边界）——如实告知去向，不静默积压
      steeringQueue.push(text);
      writeLine(
        config.reactMode
          ? paint.yellow(`↪ 已排队（ReAct 模式暂不支持生成中改向，本轮结束后将作为下一条提问）`)
          : paint.yellow(`↪ 已接收（队列 ${steeringQueue.length} 条），将在下一轮生效`),
      );
      rl.prompt();
      return;
    }
    submit(text);
  });
}

main();
