#!/usr/bin/env bash
# ============================================================
# Step 2 真机验收（REQUIREMENTS §6.3 AC2-1~4，故障注入法）
# 场景：工具挂死超时 / 瞬时故障重试自愈 / 重试耗尽降级 / 迭代上限降级
# 用法: bash scripts/acceptance-step2.sh   （需先 .\start_llm.ps1 -Detach）
# ============================================================
set -e
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR/.."
MP=$(grep -m1 '^MODEL_PATH=' captures/.env.local | cut -d= -f2-)
PY=$(command -v python3 || command -v python)

curl -s --max-time 5 http://127.0.0.1:8081/health >/dev/null || { echo "✖ 引擎未启动：先 .\\start_llm.ps1 -Detach"; exit 1; }
mkdir -p logs

# 跑一个场景：环境变量(TAGENT_FAULTS) + 问题 + 额外CLI参数 → 轮询 final → 归档
run_step2() {
  local ac=$1 q=$2 extra=${3:-}
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
    while [ $i -lt 300 ]; do
      grep -q '"type":"final"\|"type":"error"' "$T" 2>/dev/null && break
      sleep 1; i=$((i+1))
    done
    printf '/exit\n'
  } | node apps/cli/dist/main.js --model "$MP" $extra > "/tmp/$ac.out" 2>&1

  local sess=$(ls -t logs/sessions | head -1)
  local dest="captures/$ac"
  rm -rf "$dest"; mkdir -p "$dest"
  mv "logs/sessions/$sess" "$dest/session"
  cp "$(ls -t logs/transcript-*.jsonl | head -1)" "$dest/transcript.jsonl"
  cp "/tmp/$ac.out" "$dest/stdout.txt"
  echo "✔ $ac 归档完成"
}

echo "== AC2-1 工具挂死 → 超时信封回填，agent 不挂死"
TAGENT_FAULTS=get_weather:hang run_step2 step2-ac2-1-timeout "北京今天天气怎么样？"

echo "== AC2-2 瞬时故障 → registry 内部重试自愈（模型一轮拿到数据）"
TAGENT_FAULTS=get_weather:flaky:1 run_step2 step2-ac2-2-retry "北京今天天气怎么样？"

echo "== AC2-3 恒瞬时故障 → 重试耗尽信封（retriesUsed），模型转向说明"
TAGENT_FAULTS=get_weather:down run_step2 step2-ac2-3-exhaust "北京今天天气怎么样？"

echo "== AC2-4 迭代上限 → 无 tools 降级终答（基于已有工具结果）"
run_step2 step2-ac2-4-degrade "对比一下北京和上海的天气" "--max-iterations 1"

# 脱敏 + 溯源（与 acceptance-win.sh 同规则）
"$PY" - "$MP" <<'PYEOF'
import pathlib, os, sys
mp = sys.argv[1]
BS = chr(92)
mp_bs = mp.replace('/', BS)
home = os.path.expanduser('~').replace('/', BS)
n = 0
for f in pathlib.Path('captures').glob('step2-*/**/*'):
    if not f.is_file():
        continue
    s = f.read_text(errors='ignore')
    s2 = (s.replace(mp, '<MODEL_PATH>').replace(mp_bs, '<MODEL_PATH>')
           .replace(home, '<USER>').replace(home.replace('/', BS) if '/' in home else home, '<USER>'))
    if s2 != s:
        f.write_text(s2); n += 1
print(f"sanitized: {n} 个文件")
PYEOF

for f in captures/step2-*/session/call-*/response.sse; do
  [ -e "$f" ] || continue
  node scripts/trace-sse.mjs "$f" >/dev/null
done
echo "Step 2 验收四场景完成，证据已归档并脱敏"
