# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 26 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 19 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 7269 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 266 | 用户 |
| 2 | reasoning | 3 | 5 | 527 | 问 |
| 3 | reasoning | 4 | 7 | 785 | 的是 |
| 4 | reasoning | 5 | 9 | 1046 | 北京的 |
| 5 | reasoning | 6 | 11 | 1310 | 天气 |
| 6 | reasoning | 7 | 13 | 1571 | ， |
| 7 | reasoning | 8 | 15 | 1829 | 我 |
| 8 | reasoning | 9 | 17 | 2087 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2354 |  get |
| 10 | reasoning | 11 | 21 | 2613 | _weather |
| 11 | reasoning | 12 | 23 | 2876 |   |
| 12 | reasoning | 13 | 25 | 3132 | 工具 |
| 13 | reasoning | 14 | 27 | 3393 | 来 |
| 14 | reasoning | 15 | 29 | 3651 | 查询 |
| 15 | reasoning | 16 | 31 | 3912 | 北京的 |
| 16 | reasoning | 17 | 33 | 4176 | 天气 |
| 17 | reasoning | 18 | 35 | 4437 | 情况 |
| 18 | reasoning | 19 | 37 | 4698 | 。 |
| 19 | reasoning | 20 | 39 | 4956 | \n |
| 20 | tool-call | 21 | 41 | 5213 | name=get_weather args={ |
| 21 | tool-call | 22 | 43 | 5580 | name=null args=\"city\":\" |
| 22 | tool-call | 23 | 45 | 5878 | name=null args=北京 |
| 23 | tool-call | 24 | 47 | 6171 | name=null args=\" |
| 24 | tool-call | 25 | 49 | 6460 | name=null args=} |
