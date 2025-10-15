import Notebook from "../models/Notebook.js";
import Note from "../models/Note.js";
import NoteHistory from "../models/NoteHistory.js";
import NotebookAnalyticsSnapshot from "../models/NotebookAnalyticsSnapshot.js";
import NotebookMember from "../models/NotebookMember.js";
import NoteCollaborator from "../models/NoteCollaborator.js";
import {
  addUtcDays,
  buildHistoryMatch,
  buildNotebookMatch,
  startOfUtcDay,
  toObjectId,
} from "./notebookAnalyticsShared.js";

const TAG_LIMIT = 20;

export const resolveNotebookCollaborators = async (notebookId, ownerId) => {
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

export const resolveNoteCollaborators = async (notebookId, viewerContext) => {
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
      $match: buildHistoryMatch({ notebookId, viewerContext }),
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

const aggregateNoteHistoryMetrics = async ({
  notebookId,
  startDate,
  endExclusive,
  viewerContext,
}) => {
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: startDate, $lt: endExclusive },
      },
    },
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
      $match: buildHistoryMatch({ notebookId, viewerContext }),
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        uniqueEditors: { $addToSet: "$actorId" },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        uniqueEditors: { $size: "$uniqueEditors" },
      },
    },
  ];

  const [result] = await NoteHistory.aggregate(pipeline);
  return {
    total: result?.total ?? 0,
    uniqueEditors: result?.uniqueEditors ?? 0,
  };
};

const aggregateTopTagsForDay = async ({
  notebookId,
  startDate,
  endExclusive,
  viewerContext,
}) => {
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
  return leaderboard.map((entry) => ({ tag: entry._id, count: entry.count }));
};

const countNotesCreatedForDay = async ({
  notebookId,
  startDate,
  endExclusive,
  viewerContext,
}) => {
  const match = buildNotebookMatch({ notebookId, viewerContext });
  match.createdAt = { $gte: startDate, $lt: endExclusive };
  return Note.countDocuments(match);
};

export const buildSnapshotPayload = async ({
  notebook,
  notebookId,
  date,
  viewerContext,
}) => {
  const targetNotebook =
    notebook ?? (await Notebook.findById(notebookId).lean());
  if (!targetNotebook) {
    const error = new Error("Notebook not found");
    error.status = 404;
    throw error;
  }

  const dayStart = startOfUtcDay(date ?? new Date());
  const dayEnd = addUtcDays(dayStart, 1);

  const [notesCreated, historyMetrics, topTags, notebookRoles, noteRoles] =
    await Promise.all([
      countNotesCreatedForDay({
        notebookId: targetNotebook._id,
        startDate: dayStart,
        endExclusive: dayEnd,
        viewerContext,
      }),
      aggregateNoteHistoryMetrics({
        notebookId: targetNotebook._id,
        startDate: dayStart,
        endExclusive: dayEnd,
        viewerContext,
      }),
      aggregateTopTagsForDay({
        notebookId: targetNotebook._id,
        startDate: dayStart,
        endExclusive: dayEnd,
        viewerContext,
      }),
      resolveNotebookCollaborators(targetNotebook._id, targetNotebook.owner),
      resolveNoteCollaborators(targetNotebook._id, viewerContext),
    ]);

  const collaboratorTotals = {};
  const mergeCounts = (counts = {}) => {
    Object.entries(counts).forEach(([role, count]) => {
      collaboratorTotals[role] = (collaboratorTotals[role] ?? 0) + count;
    });
  };
  mergeCounts(notebookRoles);
  mergeCounts(noteRoles);

  return {
    notebookId: targetNotebook._id,
    workspaceId: targetNotebook.workspaceId ?? null,
    date: dayStart,
    notesCreated,
    editsCount: historyMetrics.total,
    uniqueEditors: historyMetrics.uniqueEditors,
    topTags,
    collaboratorTotals,
    generatedAt: new Date(),
  };
};

export const upsertNotebookSnapshot = async ({
  notebookId,
  date,
  notebook,
  viewerContext,
}) => {
  const payload = await buildSnapshotPayload({
    notebookId,
    notebook,
    date,
    viewerContext,
  });

  const doc = await NotebookAnalyticsSnapshot.findOneAndUpdate(
    { notebookId: payload.notebookId, date: payload.date },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
};

export const collectNotebookSnapshotsForRange = async ({
  notebookId,
  startDate,
  endExclusive,
  notebook,
  viewerContext,
}) => {
  const snapshots = [];
  let cursor = startOfUtcDay(startDate);
  const end = startOfUtcDay(endExclusive ?? new Date());

  while (cursor < end) {
    const result = await upsertNotebookSnapshot({
      notebookId,
      notebook,
      date: cursor,
      viewerContext,
    });
    snapshots.push(result);
    cursor = addUtcDays(cursor, 1);
  }

  return snapshots;
};

export default {
  resolveNotebookCollaborators,
  resolveNoteCollaborators,
  buildSnapshotPayload,
  upsertNotebookSnapshot,
  collectNotebookSnapshotsForRange,
};
