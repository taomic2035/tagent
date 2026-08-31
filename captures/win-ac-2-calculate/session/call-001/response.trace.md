# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 81 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 64 |
| 正文 token（text） | 0 |
| tool_call 分片 | 16 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 5704 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 让我 |
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
| 21 | reasoning | 21 | 41 | 1204 | 等于 |
| 22 | reasoning | 22 | 43 | 1268 | 多少 |
| 23 | reasoning | 23 | 45 | 1332 | 。 |
| 24 | reasoning | 24 | 47 | 1393 | 这是一个 |
| 25 | reasoning | 25 | 49 | 1463 | 简单的 |
| 26 | reasoning | 26 | 51 | 1530 | 四 |
| 27 | reasoning | 27 | 53 | 1591 | 则 |
| 28 | reasoning | 28 | 55 | 1652 | 运算 |
| 29 | reasoning | 29 | 57 | 1716 | 表达式 |
| 30 | reasoning | 30 | 59 | 1783 | ， |
| 31 | reasoning | 31 | 61 | 1844 | 我 |
| 32 | reasoning | 32 | 63 | 1905 | 需要使用 |
| 33 | reasoning | 33 | 65 | 1975 |  calculate |
| 34 | reasoning | 34 | 67 | 2043 |   |
| 35 | reasoning | 35 | 69 | 2102 | 工具 |
| 36 | reasoning | 36 | 71 | 2166 | 来计算 |
| 37 | reasoning | 37 | 73 | 2233 | 。 |
| 38 | reasoning | 38 | 75 | 2294 | \n\n |
| 39 | reasoning | 39 | 77 | 2356 | 表达式 |
| 40 | reasoning | 40 | 79 | 2423 | 是 |
| 41 | reasoning | 41 | 81 | 2484 | ： |
| 42 | reasoning | 42 | 83 | 2545 | 3 |
| 43 | reasoning | 43 | 85 | 2604 | . |
| 44 | reasoning | 44 | 87 | 2663 | 7 |
| 45 | reasoning | 45 | 89 | 2722 |  * |
| 46 | reasoning | 46 | 91 | 2782 |   |
| 47 | reasoning | 47 | 93 | 2841 | 1 |
| 48 | reasoning | 48 | 95 | 2900 | 2 |
| 49 | reasoning | 49 | 97 | 2959 |  - |
| 50 | reasoning | 50 | 99 | 3019 |   |
| 51 | reasoning | 51 | 101 | 3078 | 8 |
| 52 | reasoning | 52 | 103 | 3137 | . |
| 53 | reasoning | 53 | 105 | 3196 | 2 |
| 54 | reasoning | 54 | 107 | 3255 | \n\n |
| 55 | reasoning | 55 | 109 | 3317 | 让我 |
| 56 | reasoning | 56 | 111 | 3381 | 调用 |
| 57 | reasoning | 57 | 113 | 3445 |  calculate |
| 58 | reasoning | 58 | 115 | 3513 |   |
| 59 | reasoning | 59 | 117 | 3572 | 工具 |
| 60 | reasoning | 60 | 119 | 3636 | 来计算 |
| 61 | reasoning | 61 | 121 | 3703 | 这个 |
| 62 | reasoning | 62 | 123 | 3767 | 表达式 |
| 63 | reasoning | 63 | 125 | 3834 | 。 |
| 64 | reasoning | 64 | 127 | 3895 | \n |
| 65 | tool-call | 65 | 129 | 3955 | name=calculate args={ |
| 66 | tool-call | 66 | 131 | 4113 | name=null args=\"expression\":\" |
| 67 | tool-call | 67 | 133 | 4228 | name=null args=3 |
| 68 | tool-call | 68 | 135 | 4327 | name=null args=. |
| 69 | tool-call | 69 | 137 | 4426 | name=null args=7 |
| 70 | tool-call | 70 | 139 | 4525 | name=null args= * |
| 71 | tool-call | 71 | 141 | 4625 | name=null args=  |
| 72 | tool-call | 72 | 143 | 4724 | name=null args=1 |
| 73 | tool-call | 73 | 145 | 4823 | name=null args=2 |
| 74 | tool-call | 74 | 147 | 4922 | name=null args= - |
| 75 | tool-call | 75 | 149 | 5022 | name=null args=  |
| 76 | tool-call | 76 | 151 | 5121 | name=null args=8 |
| 77 | tool-call | 77 | 153 | 5220 | name=null args=. |
| 78 | tool-call | 78 | 155 | 5319 | name=null args=2 |
| 79 | tool-call | 79 | 157 | 5418 | name=null args=\" |
| 80 | tool-call | 80 | 159 | 5518 | name=null args=} |
