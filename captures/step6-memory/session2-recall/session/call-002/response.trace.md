# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 50 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 39 |
| 正文 token（text） | 9 |
| tool_call 分片 | 0 |
| finish_reason | stop |
| 收到 [DONE] | 是 |
| 文件字节数 | 14631 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 问 |
| 3 | reasoning | 4 | 7 | 872 | 我喜欢 |
| 4 | reasoning | 5 | 9 | 1165 | 喝 |
| 5 | reasoning | 6 | 11 | 1452 | 什么 |
| 6 | reasoning | 7 | 13 | 1742 | 咖啡 |
| 7 | reasoning | 8 | 15 | 2032 | ， |
| 8 | reasoning | 9 | 17 | 2319 | 我 |
| 9 | reasoning | 10 | 19 | 2606 | 刚才 |
| 10 | reasoning | 11 | 21 | 2896 | 调 |
| 11 | reasoning | 12 | 23 | 3183 | 用了 |
| 12 | reasoning | 13 | 25 | 3473 |  recall |
| 13 | reasoning | 14 | 27 | 3764 |   |
| 14 | reasoning | 15 | 29 | 4049 | 工具 |
| 15 | reasoning | 16 | 31 | 4339 | ， |
| 16 | reasoning | 17 | 33 | 4626 | 从 |
| 17 | reasoning | 18 | 35 | 4913 | 长期 |
| 18 | reasoning | 19 | 37 | 5203 | 记忆中 |
| 19 | reasoning | 20 | 39 | 5496 | 找到了 |
| 20 | reasoning | 21 | 41 | 5789 | 用户 |
| 21 | reasoning | 22 | 43 | 6079 | 偏好 |
| 22 | reasoning | 23 | 45 | 6369 | 事实 |
| 23 | reasoning | 24 | 47 | 6659 | ： |
| 24 | reasoning | 25 | 49 | 6946 | 用户 |
| 25 | reasoning | 26 | 51 | 7236 | 喜欢 |
| 26 | reasoning | 27 | 53 | 7526 | 喝 |
| 27 | reasoning | 28 | 55 | 7813 | 美式 |
| 28 | reasoning | 29 | 57 | 8103 | 咖啡 |
| 29 | reasoning | 30 | 59 | 8393 | ， |
| 30 | reasoning | 31 | 61 | 8680 | 不加 |
| 31 | reasoning | 32 | 63 | 8970 | 糖 |
| 32 | reasoning | 33 | 65 | 9257 | 。 |
| 33 | reasoning | 34 | 67 | 9544 | 我现在 |
| 34 | reasoning | 35 | 69 | 9837 | 可以直接 |
| 35 | reasoning | 36 | 71 | 10133 | 回答 |
| 36 | reasoning | 37 | 73 | 10423 | 用户 |
| 37 | reasoning | 38 | 75 | 10713 | 这个问题 |
| 38 | reasoning | 39 | 77 | 11009 | 。 |
| 39 | reasoning | 40 | 79 | 11296 | \n |
| 40 | text | 41 | 81 | 11582 | 您 |
| 41 | text | 42 | 83 | 11859 | 喜欢 |
| 42 | text | 43 | 85 | 12139 | 喝 |
| 43 | text | 44 | 87 | 12416 | 美式 |
| 44 | text | 45 | 89 | 12696 | 咖啡 |
| 45 | text | 46 | 91 | 12976 | ， |
| 46 | text | 47 | 93 | 13253 | 不加 |
| 47 | text | 48 | 95 | 13533 | 糖 |
| 48 | text | 49 | 97 | 13810 | 。 |
