# 第 1 章 引擎与观测窗口：一直讲到推理内部

> 本章目标：跑起本地推理服务并完成第一次对话（实操半天），但本章真正的分量
> 在五节"深入一层"：**token 与 tokenizer、推理的两阶段、KV cache 的因果结构、
> 量化把 4B 压进 2.5GB 的办法、采样与 temperature**。学完本章，引擎日志的
> 每一个数字你都知道它从哪里来——这是全书所有实验的观测窗口。

---

## 1.1 为什么本地跑

三个理由按分量排：**零成本试错**（全书要跑上百次实验）；**隐私**；
**观测窗口**——本地引擎把云端 API 替你藏掉的东西全暴露了：KV cache 命中数、
逐 token 延迟、prompt 处理与生成的分离计时。本书一半的知识来自盯着这些数字。
代价是慢（CPU 上约 12 token/秒）——慢是特性：它逼你对每一步精打细算，
这是调云端学不到的肌肉。

## 1.2 实操：下载与启动

**引擎 llama.cpp**（ggml-org/llama.cpp）：GitHub Releases 下
`llama-cpu-win-x64.zip`，解压到 `D:\LLM\llama.cpp`（约定：推理相关一切放
`D:\LLM`；Mac：`brew install llama.cpp`）。

**模型**：Qwen3.5-4B 的 4bit 量化版（搜 `Qwen3.5-4B` + `UD-Q4_K_XL`，约 2.5GB，
ModelScope/HuggingFace），放 `D:\LLM\models\`。**4B** = 40 亿参数：能可靠完成
工具调用的下限——够聪明能干活，够蠢会把每种失败演给你看（第 3/4 章的教材）。
完整路径记作 `D:/LLM/models/<文件名>.gguf`——**正斜杠**：反斜杠在 JSON 里是
转义符，多层传递会被吞成 `D:LLM`（真机实录，第 3 章有现场）。

`D:\LLM\start-llm.ps1`（UTF-8 with BOM 保存，否则中文注释乱码）：

```powershell
$model = "D:/LLM/models/<你的模型文件名>.gguf"
D:\LLM\llama.cpp\llama-server.exe `
  --host 127.0.0.1 --port 8081 `
  -m $model `
  --jinja `
  --reasoning-format deepseek
```

| 参数 | 作用 | 不加会怎样 |
|---|---|---|
| `--host 127.0.0.1 --port 8081` | 只监听本机 8081 | 默认 8080 且可能监听公网 |
| `--jinja` | 用模型自带 chat template 渲染对话 | **tool_calls 完全不工作**（1.7 节讲透为什么） |
| `--reasoning-format deepseek` | 思考内容放 `reasoning_content` 字段 | 思考混在正文里无法分流 |

> **引经据典**｜pi `packages/coding-agent/docs/llama-cpp.md`
> pi 的 llama.cpp provider 同样明文要求服务端 `--jinja` 才有工具调用，另立家规
> "does not silently unload models and never deletes model files"。工业项目与
> 我们踩同一条坑。

启动验证：

```powershell
.\start-llm.ps1                       # 约 3 秒后 "server is listening"
curl http://127.0.0.1:8081/health     # 另开终端 → {"status":"ok"}
```

## 1.3 第一次对话与逐字段精读

`first-chat.json`（temperature 固定 0，1.6 节讲为什么）：

```json
{
  "model": "D:/LLM/models/<文件名>.gguf",
  "messages": [{ "role": "user", "content": "用一句话介绍你自己" }],
  "temperature": 0
}
```

```powershell
curl -s http://127.0.0.1:8081/v1/chat/completions `
  -H "Content-Type: application/json" -d @first-chat.json
```

```json
{
  "choices": [{
    "finish_reason": "stop",
    "message": { "role": "assistant", "content": "我是一个运行在你电脑上的语言模型……" }
  }],
  "usage": { "prompt_tokens": 26, "completion_tokens": 41 },
  "timings": { "cache_n": 23, "prompt_n": 3, "predicted_n": 41 }
}
```

四个字段就是协议地基：`message`（回答）/ `finish_reason`（stop·tool_calls·length，
第 3 章主角）/ `usage`（token 计量）/ `timings`（**llama.cpp 独有的观测窗口**，
云端 API 没有）。下面五节"深入一层"依次解释这些数字从哪来。

## 深入一层 ①：token 与 tokenizer——模型的原子

模型不读字符，读 **token**：文本先经 tokenizer（分词器）切成词表里的编号。
现代 tokenizer 几乎都用 **BPE**（Byte-Pair Encoding）家族：从字节开始，
把高频相邻对反复合并成更长的词元——"北"“京"各是一个词元，
"transformer" 可能是两三个，生僻词被拆成字节碎片。

由此可以算出本书后面所有"token 账"的来历：

- **中文 ≈ 1 字 1 token**：Qwen 系词表（约 15 万词元）对常用汉字覆盖极好，
  每个常用字就是一个词元。这就是第 5 章估算器"中文 1:1、英文 1:4"的根据
- **usage.prompt_tokens = 26**：你的 JSON 里 `messages` 的文本被模板渲染后
  （1.7 节）再切词的总数
- **为什么按 token 计费/计量**：模型的计算量和显存占用都随 token 数线性涨
  （见 ②），token 是这个世界的货币

## 深入一层 ②：推理的两阶段——引擎日志的两行从哪来

每次请求，引擎日志打两行（你 1.2 节启动后已经见过）：

```
prompt eval time =   1018.53 ms / 94 tokens (10.84 ms per token, 92.29 tokens per second)
        eval time =  26093.90 ms / 383 tokens (68.31 ms per token, 14.64 tokens per second)
```

这两行对应推理的两个性质完全不同的阶段：

**阶段一 prefill（prompt eval）**：把你全部输入（26~94 个 token）一次性喂进
网络，**并行**计算每一层的表示。特点是吞吐高（92 tok/s：一批一起算，
矩阵乘法摊平）——它读的是"上下文"。

**阶段二 decode（eval）**：从这之后，**每次只生成一个 token**，且每生成一个，
都要把它拼回输入再算一次下一步。特点是个体慢（14.6 tok/s，68ms/token）——
这就是"模型一个字一个字往外蹦"在引擎侧的真相，也是流式传输（第 2 章）
存在的物理原因。

**为什么 CPU 上生成这么慢**：decode 每步都要把 40 亿参数从内存搬一遍
（带宽受限），26 秒生成 383 token 就是这么来的。GPU 快不是因为算得快，
是因为显存带宽高一个量级。

## 深入一层 ③：KV cache——为什么第二轮对话快得多

先看现象：同一会话第二问，日志变成 `cache_n: 23, prompt_n: 3`——26 个
prompt token 只"真算"了 3 个。这不是缓存响应文本，是缓存了**计算本身**。
原理到结构层：

Transformer 的自注意力（self-attention）对每个位置 i 的 token，要拿它的
Query 向量去和**所有 j ≤ i 位置**的 Key 向量做点积、加权求和各位置的 Value
向量。注意不等式 **j ≤ i**（因果掩码，causal mask）：位置 i 的结果只依赖
它**前面**的位置。推论：**一旦前 k 个 token 的 K/V 向量算过并存下来（这就是
KV cache），后续无论生成多少 token，前 k 个位置的 K/V 永远不变、永远可复用**。

这给全书定下一条铁律（第 5 章的裁判）：

> **前缀稳定 = 缓存命中。** 两次请求的 messages 前缀逐字节相同，第二次的
> prefill 几乎免费；前缀变了一个字节，从那以后全部重算。真机对照：
> 前缀稳定的多轮对话 78% prompt token 命中缓存；"每轮删一点历史"的策略
> 命中率归零、每轮全价重算。

内存代价顺带算清：KV cache 大小 ∝ 层数 × 序列长 × 头数 × 头维 × 2（K 和 V）。
32K 上下文的 KV cache 能吃掉数 GB——这是"上下文是稀缺资源"的第二个原因
（第一个是注意力质量随长度衰减）。

## 深入一层 ④：量化——4B 怎么装进 2.5GB

4B 参数若用 16bit（fp16）存要约 8GB。你的 GGUF 只有 2.5GB——**量化**
（quantization）的功劳。核心思想一句话：**权重不需要 16bit 的精度**。

以 llama.cpp 的 Q4_K 系为例：把权重切成小块（block，通常 32 个数一块），
每块存：每数 4bit 索引 + 块级 scale（缩放）+ 块级 min（偏移）。块内共享
刻度、块间各自定标——这就是名字里 K（K-quants）与档位（XL）的含义。
4bit 相对 16bit 体积压到 1/4（8GB→2GB），能力损失在多数任务上测得出来
但很小；代价之一：量化模型的输出分布与原模型有微小偏移（这也是第二册
"严格字节级复现要固定引擎与量化"的原因之一）。

**UD**（Unsloth Dynamic）前缀是社区优化：对敏感层用更细的档、不敏感的用
更粗的，同体积下质量更高。选型结论：**Q4_K_XL 档是 4B 级模型的能力/体积
甜点**——本书全部实验在这个量化上跑出，数字你可以直接复用。

## 深入一层 ⑤：采样与 temperature——"下一个 token"怎么选

decode 每步的产物不是 token，是**整个词表上每个 token 的分数**（logits，
约 15 万维的向量）。从分数到 token 的最后一步是**采样**：

1. logits ÷ T（温度）→ softmax → 概率分布
2. temperature=0（实际实现取 argmax）：**贪心**，永远选最高分——同一输入
   几乎必然同一输出（这就是"实验与存证一律 temp=0"的原因）
3. temperature 高：分布被"加热"摊平，低概率 token 也有机会——发散、有创意，
   也更容易跑偏。注意 **T 影响的是分布形状，不是模型能力**——它不能让 4B
   想出它没学到的东西

两个工程推论：**两引擎默认温度可能不同**（本书引擎默认 0.8——不显式传
temperature，"同一请求"在两个引擎上是两种行为）；投机解码
（speculative decoding，第二册附录提）用小模型起草大模型验证，数学上
分布等价，但浮点归约顺序差异会让贪心解码在"近平局 token"上翻转——
严格复现要关它。

## 1.4 存证：第一份报文归档

```powershell
mkdir D:\LLM\captures\01-first-chat; cd D:\LLM\captures\01-first-chat
Copy-Item ..\..\first-chat.json request.json
curl -s http://127.0.0.1:8081/v1/chat/completions `
  -H "Content-Type: application/json" -d @request.json -o response.json
```

从现在起每个实验都有档可查（纪律 3）。

> **引经据典**｜pi `packages/ai` 的 `StreamOptions.onPayload/onResponse`
> pi 把"拿到发给 provider 的原始请求与响应"做成了 LLM 层标准钩子——
> 我们手工存证是同一件事的原始形态。

## 1.5 观测窗口：全书实验的证据来源

从本章起养成习惯，每次实验看三样（都在日志与 `timings` 里）：

| 观测 | 回答什么 | 谁的裁判 |
|---|---|---|
| `cache_n` / `prompt_n` | 前缀稳定吗？真算了几个 | 第 5 章裁剪策略 |
| `predicted_n` | 生成花了多少 token（思考烧了多少预算） | 二册思考实验 |
| 两行计时 | prefill/decode 各占多少 | 一切性能结论 |

## 1.6 chat template：--jinja 到底做什么（先看现象）

你的 JSON `messages` 不是直接进模型的。**chat template**（模型自带的 Jinja2
模板，存在 GGUF 里）把它渲染成模型训练时见过的**一整段文本**，比如 Qwen 系
的形态类似：

```
<|im_start|>user
北京今天多少度？<|im_end|>
<|im_start|>assistant
```

模型生成到 `<|im_end|>`（EOS，结束符）就停。**--jinja 就是"启用模板渲染"**。
它为什么是工具调用的生死开关——模板怎么把 tools 渲染进去、模型"输出工具调用"
时到底输出了什么——是第 3 章"深入一层"的主菜，这里先立个问号。

## 1.7 故意搞坏（三个必做）

- **引擎没起/端口错**：`curl: (7) Failed to connect … connection refused`
  （先 `/health` 分诊："引擎没起"还是"请求写错"）
- **模型路径反斜杠**：`{"error":{"code":400,"message":"Failed to load model:
  D:LLMmodelsxxx.gguf"}}`——`\L` 是非法 JSON 转义，看到 `\` 消失就是它
- **非法 role**：`{"error":{"code":400,"message":"Invalid role: wizard"}}`——
  协议是契约，role 只有 system/user/assistant/tool

## 1.8 自测

- [ ] 能讲 prefill 与 decode 的区别（并行读 vs 逐个生）、为什么 CPU 生成慢
      （带宽：每 token 搬一遍全部权重）
- [ ] 能用因果掩码（j≤i）推出"前缀可缓存"的结论；算得出 cache_n+prompt_n
      与日志第一行 token 数的关系
- [ ] 能解释 4bit 块量化（块+scale+min）怎么把 8GB 压到 2GB；UD 是什么
- [ ] 能讲 logits→softmax→采样链条与 T=0 贪心；知道"默认温度不同"的坑
- [ ] 知道 chat template 在 messages 与模型之间，--jinja 是它的开关
- [ ] 三份存证在案、三个报错认脸
