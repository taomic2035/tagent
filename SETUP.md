# 本地 Agent 开发环境：选型、搭建与实测数据

> 记录日期：2026-08-30 ｜ 目标：在 Mac 上从零搭建可用的本地 LLM 服务，作为手写 agent 学习的推理后端

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
