# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 55 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 49 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 3746 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 想了解 |
| 3 | reasoning | 3 | 5 | 131 | 北京的 |
| 4 | reasoning | 4 | 7 | 198 | 天气 |
| 5 | reasoning | 5 | 9 | 262 | 情况 |
| 6 | reasoning | 6 | 11 | 326 | 。 |
| 7 | reasoning | 7 | 13 | 387 | 我 |
| 8 | reasoning | 8 | 15 | 448 | 需要使用 |
| 9 | reasoning | 9 | 17 | 518 |  get |
| 10 | reasoning | 10 | 19 | 580 | _weather |
| 11 | reasoning | 11 | 21 | 646 |   |
| 12 | reasoning | 12 | 23 | 705 | 工具 |
| 13 | reasoning | 13 | 25 | 769 | 来 |
| 14 | reasoning | 14 | 27 | 830 | 查询 |
| 15 | reasoning | 15 | 29 | 894 | 北京 |
| 16 | reasoning | 16 | 31 | 958 | 今天的 |
| 17 | reasoning | 17 | 33 | 1025 | 天气 |
| 18 | reasoning | 18 | 35 | 1089 | 。 |
| 19 | reasoning | 19 | 37 | 1150 | 根据 |
| 20 | reasoning | 20 | 39 | 1214 | 工具 |
| 21 | reasoning | 21 | 41 | 1278 | 说明 |
| 22 | reasoning | 22 | 43 | 1342 | ， |
| 23 | reasoning | 23 | 45 | 1403 | get |
| 24 | reasoning | 24 | 47 | 1464 | _weather |
| 25 | reasoning | 25 | 49 | 1530 |   |
| 26 | reasoning | 26 | 51 | 1589 | 支持 |
| 27 | reasoning | 27 | 53 | 1653 | 查询 |
| 28 | reasoning | 28 | 55 | 1717 | 北京 |
| 29 | reasoning | 29 | 57 | 1781 | / |
| 30 | reasoning | 30 | 59 | 1840 | 上海 |
| 31 | reasoning | 31 | 61 | 1904 | / |
| 32 | reasoning | 32 | 63 | 1963 | 广州 |
| 33 | reasoning | 33 | 65 | 2027 | / |
| 34 | reasoning | 34 | 67 | 2086 | 深圳 |
| 35 | reasoning | 35 | 69 | 2150 | / |
| 36 | reasoning | 36 | 71 | 2209 | 杭州 |
| 37 | reasoning | 37 | 73 | 2273 | 的天气 |
| 38 | reasoning | 38 | 75 | 2340 | ， |
| 39 | reasoning | 39 | 77 | 2401 | 我需要 |
| 40 | reasoning | 40 | 79 | 2468 | 将 |
| 41 | reasoning | 41 | 81 | 2529 |  city |
| 42 | reasoning | 42 | 83 | 2592 |   |
| 43 | reasoning | 43 | 85 | 2651 | 参数 |
| 44 | reasoning | 44 | 87 | 2715 | 设置为 |
| 45 | reasoning | 45 | 89 | 2782 | \" |
| 46 | reasoning | 46 | 91 | 2842 | 北京 |
| 47 | reasoning | 47 | 93 | 2906 | \" |
| 48 | reasoning | 48 | 95 | 2966 | 。 |
| 49 | reasoning | 49 | 97 | 3027 | \n |
| 50 | tool-call | 50 | 99 | 3087 | name=get_weather args={ |
| 51 | tool-call | 51 | 101 | 3247 | name=null args=\"city\":\" |
| 52 | tool-call | 52 | 103 | 3356 | name=null args=北京 |
| 53 | tool-call | 53 | 105 | 3460 | name=null args=\" |
| 54 | tool-call | 54 | 107 | 3560 | name=null args=} |
