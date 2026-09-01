# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 68 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 61 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 20168 |

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
| 16 | reasoning | 17 | 33 | 4640 | 北京 |
| 17 | reasoning | 18 | 35 | 4930 | 的天气 |
| 18 | reasoning | 19 | 37 | 5223 | 。 |
| 19 | reasoning | 20 | 39 | 5510 | 根据 |
| 20 | reasoning | 21 | 41 | 5800 | 工具 |
| 21 | reasoning | 22 | 43 | 6090 | 描述 |
| 22 | reasoning | 23 | 45 | 6380 | ， |
| 23 | reasoning | 24 | 47 | 6667 | 支持 |
| 24 | reasoning | 25 | 49 | 6957 | 的城市 |
| 25 | reasoning | 26 | 51 | 7250 | 包括 |
| 26 | reasoning | 27 | 53 | 7540 | 北京 |
| 27 | reasoning | 28 | 55 | 7830 | 、 |
| 28 | reasoning | 29 | 57 | 8117 | 上海 |
| 29 | reasoning | 30 | 59 | 8407 | 、 |
| 30 | reasoning | 31 | 61 | 8694 | 广州 |
| 31 | reasoning | 32 | 63 | 8984 | 、 |
| 32 | reasoning | 33 | 65 | 9271 | 深圳 |
| 33 | reasoning | 34 | 67 | 9561 | 、 |
| 34 | reasoning | 35 | 69 | 9848 | 杭州 |
| 35 | reasoning | 36 | 71 | 10138 | ， |
| 36 | reasoning | 37 | 73 | 10425 | 所以 |
| 37 | reasoning | 38 | 75 | 10715 | 北京 |
| 38 | reasoning | 39 | 77 | 11005 | 是 |
| 39 | reasoning | 40 | 79 | 11292 | 支持 |
| 40 | reasoning | 41 | 81 | 11582 | 的城市 |
| 41 | reasoning | 42 | 83 | 11875 | 。 |
| 42 | reasoning | 43 | 85 | 12162 | \n\n |
| 43 | reasoning | 44 | 87 | 12450 | 参数 |
| 44 | reasoning | 45 | 89 | 12740 | 需要 |
| 45 | reasoning | 46 | 91 | 13030 |  city |
| 46 | reasoning | 47 | 93 | 13319 | ， |
| 47 | reasoning | 48 | 95 | 13606 | 用户 |
| 48 | reasoning | 49 | 97 | 13896 | 问 |
| 49 | reasoning | 50 | 99 | 14183 | 的是 |
| 50 | reasoning | 51 | 101 | 14473 | 北京 |
| 51 | reasoning | 52 | 103 | 14763 | ， |
| 52 | reasoning | 53 | 105 | 15050 | 所以我 |
| 53 | reasoning | 54 | 107 | 15343 | 应该 |
| 54 | reasoning | 55 | 109 | 15633 | 传入 |
| 55 | reasoning | 56 | 111 | 15923 | \" |
| 56 | reasoning | 57 | 113 | 16209 | 北京 |
| 57 | reasoning | 58 | 115 | 16499 | \" |
| 58 | reasoning | 59 | 117 | 16785 | 作为 |
| 59 | reasoning | 60 | 119 | 17075 | 参数 |
| 60 | reasoning | 61 | 121 | 17365 | 。 |
| 61 | reasoning | 62 | 123 | 17652 | \n |
| 62 | tool-call | 63 | 125 | 17938 | name=get_weather args={ |
| 63 | tool-call | 64 | 127 | 18334 | name=null args=\"city\":\" |
| 64 | tool-call | 65 | 129 | 18661 | name=null args=北京 |
| 65 | tool-call | 66 | 131 | 18983 | name=null args=\" |
| 66 | tool-call | 67 | 133 | 19301 | name=null args=} |
