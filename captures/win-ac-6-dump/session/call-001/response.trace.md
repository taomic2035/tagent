# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 62 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 55 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 18415 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | 上海 |
| 4 | reasoning | 5 | 9 | 1165 | 的天气 |
| 5 | reasoning | 6 | 11 | 1458 | 情况 |
| 6 | reasoning | 7 | 13 | 1748 | ， |
| 7 | reasoning | 8 | 15 | 2035 | 我 |
| 8 | reasoning | 9 | 17 | 2322 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2618 |  get |
| 10 | reasoning | 11 | 21 | 2906 | _weather |
| 11 | reasoning | 12 | 23 | 3198 |   |
| 12 | reasoning | 13 | 25 | 3483 | 工具 |
| 13 | reasoning | 14 | 27 | 3773 | 来 |
| 14 | reasoning | 15 | 29 | 4060 | 查询 |
| 15 | reasoning | 16 | 31 | 4350 | 。 |
| 16 | reasoning | 17 | 33 | 4637 | 根据 |
| 17 | reasoning | 18 | 35 | 4927 | 工具 |
| 18 | reasoning | 19 | 37 | 5217 | 描述 |
| 19 | reasoning | 20 | 39 | 5507 | ， |
| 20 | reasoning | 21 | 41 | 5794 | 支持 |
| 21 | reasoning | 22 | 43 | 6084 | 的城市 |
| 22 | reasoning | 23 | 45 | 6377 | 包括 |
| 23 | reasoning | 24 | 47 | 6667 | 北京 |
| 24 | reasoning | 25 | 49 | 6957 | / |
| 25 | reasoning | 26 | 51 | 7242 | 上海 |
| 26 | reasoning | 27 | 53 | 7532 | / |
| 27 | reasoning | 28 | 55 | 7817 | 广州 |
| 28 | reasoning | 29 | 57 | 8107 | / |
| 29 | reasoning | 30 | 59 | 8392 | 深圳 |
| 30 | reasoning | 31 | 61 | 8682 | / |
| 31 | reasoning | 32 | 63 | 8967 | 杭州 |
| 32 | reasoning | 33 | 65 | 9257 | ， |
| 33 | reasoning | 34 | 67 | 9544 | 上海 |
| 34 | reasoning | 35 | 69 | 9834 | 是 |
| 35 | reasoning | 36 | 71 | 10121 | 支持 |
| 36 | reasoning | 37 | 73 | 10411 | 的城市 |
| 37 | reasoning | 38 | 75 | 10704 | 之一 |
| 38 | reasoning | 39 | 77 | 10994 | 。 |
| 39 | reasoning | 40 | 79 | 11281 | \n\n |
| 40 | reasoning | 41 | 81 | 11569 | 我需要 |
| 41 | reasoning | 42 | 83 | 11862 | 调用 |
| 42 | reasoning | 43 | 85 | 12152 |  get |
| 43 | reasoning | 44 | 87 | 12440 | _weather |
| 44 | reasoning | 45 | 89 | 12732 |   |
| 45 | reasoning | 46 | 91 | 13017 | 函数 |
| 46 | reasoning | 47 | 93 | 13307 | ， |
| 47 | reasoning | 48 | 95 | 13594 | 参数 |
| 48 | reasoning | 49 | 97 | 13884 |  city |
| 49 | reasoning | 50 | 99 | 14173 |   |
| 50 | reasoning | 51 | 101 | 14458 | 设置为 |
| 51 | reasoning | 52 | 103 | 14751 | \" |
| 52 | reasoning | 53 | 105 | 15037 | 上海 |
| 53 | reasoning | 54 | 107 | 15327 | \" |
| 54 | reasoning | 55 | 109 | 15613 | 。 |
| 55 | reasoning | 56 | 111 | 15900 | \n |
| 56 | tool-call | 57 | 113 | 16186 | name=get_weather args={ |
| 57 | tool-call | 58 | 115 | 16582 | name=null args=\"city\":\" |
| 58 | tool-call | 59 | 117 | 16909 | name=null args=上海 |
| 59 | tool-call | 60 | 119 | 17231 | name=null args=\" |
| 60 | tool-call | 61 | 121 | 17549 | name=null args=} |
