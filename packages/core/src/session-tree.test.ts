import test from "node:test";
import assert from "node:assert/strict";
import { SessionTree } from "./session-tree.js";
import type { ChatMessage } from "./types.js";

test("[60] 树 + 分支 + 路径投影", () => {
  const t = new SessionTree();
  t.append({ role: "user", content: "A" });
  const b1 = t.append({ role: "assistant", content: "答A" });
  t.append({ role: "user", content: "B" });
  t.append({ role: "assistant", content: "答B" });
  assert.equal(t.toMessages().length, 4);

  t.branch(b1); // 回到答A，长新枝
  t.append({ role: "user", content: "C" });
  const msgs = t.toMessages();
  assert.deepEqual(msgs.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(msgs[2]?.role === "user" && msgs[2].content, "C", "新枝只含 A→C，旧枝 B 一字不删");
});

test("[80] retainedTail 自包含检查点：压缩后投影从 compaction 起算", () => {
  const t = new SessionTree();
  for (let i = 1; i <= 6; i++) {
    t.append({ role: "user", content: `Q${i}` });
    t.append({ role: "assistant", content: `A${i}` });
  }
  t.compact("前 3 轮已压缩", 4); // 保留最近 4 条原文
  const msgs = t.toMessages();
  assert.ok(msgs[0]?.role === "user" && msgs[0].content.includes("压缩"), "首条是摘要");
  assert.ok(msgs.length < 12, "比全量少");
});

test("[80] branchWithSummary：摘要挂导航目标，fromId 记旧叶", () => {
  const t = new SessionTree();
  t.append({ role: "user", content: "探索" });
  t.append({ role: "assistant", content: "失败路径" });
  const backTo = t.leaf!;
  t.append({ role: "user", content: "继续错" });
  const id = t.branchWithSummary(backTo, "探索了 X 方案行不通");
  const msgs = t.toMessages();
  assert.ok(msgs.some((m) => (m.content ?? "").includes("探索了 X 方案")), "摘要进投影");
  // 验证 LCA
  assert.ok(t.lowestCommonAncestor(backTo, id) !== null);
});

test("[100] model_change 也是节点：分支回去连模型都能恢复", () => {
  const t = new SessionTree();
  t.append({ role: "user", content: "Q" });
  t.recordModelChange("qwen-4b");
  const mid = t.leaf!;
  t.append({ role: "assistant", content: "A" });
  t.recordModelChange("qwen-9b");
  assert.equal(t.currentModel(), "qwen-9b");
  t.branch(mid);
  assert.equal(t.currentModel(), "qwen-4b", "回到过去 → 模型恢复");
});
