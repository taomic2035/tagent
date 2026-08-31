# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 78 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 56 |
| 正文 token（text） | 0 |
| tool_call 分片 | 20 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 23745 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想要 |
| 3 | reasoning | 4 | 7 | 875 | 比较 |
| 4 | reasoning | 5 | 9 | 1165 | 两组 |
| 5 | reasoning | 6 | 11 | 1455 | 城市的 |
| 6 | reasoning | 7 | 13 | 1748 | 平均 |
| 7 | reasoning | 8 | 15 | 2038 | 温度 |
| 8 | reasoning | 9 | 17 | 2328 | ： |
| 9 | reasoning | 10 | 19 | 2615 | \n |
| 10 | reasoning | 11 | 21 | 2901 | - |
| 11 | reasoning | 12 | 23 | 3186 |   |
| 12 | reasoning | 13 | 25 | 3471 | 第一 |
| 13 | reasoning | 14 | 27 | 3761 | 组 |
| 14 | reasoning | 15 | 29 | 4048 | ： |
| 15 | reasoning | 16 | 31 | 4335 | 北京 |
| 16 | reasoning | 17 | 33 | 4625 | 和上海 |
| 17 | reasoning | 18 | 35 | 4918 | \n |
| 18 | reasoning | 19 | 37 | 5204 | - |
| 19 | reasoning | 20 | 39 | 5489 |   |
| 20 | reasoning | 21 | 41 | 5774 | 第二 |
| 21 | reasoning | 22 | 43 | 6064 | 组 |
| 22 | reasoning | 23 | 45 | 6351 | ： |
| 23 | reasoning | 24 | 47 | 6638 | 广州 |
| 24 | reasoning | 25 | 49 | 6928 | 和 |
| 25 | reasoning | 26 | 51 | 7215 | 深圳 |
| 26 | reasoning | 27 | 53 | 7505 | \n\n |
| 27 | reasoning | 28 | 55 | 7793 | 我需要 |
| 28 | reasoning | 29 | 57 | 8086 | 先 |
| 29 | reasoning | 30 | 59 | 8373 | 查询 |
| 30 | reasoning | 31 | 61 | 8663 | 这四个 |
| 31 | reasoning | 32 | 63 | 8956 | 城市的 |
| 32 | reasoning | 33 | 65 | 9249 | 当前 |
| 33 | reasoning | 34 | 67 | 9539 | 天气 |
| 34 | reasoning | 35 | 69 | 9829 | ， |
| 35 | reasoning | 36 | 71 | 10116 | 然后 |
| 36 | reasoning | 37 | 73 | 10406 | 计算 |
| 37 | reasoning | 38 | 75 | 10696 | 每组 |
| 38 | reasoning | 39 | 77 | 10986 | 平均 |
| 39 | reasoning | 40 | 79 | 11276 | 温度 |
| 40 | reasoning | 41 | 81 | 11566 | ， |
| 41 | reasoning | 42 | 83 | 11853 | 最后 |
| 42 | reasoning | 43 | 85 | 12143 | 比较 |
| 43 | reasoning | 44 | 87 | 12433 | 哪 |
| 44 | reasoning | 45 | 89 | 12720 | 组 |
| 45 | reasoning | 46 | 91 | 13007 | 更 |
| 46 | reasoning | 47 | 93 | 13294 | 热 |
| 47 | reasoning | 48 | 95 | 13581 | 。 |
| 48 | reasoning | 49 | 97 | 13868 | \n\n |
| 49 | reasoning | 50 | 99 | 14156 | 让我 |
| 50 | reasoning | 51 | 101 | 14446 | 先 |
| 51 | reasoning | 52 | 103 | 14733 | 查询 |
| 52 | reasoning | 53 | 105 | 15023 | 这四个 |
| 53 | reasoning | 54 | 107 | 15316 | 城市的 |
| 54 | reasoning | 55 | 109 | 15609 | 天气 |
| 55 | reasoning | 56 | 111 | 15899 | 。 |
| 56 | reasoning | 57 | 113 | 16186 | \n |
| 57 | tool-call | 58 | 115 | 16472 | name=get_weather args={ |
| 58 | tool-call | 59 | 117 | 16868 | name=null args=\"city\":\" |
| 59 | tool-call | 60 | 119 | 17195 | name=null args=北京 |
| 60 | tool-call | 61 | 121 | 17517 | name=null args=\" |
| 61 | tool-call | 62 | 123 | 17835 | name=null args=} |
| 62 | tool-call | 63 | 125 | 18152 | name=get_weather args={ |
| 63 | tool-call | 64 | 127 | 18548 | name=null args=\"city\":\" |
| 64 | tool-call | 65 | 129 | 18875 | name=null args=上海 |
| 65 | tool-call | 66 | 131 | 19197 | name=null args=\" |
| 66 | tool-call | 67 | 133 | 19515 | name=null args=} |
| 67 | tool-call | 68 | 135 | 19832 | name=get_weather args={ |
| 68 | tool-call | 69 | 137 | 20228 | name=null args=\"city\":\" |
| 69 | tool-call | 70 | 139 | 20555 | name=null args=广州 |
| 70 | tool-call | 71 | 141 | 20877 | name=null args=\" |
| 71 | tool-call | 72 | 143 | 21195 | name=null args=} |
| 72 | tool-call | 73 | 145 | 21512 | name=get_weather args={ |
| 73 | tool-call | 74 | 147 | 21908 | name=null args=\"city\":\" |
| 74 | tool-call | 75 | 149 | 22235 | name=null args=深圳 |
| 75 | tool-call | 76 | 151 | 22557 | name=null args=\" |
| 76 | tool-call | 77 | 153 | 22875 | name=null args=} |
