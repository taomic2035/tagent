# Windows 性能结论原始证据（补录归档，2026-08-31）

> 复盘欠账清偿：SETUP §8.4/§8.7 的性能数字此前只有结论、原件散落 D:\LLM 未入库，
> 违反「分析结论必须标注原始证据」。本目录归档当时的实验原件（探针级：请求/响应
> 或引擎日志，非三件套全规格——全规格抓取见 capture-win.sh）。

| SETUP 结论 | 原件 |
|---|---|
| §8.4 CPU/Vulkan A/B（pp512 62.75 vs 39.18；tg128 11.89 vs 5.16） | `bench.txt`（llama-bench 原始输出） |
| §8.4 生成 11.6~13.0 tok/s（UD-Q4_K_XL 基线 ×3） | `spec_mtp_nospec.log` 前段 slot print_timing（draft 之前的基线轮）与 `spec_req.json`（同题请求） |
| §8.7 Q4_K_M 无投机 14.89 tok/s | `nospec.json`（timings 字段：predicted_per_second） |
| §8.7 MTP 17.6~21.3 tok/s（n-max=3）×3 | `spec_mtp.log`、`spec_mtp2.log`、`spec_run.json`（acceptance=0.626） |
| §8.7 MTP n-max=5 16.2~17.3 | `spec_mtp_n5.log` |
| §8.7 0.8B 草稿 8.3/10.8（n-max 8/4，acceptance=0.338） | `spec_draft8.log`、`spec_draft4.log` |
