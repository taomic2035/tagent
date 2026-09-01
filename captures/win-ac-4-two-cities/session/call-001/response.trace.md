# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 71 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 59 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 21282 |

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
| 11 | reasoning | 12 | 23 | 3195 | get |
| 12 | reasoning | 13 | 25 | 3482 | _weather |
| 13 | reasoning | 14 | 27 | 3774 | 工具 |
| 14 | reasoning | 15 | 29 | 4064 | 来 |
| 15 | reasoning | 16 | 31 | 4351 | 查询 |
| 16 | reasoning | 17 | 33 | 4641 | 这两个 |
| 17 | reasoning | 18 | 35 | 4934 | 城市的 |
| 18 | reasoning | 19 | 37 | 5227 | 天气 |
| 19 | reasoning | 20 | 39 | 5517 | 情况 |
| 20 | reasoning | 21 | 41 | 5807 | 。 |
| 21 | reasoning | 22 | 43 | 6094 | \n\n |
| 22 | reasoning | 23 | 45 | 6382 | 根据 |
| 23 | reasoning | 24 | 47 | 6672 | 工具 |
| 24 | reasoning | 25 | 49 | 6962 | 描述 |
| 25 | reasoning | 26 | 51 | 7252 | ， |
| 26 | reasoning | 27 | 53 | 7539 | get |
| 27 | reasoning | 28 | 55 | 7826 | _weather |
| 28 | reasoning | 29 | 57 | 8118 | 支持 |
| 29 | reasoning | 30 | 59 | 8408 | 北京 |
| 30 | reasoning | 31 | 61 | 8698 | / |
| 31 | reasoning | 32 | 63 | 8983 | 上海 |
| 32 | reasoning | 33 | 65 | 9273 | / |
| 33 | reasoning | 34 | 67 | 9558 | 广州 |
| 34 | reasoning | 35 | 69 | 9848 | / |
| 35 | reasoning | 36 | 71 | 10133 | 深圳 |
| 36 | reasoning | 37 | 73 | 10423 | / |
| 37 | reasoning | 38 | 75 | 10708 | 杭州 |
| 38 | reasoning | 39 | 77 | 10998 | ， |
| 39 | reasoning | 40 | 79 | 11285 | 所以我 |
| 40 | reasoning | 41 | 81 | 11578 | 可以直接 |
| 41 | reasoning | 42 | 83 | 11874 | 查询 |
| 42 | reasoning | 43 | 85 | 12164 | 这两个 |
| 43 | reasoning | 44 | 87 | 12457 | 城市的 |
| 44 | reasoning | 45 | 89 | 12750 | 天气 |
| 45 | reasoning | 46 | 91 | 13040 | 。 |
| 46 | reasoning | 47 | 93 | 13327 | \n\n |
| 47 | reasoning | 48 | 95 | 13615 | 我需要 |
| 48 | reasoning | 49 | 97 | 13908 | 调用 |
| 49 | reasoning | 50 | 99 | 14198 | 两次 |
| 50 | reasoning | 51 | 101 | 14488 | get |
| 51 | reasoning | 52 | 103 | 14775 | _weather |
| 52 | reasoning | 53 | 105 | 15067 | 工具 |
| 53 | reasoning | 54 | 107 | 15357 | ， |
| 54 | reasoning | 55 | 109 | 15644 | 分别 |
| 55 | reasoning | 56 | 111 | 15934 | 查询 |
| 56 | reasoning | 57 | 113 | 16224 | 北京 |
| 57 | reasoning | 58 | 115 | 16514 | 和上海 |
| 58 | reasoning | 59 | 117 | 16807 | 。 |
| 59 | reasoning | 60 | 119 | 17094 | \n |
| 60 | tool-call | 61 | 121 | 17380 | name=get_weather args={ |
| 61 | tool-call | 62 | 123 | 17776 | name=null args=\"city\":\" |
| 62 | tool-call | 63 | 125 | 18103 | name=null args=北京 |
| 63 | tool-call | 64 | 127 | 18425 | name=null args=\" |
| 64 | tool-call | 65 | 129 | 18743 | name=null args=} |
| 65 | tool-call | 66 | 131 | 19060 | name=get_weather args={ |
| 66 | tool-call | 67 | 133 | 19456 | name=null args=\"city\":\" |
| 67 | tool-call | 68 | 135 | 19783 | name=null args=上海 |
| 68 | tool-call | 69 | 137 | 20105 | name=null args=\" |
| 69 | tool-call | 70 | 139 | 20423 | name=null args=} |
