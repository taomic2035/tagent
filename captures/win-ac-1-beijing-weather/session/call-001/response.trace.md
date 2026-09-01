# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 65 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 58 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 19295 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | 北京 |
| 4 | reasoning | 5 | 9 | 1165 | 今天的 |
| 5 | reasoning | 6 | 11 | 1458 | 天气 |
| 6 | reasoning | 7 | 13 | 1748 | 情况 |
| 7 | reasoning | 8 | 15 | 2038 | 。 |
| 8 | reasoning | 9 | 17 | 2325 | 我 |
| 9 | reasoning | 10 | 19 | 2612 | 需要使用 |
| 10 | reasoning | 11 | 21 | 2908 |  get |
| 11 | reasoning | 12 | 23 | 3196 | _weather |
| 12 | reasoning | 13 | 25 | 3488 |   |
| 13 | reasoning | 14 | 27 | 3773 | 工具 |
| 14 | reasoning | 15 | 29 | 4063 | 来 |
| 15 | reasoning | 16 | 31 | 4350 | 查询 |
| 16 | reasoning | 17 | 33 | 4640 | 北京的 |
| 17 | reasoning | 18 | 35 | 4933 | 天气 |
| 18 | reasoning | 19 | 37 | 5223 | 信息 |
| 19 | reasoning | 20 | 39 | 5513 | 。 |
| 20 | reasoning | 21 | 41 | 5800 | 根据 |
| 21 | reasoning | 22 | 43 | 6090 | 工具 |
| 22 | reasoning | 23 | 45 | 6380 | 描述 |
| 23 | reasoning | 24 | 47 | 6670 | ， |
| 24 | reasoning | 25 | 49 | 6957 | 支持 |
| 25 | reasoning | 26 | 51 | 7247 | 的城市 |
| 26 | reasoning | 27 | 53 | 7540 | 包括 |
| 27 | reasoning | 28 | 55 | 7830 | 北京 |
| 28 | reasoning | 29 | 57 | 8120 | 、 |
| 29 | reasoning | 30 | 59 | 8407 | 上海 |
| 30 | reasoning | 31 | 61 | 8697 | 、 |
| 31 | reasoning | 32 | 63 | 8984 | 广州 |
| 32 | reasoning | 33 | 65 | 9274 | 、 |
| 33 | reasoning | 34 | 67 | 9561 | 深圳 |
| 34 | reasoning | 35 | 69 | 9851 | 、 |
| 35 | reasoning | 36 | 71 | 10138 | 杭州 |
| 36 | reasoning | 37 | 73 | 10428 | ， |
| 37 | reasoning | 38 | 75 | 10715 | 所以 |
| 38 | reasoning | 39 | 77 | 11005 | 北京 |
| 39 | reasoning | 40 | 79 | 11295 | 是 |
| 40 | reasoning | 41 | 81 | 11582 | 支持的 |
| 41 | reasoning | 42 | 83 | 11875 | 。 |
| 42 | reasoning | 43 | 85 | 12162 | \n\n |
| 43 | reasoning | 44 | 87 | 12450 | 我需要 |
| 44 | reasoning | 45 | 89 | 12743 | 调用 |
| 45 | reasoning | 46 | 91 | 13033 |  get |
| 46 | reasoning | 47 | 93 | 13321 | _weather |
| 47 | reasoning | 48 | 95 | 13613 |   |
| 48 | reasoning | 49 | 97 | 13898 | 工具 |
| 49 | reasoning | 50 | 99 | 14188 | ， |
| 50 | reasoning | 51 | 101 | 14475 | 参数 |
| 51 | reasoning | 52 | 103 | 14765 |  city |
| 52 | reasoning | 53 | 105 | 15054 |   |
| 53 | reasoning | 54 | 107 | 15339 | 设为 |
| 54 | reasoning | 55 | 109 | 15629 | \" |
| 55 | reasoning | 56 | 111 | 15915 | 北京 |
| 56 | reasoning | 57 | 113 | 16205 | \" |
| 57 | reasoning | 58 | 115 | 16491 | 。 |
| 58 | reasoning | 59 | 117 | 16778 | \n |
| 59 | tool-call | 60 | 119 | 17064 | name=get_weather args={ |
| 60 | tool-call | 61 | 121 | 17460 | name=null args=\"city\":\" |
| 61 | tool-call | 62 | 123 | 17787 | name=null args=北京 |
| 62 | tool-call | 63 | 125 | 18109 | name=null args=\" |
| 63 | tool-call | 64 | 127 | 18427 | name=null args=} |
