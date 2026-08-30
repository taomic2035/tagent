# Step 1 真机验收报告（AC-1~6）

> 验收日期：2026-08-30 ｜ 引擎：MLX server（mlx-lm 0.31.3）+ Qwen3.5-4B-4bit
> 复现入口：`zsh scripts/acceptance.sh`（自动跑六场景、归档存证、脱敏）
> **每条结论均引用 captures/ 原始证据**（制度：AGENTS.md、docs/TRACEABILITY.md）

## 验收结论总览

| # | 场景 | 判定 | 关键证据（captures/ 下） |
|---|---|---|---|
| AC-1 | 北京天气 | ✅ 通过 | `ac-1-beijing-weather/` |
| AC-2 | 四则计算 | ✅ 通过 | `ac-2-calculate/` |
| AC-3 | 自我介绍（无工具滥用） | ✅ 通过 | `ac-3-self-intro/` |
| AC-4 | 双城对比（多工具） | ✅ 通过 | `ac-4-two-cities/` |
| AC-5 | 火星（错误回填自愈） | ✅ 通过 | `ac-5-mars-error/` |
| AC-6 | /dump 全链路导出 | ✅ 通过 | `ac-6-dump/` |
| 复现 | temp=0 重放 token 级一致 | ✅ 通过 | `replay-demo/` |

## 逐条明细

### AC-1 天气查询（单工具）
- transcript：`tool-call get_weather {"city":"北京"}` → `tool-result`（含 tempC=28 等 mock 数据）→ 2 轮 final。
- 回答中的天气数值与 mock 库完全一致（模型未编造数据）。
- token 溯源：`ac-1-beijing-weather/session/call-001/response.trace.jsonl`（seq→frame→line→byte 可核）。

### AC-2 数学计算
- transcript：`tool-call calculate {"expression":"3.7*12-8.2"}` → 结果 36.2 → 回答含 **36.2** ✅。
- 模型把自然语言「3.7 乘以 12 再减 8.2」正确翻译成表达式，递归下降求值器（apps/cli/src/builtin-tools/calculate.ts）完成计算。

### AC-3 不滥用工具
- transcript：**0 次 tool-call**，46 个 text-delta 直接回答 ✅。
- 验证了 system prompt「无需工具的日常对话直接回答」规则生效。

### AC-4 多工具编排
- transcript：同轮 `get_weather(北京)` + `get_weather(上海)` 两次调用（乱序分片按 index 归位，Step 4 不变量验证）→ 汇总对比回答 ✅。

### AC-5 错误回填与自愈（最有含金量的一条）
- 第一遍（未存档，行为观察）：模型读到工具描述中的城市列表，**主动拒绝无意义调用**直接说明——好行为，但没锻炼错误路径。
- 第二遍（存档，明确要求必须调用）：`tool-call get_weather {"city":"火星"}` → 工具返回业务失败信封 `{"ok":false,"error":"no weather data...","availableCities":[...]}` → **agent 未崩溃**，模型读取错误与可用列表后向用户如实解释 ✅。
- 证据：`ac-5-mars-error/transcript.jsonl`（tool-result 事件含完整错误信封）。
- 注意双层 ok：外层（执行链）true + 内层（业务）false —— 见 apps/cli/src/builtin-tools/weather.test.ts 注释。

### AC-6 全链路导出
- `/dump` 输出消息链：`system → user → assistant(tool_calls) → tool(tool_call_id 配对) → assistant(最终)` ✅。
- 证据：`ac-6-dump/stdout.txt`（/dump 段落）与 `transcript.jsonl`。

## token 级复现验证（replay-demo/）

对 `ac-2-calculate/session/call-001/request.json` 以 `--temp 0` 重放两次：

| 指标 | run1 vs run2 |
|---|---|
| 帧数 | 56 = 56 |
| reasoning / content / tool_call 帧 | 52/1/2 = 52/1/2 |
| 归一化差异帧（剔除 id/created/tool_call.id） | **0** |
| tool_call arguments 拼接 | 逐字节相同（`{"expression": "3.7*12-8.2"}`） |

**结论：同一 prompt 在 temp=0 下重放，模型输出的 token 流逐字节一致**；必然不同的是三个服务端生成的元数据（chatcmpl id、created 时间戳、tool_call id）——它们不是模型输出。此精化已回写 PROTOCOL.md §10。

重放命令（任何人可复跑）：
```bash
node scripts/replay.mjs captures/ac-2-calculate/session/call-001/request.json --temp 0 --out /tmp/r1
node scripts/replay.mjs captures/ac-2-calculate/session/call-001/request.json --temp 0 --out /tmp/r2
```

## 「极简但完整」最终盘点

- core 运行时依赖：**zod 一个**（零依赖红线守住）
- CLI 运行时依赖：@tagent/core + zod；无框架、无 SDK、无 chalk/ink
- 手写的"轮子"：SSE 解析器、JSON Schema 生成（经 zod）、递归下降求值器、ANSI 渲染、存证/溯源/重放工具链
- 代码量：core ~600 行 + cli ~400 行（不含测试）；测试 51 项全绿
- 完整能力：流式对话、思考渲染、工具调用、错误自愈、多工具、迭代上限、会话存证、token 溯源、prompt 重放
