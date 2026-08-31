# Token 溯源表：response

> 由 scripts/trace-sse.mjs 自动生成（确定性输出，无时间戳）。
> 溯源公式：seq → trace.jsonl 同行 → (line, byte) 定位 response.sse 原始字节。

## 统计

| 指标 | 值 |
|---|---|
| 数据帧总数 | 46 |
| keepalive 注释帧 | 0 |
| 思考 token（reasoning） | 22 |
| 正文 token（text） | 23 |
| tool_call 分片 | 0 |
| finish_reason | stop |
| 收到 [DONE] | 是 |
| 文件字节数 | 2875 |

## 溯源表（按流生成顺序）

完整内容见 response.trace.jsonl；本表内容列超 48 字符截断显示。

| seq | 类型 | 帧 | 行 | 字节偏移 | 内容 |
|---|---|---|---|---|---|
| 1 | reasoning | 1 | 1 | 0 | 工具 |
| 2 | reasoning | 2 | 3 | 64 | 调用 |
| 3 | reasoning | 3 | 5 | 128 | 失败 |
| 4 | reasoning | 4 | 7 | 192 | ， |
| 5 | reasoning | 5 | 9 | 253 | 提示 |
| 6 | reasoning | 6 | 11 | 317 | 瞬时 |
| 7 | reasoning | 7 | 13 | 381 | 故障 |
| 8 | reasoning | 8 | 15 | 445 | 。 |
| 9 | reasoning | 9 | 17 | 506 | 根据 |
| 10 | reasoning | 10 | 19 | 570 | 规则 |
| 11 | reasoning | 11 | 21 | 634 | ， |
| 12 | reasoning | 12 | 23 | 695 | 工具 |
| 13 | reasoning | 13 | 25 | 759 | 返回 |
| 14 | reasoning | 14 | 27 | 823 | 错误 |
| 15 | reasoning | 15 | 29 | 887 | 时 |
| 16 | reasoning | 16 | 31 | 948 | ， |
| 17 | reasoning | 17 | 33 | 1009 | 向 |
| 18 | reasoning | 18 | 35 | 1070 | 用户 |
| 19 | reasoning | 19 | 37 | 1134 | 如实 |
| 20 | reasoning | 20 | 39 | 1198 | 说明 |
| 21 | reasoning | 21 | 41 | 1262 | 。 |
| 22 | reasoning | 22 | 43 | 1323 | \n |
| 23 | text | 23 | 45 | 1383 | 很 |
| 24 | text | 24 | 47 | 1442 | 抱歉 |
| 25 | text | 25 | 49 | 1504 | ， |
| 26 | text | 26 | 51 | 1563 | 我 |
| 27 | text | 27 | 53 | 1622 | 暂时 |
| 28 | text | 28 | 55 | 1684 | 无法 |
| 29 | text | 29 | 57 | 1746 | 获取 |
| 30 | text | 30 | 59 | 1808 | 北京的 |
| 31 | text | 31 | 61 | 1873 | 天气 |
| 32 | text | 32 | 63 | 1935 | 信息 |
| 33 | text | 33 | 65 | 1997 | ， |
| 34 | text | 34 | 67 | 2056 | 因为 |
| 35 | text | 35 | 69 | 2118 | 系统 |
| 36 | text | 36 | 71 | 2180 | 正在 |
| 37 | text | 37 | 73 | 2242 | 经历 |
| 38 | text | 38 | 75 | 2304 | 一次 |
| 39 | text | 39 | 77 | 2366 | 短暂的 |
| 40 | text | 40 | 79 | 2431 | 故障 |
| 41 | text | 41 | 81 | 2493 | 。 |
| 42 | text | 42 | 83 | 2552 | 请稍 |
| 43 | text | 43 | 85 | 2614 | 后再 |
| 44 | text | 44 | 87 | 2676 | 试 |
| 45 | text | 45 | 89 | 2735 | 。 |
