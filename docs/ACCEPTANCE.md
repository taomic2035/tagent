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

## 附录：引擎迁移复验（Windows / llama.cpp，2026-08-31）

> 开发机 Mac(M5/MLX) → Windows(i7-14700/llama.cpp CPU)，六场景全量复跑。
> 复现入口：`bash scripts/acceptance-win.sh`（需先 `.\start_llm.ps1 -Detach`）
> **结论：agent 代码零改动**（`packages/`、`apps/` 无一行变更，仅 `--model` 传不同的模型路径）——NFR-7「同一份 core 代码可对接两引擎」实证，跨平台 NFR-3（Windows 可直接运行）实证，`pnpm build`+`pnpm test`（51 项）Windows 原生全绿。

| # | 场景 | 判定 | 关键证据（captures/ 下） | 与 Mac 侧差异 |
|---|---|---|---|---|
| AC-1 | 北京天气 | ✅ | `win-ac-1-beijing-weather/` | 无（2 轮，回答引用 mock 数值 28°C/40%/55） |
| AC-2 | 四则计算 | ✅ | `win-ac-2-calculate/` | 无（`calculate {"expression":"3.7 * 12 - 8.2"}` → 36.2，回答数值一致） |
| AC-3 | 自我介绍（无工具滥用） | ✅ | `win-ac-3-self-intro/` | 无（0 次工具调用） |
| AC-4 | 双城对比 | ✅ | `win-ac-4-two-cities/` | 无（同轮 get_weather(北京)+get_weather(上海)，逐 token 分片按 index 归位——比 MLX 更碎的分片被正确合并） |
| AC-5 | 火星（错误路径） | ✅* | `win-ac-5-mars-error/`、`win-ac-5b-mars-forced/` | 见下注 |
| AC-6 | /dump 全链路导出 | ✅ | `win-ac-6-dump/` | 无 |

**AC-5 注（行为差异，如实记录）**：本引擎/量化组合下模型三次都**选择不调用** unsupported 城市——未强制（`win-ac-5-mars-error`：读工具描述后向用户如实说明）、强制要求调用（`win-ac-5b-mars-forced`：推理出「必须调用」与「工具不支持」矛盾，拒绝执行并解释）、换不明显的无效城市「莫斯科」（同样拒绝，未归档）。三个变体均不崩溃、无幻觉编造。错误信封（`{"ok":false,"error":...,"availableCities":[...]}`）的回填与自愈路径由单元测试覆盖（apps/cli/src/builtin-tools/weather.test.ts），模型侧未踩入；对比 Mac 侧该量化会直接调用。**这是同模型不同量化/温度下的行为差异样本**，留作 Step 4（思考模式实验）与 Step 8（模型能力对比）的分析素材。

**性能**：CPU 后端生成 11.6~13.0 tok/s（agent 六场景可用，长思考偏慢），详见 SETUP.md §八。

## Step 2 真机验收报告（AC2-1~4，故障注入法）

> 验收日期：2026-08-31 ｜ 引擎：llama.cpp b10621（MTP 投机解码开启；行为验收不受 §10 复现例外影响）
> 复现入口：`bash scripts/acceptance-step2.sh`（需先 `.\start_llm.ps1 -Detach`）
> 方法论：**故意搞坏一次**——`TAGENT_FAULTS` 把 get_weather 按剧本搞坏，观察 agent 的失败与恢复

| # | 场景 | 判定 | 关键行为（证据：captures/step2-*） |
|---|---|---|---|
| AC2-1 | 工具挂死（`:hang`） | ✅ | 挂死 5s 超时 → 重试再挂 5s → 耗尽信封（`retriesUsed=1`）回填；CLI 渲染 `✔ 10322ms（重试 1 次后仍失败）`；模型如实说明"临时故障，请稍后再试"，**不挂死不崩溃** |
| AC2-2 | 瞬时故障自愈（`:flaky:1`） | ✅ | registry 内部重试成功，模型**一轮**拿到干净数据（`ok=true`，tempC=28）——LLM 对失败零感知，省下一整轮重调 |
| AC2-3 | 重试耗尽（`:down`） | ✅ | 两次尝试均注入故障 → 信封带 `[faults:down]` + `retriesUsed=1`；模型不再重调，转向如实说明 |
| AC2-4 | 迭代上限降级（`--max-iterations 1`） | ✅ | 第 1 轮同轮执行北京+上海两次调用后触顶 → 降级请求**无 tools 字段**（call-002/request.json 实证）+ 系统注入提示 → 模型基于已有数据给出正经的双城对比终答（而非 Step 1 的报错死掉） |
| 回归 | 单测 + Step 1 六场景 | ✅ | core 37 + cli 31 全绿；无 policy 工具行为与 Step 1 完全一致（policy 全部可选） |

**有含金量的观察**：
- FR-13 分类设计的实证价值：`:down` 场景若对确定性失败也重试，只会白等两轮；若对瞬时失败不重试（Step 1 行为），AC2-2 就要模型自己再调一轮（多花一次 LLM 请求 + 一轮延迟）。分类正确时两类场景都是最优路径。
- 降级的协议级保证优于 prompt 恳求：call-002 的请求体里根本没有 `tools` 字段，模板层就没了工具段——模型"想调也没得调"，`finish_reason` 不可能是 `tool_calls`。
- AC2-1 的 10.3s 工具耗时全部花在两次 5s 超时等待上——生产上 `timeoutMs` 应按工具的真实延迟分布设定（本实验故意放宽以便观察）。
