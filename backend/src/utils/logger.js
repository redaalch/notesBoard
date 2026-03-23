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
    payload.meta = meta;
  }

  return safeStringify(payload);
};

const logAt = (level) => (message, meta) => {
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
