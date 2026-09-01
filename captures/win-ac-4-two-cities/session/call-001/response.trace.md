# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 71 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 59 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 21291 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想要 |
| 3 | reasoning | 4 | 7 | 875 | 对比 |
| 4 | reasoning | 5 | 9 | 1165 | 北京 |
| 5 | reasoning | 6 | 11 | 1455 | 和 |
| 6 | reasoning | 7 | 13 | 1742 | 上海的 |
| 7 | reasoning | 8 | 15 | 2035 | 天气 |
| 8 | reasoning | 9 | 17 | 2325 | ， |
| 9 | reasoning | 10 | 19 | 2612 | 我需要 |
| 10 | reasoning | 11 | 21 | 2905 | 调用 |
| 11 | reasoning | 12 | 23 | 3195 | 天气 |
| 12 | reasoning | 13 | 25 | 3485 | 查询 |
| 13 | reasoning | 14 | 27 | 3775 | 工具 |
| 14 | reasoning | 15 | 29 | 4065 | 来获取 |
| 15 | reasoning | 16 | 31 | 4358 | 这两个 |
| 16 | reasoning | 17 | 33 | 4651 | 城市的 |
| 17 | reasoning | 18 | 35 | 4944 | 天气 |
| 18 | reasoning | 19 | 37 | 5234 | 信息 |
| 19 | reasoning | 20 | 39 | 5524 | 。 |
| 20 | reasoning | 21 | 41 | 5811 | \n\n |
| 21 | reasoning | 22 | 43 | 6099 | 我 |
| 22 | reasoning | 23 | 45 | 6386 | 需要使用 |
| 23 | reasoning | 24 | 47 | 6682 |  get |
| 24 | reasoning | 25 | 49 | 6970 | _weather |
| 25 | reasoning | 26 | 51 | 7262 |   |
| 26 | reasoning | 27 | 53 | 7547 | 工具 |
| 27 | reasoning | 28 | 55 | 7837 | 分别 |
| 28 | reasoning | 29 | 57 | 8127 | 查询 |
| 29 | reasoning | 30 | 59 | 8417 | 北京 |
| 30 | reasoning | 31 | 61 | 8707 | 和 |
| 31 | reasoning | 32 | 63 | 8994 | 上海的 |
| 32 | reasoning | 33 | 65 | 9287 | 天气 |
| 33 | reasoning | 34 | 67 | 9577 | 。 |
| 34 | reasoning | 35 | 69 | 9864 | 这个 |
| 35 | reasoning | 36 | 71 | 10154 | 工具 |
| 36 | reasoning | 37 | 73 | 10444 | 支持 |
| 37 | reasoning | 38 | 75 | 10734 | 北京 |
| 38 | reasoning | 39 | 77 | 11024 | 和上海 |
| 39 | reasoning | 40 | 79 | 11317 | 这两个 |
| 40 | reasoning | 41 | 81 | 11610 | 城市 |
| 41 | reasoning | 42 | 83 | 11900 | 。 |
| 42 | reasoning | 43 | 85 | 12187 | \n\n |
| 43 | reasoning | 44 | 87 | 12475 | 我需要 |
| 44 | reasoning | 45 | 89 | 12768 | 调用 |
| 45 | reasoning | 46 | 91 | 13058 | 两次 |
| 46 | reasoning | 47 | 93 | 13348 |  get |
| 47 | reasoning | 48 | 95 | 13636 | _weather |
| 48 | reasoning | 49 | 97 | 13928 |   |
| 49 | reasoning | 50 | 99 | 14213 | 工具 |
| 50 | reasoning | 51 | 101 | 14503 | ， |
| 51 | reasoning | 52 | 103 | 14790 | 一次 |
| 52 | reasoning | 53 | 105 | 15080 | 查询 |
| 53 | reasoning | 54 | 107 | 15370 | 北京 |
| 54 | reasoning | 55 | 109 | 15660 | ， |
| 55 | reasoning | 56 | 111 | 15947 | 一次 |
| 56 | reasoning | 57 | 113 | 16237 | 查询 |
| 57 | reasoning | 58 | 115 | 16527 | 上海 |
| 58 | reasoning | 59 | 117 | 16817 | 。 |
| 59 | reasoning | 60 | 119 | 17104 | \n |
| 60 | tool-call | 61 | 121 | 17390 | name=get_weather args={ |
| 61 | tool-call | 62 | 123 | 17786 | name=null args=\"city\":\" |
| 62 | tool-call | 63 | 125 | 18113 | name=null args=北京 |
| 63 | tool-call | 64 | 127 | 18435 | name=null args=\" |
| 64 | tool-call | 65 | 129 | 18753 | name=null args=} |
| 65 | tool-call | 66 | 131 | 19070 | name=get_weather args={ |
| 66 | tool-call | 67 | 133 | 19466 | name=null args=\"city\":\" |
| 67 | tool-call | 68 | 135 | 19793 | name=null args=上海 |
| 68 | tool-call | 69 | 137 | 20115 | name=null args=\" |
| 69 | tool-call | 70 | 139 | 20433 | name=null args=} |
