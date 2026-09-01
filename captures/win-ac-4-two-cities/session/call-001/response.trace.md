# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 79 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 67 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 23572 |

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
| 15 | reasoning | 16 | 31 | 4350 | 来 |
| 16 | reasoning | 17 | 33 | 4637 | 查询 |
| 17 | reasoning | 18 | 35 | 4927 | 这两个 |
| 18 | reasoning | 19 | 37 | 5220 | 城市的 |
| 19 | reasoning | 20 | 39 | 5513 | 天气 |
| 20 | reasoning | 21 | 41 | 5803 | 情况 |
| 21 | reasoning | 22 | 43 | 6093 | 。 |
| 22 | reasoning | 23 | 45 | 6380 | \n\n |
| 23 | reasoning | 24 | 47 | 6668 | 我需要 |
| 24 | reasoning | 25 | 49 | 6961 | 调用 |
| 25 | reasoning | 26 | 51 | 7251 | 两次 |
| 26 | reasoning | 27 | 53 | 7541 |  get |
| 27 | reasoning | 28 | 55 | 7829 | _weather |
| 28 | reasoning | 29 | 57 | 8121 |   |
| 29 | reasoning | 30 | 59 | 8406 | 函数 |
| 30 | reasoning | 31 | 61 | 8696 | ， |
| 31 | reasoning | 32 | 63 | 8983 | 一次 |
| 32 | reasoning | 33 | 65 | 9273 | 查询 |
| 33 | reasoning | 34 | 67 | 9563 | 北京 |
| 34 | reasoning | 35 | 69 | 9853 | ， |
| 35 | reasoning | 36 | 71 | 10140 | 一次 |
| 36 | reasoning | 37 | 73 | 10430 | 查询 |
| 37 | reasoning | 38 | 75 | 10720 | 上海 |
| 38 | reasoning | 39 | 77 | 11010 | 。 |
| 39 | reasoning | 40 | 79 | 11297 | \n\n |
| 40 | reasoning | 41 | 81 | 11585 | 根据 |
| 41 | reasoning | 42 | 83 | 11875 | 工具 |
| 42 | reasoning | 43 | 85 | 12165 | 定义 |
| 43 | reasoning | 44 | 87 | 12455 | ， |
| 44 | reasoning | 45 | 89 | 12742 | get |
| 45 | reasoning | 46 | 91 | 13029 | _weather |
| 46 | reasoning | 47 | 93 | 13321 |   |
| 47 | reasoning | 48 | 95 | 13606 | 支持 |
| 48 | reasoning | 49 | 97 | 13896 | 的城市 |
| 49 | reasoning | 50 | 99 | 14189 | 包括 |
| 50 | reasoning | 51 | 101 | 14479 | ： |
| 51 | reasoning | 52 | 103 | 14766 | 北京 |
| 52 | reasoning | 53 | 105 | 15056 | / |
| 53 | reasoning | 54 | 107 | 15341 | 上海 |
| 54 | reasoning | 55 | 109 | 15631 | / |
| 55 | reasoning | 56 | 111 | 15916 | 广州 |
| 56 | reasoning | 57 | 113 | 16206 | / |
| 57 | reasoning | 58 | 115 | 16491 | 深圳 |
| 58 | reasoning | 59 | 117 | 16781 | / |
| 59 | reasoning | 60 | 119 | 17066 | 杭州 |
| 60 | reasoning | 61 | 121 | 17356 | ， |
| 61 | reasoning | 62 | 123 | 17643 | 所以 |
| 62 | reasoning | 63 | 125 | 17933 | 这两个 |
| 63 | reasoning | 64 | 127 | 18226 | 城市 |
| 64 | reasoning | 65 | 129 | 18516 | 都是 |
| 65 | reasoning | 66 | 131 | 18806 | 支持的 |
| 66 | reasoning | 67 | 133 | 19099 | 。 |
| 67 | reasoning | 68 | 135 | 19386 | \n |
| 68 | tool-call | 69 | 137 | 19672 | name=get_weather args={ |
| 69 | tool-call | 70 | 139 | 20068 | name=null args=\"city\":\" |
| 70 | tool-call | 71 | 141 | 20395 | name=null args=北京 |
| 71 | tool-call | 72 | 143 | 20717 | name=null args=\" |
| 72 | tool-call | 73 | 145 | 21035 | name=null args=} |
| 73 | tool-call | 74 | 147 | 21352 | name=get_weather args={ |
| 74 | tool-call | 75 | 149 | 21748 | name=null args=\"city\":\" |
| 75 | tool-call | 76 | 151 | 22075 | name=null args=上海 |
| 76 | tool-call | 77 | 153 | 22397 | name=null args=\" |
| 77 | tool-call | 78 | 155 | 22715 | name=null args=} |
