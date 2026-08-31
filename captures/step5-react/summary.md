# 驱动方式三方对比：native vs react-text vs react-json（2026-08-31）

> 同模型同温度（0.7）思考关，链式任务 S1~S4 × 3 采样；工具执行复用 apps/cli 内建工具。
> react-json = 单 JSON 步骤 + 受限解码（工具 enum 锁死）；react-text = 经典文本标记协议（零样本系统提示）。

| 维度 | native tool_calls | react-text | react-json |
|---|---|---|---|
| 成功率 | 100% ｜ S1:3/3 S2:3/3 S3:3/3 S4:3/3 | 75% ｜ S1:2/3 S2:3/3 S3:2/3 S4:2/3 | 100% ｜ S1:3/3 S2:3/3 S3:3/3 S4:3/3 |
| 平均轮次 | 2.6 | 2.3 | 3.8 |
| 平均 tokens | 129 | 171 | 224 |
| 平均耗时 | 12269ms | 14689ms | 21437ms |
