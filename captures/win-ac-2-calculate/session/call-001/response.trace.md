# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 77 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 61 |
| 正文 token（text） | 0 |
| tool_call 分片 | 14 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 22924 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 让我 |
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
| 25 | reasoning | 26 | 51 | 7182 | 简单的 |
| 26 | reasoning | 27 | 53 | 7475 | 四 |
| 27 | reasoning | 28 | 55 | 7762 | 则 |
| 28 | reasoning | 29 | 57 | 8049 | 运算 |
| 29 | reasoning | 30 | 59 | 8339 | 计算 |
| 30 | reasoning | 31 | 61 | 8629 | ， |
| 31 | reasoning | 32 | 63 | 8916 | 我 |
| 32 | reasoning | 33 | 65 | 9203 | 需要使用 |
| 33 | reasoning | 34 | 67 | 9499 |  calculate |
| 34 | reasoning | 35 | 69 | 9793 |   |
| 35 | reasoning | 36 | 71 | 10078 | 工具 |
| 36 | reasoning | 37 | 73 | 10368 | 来完成 |
| 37 | reasoning | 38 | 75 | 10661 | 。 |
| 38 | reasoning | 39 | 77 | 10948 | \n\n |
| 39 | reasoning | 40 | 79 | 11236 | 表达式 |
| 40 | reasoning | 41 | 81 | 11529 | 应该是 |
| 41 | reasoning | 42 | 83 | 11822 | ： |
| 42 | reasoning | 43 | 85 | 12109 | 3 |
| 43 | reasoning | 44 | 87 | 12394 | . |
| 44 | reasoning | 45 | 89 | 12679 | 7 |
| 45 | reasoning | 46 | 91 | 12964 |  * |
| 46 | reasoning | 47 | 93 | 13250 |   |
| 47 | reasoning | 48 | 95 | 13535 | 1 |
| 48 | reasoning | 49 | 97 | 13820 | 2 |
| 49 | reasoning | 50 | 99 | 14105 |  - |
| 50 | reasoning | 51 | 101 | 14391 |   |
| 51 | reasoning | 52 | 103 | 14676 | 8 |
| 52 | reasoning | 53 | 105 | 14961 | . |
| 53 | reasoning | 54 | 107 | 15246 | 2 |
| 54 | reasoning | 55 | 109 | 15531 | \n\n |
| 55 | reasoning | 56 | 111 | 15819 | 让我 |
| 56 | reasoning | 57 | 113 | 16109 | 调用 |
| 57 | reasoning | 58 | 115 | 16399 |  calculate |
| 58 | reasoning | 59 | 117 | 16693 |   |
| 59 | reasoning | 60 | 119 | 16978 | 工具 |
| 60 | reasoning | 61 | 121 | 17268 | 。 |
| 61 | reasoning | 62 | 123 | 17555 | \n |
| 62 | tool-call | 63 | 125 | 17841 | name=calculate args={ |
| 63 | tool-call | 64 | 127 | 18235 | name=null args=\"expression\":\" |
| 64 | tool-call | 65 | 129 | 18568 | name=null args=3 |
| 65 | tool-call | 66 | 131 | 18885 | name=null args=. |
| 66 | tool-call | 67 | 133 | 19202 | name=null args=7 |
| 67 | tool-call | 68 | 135 | 19519 | name=null args=* |
| 68 | tool-call | 69 | 137 | 19836 | name=null args=1 |
| 69 | tool-call | 70 | 139 | 20153 | name=null args=2 |
| 70 | tool-call | 71 | 141 | 20470 | name=null args=- |
| 71 | tool-call | 72 | 143 | 20787 | name=null args=8 |
| 72 | tool-call | 73 | 145 | 21104 | name=null args=. |
| 73 | tool-call | 74 | 147 | 21421 | name=null args=2 |
| 74 | tool-call | 75 | 149 | 21738 | name=null args=\" |
| 75 | tool-call | 76 | 151 | 22056 | name=null args=} |
