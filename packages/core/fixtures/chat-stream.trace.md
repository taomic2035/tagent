# Token 溯源表：chat-stream

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 146 |
| keepalive 注释帧 | 3 |
| 思考 token（reasoning） | 145 |
| 正文 token（text） | 0 |
| tool_call 分片 | 0 |
| finish_reason | length |
| 收到 [DONE] | 是 |
| 文件字节数 | 59941 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 7 | 57 | Thinking |
| 2 | reasoning | 2 | 9 | 471 |  Process |
| 3 | reasoning | 3 | 11 | 885 | : |
| 4 | reasoning | 4 | 13 | 1292 | \n |
| 5 | reasoning | 5 | 15 | 1700 | 1 |
| 6 | reasoning | 6 | 17 | 2107 | . |
| 7 | reasoning | 7 | 19 | 2514 |   ** |
| 8 | reasoning | 8 | 21 | 2924 | An |
| 9 | reasoning | 9 | 23 | 3332 | alyze |
| 10 | reasoning | 10 | 25 | 3743 |  the |
| 11 | reasoning | 11 | 27 | 4153 |  Request |
| 12 | reasoning | 12 | 29 | 4567 | :** |
| 13 | reasoning | 13 | 31 | 4976 | \n |
| 14 | reasoning | 14 | 33 | 5384 |     |
| 15 | reasoning | 15 | 35 | 5793 |  * |
| 16 | reasoning | 16 | 37 | 6201 |    |
| 17 | reasoning | 17 | 39 | 6609 |  Topic |
| 18 | reasoning | 18 | 41 | 7021 | : |
| 19 | reasoning | 19 | 43 | 7428 |  Autumn |
| 20 | reasoning | 20 | 45 | 7841 |  ( |
| 21 | reasoning | 21 | 47 | 8249 | 秋天 |
| 22 | reasoning | 22 | 49 | 8667 |  - |
| 23 | reasoning | 23 | 51 | 9075 |  qi |
| 24 | reasoning | 24 | 53 | 9484 | ū |
| 25 | reasoning | 25 | 55 | 9896 | ti |
| 26 | reasoning | 26 | 57 | 10304 | ā |
| 27 | reasoning | 27 | 59 | 10716 | n |
| 28 | reasoning | 28 | 61 | 11123 | ). |
| 29 | reasoning | 29 | 63 | 11531 | \n |
| 30 | reasoning | 30 | 65 | 11939 |     |
| 31 | reasoning | 31 | 67 | 12348 |  * |
| 32 | reasoning | 32 | 69 | 12756 |    |
| 33 | reasoning | 33 | 71 | 13164 |  Constraint |
| 34 | reasoning | 34 | 73 | 13581 | : |
| 35 | reasoning | 35 | 75 | 13988 |  Use |
| 36 | reasoning | 36 | 77 | 14398 |  two |
| 37 | reasoning | 37 | 79 | 14808 |  or |
| 38 | reasoning | 38 | 81 | 15217 |  three |
| 39 | reasoning | 39 | 83 | 15629 |  sentences |
| 40 | reasoning | 40 | 85 | 16045 |  ( |
| 41 | reasoning | 41 | 87 | 16453 | 用 |
| 42 | reasoning | 42 | 89 | 16865 | 两三 |
| 43 | reasoning | 43 | 91 | 17283 | 句话 |
| 44 | reasoning | 44 | 93 | 17701 | ). |
| 45 | reasoning | 45 | 95 | 18109 | \n |
| 46 | reasoning | 46 | 97 | 18517 |     |
| 47 | reasoning | 47 | 99 | 18926 |  * |
| 48 | reasoning | 48 | 101 | 19334 |    |
| 49 | reasoning | 49 | 103 | 19742 |  Language |
| 50 | reasoning | 50 | 105 | 20157 | : |
| 51 | reasoning | 51 | 107 | 20564 |  Chinese |
| 52 | reasoning | 52 | 109 | 20978 | . |
| 53 | reasoning | 53 | 111 | 21385 | \n\n |
| 54 | reasoning | 54 | 113 | 21795 | 2 |
| 55 | reasoning | 55 | 115 | 22202 | . |
| 56 | reasoning | 56 | 117 | 22609 |   ** |
| 57 | reasoning | 57 | 119 | 23019 | Ident |
| 58 | reasoning | 58 | 121 | 23430 | ify |
| 59 | reasoning | 59 | 123 | 23839 |  Key |
| 60 | reasoning | 60 | 125 | 24249 |  Characteristics |
| 61 | reasoning | 61 | 127 | 24671 |  of |
| 62 | reasoning | 62 | 129 | 25080 |  Autumn |
| 63 | reasoning | 63 | 131 | 25493 | :** |
| 64 | reasoning | 64 | 133 | 25902 | \n |
| 65 | reasoning | 65 | 135 | 26310 |     |
| 66 | reasoning | 66 | 137 | 26719 |  * |
| 67 | reasoning | 67 | 139 | 27127 |    |
| 68 | reasoning | 68 | 141 | 27535 |  Season |
| 69 | reasoning | 69 | 143 | 27948 | al |
| 70 | reasoning | 70 | 145 | 28356 |  transition |
| 71 | reasoning | 71 | 147 | 28773 |  ( |
| 72 | reasoning | 72 | 149 | 29181 | summer |
| 73 | reasoning | 73 | 151 | 29593 |  to |
| 74 | reasoning | 74 | 153 | 30002 |  winter |
| 75 | reasoning | 75 | 155 | 30415 | ). |
| 76 | reasoning | 76 | 157 | 30823 | \n |
| 77 | reasoning | 77 | 159 | 31231 |     |
| 78 | reasoning | 78 | 161 | 31640 |  * |
| 79 | reasoning | 79 | 163 | 32048 |    |
| 80 | reasoning | 80 | 165 | 32456 |  Visual |
| 81 | reasoning | 81 | 167 | 32869 | s |
| 82 | reasoning | 82 | 169 | 33276 | : |
| 83 | reasoning | 83 | 171 | 33683 |  falling |
| 84 | reasoning | 84 | 173 | 34097 |  leaves |
| 85 | reasoning | 85 | 175 | 34510 | , |
| 86 | reasoning | 86 | 177 | 34917 |  golden |
| 87 | reasoning | 87 | 179 | 35330 |  colors |
| 88 | reasoning | 88 | 181 | 35743 | , |
| 89 | reasoning | 89 | 183 | 36150 |  harvest |
| 90 | reasoning | 90 | 185 | 36564 | . |
| 91 | reasoning | 91 | 187 | 36971 | \n |
| 92 | reasoning | 92 | 189 | 37379 |     |
| 93 | reasoning | 93 | 191 | 37788 |  * |
| 94 | reasoning | 94 | 193 | 38196 |    |
| 95 | reasoning | 95 | 195 | 38604 |  Weather |
| 96 | reasoning | 96 | 197 | 39018 | : |
| 97 | reasoning | 97 | 199 | 39425 |  cooler |
| 98 | reasoning | 98 | 201 | 39838 | , |
| 99 | reasoning | 99 | 203 | 40245 |  crisp |
| 100 | reasoning | 100 | 205 | 40657 | , |
| 101 | reasoning | 101 | 207 | 41064 |  clear |
| 102 | reasoning | 102 | 209 | 41476 |  skies |
| 103 | reasoning | 103 | 211 | 41888 | . |
| 104 | reasoning | 104 | 213 | 42295 | \n |
| 105 | reasoning | 105 | 215 | 42703 |     |
| 106 | reasoning | 106 | 217 | 43112 |  * |
| 107 | reasoning | 107 | 219 | 43520 |    |
| 108 | reasoning | 108 | 221 | 43928 |  Mood |
| 109 | reasoning | 109 | 223 | 44339 | : |
| 110 | reasoning | 110 | 225 | 44746 |  poetic |
| 111 | reasoning | 111 | 227 | 45159 | , |
| 112 | reasoning | 112 | 229 | 45566 |  reflective |
| 113 | reasoning | 113 | 231 | 45983 | , |
| 114 | reasoning | 114 | 233 | 46390 |  harvest |
| 115 | reasoning | 115 | 235 | 46804 | , |
| 116 | reasoning | 116 | 237 | 47211 |  melanch |
| 117 | reasoning | 117 | 239 | 47625 | oly |
| 118 | reasoning | 118 | 241 | 48034 |  or |
| 119 | reasoning | 119 | 243 | 48443 |  peaceful |
| 120 | reasoning | 120 | 245 | 48858 | . |
| 121 | reasoning | 121 | 247 | 49265 | \n\n |
| 122 | reasoning | 122 | 249 | 49675 | 3 |
| 123 | reasoning | 123 | 251 | 50082 | . |
| 124 | reasoning | 124 | 253 | 50489 |   ** |
| 125 | reasoning | 125 | 255 | 50899 | Draft |
| 126 | reasoning | 126 | 257 | 51310 | ing |
| 127 | reasoning | 127 | 259 | 51719 |  Options |
| 128 | reasoning | 128 | 261 | 52133 | :** |
| 129 | reasoning | 129 | 263 | 52542 | \n |
| 130 | reasoning | 130 | 265 | 52950 |     |
| 131 | reasoning | 131 | 267 | 53359 |  * |
| 132 | reasoning | 132 | 269 | 53767 |    |
| 133 | reasoning | 133 | 271 | 54175 |  * |
| 134 | reasoning | 134 | 273 | 54583 | Option |
| 135 | reasoning | 135 | 275 | 54995 |  1 |
| 136 | reasoning | 136 | 277 | 55403 |  ( |
| 137 | reasoning | 137 | 279 | 55811 | Des |
| 138 | reasoning | 138 | 281 | 56220 | criptive |
| 139 | reasoning | 139 | 283 | 56634 | ): |
| 140 | reasoning | 140 | 285 | 57042 | * |
| 141 | reasoning | 141 | 287 | 57449 |  秋天 |
| 142 | reasoning | 142 | 289 | 57868 | 是 |
| 143 | reasoning | 143 | 291 | 58280 | 凉爽 |
| 144 | reasoning | 144 | 293 | 58698 | 的季节 |
| 145 | reasoning | 145 | 295 | 59122 | ， |
