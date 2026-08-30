# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 54 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 51 |
| 正文 token（text） | 1 |
| tool_call 分片 | 1 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 3521 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 想要 |
| 3 | reasoning | 3 | 5 | 128 | 计算 |
| 4 | reasoning | 4 | 7 | 192 |  \" |
| 5 | reasoning | 5 | 9 | 253 | 3 |
| 6 | reasoning | 6 | 11 | 312 | . |
| 7 | reasoning | 7 | 13 | 371 | 7 |
| 8 | reasoning | 8 | 15 | 430 |  乘以 |
| 9 | reasoning | 9 | 17 | 495 |  1 |
| 10 | reasoning | 10 | 19 | 555 | 2 |
| 11 | reasoning | 11 | 21 | 614 |  再 |
| 12 | reasoning | 12 | 23 | 676 | 减 |
| 13 | reasoning | 13 | 25 | 737 |  8 |
| 14 | reasoning | 14 | 27 | 797 | . |
| 15 | reasoning | 15 | 29 | 856 | 2 |
| 16 | reasoning | 16 | 31 | 915 | \" |
| 17 | reasoning | 17 | 33 | 975 |  的结果 |
| 18 | reasoning | 18 | 35 | 1043 | 。 |
| 19 | reasoning | 19 | 37 | 1104 | 这是一个 |
| 20 | reasoning | 20 | 39 | 1174 | 简单的 |
| 21 | reasoning | 21 | 41 | 1241 | 数学 |
| 22 | reasoning | 22 | 43 | 1305 | 计算 |
| 23 | reasoning | 23 | 45 | 1369 | ， |
| 24 | reasoning | 24 | 47 | 1430 | 需要使用 |
| 25 | reasoning | 25 | 49 | 1500 |  calculate |
| 26 | reasoning | 26 | 51 | 1568 |  工具 |
| 27 | reasoning | 27 | 53 | 1633 | 来计算 |
| 28 | reasoning | 28 | 55 | 1700 | 表达式 |
| 29 | reasoning | 29 | 57 | 1767 |  \" |
| 30 | reasoning | 30 | 59 | 1828 | 3 |
| 31 | reasoning | 31 | 61 | 1887 | . |
| 32 | reasoning | 32 | 63 | 1946 | 7 |
| 33 | reasoning | 33 | 65 | 2005 | * |
| 34 | reasoning | 34 | 67 | 2064 | 1 |
| 35 | reasoning | 35 | 69 | 2123 | 2 |
| 36 | reasoning | 36 | 71 | 2182 | - |
| 37 | reasoning | 37 | 73 | 2241 | 8 |
| 38 | reasoning | 38 | 75 | 2300 | . |
| 39 | reasoning | 39 | 77 | 2359 | 2 |
| 40 | reasoning | 40 | 79 | 2418 | \" |
| 41 | reasoning | 41 | 81 | 2478 | 。 |
| 42 | reasoning | 42 | 83 | 2539 | \n\n |
| 43 | reasoning | 43 | 85 | 2601 | 让我 |
| 44 | reasoning | 44 | 87 | 2665 | 调用 |
| 45 | reasoning | 45 | 89 | 2729 |  calculate |
| 46 | reasoning | 46 | 91 | 2797 |  工具 |
| 47 | reasoning | 47 | 93 | 2862 | 来计算 |
| 48 | reasoning | 48 | 95 | 2929 | 这个 |
| 49 | reasoning | 49 | 97 | 2993 | 表达式 |
| 50 | reasoning | 50 | 99 | 3060 | 。 |
| 51 | reasoning | 51 | 101 | 3121 | \n |
| 52 | text | 52 | 103 | 3181 | \n\n |
| 53 | tool-call | 53 | 105 | 3241 | name=calculate args={\"expression\": \"3.7*12-8.2\"} |
