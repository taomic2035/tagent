# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 137 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 112 |
| 正文 token（text） | 0 |
| tool_call 分片 | 23 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 40759 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 要求 |
| 3 | reasoning | 4 | 7 | 875 | 我 |
| 4 | reasoning | 5 | 9 | 1162 | 拆 |
| 5 | reasoning | 6 | 11 | 1449 | 分成 |
| 6 | reasoning | 7 | 13 | 1739 | 两个 |
| 7 | reasoning | 8 | 15 | 2029 | 子 |
| 8 | reasoning | 9 | 17 | 2316 | 任务 |
| 9 | reasoning | 10 | 19 | 2606 | ， |
| 10 | reasoning | 11 | 21 | 2893 | 分别 |
| 11 | reasoning | 12 | 23 | 3183 | 使用 |
| 12 | reasoning | 13 | 25 | 3473 |  delegate |
| 13 | reasoning | 14 | 27 | 3766 |   |
| 14 | reasoning | 15 | 29 | 4051 | 工具 |
| 15 | reasoning | 16 | 31 | 4341 | 来 |
| 16 | reasoning | 17 | 33 | 4628 | 查询 |
| 17 | reasoning | 18 | 35 | 4918 | 和 |
| 18 | reasoning | 19 | 37 | 5205 | 计算 |
| 19 | reasoning | 20 | 39 | 5495 | ： |
| 20 | reasoning | 21 | 41 | 5782 | \n |
| 21 | reasoning | 22 | 43 | 6068 | 1 |
| 22 | reasoning | 23 | 45 | 6353 | . |
| 23 | reasoning | 24 | 47 | 6638 |   |
| 24 | reasoning | 25 | 49 | 6923 | 子 |
| 25 | reasoning | 26 | 51 | 7210 | 任务 |
| 26 | reasoning | 27 | 53 | 7500 | 一 |
| 27 | reasoning | 28 | 55 | 7787 | ： |
| 28 | reasoning | 29 | 57 | 8074 | 查询 |
| 29 | reasoning | 30 | 59 | 8364 | 北京 |
| 30 | reasoning | 31 | 61 | 8654 | 和上海 |
| 31 | reasoning | 32 | 63 | 8947 | 的温度 |
| 32 | reasoning | 33 | 65 | 9240 | 并 |
| 33 | reasoning | 34 | 67 | 9527 | 计算 |
| 34 | reasoning | 35 | 69 | 9817 | 平均值 |
| 35 | reasoning | 36 | 71 | 10110 | \n |
| 36 | reasoning | 37 | 73 | 10396 | 2 |
| 37 | reasoning | 38 | 75 | 10681 | . |
| 38 | reasoning | 39 | 77 | 10966 |   |
| 39 | reasoning | 40 | 79 | 11251 | 子 |
| 40 | reasoning | 41 | 81 | 11538 | 任务 |
| 41 | reasoning | 42 | 83 | 11828 | 二 |
| 42 | reasoning | 43 | 85 | 12115 | ： |
| 43 | reasoning | 44 | 87 | 12402 | 查询 |
| 44 | reasoning | 45 | 89 | 12692 | 广州 |
| 45 | reasoning | 46 | 91 | 12982 | 和 |
| 46 | reasoning | 47 | 93 | 13269 | 深圳 |
| 47 | reasoning | 48 | 95 | 13559 | 的温度 |
| 48 | reasoning | 49 | 97 | 13852 | 并 |
| 49 | reasoning | 50 | 99 | 14139 | 计算 |
| 50 | reasoning | 51 | 101 | 14429 | 平均值 |
| 51 | reasoning | 52 | 103 | 14722 | \n\n |
| 52 | reasoning | 53 | 105 | 15010 | 然后 |
| 53 | reasoning | 54 | 107 | 15300 | 汇总 |
| 54 | reasoning | 55 | 109 | 15590 | 后 |
| 55 | reasoning | 56 | 111 | 15877 | 告诉 |
| 56 | reasoning | 57 | 113 | 16167 | 用户 |
| 57 | reasoning | 58 | 115 | 16457 | 哪 |
| 58 | reasoning | 59 | 117 | 16744 | 组 |
| 59 | reasoning | 60 | 119 | 17031 | 更 |
| 60 | reasoning | 61 | 121 | 17318 | 热 |
| 61 | reasoning | 62 | 123 | 17605 | 。 |
| 62 | reasoning | 63 | 125 | 17892 | \n\n |
| 63 | reasoning | 64 | 127 | 18180 | 我需要 |
| 64 | reasoning | 65 | 129 | 18473 | 调用 |
| 65 | reasoning | 66 | 131 | 18763 |  delegate |
| 66 | reasoning | 67 | 133 | 19056 |   |
| 67 | reasoning | 68 | 135 | 19341 | 工具 |
| 68 | reasoning | 69 | 137 | 19631 | 来 |
| 69 | reasoning | 70 | 139 | 19918 | 执行 |
| 70 | reasoning | 71 | 141 | 20208 | 这两个 |
| 71 | reasoning | 72 | 143 | 20501 | 子 |
| 72 | reasoning | 73 | 145 | 20788 | 任务 |
| 73 | reasoning | 74 | 147 | 21078 | 。 |
| 74 | reasoning | 75 | 149 | 21365 | \n\n |
| 75 | reasoning | 76 | 151 | 21653 | 子 |
| 76 | reasoning | 77 | 153 | 21940 | 任务 |
| 77 | reasoning | 78 | 155 | 22230 | 一的 |
| 78 | reasoning | 79 | 157 | 22520 | 描述 |
| 79 | reasoning | 80 | 159 | 22810 | 应该是 |
| 80 | reasoning | 81 | 161 | 23103 | ： |
| 81 | reasoning | 82 | 163 | 23390 | 查询 |
| 82 | reasoning | 83 | 165 | 23680 | 北京 |
| 83 | reasoning | 84 | 167 | 23970 | 和上海 |
| 84 | reasoning | 85 | 169 | 24263 | 的温度 |
| 85 | reasoning | 86 | 171 | 24556 | 并 |
| 86 | reasoning | 87 | 173 | 24843 | 计算 |
| 87 | reasoning | 88 | 175 | 25133 | 平均值 |
| 88 | reasoning | 89 | 177 | 25426 | \n |
| 89 | reasoning | 90 | 179 | 25712 | 子 |
| 90 | reasoning | 91 | 181 | 25999 | 任务 |
| 91 | reasoning | 92 | 183 | 26289 | 二的 |
| 92 | reasoning | 93 | 185 | 26579 | 描述 |
| 93 | reasoning | 94 | 187 | 26869 | 应该是 |
| 94 | reasoning | 95 | 189 | 27162 | ： |
| 95 | reasoning | 96 | 191 | 27449 | 查询 |
| 96 | reasoning | 97 | 193 | 27739 | 广州 |
| 97 | reasoning | 98 | 195 | 28029 | 和 |
| 98 | reasoning | 99 | 197 | 28316 | 深圳 |
| 99 | reasoning | 100 | 199 | 28606 | 的温度 |
| 100 | reasoning | 101 | 201 | 28899 | 并 |
| 101 | reasoning | 102 | 203 | 29186 | 计算 |
| 102 | reasoning | 103 | 205 | 29476 | 平均值 |
| 103 | reasoning | 104 | 207 | 29769 | \n\n |
| 104 | reasoning | 105 | 209 | 30057 | 让我 |
| 105 | reasoning | 106 | 211 | 30347 | 分别 |
| 106 | reasoning | 107 | 213 | 30637 | 调用 |
| 107 | reasoning | 108 | 215 | 30927 | 这两个 |
| 108 | reasoning | 109 | 217 | 31220 |  delegate |
| 109 | reasoning | 110 | 219 | 31513 |   |
| 110 | reasoning | 111 | 221 | 31798 | 工具 |
| 111 | reasoning | 112 | 223 | 32088 | 。 |
| 112 | reasoning | 113 | 225 | 32375 | \n |
| 113 | tool-call | 114 | 227 | 32661 | name=delegate args={ |
| 114 | tool-call | 115 | 229 | 33054 | name=null args=\"task\":\" |
| 115 | tool-call | 116 | 231 | 33381 | name=null args=查询 |
| 116 | tool-call | 117 | 233 | 33703 | name=null args=北京 |
| 117 | tool-call | 118 | 235 | 34025 | name=null args=和上海 |
| 118 | tool-call | 119 | 237 | 34350 | name=null args=的温度 |
| 119 | tool-call | 120 | 239 | 34675 | name=null args=并 |
| 120 | tool-call | 121 | 241 | 34994 | name=null args=计算 |
| 121 | tool-call | 122 | 243 | 35316 | name=null args=平均值 |
| 122 | tool-call | 123 | 245 | 35641 | name=null args=\" |
| 123 | tool-call | 124 | 247 | 35959 | name=null args=} |
| 124 | tool-call | 125 | 249 | 36276 | name=delegate args={ |
| 125 | tool-call | 126 | 251 | 36669 | name=null args=\"task\":\" |
| 126 | tool-call | 127 | 253 | 36996 | name=null args=查询 |
| 127 | tool-call | 128 | 255 | 37318 | name=null args=广州 |
| 128 | tool-call | 129 | 257 | 37640 | name=null args=和 |
| 129 | tool-call | 130 | 259 | 37959 | name=null args=深圳 |
| 130 | tool-call | 131 | 261 | 38281 | name=null args=的温度 |
| 131 | tool-call | 132 | 263 | 38606 | name=null args=并 |
| 132 | tool-call | 133 | 265 | 38925 | name=null args=计算 |
| 133 | tool-call | 134 | 267 | 39247 | name=null args=平均值 |
| 134 | tool-call | 135 | 269 | 39572 | name=null args=\" |
| 135 | tool-call | 136 | 271 | 39890 | name=null args=} |
