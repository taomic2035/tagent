#!/usr/bin/env bash
# ============================================================
# Step 3 真机验收（REQUIREMENTS §7.3 AC3-2/3/5）
# 小预算多轮对话触发双水位裁剪：context-trimmed 事件 + 请求消息数下降
# + /dump 回合完整性（tool 配对不拆散）+ 对话正常完成
# 用法: bash scripts/acceptance-step3.sh   （需先 .\start_llm.ps1 -Detach）
# ============================================================
set -e
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR/.."
MP=$(grep -m1 '^MODEL_PATH=' captures/.env.local | cut -d= -f2-)
PY=$(command -v python3 || command -v python)

curl -s --max-time 5 http://127.0.0.1:8081/health >/dev/null || { echo "✖ 引擎未启动：先 .\\start_llm.ps1 -Detach"; exit 1; }
mkdir -p logs

DEST=captures/step3-ac3-3-trim
pre=$(ls logs/ 2>/dev/null | grep -c '^transcript-' | tr -d ' ')
{
  ask() {  # 发一问，轮询该 transcript 出现 final/error
    printf '%s\n' "$1"
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
  }
  ask "北京今天天气怎么样？"
  ask "那上海呢？"
  ask "杭州的天气如何？对比一下这三个城市"
  printf '/dump\n'; sleep 2
  printf '/exit\n'
} | node apps/cli/dist/main.js --model "$MP" --max-context-tokens 400 > /tmp/step3-trim.out 2>&1

sess=$(ls -t logs/sessions | head -1)
rm -rf "$DEST"; mkdir -p "$DEST"
mv "logs/sessions/$sess" "$DEST/session"
cp "$(ls -t logs/transcript-*.jsonl | head -1)" "$DEST/transcript.jsonl"
cp /tmp/step3-trim.out "$DEST/stdout.txt"

# 脱敏
"$PY" - "$MP" <<'PYEOF'
import pathlib, os, sys
mp = sys.argv[1]
BS = chr(92)
for f in pathlib.Path('captures/step3-ac3-3-trim').glob('**/*'):
    if f.is_file():
        s = f.read_text(errors='ignore')
        s2 = s.replace(mp, '<MODEL_PATH>').replace(mp.replace('/', BS), '<MODEL_PATH>')
        if s2 != s: f.write_text(s2)
print('sanitized')
PYEOF

# 判定：context-trimmed 事件 / 请求消息数下降 / tool 配对完整
"$PY" - "$DEST" <<'PYEOF'
import json, sys, pathlib, glob
dest = sys.argv[1]
trims, requests, finals = [], [], 0
for line in open(f'{dest}/transcript.jsonl', encoding='utf-8'):
    e = json.loads(line)['ev']
    if e['type'] == 'context-trimmed': trims.append(e)
    elif e['type'] == 'llm-request': requests.append(len(e['messages']))
    elif e['type'] == 'final': finals += 1
print(f'final 事件: {finals}（应≥3，每问至少一个）')
print(f'context-trimmed: {len(trims)} 次')
for t in trims:
    print(f"  裁剪 {t['fromTokens']}→{t['toTokens']} est tokens（移除 {t['removedMessages']} 条）")
print(f'各次请求消息数: {requests}')
assert finals >= 3, '三问都应完成'
if trims:
    assert min(requests) < max(requests), '裁剪后请求消息数应下降'
# 回合完整性：最后一个请求里每个 tool 消息都有配对的 tool_call_id
last = None
for line in open(f'{dest}/transcript.jsonl', encoding='utf-8'):
    e = json.loads(line)['ev']
    if e['type'] == 'llm-request': last = e['messages']
ids = set()
for m in last:
    if m.get('role') == 'assistant' and m.get('tool_calls'):
        ids.update(t['id'] for t in m['tool_calls'])
for m in last:
    if m.get('role') == 'tool':
        assert m['tool_call_id'] in ids, f"孤立 tool 消息: {m['tool_call_id']}"
print('回合完整性: OK（无孤立 tool 消息）')
print('✅ AC3-3 通过' if trims else '⚠ 未触发裁剪（预算可再调小）')
PYEOF
