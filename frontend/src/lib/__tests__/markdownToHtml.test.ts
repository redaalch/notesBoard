import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdownToHtml";

// ── Basic markdown rendering ───────────────────────────────────────────────

describe("markdownToHtml — basic rendering", () => {
  it("converts headings (h1–h6)", () => {
    expect(markdownToHtml("# Title")).toBe("<h1>Title</h1>");
    expect(markdownToHtml("## Sub")).toBe("<h2>Sub</h2>");
    expect(markdownToHtml("###### Deep")).toBe("<h6>Deep</h6>");
  });

  it("converts plain text to a paragraph", () => {
    expect(markdownToHtml("Hello world")).toBe("<p>Hello world</p>");
  });

  it("converts bold text", () => {
    expect(markdownToHtml("**bold**")).toBe("<p><strong>bold</strong></p>");
  });

  it("converts italic text", () => {
    expect(markdownToHtml("*italic*")).toBe("<p><em>italic</em></p>");
  });

  it("converts inline code", () => {
    expect(markdownToHtml("`code`")).toBe("<p><code>code</code></p>");
  });

  it("converts unordered list items", () => {
    const md = "- Item A\n- Item B";
    expect(markdownToHtml(md)).toBe(
      "<ul><li><p>Item A</p></li><li><p>Item B</p></li></ul>",
    );
  });

  it("converts ordered list items", () => {
    const md = "1. First\n2. Second";
    expect(markdownToHtml(md)).toBe(
      "<ol><li><p>First</p></li><li><p>Second</p></li></ol>",
    );
  });

  it("converts task list items", () => {
    const md = "- [ ] Todo\n- [x] Done";
    const result = markdownToHtml(md);
    expect(result).toContain('data-type="taskList"');
    expect(result).toContain('data-checked="false"');
    expect(result).toContain('data-checked="true"');
  });

  it("converts blockquotes", () => {
    const md = "> Quote here";
    expect(markdownToHtml(md)).toBe(
      "<blockquote><p>Quote here</p></blockquote>",
    );
  });

  it("converts bold and italic in separate lines", () => {
    const md = "**bold text**\n*italic text*";
    const result = markdownToHtml(md);
    expect(result).toContain("<strong>bold text</strong>");
    expect(result).toContain("<em>italic text</em>");
  });
});

// ── XSS prevention ────────────────────────────────────────────────────────

describe("markdownToHtml — XSS prevention", () => {
  it("escapes <script> tags in plain text", () => {
    const md = '<script>alert("xss")</script>';
    const result = markdownToHtml(md);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes HTML tags inside bold markdown", () => {
    const md = '**<img src=x onerror=alert(1)>**';
    const result = markdownToHtml(md);
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  it("escapes HTML tags inside italic markdown", () => {
    const md = '*<svg onload=alert(1)>*';
    const result = markdownToHtml(md);
    expect(result).not.toContain("<svg");
    expect(result).toContain("&lt;svg");
  });

  it("escapes HTML tags inside inline code", () => {
    const md = '`<script>alert(1)</script>`';
    const result = markdownToHtml(md);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes HTML in heading text", () => {
    const md = '# <img src=x onerror=alert(1)>';
    const result = markdownToHtml(md);
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  it("escapes HTML in list item text", () => {
    const md = '- <script>alert(1)</script>';
    const result = markdownToHtml(md);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes HTML in blockquote text", () => {
    const md = '> <iframe src="evil.com"></iframe>';
    const result = markdownToHtml(md);
    expect(result).not.toContain("<iframe");
    expect(result).toContain("&lt;iframe");
  });

  it("escapes HTML in task list text", () => {
    const md = '- [ ] <script>alert(1)</script>';
    const result = markdownToHtml(md);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes ampersands to prevent entity injection", () => {
    const md = "Tom & Jerry & friends";
    const result = markdownToHtml(md);
    expect(result).toBe("<p>Tom &amp; Jerry &amp; friends</p>");
  });

  it("escapes quotes in plain text", () => {
    const md = 'He said "hello" & \'goodbye\'';
    const result = markdownToHtml(md);
    expect(result).toContain("&quot;hello&quot;");
    expect(result).toContain("&#39;goodbye&#39;");
  });

  it("escapes angle brackets mixed with markdown", () => {
    const md = "Use **<div>** for layout";
    const result = markdownToHtml(md);
    expect(result).toContain("<strong>&lt;div&gt;</strong>");
    expect(result).not.toContain("<div>");
  });
});
