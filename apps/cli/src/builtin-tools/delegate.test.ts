import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  ToolRegistry,
  runAgent,
  type AgentConfig,
  type ChatMessage,
  type LLMClient,
  type StreamEvent,
  type Tool,
} from "@tagent/core";
import { makeDelegateTool } from "./delegate.js";

// ============================================================
// Step 7 测试：子 agent 即工具（FR-38~40，AC7-1）
// ============================================================

const weather: Tool<z.ZodObject<{ city: z.ZodString }>> = {
  name: "get_weather",
  description: "查询城市天气",
  schema: z.object({ city: z.string() }),
  execute: async (a) => ({ city: a.city, tempC: a.city === "北京" ? 28 : 33 }),
};

/** 父/子共用的剧本 client：按收到的消息内容决定回什么 */
function scriptedLLM(script: (msgs: ChatMessage[]) => StreamEvent[]): LLMClient {
  let call = 0;
  const seen: ChatMessage[][] = [];
  return {
    get seen() {
      return seen;
    },
    async *stream(req: Parameters<LLMClient["stream"]>[0]) {
      void call++;
      seen.push([...req.messages]);
      const events = script(req.messages);
      if (!events) throw new Error(`剧本耗尽（第 ${call} 次调用）`);
      for (const ev of events) yield ev;
    },
  } as unknown as LLMClient & { seen: ChatMessage[][] };
}

const config: AgentConfig = {
  baseUrl: "http://mock", model: "m", maxIterations: 6, temperature: 0.7, systemPrompt: "父提示", thinking: false,
};

function makeSubRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.register(weather);
  return reg; // 不含 delegate —— 递归锁由装配方保证
}

test("delegate：子 agent 独立完成子任务，父收到摘要信封", async () => {
  // 子调用（问北京）→ 工具+终答；父调用 → delegate 后聚合
  const client = scriptedLLM((msgs) => {
    const task = msgs.find((m) => m.role === "user")?.content ?? "";
    const isSub = msgs[0]?.role === "system" && msgs[0].content.includes("子任务执行者");
    if (isSub) {
      return msgs.some((m) => m.role === "tool")
        ? [{ type: "text-delta", delta: "北京 28 度" }, { type: "done", finishReason: "stop" }]
        : [
            { type: "tool-call-delta", index: 0, id: "sub-1", name: "get_weather", argsDelta: '{"city":"北京"}' },
            { type: "done", finishReason: "tool_calls" },
          ];
    }
    void task;
    // 父：先 delegate，收到结果后聚合
    return msgs.some((m) => m.role === "tool")
      ? [{ type: "text-delta", delta: "汇总：北京 28 度" }, { type: "done", finishReason: "stop" }]
      : [
          { type: "tool-call-delta", index: 0, id: "p-1", name: "delegate", argsDelta: '{"task":"查询北京天气"}' },
          { type: "done", finishReason: "tool_calls" },
        ];
  });

  const parentReg = new ToolRegistry();
  parentReg.register(makeDelegateTool({ client, makeSubRegistry: makeSubRegistry, config }));
  const messages: ChatMessage[] = [{ role: "user", content: "查北京天气" }];
  const events = [];
  for await (const ev of runAgent({ client, registry: parentReg, config }, messages)) events.push(ev);

  // 父事件流里 delegate 是一次普通工具调用（隔离：子过程事件不出现）
  const dc = events.find((e) => e.type === "tool-call" && e.name === "delegate");
  assert.ok(dc, "父应有 delegate 调用");
  const subWeatherCalls = events.filter((e) => e.type === "tool-call" && e.name === "get_weather");
  assert.equal(subWeatherCalls.length, 0, "子过程的工具调用不得出现在父事件流");
  // 父上下文只有摘要信封
  const toolMsg = messages.find((m) => m.role === "tool");
  assert.match(toolMsg?.role === "tool" ? toolMsg.content : "", /answer/);
  assert.match(toolMsg?.role === "tool" ? toolMsg.content : "", /subToolCalls":1/);
  assert.equal(events.at(-1)?.type, "final");
});

test("递归锁：子 registry 不含 delegate，子 agent 无法再委托", async () => {
  const sub = makeSubRegistry();
  assert.ok(!sub.has("delegate"), "子 registry 不应含 delegate");
  const parent = new ToolRegistry();
  parent.register(makeDelegateTool({ client: {} as LLMClient, makeSubRegistry: makeSubRegistry, config }));
  assert.ok(parent.has("delegate"));
  // 子 agent 若强行调用 delegate → 未知工具信封（ToolRegistry 兜底，不崩）
  const out = JSON.parse(await sub.execute("delegate", '{"task":"x"}')) as { ok: boolean };
  assert.equal(out.ok, false);
});

test("隔离：子 agent 的 messages 不含父对话历史", async () => {
  const client = scriptedLLM((msgs) => {
    const isSub = msgs[0]?.role === "system" && msgs[0].content.includes("子任务执行者");
    if (isSub) return [{ type: "text-delta", delta: "done" }, { type: "done", finishReason: "stop" }];
    return [
      { type: "tool-call-delta", index: 0, id: "p-1", name: "delegate", argsDelta: '{"task":"独立任务"}' },
      { type: "done", finishReason: "tool_calls" },
    ];
  });
  const parentReg = new ToolRegistry();
  parentReg.register(makeDelegateTool({ client, makeSubRegistry: makeSubRegistry, config }));
  const messages: ChatMessage[] = [{ role: "user", content: "父的机密问题" }];
  for await (const _ of runAgent({ client, registry: parentReg, config }, messages)) void _;
  for await (const _ of runAgent({ client, registry: parentReg, config }, messages)) void _;
  // 检查每次子调用的消息：user 内容必须是 task 本身，不含父问题
  const subCalls = (client as unknown as { seen: ChatMessage[][] }).seen.filter(
    (msgs) => msgs[0]?.role === "system" && msgs[0].content.includes("子任务执行者"),
  );
  assert.ok(subCalls.length >= 1);
  for (const msgs of subCalls) {
    const userText = msgs.filter((m) => m.role === "user").map((m) => (m.role === "user" ? m.content : "")).join("");
    assert.ok(userText.includes("独立任务"), "子任务描述必须在场");
    assert.ok(!userText.includes("父的机密问题"), "父对话不得泄漏给子 agent");
  }
});
