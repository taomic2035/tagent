# tagent

从零手搓一个本地 Agent，用于系统性学习 agent 原理：不用任何 agent 框架，只靠「开源 LLM + 推理引擎 + 手写循环」把 agent 的核心机制逐一实现。

## 核心理念

- **不引入 agent 框架**（LangChain / AutoGen 等），agent 的每个环节（工具调用解析、上下文管理、错误处理、记忆）都亲手实现，才能真正理解框架替你做了什么
- **推理引擎与 agent 代码解耦**：只依赖 OpenAI 兼容 HTTP 接口，换引擎不改一行代码
- **每一步都故意搞坏一次**：删掉错误处理、换小模型、关掉思考模式，观察 agent 怎么失败——这是理解 agent 最快的路径

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| Agent 语言 | **TypeScript**（Node/React Native/RNOH） | 零换语覆盖 Mac/Win/Linux/Android/鸿蒙，详见 [TECH_STACK.md](TECH_STACK.md) |
| 模型 | Qwen3.5-4B（4bit 量化） | 原生 function calling，内建思考模式；双平台同款量化 |
| 推理引擎 | **双平台各选最优**：Mac = MLX；Windows = llama.cpp | OpenAI 兼容接口完全一致，**agent 代码零改动**（NFR-7 已六场景实证）；llama.cpp CPU 11.9 tok/s，开 MTP 投机解码 +20~40% |
| 接口 | OpenAI 兼容 HTTP | `http://127.0.0.1:8081/v1`（两平台同端口） |
| 硬件 | MacBook Air M5 / 32GB ｜ HP 台式机 i7-14700 / 32GB | MLX 38 tok/s ｜ llama.cpp CPU 11.9（MTP 后 17.6~21.3）tok/s |

选型过程、实测数据、踩坑记录详见 [SETUP.md](SETUP.md)（§八 = Windows 迁移全记录）；双平台环境差异速查见 [docs/WINDOWS-ENV.md](docs/WINDOWS-ENV.md)。

## 快速开始

```bash
# 1. 启动本地推理服务（首次需先下载模型，Mac 见 SETUP.md 第三节 / Windows 见第八节）
./start_llm.sh -d               # macOS（MLX）
.\start_llm.ps1 -Detach -Mtp    # Windows（llama.cpp；-Mtp 开投机解码，快 20~40%）
curl http://127.0.0.1:8081/health

# 2. 构建并运行 agent（MODEL 路径见 captures/.env.local，不入库）
pnpm build
node apps/cli/dist/main.js --model "$(cat captures/.env.local | cut -d= -f2)"
# 会话内：/tools 看工具 · /dump 导出上下文 · /reset 清空 · /exit 退出

# 3. 重放任一历史 prompt（token 级复现，见 docs/ACCEPTANCE.md；
#    注意：重放须用无投机解码的服务，见 PROTOCOL.md §10）
node scripts/replay.mjs captures/ac-2-calculate/session/call-001/request.json --temp 0

# 4. 复跑真机验收（六场景，自动存证+脱敏）
zsh scripts/acceptance.sh           # macOS（MLX 引擎）
bash scripts/acceptance-win.sh      # Windows（llama.cpp 引擎，Git Bash）
```

## 学习路线

- [x] **Step 1** 最小 agent loop：while 循环 + 工具定义 + 解析 `tool_calls` + 执行 + 结果回填上下文（TypeScript，`packages/core` 零依赖手搓）——**已验收，见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)**
- [x] **Step 2** 多工具与错误处理：工具执行失败的重试与降级策略——**已验收（故障注入法，AC2-1~4），见 ACCEPTANCE.md Step 2 章节**：超时/瞬时重试/重试耗尽信封/迭代触顶的无 tools 协议级降级
- [x] **Step 3** 上下文管理：对话历史裁剪、KV cache 复用——**已验收（AC3-1~5）**：回合完整+双水位裁剪、KV cache 三段实证（追加命中 78%/破坏骤降/裁剪后恢复）、估算器校准与口径发现
- [x] **Step 4** 思考模式实验——**已验收（AC4-1~4）**：请求级开关落地（修复 /no_think 失效）；A/B 实证 4B+简单任务上思考净负收益（82% vs 94%，7.3× 慢）——「不收敛烧预算」与「截断没答完」两种失败模式入档
- [x] **Step 5** ReAct 与规划——**已验收（AC5-1~5）**：双协议 ReAct 引擎（经典文本 + 受限解码 JSON）；三方实证 native 100% / react-json 100% / react-text 75%——弱模型上格式纪律必须由工程兜底（沉淀 docs/FALLBACK.md）
- [x] **Step 6** 记忆机制——**已验收（AC6-1~5）**：跨会话长期记忆（追加式事实库 + remember/recall 工具 + 手写 bigram 召回）、/save /load 会话持久化、--memory 静态注入；注入策略取舍表入档（逐问动态注入=反模式）
- [x] **Step 7** 子 agent 与编排——**已验收（AC7-1~4）**：delegate 工具（子 agent 即工具：独立上下文/递归锁/摘要信封）；同轮多委托=协议原生并行分解；直做 vs 委托成本对比（2.7× 调用买上下文隔离）
- [ ] **Step 8** 模型能力对比：4B → 9B/27B，观察能力上限对 agent 行为的影响

## 目录结构

```
tagent/
├── SETUP.md          # 环境搭建全记录：选型、实测数据、踩坑（§八 = Windows 迁移+MTP 实测）
├── TECH_STACK.md     # 技术选型报告：语言、架构、双平台引擎路线
├── start_llm.sh      # 引擎启动（Mac/MLX）
├── start_llm.ps1     # 引擎启动（Windows/llama.cpp，-Mtp 投机解码）
├── docs/
│   ├── REQUIREMENTS.md   # 需求清单（Step 1 ✅ + Step 2 增补，含验收标准）
│   ├── ARCHITECTURE.md   # 架构设计：模块划分、数据流、扩展点
│   ├── DESIGN.md         # 方案设计：类型、接口、算法、测试（可直接照写代码）
│   ├── PROTOCOL.md       # 通信协议拆解：双引擎差异实测（§8）与复现规则（§10）
│   ├── TRACEABILITY.md   # 溯源制度：每次通信全量存证，每个 token 有据可循
│   ├── ACCEPTANCE.md     # 真机验收报告：AC-1~6 + Windows 引擎复验附录
│   ├── WINDOWS-ENV.md    # Windows 环境对齐总结：清单、速查、与 Mac 差异
│   └── FALLBACK.md       # Agent 兜底工程模式：弱模型失败的系统级对策（Step 1~5 沉淀）
├── captures/         # 原始报文存证：01~06（MLX）、07~10（llama.cpp）、ac-*/win-ac-*（验收）
├── scripts/          # 验收（acceptance*.sh）、抓包（capture*.sh）、溯源/重放、隐私检查
├── packages/core/    # agent 大脑（零依赖，仅 zod）
├── apps/cli/         # 终端壳
└── LICENSE           # MIT
# 模型权重不入库：Mac 在 ~/.cache/huggingface，Windows 统一放 D:\LLM\models
```

## 开发约定

- **提交前隐私检查**：`sh scripts/check-privacy.sh`（本机路径/凭据/硬件指纹扫描，规则见脚本头注释）。克隆后启用自动检查：
  ```bash
  git config core.hooksPath scripts/hooks   # 让版本化的 pre-commit 钩子生效
  ```
- 协作规则（含 AI 助手）见 [AGENTS.md](AGENTS.md)：报文脱敏制度、测试先行、core 零依赖等

## License

[MIT](LICENSE)
