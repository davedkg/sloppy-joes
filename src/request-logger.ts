// Hono middleware that prints a Rails-style block per request:
//
//   Started GET "/todos" at 14:02:11
//     Params: { source: "" }
//     DB  listRecords(todos) — 3 rows (0.4ms)
//     AI  generate (claude-haiku-4-5-20251001) — 1.4KB, 312→890 tok (980ms)
//   Completed 200 OK in 412ms (AI: 980ms | DB: 0.4ms)
//
// DB/AI lines come from the timed events that db.ts and generate.ts record into
// the request context (see log-context.ts). Asset/health noise is skipped.

import type { MiddlewareHandler } from "hono";
import { bold, cyan, dim, green, red } from "./colors";
import { type RequestLog, runWithContext } from "./log-context";

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  204: "No Content",
  303: "See Other",
  403: "Forbidden",
  404: "Not Found",
  500: "Internal Server Error",
};

const clock = (): string => {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const fmtMs = (ms: number): string =>
  ms < 10 ? `${ms.toFixed(1)}ms` : `${Math.round(ms)}ms`;

const fmtParams = (params: Record<string, unknown>): string => {
  const body = Object.entries(params)
    .map(([key, value]) => {
      const raw = typeof value === "string" ? value : JSON.stringify(value);
      const clipped = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
      return `${key}: ${JSON.stringify(clipped)}`;
    })
    .join(", ");
  return `{ ${body} }`;
};

const sumBy = (
  events: readonly RequestLog["events"][number][],
  category: string,
): number =>
  events
    .filter((e) => e.category === category)
    .reduce((total, e) => total + e.ms, 0);

const format = (log: RequestLog, status: number): string => {
  const total = performance.now() - log.start;
  const lines: string[] = [
    `${bold(cyan(`Started ${log.method}`))} ${cyan(`"${log.path}"`)} ${dim(`at ${log.startedAt}`)}`,
  ];

  if (Object.keys(log.params).length > 0) {
    lines.push(dim(`  Params: ${fmtParams(log.params)}`));
  }

  for (const e of log.events) {
    const meta = e.meta ? ` — ${e.meta}` : "";
    lines.push(
      dim(`  ${e.category.padEnd(2)}  ${e.label}${meta} (${fmtMs(e.ms)})`),
    );
  }

  const ai = sumBy(log.events, "AI");
  const db = sumBy(log.events, "DB");
  const parts = [
    ai > 0 ? `AI: ${fmtMs(ai)}` : null,
    db > 0 ? `DB: ${fmtMs(db)}` : null,
  ].filter(Boolean);
  const breakdown = parts.length > 0 ? ` (${parts.join(" | ")})` : "";

  const statusText = STATUS_TEXT[status];
  const head = statusText ? `${status} ${statusText}` : `${status}`;
  const completed = `Completed ${head} in ${fmtMs(total)}${breakdown}`;
  lines.push(status < 400 ? green(completed) : red(completed));

  return `${lines.join("\n")}\n`;
};

const skip = (path: string): boolean =>
  path.startsWith("/_assets/") ||
  path === "/_health" ||
  path === "/favicon.ico";

export const requestLogger: MiddlewareHandler = async (c, next) => {
  if (skip(c.req.path)) return next();

  const seed: RequestLog = {
    method: c.req.method,
    path: c.req.path,
    startedAt: clock(),
    start: performance.now(),
    params: c.req.query(),
    events: [],
  };

  await runWithContext(seed, () => next());

  process.stdout.write(format(seed, c.res.status));
};
