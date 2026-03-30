/**
 * Productivity Prediction Service
 *
 * Analyses NoteHistory + NotebookEvent collections to find temporal patterns
 * in workspace activity. Uses basic statistical aggregation and lightweight
 * K-Means clustering to identify productivity "hotspots" and generate
 * actionable insight strings.
 *
 * Public API:
 *   generateWorkspacePredictions(workspaceId, { days })
 */
import mongoose from "mongoose";
import NoteHistory from "../models/NoteHistory.js";
import NotebookEvent from "../models/NotebookEvent.js";
import logger from "../utils/logger.js";

/* ─── Constants ────────────────────────────────────────────────────────── */

const DEFAULT_LOOKBACK_DAYS = 90;
const MAX_LOOKBACK_DAYS = 365;
const K_CLUSTERS = 3; // low / medium / high activity
const K_MEANS_MAX_ITER = 20;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const HOUR_LABELS = (() => {
  const labels = {};
  for (let h = 0; h < 24; h++) {
    const ampm = h < 12 ? "AM" : "PM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    labels[h] = `${hour12} ${ampm}`;
  }
  return labels;
})();

const timeWindow = (hour) => {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
};

const windowLabel = (w) =>
  ({
    morning: "mornings",
    afternoon: "afternoons",
    evening: "evenings",
    night: "late nights",
  })[w] ?? w;

/* ─── MongoDB Aggregation ─────────────────────────────────────────────── */

/**
 * Aggregate events from a single collection grouped by (dayOfWeek, hour).
 *
 * Returns an array of { _id: { dow: 1-7, hour: 0-23 }, count: N } where
 * dow 1 = Sunday … 7 = Saturday (matches MongoDB $dayOfWeek convention).
 */
/** Hard cap on documents scanned per collection to prevent OOM on huge workspaces. */
const AGGREGATION_DOC_LIMIT = 100_000;

const aggregateTimeSlots = async (Model, workspaceObjectId, since) => {
  return Model.aggregate([
    {
      $match: {
        workspaceId: workspaceObjectId,
        createdAt: { $gte: since },
      },
    },
    { $limit: AGGREGATION_DOC_LIMIT },
    {
      $group: {
        _id: {
          dow: { $dayOfWeek: "$createdAt" }, // 1=Sun 7=Sat
          hour: { $hour: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
  ]);
};

/**
 * Aggregate per-actor event counts to determine the most active contributors.
 */
const aggregateActors = async (Model, workspaceObjectId, since, limit = 5) => {
  return Model.aggregate([
    {
      $match: {
        workspaceId: workspaceObjectId,
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: "$actorId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
};

/**
 * Per-day event counts for trend detection (is activity growing or shrinking?).
 */
const aggregateDailyTotals = async (Model, workspaceObjectId, since) => {
  return Model.aggregate([
    {
      $match: {
        workspaceId: workspaceObjectId,
        createdAt: { $gte: since },
      },
    },
    { $limit: AGGREGATION_DOC_LIMIT },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

/* ─── K-Means Clustering ──────────────────────────────────────────────── */

/**
 * Minimal 1-D K-Means on the `count` values of time-slot buckets to classify
 * each (dayOfWeek, hour) bucket as low / medium / high activity.
 *
 * @param {{ dow: number, hour: number, count: number }[]} points
 * @param {number} k – number of clusters
 * @returns {{ label: string, dow: number, hour: number, count: number }[]}
 */
const kMeansCluster = (points, k = K_CLUSTERS) => {
  if (!points.length) return [];

  const counts = points.map((p) => p.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  // Degenerate case: all values the same
  if (min === max) {
    return points.map((p) => ({ ...p, cluster: 0, label: "medium" }));
  }

  // Initialise centroids evenly across the range
  let centroids = Array.from(
    { length: k },
    (_, i) => min + ((max - min) * (i + 1)) / (k + 1),
  );

  let assignments = new Array(points.length).fill(0);

  for (let iter = 0; iter < K_MEANS_MAX_ITER; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = counts.map((val) => {
      let best = 0;
      let bestDist = Infinity;
      centroids.forEach((c, ci) => {
        const dist = Math.abs(val - c);
        if (dist < bestDist) {
          bestDist = dist;
          best = ci;
        }
      });
      return best;
    });

    // Recompute centroids
    const sums = new Array(k).fill(0);
    const cnts = new Array(k).fill(0);
    newAssignments.forEach((ci, i) => {
      sums[ci] += counts[i];
      cnts[ci] += 1;
    });

    const newCentroids = centroids.map((old, ci) =>
      cnts[ci] > 0 ? sums[ci] / cnts[ci] : old,
    );

    // Check convergence
    const converged = newCentroids.every(
      (c, ci) => Math.abs(c - centroids[ci]) < 0.001,
    );
    centroids = newCentroids;
    assignments = newAssignments;
    if (converged) break;
  }

  // Sort centroids to assign labels: lowest centroid = low, highest = high
  const sortedIndices = centroids
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c - b.c)
    .map((entry) => entry.i);

  const LABELS = ["low", "medium", "high"];
  const indexToLabel = {};
  sortedIndices.forEach((origIdx, rank) => {
    indexToLabel[origIdx] = LABELS[Math.min(rank, LABELS.length - 1)];
  });

  return points.map((p, i) => ({
    ...p,
    cluster: assignments[i],
    label: indexToLabel[assignments[i]] ?? "medium",
  }));
};

/* ─── Insight Generation ──────────────────────────────────────────────── */

/**
 * Compute a simple linear-regression slope on an array of {x, y} pairs.
 * Positive slope = upward trend, negative = declining.
 */
const linearSlope = (pairs) => {
  const n = pairs.length;
  if (n < 2) return 0;
  const sumX = pairs.reduce((s, p) => s + p.x, 0);
  const sumY = pairs.reduce((s, p) => s + p.y, 0);
  const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
};

/**
 * Build actionable insight strings from the clustered data.
 */
const buildInsights = ({
  clustered,
  totalEvents,
  dailyTotals,
  lookbackDays,
}) => {
  const insights = [];
  if (!clustered.length || totalEvents === 0) {
    insights.push({
      type: "no_data",
      message:
        "Not enough activity data yet. Insights will appear once the workspace has more history.",
    });
    return insights;
  }

  // ── Peak time-slot ──────────────────────────────────────────────────
  const highSlots = clustered
    .filter((s) => s.label === "high")
    .sort((a, b) => b.count - a.count);

  if (highSlots.length > 0) {
    const peak = highSlots[0];
    const dayName = DAY_NAMES[peak.dow - 1]; // dow 1=Sun
    const win = windowLabel(timeWindow(peak.hour));
    const avgAll = totalEvents / clustered.length;
    const pctAbove = Math.round(((peak.count - avgAll) / avgAll) * 100);

    insights.push({
      type: "peak_activity",
      dayOfWeek: peak.dow,
      hour: peak.hour,
      count: peak.count,
      message:
        `Your team is historically ${pctAbove > 0 ? pctAbove : ""}% more active on ${dayName} ${win}. Consider scheduling async code reviews during this window.`.replace(
          "  ",
          " ",
        ),
    });
  }

  // ── Quietest window (best for deep work) ───────────────────────────
  const lowSlots = clustered
    .filter((s) => s.label === "low")
    .sort((a, b) => a.count - b.count);

  if (lowSlots.length > 0) {
    const quiet = lowSlots[0];
    const dayName = DAY_NAMES[quiet.dow - 1];
    const win = windowLabel(timeWindow(quiet.hour));
    insights.push({
      type: "quiet_window",
      dayOfWeek: quiet.dow,
      hour: quiet.hour,
      count: quiet.count,
      message: `${dayName} ${win} tend to be the quietest period. This could be a good slot for deep-focus work or writing.`,
    });
  }

  // ── Best day of the week ───────────────────────────────────────────
  const byDay = new Map();
  clustered.forEach((s) => {
    byDay.set(s.dow, (byDay.get(s.dow) ?? 0) + s.count);
  });
  const dayEntries = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1]);
  if (dayEntries.length >= 2) {
    const [bestDow, bestCount] = dayEntries[0];
    const [worstDow, worstCount] = dayEntries[dayEntries.length - 1];
    const ratio =
      worstCount > 0 ? Math.round((bestCount / worstCount - 1) * 100) : 100;
    insights.push({
      type: "day_comparison",
      bestDay: DAY_NAMES[bestDow - 1],
      quietDay: DAY_NAMES[worstDow - 1],
      message: `${DAY_NAMES[bestDow - 1]} is the most productive day with ${ratio}% more activity than ${DAY_NAMES[worstDow - 1]}.`,
    });
  }

  // ── Trend over time ────────────────────────────────────────────────
  if (dailyTotals.length >= 7) {
    const pairs = dailyTotals.map((d, i) => ({ x: i, y: d.count }));
    const slope = linearSlope(pairs);
    const avgDaily = totalEvents / Math.max(dailyTotals.length, 1);
    const weeklyDelta = slope * 7;
    const pctWeekly =
      avgDaily > 0 ? Math.round((weeklyDelta / avgDaily) * 100) : 0;

    if (Math.abs(pctWeekly) >= 5) {
      const direction = pctWeekly > 0 ? "increasing" : "decreasing";
      insights.push({
        type: "trend",
        direction,
        weeklyChangePct: pctWeekly,
        message: `Activity has been ${direction} by roughly ${Math.abs(pctWeekly)}% week-over-week across the last ${lookbackDays} days.`,
      });
    } else {
      insights.push({
        type: "trend",
        direction: "stable",
        weeklyChangePct: pctWeekly,
        message: `Activity has remained stable over the last ${lookbackDays} days.`,
      });
    }
  }

  // ── Weekend vs weekday ─────────────────────────────────────────────
  let weekdayTotal = 0;
  let weekendTotal = 0;
  clustered.forEach((s) => {
    if (s.dow === 1 || s.dow === 7) {
      weekendTotal += s.count;
    } else {
      weekdayTotal += s.count;
    }
  });
  const total = weekdayTotal + weekendTotal;
  if (total > 0) {
    const weekendPct = Math.round((weekendTotal / total) * 100);
    if (weekendPct >= 20) {
      insights.push({
        type: "weekend_activity",
        weekendPct,
        message: `${weekendPct}% of activity happens on weekends. Consider whether the team has sustainable working hours.`,
      });
    }
  }

  return insights;
};

/* ─── Public API ──────────────────────────────────────────────────────── */

/**
 * Generate productivity predictions for a workspace.
 *
 * @param {string|ObjectId} workspaceId
 * @param {{ days?: number }} options
 * @returns {Promise<object>} prediction payload
 */
export const generateWorkspacePredictions = async (
  workspaceId,
  { days = DEFAULT_LOOKBACK_DAYS } = {},
) => {
  const lookbackDays = Math.min(
    Math.max(Number(days) || DEFAULT_LOOKBACK_DAYS, 7),
    MAX_LOOKBACK_DAYS,
  );
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const workspaceObjectId = new mongoose.Types.ObjectId(String(workspaceId));

  // ── 1. Aggregate time-slot data from both event collections ────────
  const [historySlots, eventSlots, historyDaily, eventDaily] =
    await Promise.all([
      aggregateTimeSlots(NoteHistory, workspaceObjectId, since),
      aggregateTimeSlots(NotebookEvent, workspaceObjectId, since),
      aggregateDailyTotals(NoteHistory, workspaceObjectId, since),
      aggregateDailyTotals(NotebookEvent, workspaceObjectId, since),
    ]);

  // Merge time-slot counts from both sources
  const slotMap = new Map(); // key = "dow:hour"
  const addSlots = (slots) => {
    for (const s of slots) {
      const key = `${s._id.dow}:${s._id.hour}`;
      const existing = slotMap.get(key);
      if (existing) {
        existing.count += s.count;
      } else {
        slotMap.set(key, {
          dow: s._id.dow,
          hour: s._id.hour,
          count: s.count,
        });
      }
    }
  };
  addSlots(historySlots);
  addSlots(eventSlots);

  const allSlots = Array.from(slotMap.values());
  const totalEvents = allSlots.reduce((sum, s) => sum + s.count, 0);

  // Merge daily totals
  const dailyMap = new Map();
  [...historyDaily, ...eventDaily].forEach((d) => {
    dailyMap.set(d._id, (dailyMap.get(d._id) ?? 0) + d.count);
  });
  const dailyTotals = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── 2. Cluster time-slots ─────────────────────────────────────────
  const clustered = kMeansCluster(allSlots, K_CLUSTERS);

  // ── 3. Build heatmap grid (7 days × 24 hours) ─────────────────────
  const heatmap = [];
  for (let dow = 1; dow <= 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const entry = clustered.find((s) => s.dow === dow && s.hour === hour);
      heatmap.push({
        day: DAY_NAMES[dow - 1],
        dayOfWeek: dow,
        hour,
        hourLabel: HOUR_LABELS[hour],
        count: entry?.count ?? 0,
        intensity: entry?.label ?? "low",
      });
    }
  }

  // ── 4. Generate insights ──────────────────────────────────────────
  const insights = buildInsights({
    clustered,
    totalEvents,
    dailyTotals,
    lookbackDays,
  });

  return {
    workspaceId: String(workspaceId),
    lookbackDays,
    since: since.toISOString(),
    totalEvents,
    activeDays: dailyTotals.length,
    heatmap,
    dailyTrend: dailyTotals,
    insights,
    generatedAt: new Date().toISOString(),
  };
};

export default { generateWorkspacePredictions };
