# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 21 |
| keepalive 注释帧 | 1 |
| 思考 token（reasoning） | 18 |
| 正文 token（text） | 1 |
| tool_call 分片 | 1 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 8906 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 3 | 17 | 用户 |
| 2 | reasoning | 2 | 5 | 435 | 询问 |
| 3 | reasoning | 3 | 7 | 853 | 北京的 |
| 4 | reasoning | 4 | 9 | 1277 | 天气 |
| 5 | reasoning | 5 | 11 | 1695 | 情况 |
| 6 | reasoning | 6 | 13 | 2113 | ， |
| 7 | reasoning | 7 | 15 | 2525 | 我 |
| 8 | reasoning | 8 | 17 | 2937 | 需要使用 |
| 9 | reasoning | 9 | 19 | 3367 |  get |
| 10 | reasoning | 10 | 21 | 3777 | _weather |
| 11 | reasoning | 11 | 23 | 4191 |  工具 |
| 12 | reasoning | 12 | 25 | 4610 | 来 |
| 13 | reasoning | 13 | 27 | 5022 | 查询 |
| 14 | reasoning | 14 | 29 | 5440 | 北京 |
| 15 | reasoning | 15 | 31 | 5858 | 今天的 |
| 16 | reasoning | 16 | 33 | 6282 | 天气 |
| 17 | reasoning | 17 | 35 | 6700 | 。 |
| 18 | reasoning | 18 | 37 | 7112 | \n |
| 19 | text | 19 | 39 | 7520 | \n\n |
| 20 | tool-call | 20 | 41 | 7928 | name=get_weather args={\"city\": \"北京\"} |
