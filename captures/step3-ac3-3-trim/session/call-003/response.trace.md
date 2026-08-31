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
| 文件字节数 | 7445 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 现在 |
| 3 | reasoning | 4 | 7 | 875 | 想 |
| 4 | reasoning | 5 | 9 | 1162 | 查询 |
| 5 | reasoning | 6 | 11 | 1452 | 上海的 |
| 6 | reasoning | 7 | 13 | 1745 | 天气 |
| 7 | reasoning | 8 | 15 | 2035 | ， |
| 8 | reasoning | 9 | 17 | 2322 | 我 |
| 9 | reasoning | 10 | 19 | 2609 | 需要使用 |
| 10 | reasoning | 11 | 21 | 2905 | get |
| 11 | reasoning | 12 | 23 | 3192 | _weather |
| 12 | reasoning | 13 | 25 | 3484 | 工具 |
| 13 | reasoning | 14 | 27 | 3774 | 来获取 |
| 14 | reasoning | 15 | 29 | 4067 | 上海 |
| 15 | reasoning | 16 | 31 | 4357 | 的信息 |
| 16 | reasoning | 17 | 33 | 4650 | 。 |
| 17 | reasoning | 18 | 35 | 4937 | \n |
| 18 | tool-call | 19 | 37 | 5223 | name=get_weather args={ |
| 19 | tool-call | 20 | 39 | 5619 | name=null args=\"city\":\" |
| 20 | tool-call | 21 | 41 | 5946 | name=null args=上海 |
| 21 | tool-call | 22 | 43 | 6268 | name=null args=\" |
| 22 | tool-call | 23 | 45 | 6586 | name=null args=} |
