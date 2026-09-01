# 第 1 章 把引擎跑起来

> 本章目标：在你的电脑上跑起一个**本地推理服务**（llama.cpp server + 一个 4B 量化模型），
> 用 curl 和它完成第一次对话，并把报文原文存档——存证制度从第一份报文开始。
> 预计半天。本章零编程，全是操作，但每一步都要读懂"发生了什么"。

---

## 1.1 为什么大脑要在本地跑

三个理由，按重要性排：

1. **零成本试错**：调云端 API 做实验按 token 计费，本教程后面要做几十上百次实验；
   本地随便跑
2. **隐私**：对话数据不出你的电脑
3. **学习价值**：你能看到协议的**原始字节**——云端 API 替你藏起来的东西
   （KV cache 命中数、逐 token 延迟、量化差异），本地全都暴露给你。
   本教程一半的知识来自盯着这些数字看

代价：慢（见 0.5 的速度表）。值得。

## 1.2 下载引擎与模型

### 引擎：llama.cpp

llama.cpp 是目前最主流的本地推理引擎（C++ 实现，CPU/GPU 通吃，GGUF 格式标准制定者）。

**Windows**：到 GitHub Releases（github.com/ggml-org/llama.cpp/releases）下载
预编译包。选 `llama-cpu-win-x64.zip`（纯 CPU 版；有 N 卡选 vulkan 版），
解压到 `D:\LLM\llama.cpp`（本教程约定：**推理相关的一切统一放 `D:\LLM`**，下同）。

验证解压成功——里面应有 `llama-server.exe`：
```powershell
dir D:\LLM\llama.cpp\llama-server.exe
```

> **Mac 附注**：`brew install llama.cpp` 即可，可执行文件在 PATH 里直接用
> `llama-server`。Mac 也可跑 MLX 引擎，但本教程统一用 llama.cpp，一份经验全平台通用。

### 模型：GGUF 量化文件

我们用 **Qwen3.5-4B** 的 4bit 量化版（文件名含 `UD-Q4_K_XL`，约 2.5GB）。
三个名词一次讲清：

- **4B**：40 亿参数。参数量≈能力，也≈内存占用。4B 是"能可靠完成工具调用"的
  下限，正好适合教学——它够聪明能干活，又够蠢会把每种失败都犯给你看（第 4 章主题）
- **Q4_K_XL**：量化方案名（4bit，K-quants 的 XL 档）。不用背，记住"4bit 量化"
  即可：体积约为原始 16bit 的 1/4，能力损失很小
- **GGUF**：llama.cpp 的模型文件格式（单一文件包含权重+tokenizer+聊天模板）

下载渠道：ModelScope（国内快，modelscope.cn）或 Hugging Face。搜
`Qwen3.5-4B` + `UD-Q4_K_XL`，下载 `.gguf` 文件放到 `D:\LLM\models\`。

> **路径纪律再强调**：模型完整路径本教程记作 `D:/LLM/models/<文件名>.gguf`
> ——注意是**正斜杠**。这个字符串马上要进命令行参数和 JSON，反斜杠会被吞（见 0.4）。

## 1.3 启动引擎

在 `D:\LLM` 建一个 `start-llm.ps1`（PowerShell 脚本，Windows 记事本保存时选
**UTF-8 with BOM**，否则中文注释会变乱码——真实踩坑）：

```powershell
# start-llm.ps1 —— 启动本地推理引擎（本教程固定端口 8081）
$model = "D:/LLM/models/<你的模型文件名>.gguf"   # 改成你的文件名
D:\LLM\llama.cpp\llama-server.exe `
  --host 127.0.0.1 --port 8081 `
  -m $model `
  --jinja `
  --reasoning-format deepseek
```

四个参数各是什么：

| 参数 | 作用 | 不加会怎样 |
|---|---|---|
| `--host 127.0.0.1 --port 8081` | 只在本机 8081 端口监听 | 默认 8080，且可能监听公网（不安全） |
| `-m <路径>` | 加载哪个 GGUF | 启动失败 |
| `--jinja` | 用模型自带的聊天模板（chat template）渲染对话 | **tool_calls 完全不工作**——这是新手第一大坑 |
| `--reasoning-format deepseek` | 思考内容放进 `reasoning_content` 字段 | 思考文本混在正文里，没法分流渲染 |

启动并验证：

```powershell
cd D:\LLM
.\start-llm.ps1          # 前台启动，能看到加载日志；3 秒左右出现 "server is listening"
```

**另开一个终端**做健康检查：

```powershell
curl http://127.0.0.1:8081/health
# 期望输出：{"status":"ok"}
echo "exit=$?"           # 期望 exit=0（纪律：看退出码）
```

> **Mac 附注**：把脚本存成 `start-llm.sh`（`llama-server --host 127.0.0.1 --port 8081 -m /路径/model.gguf --jinja --reasoning-format deepseek`），`chmod +x` 后 `./start-llm.sh`。
> 后台跑加 `> server.log 2> server.err &`。

## 1.4 第一次对话：读懂一个 OpenAI 兼容请求

引擎兼容 OpenAI Chat Completions 协议，端点是 `/v1/chat/completions`。
把下面存成 `first-chat.json`（注意 Windows 路径没出现——model 字段直接抄你启动时用的那个正斜杠路径）：

```json
{
  "model": "D:/LLM/models/<你的模型文件名>.gguf",
  "messages": [
    { "role": "user", "content": "用一句话介绍你自己" }
  ],
  "temperature": 0
}
```

> `temperature: 0` 让输出接近确定——**实验和存证一律用 0**，同一请求才能得到可比的
> 结果（第 6 章会看到两引擎默认温度不同的暗坑）。日常聊天可以不传。

发请求（非流式，先看完整结构；流式下一章上）：

```powershell
curl -s http://127.0.0.1:8081/v1/chat/completions `
  -H "Content-Type: application/json" `
  -d @first-chat.json
```

返回（真实输出节选，字段讲解跟着看）：

```json
{
  "choices": [
    {
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "我是一个运行在你电脑上的语言模型……"
      }
    }
  ],
  "usage": { "prompt_tokens": 26, "completion_tokens": 41 },
  "timings": { "prompt_n": 3, "cache_n": 23, "predicted_n": 41, ... }
}
```

逐字段读（**这就是全书协议的地基，值得盯着看五分钟**）：

- `choices[0].message`：模型的回答。role 是 `assistant`
- `finish_reason: "stop"`：正常说完。记住三种值（stop/tool_calls/length），第 3、4 章的主角
- `usage`：token 计量——prompt 26（你的问题+模板）、completion 41（回答）
- `timings`（llama.cpp 扩展，云端 API 没有）：`cache_n: 23` 表示 23 个 prompt token
  命中了 KV cache 没重算。**这是本地实验独有的窗口**，盯它可以优化到省钱省时

## 1.5 存证：第一份报文归档

工程纪律 3：每次通信必须存证。现在就建目录结构，第一章只存"请求体+响应体"两件：

```powershell
mkdir D:\LLM\captures\01-first-chat
cd D:\LLM\captures\01-first-chat
Copy-Item ..\..\first-chat.json request.json
curl -s http://127.0.0.1:8081/v1/chat/completions -H "Content-Type: application/json" -d @request.json -o response.json
```

`dir` 应看到两个文件。**从现在起，你的每个实验都有档可查。**

## 1.6 故意搞坏（工程纪律 5）

三个必做的失败实验。**贴报错原文**，认脸：

**实验 1：引擎没启动（或端口错）**
```powershell
curl http://127.0.0.1:9999/v1/chat/completions -d @request.json
curl: (7) Failed to connect to 127.0.0.1 port 9999 after 1 ms: connection refused
echo "exit=$?"    # exit=7
```
诊断口诀：先 `curl /health` 分清"引擎没起"还是"请求写错"。

**实验 2：模型路径写成反斜杠（Windows 专属经典）**

把 `model` 字段的 `/` 改成 `\`，如 `"D:\LLM\models\xxx.gguf"`，重发：

```
{"error":{"code":400,"message":"Failed to load model: D:LLMmodelsxxx.gguf"}}

（或 JSON 解析报错——反斜杠在 JSON 里是转义符，`\L` `\m` 变成非法转义）
```
看到 `\` 消失就是它。回 0.4 复习纪律：**JSON 里 Windows 路径用正斜杠**。

**实验 3：messages 给了不存在的 role**
```json
{ "model": "...", "messages": [ { "role": "wizard", "content": "hi" } ] }
```
```
{"error":{"code":400,"message":"Invalid role: wizard"}}
```
协议是契约：role 只有 system/user/assistant/tool 四种（见 0.3 表）。

## 1.7 自测清单

- [ ] `curl /health` 返回 ok，且你知道怎么查引擎进程占的端口
- [ ] 能说出 `--jinja` 不加会发生什么（tool_calls 失效），以及为什么本教程要它
- [ ] 完整发过一次非流式对话，能指着返回 JSON 说出 message / finish_reason /
      usage / cache_n 各是什么
- [ ] `captures/01-first-chat/` 里有 request.json 和 response.json
- [ ] 三个搞坏实验都亲手做过，看到报错能立刻说出原因
- [ ] 现在就知道：temperature 实验用 0，JSON 里路径用正斜杠

下一章，我们用 TypeScript 写三件套的第二件——大脑的第一块：一个手写的
HTTP+SSE 客户端，让"和模型对话"从 curl 变成代码。
