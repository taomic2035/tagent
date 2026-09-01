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

## Step 10 真机验收报告（AC11-1~4，2026-09-01，Steering 打断通道）

> 来源：SURVEY.md 缺口 2（pi steer/followUp + hermes redirect 保前缀）。
> 语义：**注入不硬中断**——生成期间用户输入进队列，在下一次 LLM 请求前以 user
> 消息追加（前缀只增不改，KV cache 命中不受损）；第 1 轮不注入。
> 证据：captures/step10-steering/（stdout + transcript JSONL，steering 事件可回放）。

| # | 判定 | 证据 |
|---|---|---|
| AC11-1 注入生效（单测） | ✅ | round 2 的 llm-request 在 tool 结果后含注入 user 消息 + steering 事件；round 1 永不注入（take 零调用）；前缀只增不改（r1 是 r2 的前缀，deepEqual 断言） |
| AC11-2 真机改向 | ✅ | 任务"查北京天气"→round 1 调 get_weather 北京→注入"改成查上海天气"→round 2 实际改调 get_weather 上海→3 轮完成（ac11-2，transcript steering 事件实录） |
| AC11-3 followUp 余量 | ✅ | 单轮即完的任务 + 期间输入的"现在换成回复两个字：收到"→ 自动转为下一轮提问，两次完成、零丢弃（ac11-3，transcript 2 finals/0 steering） |
| AC11-4 回归 | ✅ | 六场景验收全过（win-ac-* 刷新归档）；116 项单测全绿（core 75 + cli 41） |

### 设计取舍记录

- **去掉 `rl.pause()`**：原实现生成期间直接拒绝输入（agent 在错误方向跑满 maxIterations
  才停）——本地 CPU 推理一轮几十秒，打断通道的体验价值比云端更高
- **nudge 与 steering 相邻共存**：守卫 nudge（round 末）与 steering 注入（round 首）
  可能产生两条相邻 user 消息——协议允许（模板拼接渲染），保留两条使注入来源在
  transcript 事件里各自可溯（guard vs steering 事件区分）
- **不做硬取消**：中断进行中的流/工具是取消语义（AbortSignal），留待并发步——本步
  诚实记录边界（REQUIREMENTS §15）；runReAct 不接 steering（需要时再开）

## Step 11 真机验收报告（AC12-1~4，2026-09-01，摘要压缩）

> 来源：SURVEY.md 缺口 3。阶梯管线：相邻去重（字节级）→ 确定性降级（最近一条工具
> 结果受保护）→ LLM 摘要（user 原文钉住 + anchor 兜底 + 划算预检）→ 裁剪兜底。
> 层次语义：**压缩优先（保信息），丢弃兜底（保预算）**。证据：captures/step11-compaction/
> （含摘要调用的 request/response.sse 存证，temp=0+思考关）。

| # | 判定 | 证据 |
|---|---|---|
| AC12-1 阶梯触发 | ✅ | 单测 82 项：不超预算零动作；降级可独立达标则零 LLM 调用；划算预检不过不开调用；仍超才摘要 |
| AC12-2 用户消息钉住 | ✅ | 单测：摘要产物中被压轮 user 消息与原文 deepEqual 逐字节一致；语气词/错别字原样（§16.1 裁决落地） |
| AC12-3 兜底链 | ✅ | summarize 异常 → 压缩不动历史（丢弃交上层 trim）；钉住后仍超 → trim 兜底以 ⚡ 事件可见 |
| AC12-4 真机+回归 | ✅ | 七轮会话预算 600：🗜 631→404（摘要 4 轮，摘要调用报文入 wire 存证），最终总结轮模型准确复述五城全部数据（关键信息在摘要中存活）；六场景回归全过；123 项单测全绿 |

### 验收中发现并修正的三个真问题（全部真机实证）

1. **摘要越压越大（327→362）**：钉住的 user 原文占大头、被压工作小时，摘要产物比
   原文还大——白花一次 LLM 调用。修正 = **划算预检**（产物上限可估：前导+摘要 150 字
   + anchor ≈ 340 token，注意占位符必须用 CJK——估算器对英文按 1/4 折算，'x'.repeat
   会低估 4 倍）；预估不小于原文就不调 LLM、不动作（丢弃交给 trim 以正确事件可见）。
2. **兜底丢弃冒充压缩（🗜 事件三个计数全 0）**：压缩函数内部吃掉了 trim，让"遗忘"
   以"压缩"的面目出现——违反可观测诚实。修正 = **compactMessages 只压缩不丢弃**，
   返回值可能仍超预算，loop 的既有 trim 检查自然接手并发 context-trimmed 事件。
3. **Qwen 模板禁止非头部 system 消息（HTTP 500）**：摘要消息放中间直接炸
   `raise_exception('System message must be at the beginning')`——与 Step 9 的非法
   args 500 同族的模板层验证，已入 PROTOCOL §8。修正 = 摘要消息用 user 角色 +
   （系统注入：…）标注，与 nudge/steering 注入惯例统一。

### 设计取舍记录

- **"最近一条工具结果"受降级保护**（而非"最后一轮"）：单轮多回合任务里全部结果
  同属一轮，按轮保护会把降级整体禁死（loop 集成测试实证的缺陷）——按条保护语义刚好
- **摘要输入从原文取**（降级会砍掉尾部标识符）：anchor 才能抽到 D:/LLM/... 这类路径
- **摘要调用走同一 client**：wire 存证自动覆盖（temp=0+思考关）；aux 模型分层留待多模型环境
- 复现边界（如实）：摘要文本本身是生成物，temp=0 下贪心可字节级复现（关 MTP 时），
  但结构（钉住 user + 注入摘要 + kept）与事件序列可稳定复现

## Step 12 真机验收报告（AC13-1~4，2026-09-01，并行工具 + 互斥键队列，调研路线收官）

> 来源：SURVEY.md 缺口 4（调研驱动四步的最后一步）。pi 的设计取来：
> 默认并行 + 源顺序回填 + file-mutation-queue 写竞态序列化（泛化为互斥键）。
> 证据：captures/step12-parallel/

| # | 判定 | 证据 |
|---|---|---|
| AC13-1 并行收益 | ✅ | 单测：60ms+10ms 双工具总耗时 < 110ms（max 而非 sum）；fast 先完成但事件/回填按源序（transcript 确定性保留） |
| AC13-2 同键串行 | ✅ | 单测：同键时间线 `start-a,end-a,start-b,end-b` 零重叠；异键两个 start 先于任一 end；同键失败不断链（信封契约 + 队列吞异常） |
| AC13-3 真机多调用 | ✅ | "一次查三城天气"：4B 一帧发出 3 个 get_weather（transcript 实证全在 round 1），并行执行、配对回填、汇总成表完成 |
| AC13-4 回归 | ✅ | 128 项单测全绿（core 87 + cli 41）；六场景验收全过；单工具批次行为与 Step 11 一致（FR-67） |

### 设计取舍记录

- **事件按源序不按完成序**：pi 把"完成即发"当特性，我们选确定性——事件流是 transcript
  存证的物理基础，可复现性优先于实时感（吞吐收益已经拿到，显示乱序无增益）
- **互斥键而非文件路径**：pi 的 canonical path 队列泛化为 `Tool.serialize?: string`——
  文件路径只是键的一种取值；校验段（未知名/JSON/schema）不进队列（纯函数无需互斥）
- **真实接线**：memory 写工具（remember）声明 `memory-store` 键——JSONL 追加写的并发
  交错是真实风险，不是为演示造需求（FR-66）
- 边界（如实）：互斥键只管"同 registry 内"的并发；delegate 子 agent 的写不经过父
  registry 队列（子 registry 独立实例），跨 agent 写竞态留待真需要时再议

### 调研驱动路线收官总结（Step 9~12）

SURVEY.md §6 建议路线四步全部真机验收落地，每步都带回真机实证的新知识：

| 步 | 落地 | 沉淀的新知识 |
|---|---|---|
| 9 循环守卫 | 三件套 + guard 事件 | llama.cpp 重解析历史 tool_call args（非法即 500） |
| 10 steering | 注入通道 + followUp | 相邻双 user（nudge×steering）协议合法 |
| 11 摘要压缩 | 阶梯管线 + 预检 | 摘要可能越压越大（需划算预检）；丢弃不得冒充压缩；Qwen 模板禁非头部 system |
| 12 并行+队列 | 源序回填 + 互斥键 | 单轮多回合任务里"按轮保护"会禁死降级（Step 11 集成测试发现，此处同源） |

调研时以为缺的"grace call"实读代码确认已有（触顶降级即等价物）——**调研结论与代码
实况对齐后再动手**的纪律在四步中全程生效。插空项（skills 渐进披露/完成谓词/
压缩后引导包/硬取消 AbortSignal）留待真实需求逼出（YAGNI）。

## Step 13 真机验收报告（AC14-1~4，2026-09-01，严谨性修订与真实采样）

> 背景：用户指出"学习为主，务必实事求是，不是完成任务"。自查暴露四类问题
> （拍板未问/验收水分/已知瑕疵/二手转述），三项用户裁决全部执行。
> 证据：captures/step13-guard-sampling/（真实引擎零注入）+ 既有 win-ac-* 刷新。

| # | 判定 | 证据 |
|---|---|---|
| AC14-1 usage 修复 | ✅ | client timings 回退（prompt=cache_n+prompt_n）+ 单测；真机 CLI 从恒 0 变为 `prompt 1856 + 生成 151 tokens` |
| AC14-2 user 绝不丢 | ✅ | 单测 89 项：溢出 → error 事件 + user 一条不少 + 零 LLM 请求；正常路径 user 全保；绝望降级兜住"单调用对+小预算"死锁 |
| AC14-3 瑕疵四件 | ✅ | ReAct 生成期输入显式警告；check-all.sh 顺序执行非零退出 + pre-commit 拦截构建失败；SURVEY 六条核查（5 属实 + 1 路径修正，附录二） |
| AC14-4 真实采样 | ✅ | 三实验 16 任务 + 8 探针全跑完，结论如下（含"未发生"） |

### 守卫真实采样结论（E1/E2/E3，scripts/guard-sampling.mjs）

| 实验 | 结果 | 校准结论 |
|---|---|---|
| E1 空响应（10 日常任务） | **0 次触发** | 4B 日常分布不自然产生空响应——空响应守卫防的是低频/条件性故障（特定温度/模板/引擎状态），保留但非热点 |
| E2 复读诱发（6 任务） | **1 次触发**（t6"两种方式算平方根并反复验算"） | **复读是真实自然失败**：诱发类任务 1/6、日常 0/10——重复检测守卫防的是真问题；REPEAT_WARN=3/STOP=5 在真实样本下未被误触（日常任务零误报） |
| E3 截断形态（8 探针，max_tokens 40-80） | **0 次 length**：全部 finish=tool_calls 且 args 完整 | 反直觉：短工具调用在极小窗口内也完整生成，**length 截断不在此分布出现**；真实风险集中在思考开启+复杂生成（Step 4 已实证 640 烧穿）——length 守卫的适用边界=紧预算+思考场景 |

诚实修正：Step 9 验收时"守卫三件套"的表述暗示三类失败同频——真实数据显示三者
频率差异巨大（复读真实、空响应罕见、截断需特定条件）。守卫保留（成本低、各自
防住明确的失败形态），但文档不再暗示它们是同级威胁。

### trim 语义修订记录（user 绝不丢，FR-69/70）

三版演进，每版都被测试逼出真缺陷（学习价值高于结果）：
1. 轮工作版（丢轮内工作保 user）→ 单轮多回合任务死循环（轮长不变）
2. 线性扫描 + 保最后 2 单元 → 两单元场景全保护死锁（拒续）
3. 终版：单元级丢弃（调用对/assistant 文本为单元）+ 保最近 1 单元 + 绝望降级
   （最近 tool 结果也可降级——消息保留≠丢弃）+ 纯 user 超限才真正拒续
低水位承诺在钉住语义下从"保证"降级为"尽力"（user 总量可能超低水位），如实记载。
