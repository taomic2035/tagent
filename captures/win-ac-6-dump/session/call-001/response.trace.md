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
| 文件字节数 | 15527 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | 上海 |
| 4 | reasoning | 5 | 9 | 1165 | 天气 |
| 5 | reasoning | 6 | 11 | 1455 | ， |
| 6 | reasoning | 7 | 13 | 1742 | 我 |
| 7 | reasoning | 8 | 15 | 2029 | 需要使用 |
| 8 | reasoning | 9 | 17 | 2325 |  get |
| 9 | reasoning | 10 | 19 | 2613 | _weather |
| 10 | reasoning | 11 | 21 | 2905 |   |
| 11 | reasoning | 12 | 23 | 3190 | 工具 |
| 12 | reasoning | 13 | 25 | 3480 | 来 |
| 13 | reasoning | 14 | 27 | 3767 | 查询 |
| 14 | reasoning | 15 | 29 | 4057 | 上海 |
| 15 | reasoning | 16 | 31 | 4347 | 当前的 |
| 16 | reasoning | 17 | 33 | 4640 | 天气 |
| 17 | reasoning | 18 | 35 | 4930 | 情况 |
| 18 | reasoning | 19 | 37 | 5220 | 。 |
| 19 | reasoning | 20 | 39 | 5507 | 根据 |
| 20 | reasoning | 21 | 41 | 5797 | 工具 |
| 21 | reasoning | 22 | 43 | 6087 | 描述 |
| 22 | reasoning | 23 | 45 | 6377 | ， |
| 23 | reasoning | 24 | 47 | 6664 | 上海 |
| 24 | reasoning | 25 | 49 | 6954 | 是 |
| 25 | reasoning | 26 | 51 | 7241 | 支持 |
| 26 | reasoning | 27 | 53 | 7531 | 的城市 |
| 27 | reasoning | 28 | 55 | 7824 | 之一 |
| 28 | reasoning | 29 | 57 | 8114 | 。 |
| 29 | reasoning | 30 | 59 | 8401 | \n\n |
| 30 | reasoning | 31 | 61 | 8689 | 我需要 |
| 31 | reasoning | 32 | 63 | 8982 | 调用 |
| 32 | reasoning | 33 | 65 | 9272 |  get |
| 33 | reasoning | 34 | 67 | 9560 | _weather |
| 34 | reasoning | 35 | 69 | 9852 |   |
| 35 | reasoning | 36 | 71 | 10137 | 函数 |
| 36 | reasoning | 37 | 73 | 10427 | ， |
| 37 | reasoning | 38 | 75 | 10714 | 参数 |
| 38 | reasoning | 39 | 77 | 11004 |  city |
| 39 | reasoning | 40 | 79 | 11293 |   |
| 40 | reasoning | 41 | 81 | 11578 | 设置为 |
| 41 | reasoning | 42 | 83 | 11871 | \" |
| 42 | reasoning | 43 | 85 | 12157 | 上海 |
| 43 | reasoning | 44 | 87 | 12447 | \" |
| 44 | reasoning | 45 | 89 | 12733 | 。 |
| 45 | reasoning | 46 | 91 | 13020 | \n |
| 46 | tool-call | 47 | 93 | 13306 | name=get_weather args={ |
| 47 | tool-call | 48 | 95 | 13702 | name=null args=\"city\":\" |
| 48 | tool-call | 49 | 97 | 14029 | name=null args=上海 |
| 49 | tool-call | 50 | 99 | 14351 | name=null args=\" |
| 50 | tool-call | 51 | 101 | 14669 | name=null args=} |
