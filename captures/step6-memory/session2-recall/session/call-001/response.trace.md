# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 55 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 42 |
| 正文 token（text） | 0 |
| tool_call 分片 | 11 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 16604 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 问 |
| 3 | reasoning | 4 | 7 | 872 | 他们 |
| 4 | reasoning | 5 | 9 | 1162 | 喜欢 |
| 5 | reasoning | 6 | 11 | 1452 | 喝 |
| 6 | reasoning | 7 | 13 | 1739 | 什么 |
| 7 | reasoning | 8 | 15 | 2029 | 咖啡 |
| 8 | reasoning | 9 | 17 | 2319 | 。 |
| 9 | reasoning | 10 | 19 | 2606 | 这 |
| 10 | reasoning | 11 | 21 | 2893 | 涉及到 |
| 11 | reasoning | 12 | 23 | 3186 | 用户的 |
| 12 | reasoning | 13 | 25 | 3479 | 偏好 |
| 13 | reasoning | 14 | 27 | 3769 | 信息 |
| 14 | reasoning | 15 | 29 | 4059 | ， |
| 15 | reasoning | 16 | 31 | 4346 | 我应该 |
| 16 | reasoning | 17 | 33 | 4639 | 使用 |
| 17 | reasoning | 18 | 35 | 4929 | recall |
| 18 | reasoning | 19 | 37 | 5219 | 工具 |
| 19 | reasoning | 20 | 39 | 5509 | 来 |
| 20 | reasoning | 21 | 41 | 5796 | 查询 |
| 21 | reasoning | 22 | 43 | 6086 | 长期 |
| 22 | reasoning | 23 | 45 | 6376 | 记忆中 |
| 23 | reasoning | 24 | 47 | 6669 | 是否 |
| 24 | reasoning | 25 | 49 | 6959 | 有关于 |
| 25 | reasoning | 26 | 51 | 7252 | 用户 |
| 26 | reasoning | 27 | 53 | 7542 | 咖啡 |
| 27 | reasoning | 28 | 55 | 7832 | 偏 |
| 28 | reasoning | 29 | 57 | 8119 | 好的 |
| 29 | reasoning | 30 | 59 | 8409 | 记录 |
| 30 | reasoning | 31 | 61 | 8699 | 。 |
| 31 | reasoning | 32 | 63 | 8986 | \n\n |
| 32 | reasoning | 33 | 65 | 9274 | 让我 |
| 33 | reasoning | 34 | 67 | 9564 | 调用 |
| 34 | reasoning | 35 | 69 | 9854 | recall |
| 35 | reasoning | 36 | 71 | 10144 | 工具 |
| 36 | reasoning | 37 | 73 | 10434 | 来 |
| 37 | reasoning | 38 | 75 | 10721 | 查询 |
| 38 | reasoning | 39 | 77 | 11011 | 用户的 |
| 39 | reasoning | 40 | 79 | 11304 | 咖啡 |
| 40 | reasoning | 41 | 81 | 11594 | 偏好 |
| 41 | reasoning | 42 | 83 | 11884 | 。 |
| 42 | reasoning | 43 | 85 | 12171 | \n |
| 43 | tool-call | 44 | 87 | 12457 | name=recall args={ |
| 44 | tool-call | 45 | 89 | 12848 | name=null args=\"query\":\" |
| 45 | tool-call | 46 | 91 | 13176 | name=null args=用户 |
| 46 | tool-call | 47 | 93 | 13498 | name=null args=喜欢 |
| 47 | tool-call | 48 | 95 | 13820 | name=null args=喝 |
| 48 | tool-call | 49 | 97 | 14139 | name=null args=什么 |
| 49 | tool-call | 50 | 99 | 14461 | name=null args=咖啡 |
| 50 | tool-call | 51 | 101 | 14783 | name=null args=\" |
| 51 | tool-call | 52 | 103 | 15101 | name=null args=,\"k\": |
| 52 | tool-call | 53 | 105 | 15424 | name=null args=5 |
| 53 | tool-call | 54 | 107 | 15741 | name=null args=} |
