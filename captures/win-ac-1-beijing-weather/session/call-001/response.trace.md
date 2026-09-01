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
| 3 | reasoning | 4 | 7 | 875 | 北京的 |
| 4 | reasoning | 5 | 9 | 1168 | 天气 |
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
| 15 | reasoning | 16 | 31 | 4350 | 北京的 |
| 16 | reasoning | 17 | 33 | 4643 | 天气 |
| 17 | reasoning | 18 | 35 | 4933 | 。 |
| 18 | reasoning | 19 | 37 | 5220 | 根据 |
| 19 | reasoning | 20 | 39 | 5510 | 工具 |
| 20 | reasoning | 21 | 41 | 5800 | 描述 |
| 21 | reasoning | 22 | 43 | 6090 | ， |
| 22 | reasoning | 23 | 45 | 6377 | 支持 |
| 23 | reasoning | 24 | 47 | 6667 | 的城市 |
| 24 | reasoning | 25 | 49 | 6960 | 包括 |
| 25 | reasoning | 26 | 51 | 7250 | 北京 |
| 26 | reasoning | 27 | 53 | 7540 | / |
| 27 | reasoning | 28 | 55 | 7825 | 上海 |
| 28 | reasoning | 29 | 57 | 8115 | / |
| 29 | reasoning | 30 | 59 | 8400 | 广州 |
| 30 | reasoning | 31 | 61 | 8690 | / |
| 31 | reasoning | 32 | 63 | 8975 | 深圳 |
| 32 | reasoning | 33 | 65 | 9265 | / |
| 33 | reasoning | 34 | 67 | 9550 | 杭州 |
| 34 | reasoning | 35 | 69 | 9840 | ， |
| 35 | reasoning | 36 | 71 | 10127 | 北京 |
| 36 | reasoning | 37 | 73 | 10417 | 是 |
| 37 | reasoning | 38 | 75 | 10704 | 支持的 |
| 38 | reasoning | 39 | 77 | 10997 | 。 |
| 39 | reasoning | 40 | 79 | 11284 | \n\n |
| 40 | reasoning | 41 | 81 | 11572 | 我需要 |
| 41 | reasoning | 42 | 83 | 11865 | 调用 |
| 42 | reasoning | 43 | 85 | 12155 |  get |
| 43 | reasoning | 44 | 87 | 12443 | _weather |
| 44 | reasoning | 45 | 89 | 12735 |   |
| 45 | reasoning | 46 | 91 | 13020 | 函数 |
| 46 | reasoning | 47 | 93 | 13310 | ， |
| 47 | reasoning | 48 | 95 | 13597 | 参数 |
| 48 | reasoning | 49 | 97 | 13887 |  city |
| 49 | reasoning | 50 | 99 | 14176 |   |
| 50 | reasoning | 51 | 101 | 14461 | 设为 |
| 51 | reasoning | 52 | 103 | 14751 | \" |
| 52 | reasoning | 53 | 105 | 15037 | 北京 |
| 53 | reasoning | 54 | 107 | 15327 | \" |
| 54 | reasoning | 55 | 109 | 15613 | 。 |
| 55 | reasoning | 56 | 111 | 15900 | \n |
| 56 | tool-call | 57 | 113 | 16186 | name=get_weather args={ |
| 57 | tool-call | 58 | 115 | 16582 | name=null args=\"city\":\" |
| 58 | tool-call | 59 | 117 | 16909 | name=null args=北京 |
| 59 | tool-call | 60 | 119 | 17231 | name=null args=\" |
| 60 | tool-call | 61 | 121 | 17549 | name=null args=} |
