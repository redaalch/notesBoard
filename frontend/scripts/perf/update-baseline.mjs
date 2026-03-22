import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUDGETS_PATH = path.join(ROOT, "perf-budgets.json");
const BUNDLE_REPORT_PATH = path.join(
  ROOT,
  "perf-reports",
  "bundle-report.json",
);
const LIGHTHOUSE_SUMMARY_PATH = path.join(
  ROOT,
  "perf-reports",
  "lighthouse-summary.json",
);

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const [budgets, bundle, lighthouse] = await Promise.all([
    readJson(BUDGETS_PATH),
    readJson(BUNDLE_REPORT_PATH),
    readJson(LIGHTHOUSE_SUMMARY_PATH),
  ]);

  const nextBudgets = {
    ...budgets,
    baseline: {
      capturedAt: new Date().toISOString(),
      totalJsKb: bundle?.totals?.totalJsKb ?? null,
      totalCssKb: bundle?.totals?.totalCssKb ?? null,
      entryJsKb: bundle?.totals?.entryJsKb ?? null,
      desktopLighthouseScore: lighthouse?.desktopPerformanceScore ?? null,
      mobileLighthouseScore: lighthouse?.mobilePerformanceScore ?? null,
    },
  };

  await fs.writeFile(BUDGETS_PATH, `${JSON.stringify(nextBudgets, null, 2)}\n`);
  console.log("Updated perf-budgets baseline from latest reports.");
}

main().catch((error) => {
  console.error("Failed to update baseline:", error);
  process.exit(1);
});
