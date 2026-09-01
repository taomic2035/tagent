import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore, type ToolContext } from "@tagent/core";
import { makeMemoryTools } from "./memory.js";

// ============================================================
// 内建记忆工具测试（Step 16 审计补缺：makeMemoryTools 此前零覆盖）
// 注意：直接调 tool.execute 拿到的是原始返回（信封由 registry 包装——
// 那层的行为在 core/tools.test 已覆盖），这里测业务语义。
// ============================================================

function freshStore() {
  const dir = mkdtempSync(join(tmpdir(), "tagent-mem-test-"));
  return { store: new MemoryStore(join(dir, "memory.jsonl")), dir };
}

const ctx = {} as ToolContext;

test("remember：写入返回 id 与总量，落到 JSONL（含可选 tag）", async () => {
  const { store, dir } = freshStore();
  const [remember] = makeMemoryTools(store);
  assert.ok(remember);
  const ret = (await remember.execute({ content: "用户喜欢美式咖啡", tag: "preference" }, ctx)) as {
    saved: boolean;
    id: string;
    totalFacts: number;
  };
  assert.equal(ret.saved, true);
  assert.equal(ret.totalFacts, 1);
  const line = JSON.parse(readFileSync(join(dir, "memory.jsonl"), "utf-8"));
  assert.equal(line.content, "用户喜欢美式咖啡");
  assert.equal(line.tag, "preference");
  rmSync(dir, { recursive: true, force: true });
});

test("recall：关键词命中召回，未命中返回空并如实说明", async () => {
  const { store, dir } = freshStore();
  const [remember, recall] = makeMemoryTools(store);
  assert.ok(remember && recall);
  await remember.execute({ content: "用户喜欢美式咖啡" }, ctx);
  await remember.execute({ content: "用户在上海工作" }, ctx);
  const hit = (await recall.execute({ query: "咖啡 喝什么" }, ctx)) as { matched: number; facts: Array<{ content: string }> };
  assert.equal(hit.matched, 1);
  assert.ok(hit.facts[0]?.content.includes("美式"));
  const miss = (await recall.execute({ query: "完全不相关的词" }, ctx)) as { matched: number };
  assert.equal(miss.matched, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("recall 的 k 参数限流：只取前 k 条", async () => {
  const { store, dir } = freshStore();
  const [remember, recall] = makeMemoryTools(store);
  assert.ok(remember && recall);
  await remember.execute({ content: "用户喜欢咖啡咖啡咖啡" }, ctx);
  await remember.execute({ content: "用户的咖啡机是手摇的" }, ctx);
  const r = (await recall.execute({ query: "咖啡", k: 1 }, ctx)) as { matched: number };
  assert.equal(r.matched, 1);
  rmSync(dir, { recursive: true, force: true });
});

test("既有文件加载（跨会话持久）", () => {
  const dir = mkdtempSync(join(tmpdir(), "tagent-mem-test-"));
  const file = join(dir, "memory.jsonl");
  // MemoryFact 契约：id 必须是 number（字符串 id 会被加载器拒绝——刻意的类型校验）
  writeFileSync(file, JSON.stringify({ id: 1, ts: Date.now(), content: "旧事实" }) + "\n");
  const store = new MemoryStore(file);
  assert.equal(store.all().length, 1);
  rmSync(dir, { recursive: true, force: true });
});
