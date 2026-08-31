# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 62 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 56 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 4190 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 想 |
| 3 | reasoning | 3 | 5 | 125 | 查询 |
| 4 | reasoning | 4 | 7 | 189 | 北京的 |
| 5 | reasoning | 5 | 9 | 256 | 天气 |
| 6 | reasoning | 6 | 11 | 320 | 情况 |
| 7 | reasoning | 7 | 13 | 384 | 。 |
| 8 | reasoning | 8 | 15 | 445 | 我 |
| 9 | reasoning | 9 | 17 | 506 | 需要使用 |
| 10 | reasoning | 10 | 19 | 576 |  get |
| 11 | reasoning | 11 | 21 | 638 | _weather |
| 12 | reasoning | 12 | 23 | 704 |   |
| 13 | reasoning | 13 | 25 | 763 | 工具 |
| 14 | reasoning | 14 | 27 | 827 | 来获取 |
| 15 | reasoning | 15 | 29 | 894 | 这个 |
| 16 | reasoning | 16 | 31 | 958 | 信息 |
| 17 | reasoning | 17 | 33 | 1022 | 。 |
| 18 | reasoning | 18 | 35 | 1083 | 根据 |
| 19 | reasoning | 19 | 37 | 1147 | 工具 |
| 20 | reasoning | 20 | 39 | 1211 | 描述 |
| 21 | reasoning | 21 | 41 | 1275 | ， |
| 22 | reasoning | 22 | 43 | 1336 | 支持 |
| 23 | reasoning | 23 | 45 | 1400 | 的城市 |
| 24 | reasoning | 24 | 47 | 1467 | 包括 |
| 25 | reasoning | 25 | 49 | 1531 | 北京 |
| 26 | reasoning | 26 | 51 | 1595 | / |
| 27 | reasoning | 27 | 53 | 1654 | 上海 |
| 28 | reasoning | 28 | 55 | 1718 | / |
| 29 | reasoning | 29 | 57 | 1777 | 广州 |
| 30 | reasoning | 30 | 59 | 1841 | / |
| 31 | reasoning | 31 | 61 | 1900 | 深圳 |
| 32 | reasoning | 32 | 63 | 1964 | / |
| 33 | reasoning | 33 | 65 | 2023 | 杭州 |
| 34 | reasoning | 34 | 67 | 2087 | ， |
| 35 | reasoning | 35 | 69 | 2148 | 北京 |
| 36 | reasoning | 36 | 71 | 2212 | 是 |
| 37 | reasoning | 37 | 73 | 2273 | 支持 |
| 38 | reasoning | 38 | 75 | 2337 | 的城市 |
| 39 | reasoning | 39 | 77 | 2404 | 之一 |
| 40 | reasoning | 40 | 79 | 2468 | 。 |
| 41 | reasoning | 41 | 81 | 2529 | 我需要 |
| 42 | reasoning | 42 | 83 | 2596 | 调用 |
| 43 | reasoning | 43 | 85 | 2660 |  get |
| 44 | reasoning | 44 | 87 | 2722 | _weather |
| 45 | reasoning | 45 | 89 | 2788 |   |
| 46 | reasoning | 46 | 91 | 2847 | 函数 |
| 47 | reasoning | 47 | 93 | 2911 | ， |
| 48 | reasoning | 48 | 95 | 2972 | 参数 |
| 49 | reasoning | 49 | 97 | 3036 |  city |
| 50 | reasoning | 50 | 99 | 3099 |   |
| 51 | reasoning | 51 | 101 | 3158 | 设置为 |
| 52 | reasoning | 52 | 103 | 3225 |  \" |
| 53 | reasoning | 53 | 105 | 3286 | 北京 |
| 54 | reasoning | 54 | 107 | 3350 | \" |
| 55 | reasoning | 55 | 109 | 3410 | 。 |
| 56 | reasoning | 56 | 111 | 3471 | \n |
| 57 | tool-call | 57 | 113 | 3531 | name=get_weather args={ |
| 58 | tool-call | 58 | 115 | 3691 | name=null args=\"city\":\" |
| 59 | tool-call | 59 | 117 | 3800 | name=null args=北京 |
| 60 | tool-call | 60 | 119 | 3904 | name=null args=\" |
| 61 | tool-call | 61 | 121 | 4004 | name=null args=} |
