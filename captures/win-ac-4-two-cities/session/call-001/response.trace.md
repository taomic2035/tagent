# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 61 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 50 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 4404 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 想要 |
| 3 | reasoning | 3 | 5 | 128 | 对比 |
| 4 | reasoning | 4 | 7 | 192 | 北京 |
| 5 | reasoning | 5 | 9 | 256 | 和 |
| 6 | reasoning | 6 | 11 | 317 | 上海的 |
| 7 | reasoning | 7 | 13 | 384 | 天气 |
| 8 | reasoning | 8 | 15 | 448 | 。 |
| 9 | reasoning | 9 | 17 | 509 | 我需要 |
| 10 | reasoning | 10 | 19 | 576 | 分别 |
| 11 | reasoning | 11 | 21 | 640 | 查询 |
| 12 | reasoning | 12 | 23 | 704 | 这两个 |
| 13 | reasoning | 13 | 25 | 771 | 城市的 |
| 14 | reasoning | 14 | 27 | 838 | 天气 |
| 15 | reasoning | 15 | 29 | 902 | 信息 |
| 16 | reasoning | 16 | 31 | 966 | 。 |
| 17 | reasoning | 17 | 33 | 1027 | \n\n |
| 18 | reasoning | 18 | 35 | 1089 | 我 |
| 19 | reasoning | 19 | 37 | 1150 | 需要使用 |
| 20 | reasoning | 20 | 39 | 1220 |  get |
| 21 | reasoning | 21 | 41 | 1282 | _weather |
| 22 | reasoning | 22 | 43 | 1348 |   |
| 23 | reasoning | 23 | 45 | 1407 | 工具 |
| 24 | reasoning | 24 | 47 | 1471 | 来 |
| 25 | reasoning | 25 | 49 | 1532 | 查询 |
| 26 | reasoning | 26 | 51 | 1596 | 北京 |
| 27 | reasoning | 27 | 53 | 1660 | 和 |
| 28 | reasoning | 28 | 55 | 1721 | 上海的 |
| 29 | reasoning | 29 | 57 | 1788 | 天气 |
| 30 | reasoning | 30 | 59 | 1852 | 。 |
| 31 | reasoning | 31 | 61 | 1913 | \n\n |
| 32 | reasoning | 32 | 63 | 1975 | 让我 |
| 33 | reasoning | 33 | 65 | 2039 | 调用 |
| 34 | reasoning | 34 | 67 | 2103 | 两次 |
| 35 | reasoning | 35 | 69 | 2167 |  get |
| 36 | reasoning | 36 | 71 | 2229 | _weather |
| 37 | reasoning | 37 | 73 | 2295 |   |
| 38 | reasoning | 38 | 75 | 2354 | 函数 |
| 39 | reasoning | 39 | 77 | 2418 | ， |
| 40 | reasoning | 40 | 79 | 2479 | 一次 |
| 41 | reasoning | 41 | 81 | 2543 | 查询 |
| 42 | reasoning | 42 | 83 | 2607 | 北京 |
| 43 | reasoning | 43 | 85 | 2671 | 天气 |
| 44 | reasoning | 44 | 87 | 2735 | ， |
| 45 | reasoning | 45 | 89 | 2796 | 一次 |
| 46 | reasoning | 46 | 91 | 2860 | 查询 |
| 47 | reasoning | 47 | 93 | 2924 | 上海 |
| 48 | reasoning | 48 | 95 | 2988 | 天气 |
| 49 | reasoning | 49 | 97 | 3052 | 。 |
| 50 | reasoning | 50 | 99 | 3113 | \n |
| 51 | tool-call | 51 | 101 | 3173 | name=get_weather args={ |
| 52 | tool-call | 52 | 103 | 3333 | name=null args=\"city\":\" |
| 53 | tool-call | 53 | 105 | 3442 | name=null args=北京 |
| 54 | tool-call | 54 | 107 | 3546 | name=null args=\" |
| 55 | tool-call | 55 | 109 | 3646 | name=null args=} |
| 56 | tool-call | 56 | 111 | 3745 | name=get_weather args={ |
| 57 | tool-call | 57 | 113 | 3905 | name=null args=\"city\":\" |
| 58 | tool-call | 58 | 115 | 4014 | name=null args=上海 |
| 59 | tool-call | 59 | 117 | 4118 | name=null args=\" |
| 60 | tool-call | 60 | 119 | 4218 | name=null args=} |
