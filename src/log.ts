// Minimal logger that writes to the process streams (avoids stray console.log).

const write = (
  stream: NodeJS.WriteStream,
  level: string,
  message: string,
): void => {
  stream.write(`[${level}] ${message}\n`);
};

export const log = (message: string): void =>
  write(process.stdout, "info", message);

export const error = (message: string): void =>
  write(process.stderr, "error", message);
