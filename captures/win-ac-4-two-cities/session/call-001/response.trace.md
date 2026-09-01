# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 52 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 40 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 15773 |

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
| 8 | reasoning | 9 | 17 | 2325 | 。 |
| 9 | reasoning | 10 | 19 | 2612 | 我 |
| 10 | reasoning | 11 | 21 | 2899 | 需要使用 |
| 11 | reasoning | 12 | 23 | 3195 |  get |
| 12 | reasoning | 13 | 25 | 3483 | _weather |
| 13 | reasoning | 14 | 27 | 3775 |   |
| 14 | reasoning | 15 | 29 | 4060 | 工具 |
| 15 | reasoning | 16 | 31 | 4350 | 分别 |
| 16 | reasoning | 17 | 33 | 4640 | 查询 |
| 17 | reasoning | 18 | 35 | 4930 | 这两个 |
| 18 | reasoning | 19 | 37 | 5223 | 城市的 |
| 19 | reasoning | 20 | 39 | 5516 | 天气 |
| 20 | reasoning | 21 | 41 | 5806 | 。 |
| 21 | reasoning | 22 | 43 | 6093 | \n\n |
| 22 | reasoning | 23 | 45 | 6381 | 我需要 |
| 23 | reasoning | 24 | 47 | 6674 | 调用 |
| 24 | reasoning | 25 | 49 | 6964 | 两次 |
| 25 | reasoning | 26 | 51 | 7254 |  get |
| 26 | reasoning | 27 | 53 | 7542 | _weather |
| 27 | reasoning | 28 | 55 | 7834 |   |
| 28 | reasoning | 29 | 57 | 8119 | 函数 |
| 29 | reasoning | 30 | 59 | 8409 | ， |
| 30 | reasoning | 31 | 61 | 8696 | 一次 |
| 31 | reasoning | 32 | 63 | 8986 | 查询 |
| 32 | reasoning | 33 | 65 | 9276 | 北京 |
| 33 | reasoning | 34 | 67 | 9566 | 天气 |
| 34 | reasoning | 35 | 69 | 9856 | ， |
| 35 | reasoning | 36 | 71 | 10143 | 一次 |
| 36 | reasoning | 37 | 73 | 10433 | 查询 |
| 37 | reasoning | 38 | 75 | 10723 | 上海 |
| 38 | reasoning | 39 | 77 | 11013 | 天气 |
| 39 | reasoning | 40 | 79 | 11303 | 。 |
| 40 | reasoning | 41 | 81 | 11590 | \n |
| 41 | tool-call | 42 | 83 | 11876 | name=get_weather args={ |
| 42 | tool-call | 43 | 85 | 12272 | name=null args=\"city\":\" |
| 43 | tool-call | 44 | 87 | 12599 | name=null args=北京 |
| 44 | tool-call | 45 | 89 | 12921 | name=null args=\" |
| 45 | tool-call | 46 | 91 | 13239 | name=null args=} |
| 46 | tool-call | 47 | 93 | 13556 | name=get_weather args={ |
| 47 | tool-call | 48 | 95 | 13952 | name=null args=\"city\":\" |
| 48 | tool-call | 49 | 97 | 14279 | name=null args=上海 |
| 49 | tool-call | 50 | 99 | 14601 | name=null args=\" |
| 50 | tool-call | 51 | 101 | 14919 | name=null args=} |
