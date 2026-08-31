# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 66 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 59 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 19578 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想知道 |
| 3 | reasoning | 4 | 7 | 878 | 北京 |
| 4 | reasoning | 5 | 9 | 1168 | 今天的 |
| 5 | reasoning | 6 | 11 | 1461 | 天气 |
| 6 | reasoning | 7 | 13 | 1751 | 情况 |
| 7 | reasoning | 8 | 15 | 2041 | 。 |
| 8 | reasoning | 9 | 17 | 2328 | 我 |
| 9 | reasoning | 10 | 19 | 2615 | 需要使用 |
| 10 | reasoning | 11 | 21 | 2911 |  get |
| 11 | reasoning | 12 | 23 | 3199 | _weather |
| 12 | reasoning | 13 | 25 | 3491 |   |
| 13 | reasoning | 14 | 27 | 3776 | 工具 |
| 14 | reasoning | 15 | 29 | 4066 | 来 |
| 15 | reasoning | 16 | 31 | 4353 | 查询 |
| 16 | reasoning | 17 | 33 | 4643 | 北京的 |
| 17 | reasoning | 18 | 35 | 4936 | 天气 |
| 18 | reasoning | 19 | 37 | 5226 | 。 |
| 19 | reasoning | 20 | 39 | 5513 | 根据 |
| 20 | reasoning | 21 | 41 | 5803 | 工具 |
| 21 | reasoning | 22 | 43 | 6093 | 定义 |
| 22 | reasoning | 23 | 45 | 6383 | ， |
| 23 | reasoning | 24 | 47 | 6670 | 这个 |
| 24 | reasoning | 25 | 49 | 6960 | 工具 |
| 25 | reasoning | 26 | 51 | 7250 | 支持 |
| 26 | reasoning | 27 | 53 | 7540 | 查询 |
| 27 | reasoning | 28 | 55 | 7830 | 北京 |
| 28 | reasoning | 29 | 57 | 8120 | / |
| 29 | reasoning | 30 | 59 | 8405 | 上海 |
| 30 | reasoning | 31 | 61 | 8695 | / |
| 31 | reasoning | 32 | 63 | 8980 | 广州 |
| 32 | reasoning | 33 | 65 | 9270 | / |
| 33 | reasoning | 34 | 67 | 9555 | 深圳 |
| 34 | reasoning | 35 | 69 | 9845 | / |
| 35 | reasoning | 36 | 71 | 10130 | 杭州 |
| 36 | reasoning | 37 | 73 | 10420 | 的天气 |
| 37 | reasoning | 38 | 75 | 10713 | ， |
| 38 | reasoning | 39 | 77 | 11000 | 参数 |
| 39 | reasoning | 40 | 79 | 11290 | 需要 |
| 40 | reasoning | 41 | 81 | 11580 | 城市 |
| 41 | reasoning | 42 | 83 | 11870 | 名 |
| 42 | reasoning | 43 | 85 | 12157 | 。 |
| 43 | reasoning | 44 | 87 | 12444 | \n\n |
| 44 | reasoning | 45 | 89 | 12732 | 我需要 |
| 45 | reasoning | 46 | 91 | 13025 | 调用 |
| 46 | reasoning | 47 | 93 | 13315 |  get |
| 47 | reasoning | 48 | 95 | 13603 | _weather |
| 48 | reasoning | 49 | 97 | 13895 |   |
| 49 | reasoning | 50 | 99 | 14180 | 工具 |
| 50 | reasoning | 51 | 101 | 14470 | ， |
| 51 | reasoning | 52 | 103 | 14757 | 参数 |
| 52 | reasoning | 53 | 105 | 15047 |  city |
| 53 | reasoning | 54 | 107 | 15336 |   |
| 54 | reasoning | 55 | 109 | 15621 | 设置为 |
| 55 | reasoning | 56 | 111 | 15914 | \" |
| 56 | reasoning | 57 | 113 | 16200 | 北京 |
| 57 | reasoning | 58 | 115 | 16490 | \" |
| 58 | reasoning | 59 | 117 | 16776 | 。 |
| 59 | reasoning | 60 | 119 | 17063 | \n |
| 60 | tool-call | 61 | 121 | 17349 | name=get_weather args={ |
| 61 | tool-call | 62 | 123 | 17745 | name=null args=\"city\":\" |
| 62 | tool-call | 63 | 125 | 18072 | name=null args=北京 |
| 63 | tool-call | 64 | 127 | 18394 | name=null args=\" |
| 64 | tool-call | 65 | 129 | 18712 | name=null args=} |
