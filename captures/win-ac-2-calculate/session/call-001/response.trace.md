# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 80 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 64 |
| 正文 token（text） | 0 |
| tool_call 分片 | 14 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 23793 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 要求 |
| 3 | reasoning | 4 | 7 | 875 | 计算 |
| 4 | reasoning | 5 | 9 | 1165 | 一个 |
| 5 | reasoning | 6 | 11 | 1455 | 数学 |
| 6 | reasoning | 7 | 13 | 1745 | 表达式 |
| 7 | reasoning | 8 | 15 | 2038 | ： |
| 8 | reasoning | 9 | 17 | 2325 | 3 |
| 9 | reasoning | 10 | 19 | 2610 | . |
| 10 | reasoning | 11 | 21 | 2895 | 7 |
| 11 | reasoning | 12 | 23 | 3180 |   |
| 12 | reasoning | 13 | 25 | 3465 | 乘以 |
| 13 | reasoning | 14 | 27 | 3755 |   |
| 14 | reasoning | 15 | 29 | 4040 | 1 |
| 15 | reasoning | 16 | 31 | 4325 | 2 |
| 16 | reasoning | 17 | 33 | 4610 |   |
| 17 | reasoning | 18 | 35 | 4895 | 再 |
| 18 | reasoning | 19 | 37 | 5182 | 减 |
| 19 | reasoning | 20 | 39 | 5469 |   |
| 20 | reasoning | 21 | 41 | 5754 | 8 |
| 21 | reasoning | 22 | 43 | 6039 | . |
| 22 | reasoning | 23 | 45 | 6324 | 2 |
| 23 | reasoning | 24 | 47 | 6609 | 。 |
| 24 | reasoning | 25 | 49 | 6896 | 这是一个 |
| 25 | reasoning | 26 | 51 | 7192 | 四 |
| 26 | reasoning | 27 | 53 | 7479 | 则 |
| 27 | reasoning | 28 | 55 | 7766 | 运算 |
| 28 | reasoning | 29 | 57 | 8056 | 计算 |
| 29 | reasoning | 30 | 59 | 8346 | 任务 |
| 30 | reasoning | 31 | 61 | 8636 | ， |
| 31 | reasoning | 32 | 63 | 8923 | 我 |
| 32 | reasoning | 33 | 65 | 9210 | 需要使用 |
| 33 | reasoning | 34 | 67 | 9506 |  calculate |
| 34 | reasoning | 35 | 69 | 9800 |   |
| 35 | reasoning | 36 | 71 | 10085 | 工具 |
| 36 | reasoning | 37 | 73 | 10375 | 来计算 |
| 37 | reasoning | 38 | 75 | 10668 | 。 |
| 38 | reasoning | 39 | 77 | 10955 | \n\n |
| 39 | reasoning | 40 | 79 | 11243 | 表达式 |
| 40 | reasoning | 41 | 81 | 11536 | 是 |
| 41 | reasoning | 42 | 83 | 11823 | ： |
| 42 | reasoning | 43 | 85 | 12110 | 3 |
| 43 | reasoning | 44 | 87 | 12395 | . |
| 44 | reasoning | 45 | 89 | 12680 | 7 |
| 45 | reasoning | 46 | 91 | 12965 |  * |
| 46 | reasoning | 47 | 93 | 13251 |   |
| 47 | reasoning | 48 | 95 | 13536 | 1 |
| 48 | reasoning | 49 | 97 | 13821 | 2 |
| 49 | reasoning | 50 | 99 | 14106 |  - |
| 50 | reasoning | 51 | 101 | 14392 |   |
| 51 | reasoning | 52 | 103 | 14677 | 8 |
| 52 | reasoning | 53 | 105 | 14962 | . |
| 53 | reasoning | 54 | 107 | 15247 | 2 |
| 54 | reasoning | 55 | 109 | 15532 | \n\n |
| 55 | reasoning | 56 | 111 | 15820 | 让我 |
| 56 | reasoning | 57 | 113 | 16110 | 调用 |
| 57 | reasoning | 58 | 115 | 16400 |  calculate |
| 58 | reasoning | 59 | 117 | 16694 |   |
| 59 | reasoning | 60 | 119 | 16979 | 工具 |
| 60 | reasoning | 61 | 121 | 17269 | 来计算 |
| 61 | reasoning | 62 | 123 | 17562 | 这个 |
| 62 | reasoning | 63 | 125 | 17852 | 表达式 |
| 63 | reasoning | 64 | 127 | 18145 | 。 |
| 64 | reasoning | 65 | 129 | 18432 | \n |
| 65 | tool-call | 66 | 131 | 18718 | name=calculate args={ |
| 66 | tool-call | 67 | 133 | 19112 | name=null args=\"expression\":\" |
| 67 | tool-call | 68 | 135 | 19445 | name=null args=3 |
| 68 | tool-call | 69 | 137 | 19762 | name=null args=. |
| 69 | tool-call | 70 | 139 | 20079 | name=null args=7 |
| 70 | tool-call | 71 | 141 | 20396 | name=null args=* |
| 71 | tool-call | 72 | 143 | 20713 | name=null args=1 |
| 72 | tool-call | 73 | 145 | 21030 | name=null args=2 |
| 73 | tool-call | 74 | 147 | 21347 | name=null args=- |
| 74 | tool-call | 75 | 149 | 21664 | name=null args=8 |
| 75 | tool-call | 76 | 151 | 21981 | name=null args=. |
| 76 | tool-call | 77 | 153 | 22298 | name=null args=2 |
| 77 | tool-call | 78 | 155 | 22615 | name=null args=\" |
| 78 | tool-call | 79 | 157 | 22933 | name=null args=} |
