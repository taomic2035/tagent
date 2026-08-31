# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 43 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 36 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 12952 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想了解 |
| 3 | reasoning | 4 | 7 | 878 | 杭州 |
| 4 | reasoning | 5 | 9 | 1168 | 的天气 |
| 5 | reasoning | 6 | 11 | 1461 | ， |
| 6 | reasoning | 7 | 13 | 1748 | 并要求 |
| 7 | reasoning | 8 | 15 | 2041 | 对比 |
| 8 | reasoning | 9 | 17 | 2331 | 北京 |
| 9 | reasoning | 10 | 19 | 2621 | 、 |
| 10 | reasoning | 11 | 21 | 2908 | 上海 |
| 11 | reasoning | 12 | 23 | 3198 | 和 |
| 12 | reasoning | 13 | 25 | 3485 | 杭州 |
| 13 | reasoning | 14 | 27 | 3775 | 三个 |
| 14 | reasoning | 15 | 29 | 4065 | 城市的 |
| 15 | reasoning | 16 | 31 | 4358 | 天气 |
| 16 | reasoning | 17 | 33 | 4648 | 情况 |
| 17 | reasoning | 18 | 35 | 4938 | 。 |
| 18 | reasoning | 19 | 37 | 5225 | 我需要 |
| 19 | reasoning | 20 | 39 | 5518 | 先 |
| 20 | reasoning | 21 | 41 | 5805 | 查询 |
| 21 | reasoning | 22 | 43 | 6095 | 杭州 |
| 22 | reasoning | 23 | 45 | 6385 | 的天气 |
| 23 | reasoning | 24 | 47 | 6678 | ， |
| 24 | reasoning | 25 | 49 | 6965 | 然后 |
| 25 | reasoning | 26 | 51 | 7255 | 进行 |
| 26 | reasoning | 27 | 53 | 7545 | 对比 |
| 27 | reasoning | 28 | 55 | 7835 | 分析 |
| 28 | reasoning | 29 | 57 | 8125 | 。 |
| 29 | reasoning | 30 | 59 | 8412 | \n\n |
| 30 | reasoning | 31 | 61 | 8700 | 让我 |
| 31 | reasoning | 32 | 63 | 8990 | 先 |
| 32 | reasoning | 33 | 65 | 9277 | 查询 |
| 33 | reasoning | 34 | 67 | 9567 | 杭州 |
| 34 | reasoning | 35 | 69 | 9857 | 的天气 |
| 35 | reasoning | 36 | 71 | 10150 | 。 |
| 36 | reasoning | 37 | 73 | 10437 | \n |
| 37 | tool-call | 38 | 75 | 10723 | name=get_weather args={ |
| 38 | tool-call | 39 | 77 | 11119 | name=null args=\"city\":\" |
| 39 | tool-call | 40 | 79 | 11446 | name=null args=杭州 |
| 40 | tool-call | 41 | 81 | 11768 | name=null args=\" |
| 41 | tool-call | 42 | 83 | 12086 | name=null args=} |
