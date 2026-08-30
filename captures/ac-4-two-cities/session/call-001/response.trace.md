# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 39 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 34 |
| 正文 token（text） | 2 |
| tool_call 分片 | 2 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 2740 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 想 |
| 3 | reasoning | 3 | 5 | 125 | 对比 |
| 4 | reasoning | 4 | 7 | 189 | 北京 |
| 5 | reasoning | 5 | 9 | 253 | 和 |
| 6 | reasoning | 6 | 11 | 314 | 上海的 |
| 7 | reasoning | 7 | 13 | 381 | 天气 |
| 8 | reasoning | 8 | 15 | 445 | 。 |
| 9 | reasoning | 9 | 17 | 506 | 我需要 |
| 10 | reasoning | 10 | 19 | 573 | 调用 |
| 11 | reasoning | 11 | 21 | 637 |  get |
| 12 | reasoning | 12 | 23 | 699 | _weather |
| 13 | reasoning | 13 | 25 | 765 |  工具 |
| 14 | reasoning | 14 | 27 | 830 | 来 |
| 15 | reasoning | 15 | 29 | 891 | 查询 |
| 16 | reasoning | 16 | 31 | 955 | 这两个 |
| 17 | reasoning | 17 | 33 | 1022 | 城市的 |
| 18 | reasoning | 18 | 35 | 1089 | 天气 |
| 19 | reasoning | 19 | 37 | 1153 | 情况 |
| 20 | reasoning | 20 | 39 | 1217 | 。 |
| 21 | reasoning | 21 | 41 | 1278 | \n\n |
| 22 | reasoning | 22 | 43 | 1340 | 我需要 |
| 23 | reasoning | 23 | 45 | 1407 | 分别 |
| 24 | reasoning | 24 | 47 | 1471 | 查询 |
| 25 | reasoning | 25 | 49 | 1535 | 北京 |
| 26 | reasoning | 26 | 51 | 1599 | 和 |
| 27 | reasoning | 27 | 53 | 1660 | 上海的 |
| 28 | reasoning | 28 | 55 | 1727 | 天气 |
| 29 | reasoning | 29 | 57 | 1791 | ， |
| 30 | reasoning | 30 | 59 | 1852 | 然后 |
| 31 | reasoning | 31 | 61 | 1916 | 进行 |
| 32 | reasoning | 32 | 63 | 1980 | 对比 |
| 33 | reasoning | 33 | 65 | 2044 | 。 |
| 34 | reasoning | 34 | 67 | 2105 | \n |
| 35 | text | 35 | 69 | 2165 | \n\n |
| 36 | tool-call | 36 | 71 | 2225 | name=get_weather args={\"city\": \"北京\"} |
| 37 | text | 37 | 73 | 2410 | \n |
| 38 | tool-call | 38 | 75 | 2468 | name=get_weather args={\"city\": \"上海\"} |
