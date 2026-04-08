// #2 — Log level filtering: set LOG_LEVEL=warn in production to suppress
// debug/info noise. Default is "debug" (emit everything) for development.
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL =
  LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ??
  (process.env.NODE_ENV === "production" ? LOG_LEVELS.info : LOG_LEVELS.debug);

// #7 — Truncate deep string values so a single oversized meta field cannot
// produce megabyte-long log lines that overwhelm log aggregators.
const MAX_STRING_VALUE = 500;
const MAX_ARRAY_ITEMS = 20;

const truncate = (value, depth = 0) => {
  if (depth > 4) return "[deep]";
  if (typeof value === "string") {
    return value.length > MAX_STRING_VALUE
      ? `${value.slice(0, MAX_STRING_VALUE)}…`
      : value;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => truncate(v, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`…+${value.length - MAX_ARRAY_ITEMS} more`);
    return items;
  }
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = truncate(v, depth + 1);
    }
    return result;
  }
  return value;
};

const safeStringify = (value) => {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object") {
      if (seen.has(val)) return "[Circular]";
      seen.add(val);
    }
    return val;
  });
};

const serialize = (level, message, meta) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (meta && typeof meta === "object" && Object.keys(meta).length > 0) {
    // #7 — Truncate before stringifying, not after, so JSON stays valid.
    payload.meta = truncate(meta);
  }

  return safeStringify(payload);
};

const logAt = (level) => (message, meta) => {
  // #2 — Drop messages below the configured level.
  if ((LOG_LEVELS[level] ?? 0) < CURRENT_LEVEL) return;

  const serialized = serialize(level, message, meta);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

const logger = {
  debug: logAt("debug"),
  info: logAt("info"),
  warn: logAt("warn"),
  error: logAt("error"),
};

export default logger;
