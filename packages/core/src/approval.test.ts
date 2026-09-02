import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCommand, decideApproval, learnAllowRule, HARDLINE_PATTERNS } from "./approval.js";

test("[60] 命令归一化：NFKC + ANSI 剥离 + $IFS + 家目录", () => {
  assert.equal(normalizeCommand("ls\n  -la"), "ls -la", "续行折叠");
  assert.equal(normalizeCommand("cat ${IFS}/etc/passwd"), "cat /etc/passwd", "$IFS 展开");
  assert.ok(normalizeCommand("rm ~/secret").includes("<HOME>"), "家目录折叠");
});

test("[60] hardline floor：mkfs/dd/根删除/fork 炸弹/关机，--yolo 也拦", () => {
  for (const cmd of ["mkfs.ext4 /dev/sda1", "dd if=x of=/dev/sda", "rm -rf /", "shutdown -h now"]) {
    const r = decideApproval(cmd);
    assert.equal(r.action, "deny", `${cmd} 应 deny`);
  }
});

test("[60] deny 优先于一切放行", () => {
  const r = decideApproval("ls -la", { denyRules: ["ls*"], allowRules: [], unattended: false });
  assert.equal(r.action, "deny");
});

test("[80] allowlist 学习：批过的模式自动放行", () => {
  const rule = learnAllowRule("git status --verbose");
  assert.equal(rule, "git");
  const r = decideApproval("git status", { denyRules: [], allowRules: [rule], unattended: false });
  assert.equal(r.action, "allow");
});

test("[100] 无人值守：危险操作默认拒绝", () => {
  const r = decideApproval("rm temp.log", { denyRules: [], allowRules: [], unattended: true });
  assert.equal(r.action, "deny");
  assert.ok(r.reason.includes("无人值守"));
});

test("[60] 低风险命令直接放行", () => {
  assert.equal(decideApproval("echo hello").action, "allow");
  assert.equal(decideApproval("ls -la").action, "allow");
});
