# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 187 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 170 |
| 正文 token（text） | 0 |
| tool_call 分片 | 15 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 55065 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想 |
| 3 | reasoning | 4 | 7 | 872 | 对比 |
| 4 | reasoning | 5 | 9 | 1162 | 杭州 |
| 5 | reasoning | 6 | 11 | 1452 | 和 |
| 6 | reasoning | 7 | 13 | 1739 | 另外 |
| 7 | reasoning | 8 | 15 | 2029 | 两个 |
| 8 | reasoning | 9 | 17 | 2319 | 城市的 |
| 9 | reasoning | 10 | 19 | 2612 | 天气 |
| 10 | reasoning | 11 | 21 | 2902 | ， |
| 11 | reasoning | 12 | 23 | 3189 | 但 |
| 12 | reasoning | 13 | 25 | 3476 | 只 |
| 13 | reasoning | 14 | 27 | 3763 | 说了 |
| 14 | reasoning | 15 | 29 | 4053 | “ |
| 15 | reasoning | 16 | 31 | 4340 | 对比 |
| 16 | reasoning | 17 | 33 | 4630 | 一下 |
| 17 | reasoning | 18 | 35 | 4920 | 这三个 |
| 18 | reasoning | 19 | 37 | 5213 | 城市 |
| 19 | reasoning | 20 | 39 | 5503 | ”， |
| 20 | reasoning | 21 | 41 | 5793 | 没有 |
| 21 | reasoning | 22 | 43 | 6083 | 指明 |
| 22 | reasoning | 23 | 45 | 6373 | 是哪 |
| 23 | reasoning | 24 | 47 | 6663 | 三个 |
| 24 | reasoning | 25 | 49 | 6953 | 城市 |
| 25 | reasoning | 26 | 51 | 7243 | 。 |
| 26 | reasoning | 27 | 53 | 7530 | 结合 |
| 27 | reasoning | 28 | 55 | 7820 | 上下文 |
| 28 | reasoning | 29 | 57 | 8113 | ， |
| 29 | reasoning | 30 | 59 | 8400 | 我 |
| 30 | reasoning | 31 | 61 | 8687 | 刚才 |
| 31 | reasoning | 32 | 63 | 8977 | 查询 |
| 32 | reasoning | 33 | 65 | 9267 | 了 |
| 33 | reasoning | 34 | 67 | 9554 | 杭州 |
| 34 | reasoning | 35 | 69 | 9844 | 的天气 |
| 35 | reasoning | 36 | 71 | 10137 | ， |
| 36 | reasoning | 37 | 73 | 10424 | 现在 |
| 37 | reasoning | 38 | 75 | 10714 | 需要 |
| 38 | reasoning | 39 | 77 | 11004 | 获取 |
| 39 | reasoning | 40 | 79 | 11294 | 另外 |
| 40 | reasoning | 41 | 81 | 11584 | 两个 |
| 41 | reasoning | 42 | 83 | 11874 | 城市的 |
| 42 | reasoning | 43 | 85 | 12167 | 天气 |
| 43 | reasoning | 44 | 87 | 12457 | 来进行 |
| 44 | reasoning | 45 | 89 | 12750 | 对比 |
| 45 | reasoning | 46 | 91 | 13040 | 。 |
| 46 | reasoning | 47 | 93 | 13327 | \n\n |
| 47 | reasoning | 48 | 95 | 13615 | 由于 |
| 48 | reasoning | 49 | 97 | 13905 | 用户 |
| 49 | reasoning | 50 | 99 | 14195 | 没有 |
| 50 | reasoning | 51 | 101 | 14485 | 明确 |
| 51 | reasoning | 52 | 103 | 14775 | 说明 |
| 52 | reasoning | 53 | 105 | 15065 | 是哪 |
| 53 | reasoning | 54 | 107 | 15355 | 三个 |
| 54 | reasoning | 55 | 109 | 15645 | 城市 |
| 55 | reasoning | 56 | 111 | 15935 | ， |
| 56 | reasoning | 57 | 113 | 16222 | 我 |
| 57 | reasoning | 58 | 115 | 16509 | 需要考虑 |
| 58 | reasoning | 59 | 117 | 16805 | 可能的 |
| 59 | reasoning | 60 | 119 | 17098 | 情况 |
| 60 | reasoning | 61 | 121 | 17388 | ： |
| 61 | reasoning | 62 | 123 | 17675 | \n |
| 62 | reasoning | 63 | 125 | 17961 | 1 |
| 63 | reasoning | 64 | 127 | 18246 | . |
| 64 | reasoning | 65 | 129 | 18531 |   |
| 65 | reasoning | 66 | 131 | 18816 | 用户 |
| 66 | reasoning | 67 | 133 | 19106 | 可能 |
| 67 | reasoning | 68 | 135 | 19396 | 指的是 |
| 68 | reasoning | 69 | 137 | 19689 | 中国 |
| 69 | reasoning | 70 | 139 | 19979 | 的一些 |
| 70 | reasoning | 71 | 141 | 20272 | 主要 |
| 71 | reasoning | 72 | 143 | 20562 | 城市 |
| 72 | reasoning | 73 | 145 | 20852 | \n |
| 73 | reasoning | 74 | 147 | 21138 | 2 |
| 74 | reasoning | 75 | 149 | 21423 | . |
| 75 | reasoning | 76 | 151 | 21708 |   |
| 76 | reasoning | 77 | 153 | 21993 | 或者 |
| 77 | reasoning | 78 | 155 | 22283 | 用户 |
| 78 | reasoning | 79 | 157 | 22573 | 忘记 |
| 79 | reasoning | 80 | 159 | 22863 | 说了 |
| 80 | reasoning | 81 | 161 | 23153 | \n\n |
| 81 | reasoning | 82 | 163 | 23441 | 我应该 |
| 82 | reasoning | 83 | 165 | 23734 | 先 |
| 83 | reasoning | 84 | 167 | 24021 | 询问 |
| 84 | reasoning | 85 | 169 | 24311 | 用户 |
| 85 | reasoning | 86 | 171 | 24601 | 具体 |
| 86 | reasoning | 87 | 173 | 24891 | 是哪 |
| 87 | reasoning | 88 | 175 | 25181 | 三个 |
| 88 | reasoning | 89 | 177 | 25471 | 城市 |
| 89 | reasoning | 90 | 179 | 25761 | ， |
| 90 | reasoning | 91 | 181 | 26048 | 或者 |
| 91 | reasoning | 92 | 183 | 26338 | 我 |
| 92 | reasoning | 93 | 185 | 26625 | 可以直接 |
| 93 | reasoning | 94 | 187 | 26921 | 查询 |
| 94 | reasoning | 95 | 189 | 27211 | 几个 |
| 95 | reasoning | 96 | 191 | 27501 | 常见 |
| 96 | reasoning | 97 | 193 | 27791 | 城市 |
| 97 | reasoning | 98 | 195 | 28081 | （ |
| 98 | reasoning | 99 | 197 | 28368 | 如 |
| 99 | reasoning | 100 | 199 | 28655 | 北京 |
| 100 | reasoning | 101 | 201 | 28945 | 、 |
| 101 | reasoning | 102 | 203 | 29232 | 上海 |
| 102 | reasoning | 103 | 205 | 29522 | 、 |
| 103 | reasoning | 104 | 207 | 29809 | 广州 |
| 104 | reasoning | 105 | 209 | 30099 | ） |
| 105 | reasoning | 106 | 211 | 30386 | 作为 |
| 106 | reasoning | 107 | 213 | 30676 | 对比 |
| 107 | reasoning | 108 | 215 | 30966 | 。 |
| 108 | reasoning | 109 | 217 | 31253 | \n\n |
| 109 | reasoning | 110 | 219 | 31541 | 但 |
| 110 | reasoning | 111 | 221 | 31828 | 更 |
| 111 | reasoning | 112 | 223 | 32115 | 合理的 |
| 112 | reasoning | 113 | 225 | 32408 | 做法 |
| 113 | reasoning | 114 | 227 | 32698 | 是 |
| 114 | reasoning | 115 | 229 | 32985 | 询问 |
| 115 | reasoning | 116 | 231 | 33275 | 用户 |
| 116 | reasoning | 117 | 233 | 33565 | 具体 |
| 117 | reasoning | 118 | 235 | 33855 | 是哪 |
| 118 | reasoning | 119 | 237 | 34145 | 三个 |
| 119 | reasoning | 120 | 239 | 34435 | 城市 |
| 120 | reasoning | 121 | 241 | 34725 | ， |
| 121 | reasoning | 122 | 243 | 35012 | 因为 |
| 122 | reasoning | 123 | 245 | 35302 | 这样 |
| 123 | reasoning | 124 | 247 | 35592 | 更 |
| 124 | reasoning | 125 | 249 | 35879 | 准确 |
| 125 | reasoning | 126 | 251 | 36169 | 。 |
| 126 | reasoning | 127 | 253 | 36456 | 不过 |
| 127 | reasoning | 128 | 255 | 36746 | 考虑到 |
| 128 | reasoning | 129 | 257 | 37039 | 用户 |
| 129 | reasoning | 130 | 259 | 37329 | 可能 |
| 130 | reasoning | 131 | 261 | 37619 | 希望 |
| 131 | reasoning | 132 | 263 | 37909 | 我 |
| 132 | reasoning | 133 | 265 | 38196 | 直接 |
| 133 | reasoning | 134 | 267 | 38486 | 给出 |
| 134 | reasoning | 135 | 269 | 38776 | 一些 |
| 135 | reasoning | 136 | 271 | 39066 | 常见 |
| 136 | reasoning | 137 | 273 | 39356 | 城市的 |
| 137 | reasoning | 138 | 275 | 39649 | 对比 |
| 138 | reasoning | 139 | 277 | 39939 | ， |
| 139 | reasoning | 140 | 279 | 40226 | 我可以 |
| 140 | reasoning | 141 | 281 | 40519 | 查询 |
| 141 | reasoning | 142 | 283 | 40809 | 几个 |
| 142 | reasoning | 143 | 285 | 41099 | 主要 |
| 143 | reasoning | 144 | 287 | 41389 | 城市 |
| 144 | reasoning | 145 | 289 | 41679 | （ |
| 145 | reasoning | 146 | 291 | 41966 | 北京 |
| 146 | reasoning | 147 | 293 | 42256 | 、 |
| 147 | reasoning | 148 | 295 | 42543 | 上海 |
| 148 | reasoning | 149 | 297 | 42833 | 、 |
| 149 | reasoning | 150 | 299 | 43120 | 广州 |
| 150 | reasoning | 151 | 301 | 43410 | ） |
| 151 | reasoning | 152 | 303 | 43697 | 并 |
| 152 | reasoning | 153 | 305 | 43984 | 给出 |
| 153 | reasoning | 154 | 307 | 44274 | 对比 |
| 154 | reasoning | 155 | 309 | 44564 | 。 |
| 155 | reasoning | 156 | 311 | 44851 | \n\n |
| 156 | reasoning | 157 | 313 | 45139 | 让我 |
| 157 | reasoning | 158 | 315 | 45429 | 先 |
| 158 | reasoning | 159 | 317 | 45716 | 查询 |
| 159 | reasoning | 160 | 319 | 46006 | 北京 |
| 160 | reasoning | 161 | 321 | 46296 | 、 |
| 161 | reasoning | 162 | 323 | 46583 | 上海 |
| 162 | reasoning | 163 | 325 | 46873 | 、 |
| 163 | reasoning | 164 | 327 | 47160 | 广州 |
| 164 | reasoning | 165 | 329 | 47450 | 的天气 |
| 165 | reasoning | 166 | 331 | 47743 | ， |
| 166 | reasoning | 167 | 333 | 48030 | 然后 |
| 167 | reasoning | 168 | 335 | 48320 | 提供 |
| 168 | reasoning | 169 | 337 | 48610 | 对比 |
| 169 | reasoning | 170 | 339 | 48900 | 。 |
| 170 | reasoning | 171 | 341 | 49187 | \n |
| 171 | tool-call | 172 | 343 | 49473 | name=get_weather args={ |
| 172 | tool-call | 173 | 345 | 49869 | name=null args=\"city\":\" |
| 173 | tool-call | 174 | 347 | 50196 | name=null args=北京 |
| 174 | tool-call | 175 | 349 | 50518 | name=null args=\" |
| 175 | tool-call | 176 | 351 | 50836 | name=null args=} |
| 176 | tool-call | 177 | 353 | 51153 | name=get_weather args={ |
| 177 | tool-call | 178 | 355 | 51549 | name=null args=\"city\":\" |
| 178 | tool-call | 179 | 357 | 51876 | name=null args=上海 |
| 179 | tool-call | 180 | 359 | 52198 | name=null args=\" |
| 180 | tool-call | 181 | 361 | 52516 | name=null args=} |
| 181 | tool-call | 182 | 363 | 52833 | name=get_weather args={ |
| 182 | tool-call | 183 | 365 | 53229 | name=null args=\"city\":\" |
| 183 | tool-call | 184 | 367 | 53556 | name=null args=广州 |
| 184 | tool-call | 185 | 369 | 53878 | name=null args=\" |
| 185 | tool-call | 186 | 371 | 54196 | name=null args=} |
