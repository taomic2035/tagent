// ============================================================
// 终端渲染的 ANSI 工具（手写，不引入 chalk——学习项目原则）
// 终端不支持 ANSI 时降级为原样输出（Windows 老终端友好，NFR-3）
// ============================================================

const supported =
  process.env.NO_COLOR === undefined && process.stdout.isTTY;

const wrap =
  (code: string) =>
  (s: string): string =>
    supported ? `\x1b[${code}m${s}\x1b[0m` : s;

export const paint = {
  dim: wrap("2"),
  bold: wrap("1"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  cyan: wrap("36"),
};

/** 流式输出：不换行写（token 级实时渲染） */
export const writeChunk = (s: string): void => {
  process.stdout.write(s);
};

export const writeLine = (s = ""): void => {
  process.stdout.write(s + "\n");
};
