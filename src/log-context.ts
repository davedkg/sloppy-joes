// Per-request logging context (Rails-style). An AsyncLocalStorage store carries
// the active request's params + timed events so db.ts and generate.ts can report
// timings without changing their signatures. When no request is active (e.g.
// ensureSchema() at boot) the time helpers run the work and record nothing.

import { AsyncLocalStorage } from "node:async_hooks";

export interface LogEvent {
  readonly category: string; // "DB" | "AI"
  readonly label: string;
  readonly ms: number;
  readonly meta?: string;
}

export interface RequestLog {
  readonly method: string;
  readonly path: string;
  readonly startedAt: string; // HH:MM:SS
  readonly start: number; // performance.now() at request start
  params: Readonly<Record<string, unknown>>;
  events: readonly LogEvent[];
}

const storage = new AsyncLocalStorage<RequestLog>();

export const currentContext = (): RequestLog | undefined => storage.getStore();

export const runWithContext = <T>(seed: RequestLog, fn: () => T): T =>
  storage.run(seed, fn);

// Append an event to the active request (arrays/objects are rebuilt, not mutated).
const record = (event: LogEvent): void => {
  const ctx = storage.getStore();
  if (ctx) ctx.events = [...ctx.events, event];
};

// Merge extra params (e.g. a parsed POST body) into the active request's log.
export const addParams = (params: Record<string, unknown>): void => {
  const ctx = storage.getStore();
  if (ctx) ctx.params = { ...ctx.params, ...params };
};

// Time a synchronous unit of work (better-sqlite3 is sync) and record it.
export const timeSync = <T>(
  category: string,
  label: string,
  fn: () => T,
  meta?: (result: T) => string,
): T => {
  const start = performance.now();
  const result = fn();
  record({
    category,
    label,
    ms: performance.now() - start,
    meta: meta?.(result),
  });
  return result;
};

// Time an async unit of work (the Claude generation call) and record it.
export const time = async <T>(
  category: string,
  label: string,
  fn: () => Promise<T>,
  meta?: (result: T) => string,
): Promise<T> => {
  const start = performance.now();
  const result = await fn();
  record({
    category,
    label,
    ms: performance.now() - start,
    meta: meta?.(result),
  });
  return result;
};
