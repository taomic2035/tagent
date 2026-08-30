# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 21 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 18 |
| 正文 token（text） | 1 |
| tool_call 分片 | 1 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 1481 |

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
| 11 | reasoning | 11 | 21 | 643 |  工具 |
| 12 | reasoning | 12 | 23 | 708 | 来 |
| 13 | reasoning | 13 | 25 | 769 | 查询 |
| 14 | reasoning | 14 | 27 | 833 | 上海的 |
| 15 | reasoning | 15 | 29 | 900 | 天气 |
| 16 | reasoning | 16 | 31 | 964 | 信息 |
| 17 | reasoning | 17 | 33 | 1028 | 。 |
| 18 | reasoning | 18 | 35 | 1089 | \n |
| 19 | text | 19 | 37 | 1149 | \n\n |
| 20 | tool-call | 20 | 39 | 1209 | name=get_weather args={\"city\": \"上海\"} |
