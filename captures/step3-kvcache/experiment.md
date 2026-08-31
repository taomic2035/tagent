# KV cache 复用三段对照实验（2026-08-31）

> 引擎：llama.cpp（timings.cache_n = 命中的前缀 token 数）。
> 设计与判读见 DESIGN §12.4；max_tokens=16（本实验只关心 prompt 侧缓存行为）。

| 段 | 请求 | cache_n（命中） | prompt_n（需处理） | 命中率 = cache/(cache+prompt) |
|---|---|---|---|---|
| A 连续追加 | A1-append | 0 | 49 | 0% |
| A 连续追加 | A2-append | 45 | 25 | 64% |
| A 连续追加 | A3-append | 66 | 25 | 73% |
| A 连续追加 | A4-append | 87 | 25 | 78% |
| B 前缀破坏 | B1-prefix-broken | 32 | 91 | 26% |
| C 裁剪恢复 | C1-after-trim | 32 | 59 | 35% |
| C 裁剪恢复 | C2-stable-again | 87 | 25 | 78% |

> 字段语义（实测校准）：prompt_n 是本次**实际处理**的 token 数（cache miss 部分），
> cache_n 是命中的前缀 token 数；本次总 prompt ≈ cache_n + prompt_n。

## 判读

- **A 段**：cache_n 随轮次增长（上一轮完整 prompt 成为下一轮前缀）——多轮 agent 对话的前缀复用经济学
- **B 段**：早期消息被改（等价于"每轮裁一点/改一点"的最坏习惯）→ cache_n 骤降，整段 prompt 重新处理
- **C 段**：裁剪建立新前缀（C1 部分命中/未命中），随后 C2 在新前缀上恢复高命中——双水位"一次裁到位、之后稳定"的意义
