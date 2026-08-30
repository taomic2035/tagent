import test from "node:test";
import assert from "node:assert/strict";
import { evaluateExpression, CalcError } from "./calculate.js";

// ---- 表驱动：正确性 ----
const ok: Array<[string, number]> = [
  ["3.7*12-8.2", 36.2],            // 验收场景 AC-2 的原题
  ["1+2", 3],
  ["2+3*4", 14],                   // 优先级：先乘除
  ["(2+3)*4", 20],                 // 括号改优先级
  ["10/4", 2.5],                   // 浮点除
  ["-3+5", 2],                     // 一元负号
  ["-(2+3)", -5],                  // 括号前的一元负号
  ["2*-3", -6],                    // 二元后接一元
  ["  1 + 2 * ( 3 - 1 ) ", 5],     // 空白容错
  ["0.1+0.2", 0.1 + 0.2],          // 与 JS 浮点语义一致（不假装修复精度）
];

for (const [expr, expected] of ok) {
  test(`求值 ${expr} === ${expected}`, () => {
    assert.equal(evaluateExpression(expr), expected);
  });
}

// ---- 表驱动：错误路径（抛 CalcError，绝不崩溃进程） ----
const bad: Array<[string, RegExp]> = [
  ["1/0", /除零/],
  ["10/(5-5)", /除零/],
  ["1 +", /意外结束/],
  ["(1+2", /缺少右括号/],
  ["1+2)", /多余内容/],
  ["abc", /无法识别的字符/],
  ["1..2", /非法数字/],
  ["", /意外结束/],
  ["2**3", /不应出现/],  // 不支持幂运算：第二个 * 在 factor 层被拒
];

for (const [expr, pattern] of bad) {
  test(`拒绝 ${JSON.stringify(expr)}`, () => {
    assert.throws(() => evaluateExpression(expr), (e: unknown) => {
      assert.ok(e instanceof CalcError, "必须是 CalcError 类型");
      assert.match(e.message, pattern);
      return true;
    });
  });
}
