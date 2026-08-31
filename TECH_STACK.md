# 技术选型报告

> 决策日期：2026-08-30 ｜ 状态：已定稿
> 关联文档：[SETUP.md](SETUP.md)（环境搭建与实测数据）

## 一、需求与约束

| # | 需求 | 优先级 |
|---|---|---|
| R1 | Mac（M5/32GB）上先跑起来，服务本地学习 | 当前 |
| R2 | 兼容 Windows / Linux | 近期 |
| R3 | Agent 可运行于 Android 设备 | 远期 |
| R4 | Agent 可运行于鸿蒙（HarmonyOS NEXT）设备 | 远期 |
| R5 | 不使用 agent 框架，手搓核心以学习原理 | 贯穿始终 |

关键约束推导：R3/R4 意味着**agent 大脑代码必须能跑在手机上**；R5 意味着选型的重点是"语言的长期可迁移性"而非"框架生态丰富度"。

## 二、核心架构决策：大脑与推理两层分离

Agent 系统拆成两个重量级完全不同的层：

```
┌─────────────────────────────┐        ┌──────────────────────────┐
│  Agent 大脑（学习的核心）      │  HTTP  │  LLM 推理服务（吃硬件）     │
│  while 循环 + tool_calls 解析 │ ◄────► │  MLX / llama.cpp          │
│  上下文管理，本质是            │ OpenAI │  依赖 GPU + 大内存         │
│  HTTP 客户端 + JSON + 异步     │ 兼容   │  留在 Mac/家用服务器        │
└─────────────────────────────┘        └──────────────────────────┘
```

- **大脑极轻**：不含任何模型权重，只发 HTTP 请求——所以它可以跑在任何设备上，包括手机
- **推理很重**：4B 模型 Q4 也占 2.5GB + 持续算力，手机上受电池与散热限制
- **接口标准化**：两层之间只依赖 OpenAI 兼容协议，任何一层都可以独立替换

这个拆分直接决定了：**选语言时只需要考虑"大脑代码"的跨平台性**，推理引擎按平台各选最优即可。

## 三、编程语言选型

### 3.1 平台覆盖矩阵

| 路线 | Mac/Win/Linux | Android | HarmonyOS NEXT | 换语言次数 |
|---|---|---|---|---|
| **TypeScript** ✅ | Node | React Native | [RNOH](https://juejin.cn/post/7413617657919307826)（OpenHarmony-SIG 官方） | **0 次** |
| Python | Node 级体验 | Chaquopy/Kivy（边缘方案） | 基本无路 | 2 次 |
| Kotlin | JVM 桌面可用 | 官方首选 | KMP 支持早期 | 1 次 |
| Go | 单二进制优秀 | gomobile 一般 | 弱 | 1 次 + UI 另学 |

### 3.2 决策：TypeScript

**理由一：鸿蒙那步几乎免费。** ArkTS 是 TypeScript 的方言/超集，现在写 TS 养成的类型习惯与代码风格直接迁移到鸿蒙原生开发；跨端层面 RNOH 已成熟（2026 年覆盖 300+ 常用组件，[适配路线](https://www.cnblogs.com/jzssuanfa/p/20152111)）。四平台中鸿蒙是其他语言的最大短板，却是 TS 的天然领地。

**理由二：agent 的本质恰好落在 TS 的舒适区。**

| Agent 概念 | TS 表达 |
|---|---|
| 工具定义（JSON Schema） | zod schema 一键生成，类型即文档 |
| Agent 主循环 | async/await，取消/超时语义内建 |
| 流式输出 | SSE + 异步迭代器，手写解析正好学协议 |
| 结构化输出 | 类型系统在编译期兜底 |

**理由三：手搓学习与 TS 不冲突。** 不用 SDK，只用 `fetch` 手写 OpenAI 协议客户端与 SSE 解析——学的是协议本身；TS 侧有 Vercel AI SDK、LangChain.js 等成熟实现可对照阅读。

**被否决方案保留意见（Python）**：Python 的 agent 学习资料最丰富，若目标仅是"最快学会 agent 原理、接受将来移动端重写"，Python 依然是合理选择。否决它的唯一原因是 R3/R4 明确要求跨端，而 Python 在鸿蒙上零路径，重写是确定性的债务。

### 3.3 版本与工具链

- 运行时：Node.js 22+（LTS；不用 Bun，兼容性优先）
- 语言：TypeScript 5.x，`"module": "NodeNext"`
- Schema：zod 4（工具定义 → JSON Schema 自动生成）
- 包管理：pnpm workspace（monorepo）
- 构建：tsc 直出，不引入打包器（core 是纯逻辑，无构建需求）

## 四、推理引擎层：按平台各选最优

| 平台 | 引擎 | 状态 | 说明 |
|---|---|---|---|
| Mac | **MLX**（当前方案） | ✅ 已就绪，实测 38 tok/s | Apple Silicon 专属；llama.cpp 因 Qwen3.5 GDN 架构未优化仅 15 tok/s，实测淘汰（详见 SETUP.md） |
| Windows / Linux | llama.cpp + GGUF | ✅ Windows 已就绪（2026-08-31 迁移实测 CPU 11.6~13 tok/s） | 启动脚本 `start_llm.ps1`；GGUF 与 Mac 同款量化；**agent 代码零改动**（NFR-7 实证，六场景复验收见 docs/ACCEPTANCE.md 附录）；Linux 待测 |
| Android | llama.cpp（NDK 交叉编译） | 远期 | 生态成熟 |
| HarmonyOS | llama.cpp（OHOS NDK 交叉编译） | 远期 | [社区已有 llama.cpp-server-ohos 移植](https://github.com/Aloereed/llama.cpp-server-ohos)；华为官方有[鸿蒙开发板跑 DeepSeek R1 教程](https://developer.huawei.com/consumer/cn/blog/topic/03175975712912026) |

注意：MLX 是 Apple 专属框架，跨平台路线中 llama.cpp/GGUF 是唯一全程通吃的模型格式——这是当初保留 GGUF 备份的原因。

## 五、推荐项目结构

```
tagent/
├── packages/
│   └── core/                # agent 大脑：零运行时依赖（学习核心）
│       ├── src/loop.ts      #   agent 主循环
│       ├── src/tools.ts     #   zod 工具定义 → JSON Schema
│       ├── src/client.ts    #   OpenAI 兼容客户端（手写 SSE 解析）
│       └── src/memory.ts    #   （Step 3）上下文裁剪与记忆
├── apps/
│   ├── cli/                 # 终端 agent（第一个可用产品）
│   ├── mobile/              # （远期）React Native 壳，直接 import core
│   └── harmony/             # （远期）RNOH/ArkTS 壳，直接 import core
├── SETUP.md                 # 环境与实测数据
├── TECH_STACK.md            # 本文档
└── start_llm.sh             # 引擎启动（Mac）
```

结构约束：`packages/core` **禁止引入任何运行时依赖**（zod 除外），保证一份代码从终端跑到手机。UI 壳按平台渐进添加，core 不感知壳的存在。

## 六、风险与重估触发点

| 风险 | 触发点 | 预案 |
|---|---|---|
| RNOH 组件覆盖不足 | 目标 UI 组件不在 300+ 列表内 | 该屏改用 ArkTS 原生写（TS 知识直接迁移） |
| KMP 鸿蒙支持成熟 | JetBrains/华为发布稳定版 | 重新评估 Kotlin 路线（代价：换语言） |
| MLX 支持面扩大 | MLX 官方出跨平台版本 | Linux 端可换回 MLX |
| Qwen3.5 在 llama.cpp 优化完成 | GDN Metal 内核合并 | Mac 端也可统一到 llama.cpp，简化引擎层 |
| 手机端侧跑 4B 体验差 | 实测帧率/发热不达标 | 手机定位降级为瘦客户端（连家用服务器），不影响架构 |

## 七、结论速览

| 决策项 | 结论 |
|---|---|
| 语言 | **TypeScript**（零换语覆盖四平台，ArkTS 同源） |
| Agent 大脑 | `packages/core` 零依赖手搓，HTTP + JSON + async 循环 |
| 第一个产品 | 终端 CLI agent |
| 移动端路线 | Android = React Native；鸿蒙 = RNOH/ArkTS |
| 推理引擎 | Mac=MLX（现在），Win/Linux/移动=llama.cpp+GGUF（远期） |
| 协议 | 两层之间只依赖 OpenAI 兼容 HTTP |
