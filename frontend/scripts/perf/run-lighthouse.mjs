import { promises as fs } from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, "perf-reports");
const PREVIEW_PORT = Number(process.env.LH_PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;
const STRICT =
  String(process.env.LIGHTHOUSE_STRICT || "").toLowerCase() === "true";

const CHROME_CANDIDATE_PATHS = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

const LIGHTHOUSE_FLAG_PROFILES = [
  // Preferred profile: keep GPU/software rasterization available to avoid NO_FCP on some CI hosts.
  "--headless=new --no-sandbox --disable-dev-shm-usage --window-size=1365,1024 --no-first-run --no-default-browser-check --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling",
  // Fallback profile with GPU disabled for environments where GPU init crashes.
  "--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu --window-size=1365,1024 --no-first-run --no-default-browser-check --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling",
  // Legacy headless fallback.
  "--headless --no-sandbox --disable-dev-shm-usage --window-size=1365,1024 --no-first-run --no-default-browser-check --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling",
];

if (process.env.DISPLAY) {
  LIGHTHOUSE_FLAG_PROFILES.push(
    "--no-sandbox --disable-dev-shm-usage --window-size=1365,1024 --no-first-run --no-default-browser-check --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling",
  );
}

const ATTEMPTS_PER_PROFILE = 3;

async function runLighthouseWithFallback({ label, outputPath, preset }) {
  let lastResult = { code: 1, stdout: "", stderr: "" };

  for (
    let profileIndex = 0;
    profileIndex < LIGHTHOUSE_FLAG_PROFILES.length;
    profileIndex += 1
  ) {
    const chromeFlags = LIGHTHOUSE_FLAG_PROFILES[profileIndex];

    for (
      let retryIndex = 0;
      retryIndex < ATTEMPTS_PER_PROFILE;
      retryIndex += 1
    ) {
      const args = [
        "--yes",
        "lighthouse",
        BASE_URL,
        "--only-categories=performance",
        "--output=json",
        "--quiet",
        "--throttling-method=provided",
        "--disable-storage-reset",
        "--max-wait-for-load=90000",
        `--chrome-flags=${chromeFlags}`,
        `--output-path=${outputPath}`,
      ];

      const chromePath = await resolveChromePath();
      if (chromePath) {
        args.push(`--chrome-path=${chromePath}`);
      }

      if (preset) {
        args.splice(6, 0, `--preset=${preset}`);
      }

      const result = await runCommand("npx", args, {
        cwd: ROOT,
        env: {
          ...process.env,
          CI: process.env.CI ?? "1",
        },
      });

      lastResult = result;
      const totalAttempt = profileIndex * ATTEMPTS_PER_PROFILE + retryIndex + 1;
      if (result.code === 0) {
        return { ...result, attempt: totalAttempt, chromeFlags };
      }

      const details = `${result.stderr}\n${result.stdout}`;
      const noFcp = /NO_FCP/i.test(details);
      if (!noFcp) {
        return { ...result, attempt: totalAttempt, chromeFlags };
      }

      console.warn(
        `Lighthouse ${label} attempt ${totalAttempt} failed with NO_FCP, retrying...`,
      );
      await wait(1200);
    }
  }

  return {
    ...lastResult,
    attempt: LIGHTHOUSE_FLAG_PROFILES.length * ATTEMPTS_PER_PROFILE,
    chromeFlags: LIGHTHOUSE_FLAG_PROFILES[LIGHTHOUSE_FLAG_PROFILES.length - 1],
  };
}

async function resolveChromePath() {
  for (const candidate of CHROME_CANDIDATE_PATHS) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function warmupPreview(url) {
  // Warm-up requests reduce NO_FCP flakes right after the preview server starts.
  for (let index = 0; index < 3; index += 1) {
    await isServerReady(url);
    await wait(250);
  }
}

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });

    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await isServerReady(url);
    if (ready) return;
    await wait(500);
  }
  throw new Error(`Preview server did not become ready within ${timeoutMs}ms`);
}

async function readLighthouseResult(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function getMetrics(report) {
  const score = report?.categories?.performance?.score;
  const lcp = report?.audits?.["largest-contentful-paint"]?.numericValue;
  const tbt = report?.audits?.["total-blocking-time"]?.numericValue;
  return {
    performanceScore:
      typeof score === "number" ? Number(score.toFixed(2)) : null,
    lcpMs: typeof lcp === "number" ? Math.round(lcp) : null,
    tbtMs: typeof tbt === "number" ? Math.round(tbt) : null,
  };
}

function toErrorText(label, result) {
  const details = [result.stderr, result.stdout]
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!details) {
    return `Lighthouse (${label}) failed with exit code ${result.code}`;
  }
  return `Lighthouse (${label}) failed with exit code ${result.code}\n${details}`;
}

async function main() {
  await ensureReportsDir();

  const desktopPath = path.join(REPORTS_DIR, "lighthouse-desktop.json");
  const mobilePath = path.join(REPORTS_DIR, "lighthouse-mobile.json");
  const summaryPath = path.join(REPORTS_DIR, "lighthouse-summary.json");

  const preview = spawn(
    "npm",
    [
      "run",
      "preview",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(PREVIEW_PORT),
      "--strictPort",
    ],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    },
  );

  let previewLogs = "";
  preview.stdout.on("data", (chunk) => {
    previewLogs += chunk.toString();
  });
  preview.stderr.on("data", (chunk) => {
    previewLogs += chunk.toString();
  });

  try {
    await waitForServer(BASE_URL);
    await warmupPreview(BASE_URL);
    // Give the app one extra idle frame budget before first Lighthouse run.
    await wait(1500);

    const desktopRun = await runLighthouseWithFallback({
      label: "desktop",
      outputPath: desktopPath,
      preset: "desktop",
    });

    // Small pause and warm-up between desktop/mobile runs to reduce NO_FCP carry-over.
    await wait(1000);
    await warmupPreview(BASE_URL);

    const mobileRun = await runLighthouseWithFallback({
      label: "mobile",
      outputPath: mobilePath,
    });

    let desktopMetrics = { performanceScore: null, lcpMs: null, tbtMs: null };
    let mobileMetrics = { performanceScore: null, lcpMs: null, tbtMs: null };
    let error = null;

    if (desktopRun.code === 0) {
      const desktopReport = await readLighthouseResult(desktopPath);
      desktopMetrics = getMetrics(desktopReport);
    } else {
      error = toErrorText("desktop", desktopRun);
    }

    if (mobileRun.code === 0) {
      const mobileReport = await readLighthouseResult(mobilePath);
      mobileMetrics = getMetrics(mobileReport);
    } else {
      error = error
        ? `${error}\n${toErrorText("mobile", mobileRun)}`
        : toErrorText("mobile", mobileRun);
    }

    const summary = {
      createdAt: new Date().toISOString(),
      desktopPerformanceScore: desktopMetrics.performanceScore,
      mobilePerformanceScore: mobileMetrics.performanceScore,
      desktopLcpMs: desktopMetrics.lcpMs,
      mobileLcpMs: mobileMetrics.lcpMs,
      desktopTbtMs: desktopMetrics.tbtMs,
      mobileTbtMs: mobileMetrics.tbtMs,
      desktopAttempt: desktopRun.attempt ?? 1,
      mobileAttempt: mobileRun.attempt ?? 1,
      error,
    };

    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    if (error && STRICT) {
      console.error(error);
      process.exit(1);
    }

    console.log(`Wrote ${path.relative(ROOT, summaryPath)}`);
    if (error) {
      console.warn(error);
    }
  } catch (error) {
    const summary = {
      createdAt: new Date().toISOString(),
      desktopPerformanceScore: null,
      mobilePerformanceScore: null,
      desktopLcpMs: null,
      mobileLcpMs: null,
      desktopTbtMs: null,
      mobileTbtMs: null,
      error: String(error instanceof Error ? error.message : error),
    };

    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    if (STRICT) {
      console.error(summary.error);
      process.exit(1);
    }

    console.warn("Lighthouse run failed in non-strict mode.");
    console.warn(summary.error);
  } finally {
    preview.kill("SIGTERM");
    await wait(300);
    if (!preview.killed) {
      preview.kill("SIGKILL");
    }
    if (previewLogs.trim()) {
      console.log("Preview logs captured.");
    }
  }
}

main();
