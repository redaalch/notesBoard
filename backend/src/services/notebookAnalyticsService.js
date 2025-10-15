import mongoose from "mongoose";

import Note from "../models/Note.js";
import NoteHistory from "../models/NoteHistory.js";
import NotebookMember from "../models/NotebookMember.js";
import NoteCollaborator from "../models/NoteCollaborator.js";
import cacheService from "./cacheService.js";

const { ObjectId } = mongoose.Types;

const RANGE_TO_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

const DEFAULT_RANGE = "30d";

const resolveCacheTtl = () => {
  const parsed = Number.parseInt(
    process.env.NOTEBOOK_ANALYTICS_CACHE_TTL ?? "90",
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const clone = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const toObjectId = (value) =>
  value instanceof ObjectId ? value : new ObjectId(String(value));

const normalizeRange = (range) => {
  const key = typeof range === "string" ? range.toLowerCase() : DEFAULT_RANGE;
  const days = RANGE_TO_DAYS[key] ?? RANGE_TO_DAYS[DEFAULT_RANGE];
  return { key: RANGE_TO_DAYS[key] ? key : DEFAULT_RANGE, days };
};

const startOfUtcDay = (date) => {
  const utc = new Date(date);
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
};

const formatDateKey = (date) => {
  const utc = new Date(date);
  utc.setUTCHours(0, 0, 0, 0);
  return utc.toISOString().slice(0, 10);
};

const addUtcDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const isoWeekKey = (dateLike) => {
  const date = new Date(dateLike);
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
};

const buildDailySeries = async (notebookId, startDate, endExclusive) => {
  const pipeline = [
    {
      $match: {
        notebookId: toObjectId(notebookId),
        createdAt: { $gte: startDate, $lt: endExclusive },
      },
    },
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

  const dayMap = new Map();
  const cursor = new Date(startDate);
  const lastDay = addUtcDays(endExclusive, -1);

  while (cursor <= lastDay) {
    dayMap.set(formatDateKey(cursor), 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  raw.forEach((entry) => {
    if (dayMap.has(entry._id)) {
      dayMap.set(entry._id, entry.count);
    }
  });

  return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));
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

const resolveLastActivity = async (notebookId) => {
  const pipeline = [
    { $match: { notebookId: toObjectId(notebookId) } },
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

  const fallback = await Note.findOne({
    notebookId: toObjectId(notebookId),
  })
    .sort({ updatedAt: -1 })
    .select({ updatedAt: 1 })
    .lean();

  return fallback?.updatedAt ?? null;
};

const resolveTagLeaderboard = async (notebookId, startDate) => {
  const pipeline = [
    {
      $match: {
        notebookId: toObjectId(notebookId),
        createdAt: { $gte: startDate },
        tags: { $exists: true, $ne: [] },
      },
    },
    { $unwind: "$tags" },
    {
      $group: {
        _id: "$tags",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 20 },
  ];

  const leaderboard = await Note.aggregate(pipeline);
  return leaderboard.map((entry) => ({ tag: entry._id, count: entry.count }));
};

const resolveNotebookCollaborators = async (notebookId, ownerId) => {
  const notebookObjectId = toObjectId(notebookId);
  const activeMembers = await NotebookMember.aggregate([
    {
      $match: {
        notebookId: notebookObjectId,
        status: "active",
      },
    },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  const roleCounts = activeMembers.reduce((acc, entry) => {
    acc[entry._id] = entry.count;
    return acc;
  }, {});

  if (ownerId) {
    const ownerObjectId = toObjectId(ownerId);
    const ownerAlreadyTracked = await NotebookMember.exists({
      notebookId: notebookObjectId,
      userId: ownerObjectId,
      status: "active",
    });
    if (!ownerAlreadyTracked) {
      roleCounts.owner = (roleCounts.owner ?? 0) + 1;
    }
  }

  if (ownerId && roleCounts.owner === undefined) {
    roleCounts.owner = (roleCounts.owner ?? 0) + 1;
  }

  return roleCounts;
};

const resolveNoteCollaborators = async (notebookId) => {
  const pipeline = [
    {
      $lookup: {
        from: Note.collection.name,
        localField: "noteId",
        foreignField: "_id",
        as: "note",
      },
    },
    { $unwind: "$note" },
    {
      $match: {
        "note.notebookId": toObjectId(notebookId),
      },
    },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ];

  const collaborators = await NoteCollaborator.aggregate(pipeline);
  return collaborators.reduce((acc, entry) => {
    acc[entry._id] = entry.count;
    return acc;
  }, {});
};

const cacheKey = (notebookId, rangeKey) =>
  `notebook:${notebookId}:analytics:${rangeKey}`;

export const getNotebookAnalyticsOverview = async ({
  notebookId,
  range,
  ownerId,
}) => {
  const cacheTtl = resolveCacheTtl();
  const { key: rangeKey, days } = normalizeRange(range);
  const endDate = startOfUtcDay(new Date());
  const endExclusive = addUtcDays(endDate, 1);
  const startDate = addUtcDays(endDate, -(days - 1));

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

  const [dailySeries, lastActivity, topTags, notebookRoles, noteRoles] =
    await Promise.all([
      buildDailySeries(notebookId, startDate, endExclusive),
      resolveLastActivity(notebookId),
      resolveTagLeaderboard(notebookId, startDate),
      resolveNotebookCollaborators(notebookId, ownerId),
      resolveNoteCollaborators(notebookId),
    ]);

  const weeklySeries = buildWeeklySeries(dailySeries);
  const totalNotes = dailySeries.reduce((acc, day) => acc + day.count, 0);

  const response = {
    notebookId: notebookId.toString(),
    range: {
      key: rangeKey,
      days,
      start: startDate.toISOString(),
      end: addUtcDays(endExclusive, -1).toISOString(),
    },
    metrics: {
      notesCreated: {
        total: totalNotes,
        daily: dailySeries,
        weekly: weeklySeries,
      },
      lastActivity: lastActivity
        ? lastActivity.toISOString?.() ?? lastActivity
        : null,
      topTags,
      collaborators: {
        notebookRoles,
        noteCollaborators: noteRoles,
      },
    },
    meta: {
      generatedAt: new Date().toISOString(),
      cache: { hit: false, ttlSeconds: cacheTtl },
    },
  };

  if (cacheTtl) {
    cacheService.set(cacheKey(notebookId, rangeKey), response, cacheTtl);
  }

  return response;
};

export const analyticsRanges = Object.keys(RANGE_TO_DAYS);

export default {
  getNotebookAnalyticsOverview,
  analyticsRanges,
};
