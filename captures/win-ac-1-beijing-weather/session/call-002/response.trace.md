# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 68 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 48 |
| 正文 token（text） | 19 |
| tool_call 分片 | 0 |
| finish_reason | stop |
| 收到 [DONE] | 是 |
| 文件字节数 | 4262 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 用户 |
| 2 | reasoning | 2 | 3 | 64 | 询问 |
| 3 | reasoning | 3 | 5 | 128 | 北京 |
| 4 | reasoning | 4 | 7 | 192 | 今天的 |
| 5 | reasoning | 5 | 9 | 259 | 天气 |
| 6 | reasoning | 6 | 11 | 323 | ， |
| 7 | reasoning | 7 | 13 | 384 | 我已经 |
| 8 | reasoning | 8 | 15 | 451 | 调用 |
| 9 | reasoning | 9 | 17 | 515 | get |
| 10 | reasoning | 10 | 19 | 576 | _weather |
| 11 | reasoning | 11 | 21 | 642 | 工具 |
| 12 | reasoning | 12 | 23 | 706 | 获取 |
| 13 | reasoning | 13 | 25 | 770 | 了 |
| 14 | reasoning | 14 | 27 | 831 | 北京 |
| 15 | reasoning | 15 | 29 | 895 | 的天气 |
| 16 | reasoning | 16 | 31 | 962 | 数据 |
| 17 | reasoning | 17 | 33 | 1026 | 。 |
| 18 | reasoning | 18 | 35 | 1087 | 根据 |
| 19 | reasoning | 19 | 37 | 1151 | 返回 |
| 20 | reasoning | 20 | 39 | 1215 | 结果 |
| 21 | reasoning | 21 | 41 | 1279 | ， |
| 22 | reasoning | 22 | 43 | 1340 | 北京 |
| 23 | reasoning | 23 | 45 | 1404 | 今天 |
| 24 | reasoning | 24 | 47 | 1468 | 天气 |
| 25 | reasoning | 25 | 49 | 1532 | 晴朗 |
| 26 | reasoning | 26 | 51 | 1596 | ， |
| 27 | reasoning | 27 | 53 | 1657 | 温度 |
| 28 | reasoning | 28 | 55 | 1721 | 2 |
| 29 | reasoning | 29 | 57 | 1780 | 8 |
| 30 | reasoning | 30 | 59 | 1839 | 摄氏度 |
| 31 | reasoning | 31 | 61 | 1906 | ， |
| 32 | reasoning | 32 | 63 | 1967 | 湿度 |
| 33 | reasoning | 33 | 65 | 2031 | 4 |
| 34 | reasoning | 34 | 67 | 2090 | 0 |
| 35 | reasoning | 35 | 69 | 2149 | %， |
| 36 | reasoning | 36 | 71 | 2211 | 空气质量 |
| 37 | reasoning | 37 | 73 | 2281 | 指数 |
| 38 | reasoning | 38 | 75 | 2345 | 5 |
| 39 | reasoning | 39 | 77 | 2404 | 5 |
| 40 | reasoning | 40 | 79 | 2463 | 。 |
| 41 | reasoning | 41 | 81 | 2524 | 我 |
| 42 | reasoning | 42 | 83 | 2585 | 可以直接 |
| 43 | reasoning | 43 | 85 | 2655 | 向 |
| 44 | reasoning | 44 | 87 | 2716 | 用户 |
| 45 | reasoning | 45 | 89 | 2780 | 汇报 |
| 46 | reasoning | 46 | 91 | 2844 | 这些信息 |
| 47 | reasoning | 47 | 93 | 2914 | 。 |
| 48 | reasoning | 48 | 95 | 2975 | \n |
| 49 | text | 49 | 97 | 3035 | 北京 |
| 50 | text | 50 | 99 | 3097 | 今天 |
| 51 | text | 51 | 101 | 3159 | 天气 |
| 52 | text | 52 | 103 | 3221 | 晴朗 |
| 53 | text | 53 | 105 | 3283 | ， |
| 54 | text | 54 | 107 | 3342 | 气温 |
| 55 | text | 55 | 109 | 3404 | 2 |
| 56 | text | 56 | 111 | 3461 | 8 |
| 57 | text | 57 | 113 | 3518 | 摄氏度 |
| 58 | text | 58 | 115 | 3583 | ， |
| 59 | text | 59 | 117 | 3642 | 湿度 |
| 60 | text | 60 | 119 | 3704 | 4 |
| 61 | text | 61 | 121 | 3761 | 0 |
| 62 | text | 62 | 123 | 3818 | %， |
| 63 | text | 63 | 125 | 3878 | 空气质量 |
| 64 | text | 64 | 127 | 3946 | 指数 |
| 65 | text | 65 | 129 | 4008 | 5 |
| 66 | text | 66 | 131 | 4065 | 5 |
| 67 | text | 67 | 133 | 4122 | 。 |
