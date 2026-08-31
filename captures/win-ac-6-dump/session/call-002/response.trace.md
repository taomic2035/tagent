# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 70 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 41 |
| 正文 token（text） | 28 |
| tool_call 分片 | 0 |
| finish_reason | stop |
| 收到 [DONE] | 是 |
| 文件字节数 | 4292 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 询问 |
| 3 | reasoning | 3 | 5 | 128 | 上海 |
| 4 | reasoning | 4 | 7 | 192 | 天气 |
| 5 | reasoning | 5 | 9 | 256 | ， |
| 6 | reasoning | 6 | 11 | 317 | 我 |
| 7 | reasoning | 7 | 13 | 378 | 需要使用 |
| 8 | reasoning | 8 | 15 | 448 | get |
| 9 | reasoning | 9 | 17 | 509 | _weather |
| 10 | reasoning | 10 | 19 | 575 | 工具 |
| 11 | reasoning | 11 | 21 | 639 | 查询 |
| 12 | reasoning | 12 | 23 | 703 | 。 |
| 13 | reasoning | 13 | 25 | 764 | 工具 |
| 14 | reasoning | 14 | 27 | 828 | 返回 |
| 15 | reasoning | 15 | 29 | 892 | 了 |
| 16 | reasoning | 16 | 31 | 953 | 上海 |
| 17 | reasoning | 17 | 33 | 1017 | 天气 |
| 18 | reasoning | 18 | 35 | 1081 | 信息 |
| 19 | reasoning | 19 | 37 | 1145 | ： |
| 20 | reasoning | 20 | 39 | 1206 | 多云 |
| 21 | reasoning | 21 | 41 | 1270 | ， |
| 22 | reasoning | 22 | 43 | 1331 | 3 |
| 23 | reasoning | 23 | 45 | 1390 | 1 |
| 24 | reasoning | 24 | 47 | 1449 | ℃ |
| 25 | reasoning | 25 | 49 | 1510 | ， |
| 26 | reasoning | 26 | 51 | 1571 | 湿度 |
| 27 | reasoning | 27 | 53 | 1635 | 7 |
| 28 | reasoning | 28 | 55 | 1694 | 0 |
| 29 | reasoning | 29 | 57 | 1753 | %， |
| 30 | reasoning | 30 | 59 | 1815 | AQ |
| 31 | reasoning | 31 | 61 | 1875 | I |
| 32 | reasoning | 32 | 63 | 1934 |   |
| 33 | reasoning | 33 | 65 | 1993 | 4 |
| 34 | reasoning | 34 | 67 | 2052 | 8 |
| 35 | reasoning | 35 | 69 | 2111 | 。 |
| 36 | reasoning | 36 | 71 | 2172 | 我 |
| 37 | reasoning | 37 | 73 | 2233 | 可以直接 |
| 38 | reasoning | 38 | 75 | 2303 | 回答 |
| 39 | reasoning | 39 | 77 | 2367 | 用户 |
| 40 | reasoning | 40 | 79 | 2431 | 。 |
| 41 | reasoning | 41 | 81 | 2492 | \n |
| 42 | text | 42 | 83 | 2552 | 上海 |
| 43 | text | 43 | 85 | 2614 | 当前 |
| 44 | text | 44 | 87 | 2676 | 天气 |
| 45 | text | 45 | 89 | 2738 | 为 |
| 46 | text | 46 | 91 | 2797 | ： |
| 47 | text | 47 | 93 | 2856 | 多云 |
| 48 | text | 48 | 95 | 2918 | ， |
| 49 | text | 49 | 97 | 2977 | 温度 |
| 50 | text | 50 | 99 | 3039 |   |
| 51 | text | 51 | 101 | 3096 | 3 |
| 52 | text | 52 | 103 | 3153 | 1 |
| 53 | text | 53 | 105 | 3210 | ℃ |
| 54 | text | 54 | 107 | 3269 | ， |
| 55 | text | 55 | 109 | 3328 | 湿度 |
| 56 | text | 56 | 111 | 3390 |   |
| 57 | text | 57 | 113 | 3447 | 7 |
| 58 | text | 58 | 115 | 3504 | 0 |
| 59 | text | 59 | 117 | 3561 | %， |
| 60 | text | 60 | 119 | 3621 | 空气质量 |
| 61 | text | 61 | 121 | 3689 | 指数 |
| 62 | text | 62 | 123 | 3751 |  ( |
| 63 | text | 63 | 125 | 3809 | AQ |
| 64 | text | 64 | 127 | 3867 | I |
| 65 | text | 65 | 129 | 3924 | ) |
| 66 | text | 66 | 131 | 3981 |   |
| 67 | text | 67 | 133 | 4038 | 4 |
| 68 | text | 68 | 135 | 4095 | 8 |
| 69 | text | 69 | 137 | 4152 | 。 |
