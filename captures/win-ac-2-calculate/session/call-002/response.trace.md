# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 68 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 43 |
| 正文 token（text） | 24 |
| tool_call 分片 | 0 |
| finish_reason | stop |
| 收到 [DONE] | 是 |
| 文件字节数 | 4119 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 要求 |
| 3 | reasoning | 3 | 5 | 128 | 计算 |
| 4 | reasoning | 4 | 7 | 192 |   |
| 5 | reasoning | 5 | 9 | 251 | 3 |
| 6 | reasoning | 6 | 11 | 310 | . |
| 7 | reasoning | 7 | 13 | 369 | 7 |
| 8 | reasoning | 8 | 15 | 428 |   |
| 9 | reasoning | 9 | 17 | 487 | 乘以 |
| 10 | reasoning | 10 | 19 | 551 |   |
| 11 | reasoning | 11 | 21 | 610 | 1 |
| 12 | reasoning | 12 | 23 | 669 | 2 |
| 13 | reasoning | 13 | 25 | 728 |   |
| 14 | reasoning | 14 | 27 | 787 | 再 |
| 15 | reasoning | 15 | 29 | 848 | 减 |
| 16 | reasoning | 16 | 31 | 909 |   |
| 17 | reasoning | 17 | 33 | 968 | 8 |
| 18 | reasoning | 18 | 35 | 1027 | . |
| 19 | reasoning | 19 | 37 | 1086 | 2 |
| 20 | reasoning | 20 | 39 | 1145 |   |
| 21 | reasoning | 21 | 41 | 1204 | 的结果 |
| 22 | reasoning | 22 | 43 | 1271 | 。 |
| 23 | reasoning | 23 | 45 | 1332 | 我已经 |
| 24 | reasoning | 24 | 47 | 1399 | 调 |
| 25 | reasoning | 25 | 49 | 1460 | 用了 |
| 26 | reasoning | 26 | 51 | 1524 |  calculate |
| 27 | reasoning | 27 | 53 | 1592 |   |
| 28 | reasoning | 28 | 55 | 1651 | 工具 |
| 29 | reasoning | 29 | 57 | 1715 | ， |
| 30 | reasoning | 30 | 59 | 1776 | 得到了 |
| 31 | reasoning | 31 | 61 | 1843 | 结果 |
| 32 | reasoning | 32 | 63 | 1907 |   |
| 33 | reasoning | 33 | 65 | 1966 | 3 |
| 34 | reasoning | 34 | 67 | 2025 | 6 |
| 35 | reasoning | 35 | 69 | 2084 | . |
| 36 | reasoning | 36 | 71 | 2143 | 2 |
| 37 | reasoning | 37 | 73 | 2202 | 。 |
| 38 | reasoning | 38 | 75 | 2263 | 现在我 |
| 39 | reasoning | 39 | 77 | 2330 | 可以直接 |
| 40 | reasoning | 40 | 79 | 2400 | 回答 |
| 41 | reasoning | 41 | 81 | 2464 | 用户 |
| 42 | reasoning | 42 | 83 | 2528 | 。 |
| 43 | reasoning | 43 | 85 | 2589 | \n |
| 44 | text | 44 | 87 | 2649 | 3 |
| 45 | text | 45 | 89 | 2706 | . |
| 46 | text | 46 | 91 | 2763 | 7 |
| 47 | text | 47 | 93 | 2820 |   |
| 48 | text | 48 | 95 | 2877 | 乘以 |
| 49 | text | 49 | 97 | 2939 |   |
| 50 | text | 50 | 99 | 2996 | 1 |
| 51 | text | 51 | 101 | 3053 | 2 |
| 52 | text | 52 | 103 | 3110 |   |
| 53 | text | 53 | 105 | 3167 | 再 |
| 54 | text | 54 | 107 | 3226 | 减 |
| 55 | text | 55 | 109 | 3285 |   |
| 56 | text | 56 | 111 | 3342 | 8 |
| 57 | text | 57 | 113 | 3399 | . |
| 58 | text | 58 | 115 | 3456 | 2 |
| 59 | text | 59 | 117 | 3513 |   |
| 60 | text | 60 | 119 | 3570 | 的结果 |
| 61 | text | 61 | 121 | 3635 | 是 |
| 62 | text | 62 | 123 | 3694 |   |
| 63 | text | 63 | 125 | 3751 | 3 |
| 64 | text | 64 | 127 | 3808 | 6 |
| 65 | text | 65 | 129 | 3865 | . |
| 66 | text | 66 | 131 | 3922 | 2 |
| 67 | text | 67 | 133 | 3979 | 。 |
