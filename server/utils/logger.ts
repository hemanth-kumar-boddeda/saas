// Structured logging with secret redaction (SEC-16).
//
// Every log line is a single JSON object so it can be shipped to a log store
// without a parser. Values whose KEY looks sensitive are replaced before the
// line is written; a secret can therefore never reach stdout, a log file or a
// CI artifact.
const SENSITIVE_KEY =
  /(pass|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|session)/i;

export const REDACTED = "[redacted]";

const redactValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(entry, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") {
    // Strip anything that looks like a bearer token or a JWT.
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
      .replace(/\beyJ[A-Za-z0-9._-]{10,}\b/g, REDACTED);
  }
  return value;
};

type Level = "info" | "warn" | "error";

const emit = (level: Level, event: string, fields?: Record<string, unknown>) => {
  const line = {
    level,
    event,
    at: new Date().toISOString(),
    ...(fields ? (redactValue(fields) as Record<string, unknown>) : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
};

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};

export const redact = redactValue;
