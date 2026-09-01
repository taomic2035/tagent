# 第 1 章 引擎与观测窗口

> 本章目标：跑起本地推理服务，完成第一次对话并存下第一份报文；更重要的是——
> **学会读引擎日志**。日志里的 timings/cache_n 字段是全书所有实验的观测窗口，
> 从今天起养成"每轮都瞄一眼"的习惯。预计半天，零编程。

---

## 1.1 为什么大脑跑在本地

1. **零成本试错**：后面要做上百次实验，云端按 token 计费
2. **隐私**：对话不出你的电脑
3. **学习价值**：本地引擎把云端替你藏的东西全暴露了——KV cache 命中数、
   逐 token 延迟、量化差异。**本教程一半的知识来自盯着这些数字看**

代价是慢（0.5 的表）。值得。

## 1.2 下载引擎与模型

**引擎 llama.cpp**（ggml-org/llama.cpp，GGUF 标准制定者）：GitHub Releases
下 `llama-cpu-win-x64.zip`（纯 CPU；有 N 卡选 vulkan 版），解压到 `D:\LLM\llama.cpp`
（约定：推理相关一切放 `D:\LLM`）。验证：

```powershell
dir D:\LLM\llama.cpp\llama-server.exe
```
> Mac 附注：`brew install llama.cpp`，直接用 `llama-server`。

**模型**：Qwen3.5-4B 的 4bit 量化版（ModelScope 或 HuggingFace 搜
`Qwen3.5-4B` + `UD-Q4_K_XL`，约 2.5GB），放到 `D:\LLM\models\`。
名词拆解：**4B** = 40 亿参数——能可靠完成工具调用的下限，够聪明能干活、
够蠢会把每种失败演给你看（第 3/4 章的教材就是它）。**Q4_K_XL** = 4bit
量化方案（体积约为 16bit 的 1/4，能力损失很小）。**GGUF** = 单文件包含
权重+tokenizer+聊天模板。完整路径记作 `D:/LLM/models/<文件名>.gguf`
（**正斜杠**，0.4 的纪律马上兑现）。

## 1.3 启动引擎

`D:\LLM\start-llm.ps1`（记事本保存选 **UTF-8 with BOM**，否则中文注释乱码）：

```powershell
# start-llm.ps1 —— 本地推理引擎（固定端口 8081）
$model = "D:/LLM/models/<你的模型文件名>.gguf"
D:\LLM\llama.cpp\llama-server.exe `
  --host 127.0.0.1 --port 8081 `
  -m $model `
  --jinja `
  --reasoning-format deepseek
```

| 参数 | 作用 | 不加会怎样 |
|---|---|---|
| `--host 127.0.0.1 --port 8081` | 只监听本机 8081 | 默认 8080，且可能监听公网（危险） |
| `-m <路径>` | 加载哪个 GGUF | 启动失败 |
| `--jinja` | 用模型自带 chat template 渲染对话 | **tool_calls 完全不工作**——新手第一大坑 |
| `--reasoning-format deepseek` | 思考内容放进 `reasoning_content` 字段 | 思考混在正文里无法分流 |

> **引经据典**｜pi `packages/coding-agent/docs/llama-cpp.md`
> pi 的 llama.cpp provider 文档明文要求服务端 `--jinja` 才有工具调用，并立了两条
> 家规："does not silently unload models and never deletes model files"（不静默
> 卸载模型、永不删模型文件）。工业项目和我们踩同一条坑、立同一条规——
> 你现在立的每条纪律都有先例。

```powershell
cd D:\LLM
.\start-llm.ps1      # 前台启动，~3 秒后出现 "server is listening"
```

**另开终端**做健康检查：

```powershell
curl http://127.0.0.1:8081/health
# {"status":"ok"}
echo "exit=$?"       # exit=0（纪律：看退出码）
```

## 1.4 第一次对话：逐字段读懂返回

`first-chat.json`（temperature 固定 0——实验与存证一律 0，同请求才可比）：

```json
{
  "model": "D:/LLM/models/<你的模型文件名>.gguf",
  "messages": [{ "role": "user", "content": "用一句话介绍你自己" }],
  "temperature": 0
}
```

```powershell
curl -s http://127.0.0.1:8081/v1/chat/completions `
  -H "Content-Type: application/json" -d @first-chat.json
```

返回（真实节选）：

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

盯着看五分钟，四个字段就是全书协议地基：`message`（回答）/ `finish_reason`
（stop/tool_calls/length 三种，第 3/4 章主角）/ `usage`（token 计量）/
`timings`（**llama.cpp 独有的观测窗口**，云端 API 没有——下一节专门讲）。

## 1.5 观测窗口：学会读引擎日志

回到引擎终端（或把输出重定向到文件细读）。每次请求后它打印：

```
prompt eval time =    1018.53 ms /     94 tokens (   10.84 ms per token, 92.29 tokens per second)
        eval time =   26093.90 ms /    383 tokens (  68.31 ms per token, 14.64 tokens per second)
       total time =   27112.42 ms /    477 tokens
```

三行分别读作：**处理你的输入**用了 1018ms 处理 94 个 token；**生成**用了
26 秒生成 383 个 token（14.6 tok/s——对上 0.5 的速度表了）；合计 477。

再看 `/health` 同款信息在 JSON 里的形态（响应的 `timings` 字段）：
`cache_n: 23, prompt_n: 3` ——这次请求 26 个 prompt token 里 **23 个命中了
KV cache**（之前请求的公共前缀，直接复用没重算），只真正处理了 3 个新 token。

**这就是全书最重要的观测习惯**：每做一次实验，看三样——
`cache_n`（前缀稳定吗？第 5 章裁剪策略的裁判）、`predicted_n`（生成多少，
思考烧了多少预算？第 6 章）、`prompt eval`（处理耗时，缓存命中的直接收益）。
后面所有"结论要有证据"的纪律，证据大半从这来。

## 1.6 存证：第一份报文归档

```powershell
mkdir D:\LLM\captures\01-first-chat
cd D:\LLM\captures\01-first-chat
Copy-Item ..\..\first-chat.json request.json
curl -s http://127.0.0.1:8081/v1/chat/completions -H "Content-Type: application/json" `
  -d @request.json -o response.json
dir     # 两个文件在案。从现在起每个实验都有档可查
```

> **引经据典**｜pi `packages/ai` 的 `StreamOptions.onPayload / onResponse`
> pi 把"拿到发给 provider 的原始请求与响应"做成了 LLM 层的标准钩子——与我们
> "存证从第一份报文开始"是同一件事的框架化版本。我们手工做，反而看得更清。

## 1.7 故意搞坏（三个必做，贴报错原文）

**实验 1：引擎没起 / 端口错**
```powershell
curl http://127.0.0.1:9999/v1/chat/completions -d @request.json
curl: (7) Failed to connect to 127.0.0.1 port 9999 after 1 ms: connection refused
```
诊断口诀：先 `curl /health`——分清"引擎没起"还是"请求写错"。

**实验 2：模型路径反斜杠（Windows 经典）**
把 model 里的 `/` 改成 `\` 重发：
```
{"error":{"code":400,"message":"Failed to load model: D:LLMmodelsxxx.gguf"}}
```
`\` 在 JSON 里是转义符，`\L` 非法转义直接炸。看到 `\` 消失就是它。

**实验 3：不存在的 role**
```json
{ "model": "...", "messages": [{ "role": "wizard", "content": "hi" }] }
```
```
{"error":{"code":400,"message":"Invalid role: wizard"}}
```
协议是契约：role 只有 system/user/assistant/tool。

## 1.8 自测清单

- [ ] `/health` 通，会查端口占用，能说出 `--jinja` 不加的后果
- [ ] 能指着返回 JSON 讲 message / finish_reason / usage / cache_n
- [ ] **能读三行日志**：prompt eval / eval / total 各是什么，cache_n 和 prompt_n
      的关系算得出（cache_n + prompt_n = 总 prompt token）
- [ ] `captures/01-first-chat/` 两文件在案
- [ ] 三个搞坏实验亲手做过、报错认脸
