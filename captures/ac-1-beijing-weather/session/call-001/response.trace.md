# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 47 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 44 |
| 正文 token（text） | 1 |
| tool_call 分片 | 1 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 3127 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 询问 |
| 3 | reasoning | 3 | 5 | 128 | 北京 |
| 4 | reasoning | 4 | 7 | 192 | 今天的 |
| 5 | reasoning | 5 | 9 | 259 | 天气 |
| 6 | reasoning | 6 | 11 | 323 | 情况 |
| 7 | reasoning | 7 | 13 | 387 | 。 |
| 8 | reasoning | 8 | 15 | 448 | 根据 |
| 9 | reasoning | 9 | 17 | 512 | 工具 |
| 10 | reasoning | 10 | 19 | 576 | 列表 |
| 11 | reasoning | 11 | 21 | 640 | ， |
| 12 | reasoning | 12 | 23 | 701 | 我 |
| 13 | reasoning | 13 | 25 | 762 | 可以使用 |
| 14 | reasoning | 14 | 27 | 832 |  get |
| 15 | reasoning | 15 | 29 | 894 | _weather |
| 16 | reasoning | 16 | 31 | 960 |  函数 |
| 17 | reasoning | 17 | 33 | 1025 | 来 |
| 18 | reasoning | 18 | 35 | 1086 | 查询 |
| 19 | reasoning | 19 | 37 | 1150 | 天气 |
| 20 | reasoning | 20 | 39 | 1214 | 信息 |
| 21 | reasoning | 21 | 41 | 1278 | 。 |
| 22 | reasoning | 22 | 43 | 1339 | 这个 |
| 23 | reasoning | 23 | 45 | 1403 | 函数 |
| 24 | reasoning | 24 | 47 | 1467 | 支持 |
| 25 | reasoning | 25 | 49 | 1531 | 北京 |
| 26 | reasoning | 26 | 51 | 1595 | 这个 |
| 27 | reasoning | 27 | 53 | 1659 | 城市 |
| 28 | reasoning | 28 | 55 | 1723 | 名称 |
| 29 | reasoning | 29 | 57 | 1787 | 。 |
| 30 | reasoning | 30 | 59 | 1848 | \n\n |
| 31 | reasoning | 31 | 61 | 1910 | 我需要 |
| 32 | reasoning | 32 | 63 | 1977 | 调用 |
| 33 | reasoning | 33 | 65 | 2041 |  get |
| 34 | reasoning | 34 | 67 | 2103 | _weather |
| 35 | reasoning | 35 | 69 | 2169 |  函数 |
| 36 | reasoning | 36 | 71 | 2234 | ， |
| 37 | reasoning | 37 | 73 | 2295 | 参数 |
| 38 | reasoning | 38 | 75 | 2359 |  city |
| 39 | reasoning | 39 | 77 | 2422 |  设置为 |
| 40 | reasoning | 40 | 79 | 2490 | \" |
| 41 | reasoning | 41 | 81 | 2550 | 北京 |
| 42 | reasoning | 42 | 83 | 2614 | \" |
| 43 | reasoning | 43 | 85 | 2674 | 。 |
| 44 | reasoning | 44 | 87 | 2735 | \n |
| 45 | text | 45 | 89 | 2795 | \n\n |
| 46 | tool-call | 46 | 91 | 2855 | name=get_weather args={\"city\": \"北京\"} |
