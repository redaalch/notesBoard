import mongoose from "mongoose";
import asyncHandler from "../middleware/asyncHandler.js";
import NoteHistory from "../models/NoteHistory.js";
import Note from "../models/Note.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_DAYS = 7;
const MAX_DAYS = 120;

const startOfUtcDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const countWords = (text) => {
  if (!text || typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

const computeStreaks = (days, today) => {
  const active = new Set(
    days.filter((d) => d.editCount > 0).map((d) => d.date),
  );

  let current = 0;
  const cursor = startOfUtcDay(today);
  while (active.has(cursor.toISOString().slice(0, 10))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let best = 0;
  let run = 0;
  for (const day of days) {
    if (day.editCount > 0) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { currentStreak: current, bestStreak: best };
};

export const getActivityHeatmap = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const requested = Number.parseInt(req.query.days, 10);
  const days = Number.isFinite(requested)
    ? Math.min(MAX_DAYS, Math.max(MIN_DAYS, requested))
    : 14;

  const today = startOfUtcDay(new Date());
  const rangeStart = new Date(today.getTime() - (days - 1) * MS_PER_DAY);

  const buckets = await NoteHistory.aggregate([
    {
      $match: {
        actorId: userId,
        createdAt: { $gte: rangeStart },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        editCount: {
          $sum: {
            $cond: [{ $eq: ["$eventType", "edit"] }, 1, 0],
          },
        },
        eventCount: { $sum: 1 },
        noteIds: { $addToSet: "$noteId" },
      },
    },
  ]);

  const bucketMap = new Map(buckets.map((b) => [b._id, b]));

  const series = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(rangeStart.getTime() + i * MS_PER_DAY);
    const key = d.toISOString().slice(0, 10);
    const b = bucketMap.get(key);
    series.push({
      date: key,
      editCount: b?.editCount ?? 0,
      eventCount: b?.eventCount ?? 0,
    });
  }

  const weekAgo = new Date(today.getTime() - 6 * MS_PER_DAY);
  const recentNoteIds = new Set();
  for (const b of buckets) {
    if (new Date(b._id).getTime() >= weekAgo.getTime()) {
      for (const nid of b.noteIds ?? []) {
        recentNoteIds.add(String(nid));
      }
    }
  }

  let wordsLastWeek = 0;
  if (recentNoteIds.size > 0) {
    const notes = await Note.find(
      { _id: { $in: Array.from(recentNoteIds) }, owner: userId },
      { content: 1 },
    ).lean();
    wordsLastWeek = notes.reduce((sum, n) => sum + countWords(n.content), 0);
  }

  const { currentStreak, bestStreak } = computeStreaks(series, today);

  res.json({
    days: series,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: today.toISOString(),
    wordsLastWeek,
    notesTouched: recentNoteIds.size,
    currentStreak,
    bestStreak,
  });
});
