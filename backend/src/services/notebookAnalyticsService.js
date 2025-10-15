import Note from "../models/Note.js";
import NoteHistory from "../models/NoteHistory.js";
import cacheService from "./cacheService.js";
import {
  resolveCacheTtl,
  clone,
  withMemo,
  fetchSnapshotsInRange,
  analyzeSnapshots,
} from "./analyticsService.js";
import {
  RANGE_TO_DAYS,
  addUtcDays,
  buildNotebookMatch,
  formatDateKey,
  isoWeekKey,
  normalizeRange,
  startOfUtcDay,
} from "./notebookAnalyticsShared.js";
import {
  resolveNotebookCollaborators,
  resolveNoteCollaborators,
} from "./notebookAnalyticsSnapshotService.js";

const TAG_LIMIT = 20;

const resolveRangeWindow = (range) => {
  const { key: rangeKey, days } = normalizeRange(range);
  const endInclusive = startOfUtcDay(new Date());
  const endExclusive = addUtcDays(endInclusive, 1);
  const startDate = addUtcDays(endInclusive, -(days - 1));

  return {
    rangeKey,
    days,
    startDate,
    endInclusive,
    endExclusive,
  };
};

const buildRangeMeta = ({ rangeKey, days, startDate, endInclusive }) => ({
  key: rangeKey,
  days,
  start: startDate.toISOString(),
  end: endInclusive.toISOString(),
});

const buildSnapshotMeta = (snapshotAnalysis, expectedDays) => {
  const missingDays = snapshotAnalysis.missingDates.length;
  const denominator = expectedDays ?? snapshotAnalysis.dayCounts?.size ?? 0;
  const coverageRatio =
    denominator === 0 ? 0 : (denominator - missingDays) / denominator;

  return {
    total: snapshotAnalysis.snapshotCount,
    missingDays,
    expectedDays: denominator,
    coverageRatio: Number(coverageRatio.toFixed(4)),
  };
};

const buildDailySeriesLive = async ({
  notebookId,
  startDate,
  endExclusive,
  viewerContext,
  memo,
}) =>
  withMemo(
    memo,
    `live-series:${notebookId}:${startDate.toISOString()}:${endExclusive.toISOString()}`,
    async () => {
      const match = buildNotebookMatch({ notebookId, viewerContext });
      match.createdAt = { $gte: startDate, $lt: endExclusive };

      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const raw = await Note.aggregate(pipeline);
      return raw.reduce((map, entry) => {
        map.set(entry._id, entry.count);
        return map;
      }, new Map());
    }
  );

const ensureDailySeries = async ({
  notebookId,
  startDate,
  endExclusive,
  viewerContext,
  memo,
}) => {
  const snapshots = await fetchSnapshotsInRange({
    notebookId,
    startDate,
    endExclusive,
    memo,
  });

  const snapshotAnalysis = analyzeSnapshots(snapshots, startDate, endExclusive);

  const needsLiveFallback =
    !snapshotAnalysis.snapshotCount || snapshotAnalysis.missingDates.length > 0;

  let liveCounts = null;
  if (needsLiveFallback) {
    liveCounts = await buildDailySeriesLive({
      notebookId,
      startDate,
      endExclusive,
      viewerContext,
      memo,
    });

    snapshotAnalysis.dayCounts.forEach((count, dateKey) => {
      if (count > 0) return;
      const liveValue = liveCounts.get(dateKey) ?? 0;
      snapshotAnalysis.dayCounts.set(dateKey, liveValue);
    });

    if (!snapshotAnalysis.snapshotCount) {
      snapshotAnalysis.notesTotal = Array.from(
        snapshotAnalysis.dayCounts.values()
      ).reduce((acc, value) => acc + value, 0);
    } else {
      snapshotAnalysis.notesTotal += Array.from(
        snapshotAnalysis.missingDates
      ).reduce((acc, dateKey) => acc + (liveCounts.get(dateKey) ?? 0), 0);
    }
  }

  const dailySeries = [];
  let cursor = new Date(startDate);
  let totalNotes = 0;
  while (cursor < endExclusive) {
    const key = formatDateKey(cursor);
    const count = snapshotAnalysis.dayCounts.get(key) ?? 0;
    dailySeries.push({ date: key, count });
    totalNotes += count;
    cursor = addUtcDays(cursor, 1);
  }

  return {
    dailySeries,
    totalNotes,
    snapshotAnalysis,
    liveCounts,
  };
};

const buildWeeklySeries = (dailySeries) => {
  const weekMap = new Map();

  dailySeries.forEach(({ date, count }) => {
    const key = isoWeekKey(date);
    if (!weekMap.has(key)) {
      weekMap.set(key, 0);
    }
    weekMap.set(key, weekMap.get(key) + count);
  });

  return Array.from(weekMap.entries()).map(([week, count]) => ({
    week,
    count,
  }));
};

const resolveLastActivity = async (notebookId, viewerContext, memo) =>
  withMemo(memo, `last-activity:${notebookId}`, async () => {
    const match = buildNotebookMatch({ notebookId, viewerContext });

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: NoteHistory.collection.name,
          localField: "_id",
          foreignField: "noteId",
          as: "history",
        },
      },
      { $unwind: "$history" },
      {
        $group: {
          _id: null,
          lastActivity: { $max: "$history.updatedAt" },
        },
      },
      { $project: { _id: 0, lastActivity: 1 } },
    ];

    const [result] = await Note.aggregate(pipeline, { allowDiskUse: true });
    if (result?.lastActivity) {
      return result.lastActivity;
    }

    const fallback = await Note.findOne(match)
      .sort({ updatedAt: -1 })
      .select({ updatedAt: 1 })
      .lean();

    return fallback?.updatedAt ?? null;
  });

const resolveTagLeaderboard = async ({
  notebookId,
  startDate,
  endExclusive,
  viewerContext,
  memo,
}) =>
  withMemo(
    memo,
    `tags:${notebookId}:${startDate.toISOString()}:${endExclusive.toISOString()}`,
    async () => {
      const match = buildNotebookMatch({ notebookId, viewerContext });
      match.createdAt = { $gte: startDate, $lt: endExclusive };
      match.tags = { $exists: true, $ne: [] };

      const pipeline = [
        { $match: match },
        { $unwind: "$tags" },
        {
          $group: {
            _id: "$tags",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        { $limit: TAG_LIMIT },
      ];

      const leaderboard = await Note.aggregate(pipeline);
      return leaderboard.map((entry) => ({
        tag: entry._id,
        count: entry.count,
      }));
    }
  );

const computeTopTags = async ({
  snapshotAnalysis,
  notebookId,
  startDate,
  endExclusive,
  viewerContext,
  memo,
}) => {
  if (
    snapshotAnalysis.snapshotCount &&
    snapshotAnalysis.missingDates.length === 0
  ) {
    const entries = Array.from(snapshotAnalysis.tagTotals.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, TAG_LIMIT);
    return entries;
  }

  return resolveTagLeaderboard({
    notebookId,
    startDate,
    endExclusive,
    viewerContext,
    memo,
  });
};

const cacheKey = (notebookId, rangeKey) =>
  `notebook:${notebookId}:analytics:${rangeKey}`;

export const getNotebookAnalyticsOverview = async ({
  notebookId,
  range,
  ownerId,
  viewerContext,
  memo,
}) => {
  const cacheTtl = resolveCacheTtl();
  const window = resolveRangeWindow(range);
  const { rangeKey, startDate, endExclusive } = window;

  if (cacheTtl) {
    const cached = cacheService.get(cacheKey(notebookId, rangeKey));
    if (cached !== undefined) {
      const payload = clone(cached);
      payload.meta = {
        ...(payload.meta ?? {}),
        cache: { hit: true, ttlSeconds: cacheTtl },
        generatedAt: payload.meta?.generatedAt ?? new Date().toISOString(),
      };
      return payload;
    }
  }

  const { dailySeries, totalNotes, snapshotAnalysis } = await ensureDailySeries(
    {
      notebookId,
      startDate,
      endExclusive,
      viewerContext,
      memo,
    }
  );

  const weeklySeries = buildWeeklySeries(dailySeries);

  const [lastActivity, topTags, notebookRoles, noteRoles] = await Promise.all([
    resolveLastActivity(notebookId, viewerContext, memo),
    computeTopTags({
      snapshotAnalysis,
      notebookId,
      startDate,
      endExclusive,
      viewerContext,
      memo,
    }),
    resolveNotebookCollaborators(notebookId, ownerId),
    resolveNoteCollaborators(notebookId, viewerContext),
  ]);

  const liveFallbackApplied =
    snapshotAnalysis.snapshotCount === 0 ||
    snapshotAnalysis.missingDates.length > 0;
  const snapshotMeta = buildSnapshotMeta(snapshotAnalysis, dailySeries.length);
  snapshotMeta.liveFallbackApplied = liveFallbackApplied;

  const response = {
    notebookId: notebookId.toString(),
    range: buildRangeMeta(window),
    metrics: {
      notesCreated: {
        total: totalNotes,
        daily: dailySeries,
        weekly: weeklySeries,
      },
      topTags,
      collaborators: {
        notebookRoles,
        noteCollaborators: noteRoles,
      },
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      cache: { hit: false, ttlSeconds: cacheTtl },
      snapshots: snapshotMeta,
    },
  };

  if (cacheTtl) {
    cacheService.set(cacheKey(notebookId, rangeKey), response, cacheTtl);
  }

  return response;
};

export const getNotebookActivityAnalytics = async ({
  notebookId,
  range,
  viewerContext,
  memo,
}) => {
  const window = resolveRangeWindow(range);
  const { startDate, endExclusive } = window;

  const { dailySeries, totalNotes, snapshotAnalysis } = await ensureDailySeries(
    {
      notebookId,
      startDate,
      endExclusive,
      viewerContext,
      memo,
    }
  );

  const labels = dailySeries.map((entry) => entry.date);
  const series = [
    {
      label: "notesCreated",
      data: dailySeries.map((entry) => entry.count),
    },
  ];

  const liveFallbackApplied =
    snapshotAnalysis.snapshotCount === 0 ||
    snapshotAnalysis.missingDates.length > 0;
  const snapshotMeta = buildSnapshotMeta(snapshotAnalysis, dailySeries.length);
  snapshotMeta.liveFallbackApplied = liveFallbackApplied;

  return {
    labels,
    series,
    meta: {
      range: buildRangeMeta(window),
      totals: {
        notesCreated: totalNotes,
      },
      snapshots: snapshotMeta,
    },
  };
};

export const getNotebookTagAnalytics = async ({
  notebookId,
  range,
  viewerContext,
  memo,
}) => {
  const window = resolveRangeWindow(range);
  const { startDate, endExclusive } = window;

  const { dailySeries, snapshotAnalysis } = await ensureDailySeries({
    notebookId,
    startDate,
    endExclusive,
    viewerContext,
    memo,
  });

  const topTags = await computeTopTags({
    snapshotAnalysis,
    notebookId,
    startDate,
    endExclusive,
    viewerContext,
    memo,
  });

  const labels = topTags.map(({ tag }) => tag);
  const series = [
    {
      label: "tags",
      data: topTags.map(({ count }) => count),
    },
  ];

  const liveFallbackApplied =
    snapshotAnalysis.snapshotCount === 0 ||
    snapshotAnalysis.missingDates.length > 0;
  const snapshotMeta = buildSnapshotMeta(snapshotAnalysis, dailySeries.length);
  snapshotMeta.liveFallbackApplied = liveFallbackApplied;

  return {
    labels,
    series,
    meta: {
      range: buildRangeMeta(window),
      snapshots: snapshotMeta,
      totals: {
        tagCategories: topTags.length,
      },
    },
  };
};

export const getNotebookCollaboratorAnalytics = async ({
  notebookId,
  ownerId,
  viewerContext,
  range,
}) => {
  const window = resolveRangeWindow(range);

  const [notebookRoles = {}, noteCollaborators = {}] = await Promise.all([
    resolveNotebookCollaborators(notebookId, ownerId),
    resolveNoteCollaborators(notebookId, viewerContext),
  ]);

  const labels = Array.from(
    new Set([...Object.keys(notebookRoles), ...Object.keys(noteCollaborators)])
  ).sort();

  const mapCounts = (counts) =>
    labels.map((role) => Math.max(0, counts?.[role] ?? 0));

  const series = [
    { label: "notebookRoles", data: mapCounts(notebookRoles) },
    { label: "noteCollaborators", data: mapCounts(noteCollaborators) },
  ];

  const totalNotebookMembers = Object.values(notebookRoles).reduce(
    (acc, value) => acc + value,
    0
  );
  const totalNoteCollaborations = Object.values(noteCollaborators).reduce(
    (acc, value) => acc + value,
    0
  );

  return {
    labels,
    series,
    meta: {
      range: buildRangeMeta(window),
      totals: {
        notebookMembers: totalNotebookMembers,
        noteCollaborations: totalNoteCollaborations,
      },
    },
  };
};

export const getNotebookSnapshotAnalytics = async ({
  notebookId,
  range,
  memo,
}) => {
  const window = resolveRangeWindow(range);
  const { startDate, endExclusive } = window;

  const snapshots = await fetchSnapshotsInRange({
    notebookId,
    startDate,
    endExclusive,
    memo,
  });

  const snapshotMap = new Map(
    snapshots.map((snapshot) => [formatDateKey(snapshot.date), snapshot])
  );

  const snapshotAnalysis = analyzeSnapshots(snapshots, startDate, endExclusive);

  const labels = [];
  const notesSeries = [];
  const editsSeries = [];
  const uniqueEditorsSeries = [];

  let cursor = new Date(startDate);
  while (cursor < endExclusive) {
    const key = formatDateKey(cursor);
    labels.push(key);
    const snapshot = snapshotMap.get(key);
    notesSeries.push(snapshot?.notesCreated ?? 0);
    editsSeries.push(snapshot?.editsCount ?? 0);
    uniqueEditorsSeries.push(snapshot?.uniqueEditors ?? 0);
    cursor = addUtcDays(cursor, 1);
  }

  const snapshotMeta = buildSnapshotMeta(snapshotAnalysis, labels.length);
  snapshotMeta.liveFallbackApplied = snapshotAnalysis.missingDates.length > 0;

  const toIsoString = (value) => {
    if (!value) return null;
    if (typeof value.toISOString === "function") {
      return value.toISOString();
    }
    const coerced = new Date(value);
    return Number.isNaN(coerced.getTime()) ? null : coerced.toISOString();
  };

  const details = snapshots.map((snapshot) => ({
    date: formatDateKey(snapshot.date),
    notesCreated: snapshot.notesCreated ?? 0,
    editsCount: snapshot.editsCount ?? 0,
    uniqueEditors: snapshot.uniqueEditors ?? 0,
    topTags: Array.isArray(snapshot.topTags)
      ? snapshot.topTags.map(({ tag, count }) => ({ tag, count }))
      : [],
    collaboratorTotals: snapshot.collaboratorTotals ?? {},
    generatedAt: toIsoString(snapshot.generatedAt),
  }));

  return {
    labels,
    series: [
      { label: "notesCreated", data: notesSeries },
      { label: "editsCount", data: editsSeries },
      { label: "uniqueEditors", data: uniqueEditorsSeries },
    ],
    meta: {
      range: buildRangeMeta(window),
      snapshots: snapshotMeta,
      missingDates: snapshotAnalysis.missingDates,
      details,
    },
  };
};

export const analyticsRanges = Object.keys(RANGE_TO_DAYS);

export default {
  getNotebookAnalyticsOverview,
  getNotebookActivityAnalytics,
  getNotebookTagAnalytics,
  getNotebookCollaboratorAnalytics,
  getNotebookSnapshotAnalytics,
  analyticsRanges,
};
