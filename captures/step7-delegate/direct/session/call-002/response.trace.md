# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 182 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 156 |
| 正文 token（text） | 0 |
| tool_call 分片 | 24 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 53387 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 工具 |
| 2 | reasoning | 3 | 5 | 585 | 返回 |
| 3 | reasoning | 4 | 7 | 875 | 了 |
| 4 | reasoning | 5 | 9 | 1162 | 四个 |
| 5 | reasoning | 6 | 11 | 1452 | 城市的 |
| 6 | reasoning | 7 | 13 | 1745 | 天气 |
| 7 | reasoning | 8 | 15 | 2035 | 数据 |
| 8 | reasoning | 9 | 17 | 2325 | ： |
| 9 | reasoning | 10 | 19 | 2612 | \n |
| 10 | reasoning | 11 | 21 | 2898 | - |
| 11 | reasoning | 12 | 23 | 3183 |   |
| 12 | reasoning | 13 | 25 | 3468 | 北京 |
| 13 | reasoning | 14 | 27 | 3758 | ： |
| 14 | reasoning | 15 | 29 | 4045 | 2 |
| 15 | reasoning | 16 | 31 | 4330 | 8 |
| 16 | reasoning | 17 | 33 | 4615 | °C |
| 17 | reasoning | 18 | 35 | 4902 | \n |
| 18 | reasoning | 19 | 37 | 5188 | - |
| 19 | reasoning | 20 | 39 | 5473 |   |
| 20 | reasoning | 21 | 41 | 5758 | 上海 |
| 21 | reasoning | 22 | 43 | 6048 | ： |
| 22 | reasoning | 23 | 45 | 6335 | 3 |
| 23 | reasoning | 24 | 47 | 6620 | 1 |
| 24 | reasoning | 25 | 49 | 6905 | °C |
| 25 | reasoning | 26 | 51 | 7192 | \n |
| 26 | reasoning | 27 | 53 | 7478 | - |
| 27 | reasoning | 28 | 55 | 7763 |   |
| 28 | reasoning | 29 | 57 | 8048 | 广州 |
| 29 | reasoning | 30 | 59 | 8338 | ： |
| 30 | reasoning | 31 | 61 | 8625 | 3 |
| 31 | reasoning | 32 | 63 | 8910 | 3 |
| 32 | reasoning | 33 | 65 | 9195 | °C |
| 33 | reasoning | 34 | 67 | 9482 | \n |
| 34 | reasoning | 35 | 69 | 9768 | - |
| 35 | reasoning | 36 | 71 | 10053 |   |
| 36 | reasoning | 37 | 73 | 10338 | 深圳 |
| 37 | reasoning | 38 | 75 | 10628 | ： |
| 38 | reasoning | 39 | 77 | 10915 | 3 |
| 39 | reasoning | 40 | 79 | 11200 | 2 |
| 40 | reasoning | 41 | 81 | 11485 | °C |
| 41 | reasoning | 42 | 83 | 11772 | \n\n |
| 42 | reasoning | 43 | 85 | 12060 | 现在 |
| 43 | reasoning | 44 | 87 | 12350 | 需要 |
| 44 | reasoning | 45 | 89 | 12640 | 计算 |
| 45 | reasoning | 46 | 91 | 12930 | 两组 |
| 46 | reasoning | 47 | 93 | 13220 | 城市的 |
| 47 | reasoning | 48 | 95 | 13513 | 平均 |
| 48 | reasoning | 49 | 97 | 13803 | 温度 |
| 49 | reasoning | 50 | 99 | 14093 | ： |
| 50 | reasoning | 51 | 101 | 14380 | \n |
| 51 | reasoning | 52 | 103 | 14666 | 第一 |
| 52 | reasoning | 53 | 105 | 14956 | 组 |
| 53 | reasoning | 54 | 107 | 15243 | （ |
| 54 | reasoning | 55 | 109 | 15530 | 北京 |
| 55 | reasoning | 56 | 111 | 15820 | 和上海 |
| 56 | reasoning | 57 | 113 | 16113 | ） |
| 57 | reasoning | 58 | 115 | 16400 | ： |
| 58 | reasoning | 59 | 117 | 16687 | ( |
| 59 | reasoning | 60 | 119 | 16972 | 2 |
| 60 | reasoning | 61 | 121 | 17257 | 8 |
| 61 | reasoning | 62 | 123 | 17542 |  + |
| 62 | reasoning | 63 | 125 | 17828 |   |
| 63 | reasoning | 64 | 127 | 18113 | 3 |
| 64 | reasoning | 65 | 129 | 18398 | 1 |
| 65 | reasoning | 66 | 131 | 18683 | ) |
| 66 | reasoning | 67 | 133 | 18968 |  / |
| 67 | reasoning | 68 | 135 | 19254 |   |
| 68 | reasoning | 69 | 137 | 19539 | 2 |
| 69 | reasoning | 70 | 139 | 19824 |  = |
| 70 | reasoning | 71 | 141 | 20110 |   |
| 71 | reasoning | 72 | 143 | 20395 | 5 |
| 72 | reasoning | 73 | 145 | 20680 | 9 |
| 73 | reasoning | 74 | 147 | 20965 |  / |
| 74 | reasoning | 75 | 149 | 21251 |   |
| 75 | reasoning | 76 | 151 | 21536 | 2 |
| 76 | reasoning | 77 | 153 | 21821 |  = |
| 77 | reasoning | 78 | 155 | 22107 |   |
| 78 | reasoning | 79 | 157 | 22392 | 2 |
| 79 | reasoning | 80 | 159 | 22677 | 9 |
| 80 | reasoning | 81 | 161 | 22962 | . |
| 81 | reasoning | 82 | 163 | 23247 | 5 |
| 82 | reasoning | 83 | 165 | 23532 | °C |
| 83 | reasoning | 84 | 167 | 23819 | \n |
| 84 | reasoning | 85 | 169 | 24105 | 第二 |
| 85 | reasoning | 86 | 171 | 24395 | 组 |
| 86 | reasoning | 87 | 173 | 24682 | （ |
| 87 | reasoning | 88 | 175 | 24969 | 广州 |
| 88 | reasoning | 89 | 177 | 25259 | 和 |
| 89 | reasoning | 90 | 179 | 25546 | 深圳 |
| 90 | reasoning | 91 | 181 | 25836 | ） |
| 91 | reasoning | 92 | 183 | 26123 | ： |
| 92 | reasoning | 93 | 185 | 26410 | ( |
| 93 | reasoning | 94 | 187 | 26695 | 3 |
| 94 | reasoning | 95 | 189 | 26980 | 3 |
| 95 | reasoning | 96 | 191 | 27265 |  + |
| 96 | reasoning | 97 | 193 | 27551 |   |
| 97 | reasoning | 98 | 195 | 27836 | 3 |
| 98 | reasoning | 99 | 197 | 28121 | 2 |
| 99 | reasoning | 100 | 199 | 28406 | ) |
| 100 | reasoning | 101 | 201 | 28691 |  / |
| 101 | reasoning | 102 | 203 | 28977 |   |
| 102 | reasoning | 103 | 205 | 29262 | 2 |
| 103 | reasoning | 104 | 207 | 29547 |  = |
| 104 | reasoning | 105 | 209 | 29833 |   |
| 105 | reasoning | 106 | 211 | 30118 | 6 |
| 106 | reasoning | 107 | 213 | 30403 | 5 |
| 107 | reasoning | 108 | 215 | 30688 |  / |
| 108 | reasoning | 109 | 217 | 30974 |   |
| 109 | reasoning | 110 | 219 | 31259 | 2 |
| 110 | reasoning | 111 | 221 | 31544 |  = |
| 111 | reasoning | 112 | 223 | 31830 |   |
| 112 | reasoning | 113 | 225 | 32115 | 3 |
| 113 | reasoning | 114 | 227 | 32400 | 2 |
| 114 | reasoning | 115 | 229 | 32685 | . |
| 115 | reasoning | 116 | 231 | 32970 | 5 |
| 116 | reasoning | 117 | 233 | 33255 | °C |
| 117 | reasoning | 118 | 235 | 33542 | \n\n |
| 118 | reasoning | 119 | 237 | 33830 | 然后 |
| 119 | reasoning | 120 | 239 | 34120 | 比较 |
| 120 | reasoning | 121 | 241 | 34410 | 哪 |
| 121 | reasoning | 122 | 243 | 34697 | 组 |
| 122 | reasoning | 123 | 245 | 34984 | 更 |
| 123 | reasoning | 124 | 247 | 35271 | 热 |
| 124 | reasoning | 125 | 249 | 35558 | ， |
| 125 | reasoning | 126 | 251 | 35845 | 第二 |
| 126 | reasoning | 127 | 253 | 36135 | 组 |
| 127 | reasoning | 128 | 255 | 36422 | （ |
| 128 | reasoning | 129 | 257 | 36709 | 3 |
| 129 | reasoning | 130 | 259 | 36994 | 2 |
| 130 | reasoning | 131 | 261 | 37279 | . |
| 131 | reasoning | 132 | 263 | 37564 | 5 |
| 132 | reasoning | 133 | 265 | 37849 | °C |
| 133 | reasoning | 134 | 267 | 38136 | ） |
| 134 | reasoning | 135 | 269 | 38423 | 比 |
| 135 | reasoning | 136 | 271 | 38710 | 第一 |
| 136 | reasoning | 137 | 273 | 39000 | 组 |
| 137 | reasoning | 138 | 275 | 39287 | （ |
| 138 | reasoning | 139 | 277 | 39574 | 2 |
| 139 | reasoning | 140 | 279 | 39859 | 9 |
| 140 | reasoning | 141 | 281 | 40144 | . |
| 141 | reasoning | 142 | 283 | 40429 | 5 |
| 142 | reasoning | 143 | 285 | 40714 | °C |
| 143 | reasoning | 144 | 287 | 41001 | ） |
| 144 | reasoning | 145 | 289 | 41288 | 更 |
| 145 | reasoning | 146 | 291 | 41575 | 热 |
| 146 | reasoning | 147 | 293 | 41862 | 。 |
| 147 | reasoning | 148 | 295 | 42149 | \n\n |
| 148 | reasoning | 149 | 297 | 42437 | 让我 |
| 149 | reasoning | 150 | 299 | 42727 | 用 |
| 150 | reasoning | 151 | 301 | 43014 | 计算器 |
| 151 | reasoning | 152 | 303 | 43307 | 来 |
| 152 | reasoning | 153 | 305 | 43594 | 验证 |
| 153 | reasoning | 154 | 307 | 43884 | 一下 |
| 154 | reasoning | 155 | 309 | 44174 | 计算 |
| 155 | reasoning | 156 | 311 | 44464 | 。 |
| 156 | reasoning | 157 | 313 | 44751 | \n |
| 157 | tool-call | 158 | 315 | 45037 | name=calculate args={ |
| 158 | tool-call | 159 | 317 | 45431 | name=null args=\"expression\":\" |
| 159 | tool-call | 160 | 319 | 45764 | name=null args=( |
| 160 | tool-call | 161 | 321 | 46081 | name=null args=2 |
| 161 | tool-call | 162 | 323 | 46398 | name=null args=8 |
| 162 | tool-call | 163 | 325 | 46715 | name=null args=+ |
| 163 | tool-call | 164 | 327 | 47032 | name=null args=3 |
| 164 | tool-call | 165 | 329 | 47349 | name=null args=1 |
| 165 | tool-call | 166 | 331 | 47666 | name=null args=)/ |
| 166 | tool-call | 167 | 333 | 47984 | name=null args=2 |
| 167 | tool-call | 168 | 335 | 48301 | name=null args=\" |
| 168 | tool-call | 169 | 337 | 48619 | name=null args=} |
| 169 | tool-call | 170 | 339 | 48936 | name=calculate args={ |
| 170 | tool-call | 171 | 341 | 49330 | name=null args=\"expression\":\" |
| 171 | tool-call | 172 | 343 | 49663 | name=null args=( |
| 172 | tool-call | 173 | 345 | 49980 | name=null args=3 |
| 173 | tool-call | 174 | 347 | 50297 | name=null args=3 |
| 174 | tool-call | 175 | 349 | 50614 | name=null args=+ |
| 175 | tool-call | 176 | 351 | 50931 | name=null args=3 |
| 176 | tool-call | 177 | 353 | 51248 | name=null args=2 |
| 177 | tool-call | 178 | 355 | 51565 | name=null args=)/ |
| 178 | tool-call | 179 | 357 | 51883 | name=null args=2 |
| 179 | tool-call | 180 | 359 | 52200 | name=null args=\" |
| 180 | tool-call | 181 | 361 | 52518 | name=null args=} |
