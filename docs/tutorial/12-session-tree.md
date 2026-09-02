# 第 12 章 会话是一棵树：v0.13 从扁平数组到不可变结构

> 你的 agent 有一份能跑的 messages 数组。但它有三个你迟早会撞上的天花板：
> **回不去**（试错后想换个方向重来？历史已经没了）、**压缩即丢失**（上下文满了
> 一压，原始对话永远消失了）、**试错不留痕**（走了三条路都失败，第四条路
> 不知道前三条死了什么坑）。本章把 messages 从数组升级为**不可变树**——
> pi 用这个结构支撑了它的全部会话管理。预计 1 天。

---

## 12.1 三个天花板（先撞墙）

### 墙 1：回不去

你的 agent 走了一条路发现不对，想"回到第 3 轮换个方法"。扁平数组怎么做？

```ts
// ❌ 直觉做法：切片
messages = messages.slice(0, 10); // 回到第 10 条
```

问题：**切掉的历史永久丢了**。如果你后来发现第 3 条路其实是唯一活路，
想回去看当时的状态——对不起，已经没了。

### 墙 2：压缩即丢失

第 6 章的压缩用"摘要替换原文"——被压的原文哪里去了？在扁平数组模型里，
它被 splice 掉了。如果后来发现摘要漏了一个关键细节（比如一个 commit SHA），
你想回原始对话找——找不到。

### 墙 3：试错不留痕

agent 探索了方向 A（失败）→ 方向 B（失败）→ 方向 C（成功）。在扁平数组里，
A 和 B 的中间过程被压缩或丢弃。下次遇到类似问题，它不知道"A 和 B 为什么
失败"——只留下 C 的成功路径。**试错本身是有价值的知识。**

## 12.2 核心思想：存储 ≠ 投影

pi 的解法一句话：**会话的存储是一个不可变树，"模型看到的上下文"只是一条
从根到当前叶子的路径的投影。**

```
存储（不可变树）              投影（messages 数组）
═════════════════              ═══════════════════
     root                       
      │                         
   [user: Q1]                  
      │                         ← 只有这条路径
   [asst: A1] ──── [asst: A1']  上的条目出现在
      │        └─分支            投影里
   [user: Q2]    [user: Q2']    
      │              │           
   [asst: A2]    [asst: A2']  ← 当前叶子（投影到这里）
```

**分支就是移动叶子指针**——一字不删，下次 append 从新位置长出。压缩也不
删除任何东西——它只是**改变投影的起点**（从最新 compaction 条目起算）。

## 12.3 动手实现 SessionTree

### entry 类型（先定数据结构）

```ts
// packages/core/src/session-tree.ts
export type SessionEntry =
  | { kind: "message"; id: string; parentId: string | null; message: ChatMessage; at: number }
  | { kind: "model_change"; id: string; parentId: string | null; model: string; at: number }
  | { kind: "compaction"; id: string; parentId: string | null; summary: string; retainedTail: ChatMessage[]; at: number }
  | { kind: "branch_summary"; id: string; parentId: string | null; fromId: string; summary: string; at: number };
```

注意三件事：

1. **model_change 也是树节点**——"换了模型"这个操作本身是历史的一部分。
   分支回到过去时，连"当时用什么模型"都能恢复（投影推导，不是外部记录）
2. **compaction 带 retainedTail**——这是自包含检查点（下节详解）
3. **branch_summary 有 fromId**——记录"从哪条旧路径回来"，摘要挂在新路径上

### 基本操作（全量，三个方法就是核心）

```ts
export class SessionTree {
  private entries = new Map<string, SessionEntry>();
  private leafId: string | null = null;

  append(message: ChatMessage): string {
    const id = `e${++seq}_${Date.now().toString(36)}`;
    this.entries.set(id, { kind: "message", id, parentId: this.leafId, message, at: Date.now() });
    this.leafId = id;
    return id;
  }

  /** 分支 = 移动叶子指针。一字不删。 */
  branch(branchFromId: string): void {
    this.leafId = branchFromId;
  }

  /** 投影：从当前叶到根的路径 → messages 数组（旧→新） */
  toMessages(): ChatMessage[] {
    const path: SessionEntry[] = [];
    let cur = this.leafId;
    while (cur !== null) {
      const e = this.entries.get(cur);
      if (!e) break;
      path.push(e);
      cur = e.parentId;
    }
    path.reverse();

    // 压缩即投影：找到最新的 compaction，从它起算（之前的不进投影）
    const lastCompaction = path.findLastIndex((e) => e.kind === "compaction");
    const start = lastCompaction >= 0 ? lastCompaction : 0;

    const out: ChatMessage[] = [];
    if (lastCompaction >= 0) {
      const c = path[lastCompaction] as Extract<SessionEntry, { kind: "compaction" }>;
      out.push({ role: "user", content: `（系统注入：历史工作摘要）${c.summary}` });
      out.push(...c.retainedTail); // ← retainedTail 内联展开
    }
    for (const e of path.slice(start + (lastCompaction >= 0 ? 1 : 0))) {
      if (e.kind === "message") out.push(e.message);
      else if (e.kind === "branch_summary") {
        out.push({ role: "user", content: `（系统注入：被弃分支的探索摘要）${e.summary}` });
      }
      // model_change 不进 messages（配置沿路径推导）
    }
    return out;
  }
}
```

**为什么 toMessages 要从最新 compaction 起算**：这是 pi 规格的原话——
"**上下文永远不会读取压缩点之后的内容**。这就是让压缩成为一个自包含检查点
而非指向历史指针的原因。"投影不回头看压缩点之前的任何东西，因为 retainedTail
已经把需要的原文内联了——**不需要依赖外部状态，投影是自包含的**。

## 12.4 retainedTail：自包含检查点

第 6 章的压缩问题：被压的原文丢了。树的解法不是"保留原文"（那等于没压），
而是**压缩条目自己携带最近原文**：

```ts
// compact 方法：把旧消息压成一个带 retainedTail 的 compaction 条目
compact(summary: string, keepTail: number): void {
  const path = this.pathFrom(this.leafId);
  const compactFrom = path[Math.max(0, path.length - 1 - keepTail)];
  const retained = path
    .slice(path.indexOf(compactFrom))
    .filter((e) => e.kind === "message")
    .map((e) => (e as { message: ChatMessage }).message);

  const id = nextId();
  this.entries.set(id, {
    kind: "compaction", id,
    parentId: compactFrom.parentId,
    summary, retainedTail: retained, at: Date.now(),
  });
  this.leafId = id;
}
```

**关键理解**：压缩后，树里**旧消息仍然存在**——只是 `toMessages()` 的投影
不再读取它们。如果你想看被压的原文？沿着 `compaction.parentId` 往回走，
原始对话完整无缺。**压缩改变了模型看到的世界，但没有改变历史。**

这就是"压缩即投影"的含义——也是"压缩是延迟检索而不是丢失"的物理基础。

## 12.5 branchWithSummary：试错不丢信息

探索失败后 branch 回去，被弃路径的知识怎么保留？pi 的解法：
**给被弃的分支生成摘要，挂在新路径的起点上**。

```ts
branchWithSummary(branchFromId: string, summary: string): string {
  const fromId = this.leafId; // 记录被弃的叶子
  this.leafId = branchFromId; // 移动到新位置
  const id = nextId();
  this.entries.set(id, {
    kind: "branch_summary", id,
    parentId: branchFromId,   // 挂在新路径上
    fromId,                   // 但记着从哪来的
    summary, at: Date.now(),
  });
  this.leafId = id;
  return id;
}
```

摘要的范围 = 旧叶到**最近公共祖先**（LCA）：

```ts
lowestCommonAncestor(a: string | null, b: string | null): string | null {
  const aPath = new Set(this.pathFrom(a).map((e) => e.id));
  for (const e of this.pathFrom(b)) if (aPath.has(e.id)) return e.id;
  return null;
}
```

摘要提示词用固定六段结构（pi 同款）：

```
## 目标 / ## 约束与偏好 / ## 进度（已完成[x] / 进行中[ ] / 阻塞）
## 关键决策 / ## 后续步骤
保留确切的文件路径、函数名和错误消息。
```

**投影时**，branch_summary 变成一条 user 消息注入——模型看到的是
"（系统注入：被弃分支的探索摘要）[摘要内容]"。它知道之前试过什么、
为什么失败、做了什么决策——**试错本身成了可消费的知识**。

## 12.6 壳侧体验

REPL 的 /branch 和 /tree 命令（在你的 apps/cli/src/main.ts 里加）：

```ts
// /branch N：回到第 N 条用户消息
case "/branch": {
  const n = parseInt(line.split(" ")[1] ?? "0", 10);
  const all = sessionTree.toMessages();
  const userMsgs = all.filter((m) => m.role === "user");
  if (n > 0 && n <= userMsgs.length) {
    // 重建到第 N 条 user 消息为止的路径，branch 到那里
    // （教学版简化：直接截 messages；完整版应操作 SessionTree 本体）
    // ...
    writeLine(`已分支到第 ${n} 条用户消息——旧枝保留在树中`);
  } else {
    // 无参数时列出可回退的消息
    for (const [i, u] of userMsgs.reverse().slice(0, 10).entries()) {
      writeLine(`  /branch ${i + 1} → "${u.content.slice(0, 50)}"`);
    }
  }
  break;
}

// /tree：可视化当前路径
case "/tree": {
  const all = sessionTree.toMessages();
  writeLine(`会话树：${all.length} 条消息在当前路径`);
  for (const [i, m] of all.entries()) {
    writeLine(`  [${i}] ${m.role}: ${(m.content ?? "").slice(0, 40)}`);
  }
  break;
}
```

## 12.7 测试

```ts
// session-tree.test.ts（核心场景——tagent 有更完整的边界测试可对照）
test("[60] 分支不删旧数据", () => {
  const t = new SessionTree();
  t.append({ role: "user", content: "A" });
  const b1 = t.append({ role: "assistant", content: "答A" });
  t.append({ role: "user", content: "B" });
  t.append({ role: "assistant", content: "答B" });
  assert.equal(t.toMessages().length, 4);
  t.branch(b1); // 回到答A
  t.append({ role: "user", content: "C" });
  assert.deepEqual(t.toMessages().map(m => m.content), ["A", "答A", "C"]);
  // 旧枝的 B 和 答B 仍在树里（entries 不删）
});

test("[80] retainedTail：压缩后投影从 compaction 起算", () => {
  const t = new SessionTree();
  for (let i = 1; i <= 6; i++) {
    t.append({ role: "user", content: `Q${i}` });
    t.append({ role: "assistant", content: `A${i}` });
  }
  t.compact("前 3 轮已压缩", 4);
  const msgs = t.toMessages();
  assert.ok(msgs[0].content.includes("压缩")); // 首条是摘要
  assert.ok(msgs.length < 12);                  // 比全量少
});

test("[100] model_change：分支回去连模型都能恢复", () => {
  const t = new SessionTree();
  t.append({ role: "user", content: "Q" });
  t.recordModelChange("model-4b");
  const mid = t.leaf!;
  t.append({ role: "assistant", content: "A" });
  t.recordModelChange("model-9b");
  assert.equal(t.currentModel(), "model-9b");
  t.branch(mid);
  assert.equal(t.currentModel(), "model-4b");
});
```

## 12.8 搞坏实验

- **不用树直接切数组**：跑一个多步任务到第 8 轮，slice 回第 3 轮，再问
  agent"你之前试过什么方法"——它不知道（历史真没了）
- **压缩不带 retainedTail**：只存摘要指针，压缩后 toMessages 投影出来
  的第一条只有摘要没有最近原文——模型对"刚刚发生了什么"完全失忆
- **branch_summary 不挂 fromId**：分支后无法追溯"这个摘要对应哪段被弃
  的路径"——知识变成了无源之水

## 12.9 自测与对照

- [ ] 能画出"存储 ≠ 投影"的树形图，解释为什么压缩不等于丢失
- [ ] 能解释 retainedTail 为什么让 compaction 成为"自包含检查点"
- [ ] branchWithSummary 的摘要为什么挂在新路径上而不是旧路径上？
- [ ] model_change 作为树节点意味着什么？（提示：分支回去连配置都能恢复）

**代码组装提示**：本章代码块是教学片段（不含 import/辅助函数），
完整可编译版本见下方 tagent 文件。

**对照答案**：tagent `packages/core/src/session-tree.ts`（~120 行，
含完整 branchWithSummary + LCA + compact + navigateToEdit）。

**与工业实现的差距**：pi 的生产版多了标签（label 也是树条目）、navigateTree
到 user 消息时叶子跳到父节点（"回到发送前重新编辑"）、以及 JSONL/SQLite
两个持久化后端 + 1016 行一致性测试套件。你的 ~120 行覆盖了核心语义的 80%。

下一章：你的 agent 一次只能调一个工具。多步任务要跑十轮——CPU 上每轮
十几秒。如果模型能写一段代码批量调工具呢？
