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
| `max_tokens` | 可选 | 生成上限；触顶时 `finish_reason:"length"` | |

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
| 思考内容 | `delta.reasoning` | `message.reasoning` | `message.reasoning_content` |
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

| 差异点 | MLX server | llama.cpp server（已知） |
|---|---|---|
| 思考字段 | `reasoning` | `reasoning_content` → client.ts 双认 |
| tool call 解析 | 内置 | 需 `--jinja` 启动参数 |
| 流式 usage | 无 | 有（`timings` 额外字段） |
| 默认端口 | 8080（将改 9931，启动日志警告） | 8080 |
| HTTP 版本 | 1.0 | 1.1 |

## 9. 原始报文索引

| 目录 | 场景 | 大小 |
|---|---|---|
| `captures/01-nonstream-chat/` | 非流式纯对话（含思考，finish=length） | request 253B + headers + 1175B |
| `captures/02-nonstream-tools/` | 非流式工具调用（finish=tool_calls，usage 缓存命中 99.6%） | request 469B + 953B |
| `captures/03-stream-chat/` | 流式纯对话（147 数据帧 + keepalive） | 66179B |
| `captures/04-stream-tools/` | 流式工具调用（22 数据帧，tool_call 单帧完整） | 9809B |
| `packages/core/fixtures/*.sse` | 测试夹具（与 03/04 同源，供解析器测试） | — |

复现方式：`./captures/capture.sh`（需先 `./start_llm.sh -d`）。
