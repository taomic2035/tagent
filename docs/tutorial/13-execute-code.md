# 第 13 章 让 Agent 写代码：v0.14 程序化工具调用

> 你的 agent 查一个城市天气要 2 轮（调工具 + 组织回答），查 5 个城市并比较
> 要 10+ 轮——CPU 上每轮 15 秒，一个简单比较任务要跑 3 分钟。本章教你的
> agent **写一段 JavaScript 脚本批量调用工具**，5 个城市一轮搞定——中间工具
> 结果永不进入上下文。这是 hermes 最独特的设计：**把工具循环搬进代码**。
> 预计 1 天。

---

## 13.1 问题：工具循环的上下文成本

```
你> 查北京、上海、广州、深圳、杭州的天气，比较哪个最热

轮1: 模型调 get_weather(北京)      → 北京结果进 messages
轮2: 模型调 get_weather(上海)      → 上海结果进 messages
轮3: 模型调 get_weather(广州)      → 广州结果进 messages
轮4: 模型调 get_weather(深圳)      → 深圳结果进 messages
轮5: 模型调 get_weather(杭州)      → 杭州结果进 messages
轮6: 模型组织比较结果

总计：6 次推理 + 5 个工具结果占据上下文 → 2 分钟
```

每次推理模型都要重新读一遍整个上下文（包括前面 4 个城市的结果）——
这些中间结果对后续推理**没有价值**（比较在最后一步才发生），但它们
占据了 token、消耗了 prefill 时间。

## 13.2 hermes 的洞察：中间结果是过程，不是知识

> "Lets the LLM write a Python script that calls Hermes tools via RPC,
> **collapsing multi-step tool chains into a single inference turn**."
> "Only the script's stdout is returned to the LLM; **intermediate tool
> results never enter the context window**."
> —— hermes-agent `tools/code_execution_tool.py` 文件头

翻译：与其让模型当"每次只走一步的指挥官"，不如让它当"写好整个作战计划
的将军"——将军不需要看到每一步的战场细节，只需要最终的战报。

## 13.3 动手实现：vm 沙箱 + tools 代理

### 朴素版（先跑通）

```ts
// packages/core/src/industrial.ts（execute_code 部分）
import * as vm from "node:vm";

export function runCodeCell(
  code: string,
  deps: { callTool: (name: string, argsJson: string) => Promise<string> },
): Promise<string> {
  // tools 代理：脚本里调 tools.xxx(...) 经此回到宿主
  const toolsProxy = new Proxy({}, {
    get(_t, name: string) {
      return async (arg: unknown) => {
        return deps.callTool(name, JSON.stringify(arg ?? {}));
      };
    },
  });

  const sandbox = { tools: toolsProxy, console: { log: () => {} } };
  vm.createContext(sandbox); // ← 不加这行会报 "must be a vm.Context"

  // vm 不支持顶层 await → 包一层 async IIFE
  const wrapped = `(async () => {\n${code}\n})()`;
  const result = vm.runInContext(wrapped, sandbox, { timeout: 10_000 });
  return Promise.resolve(result);
}
```

### 撞墙 1：顶层 await

vm 的 `runInContext` **不支持顶层 await**——脚本里写 `await tools.xxx()`
直接语法错误。修法：包一层 async IIFE。

**但注意**：块体 arrow 函数需要显式 `return` 才有返回值——与 hermes
kernel 同语义。在工具 description 里写清楚："必须用 return 返回最终结果"。

### 撞墙 2：变量持久化

第一个 cell 里 `globalThis.acc = 42`，第二个 cell 里 `globalThis.acc + 1`——
结果不是 43 而是 undefined。为什么？

`vm.runInContext` 每次用同一个 sandbox 对象时，**变量确实存活**——但前提
是你用 `vm.createContext(sandbox)` 把它 contextify 了（变成一个真正的
V8 realm），而不是每次都创建新 context。

```ts
// 正确做法：调用方持有 context 对象，跨 cell 传入
const persistentContext: Record<string, unknown> = {};
vm.createContext(persistentContext); // 只 contextify 一次

// 每次 cell 执行时注入新鲜的 tools（权限不持久），但 context 是同一个
persistentContext.tools = toolsProxy;
vm.runInContext(wrapped, persistentContext, { timeout: 10_000 });
```

**这就是"状态存活，权限必须不"的物理基础**——context 是持久的 V8 realm，
但 tools 代理是每次 cell 开始时重新注入的。

## 13.4 CellAuthority：状态活，权限死

hermes 最精彩的安全设计：

> "Interpreter state persists across cells; **RPC authority must not**.
> Each cell installs a fresh authority — so a tool call arriving later
> (a background thread the cell left behind) is refused instead of
> running under a stale identity."

翻译：变量可以跨 cell 存活，但**权限必须每次刷新**——cell 结束后，即使
有残留的异步代码想调工具，也会被拒绝（因为它用的是过期的权限身份）。

```ts
export class CellAuthority {
  private retired = false;
  readonly token: string;

  constructor() {
    this.token = /* 随机 token */;
  }

  retire(): void { this.retired = true; }

  checkAlive(): void {
    if (this.retired) {
      throw new Error(
        "[CellAuthority] cell 已结束，迟到的工具调用被拒绝——" +
        "状态可以跨 cell 存活，权限必须不"
      );
    }
  }
}
```

在 tools 代理里检查：

```ts
get(_t, name: string) {
  return async (arg: unknown) => {
    authority.checkAlive(); // ← 每次调用前检查
    // ... 白名单检查、预算检查、然后回调宿主
    return deps.callTool(name, JSON.stringify(arg));
  };
}
```

cell 结束时 retire：

```ts
return Promise.resolve(result).then((returnValue) => {
  authority.retire(); // ← 结算即 retire，此后任何迟到调用都被拒
  return { returnValue: String(returnValue) };
});
```

### 为什么这很重要

场景：cell 1 启动了一个 `setTimeout`，1 秒后它会调 `tools.get_weather`。
cell 1 已经结束（用户已经看到了结果），但 setTimeout 还活着。如果没有
CellAuthority，这个迟到的调用会**以 cell 1 的权限身份执行**——这可能
绕过 cell 2 更严格的审批（cell 2 可能不允许调这个工具）。

## 13.5 注册为工具：模型怎么用

```ts
// apps/cli/src/builtin-tools/execute-code.ts
export function makeExecuteCodeTool(deps: CodeToolDeps) {
  return {
    name: "execute_code",
    description:
      "编写 JavaScript 脚本，可批量调用 tools.get_weather、tools.calculate 等。" +
      "变量跨调用持久存活。必须用 return 返回最终结果。",
    schema: z.object({
      code: z.string().describe("JS 代码，可调 tools.xxx(...)，须 return"),
    }),
    execute: async (args) => {
      const result = await runCodeCell(args.code, {
        callTool: deps.callTool,
        allowedTools: deps.allowedTools,
        callBudget: 20,
      }, { context: deps.persistentContext });
      return { result: result.returnValue, toolCallsUsed: result.toolCallsUsed };
    },
  };
}
```

工具 description 里的两个关键句（写给模型看的 prompt）：
- **"变量跨调用持久存活"**——模型会利用这个特性（先存中间结果再处理）
- **"必须用 return 返回最终结果"**——vm 块体 arrow 需要显式 return

## 13.6 输出溢出分页：recover-don't-rerun

脚本输出超 4KB 怎么办？hermes 的原则：**截断必给恢复路径**——不要让
模型重跑 90 秒的脚本只为看第 200 行。

```ts
export function spillIfOversized(output: string, limit = 4096) {
  if (output.length <= limit) return { text: output, meta: { spilled: false } };

  // 内容寻址：sha256 前 12 位，相同输出只存一份
  const digest = createHash("sha256").update(output).digest("hex").slice(0, 12);
  const path = `logs/spill/out-${digest}.txt`;
  writeFileSync(path, output);

  // head 40% + tail 60% 窗口（保尾比保头重要——尾部是最新输出）
  const head = Math.floor(limit * 0.4);
  const tail = limit - head;
  const kept = output.slice(0, head) + "\n…[截断]…\n" + output.slice(-tail);

  return {
    text: kept,
    meta: {
      spilled: true, spillPath: path,
      fullBytes: output.length, keptBytes: kept.length,
      // 恢复配方（写给模型看的）
      hint: `全文已溢写至 ${path}——用 read_file 分页取回，不要重跑`,
    },
  };
}
```

截断元数据用**结构化字段**而非文本标记——hermes 的注释：
"A textual truncation marker can be missed or later re-truncated"。
文本标记可能被错过，也可能被下一层截断——结构化字段不会。

## 13.7 terminate 批规则：省掉最后一轮

pi 的发现：模型调完 `submit_final_result` 工具后，循环还会再发一次请求
让模型说"好的我交付了"——**这次调用除了烧 token 什么都没做**。

```ts
export function shouldTerminateByTools(results: string[]): boolean {
  if (results.length === 0) return false;
  return results.every((r) => {
    try { return JSON.parse(r).terminate === true; }
    catch { return false; }
  });
}
```

在你的 loop.ts 里（工具执行回填后）：

```ts
if (shouldTerminateByTools(results)) {
  yield { type: "final", message: /* 工具结果作为终答 */, byTool: true };
  return; // 不再请求下一轮
}
```

**当且仅当批内所有结果都 terminate**——混合批（部分 terminate）忽略，
继续正常循环。pi 的规格原话：

> "否则每个这样的 run 都要**为一个唯一目的是停下来的模型轮买单**。"

## 13.8 真机验收

```
你> 用execute_code一次性查北京和上海天气，比较哪个更热

⚙ execute_code {"code":"const bj = await tools.get_weather('{\"city\":\"北京\"}');
const sh = await tools.get_weather('{\"city\":\"上海\"}');
return bj.tempC > sh.tempC ? '北京更热' : '上海更热';"}

  ↳ {"result":"上海更热","toolCallsUsed":2}

上海更热。
— 完成（2 轮 · prompt 2345 + 生成 543 tokens）—
```

**2 轮搞定原 4+ 轮任务**，`toolCallsUsed: 2` 证明两次工具调用在沙箱内
完成，中间结果没有进入上下文。

## 13.9 测试

```ts
test("execute_code：脚本调工具，只有 return 值出来", async () => {
  const calls: [string, string][] = [];
  const r = await runCodeCell(
    `const a = await tools.get_weather('{"city":"北京"}'); return a;`,
    { callTool: async (n, a) => { calls.push([n, a]); return '{"tempC":28}'; } },
  );
  assert.equal(r.toolCallsUsed, 1);
  assert.ok(r.returnValue.includes("28"));
});

test("CellAuthority：retire 后迟到调用拒绝", () => {
  const auth = new CellAuthority();
  auth.checkAlive(); // 不抛
  auth.retire();
  assert.throws(() => auth.checkAlive(), /拒绝/);
});

test("持久 context：变量跨 cell 存活", async () => {
  const ctx: Record<string, unknown> = {};
  await runCodeCell(`globalThis.acc = 42; return globalThis.acc;`, deps, { context: ctx });
  const r2 = await runCodeCell(`return globalThis.acc + 1;`, deps, { context: ctx });
  assert.equal(r2.returnValue, "43");
});

test("工具白名单：不在名单的直接拒", async () => {
  await assert.rejects(
    runCodeCell(`await tools.forbidden('{}')`,
      { callTool: async () => "{}", allowedTools: ["ok_tool"] }),
    /白名单/,
  );
});
```

## 13.10 搞坏实验

- **去掉 CellAuthority 的 checkAlive**：retire 后 proxy 仍可调——后台 setTimeout
  的迟到调用以过期身份执行了（安全漏洞复现）
- **vm 沙箱不加 createContext**：直接用普通对象 → "must be a vm.Context" 报错
- **allowlist 放全量命令**：批过 `git push` 后 `git push --force` 也放行了——
  过度学习

## 13.11 自测与对照

- [ ] 能解释"中间结果永不进入上下文"为什么比"逐轮往返"省 token
- [ ] 能说出 CellAuthority 解决的具体安全场景（后台线程的迟到调用）
- [ ] 能解释 vm context 的持久化原理（为什么 createContext 之后 globalThis
      赋值能跨 cell 存活）
- [ ] recover-don't-rerun 的三个要素（内容寻址 / head-tail 窗口 / 结构化
      截断元数据）各自解决什么问题
- [ ] terminate 批规则的"当且仅当全部"为什么不是"部分即终止"

**对照答案**：tagent `packages/core/src/industrial.ts` 的 execute_code
部分（~150 行，含 CellAuthority + 白名单 + 预算 + 持久 context +
spill + terminate）+ `apps/cli/src/builtin-tools/execute-code.ts`。

**与 hermes 的差距**：hermes 用真实的持久 kernel 进程（Python 子进程 +
RPC 回调 + 哨兵帧协议 + CellAuthority），我们用 node:vm（同进程沙箱）。
核心语义（状态活权限死 / 白名单 / 预算 / spill）完全一致，但 hermes
支持 Python 生态的全部库。你的 ~150 行是教学等价物。

下一章：你的 agent 现在有 shell 工具、文件工具、代码执行——都很有用，
但一个 `rm -rf ~` 就完了。安全层不是可选项。
