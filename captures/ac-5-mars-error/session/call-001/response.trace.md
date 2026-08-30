# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 68 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 65 |
| 正文 token（text） | 1 |
| tool_call 分片 | 1 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 4453 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 要求 |
| 3 | reasoning | 3 | 5 | 128 | 调用 |
| 4 | reasoning | 4 | 7 | 192 |  get |
| 5 | reasoning | 5 | 9 | 254 | _weather |
| 6 | reasoning | 6 | 11 | 320 |  工具 |
| 7 | reasoning | 7 | 13 | 385 | 查询 |
| 8 | reasoning | 8 | 15 | 449 | 火星 |
| 9 | reasoning | 9 | 17 | 513 | 的天气 |
| 10 | reasoning | 10 | 19 | 580 | 。 |
| 11 | reasoning | 11 | 21 | 641 | 但是 |
| 12 | reasoning | 12 | 23 | 705 | 根据 |
| 13 | reasoning | 13 | 25 | 769 | 工具 |
| 14 | reasoning | 14 | 27 | 833 | 定义 |
| 15 | reasoning | 15 | 29 | 897 | ， |
| 16 | reasoning | 16 | 31 | 958 | get |
| 17 | reasoning | 17 | 33 | 1019 | _weather |
| 18 | reasoning | 18 | 35 | 1085 |  工具 |
| 19 | reasoning | 19 | 37 | 1150 | 仅 |
| 20 | reasoning | 20 | 39 | 1211 | 支持 |
| 21 | reasoning | 21 | 41 | 1275 | 查询 |
| 22 | reasoning | 22 | 43 | 1339 | 以下 |
| 23 | reasoning | 23 | 45 | 1403 | 城市的 |
| 24 | reasoning | 24 | 47 | 1470 | 天气 |
| 25 | reasoning | 25 | 49 | 1534 | ： |
| 26 | reasoning | 26 | 51 | 1595 | 北京 |
| 27 | reasoning | 27 | 53 | 1659 | / |
| 28 | reasoning | 28 | 55 | 1718 | 上海 |
| 29 | reasoning | 29 | 57 | 1782 | / |
| 30 | reasoning | 30 | 59 | 1841 | 广州 |
| 31 | reasoning | 31 | 61 | 1905 | / |
| 32 | reasoning | 32 | 63 | 1964 | 深圳 |
| 33 | reasoning | 33 | 65 | 2028 | / |
| 34 | reasoning | 34 | 67 | 2087 | 杭州 |
| 35 | reasoning | 35 | 69 | 2151 | 。 |
| 36 | reasoning | 36 | 71 | 2212 | 火星 |
| 37 | reasoning | 37 | 73 | 2276 | （ |
| 38 | reasoning | 38 | 75 | 2337 | M |
| 39 | reasoning | 39 | 77 | 2396 | ars |
| 40 | reasoning | 40 | 79 | 2457 | ） |
| 41 | reasoning | 41 | 81 | 2518 | 不在 |
| 42 | reasoning | 42 | 83 | 2582 | 支持 |
| 43 | reasoning | 43 | 85 | 2646 | 的城市 |
| 44 | reasoning | 44 | 87 | 2713 | 列表中 |
| 45 | reasoning | 45 | 89 | 2780 | 。 |
| 46 | reasoning | 46 | 91 | 2841 | \n\n |
| 47 | reasoning | 47 | 93 | 2903 | 我应该 |
| 48 | reasoning | 48 | 95 | 2970 | 如实 |
| 49 | reasoning | 49 | 97 | 3034 | 告知 |
| 50 | reasoning | 50 | 99 | 3098 | 用户 |
| 51 | reasoning | 51 | 101 | 3162 | 这个 |
| 52 | reasoning | 52 | 103 | 3226 | 工具 |
| 53 | reasoning | 53 | 105 | 3290 | 不支持 |
| 54 | reasoning | 54 | 107 | 3357 | 查询 |
| 55 | reasoning | 55 | 109 | 3421 | 火星 |
| 56 | reasoning | 56 | 111 | 3485 | 天气 |
| 57 | reasoning | 57 | 113 | 3549 | ， |
| 58 | reasoning | 58 | 115 | 3610 | 因为 |
| 59 | reasoning | 59 | 117 | 3674 | 火星 |
| 60 | reasoning | 60 | 119 | 3738 | 不在 |
| 61 | reasoning | 61 | 121 | 3802 | 支持 |
| 62 | reasoning | 62 | 123 | 3866 | 的城市 |
| 63 | reasoning | 63 | 125 | 3933 | 列表中 |
| 64 | reasoning | 64 | 127 | 4000 | 。 |
| 65 | reasoning | 65 | 129 | 4061 | \n |
| 66 | text | 66 | 131 | 4121 | \n\n |
| 67 | tool-call | 67 | 133 | 4181 | name=get_weather args={\"city\": \"火星\"} |
