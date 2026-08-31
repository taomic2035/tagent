# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 39 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 32 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 11773 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想知道 |
| 3 | reasoning | 4 | 7 | 878 | 北京的 |
| 4 | reasoning | 5 | 9 | 1171 | 天气 |
| 5 | reasoning | 6 | 11 | 1461 | 情况 |
| 6 | reasoning | 7 | 13 | 1751 | 。 |
| 7 | reasoning | 8 | 15 | 2038 | 我 |
| 8 | reasoning | 9 | 17 | 2325 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2621 | get |
| 10 | reasoning | 11 | 21 | 2908 | _weather |
| 11 | reasoning | 12 | 23 | 3200 | 工具 |
| 12 | reasoning | 13 | 25 | 3490 | 来 |
| 13 | reasoning | 14 | 27 | 3777 | 查询 |
| 14 | reasoning | 15 | 29 | 4067 | 北京的 |
| 15 | reasoning | 16 | 31 | 4360 | 天气 |
| 16 | reasoning | 17 | 33 | 4650 | 。 |
| 17 | reasoning | 18 | 35 | 4937 | 根据 |
| 18 | reasoning | 19 | 37 | 5227 | 工具 |
| 19 | reasoning | 20 | 39 | 5517 | 定义 |
| 20 | reasoning | 21 | 41 | 5807 | ， |
| 21 | reasoning | 22 | 43 | 6094 | 需要 |
| 22 | reasoning | 23 | 45 | 6384 | 传入 |
| 23 | reasoning | 24 | 47 | 6674 | city |
| 24 | reasoning | 25 | 49 | 6962 | 参数 |
| 25 | reasoning | 26 | 51 | 7252 | ， |
| 26 | reasoning | 27 | 53 | 7539 | 这里 |
| 27 | reasoning | 28 | 55 | 7829 | 应该是 |
| 28 | reasoning | 29 | 57 | 8122 | \" |
| 29 | reasoning | 30 | 59 | 8408 | 北京 |
| 30 | reasoning | 31 | 61 | 8698 | \" |
| 31 | reasoning | 32 | 63 | 8984 | 。 |
| 32 | reasoning | 33 | 65 | 9271 | \n |
| 33 | tool-call | 34 | 67 | 9557 | name=get_weather args={ |
| 34 | tool-call | 35 | 69 | 9953 | name=null args=\"city\":\" |
| 35 | tool-call | 36 | 71 | 10280 | name=null args=北京 |
| 36 | tool-call | 37 | 73 | 10602 | name=null args=\" |
| 37 | tool-call | 38 | 75 | 10920 | name=null args=} |
