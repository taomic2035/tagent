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
| 文件字节数 | 20149 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 问 |
| 3 | reasoning | 4 | 7 | 872 | 的是 |
| 4 | reasoning | 5 | 9 | 1162 | 上海 |
| 5 | reasoning | 6 | 11 | 1452 | 天气 |
| 6 | reasoning | 7 | 13 | 1742 | 怎么样 |
| 7 | reasoning | 8 | 15 | 2035 | ， |
| 8 | reasoning | 9 | 17 | 2322 | 我 |
| 9 | reasoning | 10 | 19 | 2609 | 需要使用 |
| 10 | reasoning | 11 | 21 | 2905 |  get |
| 11 | reasoning | 12 | 23 | 3193 | _weather |
| 12 | reasoning | 13 | 25 | 3485 |   |
| 13 | reasoning | 14 | 27 | 3770 | 工具 |
| 14 | reasoning | 15 | 29 | 4060 | 来 |
| 15 | reasoning | 16 | 31 | 4347 | 查询 |
| 16 | reasoning | 17 | 33 | 4637 | 上海的 |
| 17 | reasoning | 18 | 35 | 4930 | 天气 |
| 18 | reasoning | 19 | 37 | 5220 | 信息 |
| 19 | reasoning | 20 | 39 | 5510 | 。 |
| 20 | reasoning | 21 | 41 | 5797 | 根据 |
| 21 | reasoning | 22 | 43 | 6087 | 工具 |
| 22 | reasoning | 23 | 45 | 6377 | 描述 |
| 23 | reasoning | 24 | 47 | 6667 | ， |
| 24 | reasoning | 25 | 49 | 6954 | 这个 |
| 25 | reasoning | 26 | 51 | 7244 | 工具 |
| 26 | reasoning | 27 | 53 | 7534 | 支持 |
| 27 | reasoning | 28 | 55 | 7824 | 查询 |
| 28 | reasoning | 29 | 57 | 8114 | 北京 |
| 29 | reasoning | 30 | 59 | 8404 | / |
| 30 | reasoning | 31 | 61 | 8689 | 上海 |
| 31 | reasoning | 32 | 63 | 8979 | / |
| 32 | reasoning | 33 | 65 | 9264 | 广州 |
| 33 | reasoning | 34 | 67 | 9554 | / |
| 34 | reasoning | 35 | 69 | 9839 | 深圳 |
| 35 | reasoning | 36 | 71 | 10129 | / |
| 36 | reasoning | 37 | 73 | 10414 | 杭州 |
| 37 | reasoning | 38 | 75 | 10704 | 的 |
| 38 | reasoning | 39 | 77 | 10991 | 当前 |
| 39 | reasoning | 40 | 79 | 11281 | 天气 |
| 40 | reasoning | 41 | 81 | 11571 | ， |
| 41 | reasoning | 42 | 83 | 11858 | 上海 |
| 42 | reasoning | 43 | 85 | 12148 | 是 |
| 43 | reasoning | 44 | 87 | 12435 | 支持的 |
| 44 | reasoning | 45 | 89 | 12728 | 。 |
| 45 | reasoning | 46 | 91 | 13015 | \n\n |
| 46 | reasoning | 47 | 93 | 13303 | 我需要 |
| 47 | reasoning | 48 | 95 | 13596 | 调用 |
| 48 | reasoning | 49 | 97 | 13886 |  get |
| 49 | reasoning | 50 | 99 | 14174 | _weather |
| 50 | reasoning | 51 | 101 | 14466 |   |
| 51 | reasoning | 52 | 103 | 14751 | 函数 |
| 52 | reasoning | 53 | 105 | 15041 | ， |
| 53 | reasoning | 54 | 107 | 15328 | 参数 |
| 54 | reasoning | 55 | 109 | 15618 |  city |
| 55 | reasoning | 56 | 111 | 15907 |   |
| 56 | reasoning | 57 | 113 | 16192 | 设置为 |
| 57 | reasoning | 58 | 115 | 16485 | \" |
| 58 | reasoning | 59 | 117 | 16771 | 上海 |
| 59 | reasoning | 60 | 119 | 17061 | \" |
| 60 | reasoning | 61 | 121 | 17347 | 。 |
| 61 | reasoning | 62 | 123 | 17634 | \n |
| 62 | tool-call | 63 | 125 | 17920 | name=get_weather args={ |
| 63 | tool-call | 64 | 127 | 18316 | name=null args=\"city\":\" |
| 64 | tool-call | 65 | 129 | 18643 | name=null args=上海 |
| 65 | tool-call | 66 | 131 | 18965 | name=null args=\" |
| 66 | tool-call | 67 | 133 | 19283 | name=null args=} |
