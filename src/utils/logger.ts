// Tiny zero-dependency structured logger. Emits one JSON object per line with a
// level, timestamp, message, and any bound/contextual fields — so logs are
// greppable/queryable instead of free-form console output. Bind request or job
// context with `logger.child({ ... })`.

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configured = (process.env["LOG_LEVEL"] as Level | undefined) ?? null;
const threshold =
  LEVELS[configured ?? "debug"] ??
  (process.env["NODE_ENV"] === "production" ? LEVELS.info : LEVELS.debug);

type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields: Fields): void {
  if (LEVELS[level] < threshold) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg,
    ...fields,
  });
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(bindings: Fields): Logger;
}

export function createLogger(bindings: Fields = {}): Logger {
  return {
    debug: (msg, fields) => emit("debug", msg, { ...bindings, ...fields }),
    info: (msg, fields) => emit("info", msg, { ...bindings, ...fields }),
    warn: (msg, fields) => emit("warn", msg, { ...bindings, ...fields }),
    error: (msg, fields) => emit("error", msg, { ...bindings, ...fields }),
    child: (more) => createLogger({ ...bindings, ...more }),
  };
}

export const logger = createLogger();
