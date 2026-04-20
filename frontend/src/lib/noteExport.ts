import DOMPurify from "dompurify";

export type ExportFormat = "markdown" | "html" | "pdf";

interface ExportNote {
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

const slugify = (value: string): string => {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "note";
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseHtml = (html: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(
    `<!doctype html><html><body>${html}</body></html>`,
    "text/html",
  );
};

const listIndent = (depth: number): string => "  ".repeat(Math.max(0, depth));

const serializeInline = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) return "";
  const inner = serializeChildrenInline(node);
  switch (node.tagName) {
    case "STRONG":
    case "B":
      return inner ? `**${inner}**` : "";
    case "EM":
    case "I":
      return inner ? `*${inner}*` : "";
    case "S":
    case "DEL":
    case "STRIKE":
      return inner ? `~~${inner}~~` : "";
    case "CODE":
      return inner ? `\`${inner}\`` : "";
    case "A": {
      const href = node.getAttribute("href") ?? "";
      return href ? `[${inner}](${href})` : inner;
    }
    case "BR":
      return "\n";
    case "IMG": {
      const alt = node.getAttribute("alt") ?? "";
      const src = node.getAttribute("src") ?? "";
      return src ? `![${alt}](${src})` : "";
    }
    default:
      return inner;
  }
};

const serializeChildrenInline = (parent: ParentNode): string => {
  const parts: string[] = [];
  parent.childNodes.forEach((child) => parts.push(serializeInline(child)));
  return parts.join("");
};

const serializeList = (
  list: HTMLElement,
  depth: number,
  ordered: boolean,
): string => {
  const lines: string[] = [];
  let index = 1;
  list.childNodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName !== "LI") return;

    const nested: string[] = [];
    const inlineParts: string[] = [];
    let checkbox: boolean | null = null;

    node.childNodes.forEach((child) => {
      if (child instanceof HTMLElement) {
        if (child.tagName === "UL") {
          nested.push(serializeList(child, depth + 1, false));
          return;
        }
        if (child.tagName === "OL") {
          nested.push(serializeList(child, depth + 1, true));
          return;
        }
        if (child.tagName === "INPUT" && child.getAttribute("type") === "checkbox") {
          checkbox = child.hasAttribute("checked");
          return;
        }
        if (child.tagName === "P") {
          inlineParts.push(serializeChildrenInline(child));
          return;
        }
      }
      inlineParts.push(serializeInline(child));
    });

    const taskDataState = node.getAttribute("data-checked");
    if (taskDataState !== null) {
      checkbox = taskDataState === "true";
    }

    const prefix = ordered ? `${index}.` : "-";
    const checkboxStr = checkbox === null ? "" : checkbox ? "[x] " : "[ ] ";
    const content = inlineParts.join("").trim();
    lines.push(`${listIndent(depth)}${prefix} ${checkboxStr}${content}`);
    if (nested.length) lines.push(nested.join("\n"));
    if (ordered) index += 1;
  });
  return lines.join("\n");
};

const serializeBlock = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text.trim() ? text : "";
  }
  if (!(node instanceof HTMLElement)) return "";
  switch (node.tagName) {
    case "H1":
      return `# ${serializeChildrenInline(node).trim()}`;
    case "H2":
      return `## ${serializeChildrenInline(node).trim()}`;
    case "H3":
      return `### ${serializeChildrenInline(node).trim()}`;
    case "H4":
      return `#### ${serializeChildrenInline(node).trim()}`;
    case "H5":
      return `##### ${serializeChildrenInline(node).trim()}`;
    case "H6":
      return `###### ${serializeChildrenInline(node).trim()}`;
    case "P": {
      const inline = serializeChildrenInline(node).trim();
      return inline;
    }
    case "BLOCKQUOTE": {
      const inner = Array.from(node.children)
        .map((child) => serializeBlock(child))
        .filter(Boolean)
        .join("\n\n");
      return inner
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    }
    case "UL":
      return serializeList(node, 0, false);
    case "OL":
      return serializeList(node, 0, true);
    case "PRE": {
      const code = node.querySelector("code");
      const langAttr = code?.className?.match(/language-([\w-]+)/)?.[1] ?? "";
      const text = code?.textContent ?? node.textContent ?? "";
      return `\`\`\`${langAttr}\n${text.replace(/\n$/, "")}\n\`\`\``;
    }
    case "HR":
      return "---";
    case "IMG": {
      const alt = node.getAttribute("alt") ?? "";
      const src = node.getAttribute("src") ?? "";
      return src ? `![${alt}](${src})` : "";
    }
    case "DIV":
    case "SECTION":
    case "ARTICLE": {
      return Array.from(node.childNodes)
        .map(serializeBlock)
        .filter(Boolean)
        .join("\n\n");
    }
    default:
      return serializeChildrenInline(node).trim();
  }
};

export const htmlToMarkdown = (html: string): string => {
  const doc = parseHtml(html);
  const blocks: string[] = [];
  doc.body.childNodes.forEach((child) => {
    const block = serializeBlock(child);
    if (block.trim()) blocks.push(block);
  });
  return blocks.join("\n\n").trim();
};

export const noteToMarkdown = (note: ExportNote): string => {
  const lines: string[] = [];
  lines.push(`# ${note.title || "Untitled"}`);
  if (note.tags?.length) {
    lines.push("");
    lines.push(`Tags: ${note.tags.map((tag) => `#${tag}`).join(" ")}`);
  }
  lines.push("");
  lines.push(htmlToMarkdown(note.content || ""));
  return `${lines.join("\n")}\n`;
};

export const noteToHtml = (note: ExportNote): string => {
  const safeContent = DOMPurify.sanitize(note.content || "");
  const tagsMarkup = note.tags?.length
    ? `<p class="note-tags">${note.tags
        .map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`)
        .join(" ")}</p>`
    : "";
  const updated = note.updatedAt
    ? `<p class="note-meta">Updated ${escapeHtml(new Date(note.updatedAt).toLocaleString())}</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(note.title || "Untitled")}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1.5rem; color: #111; line-height: 1.6; }
  h1, h2, h3, h4 { color: #0f172a; }
  .note-meta { color: #64748b; font-size: 0.875rem; margin: 0.25rem 0 1.5rem; }
  .note-tags { margin: 0.25rem 0 1.5rem; }
  .tag { display: inline-block; padding: 0.125rem 0.5rem; margin-right: 0.25rem; border: 1px solid #cbd5f5; border-radius: 9999px; font-size: 0.75rem; color: #475569; }
  blockquote { border-left: 4px solid #cbd5f5; padding-left: 1rem; color: #334155; margin: 1rem 0; }
  pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
  code { background: #eef2ff; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.95em; }
  pre code { background: transparent; padding: 0; color: inherit; }
  ul, ol { padding-left: 1.5rem; }
  img { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
  @media print { body { margin: 0; padding: 1rem; } }
</style>
</head>
<body>
<h1>${escapeHtml(note.title || "Untitled")}</h1>
${updated}
${tagsMarkup}
${safeContent}
</body>
</html>`;
};

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const printHtml = (html: string): void => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    throw new Error(
      "Pop-up blocked. Please allow pop-ups for this site to export as PDF.",
    );
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  const runPrint = () => {
    printWindow.focus();
    printWindow.print();
  };
  if (printWindow.document.readyState === "complete") {
    setTimeout(runPrint, 150);
  } else {
    printWindow.addEventListener("load", () => setTimeout(runPrint, 150));
  }
};

export const exportNote = (note: ExportNote, format: ExportFormat): void => {
  const base = slugify(note.title || "note");
  if (format === "markdown") {
    const md = noteToMarkdown(note);
    triggerDownload(
      new Blob([md], { type: "text/markdown;charset=utf-8" }),
      `${base}.md`,
    );
    return;
  }
  if (format === "html") {
    const html = noteToHtml(note);
    triggerDownload(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      `${base}.html`,
    );
    return;
  }
  if (format === "pdf") {
    printHtml(noteToHtml(note));
    return;
  }
  throw new Error(`Unsupported export format: ${format}`);
};
