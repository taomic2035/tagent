# 溯源制度：所有通信原数据留存 + token 级溯源

> 版本：v1.0 ｜ 2026-08-30
> 核心要求：**每一次与 LLM 的通信和答复，每一个 token 都有据可循**
> 上游：docs/PROTOCOL.md（协议拆解）、captures/（原始报文）

## 1. 存证单元（什么算"一次通信"）

一次 LLM 调用 = 一个存证单元 = 一个目录，内含：

| 文件 | 内容 | 生成方式 |
|---|---|---|
| `request.json` | 请求体原件（原样，未经格式化） | 抓取时保存 |
| `response-headers.txt` | 响应头原件 | `curl -D`（CLI session 单元此项为 fetch 解析重建——fetch 拿不到头字节原件，头字节级证据以 captures 三件套为准） |
| `response.sse` / `response.json` | 响应体原件（流式/非流式，**原始字节**） | `curl -o`；CLI session 单元由 wire 记录器在 fetch 层 tee（apps/cli/src/wire.ts，2026-08-31 复盘升级——旧 recorder 重建帧导致字段归一化失真，已废弃） |
| `response.trace.md` | **token 级溯源表（人读）** | `scripts/trace-sse.mjs` 自动生成 |
| `response.trace.jsonl` | **token 级溯源索引（机读）** | 同上 |

## 2. 溯源公式（"有据可循"的准确定义）

对任何一个生成的 token（seq=N）：

```
trace.jsonl 第 N 行
  → 记录了 kind(类型) / frame(SSE 数据帧序号) / line(原文件行号) / byte(字节偏移) / text(内容)
  → 用 line+byte 可在 response.sse 原件中打开该帧的原始字节
  → 原始字节与 trace.text 完全一致（逐字节可核对）
```

即：**token 的内容、顺序、原始位置三方互相印证，无一来自记忆或转述。**

## 3. 工具：scripts/trace-sse.mjs 与 scripts/replay.mjs

**trace-sse.mjs**（token 溯源）
- 输入：任一 `response.sse` 原件
- 输出：同目录 `*.trace.md`（人读表格）+ `*.trace.jsonl`（机器索引）
- 输出确定性：不含时间戳，重跑结果逐字节相同（git 友好，可复核）
- 用法：`node scripts/trace-sse.mjs <response.sse>`

**replay.mjs**（prompt 重放——「prompt 可再复现」的落地）
- 输入：任一存证单元的 `request.json`（captures/ 或 logs/sessions/）
- 行为：原样（或 `--temp/--model/--base-url` 覆盖）重新发送，落盘为新的完整存证单元（含 trace）
- 模型路径为脱敏占位符时自动从 `captures/.env.local` 恢复
- 确定性重放：`--temp 0`（PROTOCOL.md §10：temp=0 下响应逐字节可复现）
- 用法：`node scripts/replay.mjs <request.json> --temp 0 --out /tmp/rep1`

## 4. 覆盖范围（何时必须留痕）

| 场景 | 要求 |
|---|---|
| 协议调研 / 踩坑排查（如 captures/01~04） | 手动抓取时必须走 capture.sh（含自动溯源） |
| Step 6 起的真机验收（AC-1~6） | 每个验收场景一个存证单元，验收结论引用 trace |
| Step 5 起的 CLI 运行时 | **每次 CLI 会话的每次 LLM 调用**自动落盘为存证单元（`logs/sessions/<ts>/`，格式同 §1：wire 记录器 fetch 层 tee 原始字节 + 内联生成 trace），transcript JSONL 与存证单元一一对应 |
| 对照实验（思考开关/换模型） | 每组实验独立存证单元，PROTOCOL.md/SETUP.md 引用 |

## 5. 隐私约束（与 PROTOCOL.md §0.5 的关系）

溯源文件由原始报文派生，继承同一条脱敏规则：入库前 `/Users/<user>/`、`<SYSTEM_FINGERPRINT>` 占位化。trace-sse.mjs 不引入新的敏感字段（它只搬运原始数据的位置与内容）。


## 5.5 机器裁决（Step 15 起，验收的第三条腿）

transcript 不仅是人看的日志——`scripts/verify-task.mjs` / `verify-acceptance.mjs` 重放
事件流跑完成谓词（core/predicate.ts：toolCalled/toolResultOk/finalAnswers/all），
**任务完成由机器断言而非 LLM 自证**。证据引用具体事件（调用 id/结果信封/终答片段），
与 §2 的溯源公式衔接：谓词消费的正是存证里的同一事件流。
另一制度注记：captures/win-ac-* 为**滚动证据**（每步回归刷新），某步代码对应的
证据在 git 历史（`git log -- captures/win-ac-*`）——报告引用以"验收当次"为准。

## 6. 复现口径（2026-08-31 复盘确立）

- **token 级追溯**：seq→frame→line→byte 三方印证，对 captures 三件套与 CLI session 单元（wire 记录器）均成立
- **prompt 级复现（任务级口径）**：同一任务，agent 跑一遍 + 人照存证手敲重走一遍（手写请求、手工执行确定性工具、手工回填），任务完整完成即达标——实证见 `captures/hand-replay-demo/`
- **字节级复现（更强口径，仅实验用）**：temp=0 + 关投机解码下模型输出 token 流逐字一致（win-replay-demo）；必然不同的是服务端元数据（id/created/tool_call id/timings）
