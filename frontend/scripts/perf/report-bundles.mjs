import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const ASSETS_DIR = path.join(DIST_DIR, "assets");
const REPORTS_DIR = path.join(ROOT, "perf-reports");

const toKb = (bytes) => Number((bytes / 1024).toFixed(2));

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readEntryJsKb() {
  const indexPath = path.join(DIST_DIR, "index.html");
  const html = await fs.readFile(indexPath, "utf8");
  const match = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/i);
  if (!match?.[1]) return null;

  const entryPath = path.join(ASSETS_DIR, match[1]);
  const stats = await fs.stat(entryPath);
  return toKb(stats.size);
}

async function collectAssets() {
  const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== ".js" && ext !== ".css") continue;

    const fullPath = path.join(ASSETS_DIR, entry.name);
    const stats = await fs.stat(fullPath);
    files.push({
      file: entry.name,
      bytes: stats.size,
      kb: toKb(stats.size),
      type: ext.slice(1),
    });
  }

  files.sort((a, b) => b.bytes - a.bytes);
  return files;
}

function summarize(files, entryJsKb) {
  const jsFiles = files.filter((file) => file.type === "js");
  const cssFiles = files.filter((file) => file.type === "css");
  return {
    totalJsKb: toKb(jsFiles.reduce((sum, file) => sum + file.bytes, 0)),
    totalCssKb: toKb(cssFiles.reduce((sum, file) => sum + file.bytes, 0)),
    jsChunkCount: jsFiles.length,
    cssChunkCount: cssFiles.length,
    entryJsKb,
  };
}

function buildMarkdown(report) {
  const topFiles = report.files
    .slice(0, 20)
    .map((file) => `| ${file.file} | ${file.type} | ${file.kb} |`)
    .join("\n");

  return [
    "# Bundle Report",
    "",
    `Generated: ${report.createdAt}`,
    "",
    "## Totals",
    "",
    `- Total JS: ${report.totals.totalJsKb} KB`,
    `- Total CSS: ${report.totals.totalCssKb} KB`,
    `- JS chunks: ${report.totals.jsChunkCount}`,
    `- CSS chunks: ${report.totals.cssChunkCount}`,
    `- Entry JS: ${report.totals.entryJsKb ?? "n/a"} KB`,
    "",
    "## Top Files",
    "",
    "| File | Type | Size (KB) |",
    "| --- | --- | ---: |",
    topFiles || "| n/a | n/a | n/a |",
    "",
  ].join("\n");
}

async function main() {
  await ensureDir(REPORTS_DIR);

  const files = await collectAssets();
  const entryJsKb = await readEntryJsKb();

  const report = {
    createdAt: new Date().toISOString(),
    totals: summarize(files, entryJsKb),
    files,
  };

  const reportJsonPath = path.join(REPORTS_DIR, "bundle-report.json");
  const reportMdPath = path.join(REPORTS_DIR, "bundle-report.md");

  await fs.writeFile(reportJsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(reportMdPath, buildMarkdown(report));

  console.log(`Wrote ${path.relative(ROOT, reportJsonPath)}`);
  console.log(`Wrote ${path.relative(ROOT, reportMdPath)}`);
}

main().catch((error) => {
  console.error("Bundle reporting failed:", error);
  process.exit(1);
});
