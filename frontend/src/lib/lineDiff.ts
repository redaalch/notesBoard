export type DiffOp = "add" | "remove" | "same";

export interface DiffLine {
  op: DiffOp;
  line: string;
}

export interface DiffStats {
  added: number;
  removed: number;
}

const splitLines = (text: string): string[] =>
  text.length === 0 ? [] : text.split(/\r?\n/);

/**
 * Myers-style LCS line diff. Returns an array of operations in order.
 * Good enough for short/medium notes; if both sides exceed 2,000 lines the
 * input is truncated to keep the worst case bounded.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const MAX_LINES = 2_000;
  const oldLines = splitLines(oldText).slice(0, MAX_LINES);
  const newLines = splitLines(newText).slice(0, MAX_LINES);

  const n = oldLines.length;
  const m = newLines.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      result.push({ op: "same", line: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ op: "remove", line: oldLines[i] });
      i++;
    } else {
      result.push({ op: "add", line: newLines[j] });
      j++;
    }
  }
  while (i < n) result.push({ op: "remove", line: oldLines[i++] });
  while (j < m) result.push({ op: "add", line: newLines[j++] });

  return result;
}

export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.op === "add") added++;
    else if (line.op === "remove") removed++;
  }
  return { added, removed };
}

/**
 * Strip HTML tags for diffing plaintext representations of rich content.
 * Cheap and safe: runs entirely in the browser on a detached DOM tree.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  const container = document.createElement("div");
  container.innerHTML = html;
  container
    .querySelectorAll("script, style")
    .forEach((node) => node.remove());
  container
    .querySelectorAll("br")
    .forEach((node) => node.replaceWith("\n"));
  container.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, pre, blockquote").forEach((node) => {
    node.insertAdjacentText("beforeend", "\n");
  });
  return (container.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
