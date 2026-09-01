# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 44 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 37 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 13232 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | 北京 |
| 4 | reasoning | 5 | 9 | 1165 | 今天的 |
| 5 | reasoning | 6 | 11 | 1458 | 天气 |
| 6 | reasoning | 7 | 13 | 1748 | ， |
| 7 | reasoning | 8 | 15 | 2035 | 我 |
| 8 | reasoning | 9 | 17 | 2322 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2618 |  get |
| 10 | reasoning | 11 | 21 | 2906 | _weather |
| 11 | reasoning | 12 | 23 | 3198 |   |
| 12 | reasoning | 13 | 25 | 3483 | 工具 |
| 13 | reasoning | 14 | 27 | 3773 | 来获取 |
| 14 | reasoning | 15 | 29 | 4066 | 北京 |
| 15 | reasoning | 16 | 31 | 4356 | 当前的 |
| 16 | reasoning | 17 | 33 | 4649 | 天气 |
| 17 | reasoning | 18 | 35 | 4939 | 信息 |
| 18 | reasoning | 19 | 37 | 5229 | 。 |
| 19 | reasoning | 20 | 39 | 5516 | 工具 |
| 20 | reasoning | 21 | 41 | 5806 | 支持 |
| 21 | reasoning | 22 | 43 | 6096 | 查询 |
| 22 | reasoning | 23 | 45 | 6386 | 北京 |
| 23 | reasoning | 24 | 47 | 6676 | 、 |
| 24 | reasoning | 25 | 49 | 6963 | 上海 |
| 25 | reasoning | 26 | 51 | 7253 | 、 |
| 26 | reasoning | 27 | 53 | 7540 | 广州 |
| 27 | reasoning | 28 | 55 | 7830 | 、 |
| 28 | reasoning | 29 | 57 | 8117 | 深圳 |
| 29 | reasoning | 30 | 59 | 8407 | 、 |
| 30 | reasoning | 31 | 61 | 8694 | 杭州 |
| 31 | reasoning | 32 | 63 | 8984 | 的天气 |
| 32 | reasoning | 33 | 65 | 9277 | ， |
| 33 | reasoning | 34 | 67 | 9564 | 北京 |
| 34 | reasoning | 35 | 69 | 9854 | 是 |
| 35 | reasoning | 36 | 71 | 10141 | 支持的 |
| 36 | reasoning | 37 | 73 | 10434 | 。 |
| 37 | reasoning | 38 | 75 | 10721 | \n |
| 38 | tool-call | 39 | 77 | 11007 | name=get_weather args={ |
| 39 | tool-call | 40 | 79 | 11403 | name=null args=\"city\":\" |
| 40 | tool-call | 41 | 81 | 11730 | name=null args=北京 |
| 41 | tool-call | 42 | 83 | 12052 | name=null args=\" |
| 42 | tool-call | 43 | 85 | 12370 | name=null args=} |
