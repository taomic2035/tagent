#!/usr/bin/env bash
# ============================================================
# Windows（Git Bash）版报文抓取脚本 —— 与 capture.sh（zsh/MLX）同规格
# 引擎: llama.cpp + GGUF（TECH_STACK.md §四 R2 路线）
# 约定与制度: docs/PROTOCOL.md §0（原件三件套 + 脱敏 + token 溯源）
# 用法: bash captures/capture-win.sh   （需先 .\start_llm.ps1 -Detach）
# ============================================================
set -e
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR"
# .env.local 提供 MODEL_PATH（不入库）。Windows 下建议正斜杠写法，
# 避免 JSON 转义踩坑（反斜杠在多层传递中易被吞成非法转义，实测 2026-08-31）
MP=$(grep -m1 '^MODEL_PATH=' .env.local | cut -d= -f2-)
PY=$(command -v python3 || command -v python)

CAP() {  # CAP <目录> <stream: true|false> <含tools: yes|no> <max_tokens>
  local dir=$1 stream=$2 tools=$3 mt=$4
  mkdir -p "$dir"
  "$PY" - "$dir" "$stream" "$tools" "$mt" "$MP" <<'PYEOF'
import json, sys
d, stream, tools, mt, mp = sys.argv[1], sys.argv[2]=="true", sys.argv[3]=="yes", int(sys.argv[4]), sys.argv[5]
req = {
    "model": mp,
    "messages": [{"role": "user", "content":
        "北京今天天气怎么样？ /no_think" if tools else "用两三句话介绍一下秋天"}],
    "max_tokens": mt,
    "stream": stream,
    # 显式 temp=0：两引擎默认值不同（MLX 0.0 / llama.cpp 0.8），
    # 不显式指定则同请求行为完全不同（实测 2026-08-31，见 07/08 组初版教训）
    "temperature": 0,
}
if tools:
    req["tools"] = [{"type": "function", "function": {
        "name": "get_weather", "description": "查询城市天气",
        "parameters": {"type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"]}}}]
json.dump(req, open(f"{d}/request.json", "w"), ensure_ascii=False)
PYEOF
  local ext=$([ "$stream" = "true" ] && echo sse || echo json)
  local flag=$([ "$stream" = "true" ] && echo "-sN" || echo "-s")
  curl $flag --max-time 300 -D "$dir/response-headers.txt" -o "$dir/response.$ext" \
    http://127.0.0.1:8081/v1/chat/completions \
    -H "Content-Type: application/json" -d @"$dir/request.json"

  # 自动脱敏（隐私制度 docs/PROTOCOL.md §0.5）：
  #   本机绝对模型路径 → <MODEL_PATH>（llama.cpp 会在响应里回显，
  #   且可能把正斜杠归一为反斜杠，两种写法都替换）
  "$PY" - "$dir" "$ext" "$MP" <<'PYEOF'
import sys, pathlib, os
d, ext, mp = sys.argv[1], sys.argv[2], sys.argv[3]
home = os.path.expanduser("~").replace("\\", "/")
for name in ["request.json", f"response.{ext}", "response-headers.txt"]:
    p = pathlib.Path(d) / name
    if not p.exists():
        continue
    s = p.read_text(encoding="utf-8", errors="ignore")
    s = s.replace(mp, "<MODEL_PATH>").replace(mp.replace("/", "\\"), "<MODEL_PATH>")
    s = s.replace(home, "<USER>").replace(home.replace("/", "\\"), "<USER>")
    p.write_text(s, encoding="utf-8")
PYEOF
  echo "captured: $dir (已脱敏)"

  # token 级溯源（制度见 docs/TRACEABILITY.md）：流式响应自动生成溯源表
  if [ "$ext" = "sse" ]; then
    node "$SCRIPT_DIR/../scripts/trace-sse.mjs" "$dir/response.sse"
  fi
}

CAP 07-win-llamacpp-nonstream-chat  false no  512
CAP 08-win-llamacpp-nonstream-tools false yes 300
CAP 09-win-llamacpp-stream-chat     true  no  512
CAP 10-win-llamacpp-stream-tools    true  yes 300
