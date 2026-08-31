# Windows/llama.cpp 确定性重放实证（2026-08-31）

对照 Mac 侧 `captures/replay-demo/`（MLX 引擎）。复现命令：

```bash
.\start_llm.ps1 -Detach            # 注意：不带 -Mtp（PROTOCOL §10：重放须关投机解码）
node scripts/replay.mjs captures/08-win-llamacpp-nonstream-tools/request.json --out /tmp/rep1
node scripts/replay.mjs captures/08-win-llamacpp-nonstream-tools/request.json --out /tmp/rep2
```

## 结论（run1 vs run2）

| 层 | 结果 |
|---|---|
| 模型输出 token 流（reasoning/content/tool_call 全量归一化） | **逐项一致**（38 = 38 个 token，finish=tool_calls） |
| 原始字节 | 11774B vs 11773B，差异恰好三类**服务端元数据**（非模型输出）：① `id`（变长随机串）② `created`（Unix 秒）③ `timings`（墙钟计时，如 prompt_ms 102.031 vs 102.570） |

即：**llama.cpp (b10621, CPU, temp=0) 重放确定性成立**；必然不同的是服务端元数据，
比 MLX 侧多一个 `timings` 字段（已回写 PROTOCOL §10）。
