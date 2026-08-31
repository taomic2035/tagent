# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 51 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 38 |
| 正文 token（text） | 11 |
| tool_call 分片 | 0 |
| finish_reason | stop |
| 收到 [DONE] | 是 |
| 文件字节数 | 14900 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | “ |
| 4 | reasoning | 5 | 9 | 1162 | 我喜欢 |
| 5 | reasoning | 6 | 11 | 1455 | 喝 |
| 6 | reasoning | 7 | 13 | 1742 | 什么 |
| 7 | reasoning | 8 | 15 | 2032 | ”， |
| 8 | reasoning | 9 | 17 | 2322 | 我 |
| 9 | reasoning | 10 | 19 | 2609 | 通过 |
| 10 | reasoning | 11 | 21 | 2899 |  recall |
| 11 | reasoning | 12 | 23 | 3190 |   |
| 12 | reasoning | 13 | 25 | 3475 | 工具 |
| 13 | reasoning | 14 | 27 | 3765 | 查询 |
| 14 | reasoning | 15 | 29 | 4055 | 了 |
| 15 | reasoning | 16 | 31 | 4342 | 长期 |
| 16 | reasoning | 17 | 33 | 4632 | 记忆 |
| 17 | reasoning | 18 | 35 | 4922 | ， |
| 18 | reasoning | 19 | 37 | 5209 | 发现 |
| 19 | reasoning | 20 | 39 | 5499 | 有一条 |
| 20 | reasoning | 21 | 41 | 5792 | 匹配 |
| 21 | reasoning | 22 | 43 | 6082 | 的事实 |
| 22 | reasoning | 23 | 45 | 6375 | ：“ |
| 23 | reasoning | 24 | 47 | 6665 | 我喜欢 |
| 24 | reasoning | 25 | 49 | 6958 | 喝 |
| 25 | reasoning | 26 | 51 | 7245 | 美式 |
| 26 | reasoning | 27 | 53 | 7535 | 咖啡 |
| 27 | reasoning | 28 | 55 | 7825 | ， |
| 28 | reasoning | 29 | 57 | 8112 | 不加 |
| 29 | reasoning | 30 | 59 | 8402 | 糖 |
| 30 | reasoning | 31 | 61 | 8689 | ”。 |
| 31 | reasoning | 32 | 63 | 8979 | 因此 |
| 32 | reasoning | 33 | 65 | 9269 | ， |
| 33 | reasoning | 34 | 67 | 9556 | 我 |
| 34 | reasoning | 35 | 69 | 9843 | 可以直接 |
| 35 | reasoning | 36 | 71 | 10139 | 回答 |
| 36 | reasoning | 37 | 73 | 10429 | 用户 |
| 37 | reasoning | 38 | 75 | 10719 | 。 |
| 38 | reasoning | 39 | 77 | 11006 | \n |
| 39 | text | 40 | 79 | 11292 | 你喜欢 |
| 40 | text | 41 | 81 | 11575 | 喝 |
| 41 | text | 42 | 83 | 11852 | 美式 |
| 42 | text | 43 | 85 | 12132 | 咖啡 |
| 43 | text | 44 | 87 | 12412 | ， |
| 44 | text | 45 | 89 | 12689 | 而且 |
| 45 | text | 46 | 91 | 12969 | 是不 |
| 46 | text | 47 | 93 | 13249 | 加 |
| 47 | text | 48 | 95 | 13526 | 糖 |
| 48 | text | 49 | 97 | 13803 | 的 |
| 49 | text | 50 | 99 | 14080 | 。 |
