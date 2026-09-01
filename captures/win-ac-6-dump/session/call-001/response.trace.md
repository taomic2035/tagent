# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 63 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 56 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 18711 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | 上海 |
| 4 | reasoning | 5 | 9 | 1165 | 天气 |
| 5 | reasoning | 6 | 11 | 1455 | 怎么样 |
| 6 | reasoning | 7 | 13 | 1748 | ， |
| 7 | reasoning | 8 | 15 | 2035 | 我需要 |
| 8 | reasoning | 9 | 17 | 2328 | 调用 |
| 9 | reasoning | 10 | 19 | 2618 |  get |
| 10 | reasoning | 11 | 21 | 2906 | _weather |
| 11 | reasoning | 12 | 23 | 3198 |   |
| 12 | reasoning | 13 | 25 | 3483 | 工具 |
| 13 | reasoning | 14 | 27 | 3773 | 来 |
| 14 | reasoning | 15 | 29 | 4060 | 查询 |
| 15 | reasoning | 16 | 31 | 4350 | 上海 |
| 16 | reasoning | 17 | 33 | 4640 | 当前的 |
| 17 | reasoning | 18 | 35 | 4933 | 天气 |
| 18 | reasoning | 19 | 37 | 5223 | 。 |
| 19 | reasoning | 20 | 39 | 5510 | 根据 |
| 20 | reasoning | 21 | 41 | 5800 | 工具 |
| 21 | reasoning | 22 | 43 | 6090 | 描述 |
| 22 | reasoning | 23 | 45 | 6380 | ， |
| 23 | reasoning | 24 | 47 | 6667 | 这个 |
| 24 | reasoning | 25 | 49 | 6957 | 工具 |
| 25 | reasoning | 26 | 51 | 7247 | 支持 |
| 26 | reasoning | 27 | 53 | 7537 | 查询 |
| 27 | reasoning | 28 | 55 | 7827 | 上海 |
| 28 | reasoning | 29 | 57 | 8117 | 、 |
| 29 | reasoning | 30 | 59 | 8404 | 北京 |
| 30 | reasoning | 31 | 61 | 8694 | 、 |
| 31 | reasoning | 32 | 63 | 8981 | 广州 |
| 32 | reasoning | 33 | 65 | 9271 | 、 |
| 33 | reasoning | 34 | 67 | 9558 | 深圳 |
| 34 | reasoning | 35 | 69 | 9848 | 、 |
| 35 | reasoning | 36 | 71 | 10135 | 杭州 |
| 36 | reasoning | 37 | 73 | 10425 | 等 |
| 37 | reasoning | 38 | 75 | 10712 | 城市的 |
| 38 | reasoning | 39 | 77 | 11005 | 天气 |
| 39 | reasoning | 40 | 79 | 11295 | 。 |
| 40 | reasoning | 41 | 81 | 11582 | \n\n |
| 41 | reasoning | 42 | 83 | 11870 | 我需要 |
| 42 | reasoning | 43 | 85 | 12163 | 调用 |
| 43 | reasoning | 44 | 87 | 12453 |  get |
| 44 | reasoning | 45 | 89 | 12741 | _weather |
| 45 | reasoning | 46 | 91 | 13033 |   |
| 46 | reasoning | 47 | 93 | 13318 | 函数 |
| 47 | reasoning | 48 | 95 | 13608 | ， |
| 48 | reasoning | 49 | 97 | 13895 | 参数 |
| 49 | reasoning | 50 | 99 | 14185 |  city |
| 50 | reasoning | 51 | 101 | 14474 |   |
| 51 | reasoning | 52 | 103 | 14759 | 为 |
| 52 | reasoning | 53 | 105 | 15046 | \" |
| 53 | reasoning | 54 | 107 | 15332 | 上海 |
| 54 | reasoning | 55 | 109 | 15622 | \" |
| 55 | reasoning | 56 | 111 | 15908 | 。 |
| 56 | reasoning | 57 | 113 | 16195 | \n |
| 57 | tool-call | 58 | 115 | 16481 | name=get_weather args={ |
| 58 | tool-call | 59 | 117 | 16877 | name=null args=\"city\":\" |
| 59 | tool-call | 60 | 119 | 17204 | name=null args=上海 |
| 60 | tool-call | 61 | 121 | 17526 | name=null args=\" |
| 61 | tool-call | 62 | 123 | 17844 | name=null args=} |
