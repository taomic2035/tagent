# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 100 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 73 |
| 正文 token（text） | 26 |
| tool_call 分片 | 0 |
| finish_reason | stop |
| 收到 [DONE] | 是 |
| 文件字节数 | 6116 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 根据 |
| 2 | reasoning | 2 | 3 | 64 | 工具 |
| 3 | reasoning | 3 | 5 | 128 | 返回 |
| 4 | reasoning | 4 | 7 | 192 | 的结果 |
| 5 | reasoning | 5 | 9 | 259 | ， |
| 6 | reasoning | 6 | 11 | 320 | 北京 |
| 7 | reasoning | 7 | 13 | 384 | 今天的 |
| 8 | reasoning | 8 | 15 | 451 | 天气 |
| 9 | reasoning | 9 | 17 | 515 | 情况 |
| 10 | reasoning | 10 | 19 | 579 | 如下 |
| 11 | reasoning | 11 | 21 | 643 | ： |
| 12 | reasoning | 12 | 23 | 704 | \n |
| 13 | reasoning | 13 | 25 | 764 | - |
| 14 | reasoning | 14 | 27 | 823 |  天气 |
| 15 | reasoning | 15 | 29 | 888 | 状况 |
| 16 | reasoning | 16 | 31 | 952 | ： |
| 17 | reasoning | 17 | 33 | 1013 | 晴 |
| 18 | reasoning | 18 | 35 | 1074 | \n |
| 19 | reasoning | 19 | 37 | 1134 | - |
| 20 | reasoning | 20 | 39 | 1193 |  温度 |
| 21 | reasoning | 21 | 41 | 1258 | ： |
| 22 | reasoning | 22 | 43 | 1319 | 2 |
| 23 | reasoning | 23 | 45 | 1378 | 8 |
| 24 | reasoning | 24 | 47 | 1437 | °C |
| 25 | reasoning | 25 | 49 | 1498 | \n |
| 26 | reasoning | 26 | 51 | 1558 | - |
| 27 | reasoning | 27 | 53 | 1617 |  湿度 |
| 28 | reasoning | 28 | 55 | 1682 | ： |
| 29 | reasoning | 29 | 57 | 1743 | 4 |
| 30 | reasoning | 30 | 59 | 1802 | 0 |
| 31 | reasoning | 31 | 61 | 1861 | % |
| 32 | reasoning | 32 | 63 | 1920 | \n |
| 33 | reasoning | 33 | 65 | 1980 | - |
| 34 | reasoning | 34 | 67 | 2039 |  空气质量 |
| 35 | reasoning | 35 | 69 | 2110 | 指数 |
| 36 | reasoning | 36 | 71 | 2174 | （ |
| 37 | reasoning | 37 | 73 | 2235 | AQ |
| 38 | reasoning | 38 | 75 | 2295 | I |
| 39 | reasoning | 39 | 77 | 2354 | ） |
| 40 | reasoning | 40 | 79 | 2415 | ： |
| 41 | reasoning | 41 | 81 | 2476 | 5 |
| 42 | reasoning | 42 | 83 | 2535 | 5 |
| 43 | reasoning | 43 | 85 | 2594 | \n |
| 44 | reasoning | 44 | 87 | 2654 | - |
| 45 | reasoning | 45 | 89 | 2713 |  数据 |
| 46 | reasoning | 46 | 91 | 2778 | 获取 |
| 47 | reasoning | 47 | 93 | 2842 | 时间 |
| 48 | reasoning | 48 | 95 | 2906 | ： |
| 49 | reasoning | 49 | 97 | 2967 | 2 |
| 50 | reasoning | 50 | 99 | 3026 | 0 |
| 51 | reasoning | 51 | 101 | 3085 | 2 |
| 52 | reasoning | 52 | 103 | 3144 | 6 |
| 53 | reasoning | 53 | 105 | 3203 | - |
| 54 | reasoning | 54 | 107 | 3262 | 0 |
| 55 | reasoning | 55 | 109 | 3321 | 8 |
| 56 | reasoning | 56 | 111 | 3380 | - |
| 57 | reasoning | 57 | 113 | 3439 | 3 |
| 58 | reasoning | 58 | 115 | 3498 | 0 |
| 59 | reasoning | 59 | 117 | 3557 |  1 |
| 60 | reasoning | 60 | 119 | 3617 | 5 |
| 61 | reasoning | 61 | 121 | 3676 | : |
| 62 | reasoning | 62 | 123 | 3735 | 5 |
| 63 | reasoning | 63 | 125 | 3794 | 3 |
| 64 | reasoning | 64 | 127 | 3853 | : |
| 65 | reasoning | 65 | 129 | 3912 | 3 |
| 66 | reasoning | 66 | 131 | 3971 | 0 |
| 67 | reasoning | 67 | 133 | 4030 | \n\n |
| 68 | reasoning | 68 | 135 | 4092 | 这些信息 |
| 69 | reasoning | 69 | 137 | 4162 | 可以直接 |
| 70 | reasoning | 70 | 139 | 4232 | 告诉 |
| 71 | reasoning | 71 | 141 | 4296 | 用户 |
| 72 | reasoning | 72 | 143 | 4360 | 。 |
| 73 | reasoning | 73 | 145 | 4421 | \n |
| 74 | text | 74 | 147 | 4481 | \n\n |
| 75 | text | 75 | 149 | 4541 | 北京 |
| 76 | text | 76 | 151 | 4603 | 今天的 |
| 77 | text | 77 | 153 | 4668 | 天气 |
| 78 | text | 78 | 155 | 4730 | 是 |
| 79 | text | 79 | 157 | 4789 | 晴天 |
| 80 | text | 80 | 159 | 4851 | ， |
| 81 | text | 81 | 161 | 4910 | 气温 |
| 82 | text | 82 | 163 | 4972 | 2 |
| 83 | text | 83 | 165 | 5029 | 8 |
| 84 | text | 84 | 167 | 5086 | °C |
| 85 | text | 85 | 169 | 5145 | ， |
| 86 | text | 86 | 171 | 5204 | 湿度 |
| 87 | text | 87 | 173 | 5266 | 4 |
| 88 | text | 88 | 175 | 5323 | 0 |
| 89 | text | 89 | 177 | 5380 | %， |
| 90 | text | 90 | 179 | 5440 | 空气质量 |
| 91 | text | 91 | 181 | 5508 | 指数 |
| 92 | text | 92 | 183 | 5570 | （ |
| 93 | text | 93 | 185 | 5629 | AQ |
| 94 | text | 94 | 187 | 5687 | I |
| 95 | text | 95 | 189 | 5744 | ） |
| 96 | text | 96 | 191 | 5803 | 为 |
| 97 | text | 97 | 193 | 5862 | 5 |
| 98 | text | 98 | 195 | 5919 | 5 |
| 99 | text | 99 | 197 | 5976 | 。 |
