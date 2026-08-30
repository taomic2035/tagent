// 冒烟测试：验证 monorepo 构建与 node:test 工具链贯通（非 agent 逻辑测试）
import { test } from "node:test";
import assert from "node:assert/strict";
import { CORE_VERSION } from "./index.js";

test("工具链冒烟：模块可导入且版本号合法", () => {
  assert.match(CORE_VERSION, /^\d+\.\d+\.\d+$/);
});
