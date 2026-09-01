# 第 9 章 上手机：移动端瘦客户端（大作业）

> 第一册架构承诺的兑现时刻：大脑零改动，换个语言写壳。动手线：Android 工程
> 零起、Java 手写 SSE、USB 隧道、真机验收。原理线一节"深入一层"：
> **协议解耦为什么经受得住换语言**——以及三个真机翻车的完整解剖。
> 预计 2-3 天，全书最大作业。

---

## 9.1 架构：手机只是个壳

```
┌──────────────┐  USB（adb reverse 隧道）      ┌──────────────────┐
│ 手机壳（Java） │ ───────────────────────────► │ 电脑：大脑+引擎    │
│ 渲染 + HTTP   │    http://127.0.0.1:8081     │ （一行代码不改）    │
└──────────────┘                              └──────────────────┘
```

**瘦客户端原则**：手机只做 UI 与 HTTP；agent 循环、工具、记忆全在电脑——
工具在电脑上（文件、网络），大脑留在工具旁边是正确拓扑。本章验证第 0 章
的承诺：协议解耦让壳语言自由（第 2 章 TS、本章 Java、第 10 章你甚至可以用
curl 当壳）。

## 9.2 工程与环境

| 组件 | 要求 | 验证 |
|---|---|---|
| JDK | 17+ | `java -version` |
| Android SDK | platform 35 + build-tools | SDK Manager |
| adb | platform-tools | `adb devices` 列出真机 |
| 真机 | 开发者模式 + USB 调试授权 | 同上 |

工程骨架直接参照 tagent `apps/mobile`（AGP 8.x + wrapper；国内网络在
settings.gradle 配镜像）。两个新手必卡点：

1. **`usesCleartextTraffic="true"`**：Android 默认禁明文 HTTP。我们连
   `127.0.0.1`（本机隧道）明文是刻意的——**上线任何产品必须 HTTPS**，
   这个开关只许本地调试
2. **依赖只要 appcompat + material**：零第三方 HTTP 库——零依赖原则跨语言成立

## 9.3 LlmClient.java：换语言重写 SSE

第 2 章的 TS 解析器用 Java 重写——**这是检验你真懂了的试金石**（标准库不同，
协议字节完全一样）。核心段（全量见 tagent `LlmClient.java`）：

```java
// 手写 SSE：行缓冲，data: 前缀，[DONE] 收尾——与 TS 版逐行对应
BufferedReader reader = new BufferedReader(
    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
String finishReason = "stop", line;
while ((line = reader.readLine()) != null) {
  if (!line.startsWith("data:")) continue;
  String payload = line.substring(5).trim();
  if (payload.equals("[DONE]")) break;
  JSONObject chunk = new JSONObject(payload);
  JSONObject delta = chunk.getJSONArray("choices").getJSONObject(0)
                         .optJSONObject("delta");
  if (delta == null) continue;
  // org.json 陷阱区：optString 对 JSON null 返回字面量 "null"（9.5 翻车 1）
  String reasoning = jsonText(delta, "reasoning_content");
  if (reasoning == null) reasoning = jsonText(delta, "reasoning");   // 双认
  if (reasoning != null && !reasoning.isEmpty()) listener.onReasoning(reasoning);
  String content = jsonText(delta, "content");
  if (content != null && !content.isEmpty()) listener.onContent(content);
}

/** JSON null 安全取值 */
private static String jsonText(JSONObject obj, String key) {
  return obj.isNull(key) ? null : obj.optString(key, "");
}
```

三处与 TS 的刻意差异（每处都是语言课）：

1. **单线程 executor**：Android 主线程网络操作直接抛
   `NetworkOnMainThreadException`——网络走 executor，回调 `runOnUiThread`
   切回 UI
2. **HttpURLConnection** 而非 OkHttp——零依赖跨语言成立
3. **jsonText 守卫**：org.json 的 optString 遇 JSON null 返回字面量 `"null"`
   ——翻车 1 的根源，预防性封装

请求体带 `chat_template_kwargs.enable_thinking=false`——第 7 章 A/B 结论
（默认关、按需开）在移动端直接落地（省的不只是 token，还有电池）。

## 深入一层：协议解耦为什么经受得住换语言

三个语言、三套标准库，为什么"换壳不改脑"成立？因为**解耦点选在了字节层**：

| 层 | TS 壳 | Java 壳 | 是否随语言变 |
|---|---|---|---|
| HTTP 客户端 | fetch | HttpURLConnection | 变（各语言的门面） |
| 字节流 → 行 | TextDecoder+缓冲 | BufferedReader | 变（API 形态） |
| **行 → 帧 → JSON** | **data: 前缀 + 空行 + JSON.parse** | **完全相同** | **不变（协议本身）** |
| 事件语义 | text-delta/done | onContent/onDone | 不变（我们自己定义的） |

协议（SSE 规范 + OpenAI JSON）定义在**字节序列**上，与任何语言无关；两个壳
各自处理"字节之前的麻烦"（异步模型、UI 线程），字节之后的世界一模一样。
这就是"三件之间只说 HTTP 上的 JSON"的深意——**解耦点越靠近字节，越稳**。
（推论：如果当年我们把 SSE 解析做成一个 npm 包给壳用，Java 壳就享受不到，
解耦就失败了——解析必须每壳手写，这恰是教程坚持手写的理由。）

## 9.4 隧道：adb reverse

手机访问不了电脑的 127.0.0.1？**adb reverse** 把手机端口反向转发到电脑：

```powershell
adb reverse tcp:8081 tcp:8081
adb shell am start -n com.<你>.mobile/.MainActivity
```

构建装机：

```powershell
cd apps/mobile && .\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

**首通验收**：手机发"hello"，电脑引擎日志出现请求并完成
（`total time = 16176 ms / 232 tokens`——真机首通实录）。**服务器日志是
ground truth**，app 界面显示什么是次要证据——9.5 的翻车 2 会让你深刻体会
这句话。

## 9.5 真机翻车三连（本章最有价值的部分）

**翻车 1：屏幕渲染出 `tagent> nullOkay, the user just sent "hello"...`**

`null` 哪来的？org.json 的 `optString("reasoning_content", ...)` 在字段值为
**JSON null** 时返回字符串 `"null"`——llama.cpp 首帧常带
`"reasoning_content":null`，被当真文本渲染。修复即 9.3 的 jsonText 守卫
（isNull 先查）。教训：**每个标准库的"缺省值语义"都要查证——跨语言重写时，
旧直觉会背叛你**（TS 的 optString ?? fallback 语义与 Java 不同）。

**翻车 2：聊到第二条消息，整个 app 卡死，连界面树都读不出**

逐 delta 直接 setText——每次 setText 触发全量重排（relayout），1224 个思考
增量 = O(n²) 重排量，主线程压垮。修复：**增量入缓冲、120ms 批量刷屏、
每批一次 setText**。这个翻车与第 6 章"逐 token 全量重发"同构——
**流式系统的每一层都要批处理**：上游的细粒度（token 级）到某一层必须聚合，
否则被放大成灾难。教训泛化：UI 是流式管线的最后一节，它的"带宽"决定整条
管线的设计。

**翻车 3：自动化验收没法输中文，发送按钮"点了没反应"**

- adb `input text` 只支持 ASCII（中文要走 ADBKeyboard 的 base64 广播）
- 软键盘弹出后按钮坐标**从 y=2628 漂到 y=1689**——写死坐标必翻车，每次用
  uiautomator dump 动态解析控件中心
- 教训：移动端自动化两条铁律——**输入与定位都动态获取**（手测不受影响，
  这层只在自动化验收时需要）

## 9.6 大作业验收（五条全过才算完成）

1. **管道**：手机发消息，电脑引擎日志出现请求并完成（服务器侧证据）
2. **中文多轮**：连续三问往返；第二问的 prompt 处理量远小于全量——
   **cache_n 证明历史在累积**（第 6 章知识在新壳上依然可观测）
3. **思考开关**：关（默认）无灰色思考、答案快；开可见思考——第 7 章 A/B
   的移动端形态
4. **渲染压力**：开关开 + 复杂题，长思考不断流不卡死——批量刷屏在工作
5. **截图存证**：关键界面归档（脱敏意识：别把通知栏通讯录截进去）

## 9.7 自测

- [ ] 能画出移动端请求路径并解释瘦客户端拓扑
- [ ] Java 版与 TS 版 SSE 能逐行互认；三处刻意差异讲得出理由
- [ ] "解耦点在字节层"的表格能复述，且能推出"解析必须每壳手写"
- [ ] 三翻车能复述"症状→根因→修复"；翻车 2 的 O(n²) 账能现场算
- [ ] 五条验收全过且各有证据

**与 tagent 对照**：`apps/mobile` 即完全体（含思考开关 UI 与渲染节流）。
下一章收官：让 agent 自己证明"我做完了"。
