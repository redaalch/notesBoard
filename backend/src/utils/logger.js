const serialize = (level, message, meta) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (meta && typeof meta === "object" && Object.keys(meta).length > 0) {
    payload.meta = meta;
  }

  return JSON.stringify(payload);
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
  info: logAt("info"),
  warn: logAt("warn"),
  error: logAt("error"),
};

export default logger;
