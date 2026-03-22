import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, "perf-reports");
const BUDGETS_PATH = path.join(ROOT, "perf-budgets.json");
const BUNDLE_PATH = path.join(REPORTS_DIR, "bundle-report.json");
const LIGHTHOUSE_PATH = path.join(REPORTS_DIR, "lighthouse-summary.json");
const RESULT_PATH = path.join(REPORTS_DIR, "budget-check.json");

const ENFORCE = String(process.env.PERF_ENFORCE || "").toLowerCase() === "true";

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function compareGte(label, actual, expected, failures) {
  const warnings = [];
  if (actual == null) {
    const message = `- ${label}: actual=null >= expected=${expected}`;
    if (ENFORCE) {
      failures.push(message);
    } else {
      warnings.push(message);
    }
    return warnings;
  }

  if (actual < expected) {
    failures.push(`- ${label}: actual=${actual} >= expected=${expected}`);
  }

  return warnings;
}

function compareLte(label, actual, expected, failures) {
  if (actual == null) {
    failures.push(`- ${label}: actual=null <= expected=${expected}`);
    return;
  }

  if (actual > expected) {
    failures.push(`- ${label}: actual=${actual} <= expected=${expected}`);
  }
}

async function main() {
  const [budgets, bundleReport, lighthouseSummary] = await Promise.all([
    readJson(BUDGETS_PATH),
    readJson(BUNDLE_PATH),
    readJson(LIGHTHOUSE_PATH),
  ]);

  const failures = [];
  const warnings = [];

  compareLte(
    "Bundle total JS (KB)",
    bundleReport?.totals?.totalJsKb,
    budgets?.bundle?.maxTotalJsKb,
    failures,
  );
  compareLte(
    "Bundle total CSS (KB)",
    bundleReport?.totals?.totalCssKb,
    budgets?.bundle?.maxTotalCssKb,
    failures,
  );
  compareLte(
    "Bundle entry JS (KB)",
    bundleReport?.totals?.entryJsKb,
    budgets?.bundle?.maxEntryJsKb,
    failures,
  );

  warnings.push(
    ...compareGte(
      "Lighthouse desktop performance",
      lighthouseSummary?.desktopPerformanceScore,
      budgets?.lighthouse?.desktopMinScore,
      failures,
    ),
  );
  warnings.push(
    ...compareGte(
      "Lighthouse mobile performance",
      lighthouseSummary?.mobilePerformanceScore,
      budgets?.lighthouse?.mobileMinScore,
      failures,
    ),
  );

  const result = {
    createdAt: new Date().toISOString(),
    enforce: ENFORCE,
    warnings,
    failures,
  };

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(RESULT_PATH, JSON.stringify(result, null, 2));

  if (failures.length === 0) {
    if (warnings.length) {
      console.warn("Performance budget warnings:");
      for (const warning of warnings) {
        console.warn(warning);
      }
    }
    console.log("Performance budgets passed.");
    return;
  }

  console.warn("Performance budget violations detected:");
  for (const failure of failures) {
    console.warn(failure);
  }

  if (ENFORCE) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Budget check failed:", error);
  process.exit(1);
});
