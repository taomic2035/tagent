# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 70 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 56 |
| 正文 token（text） | 0 |
| tool_call 分片 | 12 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 20817 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 我需要 |
| 2 | reasoning | 3 | 5 | 588 | 计算 |
| 3 | reasoning | 4 | 7 | 878 | 北京 |
| 4 | reasoning | 5 | 9 | 1168 | 和上海 |
| 5 | reasoning | 6 | 11 | 1461 | 温度的 |
| 6 | reasoning | 7 | 13 | 1754 | 平均值 |
| 7 | reasoning | 8 | 15 | 2047 | 。 |
| 8 | reasoning | 9 | 17 | 2334 | \n |
| 9 | reasoning | 10 | 19 | 2620 | 北京 |
| 10 | reasoning | 11 | 21 | 2910 | 温度 |
| 11 | reasoning | 12 | 23 | 3200 | ： |
| 12 | reasoning | 13 | 25 | 3487 | 2 |
| 13 | reasoning | 14 | 27 | 3772 | 8 |
| 14 | reasoning | 15 | 29 | 4057 | °C |
| 15 | reasoning | 16 | 31 | 4344 | \n |
| 16 | reasoning | 17 | 33 | 4630 | 上海 |
| 17 | reasoning | 18 | 35 | 4920 | 温度 |
| 18 | reasoning | 19 | 37 | 5210 | ： |
| 19 | reasoning | 20 | 39 | 5497 | 3 |
| 20 | reasoning | 21 | 41 | 5782 | 1 |
| 21 | reasoning | 22 | 43 | 6067 | °C |
| 22 | reasoning | 23 | 45 | 6354 | \n |
| 23 | reasoning | 24 | 47 | 6640 | 平均值 |
| 24 | reasoning | 25 | 49 | 6933 |  = |
| 25 | reasoning | 26 | 51 | 7219 |  ( |
| 26 | reasoning | 27 | 53 | 7505 | 2 |
| 27 | reasoning | 28 | 55 | 7790 | 8 |
| 28 | reasoning | 29 | 57 | 8075 |  + |
| 29 | reasoning | 30 | 59 | 8361 |   |
| 30 | reasoning | 31 | 61 | 8646 | 3 |
| 31 | reasoning | 32 | 63 | 8931 | 1 |
| 32 | reasoning | 33 | 65 | 9216 | ) |
| 33 | reasoning | 34 | 67 | 9501 |  / |
| 34 | reasoning | 35 | 69 | 9787 |   |
| 35 | reasoning | 36 | 71 | 10072 | 2 |
| 36 | reasoning | 37 | 73 | 10357 |  = |
| 37 | reasoning | 38 | 75 | 10643 |   |
| 38 | reasoning | 39 | 77 | 10928 | 5 |
| 39 | reasoning | 40 | 79 | 11213 | 9 |
| 40 | reasoning | 41 | 81 | 11498 |  / |
| 41 | reasoning | 42 | 83 | 11784 |   |
| 42 | reasoning | 43 | 85 | 12069 | 2 |
| 43 | reasoning | 44 | 87 | 12354 |  = |
| 44 | reasoning | 45 | 89 | 12640 |   |
| 45 | reasoning | 46 | 91 | 12925 | 2 |
| 46 | reasoning | 47 | 93 | 13210 | 9 |
| 47 | reasoning | 48 | 95 | 13495 | . |
| 48 | reasoning | 49 | 97 | 13780 | 5 |
| 49 | reasoning | 50 | 99 | 14065 | \n\n |
| 50 | reasoning | 51 | 101 | 14353 | 让我 |
| 51 | reasoning | 52 | 103 | 14643 | 用 |
| 52 | reasoning | 53 | 105 | 14930 | 计算 |
| 53 | reasoning | 54 | 107 | 15220 | 工具 |
| 54 | reasoning | 55 | 109 | 15510 | 来计算 |
| 55 | reasoning | 56 | 111 | 15803 | 。 |
| 56 | reasoning | 57 | 113 | 16090 | \n |
| 57 | tool-call | 58 | 115 | 16376 | name=calculate args={ |
| 58 | tool-call | 59 | 117 | 16770 | name=null args=\"expression\":\" |
| 59 | tool-call | 60 | 119 | 17103 | name=null args=( |
| 60 | tool-call | 61 | 121 | 17420 | name=null args=2 |
| 61 | tool-call | 62 | 123 | 17737 | name=null args=8 |
| 62 | tool-call | 63 | 125 | 18054 | name=null args=+ |
| 63 | tool-call | 64 | 127 | 18371 | name=null args=3 |
| 64 | tool-call | 65 | 129 | 18688 | name=null args=1 |
| 65 | tool-call | 66 | 131 | 19005 | name=null args=)/ |
| 66 | tool-call | 67 | 133 | 19323 | name=null args=2 |
| 67 | tool-call | 68 | 135 | 19640 | name=null args=\" |
| 68 | tool-call | 69 | 137 | 19958 | name=null args=} |
