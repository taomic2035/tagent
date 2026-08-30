#!/bin/zsh
# ============================================================
# tagent 通信报文抓取脚本（可复现）
# 约定：所有抓到的返回数据保存原始报文（请求体 + 响应头 + 响应体），
#       不做任何美化/截断，供详细分析（docs/PROTOCOL.md）
# 用法: ./captures/capture.sh            # 抓取全部 4 组
#       先启动 MLX server: ./start_llm.sh -d
# ============================================================
set -e
cd "${0:A:h}"
source .env.local   # 提供 MODEL_PATH

CAP() {  # CAP <目录> <stream: true|false> <含tools: yes|no>
  local dir=$1 stream=$2 tools=$3
  mkdir -p "$dir"
  python3 - "$dir" "$stream" "$tools" <<'PYEOF'
import json, sys, os
d, stream, tools = sys.argv[1], sys.argv[2] == "true", sys.argv[3] == "yes"
mp = open(".env.local").read().split("=", 1)[1].strip()
req = {
    "model": mp,
    "messages": [{"role": "user", "content":
        "北京今天天气怎么样？ /no_think" if tools == "yes" else "用两三句话介绍一下秋天"}],
    "max_tokens": 150,
    "stream": stream,
}
if tools == "yes":
    req["tools"] = [{"type": "function", "function": {
        "name": "get_weather", "description": "查询城市天气",
        "parameters": {"type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"]}}}]
json.dump(req, open(f"{d}/request.json", "w"), ensure_ascii=False)
PYEOF
  local ext=$([ "$stream" = "true" ] && echo sse || echo json)
  local flag=$([ "$stream" = "true" ] && echo "-sN" || echo "-s")
  curl $flag --max-time 180 -D "$dir/response-headers.txt" -o "$dir/response.$ext" \
    http://127.0.0.1:8081/v1/chat/completions \
    -H "Content-Type: application/json" -d @"$dir/request.json"
  # 自动脱敏（隐私制度，见 docs/PROTOCOL.md §0）：
  #   本机用户路径 → /Users/<user>/，硬件/系统指纹 → <SYSTEM_FINGERPRINT>
  #   原始未脱敏版本只留在本机，不入库
  sed -i '' -e "s|$MODEL_PATH|/Users/<user>/model|g" \
            -e "s|0\.31\.3-[0-9.\-]*macOS-[0-9.\-]*-arm64[^\"\"]*|<SYSTEM_FINGERPRINT>|g" \
    "$dir/request.json" "$dir/response.$ext" "$dir/response-headers.txt" 2>/dev/null || true
  echo "captured: $dir (已脱敏)"
  # token 级溯源（制度见 docs/TRACEABILITY.md）：流式响应自动生成溯源表
  if [ "$ext" = "sse" ]; then
    node "${0:A:h}/../scripts/trace-sse.mjs" "$dir/response.sse"
  fi
}

CAP 01-nonstream-chat  false no
CAP 02-nonstream-tools false yes
CAP 03-stream-chat     true  no
CAP 04-stream-tools    true  yes
