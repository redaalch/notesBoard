export function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(value) {
  if (!value) return "–";

  const target = value instanceof Date ? value : new Date(value);
  const diff = target.getTime() - Date.now();
  const units = [
    { limit: 60, value: 1, name: "second" },
    { limit: 3600, value: 60, name: "minute" },
    { limit: 86_400, value: 3_600, name: "hour" },
    { limit: 604_800, value: 86_400, name: "day" },
    { limit: 2_629_746, value: 604_800, name: "week" },
    { limit: Infinity, value: 2_629_746, name: "month" },
  ];

  const seconds = Math.round(diff / 1000);
  const absSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  for (const { limit, value, name } of units) {
    if (absSeconds < limit) {
      return formatter.format(Math.round(seconds / value), name);
    }
  }

  return formatter.format(Math.round(seconds / 31_536_000), "year");
}

export function countWords(content = "") {
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}
