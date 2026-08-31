#!/usr/bin/env bash
# ============================================================
# Windows（Git Bash）版真机验收脚本 —— 与 acceptance.sh（zsh/MLX）同规格
# 六场景（REQUIREMENTS.md AC-1~6）× llama.cpp 引擎，归档存证到 captures/win-ac-*/
# 用法: bash scripts/acceptance-win.sh   （需先 .\start_llm.ps1 -Detach）
# ============================================================
set -e
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR/.."
MP=$(grep -m1 '^MODEL_PATH=' captures/.env.local | cut -d= -f2-)
PY=$(command -v python3 || command -v python)

curl -s --max-time 5 http://127.0.0.1:8081/health >/dev/null || { echo "✖ 引擎未启动：先 .\\start_llm.ps1 -Detach"; exit 1; }
mkdir -p logs

# 跑一个场景：提交问题 → 轮询 transcript 直到 final/error → 可选后置命令 → /exit
# （/exit 必须等 final 之后再发：readline 的 pause() 挡不住同 chunk 缓冲里的下一行，
#   直接 printf 两行会把生成中的 agent 杀掉——Windows 实测踩坑 2026-08-31）
run_ac() {
  local ac=$1 q=$2 post=${3:-}
  local pre=$(ls logs/ 2>/dev/null | grep -c '^transcript-' | tr -d ' ')
  {
    printf '%s\n' "$q"
    T=""; i=0
    while [ $i -lt 30 ]; do
      cur=$(ls logs/ 2>/dev/null | grep -c '^transcript-' | tr -d ' ')
      if [ "$cur" -gt "$pre" ]; then T=$(ls -t logs/transcript-*.jsonl 2>/dev/null | head -1); break; fi
      sleep 1; i=$((i+1))
    done
    [ -z "$T" ] && T=$(ls -t logs/transcript-*.jsonl 2>/dev/null | head -1)
    i=0
    while [ $i -lt 240 ]; do   # 4 分钟上限（CPU 生成 ~12 tok/s，长思考需要余量）
      grep -q '"type":"final"' "$T" 2>/dev/null && break
      grep -q '"type":"error"' "$T" 2>/dev/null && break
      sleep 1; i=$((i+1))
    done
    if [ -n "$post" ]; then printf '%s\n' "$post"; sleep 2; fi
    printf '/exit\n'
  } | node apps/cli/dist/main.js --model "$MP" > "/tmp/$ac.out" 2>&1

  # 归档存证：session 目录 + transcript + 终端输出
  local sess=$(ls -t logs/sessions | head -1)
  local dest="captures/$ac"
  rm -rf "$dest"; mkdir -p "$dest"
  mv "logs/sessions/$sess" "$dest/session"
  cp "$(ls -t logs/transcript-*.jsonl | head -1)" "$dest/transcript.jsonl"
  cp "/tmp/$ac.out" "$dest/stdout.txt"
  echo "✔ $ac 归档完成（$(grep -c '' "$dest/session/call-001/response.sse" 2>/dev/null || echo 0) 行级证据）"
}

run_ac win-ac-1-beijing-weather "北京今天天气怎么样？"
run_ac win-ac-2-calculate "计算 3.7 乘以 12 再减 8.2 等于多少？"
run_ac win-ac-3-self-intro "你好，请用两三句话介绍一下你自己"
run_ac win-ac-4-two-cities "对比一下北京和上海的天气"
run_ac win-ac-5-mars-error "火星现在天气怎么样？"
run_ac win-ac-6-dump "上海天气怎么样？" "/dump"

# 脱敏（入库前必做，规则与 capture-win.sh 一致）：
#   本机绝对模型路径（正/反斜杠两种写法）→ <MODEL_PATH>；用户主目录 → <USER>
"$PY" - "$MP" <<'PYEOF'
import pathlib, os, sys
mp = sys.argv[1]
home = os.path.expanduser("~").replace("\\", "/")
root = pathlib.Path("captures")
n = 0
for f in root.glob("win-ac-*/**/*"):
    if not f.is_file():
        continue
    s = f.read_text(errors="ignore")
    s2 = (s.replace(mp, "<MODEL_PATH>").replace(mp.replace("/", "\\"), "<MODEL_PATH>")
           .replace(home, "<USER>").replace(home.replace("/", "\\"), "<USER>"))
    if s2 != s:
        f.write_text(s2); n += 1
print(f"sanitized: {n} 个文件（模型路径/本机主目录泛化）")
PYEOF

# 为每个 response.sse 生成人读溯源表（制度：TRACEABILITY.md）
for f in captures/win-ac-*/session/call-*/response.sse; do
  [ -e "$f" ] || continue
  node scripts/trace-sse.mjs "$f" >/dev/null
done
echo "全部场景完成，证据已归档并脱敏"
