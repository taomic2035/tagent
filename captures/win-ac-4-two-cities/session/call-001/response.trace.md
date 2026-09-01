# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 67 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 55 |
| 正文 token（text） | 0 |
| tool_call 分片 | 10 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 20128 |

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
| 9 | reasoning | 10 | 19 | 2612 | 我需要 |
| 10 | reasoning | 11 | 21 | 2905 | 调用 |
| 11 | reasoning | 12 | 23 | 3195 | 天气 |
| 12 | reasoning | 13 | 25 | 3485 | 查询 |
| 13 | reasoning | 14 | 27 | 3775 | 工具 |
| 14 | reasoning | 15 | 29 | 4065 | 来获取 |
| 15 | reasoning | 16 | 31 | 4358 | 两个 |
| 16 | reasoning | 17 | 33 | 4648 | 城市的 |
| 17 | reasoning | 18 | 35 | 4941 | 天气 |
| 18 | reasoning | 19 | 37 | 5231 | 信息 |
| 19 | reasoning | 20 | 39 | 5521 | 。 |
| 20 | reasoning | 21 | 41 | 5808 | \n\n |
| 21 | reasoning | 22 | 43 | 6096 | 根据 |
| 22 | reasoning | 23 | 45 | 6386 | 工具 |
| 23 | reasoning | 24 | 47 | 6676 | 描述 |
| 24 | reasoning | 25 | 49 | 6966 | ， |
| 25 | reasoning | 26 | 51 | 7253 | get |
| 26 | reasoning | 27 | 53 | 7540 | _weather |
| 27 | reasoning | 28 | 55 | 7832 |   |
| 28 | reasoning | 29 | 57 | 8117 | 函数 |
| 29 | reasoning | 30 | 59 | 8407 | 支持 |
| 30 | reasoning | 31 | 61 | 8697 | 北京 |
| 31 | reasoning | 32 | 63 | 8987 | 和上海 |
| 32 | reasoning | 33 | 65 | 9280 | 这两个 |
| 33 | reasoning | 34 | 67 | 9573 | 城市 |
| 34 | reasoning | 35 | 69 | 9863 | 。 |
| 35 | reasoning | 36 | 71 | 10150 | 我需要 |
| 36 | reasoning | 37 | 73 | 10443 | 分别 |
| 37 | reasoning | 38 | 75 | 10733 | 查询 |
| 38 | reasoning | 39 | 77 | 11023 | 两个 |
| 39 | reasoning | 40 | 79 | 11313 | 城市的 |
| 40 | reasoning | 41 | 81 | 11606 | 天气 |
| 41 | reasoning | 42 | 83 | 11896 | ， |
| 42 | reasoning | 43 | 85 | 12183 | 然后 |
| 43 | reasoning | 44 | 87 | 12473 | 进行 |
| 44 | reasoning | 45 | 89 | 12763 | 对比 |
| 45 | reasoning | 46 | 91 | 13053 | 。 |
| 46 | reasoning | 47 | 93 | 13340 | \n\n |
| 47 | reasoning | 48 | 95 | 13628 | 让我 |
| 48 | reasoning | 49 | 97 | 13918 | 先 |
| 49 | reasoning | 50 | 99 | 14205 | 调用 |
| 50 | reasoning | 51 | 101 | 14495 | 两个 |
| 51 | reasoning | 52 | 103 | 14785 | 天气 |
| 52 | reasoning | 53 | 105 | 15075 | 查询 |
| 53 | reasoning | 54 | 107 | 15365 | 函数 |
| 54 | reasoning | 55 | 109 | 15655 | 。 |
| 55 | reasoning | 56 | 111 | 15942 | \n |
| 56 | tool-call | 57 | 113 | 16228 | name=get_weather args={ |
| 57 | tool-call | 58 | 115 | 16624 | name=null args=\"city\":\" |
| 58 | tool-call | 59 | 117 | 16951 | name=null args=北京 |
| 59 | tool-call | 60 | 119 | 17273 | name=null args=\" |
| 60 | tool-call | 61 | 121 | 17591 | name=null args=} |
| 61 | tool-call | 62 | 123 | 17908 | name=get_weather args={ |
| 62 | tool-call | 63 | 125 | 18304 | name=null args=\"city\":\" |
| 63 | tool-call | 64 | 127 | 18631 | name=null args=上海 |
| 64 | tool-call | 65 | 129 | 18953 | name=null args=\" |
| 65 | tool-call | 66 | 131 | 19271 | name=null args=} |
