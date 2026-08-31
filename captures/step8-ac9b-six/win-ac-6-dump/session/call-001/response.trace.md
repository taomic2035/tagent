# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 24 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 17 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 6734 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 266 | 用户 |
| 2 | reasoning | 3 | 5 | 527 | 询问 |
| 3 | reasoning | 4 | 7 | 788 | 上海 |
| 4 | reasoning | 5 | 9 | 1049 | 天气 |
| 5 | reasoning | 6 | 11 | 1310 | ， |
| 6 | reasoning | 7 | 13 | 1568 | 我 |
| 7 | reasoning | 8 | 15 | 1826 | 需要使用 |
| 8 | reasoning | 9 | 17 | 2093 |  get |
| 9 | reasoning | 10 | 19 | 2352 | _weather |
| 10 | reasoning | 11 | 21 | 2615 |   |
| 11 | reasoning | 12 | 23 | 2871 | 工具 |
| 12 | reasoning | 13 | 25 | 3132 | 来获取 |
| 13 | reasoning | 14 | 27 | 3396 | 上海的 |
| 14 | reasoning | 15 | 29 | 3660 | 天气 |
| 15 | reasoning | 16 | 31 | 3921 | 信息 |
| 16 | reasoning | 17 | 33 | 4182 | 。 |
| 17 | reasoning | 18 | 35 | 4440 | \n |
| 18 | tool-call | 19 | 37 | 4697 | name=get_weather args={ |
| 19 | tool-call | 20 | 39 | 5064 | name=null args=\"city\":\" |
| 20 | tool-call | 21 | 41 | 5362 | name=null args=上海 |
| 21 | tool-call | 22 | 43 | 5655 | name=null args=\" |
| 22 | tool-call | 23 | 45 | 5944 | name=null args=} |
