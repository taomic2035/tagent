# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 93 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 86 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 27343 |

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
| 17 | reasoning | 18 | 35 | 4930 | 天气 |
| 18 | reasoning | 19 | 37 | 5220 | 。 |
| 19 | reasoning | 20 | 39 | 5507 | \n\n |
| 20 | reasoning | 21 | 41 | 5795 | 查看 |
| 21 | reasoning | 22 | 43 | 6085 | 工具 |
| 22 | reasoning | 23 | 45 | 6375 | 定义 |
| 23 | reasoning | 24 | 47 | 6665 | ： |
| 24 | reasoning | 25 | 49 | 6952 | \n |
| 25 | reasoning | 26 | 51 | 7238 | - |
| 26 | reasoning | 27 | 53 | 7523 |   |
| 27 | reasoning | 28 | 55 | 7808 | 函数 |
| 28 | reasoning | 29 | 57 | 8098 | 名 |
| 29 | reasoning | 30 | 59 | 8385 | ： |
| 30 | reasoning | 31 | 61 | 8672 | get |
| 31 | reasoning | 32 | 63 | 8959 | _weather |
| 32 | reasoning | 33 | 65 | 9251 | \n |
| 33 | reasoning | 34 | 67 | 9537 | - |
| 34 | reasoning | 35 | 69 | 9822 |   |
| 35 | reasoning | 36 | 71 | 10107 | 参数 |
| 36 | reasoning | 37 | 73 | 10397 | ： |
| 37 | reasoning | 38 | 75 | 10684 | city |
| 38 | reasoning | 39 | 77 | 10972 | （ |
| 39 | reasoning | 40 | 79 | 11259 | 必填 |
| 40 | reasoning | 41 | 81 | 11549 | ）， |
| 41 | reasoning | 42 | 83 | 11839 | 支持 |
| 42 | reasoning | 43 | 85 | 12129 | 的城市 |
| 43 | reasoning | 44 | 87 | 12422 | 包括 |
| 44 | reasoning | 45 | 89 | 12712 | ： |
| 45 | reasoning | 46 | 91 | 12999 | 北京 |
| 46 | reasoning | 47 | 93 | 13289 | / |
| 47 | reasoning | 48 | 95 | 13574 | 上海 |
| 48 | reasoning | 49 | 97 | 13864 | / |
| 49 | reasoning | 50 | 99 | 14149 | 广州 |
| 50 | reasoning | 51 | 101 | 14439 | / |
| 51 | reasoning | 52 | 103 | 14724 | 深圳 |
| 52 | reasoning | 53 | 105 | 15014 | / |
| 53 | reasoning | 54 | 107 | 15299 | 杭州 |
| 54 | reasoning | 55 | 109 | 15589 | \n |
| 55 | reasoning | 56 | 111 | 15875 | - |
| 56 | reasoning | 57 | 113 | 16160 |   |
| 57 | reasoning | 58 | 115 | 16445 | 描述 |
| 58 | reasoning | 59 | 117 | 16735 | ： |
| 59 | reasoning | 60 | 119 | 17022 | 查询 |
| 60 | reasoning | 61 | 121 | 17312 | 指定 |
| 61 | reasoning | 62 | 123 | 17602 | 城市的 |
| 62 | reasoning | 63 | 125 | 17895 | 当前 |
| 63 | reasoning | 64 | 127 | 18185 | 天气 |
| 64 | reasoning | 65 | 129 | 18475 | \n\n |
| 65 | reasoning | 66 | 131 | 18763 | 用户 |
| 66 | reasoning | 67 | 133 | 19053 | 问 |
| 67 | reasoning | 68 | 135 | 19340 | 的是 |
| 68 | reasoning | 69 | 137 | 19630 | 北京 |
| 69 | reasoning | 70 | 139 | 19920 | ， |
| 70 | reasoning | 71 | 141 | 20207 | 所以我 |
| 71 | reasoning | 72 | 143 | 20500 | 需要 |
| 72 | reasoning | 73 | 145 | 20790 | 调用 |
| 73 | reasoning | 74 | 147 | 21080 |  get |
| 74 | reasoning | 75 | 149 | 21368 | _weather |
| 75 | reasoning | 76 | 151 | 21660 |   |
| 76 | reasoning | 77 | 153 | 21945 | 工具 |
| 77 | reasoning | 78 | 155 | 22235 | ， |
| 78 | reasoning | 79 | 157 | 22522 | 参数 |
| 79 | reasoning | 80 | 159 | 22812 |  city |
| 80 | reasoning | 81 | 161 | 23101 |   |
| 81 | reasoning | 82 | 163 | 23386 | 设为 |
| 82 | reasoning | 83 | 165 | 23676 | \" |
| 83 | reasoning | 84 | 167 | 23962 | 北京 |
| 84 | reasoning | 85 | 169 | 24252 | \" |
| 85 | reasoning | 86 | 171 | 24538 | 。 |
| 86 | reasoning | 87 | 173 | 24825 | \n |
| 87 | tool-call | 88 | 175 | 25111 | name=get_weather args={ |
| 88 | tool-call | 89 | 177 | 25507 | name=null args=\"city\":\" |
| 89 | tool-call | 90 | 179 | 25834 | name=null args=北京 |
| 90 | tool-call | 91 | 181 | 26156 | name=null args=\" |
| 91 | tool-call | 92 | 183 | 26474 | name=null args=} |
