# 本地 Agent 开发环境：选型、搭建与实测数据

> 记录日期：2026-08-30 ｜ 目标：在 Mac 上从零搭建可用的本地 LLM 服务，作为手写 agent 学习的推理后端
> **2026-08-31 追记：开发机迁至 Windows，环境对齐记录见 §八（llama.cpp 部署/双引擎差异/MTP 实测）；速查版见 [docs/WINDOWS-ENV.md](docs/WINDOWS-ENV.md)**

## 一、硬件与软件环境

| 项目 | 配置 |
|---|---|
| 机型 | MacBook Air（Mac17,3） |
| 芯片 | Apple M5，10 核 GPU，Metal 4 |
| 统一内存 | 32 GB（GPU 可用约 25.5 GB） |
| 系统 | macOS 26.6.2（Apple Silicon，arm64） |
| Python | 3.14.6（Homebrew） |
| 包管理 | Homebrew 6.0.11 |
| 网络 | Hugging Face 官方源不可直连，需使用 hf-mirror.com 镜像 |

磁盘剩余 617 GB，模型文件总占用约 6 GB（含备份）。

## 二、选型及理由

### 模型：Qwen3.5-4B（4bit 量化）

| 候选 | 结论 | 原因 |
|---|---|---|
| ~~Qwen3.5-0.8B~~ | 否决 | 太小，tool calling 的结构化输出（JSON 格式、选对工具、填对参数）不可靠，学 agent 会把时间浪费在"模型太笨"上 |
| **Qwen3.5-4B（选用）** | ✅ | 原生 function calling；内建思考模式（一个模型可做"推理开/关"对比实验）；4bit 约 2.5 GB，32 GB 内存余量充足 |
| Qwen3.5-9B / 27B / gpt-oss-20b | 进阶备选 | agent 跑通后升级，观察"模型能力上限对 agent 行为的影响" |

关于型号版本：Qwen3.5 系列小模型为 0.8B / 2B / 4B / 9B / 27B；Qwen3.6 系列目前只有 27B 和 Flash 视觉变体，**没有 4B**。

### 推理引擎：MLX（llama.cpp 保留作学习材料）

**这是本次选型中唯一被实测推翻的初始决策。** 原计划用 llama.cpp（对学习底层原理更友好），但实测发现 Qwen3.5 的新架构（GDN 混合注意力：门控 DeltaNet 线性注意力 + 全注意力混合）在 llama.cpp 的 Metal 内核尚未优化，4B 模型只有 15 tok/s（同机旧架构 Qwen3 正常应有 60+ tok/s），而 MLX 快 30%+。最终方案：

- **MLX 做推理后端**（生产路径），OpenAI 兼容接口，agent 代码与引擎解耦
- **llama.cpp 保留**（学习路径），以后读 `examples/server` 源码理解 chat template、tool call 解析、量化格式
- 关键认知：**agent 代码只依赖 HTTP 接口，换引擎不改代码**——选型错了可以低成本纠正

量化格式：4bit（MLX affine）。Q4 量级的质量损失对 4B 学习用途可忽略，速度换内存完全值得。

## 三、安装步骤（可复现）

```bash
# 1. 推理引擎（二选一或都装）
brew install llama.cpp                    # llama.cpp，含 Metal 后端
python3 -m pip install --break-system-packages mlx-lm    # MLX 文本
python3 -m pip install --break-system-packages mlx-vlm   # 仅 MTP 实验需要，普通使用可不装

# 2. 下载模型（走镜像，禁用 Xet 避免镜像 401）
export HF_ENDPOINT=https://hf-mirror.com HF_HUB_DISABLE_XET=1
python3 -c "from huggingface_hub import snapshot_download; \
    print(snapshot_download('mlx-community/Qwen3.5-4B-4bit'))"

# 3. 启动服务
./start_llm.sh -d      # 后台起 MLX server 于 127.0.0.1:8081
curl http://127.0.0.1:8081/health
```

### start_llm.sh 关键参数

```
python3 -m mlx_lm.server --model <本地快照路径> \
    --host 127.0.0.1 --port 8081
环境变量: HF_ENDPOINT=https://hf-mirror.com   # 必须走镜像，否则首个请求卡死 2 分钟
```

### llama.cpp 对照启动参数（学习用）

```
llama-server -m Qwen3.5-4B-UD-Q4_K_XL.gguf \
    --jinja -c 16384 -ngl 99 \
    --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0
```

注意：新版 llama.cpp 参数格式为 `--flash-attn on`（裸 `--flash-attn` 会报参数错误）；`--jinja` 是 tool calling 的前提；KV cache 量化需要 Flash Attention 先开启。

## 四、实测性能数据

### 4.1 推理引擎对比（同机、同模型 Qwen3.5-4B）

| 引擎 | 配置 | 生成速度 | 结论 |
|---|---|---|---|
| llama.cpp 0.3.0 | `-ngl 99`（Metal 全卸载，确认生效）+ FA + KV 量化 | **15.0 tok/s** | GDN 架构内核未优化，放弃 |
| MLX (mlx-lm) | 默认 | 20.6 → 38 tok/s* | 选用 |

*20.6 为低电量模式开启时，38 为关闭后（见 4.3）。

### 4.2 MTP 投机解码 A/B（mlx-vlm 0.6.17，600 tokens，低电量模式关闭前测）

| 配置 | 总耗时（含加载） | 稳态速度 | 备注 |
|---|---|---|---|
| 基准 | 33.5s | ~25 tok/s | |
| + MTP 草稿头 | 40.3s | **~20 tok/s（负优化）** | 每轮提议 2.94 token，仅接受 1.92（31%），省下的步数抵不过草稿开销 |

结论：MTP 机制正常工作但接受率不足，当前不要开。mlx-lm 主线目前会在加载时丢弃 Qwen3.5 的 `mtp.*` 权重（源码 `models/qwen3_5.py` sanitize 阶段），MTP 路径依赖 mlx-vlm。等 mlx-lm 原生支持后值得重测。

> **跨平台复审（2026-08-31）**：llama.cpp 侧已有原生路径且实测为**正收益**（Windows CPU +20~40%，接受率 0.626）——"引擎原生支持后值得重测"在 llama.cpp 上应验，Mac 侧待 mlx-lm 跟进。详见 §8.7。

### 4.3 低电量模式影响（最关键的一项系统设置）

| 指标 | lowpowermode=1 | lowpowermode=0 | 提升 |
|---|---|---|---|
| 生成速度（server 路径，300 tok） | 20.6 tok/s | **38.1 tok/s** | 1.85× |
| 引擎裸速（CLI，600 tok） | ~23 tok/s | **~78 tok/s** | ~3.2× |

```bash
pmset -g | grep lowpower      # 检查：0=正常，1=限速
sudo pmset lowpowermode 0     # 关闭（需密码）
```

排查时机器无发热告警、无降频记录，纯粹是电源策略限速。**Mac 上测推理性能，第一件事先查这个。**

### 4.4 server 路径 vs 引擎裸速

server 稳定在 38 tok/s，裸引擎约 78 tok/s。差值来自 HTTP 处理、逐 token 流式解码、JSON 封装。对学习用途无感；追求极致时可绕过 HTTP 直接进程内调用 `mlx_lm.stream_generate`（进阶练习）。

### 4.5 最终验收

| 项目 | 结果 |
|---|---|
| tool calling | ✅ 一次成功：`get_weather {"city": "北京"}`，参数符合 schema |
| 思考模式 | ✅ 默认开启，输出含 `reasoning` 字段；用户消息加 `/no_think` 可关 |
| 内存占用 | 峰值 2.5 GB（32 GB 余量巨大） |
| 稳定性 | 重启后速度一致（38.1 / 38.7 tok/s），无缓存假象 |

## 五、踩坑记录（按排查顺序）

1. **Qwen3.5 在 llama.cpp 上只有 15 tok/s**。表象像"GPU 没用上"（日志里确实没有 Metal 字样），实际是新架构 GDN 的 Metal 内核未优化。教训：模型太新时，架构兼容性比参数调优影响大得多。
2. **MLX server 首个请求"假死"**。启动时不加载模型，首个请求才加载，且会联网访问 huggingface.co 校验；网络不通时卡 2 分钟超时。修复：`HF_ENDPOINT` 指向镜像；请求体 `model` 字段直接填本地快照绝对路径。
3. **`HF_HUB_OFFLINE=1` 反而报错**。mlx_lm 每次请求都做 hub 查找，离线模式直接失败；走镜像比强制离线更稳。
4. **镜像下载 401**。hf-mirror 不支持 Xet 传输协议，需 `HF_HUB_DISABLE_XET=1`。
5. **低电量模式静默限速**。无任何告警，只有 `pmset -g` 能查到。
6. **新版 llama.cpp 参数变更**。`--flash-attn on`（带值）；`--cache-type-k/v q8_0`。

## 六、当前资产清单

```
~/vibecoding/tagent/
├── start_llm.sh                    # 一键启动（后台模式 ./start_llm.sh -d）
├── mlx_server.log                  # 运行日志
├── SETUP.md                        # 本文档
└── models/
    └── Qwen3.5-4B-UD-Q4_K_XL.gguf  # llama.cpp 备份（当前不用）
~/.cache/huggingface/hub/
├── models--mlx-community--Qwen3.5-4B-4bit/       # 主力模型（使用中）
└── models--mlx-community--Qwen3.5-4B-MTP-4bit/   # MTP 草稿头（实验用）
```

## 七、已知边界与后续方向

- 速度上限：4B 4bit 受内存带宽约束（M5 Air 约 100 GB/s），38 tok/s 的 server 路径对 agent 交互足够
- 想更快：换旧架构 Qwen3-4B（预计 60+ tok/s）或进程内调用
- 想更强：升级 Qwen3.5-9B/27B（32 GB 跑 Q4 无压力），对比 agent 任务成功率变化
- 下一步：手写 agent loop（while 循环 + 工具定义 + 解析 tool_calls + 执行 + 结果回填），先做"查天气 + 算数学"两工具最小版

## 八、Windows 环境部署与实测（2026-08-31 迁移）

> 开发机从 MacBook Air M5 迁至 Windows 台式机。引擎层按 TECH_STACK.md §四 既定路线切换：MLX（Mac 专属）→ llama.cpp + GGUF；**agent 代码零改动**（NFR-7 引擎无关的实证）。

### 8.1 硬件与网络环境

| 项目 | 配置 |
|---|---|
| 机型 | HP Elite Tower 880 G9 |
| CPU | Intel i7-14700（20 核 28 线程，AVX2；无 AVX-512） |
| 内存 | 32 GB DDR5 |
| GPU | Intel UHD 770 核显（**无独显** → llama.cpp 走 CPU 后端；Vulkan 留作对照实验） |
| 网络 | GitHub 可直连但 release CDN 限速 ~13 KB/s（经 ghfast.top 代理 ~292 KB/s）；huggingface.co 与 hf-mirror.com 均不可达 → **模型源改走 ModelScope**（Qwen 官方国内源，实测 ~12 MB/s）——与 Mac 时期恰好相反 |

### 8.2 安装步骤（可复现，全部落地 `D:\LLM`）

```powershell
# 1. llama.cpp b10621（v0.3.0 nightly 指针指向的构建；zip 内含按 CPU 微架构自动分派的 DLL，无需手选 AVX2 变体）
curl -L -o llama-cpu.zip "https://github.com/ggml-org/llama.cpp/releases/download/b10621/llama-b10621-bin-win-cpu-x64.zip"
# 直连过慢时加代理前缀：https://ghfast.top/<完整 github 下载地址>
# 解压到 D:\LLM\llama-cpp\cpu\（vulkan 版同理，备用对照）

# 2. 模型：与 Mac 备份同款量化（unsloth UD-Q4_K_XL，2912 MB）
curl -L -o D:\LLM\models\Qwen3.5-4B-UD-Q4_K_XL.gguf `
  "https://modelscope.cn/models/unsloth/Qwen3.5-4B-GGUF/resolve/master/Qwen3.5-4B-UD-Q4_K_XL.gguf"

# 3. 启动（仓库根目录；captures/.env.local 写 MODEL_PATH=D:/LLM/models/Qwen3.5-4B-UD-Q4_K_XL.gguf）
.\start_llm.ps1 -Detach
curl http://127.0.0.1:8081/health
```

### 8.3 start_llm.ps1 关键参数

```
llama-server -m <gguf> --host 127.0.0.1 --port 8081 -c 16384 --jinja --reasoning-format deepseek
（vulkan 后端追加 -ngl 99 -fa on）
```

- `--jinja`：b10621 已默认开启，仍显式写出（tool calling 前提）
- `--reasoning-format deepseek`：思考内容进 `delta.reasoning_content`；client.ts 本就双认 `reasoning`/`reasoning_content`，**协议层零改动**
- 模型加载 3.4 s（llama.cpp 启动即加载；MLX 是首请求才加载）

### 8.4 实测性能（数据来自 llama.cpp 响应内建 `timings` 字段与 llama-bench）

| 指标 | Windows i7-14700 CPU | 对照 Mac M5 MLX |
|---|---|---|
| 生成速度（server timings 直读） | **11.6 ~ 13.0 tok/s** | 38.1 tok/s |
| prompt 处理（server） | 32 ~ 39 tok/s | ~160 tok/s（缓存命中前 72） |
| 备注 | agent 交互可用，长思考场景偏慢 | — |

**CPU vs Vulkan 后端 A/B**（llama-bench，pp512/tg128 各 3 次，`D:\LLM\bench.txt`）：

| 后端 | pp512（t/s） | tg128（t/s） | 结论 |
|---|---|---|---|
| CPU（alderlake 内核自动分派，20 线程） | **62.75 ± 0.99** | **11.89 ± 0.23** | ✅ 采用 |
| Vulkan（UHD 770，`-ngl 99 -fa on`） | 39.18 ± 2.38 | 5.16 ± 0.10 | ❌ 负优化（tg 慢 2.3×） |

UHD 770 无矩阵核心（bench 设备探测 `matrix cores: none`）且与 CPU 共享内存带宽，全卸载反而更慢——与 Mac 侧 MTP 负优化实验同一教训：**弱硬件加速不如强 CPU 内核，实测再下结论**。故 `start_llm.ps1` 默认 CPU 后端，vulkan 保留作参数可选。

### 8.5 Windows 踩坑记录（按排查顺序）

1. **JSON 里的反斜杠模型路径会被多层传递吞成非法转义**（`D:\LLM` → `\L`，服务端报 `forbidden character after backslash`）。统一用正斜杠 `D:/LLM/...`——Windows API 完全接受，JSON 免转义。
2. **两引擎默认温度不同**（MLX 0.0 / llama.cpp 0.8）：不显式指定 temperature 时同一请求行为完全不同——默认温度下思考变冗长英文、300 token 预算耗尽仍无 tool call；temp=0 时与 Mac 行为一致（简短中文思考 + 干净 tool call）。协议对照实验必须显式带温度。
3. `/no_think` 在 llama.cpp 上同样不关闭思考（与 PROTOCOL.md §10 的 MLX 待考据互证——是模型/模板层问题，非引擎层）。
4. PowerShell 5.1 把无 BOM 的 UTF-8 脚本按 GBK 解析（中文注释变乱码直接解析错误）→ `.ps1` 带中文必须存 UTF-8 **with BOM**。
5. readline 的 `pause()` 挡不住同 chunk 缓冲里的下一行：`printf '问题\n/exit\n'` 管道输入会用 `/exit` 杀掉生成中的 agent → 验收脚本先轮询 transcript 出现 `final` 再发 `/exit`（acceptance-win.sh）。
6. **capture.sh 潜伏 bug 被迁移实测暴露**：python 侧 `tools` 已是 bool，判断却写 `tools == "yes"` 恒假（首版即存在，Mac 早期存证出自未回传的本地修复版）。已随 capture-win.sh 一并修复。
7. 下载源结论：GitHub release CDN 慢走 ghfast.top；HF 系全不可达走 ModelScope。

### 8.6 当前资产清单（Windows）

```
D:\LLM\
├── llama-cpp\cpu\        # llama.cpp b10621 CPU 版（llama-server.exe 等）
├── llama-cpp\vulkan\     # Vulkan 版（核显对照实验备用）
├── models\Qwen3.5-4B-UD-Q4_K_XL.gguf   # 2912 MB，与 Mac 备份同款（日常默认）
├── models\Qwen3.5-4B-MTP-Q4_K_M.gguf   # 2834 MB，MTP 一体模型（投机解码用，见 8.7）
├── models\Qwen3.5-0.8B-UD-Q4_K_XL.gguf # 559 MB，经典草稿模型（实验对照）
└── llama_server.log      # 后台运行日志
```

### 8.7 MTP 投机解码实测（2026-08-31，对 Mac §4.2 结论的跨平台复审）

> Mac 侧结论：mlx-vlm 旁路 MTP 为**负优化**（接受率不足，草稿开销抵不过省的步数），
> "等引擎原生支持后值得重测"。Windows/llama.cpp 恰好提供了原生路径——本次复审完成。

**测试对象与加载方式**

- 一体模型 `Qwen3.5-4B-MTP-Q4_K_M.gguf`（ModelScope `unsloth/Qwen3.5-4B-MTP-GGUF`）：
  张量结构 = 基础 32 层（blk.0~31）+ **blk.32 即 MTP 头**（`eh_proj/hnorm/enorm/shared_head_norm`，DeepSeek 系 MTP 命名）。所谓"一体"就是基础权重和 MTP 头打包在同一文件。
- llama.cpp b10621 原生支持：`-md 同一文件 --spec-type draft-mtp`（从草稿文件取 MTP 头）
- 注意：MTP 仓库中 `MTP-UD-Q4_K_XL.gguf` 在 ModelScope 服务端是空文件（API 报"文件内容为空"），实际可用的是不带 MTP- 前缀的量化档（它们同样含头，比基础版同档大 ~90MB）

**数据（server 路径真实请求，同题「秋天描写 256 token」×3，timings 字段直读）**

| 配置 | 生成 tok/s | 接受率 | 判定 |
|---|---|---|---|
| UD-Q4_K_XL 无投机（部署基线） | 10.9 ~ 12.6 | — | 基准 |
| **Q4_K_M 无投机**（同 MTP 文件、关 spec） | **14.9** | — | 量化档本身更快（K-quant 内核对 CPU 友好） |
| **Q4_K_M + MTP（n-max=3，默认）** | **17.6 ~ 21.3** | **0.626**（166/265，mean len 2.87） | ✅ **比同档基线 +20~40%；比部署基线 +50~80%** |
| Q4_K_M + MTP（n-max=5） | 16.2 ~ 17.3 | — | 深链多被拒，不如默认 3 |
| UD-Q4_K_XL + 0.8B 草稿（draft-simple，n-max=8） | 8.2 ~ 8.5 | 0.338 | ❌ 负优化 -30% |
| UD-Q4_K_XL + 0.8B 草稿（n-max=4） | 10.5 ~ 11.4 | — | ❌ 仍低于基线 |

**结论与解释**

1. **MTP 在 Windows CPU 上有实打实的收益**：同量化档 +20~40%。与 Mac 旁路实验结论相反，原因是 llama.cpp 走官方 draft-mtp 路径：草稿只需跑单层 MTP 头（mlx-vlm 旁路是整模型流程），且 CPU 批式验证把「一次权重扫描验证多个 token」的带宽收益吃满（CPU 解码本就是带宽受限）。
2. **0.8B 当草稿不行**：接受率 0.338——0.8B 太弱（与 §二选型时"tool calling 不可靠"的判断一致），弱草稿 + CPU 上下文切换开销 = 负优化。**投机解码的瓶颈是草稿质量，不是草稿速度。**
3. **内存代价**：进程私有内存 6.3 GB（草稿是整份加载而非只取头，约 +3.2 GB）；32 GB 无压力，小内存机器需留意。
4. **复现性注意（衔接 PROTOCOL §10）**：贪心（temp=0）下「开/关投机解码」的输出**不保证逐字节一致**——批式验证与逐 token 生成的 GEMM 归约顺序不同，浮点噪声会在近平局 token 上翻转 argmax（实测同题在 409 字符处 "Melancholic"↔"Calm" 分叉，其后各自保持连贯）。分布正确性不受影响（拒绝采样数学等价），但**严格重放/复现场景必须关投机解码**。
5. n-max 调参：默认 3 已最优（接受率 0.63 下 5 深链大部分被拒）。

**启用方式**：`.\start_llm.ps1 -Mtp`（agent 侧零改动，已实测工具调用链路正常）。
