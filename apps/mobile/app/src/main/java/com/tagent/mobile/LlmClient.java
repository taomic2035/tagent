package com.tagent.mobile;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// ============================================================
// tagent 移动瘦客户端的 LLM 通道（R3 第一步）
//
// 零外部依赖：HttpURLConnection + Android 内置 org.json。
// 手写 SSE 行解析（与 packages/core/src/client.ts 同构——壳语言不同，
// 协议字节相同：data: {...} 帧、[DONE] 收尾、reasoning/content 双认）。
// 大脑仍在家庭服务器（llama.cpp），手机只做 HTTP 客户端与渲染。
// ============================================================
public class LlmClient {

    public interface Listener {
        void onReasoning(String delta);
        void onContent(String delta);
        void onDone(String finishReason);
        void onError(String message);
    }

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public void streamChat(String baseUrl, String model, JSONArray messages, double temperature,
                           boolean thinking, Listener listener) {
        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                JSONObject body = new JSONObject();
                body.put("model", model);
                body.put("messages", messages);
                body.put("temperature", temperature);
                body.put("stream", true);
                // 防过度思考：请求级关闭思考（弱模型+CPU 推理时，思考烧 token 烧时间
                // 且常不收敛——Step4/8 实证 4B 82% 发散；开关交还用户）
                if (!thinking) {
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
                conn.setReadTimeout(600_000); // CPU 推理慢，读超时要宽

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                if (code != 200) {
                    BufferedReader err = new BufferedReader(new InputStreamReader(
                            code >= 400 ? conn.getErrorStream() : conn.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String l;
                    while ((l = err.readLine()) != null) sb.append(l);
                    listener.onError("HTTP " + code + ": " + sb.substring(0, Math.min(sb.length(), 200)));
                    return;
                }

                // ---- 手写 SSE：行缓冲，data: 前缀，[DONE] 收尾 ----
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                String finishReason = "stop";
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.startsWith("data:")) continue; // 空行/注释帧跳过
                    String payload = line.substring(5).trim();
                    if (payload.equals("[DONE]")) break;
                    JSONObject chunk = new JSONObject(payload);
                    JSONArray choices = chunk.optJSONArray("choices");
                    if (choices == null || choices.length() == 0) continue;
                    JSONObject delta = choices.getJSONObject(0).optJSONObject("delta");
                    if (delta == null) delta = new JSONObject();
                    Object frRaw = choices.getJSONObject(0).opt("finish_reason");
                    if (frRaw instanceof String) finishReason = (String) frRaw;

                    // org.json 的 optString 对 JSON null 值返回字面量 "null"
                    // （llama.cpp 首帧常带 "reasoning_content":null / "content":null），
                    // 必须先 isNull 排除，否则界面上会渲染出 "null" 三个字母
                    String reasoning = jsonText(delta, "reasoning_content");
                    if (reasoning == null) reasoning = jsonText(delta, "reasoning");
                    if (reasoning == null) reasoning = "";
                    if (!reasoning.isEmpty()) listener.onReasoning(reasoning);
                    String content = jsonText(delta, "content");
                    if (content == null) content = "";
                    if (!content.isEmpty()) listener.onContent(content);
                }
                listener.onDone(finishReason);
            } catch (Exception e) {
                listener.onError(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    /** JSON null 安全取字符串：key 缺失或值为 JSON null 时返回 null，否则返回其字符串值 */
    private static String jsonText(JSONObject obj, String key) {
        return obj.isNull(key) ? null : obj.optString(key, "");
    }
}
