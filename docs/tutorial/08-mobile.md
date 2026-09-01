# 第 8 章 上手机：移动端瘦客户端（大作业）

> 本章目标：把三件套的第三件换成手机——Android 壳 + Java 零依赖手写 SSE +
> USB 隧道，让手机调用你电脑上的大脑。这是第一册架构承诺的兑现时刻：
> **大脑零改动，换个语言写壳**。预计 2-3 天，是全书最大的作业。
> 三个真机翻车实录与修复全部包含。

---

## 8.1 架构回顾：手机只是个壳

```
┌──────────────┐  Wi-Fi/USB（adb reverse 隧道）  ┌──────────────────┐
│ 手机壳（Java） │ ──────────────────────────────► │ 电脑：大脑+引擎    │
│ 渲染 + HTTP   │      http://127.0.0.1:8081     │ （一行代码不改）    │
└──────────────┘                                 └──────────────────┘
```

**瘦客户端原则**：手机只做 UI 与 HTTP，agent 循环、工具、记忆全在电脑。
手机上唯一的"智能"是渲染。为什么不把大脑搬上手机？——工具在电脑上（文件、
网络），把大脑留 在工具旁边是正确拓扑。这章验证的是 0.2 那句承诺：
协议解耦让壳语言自由（第 2 章 TS，本章 Java，第 9 章你甚至可以用 curl 当壳）。

## 8.2 Android 工程从零建

环境清单（Windows 实操，每项装完验证版本）：

| 组件 | 版本要求 | 验证命令 |
|---|---|---|
| JDK | 17+（示例 21） | `java -version` |
| Android SDK | platform 35 + build-tools | SDK Manager 里勾装 |
| Gradle | 用项目 wrapper 8.x，无需全局安装 | — |
| adb | SDK platform-tools 自带 | `adb version` |
| 真机 | 开发者模式 + USB 调试已授权 | `adb devices` 列出设备 |

工程骨架（Android 项目的最小集，全部可抄自参考实现 `apps/mobile`）：

```
apps/mobile/
├── settings.gradle        # 仓库镜像 + rootProject.name
├── build.gradle           # AGP 8.x
├── gradle.properties      # android.useAndroidX=true
├── gradle/wrapper/...     # gradle wrapper
└── app/
    ├── build.gradle       # applicationId com.<你>.mobile；依赖仅 appcompat+material
    └── src/main/
        ├── AndroidManifest.xml   # INTERNET 权限 + usesCleartextTraffic="true"（见下）
        ├── java/com/<你>/mobile/
        │   ├── LlmClient.java    # 手写 SSE（本章核心）
        │   └── MainActivity.java # 聊天壳
        └── res/layout/activity_main.xml
```

两个新手必卡的配置：

1. **`usesCleartextTraffic="true"`**：Android 默认禁止明文 HTTP。我们连的是
   `http://127.0.0.1`（本机隧道），明文是刻意的——但**上线任何真实产品都必须
   HTTPS**，这个开关只许在本地调试用
2. **国内网络下 gradle 要配镜像**（腾讯/阿里 maven），settings.gradle 的
   `pluginManagement` 与 `dependencyResolutionManagement` 各配一份

## 8.3 LlmClient.java：用 Java 再手写一遍 SSE

第 2 章的 TS 解析器，换 Java 重写——**这是检验你真懂了的试金石**（两个语言
标准库不同，协议字节完全一样）：

```java
public class LlmClient {
  public interface Listener {
    void onReasoning(String delta);
    void onContent(String delta);
    void onDone(String finishReason);
    void onError(String message);
  }

  private final ExecutorService executor = Executors.newSingleThreadExecutor();

  public void streamChat(String baseUrl, String model, String messagesJson,
                         boolean thinking, Listener listener) {
    executor.execute(() -> {
      HttpURLConnection conn = null;
      try {
        JSONObject body = new JSONObject();
        body.put("model", model);
        body.put("messages", new JSONArray(messagesJson));
        body.put("temperature", 0.7);
        body.put("stream", true);
        if (!thinking) {                       // 防过度思考：默认关（第 6 章 A/B 的结论直接落地）
          JSONObject kwargs = new JSONObject();
          kwargs.put("enable_thinking", false);
          body.put("chat_template_kwargs", kwargs);
        }

        conn = (HttpURLConnection) new URL(baseUrl.replaceAll("/+$", "") + "/chat/completions")
            .openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(10_000);
        conn.setReadTimeout(600_000);          // CPU 推理慢，读超时要宽

        try (OutputStream os = conn.getOutputStream()) {
          os.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }

        // ---- 手写 SSE：行缓冲，data: 前缀，[DONE] 收尾 ——与 TS 版逐行对应 ----
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
          // org.json 陷阱区：optString 对 JSON null 返回字面量 "null"（见 8.5 翻车 1）
          String reasoning = jsonText(delta, "reasoning_content");
          if (reasoning == null) reasoning = jsonText(delta, "reasoning");   // 双认
          if (reasoning != null && !reasoning.isEmpty()) listener.onReasoning(reasoning);
          String content = jsonText(delta, "content");
          if (content != null && !content.isEmpty()) listener.onContent(content);
        }
        listener.onDone(finishReason);
      } catch (Exception e) {
        listener.onError(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
      } finally {
        if (conn != null) conn.disconnect();
      }
    });
  }

  /** JSON null 安全取值：org.json 的 optString 会把 JSON null 变成 "null" 字符串 */
  private static String jsonText(JSONObject obj, String key) {
    return obj.isNull(key) ? null : obj.optString(key, "");
  }
}
```

与 TS 版的三处刻意差异，每处都是语言课：

1. **单线程 executor**：Java 侧网络不许跑在 UI 线程（Android 主线程网络操作
   直接抛 `NetworkOnMainThreadException`），回调再 `runOnUiThread` 切回 UI 更新
2. **HttpURLConnection** 而非 OkHttp——零第三方依赖原则在 Java 侧同样成立
3. **jsonText 守卫**：org.json 的 `optString` 遇到 JSON null 会返回字面量
   `"null"`——这是本章第一个翻车的根源，预防性封装

## 8.4 隧道与首通：adb reverse

手机访问不了你电脑的 127.0.0.1？**adb reverse** 把手机的端口"反向转发"到电脑：

```powershell
adb reverse tcp:8081 tcp:8081     # 手机上 127.0.0.1:8081 = 电脑的 8081
adb shell "curl -s http://127.0.0.1:8081/health"   # 手机侧自检（部分设备无 curl，用 app 内建按钮）
```

> 没有 USB 时可用 `adb reverse tcp:8081 tcp:8081` 保持 + 无线调试；最朴素的
> 替代是手机与电脑同 Wi-Fi，引擎 `--host 0.0.0.0` + 手机连电脑局域网 IP——
> 但明文 HTTP 暴露局域网，只限可信网络。

构建、装机、启动：

```powershell
cd apps/mobile
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.<你>.mobile/.MainActivity
```

**首通验收**：手机输入"hello"，电脑 llama.cpp 日志出现对应请求并完成
（`total time = ... ms / N tokens`）——服务器日志是 ground truth，
app 界面显示什么反而是次要证据（下一节你就知道为什么）。

## 8.5 真机翻车实录三连（本章最有价值的部分）

**翻车 1：屏幕上渲染出 `tagent> nullOkay, the user just sent "hello"...`**

`null` 哪来的？——org.json 的 `optString("reasoning_content", ...)` 在字段值为
JSON null 时返回字符串 `"null"`，被当真文本渲染（llama.cpp 首帧常带
`"reasoning_content":null`）。修复即 8.3 的 `jsonText` 守卫（isNull 先查）。
教训：**每个库的"缺省值语义"都要查文档实测，跨语言重写时旧直觉会背叛你**。

**翻车 2：聊到第二条消息，整个 app 卡死，uiautomator 都读不到界面**

逐 delta 直接 `setText` 渲染——每次 setText 触发全量重排（relayout），
1224 个思考增量 = O(n²) 的重排量，主线程被压垮。修复：**增量入缓冲、
120ms 批量刷屏、每批一次 setText**。教训与第 5 章"逐 token 全量重发"同构：
**流式系统的每一层都要批处理，否则上游的细粒度会被某一层放大成灾难**。

**翻车 3：自动化测试没法输中文，发送按钮"点了没反应"**

- adb `input text` 只支持 ASCII；空格转义 `%s` 在部分设备失效——中文要走
  ADBKeyboard 的 base64 广播（`am broadcast -a ADB_INPUT_B64 --es msg <b64>`）
- 软键盘弹出后按钮坐标**从 y=2628 漂到 y=1689**——写死坐标必翻车，
  每次用 uiautomator dump 动态解析控件中心
- 教训：移动端自动化的两条铁律——**输入与定位都要动态获取**；
  （对教程读者：这层只在自动化验收时需要，手测不受影响）

## 8.6 大作业验收（五条全过才算完成）

1. **管道**：手机发消息，电脑引擎日志出现请求并完成（服务器侧证据）
2. **中文多轮**：连续三问（查天气/算数/介绍自己）都往返；第二问的 prompt
   处理 token 数远小于全量——KV cache 前缀命中，证明历史在累积（第 5 章知识
   在新壳上依然可观察）
3. **思考开关**：开关关（默认）时无灰色思考文本、答案快；开时可见思考——
   请求级开关在 Java 侧同样有效
4. **渲染压力**：让它输出一段长思考（开关开 + 复杂题），app 不卡死——
   批量刷屏在工作
5. **截图存证**：关键界面截图归档（本地保存即可，含脱敏意识——别把通讯录
   通知栏截进去）

## 8.7 自测清单

- [ ] 能画出移动端的请求路径（手机 app → adb reverse → 电脑 8081），
      并解释瘦客户端拓扑为什么把大脑留在电脑
- [ ] Java 版 SSE 与 TS 版能逐行互认；能说出三处刻意差异及原因
- [ ] 三个翻车都能复述"症状→根因→修复"，特别是 null 字面量与 O(n²) 渲染
- [ ] 五条验收全过且各有证据；理解"服务器日志是 ground truth"这句话
- [ ] 明白 `usesCleartextTraffic` 只许本地调试用的原因

## 8.8 延伸练习（不做不强求）

- 把思考开关换成三态（关/开/自动按问题复杂度）——客户端启发式
- 会话持久化：onSaveInstanceState 存 messages JSON
- 用 Kotlin/Compose 重写壳，对比与 Java 的代码量——再次验证协议解耦
