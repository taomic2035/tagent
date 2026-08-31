# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 65 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 59 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 4379 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 询问 |
| 3 | reasoning | 3 | 5 | 128 | 上海 |
| 4 | reasoning | 4 | 7 | 192 | 天气 |
| 5 | reasoning | 5 | 9 | 256 | 怎么样 |
| 6 | reasoning | 6 | 11 | 323 | ， |
| 7 | reasoning | 7 | 13 | 384 | 我 |
| 8 | reasoning | 8 | 15 | 445 | 需要使用 |
| 9 | reasoning | 9 | 17 | 515 |  get |
| 10 | reasoning | 10 | 19 | 577 | _weather |
| 11 | reasoning | 11 | 21 | 643 |   |
| 12 | reasoning | 12 | 23 | 702 | 工具 |
| 13 | reasoning | 13 | 25 | 766 | 来 |
| 14 | reasoning | 14 | 27 | 827 | 查询 |
| 15 | reasoning | 15 | 29 | 891 | 上海 |
| 16 | reasoning | 16 | 31 | 955 | 的天气 |
| 17 | reasoning | 17 | 33 | 1022 | 。 |
| 18 | reasoning | 18 | 35 | 1083 | 根据 |
| 19 | reasoning | 19 | 37 | 1147 | 工具 |
| 20 | reasoning | 20 | 39 | 1211 | 描述 |
| 21 | reasoning | 21 | 41 | 1275 | ， |
| 22 | reasoning | 22 | 43 | 1336 | 这个 |
| 23 | reasoning | 23 | 45 | 1400 | 工具 |
| 24 | reasoning | 24 | 47 | 1464 | 支持 |
| 25 | reasoning | 25 | 49 | 1528 | 查询 |
| 26 | reasoning | 26 | 51 | 1592 | 北京 |
| 27 | reasoning | 27 | 53 | 1656 | / |
| 28 | reasoning | 28 | 55 | 1715 | 上海 |
| 29 | reasoning | 29 | 57 | 1779 | / |
| 30 | reasoning | 30 | 59 | 1838 | 广州 |
| 31 | reasoning | 31 | 61 | 1902 | / |
| 32 | reasoning | 32 | 63 | 1961 | 深圳 |
| 33 | reasoning | 33 | 65 | 2025 | / |
| 34 | reasoning | 34 | 67 | 2084 | 杭州 |
| 35 | reasoning | 35 | 69 | 2148 | 的天气 |
| 36 | reasoning | 36 | 71 | 2215 | ， |
| 37 | reasoning | 37 | 73 | 2276 | 上海 |
| 38 | reasoning | 38 | 75 | 2340 | 是 |
| 39 | reasoning | 39 | 77 | 2401 | 支持 |
| 40 | reasoning | 40 | 79 | 2465 | 的城市 |
| 41 | reasoning | 41 | 81 | 2532 | 之一 |
| 42 | reasoning | 42 | 83 | 2596 | 。 |
| 43 | reasoning | 43 | 85 | 2657 | \n\n |
| 44 | reasoning | 44 | 87 | 2719 | 我需要 |
| 45 | reasoning | 45 | 89 | 2786 | 调用 |
| 46 | reasoning | 46 | 91 | 2850 |  get |
| 47 | reasoning | 47 | 93 | 2912 | _weather |
| 48 | reasoning | 48 | 95 | 2978 |   |
| 49 | reasoning | 49 | 97 | 3037 | 工具 |
| 50 | reasoning | 50 | 99 | 3101 | ， |
| 51 | reasoning | 51 | 101 | 3162 | 参数 |
| 52 | reasoning | 52 | 103 | 3226 |  city |
| 53 | reasoning | 53 | 105 | 3289 |   |
| 54 | reasoning | 54 | 107 | 3348 | 设置为 |
| 55 | reasoning | 55 | 109 | 3415 | \" |
| 56 | reasoning | 56 | 111 | 3475 | 上海 |
| 57 | reasoning | 57 | 113 | 3539 | \" |
| 58 | reasoning | 58 | 115 | 3599 | 。 |
| 59 | reasoning | 59 | 117 | 3660 | \n |
| 60 | tool-call | 60 | 119 | 3720 | name=get_weather args={ |
| 61 | tool-call | 61 | 121 | 3880 | name=null args=\"city\":\" |
| 62 | tool-call | 62 | 123 | 3989 | name=null args=上海 |
| 63 | tool-call | 63 | 125 | 4093 | name=null args=\" |
| 64 | tool-call | 64 | 127 | 4193 | name=null args=} |
