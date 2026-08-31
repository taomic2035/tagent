# 手敲复现实证：同一任务，脱离 agent 代码人工重走全流程（2026-08-31）

> 复现口径（项目采用）：**任务级复现**——同一任务 agent 跑一遍；人照着存证读流程，
> 手写请求、手工执行工具、手工回填，再走一遍，**任务能完整完成**即可。
> 不要求逐字节（temp=0.7 的采样随机性 + 服务端元数据差异是原理性的，见 PROTOCOL §10）。

## 参照对象

`captures/win-ac-2-calculate/`：agent 真机跑「计算 3.7 乘以 12 再减 8.2 等于多少？」，
两轮（tool_calls → 回填 → 终答 36.2）。

## 人工重走流程（零 agent 代码参与，仅 curl + 心算）

1. **读存证**：从 win-ac-2 的 request.json 抄出 system prompt、问题、两个工具的 JSON Schema
   定义、temperature 0.7——手打字重写为 `step1-request.json`（手写的请求体，非复制文件）
2. **发送**：`curl -N -d @step1-request.json` → 模型返回 tool_calls：
   `calculate {"expression":"3.7*12-8.2"}`（id `i8dSITVmiWNoiNu3ClqtjtQXNCHw49fo`；
   表达式与 agent 轮的 `3.7 * 12 - 8.2` 空格不同——temp 0.7 采样差异，属预期）
3. **手工执行工具**：心算 3.7×12=44.4，44.4−8.2=**36.2**（不运行 calculate 代码）
4. **手工回填**：按协议拼消息——assistant(content:null, tool_calls[新 id]) +
   tool(tool_call_id=新 id, content=成功信封 `{"ok":true,"data":{...,"value":36.2}}`，
   信封格式照 DESIGN §3）→ 手写 `step2-request.json`
5. **发送**：模型终答 `3.7 乘以 12 再减 8.2 等于 36.2。`，finish=stop —— **任务完成 ✅**

## 结论

| 环节 | 依赖 | 结果 |
|---|---|---|
| 请求组装 | 存证（request.json 抄录） | 可手敲复现 |
| 模型行为 | 引擎 + 同参数 | 工具选择一致（calculate），表达式细节有采样差异（预期） |
| 工具执行 | 人（确定性工具：纯算术） | 结果 36.2 与 agent 轮一致 |
| 消息回填 | 协议规则（PROTOCOL §2/§5.2） | id 配对正确即被接受 |
| 任务完成 | — | ✅ 两路径殊途同归 |

**边界如实记录**：若工具非确定性（如真实天气 API）或任务依赖多轮探索性决策，
手敲复现只能保证"流程可走通 + 每步有据"，不保证相同结果——这是复现性的诚实边界。
