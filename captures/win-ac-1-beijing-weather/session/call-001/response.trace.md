# Token 溯源表（wire 记录器自动生成，确定性输出）

> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 70 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 63 |
| 正文 token（text） | 0 |
| tool_call 分片 | 5 |
| finish_reason | tool_calls |
| 收到 [DONE] | 是 |
| 文件字节数 | 20714 |

## 溯源表（按流生成顺序；内容列超 48 字符截断）

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 2 | 3 | 295 | 用户 |
| 2 | reasoning | 3 | 5 | 585 | 询问 |
| 3 | reasoning | 4 | 7 | 875 | 北京的 |
| 4 | reasoning | 5 | 9 | 1168 | 天气 |
| 5 | reasoning | 6 | 11 | 1458 | 情况 |
| 6 | reasoning | 7 | 13 | 1748 | ， |
| 7 | reasoning | 8 | 15 | 2035 | 我 |
| 8 | reasoning | 9 | 17 | 2322 | 需要使用 |
| 9 | reasoning | 10 | 19 | 2618 |  get |
| 10 | reasoning | 11 | 21 | 2906 | _weather |
| 11 | reasoning | 12 | 23 | 3198 |   |
| 12 | reasoning | 13 | 25 | 3483 | 工具 |
| 13 | reasoning | 14 | 27 | 3773 | 来 |
| 14 | reasoning | 15 | 29 | 4060 | 查询 |
| 15 | reasoning | 16 | 31 | 4350 | 。 |
| 16 | reasoning | 17 | 33 | 4637 | 根据 |
| 17 | reasoning | 18 | 35 | 4927 | 工具 |
| 18 | reasoning | 19 | 37 | 5217 | 描述 |
| 19 | reasoning | 20 | 39 | 5507 | ， |
| 20 | reasoning | 21 | 41 | 5794 | get |
| 21 | reasoning | 22 | 43 | 6081 | _weather |
| 22 | reasoning | 23 | 45 | 6373 |   |
| 23 | reasoning | 24 | 47 | 6658 | 函数 |
| 24 | reasoning | 25 | 49 | 6948 | 支持 |
| 25 | reasoning | 26 | 51 | 7238 | 查询 |
| 26 | reasoning | 27 | 53 | 7528 | 北京 |
| 27 | reasoning | 28 | 55 | 7818 | / |
| 28 | reasoning | 29 | 57 | 8103 | 上海 |
| 29 | reasoning | 30 | 59 | 8393 | / |
| 30 | reasoning | 31 | 61 | 8678 | 广州 |
| 31 | reasoning | 32 | 63 | 8968 | / |
| 32 | reasoning | 33 | 65 | 9253 | 深圳 |
| 33 | reasoning | 34 | 67 | 9543 | / |
| 34 | reasoning | 35 | 69 | 9828 | 杭州 |
| 35 | reasoning | 36 | 71 | 10118 | 的天气 |
| 36 | reasoning | 37 | 73 | 10411 | ， |
| 37 | reasoning | 38 | 75 | 10698 | 参数 |
| 38 | reasoning | 39 | 77 | 10988 | 需要 |
| 39 | reasoning | 40 | 79 | 11278 |  city |
| 40 | reasoning | 41 | 81 | 11567 |   |
| 41 | reasoning | 42 | 83 | 11852 | 字段 |
| 42 | reasoning | 43 | 85 | 12142 | ， |
| 43 | reasoning | 44 | 87 | 12429 | 值为 |
| 44 | reasoning | 45 | 89 | 12719 | 城市 |
| 45 | reasoning | 46 | 91 | 13009 | 名 |
| 46 | reasoning | 47 | 93 | 13296 | 。 |
| 47 | reasoning | 48 | 95 | 13583 | \n\n |
| 48 | reasoning | 49 | 97 | 13871 | 用户 |
| 49 | reasoning | 50 | 99 | 14161 | 问 |
| 50 | reasoning | 51 | 101 | 14448 | 的是 |
| 51 | reasoning | 52 | 103 | 14738 | 北京 |
| 52 | reasoning | 53 | 105 | 15028 | ， |
| 53 | reasoning | 54 | 107 | 15315 | 所以 |
| 54 | reasoning | 55 | 109 | 15605 |  city |
| 55 | reasoning | 56 | 111 | 15894 |   |
| 56 | reasoning | 57 | 113 | 16179 | 参数 |
| 57 | reasoning | 58 | 115 | 16469 | 应该 |
| 58 | reasoning | 59 | 117 | 16759 | 设为 |
| 59 | reasoning | 60 | 119 | 17049 | \" |
| 60 | reasoning | 61 | 121 | 17335 | 北京 |
| 61 | reasoning | 62 | 123 | 17625 | \" |
| 62 | reasoning | 63 | 125 | 17911 | 。 |
| 63 | reasoning | 64 | 127 | 18198 | \n |
| 64 | tool-call | 65 | 129 | 18484 | name=get_weather args={ |
| 65 | tool-call | 66 | 131 | 18880 | name=null args=\"city\":\" |
| 66 | tool-call | 67 | 133 | 19207 | name=null args=北京 |
| 67 | tool-call | 68 | 135 | 19529 | name=null args=\" |
| 68 | tool-call | 69 | 137 | 19847 | name=null args=} |
