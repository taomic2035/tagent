# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 25 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 18 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 7734 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想了解 |
| 3 | reasoning | 4 | 7 | 878 | 上海的 |
| 4 | reasoning | 5 | 9 | 1171 | 天气 |
| 5 | reasoning | 6 | 11 | 1461 | 情况 |
| 6 | reasoning | 7 | 13 | 1751 | ， |
| 7 | reasoning | 8 | 15 | 2038 | 我 |
| 8 | reasoning | 9 | 17 | 2325 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2621 |  get |
| 10 | reasoning | 11 | 21 | 2909 | _weather |
| 11 | reasoning | 12 | 23 | 3201 |   |
| 12 | reasoning | 13 | 25 | 3486 | 工具 |
| 13 | reasoning | 14 | 27 | 3776 | 来 |
| 14 | reasoning | 15 | 29 | 4063 | 查询 |
| 15 | reasoning | 16 | 31 | 4353 | 上海 |
| 16 | reasoning | 17 | 33 | 4643 | 天气 |
| 17 | reasoning | 18 | 35 | 4933 | 。 |
| 18 | reasoning | 19 | 37 | 5220 | \n |
| 19 | tool-call | 20 | 39 | 5506 | name=get_weather args={ |
| 20 | tool-call | 21 | 41 | 5902 | name=null args=\"city\":\" |
| 21 | tool-call | 22 | 43 | 6229 | name=null args=上海 |
| 22 | tool-call | 23 | 45 | 6551 | name=null args=\" |
| 23 | tool-call | 24 | 47 | 6869 | name=null args=} |
