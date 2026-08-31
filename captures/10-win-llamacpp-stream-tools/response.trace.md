# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 37 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 30 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 11266 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 297 | 用户 |
| 2 | reasoning | 3 | 5 | 589 | 想知道 |
| 3 | reasoning | 4 | 7 | 884 | 北京的 |
| 4 | reasoning | 5 | 9 | 1179 | 天气 |
| 5 | reasoning | 6 | 11 | 1471 | 情况 |
| 6 | reasoning | 7 | 13 | 1763 | ， |
| 7 | reasoning | 8 | 15 | 2052 | 我 |
| 8 | reasoning | 9 | 17 | 2341 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2639 | get |
| 10 | reasoning | 11 | 21 | 2928 | _weather |
| 11 | reasoning | 12 | 23 | 3222 | 工具 |
| 12 | reasoning | 13 | 25 | 3514 | 来 |
| 13 | reasoning | 14 | 27 | 3803 | 查询 |
| 14 | reasoning | 15 | 29 | 4095 | 。 |
| 15 | reasoning | 16 | 31 | 4384 | 根据 |
| 16 | reasoning | 17 | 33 | 4676 | 工具 |
| 17 | reasoning | 18 | 35 | 4968 | 定义 |
| 18 | reasoning | 19 | 37 | 5260 | ， |
| 19 | reasoning | 20 | 39 | 5549 | 需要 |
| 20 | reasoning | 21 | 41 | 5841 | 传入 |
| 21 | reasoning | 22 | 43 | 6133 | city |
| 22 | reasoning | 23 | 45 | 6423 | 参数 |
| 23 | reasoning | 24 | 47 | 6715 | ， |
| 24 | reasoning | 25 | 49 | 7004 | 这里 |
| 25 | reasoning | 26 | 51 | 7296 | 应该是 |
| 26 | reasoning | 27 | 53 | 7591 | \" |
| 27 | reasoning | 28 | 55 | 7879 | 北京 |
| 28 | reasoning | 29 | 57 | 8171 | \" |
| 29 | reasoning | 30 | 59 | 8459 | 。 |
| 30 | reasoning | 31 | 61 | 8748 | \n |
| 31 | tool-call | 32 | 63 | 9036 | name=get_weather args={ |
| 32 | tool-call | 33 | 65 | 9434 | name=null args=\"city\":\" |
| 33 | tool-call | 34 | 67 | 9763 | name=null args=北京 |
| 34 | tool-call | 35 | 69 | 10087 | name=null args=\" |
| 35 | tool-call | 36 | 71 | 10407 | name=null args=} |
