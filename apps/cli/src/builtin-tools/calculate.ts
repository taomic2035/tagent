import { z } from "zod";
import type { Tool } from "@tagent/core";

// ============================================================
// calculate：四则运算表达式求值（递归下降解析器）
//
// 为什么不用 eval()/new Function()？
//   1. 安全：expression 是模型生成的不可信字符串，eval 等于让模型执行任意代码
//   2. 学习：50 行手写解析器 = 一堂浓缩的「分词 → 文法 → 求值」课
//
// 文法（最经典的算术文法，三层结构天然实现运算优先级）：
//   expr   := term (('+' | '-') term)*        ← 最低优先级：加减
//   term   := factor (('*' | '/') factor)*    ← 中优先级：乘除
//   factor := NUMBER | '(' expr ')' | ('+'|'-') factor  ← 最高：数字/括号/一元正负
// ============================================================

// ---- 分词器：字符串 → token 流 ----

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" };

export class CalcError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;
    if (ch === " " || ch === "\t") {
      i++;
    } else if (ch >= "0" && ch <= "9" || ch === ".") {
      // 数字（含小数）。连续读到一个完整的数字字面量
      let j = i;
      while (j < input.length && ((input[j] as string) >= "0" && (input[j] as string) <= "9" || input[j] === ".")) j++;
      const text = input.slice(i, j);
      const value = Number(text);
      if (Number.isNaN(value) || /^\.*$/.test(text)) {
        throw new CalcError(`非法数字: "${text}"（位置 ${i}）`);
      }
      tokens.push({ kind: "num", value });
      i = j;
    } else if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", value: ch });
      i++;
    } else if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
    } else if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
    } else {
      throw new CalcError(`无法识别的字符 "${ch}"（位置 ${i}）`);
    }
  }
  return tokens;
}

// ---- 解析器：token 流 → 语法树 → 直接求值（边解析边算，不建显式树） ----

function parse(tokens: Token[]): number {
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos]; // noUncheckedIndexedAccess：可能越界

  const parseExpr = (): number => {
    let left = parseTerm();
    while (peek()?.kind === "op" && ((peek() as { value: string }).value === "+" || (peek() as { value: string }).value === "-")) {
      const op = (tokens[pos++] as { value: "+" | "-" }).value;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number => {
    let left = parseFactor();
    while (peek()?.kind === "op" && ((peek() as { value: string }).value === "*" || (peek() as { value: string }).value === "/")) {
      const op = (tokens[pos++] as { value: "*" | "/" }).value;
      const right = parseFactor();
      if (op === "/" && right === 0) throw new CalcError("除零错误");
      left = op === "*" ? left * right : left / right;
    }
    return left;
  };

  const parseFactor = (): number => {
    const t = peek();
    if (t?.kind === "num") {
      pos++;
      return t.value;
    }
    if (t?.kind === "lparen") {
      pos++;
      const v = parseExpr();
      if (peek()?.kind !== "rparen") throw new CalcError("缺少右括号 )");
      pos++;
      return v;
    }
    // 一元正负号：如 -3、-(2+1)、--5
    if (t?.kind === "op" && (t.value === "+" || t.value === "-")) {
      pos++;
      const v = parseFactor();
      return t.value === "-" ? -v : v;
    }
    throw new CalcError(
      pos >= tokens.length ? "表达式意外结束" : `此处不应出现 ${tokenText(t)}`,
    );
  };

  const tokenText = (t: Token | undefined): string =>
    t?.kind === "num" ? String(t.value)
    : t?.kind === "op" ? t.value
    : t?.kind === "lparen" ? "("
    : t?.kind === "rparen" ? ")"
    : "(空)";

  const result = parseExpr();
  if (pos < tokens.length) {
    throw new CalcError(`表达式末尾有多余内容: ${tokenText(peek())}`);
  }
  return result;
}

/** 对外入口：求值一个四则运算表达式，任何语法错误抛 CalcError */
export function evaluateExpression(input: string): number {
  return parse(tokenize(input));
}

// ---- 工具定义（zod schema → registry 自动生成 JSON Schema） ----

export const calculateTool: Tool<z.ZodObject<{ expression: z.ZodString }>> = {
  name: "calculate",
  description:
    "计算四则运算表达式。支持 + - * / 括号、小数、一元正负号。不支持函数、幂运算、变量。",
  schema: z.object({
    expression: z
      .string()
      .min(1)
      .describe("四则运算表达式，例如 3.7*12-8.2 或 (2+3)*4"),
  }),
  execute: async (args) => {
    const value = evaluateExpression(args.expression);
    return { expression: args.expression, value };
  },
};
