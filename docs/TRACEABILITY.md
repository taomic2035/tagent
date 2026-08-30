# 溯源制度：所有通信原数据留存 + token 级溯源

> 版本：v1.0 ｜ 2026-08-30
> 核心要求：**每一次与 LLM 的通信和答复，每一个 token 都有据可循**
> 上游：docs/PROTOCOL.md（协议拆解）、captures/（原始报文）

## 1. 存证单元（什么算"一次通信"）

一次 LLM 调用 = 一个存证单元 = 一个目录，内含：

| 文件 | 内容 | 生成方式 |
|---|---|---|
| `request.json` | 请求体原件（原样，未经格式化） | 抓取时保存 |
| `response-headers.txt` | 响应头原件 | `curl -D` |
| `response.sse` / `response.json` | 响应体原件（流式/非流式） | `curl -o` |
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

## 3. 工具：scripts/trace-sse.mjs

- 输入：任一 `response.sse` 原件
- 输出：同目录 `response.trace.md`（人读表格）+ `response.trace.jsonl`（机器索引）
- 输出确定性：不含时间戳，重跑结果逐字节相同（git 友好，可复核）
- 用法：`node scripts/trace-sse.mjs <response.sse>`

## 4. 覆盖范围（何时必须留痕）

| 场景 | 要求 |
|---|---|
| 协议调研 / 踩坑排查（如 captures/01~04） | 手动抓取时必须走 capture.sh（含自动溯源） |
| Step 6 起的真机验收（AC-1~6） | 每个验收场景一个存证单元，验收结论引用 trace |
| Step 5 起的 CLI 运行时 | **每次 CLI 会话的每次 LLM 调用**自动落盘为存证单元（`logs/sessions/<ts>/`，格式同 §1），transcript JSONL 与存证单元一一对应 |
| 对照实验（思考开关/换模型） | 每组实验独立存证单元，PROTOCOL.md/SETUP.md 引用 |

## 5. 隐私约束（与 PROTOCOL.md §0.5 的关系）

溯源文件由原始报文派生，继承同一条脱敏规则：入库前 `/Users/<user>/`、`<SYSTEM_FINGERPRINT>` 占位化。trace-sse.mjs 不引入新的敏感字段（它只搬运原始数据的位置与内容）。
