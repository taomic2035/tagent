# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 65 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 53 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 19510 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想要 |
| 3 | reasoning | 4 | 7 | 875 | 查询 |
| 4 | reasoning | 5 | 9 | 1165 | 北京 |
| 5 | reasoning | 6 | 11 | 1455 | 和上海 |
| 6 | reasoning | 7 | 13 | 1748 | 的温度 |
| 7 | reasoning | 8 | 15 | 2041 | 并 |
| 8 | reasoning | 9 | 17 | 2328 | 计算 |
| 9 | reasoning | 10 | 19 | 2618 | 平均值 |
| 10 | reasoning | 11 | 21 | 2911 | 。 |
| 11 | reasoning | 12 | 23 | 3198 | 我需要 |
| 12 | reasoning | 13 | 25 | 3491 | ： |
| 13 | reasoning | 14 | 27 | 3778 | \n |
| 14 | reasoning | 15 | 29 | 4064 | 1 |
| 15 | reasoning | 16 | 31 | 4349 | . |
| 16 | reasoning | 17 | 33 | 4634 |   |
| 17 | reasoning | 18 | 35 | 4919 | 查询 |
| 18 | reasoning | 19 | 37 | 5209 | 北京的 |
| 19 | reasoning | 20 | 39 | 5502 | 天气 |
| 20 | reasoning | 21 | 41 | 5792 | / |
| 21 | reasoning | 22 | 43 | 6077 | 温度 |
| 22 | reasoning | 23 | 45 | 6367 | \n |
| 23 | reasoning | 24 | 47 | 6653 | 2 |
| 24 | reasoning | 25 | 49 | 6938 | . |
| 25 | reasoning | 26 | 51 | 7223 |   |
| 26 | reasoning | 27 | 53 | 7508 | 查询 |
| 27 | reasoning | 28 | 55 | 7798 | 上海的 |
| 28 | reasoning | 29 | 57 | 8091 | 天气 |
| 29 | reasoning | 30 | 59 | 8381 | / |
| 30 | reasoning | 31 | 61 | 8666 | 温度 |
| 31 | reasoning | 32 | 63 | 8956 | \n |
| 32 | reasoning | 33 | 65 | 9242 | 3 |
| 33 | reasoning | 34 | 67 | 9527 | . |
| 34 | reasoning | 35 | 69 | 9812 |   |
| 35 | reasoning | 36 | 71 | 10097 | 计算 |
| 36 | reasoning | 37 | 73 | 10387 | 两个 |
| 37 | reasoning | 38 | 75 | 10677 | 温度的 |
| 38 | reasoning | 39 | 77 | 10970 | 平均值 |
| 39 | reasoning | 40 | 79 | 11263 | \n\n |
| 40 | reasoning | 41 | 81 | 11551 | 让我 |
| 41 | reasoning | 42 | 83 | 11841 | 先 |
| 42 | reasoning | 43 | 85 | 12128 | 调用 |
| 43 | reasoning | 44 | 87 | 12418 |  get |
| 44 | reasoning | 45 | 89 | 12706 | _weather |
| 45 | reasoning | 46 | 91 | 12998 |   |
| 46 | reasoning | 47 | 93 | 13283 | 工具 |
| 47 | reasoning | 48 | 95 | 13573 | 获取 |
| 48 | reasoning | 49 | 97 | 13863 | 两个 |
| 49 | reasoning | 50 | 99 | 14153 | 城市的 |
| 50 | reasoning | 51 | 101 | 14446 | 天气 |
| 51 | reasoning | 52 | 103 | 14736 | 信息 |
| 52 | reasoning | 53 | 105 | 15026 | 。 |
| 53 | reasoning | 54 | 107 | 15313 | \n |
| 54 | tool-call | 55 | 109 | 15599 | name=get_weather args={ |
| 55 | tool-call | 56 | 111 | 15995 | name=null args=\"city\":\" |
| 56 | tool-call | 57 | 113 | 16322 | name=null args=北京 |
| 57 | tool-call | 58 | 115 | 16644 | name=null args=\" |
| 58 | tool-call | 59 | 117 | 16962 | name=null args=} |
| 59 | tool-call | 60 | 119 | 17279 | name=get_weather args={ |
| 60 | tool-call | 61 | 121 | 17675 | name=null args=\"city\":\" |
| 61 | tool-call | 62 | 123 | 18002 | name=null args=上海 |
| 62 | tool-call | 63 | 125 | 18324 | name=null args=\" |
| 63 | tool-call | 64 | 127 | 18642 | name=null args=} |
