# AGENTS.md —— 本仓库的协作约定（AI 助手与人类贡献者共同遵守）

## 项目一句话

从零手搓本地 agent 的学习项目：TypeScript monorepo（`packages/core` 零依赖大脑 + `apps/cli` 壳），对接本地 OpenAI 兼容引擎（MLX/llama.cpp）。文档体系见 README 与 `docs/`。

## 提交前必做（顺序执行，缺一不可）

1. **隐私检查**：`sh scripts/check-privacy.sh`（pre-commit 钩子会自动跑；规则与逃逸口见脚本头注释）。本机路径一律写 `/Users/<user>/`、`~/` 或运行时变量，硬件指纹写 `<SYSTEM_FINGERPRINT>`
2. **测试**：`pnpm test` 全绿才能提交；新增协议行为必须先补测试
3. **构建**：`pnpm build` 无错误
4. 小步提交：一个提交只做一件事，提交信息用中文说明"是什么+为什么"

## 报文捕获制度（docs/PROTOCOL.md §0、docs/TRACEABILITY.md）

- 所有抓到的引擎返回数据存原始报文（请求体+响应头+响应体），用 `captures/capture.sh`（Mac/MLX）或 `captures/capture-win.sh`（Windows/llama.cpp，均已含自动脱敏 + 自动 token 溯源）
- **每一次与 LLM 的通信，每一个 token 都必须有据可循**：溯源 = trace.jsonl 的 (seq→frame→line→byte) 三方印证原始字节；新抓取必须有 response.trace.md/jsonl，真机验收结论必须引用 trace
- 分析结论必须标注原始证据（captures/ 文件 + 行号），"反直觉"现象先存证再推理

## 学习项目原则

- 不引入框架/SDK，能手写的协议就手写（SSE、JSON Schema、递归下降解析器）
- 核心依赖零增长：`packages/core` 只允许 zod，改依赖前先在文档里论证
- 扩展点由真实需求逼出来（YAGNI），每一步都有对应的 docs/ 文档与测试

## 已知环境差异（跨平台注意）

- 项目在 macOS/Apple Silicon（MLX 引擎）与 Windows（llama.cpp 引擎）双平台开发：Mac 用 `./start_llm.sh`，Windows 用 `.\start_llm.ps1`（验收复跑 `bash scripts/acceptance-win.sh`），Windows 环境记录见 SETUP.md §八
- 代码只准用跨平台 API（禁止平台专属调用）；`.ps1` 含中文必须存 UTF-8 with BOM（PowerShell 5.1 会把无 BOM 的 UTF-8 按 GBK 解析）
- Windows 侧约定：推理引擎与模型统一放 `D:\LLM`；JSON/脚本里的 Windows 路径一律写正斜杠（反斜杠会在多层传递中被吞成非法转义，实测）
- MLX 仅限 Mac；Windows/Linux/移动端走 llama.cpp+GGUF（见 TECH_STACK.md §四）
