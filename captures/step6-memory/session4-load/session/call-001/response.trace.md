# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 63 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 51 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 18854 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 问 |
| 3 | reasoning | 4 | 7 | 872 | 的是 |
| 4 | reasoning | 5 | 9 | 1162 | \" |
| 5 | reasoning | 6 | 11 | 1448 | 我喜欢 |
| 6 | reasoning | 7 | 13 | 1741 | 喝 |
| 7 | reasoning | 8 | 15 | 2028 | 什么 |
| 8 | reasoning | 9 | 17 | 2318 | ？ |
| 9 | reasoning | 10 | 19 | 2605 | \" |
| 10 | reasoning | 11 | 21 | 2891 | ， |
| 11 | reasoning | 12 | 23 | 3178 | 这是 |
| 12 | reasoning | 13 | 25 | 3468 | 关于 |
| 13 | reasoning | 14 | 27 | 3758 | 用户 |
| 14 | reasoning | 15 | 29 | 4048 | 偏 |
| 15 | reasoning | 16 | 31 | 4335 | 好的 |
| 16 | reasoning | 17 | 33 | 4625 | 问题 |
| 17 | reasoning | 18 | 35 | 4915 | 。 |
| 18 | reasoning | 19 | 37 | 5202 | 根据 |
| 19 | reasoning | 20 | 39 | 5492 | 工具 |
| 20 | reasoning | 21 | 41 | 5782 | 说明 |
| 21 | reasoning | 22 | 43 | 6072 | ， |
| 22 | reasoning | 23 | 45 | 6359 | 我应该 |
| 23 | reasoning | 24 | 47 | 6652 | 先 |
| 24 | reasoning | 25 | 49 | 6939 | 调用 |
| 25 | reasoning | 26 | 51 | 7229 |  recall |
| 26 | reasoning | 27 | 53 | 7520 |   |
| 27 | reasoning | 28 | 55 | 7805 | 工具 |
| 28 | reasoning | 29 | 57 | 8095 | 从 |
| 29 | reasoning | 30 | 59 | 8382 | 长期 |
| 30 | reasoning | 31 | 61 | 8672 | 记忆中 |
| 31 | reasoning | 32 | 63 | 8965 | 召回 |
| 32 | reasoning | 33 | 65 | 9255 | 相关 |
| 33 | reasoning | 34 | 67 | 9545 | 事实 |
| 34 | reasoning | 35 | 69 | 9835 | ， |
| 35 | reasoning | 36 | 71 | 10122 | 然后再 |
| 36 | reasoning | 37 | 73 | 10415 | 回答 |
| 37 | reasoning | 38 | 75 | 10705 | 用户 |
| 38 | reasoning | 39 | 77 | 10995 | 。 |
| 39 | reasoning | 40 | 79 | 11282 | \n\n |
| 40 | reasoning | 41 | 81 | 11570 | 让我 |
| 41 | reasoning | 42 | 83 | 11860 | 调用 |
| 42 | reasoning | 43 | 85 | 12150 |  recall |
| 43 | reasoning | 44 | 87 | 12441 |   |
| 44 | reasoning | 45 | 89 | 12726 | 工具 |
| 45 | reasoning | 46 | 91 | 13016 | 来 |
| 46 | reasoning | 47 | 93 | 13303 | 查询 |
| 47 | reasoning | 48 | 95 | 13593 | 用户的 |
| 48 | reasoning | 49 | 97 | 13886 | 偏好 |
| 49 | reasoning | 50 | 99 | 14176 | 信息 |
| 50 | reasoning | 51 | 101 | 14466 | 。 |
| 51 | reasoning | 52 | 103 | 14753 | \n |
| 52 | tool-call | 53 | 105 | 15039 | name=recall args={ |
| 53 | tool-call | 54 | 107 | 15430 | name=null args=\"query\":\" |
| 54 | tool-call | 55 | 109 | 15758 | name=null args=用户 |
| 55 | tool-call | 56 | 111 | 16080 | name=null args=喜欢 |
| 56 | tool-call | 57 | 113 | 16402 | name=null args=喝 |
| 57 | tool-call | 58 | 115 | 16721 | name=null args=什么 |
| 58 | tool-call | 59 | 117 | 17043 | name=null args=\" |
| 59 | tool-call | 60 | 119 | 17361 | name=null args=,\"k\": |
| 60 | tool-call | 61 | 121 | 17684 | name=null args=5 |
| 61 | tool-call | 62 | 123 | 18001 | name=null args=} |
