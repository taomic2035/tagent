// ============================================================
// 审批流水线（Step 16 FR-97，hermes tools/approval.py 教学复现）
//
// 分层：命令归一化（防混淆绕过）→ hardline floor（--yolo 也拦）→
//       用户 deny 规则（fnmatch，优先于一切放行）→ 危险 pattern 触发确认
// 档位：[60] 归一化 + hardline + deny
//       [80] allowlist 学习（批过的模式持久化）
//       [100] 无人值守默认拒绝
// ============================================================

/** [60] 命令归一化：NFKC 折叠 + ANSI 剥离 + 续行折叠 + $IFS 展开 + 家目录折叠
 *  （hermes 防混淆绕过的五板斧教学版——`rm -rf ~` 的 ~ 展开后才匹配得到） */
export function normalizeCommand(cmd: string): string {
  return cmd
    .normalize("NFKC")
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")   // ANSI 转义序列
    .replace(/\\\n/g, " ")                    // 续行折叠
    .replace(/\$\{?IFS\}?/g, " ")             // $IFS 展开
    .replace(/(^|\s)~(?=\/|\s|$)/g, "$1<HOME>") // 家目录折叠（占位展开，匹配词首 ~）
    .replace(/\s+/g, " ")
    .trim();
}

/** [60] hardline floor：--yolo 也拦的底线清单（hermes：mkfs/dd 到块设备/根删除/fork 炸弹/关机） */
export const HARDLINE_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /\bmkfs\b/, why: "格式化文件系统" },
  { re: /\bdd\s+[^|]*of=\/dev\/(sd|nvme|hd)/, why: "dd 写块设备" },
  { re: /rm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+'?\/(?!tmp|proc|sys|dev)/, why: "根/系统目录递归删除" },
  { re: /:\(\)\s*\{\s*:\|\:&\s*\}\s*;:/, why: "fork 炸弹" },
  { re: /\b(shutdown|reboot|halt)\b/, why: "关机/重启" },
];

export interface ApprovalDecision {
  action: "allow" | "confirm" | "deny";
  reason: string;
}

export interface ApprovalConfig {
  /** [60] 用户 deny 规则（fnmatch，优先于一切放行） */
  denyRules: string[];
  /** [80] 永久 allowlist（批过的模式） */
  allowRules: string[];
  /** [100] 无人值守（cron/背景）：危险 pattern 默认拒绝——"没有人在另一端" */
  unattended: boolean;
}

export const DEFAULT_APPROVAL: ApprovalConfig = { denyRules: [], allowRules: [], unattended: false };

/** [80] allowlist 学习：确认后把命令的主干（argv[0] + 固定前缀）记为允许模式 */
export function learnAllowRule(cmd: string): string {
  const parts = normalizeCommand(cmd).split(" ");
  return parts[0] ?? cmd; // 教学版：只记可执行名（hermes 记 fnmatch 模式）
}

export function decideApproval(rawCmd: string, cfg: ApprovalConfig = DEFAULT_APPROVAL): ApprovalDecision {
  const cmd = normalizeCommand(rawCmd);

  // 顺序即优先级：hardline → deny → allow → 危险 pattern → 放行
  for (const h of HARDLINE_PATTERNS) {
    if (h.re.test(cmd)) return { action: "deny", reason: `hardline floor：${h.why}（不可越过）` };
  }
  for (const rule of cfg.denyRules) {
    if (fnmatch(rule, cmd)) return { action: "deny", reason: `用户 deny 规则：${rule}` };
  }
  for (const rule of cfg.allowRules) {
    if (fnmatch(rule, cmd)) return { action: "allow", reason: `allowlist：${rule}` };
  }

  const dangerous = /\b(rm|curl\s+[^|]*\|\s*(ba)?sh|chmod\s+777|git\s+push\s+--force|:\s)/.test(cmd);
  if (dangerous) {
    if (cfg.unattended) {
      // [100] 无人值守：默认拒绝——没有人在另一端批
      return { action: "deny", reason: "无人值守模式下危险操作默认拒绝" };
    }
    return { action: "confirm", reason: "危险 pattern，需要确认" };
  }
  return { action: "allow", reason: "低风险" };
}

/** fnmatch 教学版（* 与 ? 通配） */
function fnmatch(pattern: string, text: string): boolean {
  const re = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return re.test(text);
}
