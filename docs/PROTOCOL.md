# 通信协议拆解：tagent 与本地 LLM 引擎的双方通信

> 基准引擎：MLX server（mlx-lm 0.31.3）｜ 抓取日期：2026-08-30
> **原始报文索引见 §9，本文所有结论均以原始数据为准（captures/）**
> 关联实现：`packages/core/src/client.ts`（每条解析规则标注了对应的原始证据）

## 0. 抓取约定（制度）

1. **所有抓到的返回数据保存原始报文**，不做美化、不截断、不重新格式化——分析可以错，原始数据不能丢
2. 每组抓取固定三件套：`request.json`（请求体原件）+ `response-headers.txt`（响应头原件）+ `response.sse / response.json`（响应体原件）
3. 抓取命令可复现：`captures/capture.sh`（模型路径在 `captures/.env.local`，不入库）
4. 新增任何协议观察（新引擎、新字段、异常报文）→ 先抓原件入 captures/，再更新本文
5. **入库前脱敏（隐私制度）**：本机用户路径一律替换为 `/Users/<user>/`（本机原件由 capture.sh 保留在本地）；`system_fingerprint` 一律替换为 `<SYSTEM_FINGERPRINT>`；模型快照的哈希目录名同样属于本机信息，一并归一到 `<user>/model`。脱敏由 capture.sh 自动完成，手工抓取也必须执行同样替换
6. **token 级溯源（制度详见 docs/TRACEABILITY.md）**：流式抓取必须附带 `response.trace.md/jsonl`（capture.sh 自动生成），每个 token 可经 (seq→frame→line→byte) 定位到原件原始字节

## 1. 一次 agent 请求的完整生命周期

```
tagent (client.ts)                          MLX server (:8081)
      │                                            │
      │ POST /v1/chat/completions  HTTP/1.0        │
      │ Content-Type: application/json             │
      │ {model, messages, tools?, stream}  ───────► │ 组装 prompt（chat template）
      │                                            │ 推理（GPU）
      │ ◄─── 200 OK + text/event-stream ────────── │
      │      （流式：SSE 帧；非流式：单个 JSON）      │
      │ 解析帧 → StreamEvent 流                     │
```

- 传输层实测为 **HTTP/1.0**（响应头 `HTTP/1.0 200 OK`，Server: `BaseHTTP/0.6 Python/3.14.6`）——不是 1.1，意味着没有 chunked 传输编码，SSE 靠连接关闭收尾
- 鉴权：无（本地服务，无 API key）；CORS 全开（server 启动日志已警告）

## 2. 请求报文拆解（原件：captures/*/request.json）

| 字段 | 必填 | 实测值/语义 | 踩坑记录 |
|---|---|---|---|
| `model` | 形式必填 | 本地模型**绝对路径**（server 按路径加载） | 传空串会报 `No such file or directory: 'config.json'`（实测 2026-08-30）；OpenAI 语义下 model 是名字，这里实际是路径 |
| `messages` | ✅ | OpenAI Chat 格式，`role/content` 四种角色 | `assistant.tool_calls` 后必须紧跟 `role:"tool"` 消息，id 配对（协议硬约束） |
| `tools` | 可选 | `[{type:"function", function:{name,description,parameters(JSON Schema)}}]` | server 端经 `--jinja` 渲染进 chat template（llama.cpp 同理） |
| `stream` | 可选 | `true`=SSE 流；缺省=单个 JSON | |
| `temperature` | 可选 | 0~2 | |
| `max_tokens` | 可选 | 生成上限；触顶时 `finish_reason:"length"` | 思考模型的计数**含 reasoning**（§5.3） |
| `chat_template_kwargs` | 可选 | 模板级参数（如 `{"enable_thinking":false}`）——llama.cpp 实测有效，MLX 侧忽略未知字段；缺省不携带 | 思考开关的正确姿势（Step 4 考据，见 §10）；tagent 经 `AgentConfig.thinking` 下发 |

## 3. 响应头拆解（原件：captures/*/response-headers.txt）

**非流式**（01/02 组）：

```
HTTP/1.0 200 OK
Server: BaseHTTP/0.6 Python/3.14.6
Content-type: application/json
Content-Length: 1175          ← 有定长
```

**流式**（03/04 组）：

```
HTTP/1.0 200 OK
Content-type: text/event-stream
Cache-Control: no-cache
                              ← 无 Content-Length（流式长度未知）
```

解析器含义：非 2xx 时 server 仍返回 JSON 错误体（读 body 抛 `LLMHttpError`）；流式响应只能靠 EOF 判断结束。

## 4. SSE 流帧结构（03/04 组原件）

流 = 一串"帧"，帧之间以空行分隔，帧内每行以 `\n` 结尾。实测共三种帧：

| 帧类型 | 语法 | 实测样例（原文） | 解析器行为 |
|---|---|---|---|
| **注释帧**（keepalive） | `: 注释` | `: keepalive 13/15` | 跳过（不以 `data:` 开头）→ client.ts handleLine 首行判断 |
| **数据帧** | `data: <JSON>` | `data: {"id":"chatcmpl-…","choices":[…]}` | JSON.parse → 提取 delta |
| **结束帧** | `data: [DONE]` | `data: [DONE]` | 置 sawDone → 收尾发 done 事件 |

原始字节细节（都是踩过的坑）：

- **数据可能被 TCP 任意切割**——一个 JSON 帧可能分两个 chunk 到达，必须在代码里按 `\n` 做行缓冲（client.ts 的 buffer 逻辑；测试用合成 chunk 验证）
- 行尾可能是 `\n` 或 `\r\n`（实现取 `\r$` 剥除）
- 流结尾若无 `[DONE]` = 连接截断，必须报错不能静默（`LLMStreamError`）

**keepalive 编号疑点（如实记录）**：03 组文件仅含 3 帧注释，编号却是 `13/15、14/15、15/15`——推测 server 在慢阶段（prompt 处理）每秒发一帧、最多 15 帧，但为何抓到的从 13 开始未考据，留待复测。**教训：报文里的任何"反直觉"都先存证再推理。**

## 5. 数据帧 JSON 解剖（以 03 组真实帧为例）

```jsonc
{
  "id": "chatcmpl-f952ba71-…",              // 本次生成的会话 ID（流内各帧相同）
  "system_fingerprint": "0.31.3-0.32.2-macOS-…",  // mlx-lm/mlx-metal 版本 + 硬件指纹
  "object": "chat.completion.chunk",         // 流式固定为 .chunk；非流式为 chat.completion
  "model": "/Users/<user>/model",             // 又是路径（制度占位符，原始报文见 captures）
  "created": 1788087906,                     // Unix 秒
  "choices": [{
    "index": 0,                              // 单对话固定 0（多候选生成才有 1,2…）
    "finish_reason": null,                   // 中间帧恒 null；末帧见 §5.3
    "delta": { … }                           // ★ 增量载荷，三种形态见 §5.1
  }]
  // 注意：流式帧里【没有】usage 字段（实测 grep=0）；非流式才有 → done.usage 可选
}
```

### 5.1 delta 的三种形态（整个协议的核心）

| 形态 | 实测原文 | 解析产物（client.ts） |
|---|---|---|
| 思考增量 | `"delta": {"role": "assistant", "reasoning": "Thinking"}` | `reasoning-delta` |
| 正文增量 | `"delta": {"content": "秋风"}` | `text-delta` |
| 工具调用 | `"delta": {"role":"assistant","tool_calls":[{"function":{"name":"get_weather","arguments":"{\"city\": \"北京\"}"},"type":"function","id":"48c8…","index":0}]}` | `tool-call-delta` |

字段差异对照（**同一引擎的不同接口都有差异，解析器必须双认**）：

| 字段 | MLX 流式 | MLX 非流式 | llama.cpp 非流式（此前实测） |
|---|---|---|---|
| 思考内容 | `delta.reasoning` | `message.reasoning` | `message.reasoning_content`（原件：captures/05） |
| usage | 无 | 有（含 `prompt_tokens_details.cached_tokens`） | 有 |
| tool_calls[].index | 有（流式必需，分片合并依据） | 无 | 有（流式） |

### 5.2 工具调用的 id 与 index

- `id`（如 `"48c898a3-…"`）：模型为本轮调用生成的唯一 ID；**回填工具结果时 `tool_call_id` 必须用它**，一对一生成一条 `role:"tool"` 消息
- `index`：一次响应可含多个 tool_calls（AC-4 场景），流式分片靠 index 归位合并
- `arguments` 是**字符串**（内嵌 JSON），不是对象——模型逐 token 生成 JSON 文本的历史设计；parse 必须在拼完之后
- MLX 实测把整个 tool_call 一帧发完；OpenAI 云端会把 arguments 碎成几十个分片——**合并逻辑不能假设单帧完整**，测试用合成数据覆盖分片场景

### 5.3 finish_reason（末帧，delta 为空 `{"role":"assistant"}`）

| 值 | 语义 | agent 循环含义 |
|---|---|---|
| `stop` | 自然说完 | 循环结束，出最终回答 |
| `tool_calls` | 模型要调工具 | 执行工具、回填、进入下一轮 |
| `length` | max_tokens 触顶（01/03 组实测命中） | **危险状态**：回答被截断，Step 2 错误处理要显式提示用户 |

**`length` 触顶的重要教训（03 组 fixture 实录）**：`max_tokens` 的计数范围**包含思考 token**。开启思考模式时若 max_tokens 给小了，模型会在思考阶段就被截断（03 组：150 token 全部耗在 reasoning，正文 0 token）。思考模型必须给足生成预算。

## 6. 非流式响应解剖（01/02 组原件）

单个 JSON，结构与流式末态等价：

- `choices[0].message` = `{role, content, reasoning?, tool_calls?}`（流式是把 message 拆成 delta 流）
- `usage`（02 组实测）：`{prompt_tokens: 274, completion_tokens: 47, total_tokens: 321, prompt_tokens_details: {cached_tokens: 273}}`
  - **cached_tokens: 273/274 = 99.6% prompt 缓存命中**——MLX prompt cache 实锤生效，多轮 agent 对话（前缀复用）因此几乎免重复计算。这是 agent 场景选流式+复用前缀的经济学基础
  - 补充实测（会话前期）：`prompt_per_second: 160`（首轮）vs 下降到 72——缓存 miss/hit 的直接体现

## 7. 解析器行为映射总表（client.ts ↔ 原始证据）

| 字节模式（原文样例） | 证据文件 | client.ts 行为 |
|---|---|---|
| `: keepalive 13/15` | 03/response.sse | 忽略（非 data: 行） |
| `data: {…delta.reasoning…}` | 03 | emit `reasoning-delta` |
| `data: {…delta.content…}` | 03 | emit `text-delta` |
| `data: {…delta.tool_calls…}` | 04 | emit `tool-call-delta`（原样透传，合并在 loop） |
| `data: {…finish_reason:"stop"/"tool_calls"/"length"…}` | 01/02/03/04 | 记入状态，不发事件 |
| `data: [DONE]` | 03/04 | emit `done{finishReason, usage?}` |
| 流结束无 `[DONE]` | （构造） | throw `LLMStreamError` |
| HTTP 500 | （构造） | 重试 1 次后 throw `LLMHttpError` |
| HTTP 4xx | （构造） | 立即 throw，不重试 |

## 8. 引擎差异备忘（跨引擎兼容性，llama.cpp 接入时对照）

> 2026-08-31 Windows 迁移实测补全（llama.cpp b10621 + GGUF，原件：captures/07~10，agent 代码零改动跑通六场景）。

| 差异点 | MLX server | llama.cpp server（b10621 实测） |
|---|---|---|
| 思考字段 | `reasoning` | `reasoning_content` → client.ts 双认（原件：captures/05、09） |
| **默认温度** | **0.0** | **0.8** ← 最大暗坑：不显式带 temperature 时同请求行为完全不同（详见 §8.1） |
| tool_call id 格式 | UUID | 非固定长度随机串（captures/05、10 实录） |
| tool call 解析 | 内置 | 需 `--jinja`（b10621 已默认开启） |
| 流式 usage | 无 | **也无**（不主动请求 `stream_options` 时；末帧带非标准 `timings` 字段，client 忽略即可）——修正旧表"有"的记载（07~10 实测 grep=0） |
| 流式 tool_call 分片 | 单帧完整（04 组） | **逐 token 碎片**（10 组：name+首字符一帧，arguments 其余 4 帧）→ 合并逻辑不能假设单帧完整，与 OpenAI 云端行为一致 |
| keepalive 注释帧 | 有（`: keepalive n/m`） | 无（07~10 实测 grep=0） |
| 首帧 delta | `{"role":"assistant",...}` | `{"role":"assistant","content":null}`（null 安全：pickStr 类型守卫忽略） |
| `system_fingerprint` | 版本+OS+硬件指纹（敏感，入库脱敏） | `b10621-c1d0e7a00`（仅 build+commit，非机器指纹，可留原件） |
| model 回显 | 原样路径 | 会把正斜杠归一为反斜杠回显（`D:/` → `D:\`） |
| HTTP 版本 | 1.0（连接关闭收尾） | 1.1 + Keep-Alive |
| **历史中非法 JSON 的 tool_call args** | 容忍（原样存储） | **HTTP 500**：服务端渲染模板时重新解析 assistant.tool_calls.arguments，截断片段 `{"city":"北` 直接炸（Step 9 守卫实测，captures/step9-guards/ac10-3-first-attempt）——回填前须把传输层 args 改写为合法 `{}`，原始字节挪进 tool 结果文本保存 |
| 默认端口 | 8080（将改 9931，启动日志警告） | 8080（两引擎都由启动脚本固定 8081） |

### 8.1 默认温度暗坑（跨引擎对照实验最重要的参数）

MLX 默认 temp=0.0、llama.cpp 默认 temp=0.8。实测（2026-08-31，同请求仅差默认温度）：
- temp=0（或 MLX 默认）：简短中文思考（69 字）→ 干净 tool call，一次成功（对照探针）
- temp=0.8（llama.cpp 默认）：思考切换为冗长英文 "Thinking Process: 1. Analyze the Request…"，300 token 预算耗尽仍无 tool call，finish=length（captures/07/08 初版实录，已重抓覆盖前可查 git 历史）

**规则：任何跨引擎对照实验必须在请求里显式写 temperature**（抓取脚本已固定 temp=0）。

## 9. 原始报文索引

| 目录 | 场景 | 大小 |
|---|---|---|
| `captures/01-nonstream-chat/` | 非流式纯对话（含思考，finish=length） | request 253B + headers + 1175B |
| `captures/02-nonstream-tools/` | 非流式工具调用（finish=tool_calls，usage 缓存命中 99.6%） | request 469B + 953B |
| `captures/03-stream-chat/` | 流式纯对话（147 数据帧 + keepalive） | 66179B |
| `captures/04-stream-tools/` | 流式工具调用（22 数据帧，tool_call 单帧完整） | 9809B |
| `captures/06-determinism/` | 确定性实验：同请求 × 温度 0.7/0 × 各两次 | 4 份响应 |
| `captures/07-win-llamacpp-nonstream-chat/` | Windows/llama.cpp 非流式对话（temp=0，reasoning_content） | 三件套 |
| `captures/08-win-llamacpp-nonstream-tools/` | Windows/llama.cpp 非流式工具调用（temp=0 一次成功） | 三件套 |
| `captures/09-win-llamacpp-stream-chat/` | Windows/llama.cpp 流式对话（无 keepalive，首帧 content:null） | 三件套 + trace |
| `captures/10-win-llamacpp-stream-tools/` | Windows/llama.cpp 流式工具调用（tool_call 逐 token 分片，5 帧） | 三件套 + trace |
| `captures/win-ac-1~6/`、`win-ac-5b/` | Windows 引擎六场景验收存证（见 docs/ACCEPTANCE.md 附录） | session + transcript + stdout + trace |
| `packages/core/fixtures/*.sse` | 测试夹具（与 03/04 同源，供解析器测试） | — |

复现方式：MLX 组 `./captures/capture.sh`（需先 `./start_llm.sh -d`）；llama.cpp 组 `bash captures/capture-win.sh`（需先 `.\start_llm.ps1 -Detach`）。

## 10. 复现性与确定性（captures/06 实证）

"可复现"要分层回答（实验：同一请求各发两次，temp 0.7 与 0 各一组）：

| 层 | 结论 | 证据 |
|---|---|---|
| **请求层（prompt 级逐条复现）** | ✅ 完全可复现：captures/*/request.json 即完整输入，一条 curl 重放即得同请求 | captures/ 全部 |
| **响应层（默认温度 temp=0.7）** | ❌ 不可逐字复现：两次同请求 reasoning 内容不同——LLM 采样有随机性，这是原理性的，不是存证缺陷 | 06/temp0.7-run1 vs run2 |
| **响应层（temp=0）** | ✅ 两次响应的 **token 流逐字节相同**。必然不同的是服务端元数据：chatcmpl `id`、`created` 时间戳、tool_call `id`——由 server 每次生成，不属于模型输出；**llama.cpp 侧另有第 4 个：`timings`（墙钟计时）**（Windows 复测 2026-08-31，win-replay-demo） | replay-demo/run1 vs run2（MLX）；win-replay-demo/run1 vs run2（llama.cpp） |

使用规则：
- **追溯**（"这个 token 从哪来"）→ 用 trace 溯源表，永远可行，不依赖温度
- **复现**（"再跑一遍得到同样输出"）→ 请求层永远可行；响应层需 `temperature: 0`（agent 场景代价：回答多样性下降，调试协议时用，日常对话不必）
- **投机解码例外（2026-08-31 Windows/llama.cpp 实测，SETUP §8.7）**：即使 temp=0，「开/关投机解码」也不保证逐字节一致——批式验证与逐 token 生成的 GEMM 归约顺序不同，近平局 token 的贪心 argmax 可能翻转（同题 409 字符处实测分叉，各自保持连贯）。分布正确性不受影响（拒绝采样数学等价），但**严格重放场景必须关闭投机解码**（`start_llm.ps1` 不带 `-Mtp` 即可）

**待考据发现（06 组实录）**：用户消息尾部加 `/no_think` 在 Qwen3.5 + MLX server 上**未关闭思考**——80 个生成 token 全部进入 reasoning，正文为空，finish_reason=length（与 §5.3 length 教训互证）。Qwen3.5 的思考开关机制与 Qwen3 的 `/no_think` 约定不同，正确开关方式待实验（候选：chat_template_kwargs / 模板级 enable_thinking），考据后更新本节。

**跨引擎补充（2026-08-31，Windows/llama.cpp 07~10 组）**：`/no_think` 在 llama.cpp 上**同样不关闭思考**（09 组：temp=0 仍 512 token 全 reasoning）——两引擎行为一致说明这是**模型/模板层**问题而非引擎实现差异，§8.1 的温度差异才是引擎层变量。

**✅ 已考据闭环（2026-08-31，Step 4）**：`/no_think` 失效的根因是 **Qwen3.5 模板不认该消息级约定**（Qwen3 时代机制）。正确开关（llama.cpp b10621 实测，双向验证）：
1. **服务器级**：`--reasoning off` —— 思考关闭，24 token 直答同题（对照思考版 512+ token）
2. **请求级**：`chat_template_kwargs: {"enable_thinking": false/true}` —— 默认(auto)服务器上 false 关思考（reasoning=0）；off 服务器上 true 重新打开（reasoning 396 字）——**同服务器按请求切换**，tagent 的 `/think` `/nothink` 即此实现（FR-23，修复了 FR-8 的无效 `/no_think` 注入）
证据：captures/step4-thinking-ab/ 考据探针与 A/B 实验存证。
