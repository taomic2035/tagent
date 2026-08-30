# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 44 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 24 |
| 正文 token（text） | 19 |
| tool_call 分片 | 0 |
| finish_reason | stop |
| 收到 [DONE] | 是 |
| 文件字节数 | 2661 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 根据 |
| 2 | reasoning | 2 | 3 | 64 | 工具 |
| 3 | reasoning | 3 | 5 | 128 | 返回 |
| 4 | reasoning | 4 | 7 | 192 | 的结果 |
| 5 | reasoning | 5 | 9 | 259 | ， |
| 6 | reasoning | 6 | 11 | 320 | 3 |
| 7 | reasoning | 7 | 13 | 379 | . |
| 8 | reasoning | 8 | 15 | 438 | 7 |
| 9 | reasoning | 9 | 17 | 497 |  乘以 |
| 10 | reasoning | 10 | 19 | 562 |  1 |
| 11 | reasoning | 11 | 21 | 622 | 2 |
| 12 | reasoning | 12 | 23 | 681 |  再 |
| 13 | reasoning | 13 | 25 | 743 | 减 |
| 14 | reasoning | 14 | 27 | 804 |  8 |
| 15 | reasoning | 15 | 29 | 864 | . |
| 16 | reasoning | 16 | 31 | 923 | 2 |
| 17 | reasoning | 17 | 33 | 982 |  的结果 |
| 18 | reasoning | 18 | 35 | 1050 | 是 |
| 19 | reasoning | 19 | 37 | 1111 |  3 |
| 20 | reasoning | 20 | 39 | 1171 | 6 |
| 21 | reasoning | 21 | 41 | 1230 | . |
| 22 | reasoning | 22 | 43 | 1289 | 2 |
| 23 | reasoning | 23 | 45 | 1348 | 。 |
| 24 | reasoning | 24 | 47 | 1409 | \n |
| 25 | text | 25 | 49 | 1469 | \n\n |
| 26 | text | 26 | 51 | 1529 | 3 |
| 27 | text | 27 | 53 | 1586 | . |
| 28 | text | 28 | 55 | 1643 | 7 |
| 29 | text | 29 | 57 | 1700 |  乘以 |
| 30 | text | 30 | 59 | 1763 |  1 |
| 31 | text | 31 | 61 | 1821 | 2 |
| 32 | text | 32 | 63 | 1878 |  再 |
| 33 | text | 33 | 65 | 1938 | 减 |
| 34 | text | 34 | 67 | 1997 |  8 |
| 35 | text | 35 | 69 | 2055 | . |
| 36 | text | 36 | 71 | 2112 | 2 |
| 37 | text | 37 | 73 | 2169 |  等于 |
| 38 | text | 38 | 75 | 2232 |  ** |
| 39 | text | 39 | 77 | 2291 | 3 |
| 40 | text | 40 | 79 | 2348 | 6 |
| 41 | text | 41 | 81 | 2405 | . |
| 42 | text | 42 | 83 | 2462 | 2 |
| 43 | text | 43 | 85 | 2519 | **。 |
