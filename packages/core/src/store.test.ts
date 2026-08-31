import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore, scoreRecall } from "./store.js";

// ============================================================
// Step 6 长期事实库测试（FR-33，DESIGN §15.1）
// ============================================================

const dir = mkdtempSync(join(tmpdir(), "store-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));

test("append/load 往返：跨实例持久化（进程重启语义）", () => {
  const s1 = new MemoryStore(join(dir, "a.jsonl"));
  s1.append("用户喜欢喝美式咖啡");
  s1.append("用户在上海工作", "profile");
  const s2 = new MemoryStore(join(dir, "a.jsonl")); // 新实例=新进程
  const all = s2.all();
  assert.equal(all.length, 2);
  assert.equal(all[0]?.content, "用户喜欢喝美式咖啡");
  assert.ok(all[0]?.id < (all[1]?.id ?? 0), "id 自增");
  assert.equal(all[1]?.tag, "profile");
  assert.ok(all[0]?.ts > 0);
});

test("召回评分：相关事实分数高于无关（bigram+分词）", () => {
  assert.ok(scoreRecall("我喜欢喝什么咖啡", "用户喜欢喝美式咖啡") > scoreRecall("我喜欢喝什么咖啡", "今天下雨了"));
  // 完全无重叠 → 0 分（宁缺勿滥）
  assert.equal(scoreRecall("天气如何", "用户喜欢美式咖啡"), 0);
});

test("recall：按评分排序取 top-K，空库/无匹配返回空数组", () => {
  const s = new MemoryStore(join(dir, "b.jsonl"));
  assert.deepEqual(s.recall("随便什么"), []);
  s.append("用户喜欢喝美式咖啡");
  s.append("用户的猫叫汤姆");
  s.append("美式咖啡要加冰");
  const hits = s.recall("美式咖啡", 2);
  assert.equal(hits.length, 2);
  assert.match(hits[0]?.content ?? "", /咖啡/);
  assert.deepEqual(s.recall("量子力学"), []);
});

test("recall 返回带评分与上下文（信封数据完整）", () => {
  const s = new MemoryStore(join(dir, "c.jsonl"));
  s.append("用户喜欢喝美式咖啡");
  const [hit] = s.recall("美式咖啡");
  assert.ok(hit && hit.score > 0 && hit.content.includes("咖啡") && hit.id >= 1);
});
