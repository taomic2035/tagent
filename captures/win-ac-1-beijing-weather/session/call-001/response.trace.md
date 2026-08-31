# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 25 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 19 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 1869 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 想知道 |
| 3 | reasoning | 3 | 5 | 131 | 北京 |
| 4 | reasoning | 4 | 7 | 195 | 今天的 |
| 5 | reasoning | 5 | 9 | 262 | 天气 |
| 6 | reasoning | 6 | 11 | 326 | 情况 |
| 7 | reasoning | 7 | 13 | 390 | 。 |
| 8 | reasoning | 8 | 15 | 451 | 我 |
| 9 | reasoning | 9 | 17 | 512 | 需要使用 |
| 10 | reasoning | 10 | 19 | 582 |  get |
| 11 | reasoning | 11 | 21 | 644 | _weather |
| 12 | reasoning | 12 | 23 | 710 |   |
| 13 | reasoning | 13 | 25 | 769 | 工具 |
| 14 | reasoning | 14 | 27 | 833 | 来 |
| 15 | reasoning | 15 | 29 | 894 | 查询 |
| 16 | reasoning | 16 | 31 | 958 | 北京的 |
| 17 | reasoning | 17 | 33 | 1025 | 天气 |
| 18 | reasoning | 18 | 35 | 1089 | 。 |
| 19 | reasoning | 19 | 37 | 1150 | \n |
| 20 | tool-call | 20 | 39 | 1210 | name=get_weather args={ |
| 21 | tool-call | 21 | 41 | 1370 | name=null args=\"city\":\" |
| 22 | tool-call | 22 | 43 | 1479 | name=null args=北京 |
| 23 | tool-call | 23 | 45 | 1583 | name=null args=\" |
| 24 | tool-call | 24 | 47 | 1683 | name=null args=} |
