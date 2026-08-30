# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 55 |
| keepalive 注释帧 | 3 |
| 思考 token（reasoning） | 52 |
| 正文 token（text） | 1 |
| tool_call 分片 | 1 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 25324 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 7 | 57 | 用户 |
| 2 | reasoning | 2 | 9 | 518 | 想要 |
| 3 | reasoning | 3 | 11 | 979 | 计算 |
| 4 | reasoning | 4 | 13 | 1440 |  3 |
| 5 | reasoning | 5 | 15 | 1891 | . |
| 6 | reasoning | 6 | 17 | 2341 | 7 |
| 7 | reasoning | 7 | 19 | 2791 |  乘以 |
| 8 | reasoning | 8 | 21 | 3253 |  1 |
| 9 | reasoning | 9 | 23 | 3704 | 2 |
| 10 | reasoning | 10 | 25 | 4154 |  再 |
| 11 | reasoning | 11 | 27 | 4610 | 减 |
| 12 | reasoning | 12 | 29 | 5065 |  8 |
| 13 | reasoning | 13 | 31 | 5516 | . |
| 14 | reasoning | 14 | 33 | 5966 | 2 |
| 15 | reasoning | 15 | 35 | 6416 |  的结果 |
| 16 | reasoning | 16 | 37 | 6884 | 。 |
| 17 | reasoning | 17 | 39 | 7339 | 这是一个 |
| 18 | reasoning | 18 | 41 | 7812 | 四 |
| 19 | reasoning | 19 | 43 | 8267 | 则 |
| 20 | reasoning | 20 | 45 | 8722 | 运算 |
| 21 | reasoning | 21 | 47 | 9183 | 表达式 |
| 22 | reasoning | 22 | 49 | 9650 | ， |
| 23 | reasoning | 23 | 51 | 10105 | 我 |
| 24 | reasoning | 24 | 53 | 10560 | 需要使用 |
| 25 | reasoning | 25 | 55 | 11033 |  calculate |
| 26 | reasoning | 26 | 57 | 11492 |  工具 |
| 27 | reasoning | 27 | 59 | 11954 | 来计算 |
| 28 | reasoning | 28 | 61 | 12421 | 。 |
| 29 | reasoning | 29 | 63 | 12876 | \n\n |
| 30 | reasoning | 30 | 65 | 13329 | 表达式 |
| 31 | reasoning | 31 | 67 | 13796 | 是 |
| 32 | reasoning | 32 | 69 | 14251 | ： |
| 33 | reasoning | 33 | 71 | 14706 | 3 |
| 34 | reasoning | 34 | 73 | 15156 | . |
| 35 | reasoning | 35 | 75 | 15606 | 7 |
| 36 | reasoning | 36 | 77 | 16056 |  * |
| 37 | reasoning | 37 | 79 | 16507 |  1 |
| 38 | reasoning | 38 | 81 | 16958 | 2 |
| 39 | reasoning | 39 | 83 | 17408 |  - |
| 40 | reasoning | 40 | 85 | 17859 |  8 |
| 41 | reasoning | 41 | 87 | 18310 | . |
| 42 | reasoning | 42 | 89 | 18760 | 2 |
| 43 | reasoning | 43 | 91 | 19210 | \n\n |
| 44 | reasoning | 44 | 93 | 19663 | 让我 |
| 45 | reasoning | 45 | 95 | 20124 | 调用 |
| 46 | reasoning | 46 | 97 | 20585 |  calculate |
| 47 | reasoning | 47 | 99 | 21044 |  工具 |
| 48 | reasoning | 48 | 101 | 21506 | 来计算 |
| 49 | reasoning | 49 | 103 | 21973 | 这个 |
| 50 | reasoning | 50 | 105 | 22434 | 表达式 |
| 51 | reasoning | 51 | 107 | 22901 | 。 |
| 52 | reasoning | 52 | 109 | 23356 | \n |
| 53 | text | 53 | 111 | 23807 | \n\n |
| 54 | tool-call | 54 | 113 | 24258 | name=calculate args={\"expression\": \"3.7*12-8.2\"} |
