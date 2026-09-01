# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 61 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 54 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 18126 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | 上海 |
| 4 | reasoning | 5 | 9 | 1165 | 天气 |
| 5 | reasoning | 6 | 11 | 1455 | 怎么样 |
| 6 | reasoning | 7 | 13 | 1748 | ， |
| 7 | reasoning | 8 | 15 | 2035 | 我 |
| 8 | reasoning | 9 | 17 | 2322 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2618 |  get |
| 10 | reasoning | 11 | 21 | 2906 | _weather |
| 11 | reasoning | 12 | 23 | 3198 |   |
| 12 | reasoning | 13 | 25 | 3483 | 工具 |
| 13 | reasoning | 14 | 27 | 3773 | 来 |
| 14 | reasoning | 15 | 29 | 4060 | 查询 |
| 15 | reasoning | 16 | 31 | 4350 | 上海 |
| 16 | reasoning | 17 | 33 | 4640 | 天气 |
| 17 | reasoning | 18 | 35 | 4930 | 。 |
| 18 | reasoning | 19 | 37 | 5217 | 工具 |
| 19 | reasoning | 20 | 39 | 5507 | 支持 |
| 20 | reasoning | 21 | 41 | 5797 | 的城市 |
| 21 | reasoning | 22 | 43 | 6090 | 包括 |
| 22 | reasoning | 23 | 45 | 6380 | 北京 |
| 23 | reasoning | 24 | 47 | 6670 | / |
| 24 | reasoning | 25 | 49 | 6955 | 上海 |
| 25 | reasoning | 26 | 51 | 7245 | / |
| 26 | reasoning | 27 | 53 | 7530 | 广州 |
| 27 | reasoning | 28 | 55 | 7820 | / |
| 28 | reasoning | 29 | 57 | 8105 | 深圳 |
| 29 | reasoning | 30 | 59 | 8395 | / |
| 30 | reasoning | 31 | 61 | 8680 | 杭州 |
| 31 | reasoning | 32 | 63 | 8970 | ， |
| 32 | reasoning | 33 | 65 | 9257 | 上海 |
| 33 | reasoning | 34 | 67 | 9547 | 是 |
| 34 | reasoning | 35 | 69 | 9834 | 支持 |
| 35 | reasoning | 36 | 71 | 10124 | 的城市 |
| 36 | reasoning | 37 | 73 | 10417 | 之一 |
| 37 | reasoning | 38 | 75 | 10707 | 。 |
| 38 | reasoning | 39 | 77 | 10994 | \n\n |
| 39 | reasoning | 40 | 79 | 11282 | 我需要 |
| 40 | reasoning | 41 | 81 | 11575 | 调用 |
| 41 | reasoning | 42 | 83 | 11865 |  get |
| 42 | reasoning | 43 | 85 | 12153 | _weather |
| 43 | reasoning | 44 | 87 | 12445 |   |
| 44 | reasoning | 45 | 89 | 12730 | 函数 |
| 45 | reasoning | 46 | 91 | 13020 | ， |
| 46 | reasoning | 47 | 93 | 13307 | 参数 |
| 47 | reasoning | 48 | 95 | 13597 |  city |
| 48 | reasoning | 49 | 97 | 13886 |   |
| 49 | reasoning | 50 | 99 | 14171 | 设置为 |
| 50 | reasoning | 51 | 101 | 14464 | \" |
| 51 | reasoning | 52 | 103 | 14750 | 上海 |
| 52 | reasoning | 53 | 105 | 15040 | \" |
| 53 | reasoning | 54 | 107 | 15326 | 。 |
| 54 | reasoning | 55 | 109 | 15613 | \n |
| 55 | tool-call | 56 | 111 | 15899 | name=get_weather args={ |
| 56 | tool-call | 57 | 113 | 16295 | name=null args=\"city\":\" |
| 57 | tool-call | 58 | 115 | 16622 | name=null args=上海 |
| 58 | tool-call | 59 | 117 | 16944 | name=null args=\" |
| 59 | tool-call | 60 | 119 | 17262 | name=null args=} |
