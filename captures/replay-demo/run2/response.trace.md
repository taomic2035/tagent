# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 55 |
| keepalive 注释帧 | 1 |
| 思考 token（reasoning） | 52 |
| 正文 token（text） | 1 |
| tool_call 分片 | 1 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 25284 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 3 | 17 | 用户 |
| 2 | reasoning | 2 | 5 | 478 | 想要 |
| 3 | reasoning | 3 | 7 | 939 | 计算 |
| 4 | reasoning | 4 | 9 | 1400 |  3 |
| 5 | reasoning | 5 | 11 | 1851 | . |
| 6 | reasoning | 6 | 13 | 2301 | 7 |
| 7 | reasoning | 7 | 15 | 2751 |  乘以 |
| 8 | reasoning | 8 | 17 | 3213 |  1 |
| 9 | reasoning | 9 | 19 | 3664 | 2 |
| 10 | reasoning | 10 | 21 | 4114 |  再 |
| 11 | reasoning | 11 | 23 | 4570 | 减 |
| 12 | reasoning | 12 | 25 | 5025 |  8 |
| 13 | reasoning | 13 | 27 | 5476 | . |
| 14 | reasoning | 14 | 29 | 5926 | 2 |
| 15 | reasoning | 15 | 31 | 6376 |  的结果 |
| 16 | reasoning | 16 | 33 | 6844 | 。 |
| 17 | reasoning | 17 | 35 | 7299 | 这是一个 |
| 18 | reasoning | 18 | 37 | 7772 | 四 |
| 19 | reasoning | 19 | 39 | 8227 | 则 |
| 20 | reasoning | 20 | 41 | 8682 | 运算 |
| 21 | reasoning | 21 | 43 | 9143 | 表达式 |
| 22 | reasoning | 22 | 45 | 9610 | ， |
| 23 | reasoning | 23 | 47 | 10065 | 我 |
| 24 | reasoning | 24 | 49 | 10520 | 需要使用 |
| 25 | reasoning | 25 | 51 | 10993 |  calculate |
| 26 | reasoning | 26 | 53 | 11452 |  工具 |
| 27 | reasoning | 27 | 55 | 11914 | 来计算 |
| 28 | reasoning | 28 | 57 | 12381 | 。 |
| 29 | reasoning | 29 | 59 | 12836 | \n\n |
| 30 | reasoning | 30 | 61 | 13289 | 表达式 |
| 31 | reasoning | 31 | 63 | 13756 | 是 |
| 32 | reasoning | 32 | 65 | 14211 | ： |
| 33 | reasoning | 33 | 67 | 14666 | 3 |
| 34 | reasoning | 34 | 69 | 15116 | . |
| 35 | reasoning | 35 | 71 | 15566 | 7 |
| 36 | reasoning | 36 | 73 | 16016 |  * |
| 37 | reasoning | 37 | 75 | 16467 |  1 |
| 38 | reasoning | 38 | 77 | 16918 | 2 |
| 39 | reasoning | 39 | 79 | 17368 |  - |
| 40 | reasoning | 40 | 81 | 17819 |  8 |
| 41 | reasoning | 41 | 83 | 18270 | . |
| 42 | reasoning | 42 | 85 | 18720 | 2 |
| 43 | reasoning | 43 | 87 | 19170 | \n\n |
| 44 | reasoning | 44 | 89 | 19623 | 让我 |
| 45 | reasoning | 45 | 91 | 20084 | 调用 |
| 46 | reasoning | 46 | 93 | 20545 |  calculate |
| 47 | reasoning | 47 | 95 | 21004 |  工具 |
| 48 | reasoning | 48 | 97 | 21466 | 来计算 |
| 49 | reasoning | 49 | 99 | 21933 | 这个 |
| 50 | reasoning | 50 | 101 | 22394 | 表达式 |
| 51 | reasoning | 51 | 103 | 22861 | 。 |
| 52 | reasoning | 52 | 105 | 23316 | \n |
| 53 | text | 53 | 107 | 23767 | \n\n |
| 54 | tool-call | 54 | 109 | 24218 | name=calculate args={\"expression\": \"3.7*12-8.2\"} |
