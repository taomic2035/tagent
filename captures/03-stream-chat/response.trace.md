# Token 溯源表：response.sse

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 146 |
| keepalive 注释帧 | 1 |
| 思考 token（reasoning） | 145 |
| 正文 token（text） | 0 |
| tool_call 分片 | 0 |
| finish_reason | length |
| 收到 [DONE] | 是 |
| 文件字节数 | 59901 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 3 | 17 | Thinking |
| 2 | reasoning | 2 | 5 | 431 |  Process |
| 3 | reasoning | 3 | 7 | 845 | : |
| 4 | reasoning | 4 | 9 | 1252 | \n |
| 5 | reasoning | 5 | 11 | 1660 | 1 |
| 6 | reasoning | 6 | 13 | 2067 | . |
| 7 | reasoning | 7 | 15 | 2474 |   ** |
| 8 | reasoning | 8 | 17 | 2884 | An |
| 9 | reasoning | 9 | 19 | 3292 | alyze |
| 10 | reasoning | 10 | 21 | 3703 |  the |
| 11 | reasoning | 11 | 23 | 4113 |  Request |
| 12 | reasoning | 12 | 25 | 4527 | :** |
| 13 | reasoning | 13 | 27 | 4936 | \n |
| 14 | reasoning | 14 | 29 | 5344 |     |
| 15 | reasoning | 15 | 31 | 5753 |  * |
| 16 | reasoning | 16 | 33 | 6161 |    |
| 17 | reasoning | 17 | 35 | 6569 |  Topic |
| 18 | reasoning | 18 | 37 | 6981 | : |
| 19 | reasoning | 19 | 39 | 7388 |  Autumn |
| 20 | reasoning | 20 | 41 | 7801 |  ( |
| 21 | reasoning | 21 | 43 | 8209 | 秋天 |
| 22 | reasoning | 22 | 45 | 8627 |  - |
| 23 | reasoning | 23 | 47 | 9035 |  qi |
| 24 | reasoning | 24 | 49 | 9444 | ū |
| 25 | reasoning | 25 | 51 | 9856 | ti |
| 26 | reasoning | 26 | 53 | 10264 | ā |
| 27 | reasoning | 27 | 55 | 10676 | n |
| 28 | reasoning | 28 | 57 | 11083 | ). |
| 29 | reasoning | 29 | 59 | 11491 | \n |
| 30 | reasoning | 30 | 61 | 11899 |     |
| 31 | reasoning | 31 | 63 | 12308 |  * |
| 32 | reasoning | 32 | 65 | 12716 |    |
| 33 | reasoning | 33 | 67 | 13124 |  Constraint |
| 34 | reasoning | 34 | 69 | 13541 | : |
| 35 | reasoning | 35 | 71 | 13948 |  Use |
| 36 | reasoning | 36 | 73 | 14358 |  two |
| 37 | reasoning | 37 | 75 | 14768 |  or |
| 38 | reasoning | 38 | 77 | 15177 |  three |
| 39 | reasoning | 39 | 79 | 15589 |  sentences |
| 40 | reasoning | 40 | 81 | 16005 |  ( |
| 41 | reasoning | 41 | 83 | 16413 | 用 |
| 42 | reasoning | 42 | 85 | 16825 | 两三 |
| 43 | reasoning | 43 | 87 | 17243 | 句话 |
| 44 | reasoning | 44 | 89 | 17661 | ). |
| 45 | reasoning | 45 | 91 | 18069 | \n |
| 46 | reasoning | 46 | 93 | 18477 |     |
| 47 | reasoning | 47 | 95 | 18886 |  * |
| 48 | reasoning | 48 | 97 | 19294 |    |
| 49 | reasoning | 49 | 99 | 19702 |  Language |
| 50 | reasoning | 50 | 101 | 20117 | : |
| 51 | reasoning | 51 | 103 | 20524 |  Chinese |
| 52 | reasoning | 52 | 105 | 20938 | . |
| 53 | reasoning | 53 | 107 | 21345 | \n\n |
| 54 | reasoning | 54 | 109 | 21755 | 2 |
| 55 | reasoning | 55 | 111 | 22162 | . |
| 56 | reasoning | 56 | 113 | 22569 |   ** |
| 57 | reasoning | 57 | 115 | 22979 | Ident |
| 58 | reasoning | 58 | 117 | 23390 | ify |
| 59 | reasoning | 59 | 119 | 23799 |  Key |
| 60 | reasoning | 60 | 121 | 24209 |  Characteristics |
| 61 | reasoning | 61 | 123 | 24631 |  of |
| 62 | reasoning | 62 | 125 | 25040 |  Autumn |
| 63 | reasoning | 63 | 127 | 25453 | :** |
| 64 | reasoning | 64 | 129 | 25862 | \n |
| 65 | reasoning | 65 | 131 | 26270 |     |
| 66 | reasoning | 66 | 133 | 26679 |  * |
| 67 | reasoning | 67 | 135 | 27087 |    |
| 68 | reasoning | 68 | 137 | 27495 |  Season |
| 69 | reasoning | 69 | 139 | 27908 | al |
| 70 | reasoning | 70 | 141 | 28316 |  transition |
| 71 | reasoning | 71 | 143 | 28733 |  ( |
| 72 | reasoning | 72 | 145 | 29141 | summer |
| 73 | reasoning | 73 | 147 | 29553 |  to |
| 74 | reasoning | 74 | 149 | 29962 |  winter |
| 75 | reasoning | 75 | 151 | 30375 | ). |
| 76 | reasoning | 76 | 153 | 30783 | \n |
| 77 | reasoning | 77 | 155 | 31191 |     |
| 78 | reasoning | 78 | 157 | 31600 |  * |
| 79 | reasoning | 79 | 159 | 32008 |    |
| 80 | reasoning | 80 | 161 | 32416 |  Visual |
| 81 | reasoning | 81 | 163 | 32829 | s |
| 82 | reasoning | 82 | 165 | 33236 | : |
| 83 | reasoning | 83 | 167 | 33643 |  falling |
| 84 | reasoning | 84 | 169 | 34057 |  leaves |
| 85 | reasoning | 85 | 171 | 34470 | , |
| 86 | reasoning | 86 | 173 | 34877 |  golden |
| 87 | reasoning | 87 | 175 | 35290 |  colors |
| 88 | reasoning | 88 | 177 | 35703 | , |
| 89 | reasoning | 89 | 179 | 36110 |  harvest |
| 90 | reasoning | 90 | 181 | 36524 | . |
| 91 | reasoning | 91 | 183 | 36931 | \n |
| 92 | reasoning | 92 | 185 | 37339 |     |
| 93 | reasoning | 93 | 187 | 37748 |  * |
| 94 | reasoning | 94 | 189 | 38156 |    |
| 95 | reasoning | 95 | 191 | 38564 |  Weather |
| 96 | reasoning | 96 | 193 | 38978 | : |
| 97 | reasoning | 97 | 195 | 39385 |  cooler |
| 98 | reasoning | 98 | 197 | 39798 | , |
| 99 | reasoning | 99 | 199 | 40205 |  crisp |
| 100 | reasoning | 100 | 201 | 40617 | , |
| 101 | reasoning | 101 | 203 | 41024 |  clear |
| 102 | reasoning | 102 | 205 | 41436 |  skies |
| 103 | reasoning | 103 | 207 | 41848 | . |
| 104 | reasoning | 104 | 209 | 42255 | \n |
| 105 | reasoning | 105 | 211 | 42663 |     |
| 106 | reasoning | 106 | 213 | 43072 |  * |
| 107 | reasoning | 107 | 215 | 43480 |    |
| 108 | reasoning | 108 | 217 | 43888 |  Mood |
| 109 | reasoning | 109 | 219 | 44299 | : |
| 110 | reasoning | 110 | 221 | 44706 |  poetic |
| 111 | reasoning | 111 | 223 | 45119 | , |
| 112 | reasoning | 112 | 225 | 45526 |  reflective |
| 113 | reasoning | 113 | 227 | 45943 | , |
| 114 | reasoning | 114 | 229 | 46350 |  harvest |
| 115 | reasoning | 115 | 231 | 46764 | , |
| 116 | reasoning | 116 | 233 | 47171 |  melanch |
| 117 | reasoning | 117 | 235 | 47585 | oly |
| 118 | reasoning | 118 | 237 | 47994 |  or |
| 119 | reasoning | 119 | 239 | 48403 |  peaceful |
| 120 | reasoning | 120 | 241 | 48818 | . |
| 121 | reasoning | 121 | 243 | 49225 | \n\n |
| 122 | reasoning | 122 | 245 | 49635 | 3 |
| 123 | reasoning | 123 | 247 | 50042 | . |
| 124 | reasoning | 124 | 249 | 50449 |   ** |
| 125 | reasoning | 125 | 251 | 50859 | Draft |
| 126 | reasoning | 126 | 253 | 51270 | ing |
| 127 | reasoning | 127 | 255 | 51679 |  Options |
| 128 | reasoning | 128 | 257 | 52093 | :** |
| 129 | reasoning | 129 | 259 | 52502 | \n |
| 130 | reasoning | 130 | 261 | 52910 |     |
| 131 | reasoning | 131 | 263 | 53319 |  * |
| 132 | reasoning | 132 | 265 | 53727 |    |
| 133 | reasoning | 133 | 267 | 54135 |  * |
| 134 | reasoning | 134 | 269 | 54543 | Option |
| 135 | reasoning | 135 | 271 | 54955 |  1 |
| 136 | reasoning | 136 | 273 | 55363 |  ( |
| 137 | reasoning | 137 | 275 | 55771 | Des |
| 138 | reasoning | 138 | 277 | 56180 | criptive |
| 139 | reasoning | 139 | 279 | 56594 | ): |
| 140 | reasoning | 140 | 281 | 57002 | * |
| 141 | reasoning | 141 | 283 | 57409 |  秋天 |
| 142 | reasoning | 142 | 285 | 57828 | 是 |
| 143 | reasoning | 143 | 287 | 58240 | 凉爽 |
| 144 | reasoning | 144 | 289 | 58658 | 的季节 |
| 145 | reasoning | 145 | 291 | 59082 | ， |
