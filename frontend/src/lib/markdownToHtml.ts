/**
 * markdownToHtml — Lightweight Markdown-to-HTML converter for note templates.
 *
 * Handles the subset used by templates: headings, lists, task lists,
 * blockquotes, bold/italic, and paragraph breaks. Not a full parser.
 */

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTaskList = false;
  let inBlockquote = false;

  const closeList = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
    if (inTaskList) {
      out.push("</ul>");
      inTaskList = false;
    }
    if (inBlockquote) {
      out.push("</blockquote>");
      inBlockquote = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Empty line — close open blocks
    if (!line.trim()) {
      closeList();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Task list items: - [ ] or - [x]
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      if (!inTaskList) {
        closeList();
        out.push('<ul data-type="taskList">');
        inTaskList = true;
      }
      const checked = taskMatch[1] !== " ";
      out.push(
        `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? " checked" : ""}><span></span></label><div><p>${inlineFormat(taskMatch[2])}</p></div></li>`,
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (inTaskList || inOl) closeList();
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li><p>${inlineFormat(ulMatch[1])}</p></li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inTaskList || inUl) closeList();
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li><p>${inlineFormat(olMatch[1])}</p></li>`);
      continue;
    }

    // Blockquote
    const bqMatch = line.match(/^>\s*(.*)$/);
    if (bqMatch) {
      if (!inBlockquote) {
        closeList();
        out.push("<blockquote>");
        inBlockquote = true;
      }
      out.push(`<p>${inlineFormat(bqMatch[1])}</p>`);
      continue;
    }

    // Regular paragraph
    closeList();
    out.push(`<p>${inlineFormat(line)}</p>`);
  }

  closeList();
  return out.join("");
}

export default markdownToHtml;
