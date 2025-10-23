export function cn(...values) {
  const classes = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value === "string") {
      classes.push(value);
      continue;
    }

    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) {
        classes.push(nested);
      }
      continue;
    }

    if (typeof value === "object") {
      for (const [key, condition] of Object.entries(value)) {
        if (condition) {
          classes.push(key);
        }
      }
    }
  }

  return classes.join(" ");
}
