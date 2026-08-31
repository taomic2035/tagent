# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 97 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 80 |
| 正文 token（text） | 0 |
| tool_call 分片 | 15 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 28855 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 想 |
| 3 | reasoning | 4 | 7 | 872 | 让我 |
| 4 | reasoning | 5 | 9 | 1162 | 记住 |
| 5 | reasoning | 6 | 11 | 1452 | 一个 |
| 6 | reasoning | 7 | 13 | 1742 | 关于 |
| 7 | reasoning | 8 | 15 | 2032 | 他们的 |
| 8 | reasoning | 9 | 17 | 2325 | 偏好 |
| 9 | reasoning | 10 | 19 | 2615 | 事实 |
| 10 | reasoning | 11 | 21 | 2905 | ： |
| 11 | reasoning | 12 | 23 | 3192 | 他们 |
| 12 | reasoning | 13 | 25 | 3482 | 喜欢 |
| 13 | reasoning | 14 | 27 | 3772 | 喝 |
| 14 | reasoning | 15 | 29 | 4059 | 美式 |
| 15 | reasoning | 16 | 31 | 4349 | 咖啡 |
| 16 | reasoning | 17 | 33 | 4639 | ， |
| 17 | reasoning | 18 | 35 | 4926 | 不加 |
| 18 | reasoning | 19 | 37 | 5216 | 糖 |
| 19 | reasoning | 20 | 39 | 5503 | 。 |
| 20 | reasoning | 21 | 41 | 5790 | 这 |
| 21 | reasoning | 22 | 43 | 6077 | 符合 |
| 22 | reasoning | 23 | 45 | 6367 | remember |
| 23 | reasoning | 24 | 47 | 6659 | 函数的 |
| 24 | reasoning | 25 | 49 | 6952 | 使用 |
| 25 | reasoning | 26 | 51 | 7242 | 场景 |
| 26 | reasoning | 27 | 53 | 7532 | ， |
| 27 | reasoning | 28 | 55 | 7819 | 因为 |
| 28 | reasoning | 29 | 57 | 8109 | 这是 |
| 29 | reasoning | 30 | 59 | 8399 | 用户 |
| 30 | reasoning | 31 | 61 | 8689 | 明确 |
| 31 | reasoning | 32 | 63 | 8979 | 提供的 |
| 32 | reasoning | 33 | 65 | 9272 | 个人 |
| 33 | reasoning | 34 | 67 | 9562 | 偏好 |
| 34 | reasoning | 35 | 69 | 9852 | 信息 |
| 35 | reasoning | 36 | 71 | 10142 | 。 |
| 36 | reasoning | 37 | 73 | 10429 | \n\n |
| 37 | reasoning | 38 | 75 | 10717 | 我需要 |
| 38 | reasoning | 39 | 77 | 11010 | 调用 |
| 39 | reasoning | 40 | 79 | 11300 | remember |
| 40 | reasoning | 41 | 81 | 11592 | 函数 |
| 41 | reasoning | 42 | 83 | 11882 | ， |
| 42 | reasoning | 43 | 85 | 12169 | 将 |
| 43 | reasoning | 44 | 87 | 12456 | 这条 |
| 44 | reasoning | 45 | 89 | 12746 | 偏好 |
| 45 | reasoning | 46 | 91 | 13036 | 信息 |
| 46 | reasoning | 47 | 93 | 13326 | 保存 |
| 47 | reasoning | 48 | 95 | 13616 | 。 |
| 48 | reasoning | 49 | 97 | 13903 | 参数 |
| 49 | reasoning | 50 | 99 | 14193 | 应该是 |
| 50 | reasoning | 51 | 101 | 14486 | ： |
| 51 | reasoning | 52 | 103 | 14773 | \n |
| 52 | reasoning | 53 | 105 | 15059 | - |
| 53 | reasoning | 54 | 107 | 15344 |  content |
| 54 | reasoning | 55 | 109 | 15636 | : |
| 55 | reasoning | 56 | 111 | 15921 |  \" |
| 56 | reasoning | 57 | 113 | 16208 | 我喜欢 |
| 57 | reasoning | 58 | 115 | 16501 | 喝 |
| 58 | reasoning | 59 | 117 | 16788 | 美式 |
| 59 | reasoning | 60 | 119 | 17078 | 咖啡 |
| 60 | reasoning | 61 | 121 | 17368 | ， |
| 61 | reasoning | 62 | 123 | 17655 | 不加 |
| 62 | reasoning | 63 | 125 | 17945 | 糖 |
| 63 | reasoning | 64 | 127 | 18232 | \" |
| 64 | reasoning | 65 | 129 | 18518 | \n |
| 65 | reasoning | 66 | 131 | 18804 | - |
| 66 | reasoning | 67 | 133 | 19089 |  tag |
| 67 | reasoning | 68 | 135 | 19377 | : |
| 68 | reasoning | 69 | 137 | 19662 |   |
| 69 | reasoning | 70 | 139 | 19947 | 可选 |
| 70 | reasoning | 71 | 141 | 20237 | ， |
| 71 | reasoning | 72 | 143 | 20524 | 我 |
| 72 | reasoning | 73 | 145 | 20811 | 可以使用 |
| 73 | reasoning | 74 | 147 | 21107 | \" |
| 74 | reasoning | 75 | 149 | 21393 | pre |
| 75 | reasoning | 76 | 151 | 21680 | ference |
| 76 | reasoning | 77 | 153 | 21971 | \" |
| 77 | reasoning | 78 | 155 | 22257 | 作为 |
| 78 | reasoning | 79 | 157 | 22547 | 分类 |
| 79 | reasoning | 80 | 159 | 22837 | 标签 |
| 80 | reasoning | 81 | 161 | 23127 | \n |
| 81 | tool-call | 82 | 163 | 23413 | name=remember args={ |
| 82 | tool-call | 83 | 165 | 23806 | name=null args=\"content\":\" |
| 83 | tool-call | 84 | 167 | 24136 | name=null args=我喜欢 |
| 84 | tool-call | 85 | 169 | 24461 | name=null args=喝 |
| 85 | tool-call | 86 | 171 | 24780 | name=null args=美式 |
| 86 | tool-call | 87 | 173 | 25102 | name=null args=咖啡 |
| 87 | tool-call | 88 | 175 | 25424 | name=null args=， |
| 88 | tool-call | 89 | 177 | 25743 | name=null args=不加 |
| 89 | tool-call | 90 | 179 | 26065 | name=null args=糖 |
| 90 | tool-call | 91 | 181 | 26384 | name=null args=\" |
| 91 | tool-call | 92 | 183 | 26702 | name=null args=,\"tag\":\" |
| 92 | tool-call | 93 | 185 | 27029 | name=null args=pre |
| 93 | tool-call | 94 | 187 | 27348 | name=null args=ference |
| 94 | tool-call | 95 | 189 | 27671 | name=null args=\" |
| 95 | tool-call | 96 | 191 | 27989 | name=null args=} |
