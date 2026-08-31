# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 66 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 54 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 19809 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想要 |
| 3 | reasoning | 4 | 7 | 875 | 查询 |
| 4 | reasoning | 5 | 9 | 1165 | 广州 |
| 5 | reasoning | 6 | 11 | 1455 | 和 |
| 6 | reasoning | 7 | 13 | 1742 | 深圳 |
| 7 | reasoning | 8 | 15 | 2032 | 的温度 |
| 8 | reasoning | 9 | 17 | 2325 | ， |
| 9 | reasoning | 10 | 19 | 2612 | 然后 |
| 10 | reasoning | 11 | 21 | 2902 | 计算 |
| 11 | reasoning | 12 | 23 | 3192 | 它们的 |
| 12 | reasoning | 13 | 25 | 3485 | 平均值 |
| 13 | reasoning | 14 | 27 | 3778 | 。 |
| 14 | reasoning | 15 | 29 | 4065 | 我需要 |
| 15 | reasoning | 16 | 31 | 4358 | ： |
| 16 | reasoning | 17 | 33 | 4645 | \n |
| 17 | reasoning | 18 | 35 | 4931 | 1 |
| 18 | reasoning | 19 | 37 | 5216 | . |
| 19 | reasoning | 20 | 39 | 5501 |   |
| 20 | reasoning | 21 | 41 | 5786 | 先 |
| 21 | reasoning | 22 | 43 | 6073 | 查询 |
| 22 | reasoning | 23 | 45 | 6363 | 广州 |
| 23 | reasoning | 24 | 47 | 6653 | 的温度 |
| 24 | reasoning | 25 | 49 | 6946 | \n |
| 25 | reasoning | 26 | 51 | 7232 | 2 |
| 26 | reasoning | 27 | 53 | 7517 | . |
| 27 | reasoning | 28 | 55 | 7802 |   |
| 28 | reasoning | 29 | 57 | 8087 | 再 |
| 29 | reasoning | 30 | 59 | 8374 | 查询 |
| 30 | reasoning | 31 | 61 | 8664 | 深圳 |
| 31 | reasoning | 32 | 63 | 8954 | 的温度 |
| 32 | reasoning | 33 | 65 | 9247 | \n |
| 33 | reasoning | 34 | 67 | 9533 | 3 |
| 34 | reasoning | 35 | 69 | 9818 | . |
| 35 | reasoning | 36 | 71 | 10103 |   |
| 36 | reasoning | 37 | 73 | 10388 | 然后 |
| 37 | reasoning | 38 | 75 | 10678 | 计算 |
| 38 | reasoning | 39 | 77 | 10968 | 两个 |
| 39 | reasoning | 40 | 79 | 11258 | 温度的 |
| 40 | reasoning | 41 | 81 | 11551 | 平均值 |
| 41 | reasoning | 42 | 83 | 11844 | \n\n |
| 42 | reasoning | 43 | 85 | 12132 | 让我 |
| 43 | reasoning | 44 | 87 | 12422 | 先 |
| 44 | reasoning | 45 | 89 | 12709 | 调用 |
| 45 | reasoning | 46 | 91 | 12999 | 天气 |
| 46 | reasoning | 47 | 93 | 13289 | 查询 |
| 47 | reasoning | 48 | 95 | 13579 | 工具 |
| 48 | reasoning | 49 | 97 | 13869 | 获取 |
| 49 | reasoning | 50 | 99 | 14159 | 这两个 |
| 50 | reasoning | 51 | 101 | 14452 | 城市的 |
| 51 | reasoning | 52 | 103 | 14745 | 天气 |
| 52 | reasoning | 53 | 105 | 15035 | 信息 |
| 53 | reasoning | 54 | 107 | 15325 | 。 |
| 54 | reasoning | 55 | 109 | 15612 | \n |
| 55 | tool-call | 56 | 111 | 15898 | name=get_weather args={ |
| 56 | tool-call | 57 | 113 | 16294 | name=null args=\"city\":\" |
| 57 | tool-call | 58 | 115 | 16621 | name=null args=广州 |
| 58 | tool-call | 59 | 117 | 16943 | name=null args=\" |
| 59 | tool-call | 60 | 119 | 17261 | name=null args=} |
| 60 | tool-call | 61 | 121 | 17578 | name=get_weather args={ |
| 61 | tool-call | 62 | 123 | 17974 | name=null args=\"city\":\" |
| 62 | tool-call | 63 | 125 | 18301 | name=null args=深圳 |
| 63 | tool-call | 64 | 127 | 18623 | name=null args=\" |
| 64 | tool-call | 65 | 129 | 18941 | name=null args=} |
