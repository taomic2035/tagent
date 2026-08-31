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
| 模型 | Qwen3.5-4B（4bit 量化） | 原生 function calling，内建思考模式 |
| 推理引擎 | MLX（mlx-lm） | Apple Silicon 优化；llama.cpp 因 Qwen3.5 新架构未优化（15 tok/s）被实测淘汰，保留作底层学习材料 |
| 接口 | OpenAI 兼容 HTTP | `http://127.0.0.1:8081/v1` |
| 硬件 | MacBook Air M5 / 32GB | 实测生成 38 tok/s（server 路径） |

选型过程、实测数据、踩坑记录详见 [SETUP.md](SETUP.md)；跨平台架构决策详见 [TECH_STACK.md](TECH_STACK.md)。

## 快速开始

```bash
# 1. 启动本地推理服务（首次需先下载模型，见 SETUP.md 第三节/第八节）
./start_llm.sh -d              # macOS（MLX）
.\start_llm.ps1 -Detach        # Windows（llama.cpp + GGUF，见 SETUP.md §八）
curl http://127.0.0.1:8081/health

# 2. 构建并运行 agent（MODEL 路径见 captures/.env.local）
pnpm build
node apps/cli/dist/main.js --model "$(cat captures/.env.local | cut -d= -f2)"
# 会话内：/tools 看工具 · /dump 导出上下文 · /reset 清空 · /exit 退出

# 3. 重放任一历史 prompt（token 级复现，见 docs/ACCEPTANCE.md）
node scripts/replay.mjs captures/ac-2-calculate/session/call-001/request.json --temp 0

# 4. 复跑真机验收（六场景，自动存证+脱敏）
zsh scripts/acceptance.sh           # macOS（MLX 引擎）
bash scripts/acceptance-win.sh      # Windows（llama.cpp 引擎，Git Bash）
```

## 学习路线

- [x] **Step 1** 最小 agent loop：while 循环 + 工具定义 + 解析 `tool_calls` + 执行 + 结果回填上下文（TypeScript，`packages/core` 零依赖手搓）——**已验收，见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)**
- [ ] **Step 2** 多工具与错误处理：工具执行失败的重试与降级策略
- [ ] **Step 3** 上下文管理：对话历史裁剪、KV cache 复用对 agent 的意义
- [ ] **Step 4** 思考模式实验：同一模型 thinking 开/关下任务成功率对比
- [ ] **Step 5** ReAct 与规划：思考-行动-观察显式分离
- [ ] **Step 6** 记忆机制：短期记忆与长期记忆的实现与取舍
- [ ] **Step 7** 子 agent 与编排：任务分解、结果聚合
- [ ] **Step 8** 模型能力对比：4B → 9B/27B，观察能力上限对 agent 行为的影响

## 目录结构

```
tagent/
├── SETUP.md          # 环境搭建全记录：选型、实测数据、踩坑（§八 = Windows 迁移）
├── TECH_STACK.md     # 技术选型报告：语言、架构、跨平台路线
├── docs/
│   ├── REQUIREMENTS.md   # 需求清单（Step 1 范围，含验收标准）
│   ├── ARCHITECTURE.md   # 架构设计：模块划分、数据流、扩展点
│   ├── DESIGN.md         # 方案设计：类型、接口、算法、测试（可直接照写代码）
│   ├── PROTOCOL.md       # 通信协议拆解：与 LLM 引擎双方通信逐字段分析
│   ├── TRACEABILITY.md   # 溯源制度：每次通信全量存证，每个 token 有据可循
│   ├── ACCEPTANCE.md     # Step1 真机验收报告：AC-1~6 + token 级复现实证
│   └── WINDOWS-ENV.md    # Windows 环境对齐总结：清单、速查、与 Mac 差异
├── captures/         # 原始报文存证：请求体 + 响应头 + 响应体（抓取脚本可复现）
├── start_llm.sh      # 一键启动本地推理服务
├── LICENSE           # MIT
└── models/           # 模型权重（不入库，见 SETUP.md）
```

## 开发约定

- **提交前隐私检查**：`sh scripts/check-privacy.sh`（本机路径/凭据/硬件指纹扫描，规则见脚本头注释）。克隆后启用自动检查：
  ```bash
  git config core.hooksPath scripts/hooks   # 让版本化的 pre-commit 钩子生效
  ```
- 协作规则（含 AI 助手）见 [AGENTS.md](AGENTS.md)：报文脱敏制度、测试先行、core 零依赖等

## License

[MIT](LICENSE)
