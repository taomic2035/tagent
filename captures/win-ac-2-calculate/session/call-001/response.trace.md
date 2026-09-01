# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 75 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 59 |
| 正文 token（text） | 0 |
| tool_call 分片 | 14 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 22340 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 要求 |
| 3 | reasoning | 4 | 7 | 875 | 计算 |
| 4 | reasoning | 5 | 9 | 1165 |   |
| 5 | reasoning | 6 | 11 | 1450 | 3 |
| 6 | reasoning | 7 | 13 | 1735 | . |
| 7 | reasoning | 8 | 15 | 2020 | 7 |
| 8 | reasoning | 9 | 17 | 2305 |   |
| 9 | reasoning | 10 | 19 | 2590 | 乘以 |
| 10 | reasoning | 11 | 21 | 2880 |   |
| 11 | reasoning | 12 | 23 | 3165 | 1 |
| 12 | reasoning | 13 | 25 | 3450 | 2 |
| 13 | reasoning | 14 | 27 | 3735 |   |
| 14 | reasoning | 15 | 29 | 4020 | 再 |
| 15 | reasoning | 16 | 31 | 4307 | 减 |
| 16 | reasoning | 17 | 33 | 4594 |   |
| 17 | reasoning | 18 | 35 | 4879 | 8 |
| 18 | reasoning | 19 | 37 | 5164 | . |
| 19 | reasoning | 20 | 39 | 5449 | 2 |
| 20 | reasoning | 21 | 41 | 5734 |   |
| 21 | reasoning | 22 | 43 | 6019 | 等于 |
| 22 | reasoning | 23 | 45 | 6309 | 多少 |
| 23 | reasoning | 24 | 47 | 6599 | 。 |
| 24 | reasoning | 25 | 49 | 6886 | 这是一个 |
| 25 | reasoning | 26 | 51 | 7182 | 数学 |
| 26 | reasoning | 27 | 53 | 7472 | 计算 |
| 27 | reasoning | 28 | 55 | 7762 | 问题 |
| 28 | reasoning | 29 | 57 | 8052 | ， |
| 29 | reasoning | 30 | 59 | 8339 | 我 |
| 30 | reasoning | 31 | 61 | 8626 | 需要使用 |
| 31 | reasoning | 32 | 63 | 8922 |  calculate |
| 32 | reasoning | 33 | 65 | 9216 |   |
| 33 | reasoning | 34 | 67 | 9501 | 工具 |
| 34 | reasoning | 35 | 69 | 9791 | 来计算 |
| 35 | reasoning | 36 | 71 | 10084 | 。 |
| 36 | reasoning | 37 | 73 | 10371 | \n\n |
| 37 | reasoning | 38 | 75 | 10659 | 表达式 |
| 38 | reasoning | 39 | 77 | 10952 | 是 |
| 39 | reasoning | 40 | 79 | 11239 | ： |
| 40 | reasoning | 41 | 81 | 11526 | 3 |
| 41 | reasoning | 42 | 83 | 11811 | . |
| 42 | reasoning | 43 | 85 | 12096 | 7 |
| 43 | reasoning | 44 | 87 | 12381 |  * |
| 44 | reasoning | 45 | 89 | 12667 |   |
| 45 | reasoning | 46 | 91 | 12952 | 1 |
| 46 | reasoning | 47 | 93 | 13237 | 2 |
| 47 | reasoning | 48 | 95 | 13522 |  - |
| 48 | reasoning | 49 | 97 | 13808 |   |
| 49 | reasoning | 50 | 99 | 14093 | 8 |
| 50 | reasoning | 51 | 101 | 14378 | . |
| 51 | reasoning | 52 | 103 | 14663 | 2 |
| 52 | reasoning | 53 | 105 | 14948 | \n\n |
| 53 | reasoning | 54 | 107 | 15236 | 让我 |
| 54 | reasoning | 55 | 109 | 15526 | 调用 |
| 55 | reasoning | 56 | 111 | 15816 |  calculate |
| 56 | reasoning | 57 | 113 | 16110 |   |
| 57 | reasoning | 58 | 115 | 16395 | 工具 |
| 58 | reasoning | 59 | 117 | 16685 | 。 |
| 59 | reasoning | 60 | 119 | 16972 | \n |
| 60 | tool-call | 61 | 121 | 17258 | name=calculate args={ |
| 61 | tool-call | 62 | 123 | 17652 | name=null args=\"expression\":\" |
| 62 | tool-call | 63 | 125 | 17985 | name=null args=3 |
| 63 | tool-call | 64 | 127 | 18302 | name=null args=. |
| 64 | tool-call | 65 | 129 | 18619 | name=null args=7 |
| 65 | tool-call | 66 | 131 | 18936 | name=null args=* |
| 66 | tool-call | 67 | 133 | 19253 | name=null args=1 |
| 67 | tool-call | 68 | 135 | 19570 | name=null args=2 |
| 68 | tool-call | 69 | 137 | 19887 | name=null args=- |
| 69 | tool-call | 70 | 139 | 20204 | name=null args=8 |
| 70 | tool-call | 71 | 141 | 20521 | name=null args=. |
| 71 | tool-call | 72 | 143 | 20838 | name=null args=2 |
| 72 | tool-call | 73 | 145 | 21155 | name=null args=\" |
| 73 | tool-call | 74 | 147 | 21473 | name=null args=} |
