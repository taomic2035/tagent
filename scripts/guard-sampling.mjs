#!/usr/bin/env node
// ============================================================
// 守卫真实采样实验（Step 13-B，用户裁决：守卫验收不能只靠合成故障注入）
//
// 三个子实验（全部真实引擎、零注入——测 4B 的自然失败分布）：
//   E1 空响应频率：10 个多样任务跑完整 agent，统计 empty-response 守卫触发
//   E2 复读诱发：6 个"反复检查"类任务，统计 repetition 守卫触发
//   E3 截断形态：直连 HTTP 带 max_tokens(40-80) 跑 tool-calling ×8，
//      统计 finish_reason=length 时残缺 tool_calls 的出现率与破坏形态
//
// 用法: node scripts/guard-sampling.mjs   （需引擎在 127.0.0.1:8081）
// 产出: captures/step13-guard-sampling/{e1,e2,e3,summary}.json
// ============================================================
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";

const OUT = "captures/step13-guard-sampling";
mkdirSync(OUT, { recursive: true });

const MP_PATH = execFileSync("sh", ["-c", "grep -m1 '^MODEL_PATH=' captures/.env.local | cut -d= -f2-"], { encoding: "utf-8" }).trim();
const BASE = "http://127.0.0.1:8081/v1";

const latestTranscript = () => {
  const files = readdirSync("logs").filter((f) => f.startsWith("transcript-")).sort();
  return files.at(-1) ?? null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 跑一次 CLI 任务：轮询其 transcript 出现 final/error 后发 /exit（acceptance-win.sh 模式） */
async function runCliTask(prompt) {
  const pre = latestTranscript();
  const child = spawn(process.execPath, ["apps/cli/dist/main.js", "--model", MP_PATH, "--max-iterations", "8"], {
    stdio: ["pipe", "ignore", "ignore"],
  });
  child.stdin.write(prompt + "\n");
  const deadline = Date.now() + 240_000;
  let transcript = null;
  while (Date.now() < deadline) {
    await sleep(3000);
    const cur = latestTranscript();
    if (cur && cur !== pre) {
      transcript = cur;
      const lines = readFileSync(join("logs", cur), "utf-8").split("\n").filter(Boolean);
      const done = lines.some((l) => {
        try {
          const ev = JSON.parse(l).ev;
          return ev.type === "final" || ev.type === "error";
        } catch {
          return false;
        }
      });
      if (done) break;
    }
    if (child.exitCode !== null) break;
  }
  child.stdin.write("/exit\n");
  await sleep(500);
  child.kill();
  return transcript;
}

function guardEventsOf(transcript) {
  if (!transcript) return [];
  try {
    return readFileSync(join("logs", transcript), "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l).ev)
      .filter((e) => e.type === "guard")
      .map((e) => e.guard);
  } catch {
    return [];
  }
}

async function experimentSuite(name, prompts) {
  const results = [];
  for (let i = 0; i < prompts.length; i++) {
    const t = await runCliTask(prompts[i]);
    const guards = guardEventsOf(t);
    results.push({ label: `t${i + 1}`, prompt: prompts[i], guards });
    console.log(`[${name}] t${i + 1}: ${guards.length === 0 ? "无守卫触发" : guards.join(",")}`);
  }
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(results, null, 2));
  return results;
}

async function truncationProbe(i) {
  const body = {
    model: MP_PATH,
    stream: false,
    temperature: 0,
    max_tokens: 40 + (i % 3) * 20, // 40/60/80：故意烧穿
    chat_template_kwargs: { enable_thinking: false },
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "查询城市天气",
          parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
        },
      },
    ],
    messages: [{ role: "user", content: "查一下北京的天气" }],
  };
  const res = await fetch(BASE + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const choice = json.choices?.[0];
  const tc = choice?.message?.tool_calls?.[0];
  let broken = null;
  if (tc) {
    try {
      JSON.parse(tc.function.arguments);
      broken = false;
    } catch {
      broken = true;
    }
  }
  return { i, finish: choice?.finish_reason ?? null, hasToolCall: !!tc, argsBroken: broken, argsTail: tc ? tc.function.arguments.slice(-24) : null };
}

// ---- 主流程 ----
const e1Prompts = [
  "用一句话介绍你自己",
  "查一下北京天气",
  "算一下 12345 乘以 67 等于多少",
  "今天穿什么衣服合适？",
  "帮我记住我喜欢喝美式咖啡",
  "北京和上海哪个更适合旅游？说说理由",
  "写一句关于秋天的诗",
  "你有哪些工具可以用？",
  "用 calculate 算 (45+55)/2 再乘以 3",
  "上海明天会下雨吗？",
];
const e2Prompts = [
  "反复核对北京和上海的天气数据，确保准确后再核对一遍，至少检查三轮",
  "多次验证 98765 乘以 123 的结果，重新算几遍确认无误",
  "反复确认你记住的信息：我的偏好是辣的、不要香菜，再复查几遍",
  "仔细检查再检查：查北京天气，确认后复查，复查后再次确认",
  "轮询查询北京、上海、广州天气各两遍，交叉验证一致性",
  "至少用两种方式计算 16 的平方根并反复验算",
];

console.log("== E1 空响应频率（10 任务，真实引擎零注入）==");
const e1 = await experimentSuite("e1", e1Prompts);
console.log("== E2 复读诱发（6 任务）==");
const e2 = await experimentSuite("e2", e2Prompts);
console.log("== E3 截断形态（8 探针，max_tokens 40-80）==");
const e3 = [];
for (let i = 0; i < 8; i++) {
  const r = await truncationProbe(i);
  e3.push(r);
  console.log(`[e3] #${r.i}: finish=${r.finish} toolCall=${r.hasToolCall} argsBroken=${r.argsBroken} tail=${JSON.stringify(r.argsTail)}`);
}
writeFileSync(join(OUT, "e3.json"), JSON.stringify(e3, null, 2));

const all = [...e1, ...e2];
const summary = {
  e1_e2: {
    tasks: all.length,
    emptyResponse: all.reduce((n, r) => n + r.guards.filter((g) => g === "empty-response").length, 0),
    repetition: all.reduce((n, r) => n + r.guards.filter((g) => g === "repetition").length, 0),
    lengthTruncated: all.reduce((n, r) => n + r.guards.filter((g) => g === "length-truncated").length, 0),
  },
  e3: {
    probes: e3.length,
    lengthFinish: e3.filter((r) => r.finish === "length").length,
    lengthWithToolCall: e3.filter((r) => r.finish === "length" && r.hasToolCall).length,
    brokenArgs: e3.filter((r) => r.argsBroken).length,
  },
};
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log("\n== 汇总 ==\n" + JSON.stringify(summary, null, 2));
