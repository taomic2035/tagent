# Windows 环境对齐总结（2026-08-31）

> 一句话：开发机 Mac(M5/MLX) → Windows 台式机(i7-14700/llama.cpp)，**环境对齐完成，agent 代码零改动**（`packages/`、`apps/` 无一行变更）。本文是这段"环境准备期"工作的总账与日常速查；细节与踩坑过程见 [SETUP.md §八](../SETUP.md)。

## 一、做了什么（对齐清单）

| # | 工作 | 结果 | 证据/提交 |
|---|---|---|---|
| 1 | 代码库 Windows 验证 | `pnpm install/build/test` 原生全绿（51 项）——NFR-3 实证 | 本地执行记录 |
| 2 | 引擎部署 | llama.cpp b10621（CPU 版，微架构 DLL 自动分派 AVX2）落地 `D:\LLM\llama-cpp\` | SETUP §8.2 |
| 3 | 模型对齐 | 同款量化 `Qwen3.5-4B-UD-Q4_K_XL.gguf`（2912MB，ModelScope 源） | SETUP §8.2 |
| 4 | 启动脚本 | `start_llm.ps1`（`-Detach`/`-Mtp`/`-Backend vulkan`），同端口 8081 | e76333a |
| 5 | 报文制度移植 | `captures/capture-win.sh` + 07~10 四组存证（含脱敏+溯源）；修复 capture.sh 潜伏 bug | e76333a、062b577 |
| 6 | 协议差异考据 | PROTOCOL §8 实测补全（默认温度暗坑、流式分片、无 usage/keepalive 等） | e76333a |
| 7 | 六场景真机验收 | `scripts/acceptance-win.sh` 全过——**NFR-7 引擎无关实证** | ACCEPTANCE 附录、32b088e |
| 8 | 性能基准 | CPU 11.9 tok/s；Vulkan 核显 5.2（负优化淘汰，llama-bench A/B） | SETUP §8.4 |
| 9 | MTP 投机解码复审 | 原生 draft-mtp **正收益 +20~40%**（17.6~21.3 tok/s），Mac 负优化结论厘清边界 | SETUP §8.7、835ed1a |

## 二、日常使用速查（Windows）

```powershell
# 启动引擎（日常推荐带 -Mtp，快 20~40%；协议复现实验不要带）
.\start_llm.ps1 -Detach -Mtp
curl http://127.0.0.1:8081/health        # 健康检查

# 跑 agent（模型路径在 captures/.env.local，正斜杠写法）
node apps/cli/dist/main.js --model "$(cat captures/.env.local | cut -d= -f2)"

# 复跑验收 / 抓报文（Git Bash）
bash scripts/acceptance-win.sh
bash captures/capture-win.sh
```

## 三、与 Mac 环境的关键差异

| 维度 | Mac（M5） | Windows（i7-14700） |
|---|---|---|
| 引擎 | MLX（mlx-lm server） | llama.cpp b10621 CPU |
| 模型格式 | mlx-community 4bit | GGUF UD-Q4_K_XL（同款量化） |
| 生成速度 | 38 tok/s | 11.9 tok/s（开 MTP 17.6~21.3） |
| 思考字段 | `delta.reasoning` | `delta.reasoning_content`（client 双认） |
| **默认温度** | **0.0** | **0.8**（跨引擎对照必须显式传 temperature） |
| HTTP | 1.0（连接关闭收尾） | 1.1 + Keep-Alive |
| 模型源 | hf-mirror.com（本网络不可达） | ModelScope（~12MB/s） |
| 加速下载 | — | GitHub release 走 ghfast.top 前缀 |

## 四、踩坑速查（详见 SETUP §8.5）

1. JSON/脚本里的 Windows 路径一律正斜杠（反斜杠会被多层传递吞成非法转义）
2. 跨引擎对照实验必须显式 `temperature`（两引擎默认值不同，行为完全不同）
3. `.ps1` 含中文必须存 UTF-8 **with BOM**（PowerShell 5.1 按 GBK 读无 BOM 文件）
4. 管道喂 readline 时 `/exit` 会杀掉生成中的 agent——先轮询 transcript 出现 `final` 再发
5. 严格逐字节重放必须关投机解码（spec 开/关在贪心下可因浮点噪声分叉，PROTOCOL §10）
6. MTP 一体模型：`-md` 同文件 + `--spec-type draft-mtp`；草稿整份加载内存翻倍（6.3GB）
7. 本环境 Bash 工具会吞 heredoc 字面反斜杠——内联脚本用 `chr(92)` 或正斜杠逻辑

## 五、当前环境资产

`D:\LLM\`：`llama-cpp\{cpu,vulkan}\`（b10621）、`models\`（UD-Q4_K_XL 日常版 / MTP-Q4_K_M 投机版 / 0.8B 草稿对照版）、`llama_server.log`。仓库新增：`start_llm.ps1`、`captures/capture-win.sh`、`scripts/acceptance-win.sh`、存证 `captures/07-10` 与 `captures/win-ac-*`。

## 六、下一步

环境对齐收官，回到 [README](../README.md) 学习路线正题：**Step 2 多工具与错误处理（工具执行失败的重试与降级策略）**——需求增补见 docs/REQUIREMENTS.md，验收证据沿用 captures/ 制度。
