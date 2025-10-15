import NotebookAnalyticsSnapshot from "../models/NotebookAnalyticsSnapshot.js";
import {
  addUtcDays,
  formatDateKey,
  toObjectId,
} from "./notebookAnalyticsShared.js";

const MIN_CACHE_TTL = 60;
const MAX_CACHE_TTL = 120;
const DEFAULT_CACHE_TTL = 90;

export const resolveCacheTtl = () => {
  const raw = process.env.NOTEBOOK_ANALYTICS_CACHE_TTL;
  const parsed = Number.parseInt(raw ?? String(DEFAULT_CACHE_TTL), 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_CACHE_TTL;
  }

  if (parsed <= 0) {
    return 0;
  }

  return Math.min(MAX_CACHE_TTL, Math.max(MIN_CACHE_TTL, parsed));
};

export const clone = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

export const withMemo = async (memo, key, factory) => {
  if (memo && memo.has(key)) {
    return memo.get(key);
  }

  const result = await factory();
  if (memo) {
    memo.set(key, result);
  }

  return result;
};

export const fetchSnapshotsInRange = async ({
  notebookId,
  startDate,
  endExclusive,
  memo,
}) =>
  withMemo(
    memo,
    `snapshots:${notebookId}:${startDate.toISOString()}:${endExclusive.toISOString()}`,
    () =>
      NotebookAnalyticsSnapshot.find({
        notebookId: toObjectId(notebookId),
        date: { $gte: startDate, $lt: endExclusive },
      })
        .sort({ date: 1 })
        .lean()
  );

export const analyzeSnapshots = (snapshots, startDate, endExclusive) => {
  const snapshotByDate = new Map(
    snapshots.map((entry) => [formatDateKey(entry.date), entry])
  );

  const dayCounts = new Map();
  const missingDates = [];
  const tagTotals = new Map();
  let notesTotal = 0;

  let cursor = new Date(startDate);
  while (cursor < endExclusive) {
    const key = formatDateKey(cursor);
    const snapshot = snapshotByDate.get(key);

    if (snapshot) {
      const count = snapshot.notesCreated ?? 0;
      dayCounts.set(key, count);
      notesTotal += count;

      if (Array.isArray(snapshot.topTags)) {
        snapshot.topTags.forEach(({ tag, count: tagCount }) => {
          if (!tag) return;
          tagTotals.set(tag, (tagTotals.get(tag) ?? 0) + (tagCount ?? 0));
        });
      }
    } else {
      dayCounts.set(key, 0);
      missingDates.push(key);
    }

    cursor = addUtcDays(cursor, 1);
  }

  return {
    dayCounts,
    missingDates,
    tagTotals,
    notesTotal,
    snapshotCount: snapshots.length,
  };
};

export default {
  resolveCacheTtl,
  clone,
  withMemo,
  fetchSnapshotsInRange,
  analyzeSnapshots,
};
