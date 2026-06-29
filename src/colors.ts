// ANSI color helpers for the dev logger. Color is disabled automatically when
// output is not a TTY (e.g. piped to a file or CI) or when NO_COLOR is set.

const enabled = (): boolean =>
  process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

const wrap = (code: number, text: string): string =>
  enabled() ? `\x1b[${code}m${text}\x1b[0m` : text;

export const green = (text: string): string => wrap(32, text);
export const red = (text: string): string => wrap(31, text);
export const cyan = (text: string): string => wrap(36, text);
export const dim = (text: string): string => wrap(2, text);
export const bold = (text: string): string => wrap(1, text);
