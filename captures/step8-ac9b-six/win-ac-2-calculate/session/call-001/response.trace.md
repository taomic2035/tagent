# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 60 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 44 |
| 正文 token（text） | 0 |
| tool_call 分片 | 14 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 16270 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 266 | 用户 |
| 2 | reasoning | 3 | 5 | 527 | 要求 |
| 3 | reasoning | 4 | 7 | 788 | 计算 |
| 4 | reasoning | 5 | 9 | 1049 |   |
| 5 | reasoning | 6 | 11 | 1305 | 3 |
| 6 | reasoning | 7 | 13 | 1561 | . |
| 7 | reasoning | 8 | 15 | 1817 | 7 |
| 8 | reasoning | 9 | 17 | 2073 |   |
| 9 | reasoning | 10 | 19 | 2329 | 乘以 |
| 10 | reasoning | 11 | 21 | 2590 |   |
| 11 | reasoning | 12 | 23 | 2846 | 1 |
| 12 | reasoning | 13 | 25 | 3102 | 2 |
| 13 | reasoning | 14 | 27 | 3358 |   |
| 14 | reasoning | 15 | 29 | 3614 | 再 |
| 15 | reasoning | 16 | 31 | 3872 | 减 |
| 16 | reasoning | 17 | 33 | 4130 |   |
| 17 | reasoning | 18 | 35 | 4386 | 8 |
| 18 | reasoning | 19 | 37 | 4642 | . |
| 19 | reasoning | 20 | 39 | 4898 | 2 |
| 20 | reasoning | 21 | 41 | 5154 | 。 |
| 21 | reasoning | 22 | 43 | 5412 | 我 |
| 22 | reasoning | 23 | 45 | 5670 | 需要使用 |
| 23 | reasoning | 24 | 47 | 5937 |  calculate |
| 24 | reasoning | 25 | 49 | 6202 |   |
| 25 | reasoning | 26 | 51 | 6458 | 工具 |
| 26 | reasoning | 27 | 53 | 6719 | 来计算 |
| 27 | reasoning | 28 | 55 | 6983 | 这个 |
| 28 | reasoning | 29 | 57 | 7244 | 表达式 |
| 29 | reasoning | 30 | 59 | 7508 | 。 |
| 30 | reasoning | 31 | 61 | 7766 | \n\n |
| 31 | reasoning | 32 | 63 | 8025 | 表达式 |
| 32 | reasoning | 33 | 65 | 8289 | 应该是 |
| 33 | reasoning | 34 | 67 | 8553 | ： |
| 34 | reasoning | 35 | 69 | 8811 | 3 |
| 35 | reasoning | 36 | 71 | 9067 | . |
| 36 | reasoning | 37 | 73 | 9323 | 7 |
| 37 | reasoning | 38 | 75 | 9579 | * |
| 38 | reasoning | 39 | 77 | 9835 | 1 |
| 39 | reasoning | 40 | 79 | 10091 | 2 |
| 40 | reasoning | 41 | 81 | 10347 | - |
| 41 | reasoning | 42 | 83 | 10603 | 8 |
| 42 | reasoning | 43 | 85 | 10859 | . |
| 43 | reasoning | 44 | 87 | 11115 | 2 |
| 44 | reasoning | 45 | 89 | 11371 | \n |
| 45 | tool-call | 46 | 91 | 11628 | name=calculate args={ |
| 46 | tool-call | 47 | 93 | 11993 | name=null args=\"expression\":\" |
| 47 | tool-call | 48 | 95 | 12297 | name=null args=3 |
| 48 | tool-call | 49 | 97 | 12585 | name=null args=. |
| 49 | tool-call | 50 | 99 | 12873 | name=null args=7 |
| 50 | tool-call | 51 | 101 | 13161 | name=null args=* |
| 51 | tool-call | 52 | 103 | 13449 | name=null args=1 |
| 52 | tool-call | 53 | 105 | 13737 | name=null args=2 |
| 53 | tool-call | 54 | 107 | 14025 | name=null args=- |
| 54 | tool-call | 55 | 109 | 14313 | name=null args=8 |
| 55 | tool-call | 56 | 111 | 14601 | name=null args=. |
| 56 | tool-call | 57 | 113 | 14889 | name=null args=2 |
| 57 | tool-call | 58 | 115 | 15177 | name=null args=\" |
| 58 | tool-call | 59 | 117 | 15466 | name=null args=} |
