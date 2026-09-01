package com.tagent.mobile;

import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

// ============================================================
// tagent 移动瘦客户端（R3 第一步）：聊天管道证明
//
// 手机 = UI + HTTP 客户端；大脑（agent 循环/工具）仍在家庭服务器。
// 渲染与 CLI 同构：思考（reasoning）灰色斜体、正文正常、用户消息加粗。
// 对话历史在内存（JSONArray），无持久化（v1 边界，见 docs/REQUIREMENTS §13）。
// 防过度渲染：token 增量先入缓冲，~120ms 批量刷屏——逐 delta 全量重排是
// O(n²)，千级 thinking 增量能把主线程压到 a11y 都无响应（真机实证）。
// ============================================================
public class MainActivity extends AppCompatActivity {

    private static final int CHUNK_REASONING = 0;
    private static final int CHUNK_CONTENT = 1;
    private static final long FLUSH_MS = 120;

    private final JSONArray history = new JSONArray();
    private final LlmClient client = new LlmClient();
    private final SpannableStringBuilder log = new SpannableStringBuilder();
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final java.util.ArrayList<Object[]> pending = new java.util.ArrayList<>();
    private boolean flushScheduled = false;

    private TextView chatLog;
    private ScrollView scroller;
    private EditText baseUrlInput;
    private EditText modelInput;
    private EditText messageInput;
    private CheckBox thinkingBox;
    private Button sendButton;
    private volatile boolean busy = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        chatLog = findViewById(R.id.chat_log);
        scroller = findViewById(R.id.scroller);
        baseUrlInput = findViewById(R.id.base_url);
        modelInput = findViewById(R.id.model_name);
        messageInput = findViewById(R.id.message);
        thinkingBox = findViewById(R.id.thinking);
        sendButton = findViewById(R.id.send);

        baseUrlInput.setText("http://127.0.0.1:8081/v1");
        modelInput.setText("Qwen3.5-4B");
        appendLine("tagent mobile · 瘦客户端就绪\n先运行 adb reverse tcp:8081 tcp:8081", false);

        sendButton.setOnClickListener(v -> send());
    }

    private void send() {
        if (busy) {
            Toast.makeText(this, "生成中…", Toast.LENGTH_SHORT).show();
            return;
        }
        String text = messageInput.getText().toString().trim();
        if (text.isEmpty()) return;
        messageInput.setText("");

        try {
            JSONObject userMsg = new JSONObject();
            userMsg.put("role", "user");
            userMsg.put("content", text);
            history.put(userMsg);
        } catch (Exception e) {
            return;
        }
        appendUser(text);
        setBusy(true);
        appendAssistantStart();

        final StringBuilder contentBuf = new StringBuilder();
        final boolean thinking = thinkingBox.isChecked();
        client.streamChat(
                baseUrlInput.getText().toString().trim(),
                modelInput.getText().toString().trim(),
                history,
                0.7,
                thinking,
                new LlmClient.Listener() {
                    @Override public void onReasoning(String delta) {
                        enqueue(CHUNK_REASONING, delta);
                    }
                    @Override public void onContent(String delta) {
                        enqueue(CHUNK_CONTENT, delta);
                        contentBuf.append(delta);
                    }
                    @Override public void onDone(String finishReason) {
                        finishAssistant(contentBuf.toString(), finishReason);
                    }
                    @Override public void onError(String message) {
                        appendLine("\n✖ " + message + "\n", true);
                        finishAssistant(null, null);
                    }
                });
    }

    // ---- 对话历史回填（成功/失败都入档，失败也保留 user 轮）----

    private void finishAssistant(String content, String finishReason) {
        runOnUiThread(() -> {
            flushPending(); // 先把缓冲里的尾段刷干净再收尾
            try {
                JSONObject assistant = new JSONObject();
                assistant.put("role", "assistant");
                assistant.put("content", content != null ? content : "");
                history.put(assistant);
            } catch (Exception ignored) {
            }
            appendLineNow("\n", false);
            setBusy(false);
        });
    }

    private void setBusy(boolean b) {
        busy = b;
        sendButton.setEnabled(!b);
        sendButton.setText(b ? "…" : "发送");
    }

    // ---- 渲染（与 CLI ui.ts 同构的视觉语言）----

    private void appendUser(String text) {
        runOnUiThread(() -> {
            append("你> ", bold(true), color(0xFF1B5E20));
            append(text + "\n\n", bold(true), 0);
            render();
        });
    }

    private void appendAssistantStart() {
        runOnUiThread(() -> {
            append("tagent> ", bold(false), color(0xFF0D47A1));
            render();
        });
    }

    private void appendLine(String text, boolean isError) {
        runOnUiThread(() -> appendLineNow(text, isError));
    }

    private void appendLineNow(String text, boolean isError) {
        append(text, null, isError ? color(0xFFB71C1C) : color(0xFF616161));
        render();
    }

    /** token 增量入缓冲（executor 线程调用），按节流节奏批量刷屏 */
    private synchronized void enqueue(int kind, String text) {
        pending.add(new Object[]{kind, text});
        if (!flushScheduled) {
            flushScheduled = true;
            ui.postDelayed(this::flushPending, FLUSH_MS); // postDelayed 回调在主线程
        }
    }

    private synchronized void flushPending() {
        flushScheduled = false;
        if (pending.isEmpty()) return;
        for (Object[] c : pending) {
            int kind = (Integer) c[0];
            String t = (String) c[1];
            if (kind == CHUNK_REASONING) append(t, italic(true), color(0xFF9E9E9E));
            else append(t, null, 0);
        }
        pending.clear();
        render();
    }

    private void append(String text, Object style, int colorSpan) {
        int start = log.length();
        log.append(text);
        if (style instanceof StyleSpan) log.setSpan(style, start, log.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (colorSpan != 0) log.setSpan(new ForegroundColorSpan(colorSpan), start, log.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
    }

    /** 统一出口：一次 setText + 滚动，批量 flush 时每批只付一次重排成本 */
    private void render() {
        chatLog.setText(log);
        scroll();
    }

    private void scroll() {
        scroller.post(() -> scroller.fullScroll(View.FOCUS_DOWN));
    }

    private static StyleSpan bold(boolean on) {
        return new StyleSpan(on ? Typeface.BOLD : Typeface.BOLD); // 标签统一加粗
    }

    private static StyleSpan italic(boolean on) {
        return new StyleSpan(Typeface.ITALIC);
    }

    private static int color(int c) {
        return c;
    }
}
