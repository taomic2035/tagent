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

## Step 7 真机验收报告（AC7-1~4，2026-08-31）

> 证据：`captures/step7-delegate/`（直做 vs 委托对照 + README 行为学观察）

| # | 判定 | 证据 |
|---|---|---|
| AC7-1 单测 | ✅ | delegate.test.ts：子终答回传、递归锁（子 registry 无 delegate → 未知工具信封兜底）、父上下文无子细节泄漏、子 messages 无父对话 |
| AC7-2 真机委托 | ✅ | delegated/：父同轮并行 2×delegate → 子各 3 轮（weather×2+calculate）→ 聚合「广深组更热 3°C」正确 |
| AC7-3 隔离与成本 | ✅ | 直做 3 次调用 vs 委托 8 次（~2.7×）；父上下文 2 条摘要信封 vs 4 条过程消息——隔离是为复杂任务买的空间，简单任务不值得 |
| AC7-4 回归 | ✅ | core 66 + cli 37 全绿；无 --delegate 时行为与 Step 6 一致（delegate 不注册） |

**过程失误与修正（如实记录）**：本步曾因构建校验的 grep 模式写错（`error: ` 匹配不上
tsc 的 `error TS`）连续漏检构建失败——`memoryInject`/`delegate` 两个字段静默缺失，
Step 6 的 `--memory` 注入当时实为死代码（验收恰靠 recall 工具通过而未被察觉）。已修复
（字段补齐 + 构建校验改为检查退出码），并回验：注入横幅/system prompt 注入/delegate
注册全部实际生效。教训入 FALLBACK 检查清单：「验证要用退出码，不要用文本匹配」。

## Step 8 真机验收报告（AC8-1~4，2026-08-31，学习路线收官）

> 9B = Qwen3.5-9B-UD-Q4_K_XL（5966MB，llama-bench tg 8.39 tok/s = 4B 的 71%）。
> 方法：复用 Step 4/5 羻具原样重跑，采样降为 2/题（CPU wall-clock 所限，粒度 0/50/100%，如实）。
> 证据：`step8-ac9b-six/`、`step8-thinking-ab-9b/`、`step8-react-9b/`

| # | 判定 | 证据 |
|---|---|---|
| AC8-1 基准+回归 | ✅ | SETUP §8.8 基准表；六场景验收 9B 全过 |
| AC8-2 思考 A/B | ✅ | 见下表——**9B 思考组 68% 比 4B 的 82% 更差** |
| AC8-3 三方驱动 | ✅ | **react-text 75%→100%**，格式纪律随规模解决 |
| AC8-4 综合结论 | ✅ | 三条能力上限→行为变化的结论全部有存证 |

### 4B vs 9B 对照总表

| 实验 | 4B | 9B | 结论 |
|---|---|---|---|
| 思考 ON 成功率 | 82% | **68%** | ① 不收敛随规模**加剧**（更大模型思考更啰嗦，有限预算下更吃亏：9B ON 组推理类 3/6，烧穿样本 reasoning 长达 3900 字） |
| 思考 OFF 成功率 | 94% | 95% | 直答模式两代模型同样可靠 |
| react-text 成功率 | 75% | **100%** | ② 格式纪律是能力问题——9B 零样本文本协议一次不失败（4B 的三种死法消失） |
| native / react-json | 100% / 100% | 100% / 100% | ③ 工程兜底的价值不随模型变强而消失：受限解码两代都满格，native 两代都最优（9B 上仍最省 116 tok/2.4 轮） |
| AC-5 火星谨慎拒绝 | 拒绝 | 拒绝 | 跨规模不变（Mac/MLX 的调用行为是量化/引擎异类） |
| 生成速度 | 11.9 tok/s | 8.39 tok/s | 能力上限的代价是 29% 速度 |

### 收官判断（学习路线全八步的终极一课）

能力上限改变的是**模型的自律边界**（格式纪律 75%→100%），不改变**工程原则**：
思考预算要给足或默认关（越大的模型越需要）、native tool calling 恒为最优驱动、
受限解码在任何规模都是可靠性的免费保险。「模型升级」与「壳兜底」是互补关系，
不是替代关系——这正是 FALLBACK.md 总纲在两代模型上的实证。

## R3 移动瘦客户端真机验收报告（AC9-1~5，2026-09-01）

> 真机：华为 Mate 40 Pro（Android 12），adb reverse tcp:8081 连 Windows/llama.cpp（Qwen3.5-4B）。
> 证据：`captures/step9-mobile-*.png`（4 张）+ `D:/LLM/llama_server.log.err` 服务器日志（7 次请求完成）
> + 云端视觉模型（qwen3.7-plus）逐字读屏复核。agent 代码零改动——第三种壳语言直接复用同一协议。

| # | 判定 | 证据 |
|---|---|---|
| AC9-1 管道 | ✅ | 手机发 "hello"，服务器侧 `total time = 16176.46 ms / 232 tokens`；共 7 次请求全部完成往返 |
| AC9-2 中文多轮 | ✅ | 三道中文挑战题连续往返；第 2 题 prompt eval 仅 27 tok = KV cache 前缀命中（历史累积、非重发） |
| AC9-3 防过度思考 | ✅ | 同题 A/B 见下表——**关思考快 11 倍且答对，开思考把渲染线程压垮** |
| AC9-4 视觉核验 | ✅ | 4 张截图经独立视觉模型逐字读屏：用户消息、思考灰斜体、复选框状态、无 "null" 残留全部如实 |
| AC9-5 环境归还 | ✅ | ADBKeyboard 用后 `ime set` 还原百度输入法 |

### AC9-3 防过度思考 A/B（同题：strawberry 里有几个 r？）

| 思考 | 生成 token | 耗时 | 结果 |
|---|---|---|---|
| ON | 1251 | 90.0 s | 内耗：1224 个 reasoning 增量把手机主线程压垮（见 AC9-3 修复记） |
| OFF | **131** | **7.9 s** | **答对**：逐字母数出 3 个 r（131 tok 里含逐字母清单） |

同一题省 9.5 倍 token、快 11 倍且答对——FALLBACK.md §1.6「开关落在协议层」的移动端实证：
`chat_template_kwargs.enable_thinking: false` 一行字段，比任何 prompt 恳求都可靠。

### 三个真机坑与修复（按发现顺序，全部存证可溯）

1. **`optString` 把 JSON null 变 "null" 字面量**：llama.cpp 首帧 delta 常带
   `"reasoning_content": null`，Android org.json 的 `optString` 对 JSONObject.NULL
   返回字符串 `"null"` → 屏幕渲染 `tagent> nullOkay, ...`。视觉核验发现（对比 chat.png
   与 e2e.png），修复 = `isNull()` 守卫（`jsonText` 助手）。
2. **逐 delta 全量重排压垮主线程**：每 token 一次 `setText` 触发 ScrollView 全量重排，
   O(n²)——1224 个 reasoning 增量后 `uiautomator` 连 accessibility 树都取不到
   （`null root node`），用户后续点击延迟数十秒才补发。修复 = 增量入缓冲、
   120ms 批量 flush、每批一次 `setText`（FR-50）。
3. **adb 自动化输入的坑**：`input text` 不支持中文且空格转义因设备而异（华为上
   `%s` 不生效）；坐标随软键盘弹出漂移（发送键 y 2628→1689，点击落空即静默）。
   修复 = ADBKeyboard B64 广播注中文 + 每次 dump 动态解析控件中心坐标。

### 观察与边界（如实）

- 思考 ON 的 1251 tok 中 1224 是 reasoning：**弱模型的「过度思考」既是成本问题也是可用性问题**
  （移动端 90 秒无响应）；「防止过度思考」是 agent 的本职，不是可选项
- 服务器 prompt eval 27 tok ≠ 历史丢失：那是 KV cache 命中后的增量——证据链要看
  `prompt eval` 与 `timings.cache_n` 两处，别只看一处下结论
- v1 不含工具循环/持久化/HTTPS（REQUIREMENTS §13 边界）；`usesCleartextTraffic` 仅限
  adb reverse 局域网场景

## Step 9 真机验收报告（AC10-1~4，2026-09-01，循环守卫）

> 来源：docs/SURVEY.md 调研驱动的第一个补强步。守卫对"不抛错但也不干活"的模型失败设防：
> 空响应（发呆）、复读（相同工具调用）、max_tokens 截断（残缺调用）。
> 方法：LLM 层故障注入（TAGENT_LLM_FAULTS，壳层装饰器合成"坏模型"流）——复现不赌真模型抽风；
> 放行轮走真实引擎（Qwen3.5-4B @ llama.cpp）。证据：captures/step9-guards/（stdout + transcript JSONL）。

| # | 判定 | 证据 |
|---|---|---|
| AC10-1 空响应 | ✅ | ac10-1：注入 2 次空响应 → 2 条 guard 事件 + 2 条 nudge 入 messages → 真引擎接管，4 轮完成（transcript 20KB） |
| AC10-2 重复 | ✅ | ac10-2：注入 5 批相同调用 → 第 1~4 批执行（⚠ 前两轮无警告）、第 3/4 批附警告注入、第 5 批不执行回填配对结果 → 降级终答完成 |
| AC10-3 length | ✅ | ac10-3：截断调用未执行（registry 零执行）→ 回填错误（含原始字节片段）→ 模型完整重发 `get_weather {"city":"北京"}` → 3 轮完成 |
| AC10-4 回归 | ✅ | 六场景验收（acceptance-win.sh）守卫默认开启下全过，win-ac-* 已刷新归档；113 项单测全绿（core 72 + cli 37） |

### 验收中发现的新引擎差异（已入 PROTOCOL §8）

**llama.cpp 对历史中非法 JSON 的 tool_call args 返回 HTTP 500**：守卫回填后重发请求时，
服务端渲染模板会重新解析 assistant.tool_calls.arguments——截断片段 `{"city":"北` 直接炸
（首跑实录：ac10-3-first-attempt-llamacpp-500）。OpenAI/MLX 容忍此形态。
对策：回填前把传输层 args 改写为合法 `{}`，原始字节片段挪进 tool 结果文本（溯源不丢）。
这是"存证要保原始字节、传输要保协议合法"两全的实例。

### 设计取舍记录

- **nudge/警告都以 user 消息入档**：真实发生的上下文注入必须进 messages（不变量 1），且保 role 交替与缓存前缀
- **空响应守卫自设上限（3 次）**：守卫本身也要兜底——nudge 无限重试就是把发呆换成死循环
- **重复检测用批次签名**（name+键排序参数）：同工具不同参数是正常行为（翻页），整批相同才算复读，误报优先级低于漏报
- **触顶降级（Step 2）即 grace call**：调研时以为缺"预算收尾调用"，实读代码确认 degradeOnCap 无 tools 终答已是其等价物——调研结论与代码实况对齐后再动手
