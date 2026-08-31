# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 63 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 46 |
| 正文 token（text） | 0 |
| tool_call 分片 | 15 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 18916 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 广州 |
| 2 | reasoning | 3 | 5 | 585 | 的温度 |
| 3 | reasoning | 4 | 7 | 878 | 是 |
| 4 | reasoning | 5 | 9 | 1165 | 3 |
| 5 | reasoning | 6 | 11 | 1450 | 3 |
| 6 | reasoning | 7 | 13 | 1735 | 度 |
| 7 | reasoning | 8 | 15 | 2022 | ， |
| 8 | reasoning | 9 | 17 | 2309 | 深圳 |
| 9 | reasoning | 10 | 19 | 2599 | 的温度 |
| 10 | reasoning | 11 | 21 | 2892 | 是 |
| 11 | reasoning | 12 | 23 | 3179 | 3 |
| 12 | reasoning | 13 | 25 | 3464 | 2 |
| 13 | reasoning | 14 | 27 | 3749 | 度 |
| 14 | reasoning | 15 | 29 | 4036 | 。 |
| 15 | reasoning | 16 | 31 | 4323 | 现在 |
| 16 | reasoning | 17 | 33 | 4613 | 需要 |
| 17 | reasoning | 18 | 35 | 4903 | 计算 |
| 18 | reasoning | 19 | 37 | 5193 | 平均值 |
| 19 | reasoning | 20 | 39 | 5486 | ： |
| 20 | reasoning | 21 | 41 | 5773 | ( |
| 21 | reasoning | 22 | 43 | 6058 | 3 |
| 22 | reasoning | 23 | 45 | 6343 | 3 |
| 23 | reasoning | 24 | 47 | 6628 |  + |
| 24 | reasoning | 25 | 49 | 6914 |   |
| 25 | reasoning | 26 | 51 | 7199 | 3 |
| 26 | reasoning | 27 | 53 | 7484 | 2 |
| 27 | reasoning | 28 | 55 | 7769 | ) |
| 28 | reasoning | 29 | 57 | 8054 |  / |
| 29 | reasoning | 30 | 59 | 8340 |   |
| 30 | reasoning | 31 | 61 | 8625 | 2 |
| 31 | reasoning | 32 | 63 | 8910 |  = |
| 32 | reasoning | 33 | 65 | 9196 |   |
| 33 | reasoning | 34 | 67 | 9481 | 3 |
| 34 | reasoning | 35 | 69 | 9766 | 2 |
| 35 | reasoning | 36 | 71 | 10051 | . |
| 36 | reasoning | 37 | 73 | 10336 | 5 |
| 37 | reasoning | 38 | 75 | 10621 | 。 |
| 38 | reasoning | 39 | 77 | 10908 | \n\n |
| 39 | reasoning | 40 | 79 | 11196 | 让我 |
| 40 | reasoning | 41 | 81 | 11486 | 用 |
| 41 | reasoning | 42 | 83 | 11773 | calculate |
| 42 | reasoning | 43 | 85 | 12066 | 工具 |
| 43 | reasoning | 44 | 87 | 12356 | 来计算 |
| 44 | reasoning | 45 | 89 | 12649 | 平均值 |
| 45 | reasoning | 46 | 91 | 12942 | 。 |
| 46 | reasoning | 47 | 93 | 13229 | \n |
| 47 | tool-call | 48 | 95 | 13515 | name=calculate args={ |
| 48 | tool-call | 49 | 97 | 13909 | name=null args=\"expression\":\" |
| 49 | tool-call | 50 | 99 | 14242 | name=null args=( |
| 50 | tool-call | 51 | 101 | 14559 | name=null args=3 |
| 51 | tool-call | 52 | 103 | 14876 | name=null args=3 |
| 52 | tool-call | 53 | 105 | 15193 | name=null args= + |
| 53 | tool-call | 54 | 107 | 15511 | name=null args=  |
| 54 | tool-call | 55 | 109 | 15828 | name=null args=3 |
| 55 | tool-call | 56 | 111 | 16145 | name=null args=2 |
| 56 | tool-call | 57 | 113 | 16462 | name=null args=) |
| 57 | tool-call | 58 | 115 | 16779 | name=null args= / |
| 58 | tool-call | 59 | 117 | 17097 | name=null args=  |
| 59 | tool-call | 60 | 119 | 17414 | name=null args=2 |
| 60 | tool-call | 61 | 121 | 17731 | name=null args=\" |
| 61 | tool-call | 62 | 123 | 18049 | name=null args=} |
