# 需求清单

> 版本：v1.0（Step 1 范围）｜ 日期：2026-08-30
> 上游文档：[TECH_STACK.md](../TECH_STACK.md) ｜ 下游文档：[ARCHITECTURE.md](ARCHITECTURE.md)、[DESIGN.md](DESIGN.md)

## 1. 项目目标

在无 agent 框架的前提下，用 TypeScript 从零实现一个可用的终端 agent（tagent），通过亲手实现每个环节来理解 agent 的核心原理。**本清单限定 Step 1（最小 agent loop）范围**，Step 2-8 的需求在各自阶段再行增补。

用户与使用场景：开发者本人在终端与本地 LLM（MLX server，OpenAI 兼容接口）进行多轮对话，agent 能自主决定调用工具、执行工具、基于结果继续推理，最终给出回答。

## 2. 功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| FR-1 | LLM 对话客户端 | 通过 OpenAI 兼容 HTTP API（`/v1/chat/completions`）与本地引擎通信；`baseUrl`/`model` 可配置 | P0 |
| FR-2 | 流式输出 | 解析 SSE 流式响应，token 级实时渲染到终端；思考内容（`reasoning`）与正文分开渲染 | P0 |
| FR-3 | 工具定义体系 | 用 zod 定义工具的名称、描述、参数 schema，自动生成 JSON Schema 传给模型；工具执行函数与定义绑定 | P0 |
| FR-4 | tool call 解析与执行 | 解析模型返回的 `tool_calls`（含流式分片累积），校验参数（zod safeParse），执行工具，把结果以 `role: "tool"` 消息回填 | P0 |
| FR-5 | Agent 主循环 | 多轮"请求→工具调用→结果回填"循环，直到模型给出最终回答或达到迭代上限 | P0 |
| FR-6 | 内建工具（Step 1） | ① `get_weather`：城市天气查询（本地 mock 数据，返回 JSON）② `calculate`：四则运算表达式求值（禁止 eval，自实现解析） | P0 |
| FR-7 | 终端交互 | readline 交互式会话；斜杠命令：`/exit` 退出、`/reset` 清空上下文、`/tools` 列出工具、`/dump` 导出本轮原始消息 | P0 |
| FR-8 | 思考模式开关 | 支持 `/nothink` 切换：在用户消息尾部注入/移除 `/no_think` 标记 | P1 |
| FR-9 | 会话记录 | 每轮完整消息序列追加写入 JSONL 文件（`logs/transcript-*.jsonl`），供事后逐帧检查 agent 行为 | P1 |
| FR-10 | 基础错误处理 | 工具执行失败/参数非法时，不抛出崩溃，而是将错误信息作为工具结果回填给模型使其自我纠正；HTTP 请求失败重试 1 次 | P1 |
| FR-11 | 调试视图 | `--debug` 启动：打印每轮请求/响应的原始 JSON（学习时观察 prompt 组装与模型输出） | P1 |

## 3. 非功能需求

| ID | 需求 | 说明 | 优先级 |
|---|---|---|---|
| NFR-1 | core 零依赖 | `packages/core` 运行时依赖仅允许 zod；不得引入 HTTP 库（用内置 `fetch`）、不得引入框架 | P0 |
| NFR-2 | 类型安全 | TypeScript `strict: true`；工具参数类型由 zod 推导，编译期与运行期双重校验 | P0 |
| NFR-3 | 平台可移植 | 只使用跨平台 API（node:readline、node:fs、fetch），不依赖 macOS 专属能力；Windows/Linux 可直接运行 | P0 |
| NFR-4 | 可观测性 | agent 的每一轮决策（发了什么、模型回了什么、执行了什么）都可通过 transcript/`--debug` 完整还原 | P0 |
| NFR-5 | 测试性 | agent 循环逻辑可在无真实 LLM server 的情况下测试（mock 的 LLMClient 按脚本回放 tool call 序列） | P0 |
| NFR-6 | 性能 | core 自身每轮开销（消息拼装、解析、执行）< 10ms；端到端延迟由引擎决定，不在此约束 | P2 |
| NFR-7 | 引擎无关 | 同一份 core 代码可对接 MLX server 与 llama.cpp server，无需修改 | P1 |

## 4. Step 1 验收标准

全部用真实 MLX server（127.0.0.1:8081）手动验收：

| ID | 场景 | 通过标准 |
|---|---|---|
| AC-1 | 「北京今天天气怎么样？」 | 调用一次 `get_weather`（参数 `{"city":"北京"}`），基于 mock 结果给出自然语言回答 |
| AC-2 | 「3.7 乘以 12 再减 8.2 等于多少？」 | 调用 `calculate`，回答中的数值与工具返回完全一致（36.2） |
| AC-3 | 「你好，介绍一下你自己」 | **不调用任何工具**，直接流式回答（验证模型没有工具滥用） |
| AC-4 | 「对比一下北京和上海的天气」 | 同一轮出现两次 `get_weather` 调用（或两个循环轮次），最终汇总对比 |
| AC-5 | 构造无效参数（如 `get_weather("火星")`） | agent 不崩溃；错误信息回填后模型向用户说明或换参数重试 |
| AC-6 | `/dump` 导出 | JSONL 中可逐帧看到：用户消息 → assistant(tool_calls) → tool 结果 → assistant(最终回答) 的完整链路 |

## 5. 明确不做（Out of Scope，Step 1）

- 长期记忆 / 会话持久化恢复（Step 6）
- 上下文长度裁剪策略（Step 3；Step 1 依赖引擎 16K 上下文 + 短会话）
- 联网类工具（web search / HTTP 请求工具）
- 子 agent、并行任务编排（Step 7）
- 流式过程中的中途取消（AbortController 预留接口但 UI 不暴露）
- 任何 GUI；任何云 API 对接（只对接本地引擎）
- 认证、多用户、部署
