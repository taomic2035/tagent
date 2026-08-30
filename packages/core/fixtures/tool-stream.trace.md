# Token 溯源表：tool-stream

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 21 |
| keepalive 注释帧 | 3 |
| 思考 token（reasoning） | 18 |
| 正文 token（text） | 1 |
| tool_call 分片 | 1 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 8952 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 7 | 63 | 用户 |
| 2 | reasoning | 2 | 9 | 481 | 询问 |
| 3 | reasoning | 3 | 11 | 899 | 北京的 |
| 4 | reasoning | 4 | 13 | 1323 | 天气 |
| 5 | reasoning | 5 | 15 | 1741 | 情况 |
| 6 | reasoning | 6 | 17 | 2159 | ， |
| 7 | reasoning | 7 | 19 | 2571 | 我 |
| 8 | reasoning | 8 | 21 | 2983 | 需要使用 |
| 9 | reasoning | 9 | 23 | 3413 |  get |
| 10 | reasoning | 10 | 25 | 3823 | _weather |
| 11 | reasoning | 11 | 27 | 4237 |  工具 |
| 12 | reasoning | 12 | 29 | 4656 | 来 |
| 13 | reasoning | 13 | 31 | 5068 | 查询 |
| 14 | reasoning | 14 | 33 | 5486 | 北京 |
| 15 | reasoning | 15 | 35 | 5904 | 今天的 |
| 16 | reasoning | 16 | 37 | 6328 | 天气 |
| 17 | reasoning | 17 | 39 | 6746 | 。 |
| 18 | reasoning | 18 | 41 | 7158 | \n |
| 19 | text | 19 | 43 | 7566 | \n\n |
| 20 | tool-call | 20 | 45 | 7974 | name=get_weather args={\"city\": \"北京\"} |
