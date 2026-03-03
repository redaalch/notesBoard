export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return "–";

  const target = value instanceof Date ? value : new Date(value);
  const diff = target.getTime() - Date.now();
  const units: {
    limit: number;
    value: number;
    name: Intl.RelativeTimeFormatUnit;
  }[] = [
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

export function countWords(content = ""): number {
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}

export function normalizeTag(tag = ""): string {
  return String(tag).trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatTagLabel(tag = ""): string {
  return normalizeTag(tag)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Strip common Markdown syntax from a string so it reads as clean plain text.
 * Handles headings, bold, italic, strikethrough, inline code, links,
 * images, and list markers.
 */
export function stripMarkdown(text = ""): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2") // bold / italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, "")) // inline code
    .replace(/^(\s*)([-*+]|\d+\.)\s/gm, "$1") // list markers
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/\n{3,}/g, "\n\n") // collapse extra blank lines
    .trim();
}
