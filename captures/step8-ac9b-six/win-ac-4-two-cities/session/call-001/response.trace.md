# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 50 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 38 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 13753 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 266 | 用户 |
| 2 | reasoning | 3 | 5 | 527 | 想要 |
| 3 | reasoning | 4 | 7 | 788 | 对比 |
| 4 | reasoning | 5 | 9 | 1049 | 北京 |
| 5 | reasoning | 6 | 11 | 1310 | 和 |
| 6 | reasoning | 7 | 13 | 1568 | 上海的 |
| 7 | reasoning | 8 | 15 | 1832 | 天气 |
| 8 | reasoning | 9 | 17 | 2093 | 。 |
| 9 | reasoning | 10 | 19 | 2351 | 我 |
| 10 | reasoning | 11 | 21 | 2609 | 需要使用 |
| 11 | reasoning | 12 | 23 | 2876 |  get |
| 12 | reasoning | 13 | 25 | 3135 | _weather |
| 13 | reasoning | 14 | 27 | 3398 |   |
| 14 | reasoning | 15 | 29 | 3654 | 工具 |
| 15 | reasoning | 16 | 31 | 3915 | 来获取 |
| 16 | reasoning | 17 | 33 | 4179 | 这两个 |
| 17 | reasoning | 18 | 35 | 4443 | 城市的 |
| 18 | reasoning | 19 | 37 | 4707 | 天气 |
| 19 | reasoning | 20 | 39 | 4968 | 信息 |
| 20 | reasoning | 21 | 41 | 5229 | 。 |
| 21 | reasoning | 22 | 43 | 5487 | 我需要 |
| 22 | reasoning | 23 | 45 | 5751 | 分别 |
| 23 | reasoning | 24 | 47 | 6012 | 调用 |
| 24 | reasoning | 25 | 49 | 6273 | 两次 |
| 25 | reasoning | 26 | 51 | 6534 |  get |
| 26 | reasoning | 27 | 53 | 6793 | _weather |
| 27 | reasoning | 28 | 55 | 7056 |   |
| 28 | reasoning | 29 | 57 | 7312 | 工具 |
| 29 | reasoning | 30 | 59 | 7573 | ， |
| 30 | reasoning | 31 | 61 | 7831 | 一次 |
| 31 | reasoning | 32 | 63 | 8092 | 查询 |
| 32 | reasoning | 33 | 65 | 8353 | 北京 |
| 33 | reasoning | 34 | 67 | 8614 | ， |
| 34 | reasoning | 35 | 69 | 8872 | 一次 |
| 35 | reasoning | 36 | 71 | 9133 | 查询 |
| 36 | reasoning | 37 | 73 | 9394 | 上海 |
| 37 | reasoning | 38 | 75 | 9655 | 。 |
| 38 | reasoning | 39 | 77 | 9913 | \n |
| 39 | tool-call | 40 | 79 | 10170 | name=get_weather args={ |
| 40 | tool-call | 41 | 81 | 10537 | name=null args=\"city\":\" |
| 41 | tool-call | 42 | 83 | 10835 | name=null args=北京 |
| 42 | tool-call | 43 | 85 | 11128 | name=null args=\" |
| 43 | tool-call | 44 | 87 | 11417 | name=null args=} |
| 44 | tool-call | 45 | 89 | 11705 | name=get_weather args={ |
| 45 | tool-call | 46 | 91 | 12072 | name=null args=\"city\":\" |
| 46 | tool-call | 47 | 93 | 12370 | name=null args=上海 |
| 47 | tool-call | 48 | 95 | 12663 | name=null args=\" |
| 48 | tool-call | 49 | 97 | 12952 | name=null args=} |
