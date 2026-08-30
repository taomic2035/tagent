#!/bin/zsh
# ============================================================
# 真机验收脚本（REQUIREMENTS.md AC-1~6）
# 每个场景跑一次真实 CLI 会话，自动把存证单元归档到 captures/ac-N-*/
# 并执行脱敏（制度：docs/PROTOCOL.md §0.5）与 trace 生成（TRACEABILITY.md）
# 用法: zsh scripts/acceptance.sh   （需先 ./start_llm.sh -d）
# ============================================================
set -e
cd "${0:A:h}/.."
MP=$(cat captures/.env.local | cut -d= -f2)

curl -s --max-time 5 http://127.0.0.1:8081/health >/dev/null || { echo "✖ 引擎未启动：先 ./start_llm.sh -d"; exit 1; }
mkdir -p logs

# 跑一个场景：提交问题 → 轮询 transcript 直到 final/error → 可选后置命令 → /exit
run_ac() {
  local ac=$1 q=$2 post=${3:-}
  local pre=$(ls logs/ 2>/dev/null | grep -c '^transcript-' | tr -d ' ')
  {
    printf '%s\n' "$q"
    T=""; i=0
    while [ $i -lt 30 ]; do
      cur=$(ls logs/ 2>/dev/null | grep -c '^transcript-' | tr -d ' ')
      if [ "$cur" -gt "$pre" ]; then T=$(ls -t logs/transcript-*.jsonl(N) | head -1); break; fi
      sleep 1; i=$((i+1))
    done
    [ -z "$T" ] && T=$(ls -t logs/transcript-*.jsonl(N) | head -1)
    i=0
    while [ $i -lt 180 ]; do
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

run_ac ac-1-beijing-weather "北京今天天气怎么样？"
run_ac ac-2-calculate "计算 3.7 乘以 12 再减 8.2 等于多少？"
run_ac ac-3-self-intro "你好，请用两三句话介绍一下你自己"
run_ac ac-4-two-cities "对比一下北京和上海的天气"
run_ac ac-5-mars-error "火星现在天气怎么样？"
run_ac ac-6-dump "上海天气怎么样？" "/dump"

# 脱敏（入库前必做）+ 为每个 response.sse 生成人读溯源表
python3 - <<'PYEOF'
import pathlib, re
root = pathlib.Path("captures")
n = 0
for f in root.glob("ac-*/**/request.json"):
    s = f.read_text()
    s2 = re.sub(r'"/Users/[^"]+/snapshots/[^"]+"', '"/Users/<user>/model"', s)
    if s2 != s: f.write_text(s2); n += 1
for f in root.glob("ac-*/**/*"):
    if f.is_file() and f.suffix in {".sse", ".json", ".txt", ".jsonl"}:
        s = f.read_text(errors="ignore")
        s2 = re.sub(r'0\.\d+\.\d+-[\d.\-]+macOS-[\d.\-]+-arm64-[^"]*', "<SYSTEM_FINGERPRINT>", s)
        s2 = s2.replace(str(pathlib.Path.home()), "/Users/<user>")
        if s2 != s: f.write_text(s2)
print(f"sanitized: {n} request.json + 指纹/本机路径泛化")
PYEOF

for f in captures/ac-*/session/call-*/response.sse; do
  node scripts/trace-sse.mjs "$f" >/dev/null
done
echo "全部场景完成，证据已归档并脱敏"
