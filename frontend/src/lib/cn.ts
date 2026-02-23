type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, unknown>;

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value === "string") {
      classes.push(value);
      continue;
    }

    if (typeof value === "number") {
      classes.push(String(value));
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
