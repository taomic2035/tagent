import type { ChatMessage } from "./types.js";

// ============================================================
// 会话树（Step 16 FR-90，pi 会话存储哲学的教学复现）
//
// pi 的三个核心思想：
// 1. **会话是不可变树**——条目带 parentId，分支=移动叶子指针，一字不删；
//    连"换了模型/思考级别"都是树节点（分支回去连配置都能恢复）
// 2. **压缩即投影**——CompactionEntry 内联 retainedTail（自包含检查点），
//    "上下文永远不会读取压缩点之后的内容"；旧消息永远在树里
// 3. **试错不丢信息**——branchWithSummary 给被放弃的分支生成结构化摘要，
//    挂在导航目标上（fromId 记旧叶），摘要范围=旧叶到最近公共祖先
//
// 档位：[60] 树+分支+路径投影 [80] retainedTail+branchWithSummary
//       [100] 配置变更也是节点
// ============================================================

export type SessionEntry =
  | { kind: "message"; id: string; parentId: string | null; message: ChatMessage; at: number }
  | { kind: "model_change"; id: string; parentId: string | null; model: string; at: number } // [100]
  | { kind: "compaction"; id: string; parentId: string | null; summary: string; retainedTail: ChatMessage[]; at: number } // [80]
  | { kind: "branch_summary"; id: string; parentId: string | null; fromId: string; summary: string; at: number }; // [80]

let seq = 0;
const nextId = () => `e${++seq}_${Date.now().toString(36)}`;

export class SessionTree {
  private entries = new Map<string, SessionEntry>();
  private leafId: string | null = null;

  append(message: ChatMessage): string {
    const id = nextId();
    const e: SessionEntry = { kind: "message", id, parentId: this.leafId, message, at: Date.now() };
    this.entries.set(id, e);
    this.leafId = id;
    return id;
  }

  /** [100] 配置变更也是节点：分支回去连"当时用什么模型"都能恢复 */
  recordModelChange(model: string): string {
    const id = nextId();
    this.entries.set(id, { kind: "model_change", id, parentId: this.leafId, model, at: Date.now() });
    this.leafId = id;
    return id;
  }

  /** [60] 分支 = 移动叶子指针，一字不删（pi：`this.leafId = branchFromId`） */
  branch(branchFromId: string): void {
    if (!this.entries.has(branchFromId)) throw new Error(`branch: 条目 ${branchFromId} 不存在`);
    this.leafId = branchFromId;
  }

  /** 从当前叶到根的条目路径（新→旧） */
  private pathFrom(leafId: string | null): SessionEntry[] {
    const out: SessionEntry[] = [];
    let cur = leafId;
    while (cur !== null) {
      const e = this.entries.get(cur);
      if (!e) break;
      out.push(e);
      cur = e.parentId;
    }
    return out.reverse(); // 旧→新
  }

  /**
   * [60] 路径投影：当前叶到根的路径 → messages 数组。
   * [80] 压缩即投影：最新 compaction 之后才展开原文（"上下文永不读取压缩点
   *      之后的内容"改为：投影从最新 compaction 起算，retainedTail 内联展开）。
   */
  toMessages(): ChatMessage[] {
    const path = this.pathFrom(this.leafId);
    const lastCompactionIdx = (() => {
      for (let i = path.length - 1; i >= 0; i--) {
        if (path[i]?.kind === "compaction") return i;
      }
      return -1;
    })();

    const out: ChatMessage[] = [];
    if (lastCompactionIdx >= 0) {
      const c = path[lastCompactionIdx];
      if (c && c.kind === "compaction") {
        // 自包含检查点：摘要消息 + 内联的 retainedTail 原文
        out.push({ role: "user", content: `（系统注入：历史工作摘要｜旧分支已压缩）${c.summary}` });
        out.push(...c.retainedTail);
      }
    }
    for (let i = lastCompactionIdx + 1; i < path.length; i++) {
      const e = path[i];
      if (!e) continue;
      if (e.kind === "message") out.push(e.message);
      else if (e.kind === "branch_summary") {
        out.push({ role: "user", content: `（系统注入：被放弃分支的探索摘要）${e.summary}` });
      }
      // model_change 不进 messages（配置沿路径推导，见 currentModel()）
    }
    return out;
  }

  /** [100] 沿路径推导当前生效配置（分支回去连模型都能恢复） */
  currentModel(): string | undefined {
    for (let i = this.pathFrom(this.leafId).length - 1; i >= 0; i--) {
      const e = this.pathFrom(this.leafId)[i];
      if (e?.kind === "model_change") return e.model;
    }
    return undefined;
  }

  /**
   * [80] branchWithSummary：摘要条目挂在**导航目标**上（不是旧分支上），
   * fromId 记被放弃的叶子；摘要范围 = 旧叶到最近公共祖先（LCA）。
   */
  branchWithSummary(branchFromId: string, summary: string): string {
    const fromId = this.leafId ?? "root";
    this.leafId = branchFromId;
    const id = nextId();
    this.entries.set(id, { kind: "branch_summary", id, parentId: branchFromId, fromId, summary, at: Date.now() });
    this.leafId = id;
    return id;
  }

  /** [80] LCA：旧路径与新路径的第一个交点（branch-summarization 同款算法） */
  lowestCommonAncestor(a: string | null, b: string | null): string | null {
    const aPath = new Set(this.pathFrom(a).map((e) => e.id));
    for (const e of this.pathFrom(b)) if (aPath.has(e.id)) return e.id;
    return null;
  }

  /** [80] 压缩：把当前叶之前的旧消息压成 compaction 条目（retainedTail 保留最近原文） */
  compact(summary: string, keepTail: number): void {
    const path = this.pathFrom(this.leafId);
    const compactFrom = path[Math.max(0, path.length - 1 - keepTail)];
    if (!compactFrom) return;
    const id = nextId();
    const retained = path
      .slice(path.indexOf(compactFrom))
      .filter((e): e is Extract<SessionEntry, { kind: "message" }> => e.kind === "message")
      .map((e) => e.message);
    this.entries.set(id, { kind: "compaction", id, parentId: compactFrom.parentId, summary, retainedTail: retained, at: Date.now() });
    this.leafId = id;
  }

  /** 导航到 user 消息 = 回到发送前状态重新编辑（pi v3 语义） */
  navigateToEdit(entryId: string): ChatMessage | undefined {
    const e = this.entries.get(entryId);
    if (!e || e.kind !== "message" || e.message.role !== "user") return undefined;
    this.leafId = e.parentId; // 叶子跳到父节点
    return e.message;         // 文本回填编辑器
  }

  get leaf(): string | null { return this.leafId; }
  get size(): number { return this.entries.size; }
}
