# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 46 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 35 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 3463 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 想要 |
| 3 | reasoning | 3 | 5 | 128 | 对比 |
| 4 | reasoning | 4 | 7 | 192 | 北京 |
| 5 | reasoning | 5 | 9 | 256 | 和 |
| 6 | reasoning | 6 | 11 | 317 | 上海的 |
| 7 | reasoning | 7 | 13 | 384 | 天气 |
| 8 | reasoning | 8 | 15 | 448 | 。 |
| 9 | reasoning | 9 | 17 | 509 | 我 |
| 10 | reasoning | 10 | 19 | 570 | 需要使用 |
| 11 | reasoning | 11 | 21 | 640 |  get |
| 12 | reasoning | 12 | 23 | 702 | _weather |
| 13 | reasoning | 13 | 25 | 768 |   |
| 14 | reasoning | 14 | 27 | 827 | 工具 |
| 15 | reasoning | 15 | 29 | 891 | 来 |
| 16 | reasoning | 16 | 31 | 952 | 查询 |
| 17 | reasoning | 17 | 33 | 1016 | 这两个 |
| 18 | reasoning | 18 | 35 | 1083 | 城市的 |
| 19 | reasoning | 19 | 37 | 1150 | 天气 |
| 20 | reasoning | 20 | 39 | 1214 | 信息 |
| 21 | reasoning | 21 | 41 | 1278 | 。 |
| 22 | reasoning | 22 | 43 | 1339 | \n\n |
| 23 | reasoning | 23 | 45 | 1401 | 我可以 |
| 24 | reasoning | 24 | 47 | 1468 | 同时 |
| 25 | reasoning | 25 | 49 | 1532 | 调用 |
| 26 | reasoning | 26 | 51 | 1596 | 两个 |
| 27 | reasoning | 27 | 53 | 1660 | 工具 |
| 28 | reasoning | 28 | 55 | 1724 | 来获取 |
| 29 | reasoning | 29 | 57 | 1791 | 北京 |
| 30 | reasoning | 30 | 59 | 1855 | 和 |
| 31 | reasoning | 31 | 61 | 1916 | 上海的 |
| 32 | reasoning | 32 | 63 | 1983 | 天气 |
| 33 | reasoning | 33 | 65 | 2047 | 信息 |
| 34 | reasoning | 34 | 67 | 2111 | 。 |
| 35 | reasoning | 35 | 69 | 2172 | \n |
| 36 | tool-call | 36 | 71 | 2232 | name=get_weather args={ |
| 37 | tool-call | 37 | 73 | 2392 | name=null args=\"city\":\" |
| 38 | tool-call | 38 | 75 | 2501 | name=null args=北京 |
| 39 | tool-call | 39 | 77 | 2605 | name=null args=\" |
| 40 | tool-call | 40 | 79 | 2705 | name=null args=} |
| 41 | tool-call | 41 | 81 | 2804 | name=get_weather args={ |
| 42 | tool-call | 42 | 83 | 2964 | name=null args=\"city\":\" |
| 43 | tool-call | 43 | 85 | 3073 | name=null args=上海 |
| 44 | tool-call | 44 | 87 | 3177 | name=null args=\" |
| 45 | tool-call | 45 | 89 | 3277 | name=null args=} |
