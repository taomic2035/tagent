# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 79 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 63 |
| 正文 token（text） | 0 |
| tool_call 分片 | 14 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 23505 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想要 |
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
| 21 | reasoning | 22 | 43 | 6019 | 的结果 |
| 22 | reasoning | 23 | 45 | 6312 | 。 |
| 23 | reasoning | 24 | 47 | 6599 | 这是一个 |
| 24 | reasoning | 25 | 49 | 6895 | 四 |
| 25 | reasoning | 26 | 51 | 7182 | 则 |
| 26 | reasoning | 27 | 53 | 7469 | 运算 |
| 27 | reasoning | 28 | 55 | 7759 | 计算 |
| 28 | reasoning | 29 | 57 | 8049 | 问题 |
| 29 | reasoning | 30 | 59 | 8339 | ， |
| 30 | reasoning | 31 | 61 | 8626 | 我 |
| 31 | reasoning | 32 | 63 | 8913 | 需要使用 |
| 32 | reasoning | 33 | 65 | 9209 |  calculate |
| 33 | reasoning | 34 | 67 | 9503 |   |
| 34 | reasoning | 35 | 69 | 9788 | 工具 |
| 35 | reasoning | 36 | 71 | 10078 | 来计算 |
| 36 | reasoning | 37 | 73 | 10371 | 。 |
| 37 | reasoning | 38 | 75 | 10658 | \n\n |
| 38 | reasoning | 39 | 77 | 10946 | 表达式 |
| 39 | reasoning | 40 | 79 | 11239 | 是 |
| 40 | reasoning | 41 | 81 | 11526 | ： |
| 41 | reasoning | 42 | 83 | 11813 | 3 |
| 42 | reasoning | 43 | 85 | 12098 | . |
| 43 | reasoning | 44 | 87 | 12383 | 7 |
| 44 | reasoning | 45 | 89 | 12668 |  * |
| 45 | reasoning | 46 | 91 | 12954 |   |
| 46 | reasoning | 47 | 93 | 13239 | 1 |
| 47 | reasoning | 48 | 95 | 13524 | 2 |
| 48 | reasoning | 49 | 97 | 13809 |  - |
| 49 | reasoning | 50 | 99 | 14095 |   |
| 50 | reasoning | 51 | 101 | 14380 | 8 |
| 51 | reasoning | 52 | 103 | 14665 | . |
| 52 | reasoning | 53 | 105 | 14950 | 2 |
| 53 | reasoning | 54 | 107 | 15235 | \n\n |
| 54 | reasoning | 55 | 109 | 15523 | 让我 |
| 55 | reasoning | 56 | 111 | 15813 | 调用 |
| 56 | reasoning | 57 | 113 | 16103 |  calculate |
| 57 | reasoning | 58 | 115 | 16397 |   |
| 58 | reasoning | 59 | 117 | 16682 | 工具 |
| 59 | reasoning | 60 | 119 | 16972 | 来计算 |
| 60 | reasoning | 61 | 121 | 17265 | 这个 |
| 61 | reasoning | 62 | 123 | 17555 | 表达式 |
| 62 | reasoning | 63 | 125 | 17848 | 。 |
| 63 | reasoning | 64 | 127 | 18135 | \n |
| 64 | tool-call | 65 | 129 | 18421 | name=calculate args={ |
| 65 | tool-call | 66 | 131 | 18815 | name=null args=\"expression\":\" |
| 66 | tool-call | 67 | 133 | 19148 | name=null args=3 |
| 67 | tool-call | 68 | 135 | 19465 | name=null args=. |
| 68 | tool-call | 69 | 137 | 19782 | name=null args=7 |
| 69 | tool-call | 70 | 139 | 20099 | name=null args=* |
| 70 | tool-call | 71 | 141 | 20416 | name=null args=1 |
| 71 | tool-call | 72 | 143 | 20733 | name=null args=2 |
| 72 | tool-call | 73 | 145 | 21050 | name=null args=- |
| 73 | tool-call | 74 | 147 | 21367 | name=null args=8 |
| 74 | tool-call | 75 | 149 | 21684 | name=null args=. |
| 75 | tool-call | 76 | 151 | 22001 | name=null args=2 |
| 76 | tool-call | 77 | 153 | 22318 | name=null args=\" |
| 77 | tool-call | 78 | 155 | 22636 | name=null args=} |
