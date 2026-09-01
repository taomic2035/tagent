# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 79 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 61 |
| 正文 token（text） | 0 |
| tool_call 分片 | 16 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 23560 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 让我 |
| 3 | reasoning | 4 | 7 | 875 | 计算 |
| 4 | reasoning | 5 | 9 | 1165 |  \" |
| 5 | reasoning | 6 | 11 | 1452 | 3 |
| 6 | reasoning | 7 | 13 | 1737 | . |
| 7 | reasoning | 8 | 15 | 2022 | 7 |
| 8 | reasoning | 9 | 17 | 2307 |   |
| 9 | reasoning | 10 | 19 | 2592 | 乘以 |
| 10 | reasoning | 11 | 21 | 2882 |   |
| 11 | reasoning | 12 | 23 | 3167 | 1 |
| 12 | reasoning | 13 | 25 | 3452 | 2 |
| 13 | reasoning | 14 | 27 | 3737 |   |
| 14 | reasoning | 15 | 29 | 4022 | 再 |
| 15 | reasoning | 16 | 31 | 4309 | 减 |
| 16 | reasoning | 17 | 33 | 4596 |   |
| 17 | reasoning | 18 | 35 | 4881 | 8 |
| 18 | reasoning | 19 | 37 | 5166 | . |
| 19 | reasoning | 20 | 39 | 5451 | 2 |
| 20 | reasoning | 21 | 41 | 5736 | \" |
| 21 | reasoning | 22 | 43 | 6022 |   |
| 22 | reasoning | 23 | 45 | 6307 | 等于 |
| 23 | reasoning | 24 | 47 | 6597 | 多少 |
| 24 | reasoning | 25 | 49 | 6887 | 。 |
| 25 | reasoning | 26 | 51 | 7174 | \n\n |
| 26 | reasoning | 27 | 53 | 7462 | 这是一个 |
| 27 | reasoning | 28 | 55 | 7758 | 数学 |
| 28 | reasoning | 29 | 57 | 8048 | 计算 |
| 29 | reasoning | 30 | 59 | 8338 | 问题 |
| 30 | reasoning | 31 | 61 | 8628 | ， |
| 31 | reasoning | 32 | 63 | 8915 | 我 |
| 32 | reasoning | 33 | 65 | 9202 | 需要使用 |
| 33 | reasoning | 34 | 67 | 9498 |  calculate |
| 34 | reasoning | 35 | 69 | 9792 |   |
| 35 | reasoning | 36 | 71 | 10077 | 工具 |
| 36 | reasoning | 37 | 73 | 10367 | 来计算 |
| 37 | reasoning | 38 | 75 | 10660 | 。 |
| 38 | reasoning | 39 | 77 | 10947 | \n\n |
| 39 | reasoning | 40 | 79 | 11235 | 表达式 |
| 40 | reasoning | 41 | 81 | 11528 | 应该是 |
| 41 | reasoning | 42 | 83 | 11821 | ： |
| 42 | reasoning | 43 | 85 | 12108 | 3 |
| 43 | reasoning | 44 | 87 | 12393 | . |
| 44 | reasoning | 45 | 89 | 12678 | 7 |
| 45 | reasoning | 46 | 91 | 12963 |  * |
| 46 | reasoning | 47 | 93 | 13249 |   |
| 47 | reasoning | 48 | 95 | 13534 | 1 |
| 48 | reasoning | 49 | 97 | 13819 | 2 |
| 49 | reasoning | 50 | 99 | 14104 |  - |
| 50 | reasoning | 51 | 101 | 14390 |   |
| 51 | reasoning | 52 | 103 | 14675 | 8 |
| 52 | reasoning | 53 | 105 | 14960 | . |
| 53 | reasoning | 54 | 107 | 15245 | 2 |
| 54 | reasoning | 55 | 109 | 15530 | \n\n |
| 55 | reasoning | 56 | 111 | 15818 | 让我 |
| 56 | reasoning | 57 | 113 | 16108 | 调用 |
| 57 | reasoning | 58 | 115 | 16398 |  calculate |
| 58 | reasoning | 59 | 117 | 16692 |   |
| 59 | reasoning | 60 | 119 | 16977 | 工具 |
| 60 | reasoning | 61 | 121 | 17267 | 。 |
| 61 | reasoning | 62 | 123 | 17554 | \n |
| 62 | tool-call | 63 | 125 | 17840 | name=calculate args={ |
| 63 | tool-call | 64 | 127 | 18234 | name=null args=\"expression\":\" |
| 64 | tool-call | 65 | 129 | 18567 | name=null args=3 |
| 65 | tool-call | 66 | 131 | 18884 | name=null args=. |
| 66 | tool-call | 67 | 133 | 19201 | name=null args=7 |
| 67 | tool-call | 68 | 135 | 19518 | name=null args= * |
| 68 | tool-call | 69 | 137 | 19836 | name=null args=  |
| 69 | tool-call | 70 | 139 | 20153 | name=null args=1 |
| 70 | tool-call | 71 | 141 | 20470 | name=null args=2 |
| 71 | tool-call | 72 | 143 | 20787 | name=null args= - |
| 72 | tool-call | 73 | 145 | 21105 | name=null args=  |
| 73 | tool-call | 74 | 147 | 21422 | name=null args=8 |
| 74 | tool-call | 75 | 149 | 21739 | name=null args=. |
| 75 | tool-call | 76 | 151 | 22056 | name=null args=2 |
| 76 | tool-call | 77 | 153 | 22373 | name=null args=\" |
| 77 | tool-call | 78 | 155 | 22691 | name=null args=} |
