#!/bin/zsh
# 启动本地 LLM 服务（MLX 引擎，Qwen3.5-4B 4bit）
# 用法: ./start_llm.sh          # 前台启动
#       ./start_llm.sh -d      # 后台启动，日志写在本目录
set -e
DIR="${0:A:h}"
MODEL_PATH="$HOME/.cache/huggingface/hub/models--mlx-community--Qwen3.5-4B-4bit/snapshots/0e7ffd5c629ef7719d4cbc04069232580bfa9d9c"

if [ "$1" = "-d" ]; then
  HF_ENDPOINT=https://hf-mirror.com nohup python3 -m mlx_lm.server \
    --model "$MODEL_PATH" --host 127.0.0.1 --port 8081 \
    > "$DIR/mlx_server.log" 2>&1 &
  echo "MLX server 后台启动中，PID: $!，日志: $DIR/mlx_server.log"
  echo "健康检查: curl http://127.0.0.1:8081/health"
  echo "注意: 请求体里的 model 字段要填模型路径（见 MODEL_PATH），或留空用默认模型"
else
  HF_ENDPOINT=https://hf-mirror.com exec python3 -m mlx_lm.server \
    --model "$MODEL_PATH" --host 127.0.0.1 --port 8081
fi
