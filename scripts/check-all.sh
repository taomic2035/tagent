#!/usr/bin/env bash
# ============================================================
# 提交前总闸（AGENTS.md「提交前必做」的自动化，Step 13 修复：
# 退出码被管道吞掉的教训不再依赖自觉——FALLBACK.md 清单第 8 条的落地）
# 顺序与 AGENTS.md 一致：测试 → 构建 → 隐私检查，任一失败立即非零退出
# 用法: bash scripts/check-all.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."

echo "── [1/3] pnpm build ──"
pnpm build
echo "── [2/3] pnpm test ──"
pnpm test
echo "── [3/3] privacy ──"
sh scripts/check-privacy.sh
echo ""
echo "✔ 全部通过（build / test / privacy）"
