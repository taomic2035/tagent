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

## Step 3 真机验收报告（AC3-1~5，2026-08-31）

> 引擎：llama.cpp b10621 CPU ｜ 复现入口：`node scripts/kvcache-experiment.mjs`（AC3-4）、
> `bash scripts/acceptance-step3.sh`（AC3-2/3）、`node scripts/estimator-calibration.mjs`（AC3-1）

| # | 场景 | 判定 | 关键证据 |
|---|---|---|---|
| AC3-1 | 估算器校准 | ✅（含口径发现） | `step3-kvcache/estimator-calibration.md`：无工具误差 **+1%/+9%**（远优于 ±50% 标准）；带工具 -73% 是口径差非误差——`prompt_tokens` 含模板+工具 Schema 渲染（固定开销 ≈409 token ≈ 3.7 倍），预算语义 = messages 自身（已写明） |
| AC3-2 | 回合完整性 | ✅ | 单测（裁剪后无孤立 tool 消息）+ AC3-3 的 /dump 实证：脚本断言通过 |
| AC3-3 | 触发裁剪 | ✅ | `step3-ac3-3-trim/`：三问触发 1 次裁剪（**457→222** est，移除 8 条）；请求消息数序列 [2,4,6,8,10,**4**,8] 可视化双水位；对话全部完成 |
| AC3-4 | KV cache 复用 | ✅ | `step3-kvcache/experiment.md` 三段对照：**连续追加命中 0%→78%**（cache_n 0→87，每轮仅处理 ~25 新 token）；**前缀破坏骤降 26%**；**双水位裁剪后一次性付 35% 代价、下轮恢复 78%** |
| AC3-5 | 回归 | ✅ | core 48 + cli 34 全绿；无预算时行为与 Step 2 一致（零事件回归测试） |

**有含金量的观察**：

1. **双水位 vs 滑动窗口的经济学被量化**：B 段证明"每轮裁一点"每轮都付全量 prompt 处理税（CPU 上 32~39 tok/s 的处理速度是真实成本）；双水位把这笔税摊薄成偶发一次（C1 一次 35% 代价，之后回到 78% 命中）。
2. **预算口径**：`--max-context-tokens` 算的是 messages 自身；真实引擎 prompt 还要加模板+工具固定开销（2 工具 ≈ +409 token）。设预算时从引擎上下文上限（16K）倒推要扣掉这层。
3. **实验方法论**：cache 实验重跑会被 slot 暖缓存污染（实测踩坑：重跑时 A1 就有 16 命中、B 段命中 2575%）——实验脚本加 run nonce 冷启动后数据才干净。

## Step 4 真机验收报告（AC4-1~4，2026-08-31）

> 引擎：llama.cpp b10621 CPU（同一服务器，默认 auto）｜ 复现：`node scripts/thinking-ab.mjs`
> 前置考据闭环：`/no_think` 失效根因 = Qwen3.5 模板不认消息级约定；正确开关 =
> 请求级 `chat_template_kwargs.enable_thinking`（双向实证：OFF 组 0/33 有 reasoning；
> off 服务器上强制 true 重新打开 reasoning=396 字，switch-probe 存证）。

### A/B 结果（11 题 × 3 采样 × 2 组，temp=0.7）

| 维度 | 思考 ON（预算 1200） | 思考 OFF（预算 160） |
|---|---|---|
| 总成功率 | 27/33 = **82%** | 31/33 = **94%** |
| 算术（5题）/推理（3题）/工具（2题）/对照（1题） | 14/15 ｜ 7/9 ｜ 6/6 ｜ **0/3** | 13/15 ｜ 9/9 ｜ 6/6 ｜ 3/3 |
| 平均耗时 | 52.9s | **7.2s（7.3×）** |
| 平均 completion tokens | 677 | **92（7.4×）** |

### 非平凡观察（AC4-3）

1. **ON 组 6 个失败全是同一死法：思考不收敛烧穿预算**（content 为空，finish=length）——
   连「自我介绍」都能想满 1200 token（与 captures 07/09 的秋天 512 token 现象同源）。
   开放性任务上 4B 的思考没有可靠的停止机制。
2. **OFF 组 3 个失败是话没说完被 160 截断**（T4 求和题先讲公式、答案没写出来）——
   失败模式不同：OFF 输在输出预算，ON 输在思考预算。**有限预算下思考模式天然吃亏
   （它需要更多预算才能到达答案）**。
3. 本任务集（简单结构化任务）上思考**没有任何一类获益**：算术 14:13、推理 7:9、工具 6:6。
   结合 7.3× 延迟与 7.4× token 成本：**4B + 简单任务 + CPU 推理的实践配置 = 默认关思考
   （/nothink），难题再开（/think，预算给足）**。
4. 局限如实记录：3 采样粒度粗（0/33/67/100%）；任务集偏简单（无真正需要深推理的题，
   思考的潜在收益未被探测到）；两组预算不对称（160 vs 1200，但都各自触顶过）。
   Step 8（更大模型）值得复测——思考不收敛可能是 4B 特有的校准问题。

### 开关机制（AC4-1）

- 单测：kwargs 缺省不携带（请求体与旧版逐字节同形）/ 携带时正确序列化 / loop 按配置下发——全绿
- CLI：`/think` `/nothink` 切换 `AgentConfig.thinking`，移除无效的 `/no_think` 后缀注入（PROTOCOL §2/§10 同步更新）
- 回归（AC4-4）：core 50 + cli 34 全绿，默认路径与 Step 3 行为一致

## Step 5 真机验收报告（AC5-1~5，2026-08-31）

> 引擎：llama.cpp b10621 CPU ｜ 复现：`node scripts/react-vs-native.mjs`；CLI 冒烟 `--react`
> 主角是「驱动层」：同一模型同一工具，三种行动承载方式的对决。

### 三方对比（S1~S4 链式任务 × 3 采样，temp 0.7 思考关）

| 维度 | native tool_calls | react-text（经典文本） | react-json（受限解码） |
|---|---|---|---|
| 成功率 | **100%**（S1~S4 全 3/3） | 75%（S1/S3/S4 各 1 失败） | **100%**（全 3/3） |
| 平均轮次 | **2.6** | 2.3 | 3.8 |
| 平均 tokens | **129** | 171 | 224 |
| 平均耗时 | **12.3s** | 14.7s | 21.4s |

### 结论与观察（AC5-4）

1. **native tool_calls 是本栈最优**：最省（129 tok）、最快、成功率满格——协议原生行动
   承载 + 同轮并行调用（S1 双城一轮回）是文本协议做不到的。
2. **react-text 的 3 个失败全是同一死法**：首轮跳过 Action 直接作答（无 Final Answer 标记
   或直接给错答案），零样本文本协议对 4B 约束力不足——与冒烟阶段的幻觉/复读现象同源。
3. **受限解码完全救活了 ReAct**（75%→100%）：代价是 +73% token 与更多轮次（JSON 协议
   每轮只出一个动作，无并行）。**弱模型上文本协议不可用，但 JSON 协议可用**——
   格式纪律从模型挪到解码器后，同一个模型脱胎换骨。
4. 工程启示（已沉淀 [FALLBACK.md](FALLBACK.md)）：引擎有原生 tool calling 就用 native；
   没有或需要严格格式控制时，用受限 JSON 协议，**不要用自由文本协议**。

### 分项判定

| # | 判定 | 证据 |
|---|---|---|
| AC5-1 解析器 | ✅ | react.test.ts：规范/多行 JSON/尾随杂文/Final/三类畸形全过 |
| AC5-2 引擎 | ✅ | mock 剧本：act→observation→final 链、格式错误自愈、失败信封回填、触顶降级 |
| AC5-3 CLI 真机 | ✅ | `step5-react/cli-smoke/`：--react（JSON 协议）S2 链式任务 6 轮完成，28×2=56 无幻觉 |
| AC5-4 对比实验 | ✅ | `step5-react/summary.md` + 36 样本存证（上表） |
| AC5-5 回归 | ✅ | core 62 + cli 34 全绿；native 路径行为与 Step 4 一致 |

## Step 6 真机验收报告（AC6-1~5，2026-08-31）

> 引擎：llama.cpp b10621 CPU ｜ 证据：`captures/step6-memory/`（四会话 session+transcript + 事实库快照）

| # | 判定 | 证据 |
|---|---|---|
| AC6-1 存储单测 | ✅ | store.test.ts：append/load 跨实例往返、召回排序（相关>无关）、0 分不返回、坏行容错 |
| AC6-2 工具单测 | ✅ | registry 路径（信封契约继承）；remember/recall zod 校验 |
| AC6-3 跨会话真机 | ✅ | 会话1 模型主动 `remember {"content":"我喜欢喝美式咖啡，不加糖","tag":"preference"}` → /exit；**新进程**会话2 主动 `recall`（matched=1，score=3）→「您喜欢喝美式咖啡，不加糖」 |
| AC6-4 取舍分析 | ✅ | 见下表 |
| AC6-5 回归 | ✅ | core 66 + cli 34 全绿；无 --memory 时行为与 Step 5 一致 |

### 记忆注入策略取舍（AC6-4，引用 Step 3 cache 实测）

| 策略 | 召回相关性 | cache 前缀 | 实现状态 |
|---|---|---|---|
| **工具召回**（recall 按需） | 高（按问题评分） | 追加式，前缀稳定（78% 命中不受影响） | ✅ 主路径 |
| **静态注入**（--memory N，启动时最近 N 条） | 低（不分问题） | 会话内稳定 ✓ | ✅ 辅助路径 |
| 逐问动态注入 system | 高 | **每轮破坏**（Step 3 B 段实证：78%→26%） | ❌ 反模式，不实现 |

**实测观察**：即使开了静态注入，模型回答偏好问题时仍**主动选择 recall 工具**（会话3）——
工具召回的相关性优势是模型自己"用脚投票"的结果；静态注入的实际价值是背景兜底（模型没想起
调工具时仍有信号）。两条路径互补。

**记忆×预算交互**：注入块在 system prompt 内，天然被估算器计入（FR-37）；
事实库无上限增长时，靠 `--max-context-tokens` 的双水位裁剪兜住（Step 3 机制复用，无新代码）。
