#!/bin/sh
# ============================================================
# 隐私与敏感信息提交前检查（pre-commit 自动运行）
# 制度来源：docs/PROTOCOL.md §0、AGENTS.md
# 逃逸口：git commit --no-verify（仅限确认误报时，事后必须修正规则）
# ============================================================
set -u

staged=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$staged" ] && exit 0

violations=""

for f in $staged; do
  [ -f "$f" ] || continue
  # 扫描器自身包含检测用的正则字面量，属预期自匹配，跳过
  [ "$f" = "scripts/check-privacy.sh" ] && continue

  # --- 1) 本机绝对路径（含用户名）。允许泛化占位符 /Users/<user>/ ---
  hits=$(grep -nE '/Users/[^/]+/|/home/[^/]+/|C:\\\\Users\\\\[^\\]+' "$f" 2>/dev/null \
        | grep -v '/Users/<user>/' || true)
  [ -n "$hits" ] && violations="$violations
$f (本机绝对路径):
$hits"

  # --- 2) 凭据类字符串 ---
  hits=$(grep -nEi 'gho_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY' "$f" 2>/dev/null || true)
  [ -n "$hits" ] && violations="$violations
$f (疑似凭据):
$hits"

  # --- 3) 硬件/系统指纹（报文里的 system_fingerprint 等） ---
  hits=$(grep -nE 'applegpu_[a-z0-9]+|Mach-O-applegpu' "$f" 2>/dev/null \
        | grep -v '<SYSTEM_FINGERPRINT>' || true)
  [ -n "$hits" ] && violations="$violations
$f (硬件指纹):
$hits"

  # --- 4) 环境变量文件禁止入库（.gitignore 兜底之外的双保险） ---
  case "$f" in
    .env|*.env|*.env.local|.env.local) violations="$violations
$f (环境变量文件禁止入库)" ;;
  esac
done

if [ -n "$violations" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  echo "✖ 隐私检查未通过，提交已拦截：" >&2
  echo "$violations" >&2
  echo "处理方式：脱敏（参考 docs/PROTOCOL.md §0）或 --no-verify 逃逸（慎用）" >&2
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  exit 1
fi
exit 0
