import type { LogLevel } from "./types.js";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT_KEYS = new Set([
  "authorization",
  "api_key",
  "apikey",
  "secret",
  "password",
  "token",
  "x-api-key",
  "key",
  "credential",
  "cookie",
  "set-cookie",
]);

const SECRET_VALUE_RE =
  /(sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9]{8,}|xai-[A-Za-z0-9]{8,}|hf_[A-Za-z0-9]{8,}|Bearer\s+\S+)/;

export interface LoggerSink {
  write(line: string): void;
}

export class Logger {
  constructor(
    private level: LogLevel = "info",
    private sink: LoggerSink = { write: (line) => console.error(line) },
  ) {}

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  child(): Logger {
    return new Logger(this.level, this.sink);
  }

  debug(msg: string, fields?: Record<string, unknown>): void {
    this.emit("debug", msg, fields);
  }
  info(msg: string, fields?: Record<string, unknown>): void {
    this.emit("info", msg, fields);
  }
  warn(msg: string, fields?: Record<string, unknown>): void {
    this.emit("warn", msg, fields);
  }
  error(msg: string, fields?: Record<string, unknown>): void {
    this.emit("error", msg, fields);
  }

  private emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (LEVELS[level] < LEVELS[this.level]) return;

    const parts = [new Date().toISOString(), level.toUpperCase().padEnd(5), msg];
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        parts.push(`${key}=${redactField(key, value)}`);
      }
    }
    this.sink.write(parts.join(" "));
  }
}

function redactField(key: string, value: unknown): string {
  if (REDACT_KEYS.has(key.toLowerCase())) return "[redacted]";
  if (typeof value === "string") {
    if (SECRET_VALUE_RE.test(value)) return "[redacted]";
    return value;
  }
  if (value === null) return "null";
  if (typeof value === "object") {
    try {
      return redactJson(value);
    } catch {
      return "[unserializable]";
    }
  }
  return String(value);
}

function redactJson(value: unknown, depth = 0): string {
  if (depth > 4) return "[deep]";
  if (Array.isArray(value)) {
    return `[${value.map((v) => (typeof v === "object" ? redactJson(v, depth + 1) : String(v))).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return JSON.stringify(out);
}

export function silentLogger(): Logger {
  return new Logger("error", { write: () => {} });
}
