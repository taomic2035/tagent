import { appendFileSync, existsSync, readFileSync } from "node:fs";

// ============================================================
// 长期记忆事实库（Step 6，FR-33，DESIGN §15.1）
//
// 设计取舍（学习点）：
// - 追加式 JSONL：写路径零成本（appendFileSync），读路径全量加载——
//   事实量级（百条）下全量内存毫无压力；到万级再谈索引（YAGNI）
// - 召回是手写评分（字符 bigram 交集 + 空白分词交集×2）：中文无空格，
//   bigram 对中文友好；零依赖红线内这就是"够用的相似度"
// - 0 分不返回：宁缺勿滥——无关注入比没有记忆更糟（污染上下文+占预算）
// ============================================================

export interface MemoryFact {
  id: number;
  ts: number;
  content: string;
  tag?: string;
}

export interface RecalledFact extends MemoryFact {
  score: number;
}

/** 召回评分：字符 bigram 交集数 + 空白分词交集数 ×2（纯函数，供测试） */
export function scoreRecall(query: string, content: string): number {
  const bigrams = (s: string): Set<string> => {
    const norm = s.replace(/\s+/g, "");
    const out = new Set<string>();
    for (let i = 0; i + 1 < norm.length; i++) out.add(norm.slice(i, i + 2));
    return out;
  };
  const qb = bigrams(query);
  const cb = bigrams(content);
  let bigramHits = 0;
  for (const b of qb) if (cb.has(b)) bigramHits++;

  const tokens = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter(Boolean));
  const qt = tokens(query);
  const ct = tokens(content);
  let tokenHits = 0;
  for (const t of qt) if (ct.has(t)) tokenHits++;

  return bigramHits + tokenHits * 2;
}

export class MemoryStore {
  private facts: MemoryFact[] = [];
  private nextId = 1;

  constructor(private readonly file: string) {
    if (existsSync(file)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          const f = JSON.parse(t) as MemoryFact;
          if (typeof f.id === "number" && typeof f.content === "string") {
            this.facts.push(f);
            this.nextId = Math.max(this.nextId, f.id + 1);
          }
        } catch {
          // 坏行跳过：事实库损坏一行不该炸掉整个 agent（兜底哲学，FALLBACK.md 1.2）
        }
      }
    }
  }

  /** 追加一条事实并立即持久化（进程被杀也不丢已确认的记忆） */
  append(content: string, tag?: string): MemoryFact {
    const fact: MemoryFact = { id: this.nextId++, ts: Date.now(), content, ...(tag ? { tag } : {}) };
    this.facts.push(fact);
    appendFileSync(this.file, JSON.stringify(fact) + "\n");
    return fact;
  }

  all(): MemoryFact[] {
    return [...this.facts];
  }

  /** 按评分召回 top-K；0 分不返回（宁缺勿滥） */
  recall(query: string, k = 5): RecalledFact[] {
    return this.facts
      .map((f) => ({ ...f, score: scoreRecall(query, f.content) }))
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score || b.id - a.id)
      .slice(0, k);
  }
}
