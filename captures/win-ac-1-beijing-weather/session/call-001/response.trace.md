# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 52 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 45 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 15539 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | 北京的 |
| 4 | reasoning | 5 | 9 | 1168 | 天气 |
| 5 | reasoning | 6 | 11 | 1458 | 情况 |
| 6 | reasoning | 7 | 13 | 1748 | ， |
| 7 | reasoning | 8 | 15 | 2035 | 我 |
| 8 | reasoning | 9 | 17 | 2322 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2618 |  get |
| 10 | reasoning | 11 | 21 | 2906 | _weather |
| 11 | reasoning | 12 | 23 | 3198 |   |
| 12 | reasoning | 13 | 25 | 3483 | 工具 |
| 13 | reasoning | 14 | 27 | 3773 | 来 |
| 14 | reasoning | 15 | 29 | 4060 | 查询 |
| 15 | reasoning | 16 | 31 | 4350 | 。 |
| 16 | reasoning | 17 | 33 | 4637 | 根据 |
| 17 | reasoning | 18 | 35 | 4927 | 工具 |
| 18 | reasoning | 19 | 37 | 5217 | 定义 |
| 19 | reasoning | 20 | 39 | 5507 | ， |
| 20 | reasoning | 21 | 41 | 5794 | get |
| 21 | reasoning | 22 | 43 | 6081 | _weather |
| 22 | reasoning | 23 | 45 | 6373 |   |
| 23 | reasoning | 24 | 47 | 6658 | 函数 |
| 24 | reasoning | 25 | 49 | 6948 | 需要 |
| 25 | reasoning | 26 | 51 | 7238 |  city |
| 26 | reasoning | 27 | 53 | 7527 |   |
| 27 | reasoning | 28 | 55 | 7812 | 参数 |
| 28 | reasoning | 29 | 57 | 8102 | ， |
| 29 | reasoning | 30 | 59 | 8389 | 城市 |
| 30 | reasoning | 31 | 61 | 8679 | 名 |
| 31 | reasoning | 32 | 63 | 8966 | 可以是 |
| 32 | reasoning | 33 | 65 | 9259 | \" |
| 33 | reasoning | 34 | 67 | 9545 | 北京 |
| 34 | reasoning | 35 | 69 | 9835 | \" |
| 35 | reasoning | 36 | 71 | 10121 | 。 |
| 36 | reasoning | 37 | 73 | 10408 | 这是一个 |
| 37 | reasoning | 38 | 75 | 10704 | 简单的 |
| 38 | reasoning | 39 | 77 | 10997 | 查询 |
| 39 | reasoning | 40 | 79 | 11287 | ， |
| 40 | reasoning | 41 | 81 | 11574 | 不需要 |
| 41 | reasoning | 42 | 83 | 11867 | 调用 |
| 42 | reasoning | 43 | 85 | 12157 | 其他 |
| 43 | reasoning | 44 | 87 | 12447 | 工具 |
| 44 | reasoning | 45 | 89 | 12737 | 。 |
| 45 | reasoning | 46 | 91 | 13024 | \n |
| 46 | tool-call | 47 | 93 | 13310 | name=get_weather args={ |
| 47 | tool-call | 48 | 95 | 13706 | name=null args=\"city\":\" |
| 48 | tool-call | 49 | 97 | 14033 | name=null args=北京 |
| 49 | tool-call | 50 | 99 | 14355 | name=null args=\" |
| 50 | tool-call | 51 | 101 | 14673 | name=null args=} |
