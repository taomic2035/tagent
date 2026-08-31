# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 41 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 30 |
| 正文 token（text） | 0 |
| tool_call 分片 | 9 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 12492 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 问 |
| 3 | reasoning | 4 | 7 | 872 | 他们 |
| 4 | reasoning | 5 | 9 | 1162 | 喜欢 |
| 5 | reasoning | 6 | 11 | 1452 | 喝 |
| 6 | reasoning | 7 | 13 | 1739 | 什么 |
| 7 | reasoning | 8 | 15 | 2029 | ， |
| 8 | reasoning | 9 | 17 | 2316 | 这 |
| 9 | reasoning | 10 | 19 | 2603 | 涉及到 |
| 10 | reasoning | 11 | 21 | 2896 | 用户的 |
| 11 | reasoning | 12 | 23 | 3189 | 偏好 |
| 12 | reasoning | 13 | 25 | 3479 | ， |
| 13 | reasoning | 14 | 27 | 3766 | 我应该 |
| 14 | reasoning | 15 | 29 | 4059 | 从 |
| 15 | reasoning | 16 | 31 | 4346 | 长期 |
| 16 | reasoning | 17 | 33 | 4636 | 记忆中 |
| 17 | reasoning | 18 | 35 | 4929 | 召回 |
| 18 | reasoning | 19 | 37 | 5219 | 相关信息 |
| 19 | reasoning | 20 | 39 | 5515 | 。 |
| 20 | reasoning | 21 | 41 | 5802 | 让我 |
| 21 | reasoning | 22 | 43 | 6092 | 使用 |
| 22 | reasoning | 23 | 45 | 6382 | recall |
| 23 | reasoning | 24 | 47 | 6672 | 工具 |
| 24 | reasoning | 25 | 49 | 6962 | 来 |
| 25 | reasoning | 26 | 51 | 7249 | 查询 |
| 26 | reasoning | 27 | 53 | 7539 | 用户的 |
| 27 | reasoning | 28 | 55 | 7832 | 饮用 |
| 28 | reasoning | 29 | 57 | 8122 | 偏好 |
| 29 | reasoning | 30 | 59 | 8412 | 。 |
| 30 | reasoning | 31 | 61 | 8699 | \n |
| 31 | tool-call | 32 | 63 | 8985 | name=recall args={ |
| 32 | tool-call | 33 | 65 | 9376 | name=null args=\"query\":\" |
| 33 | tool-call | 34 | 67 | 9704 | name=null args=喜欢 |
| 34 | tool-call | 35 | 69 | 10026 | name=null args=喝 |
| 35 | tool-call | 36 | 71 | 10345 | name=null args=什么 |
| 36 | tool-call | 37 | 73 | 10667 | name=null args=\" |
| 37 | tool-call | 38 | 75 | 10985 | name=null args=,\"k\": |
| 38 | tool-call | 39 | 77 | 11308 | name=null args=5 |
| 39 | tool-call | 40 | 79 | 11625 | name=null args=} |
