import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

export const RANGE_TO_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export const DEFAULT_RANGE = "30d";

export const toObjectId = (value) =>
  value instanceof ObjectId ? value : new ObjectId(String(value));

export const normalizeRange = (range) => {
  const key = typeof range === "string" ? range.toLowerCase() : DEFAULT_RANGE;
  const days = RANGE_TO_DAYS[key] ?? RANGE_TO_DAYS[DEFAULT_RANGE];
  return { key: RANGE_TO_DAYS[key] ? key : DEFAULT_RANGE, days };
};

export const startOfUtcDay = (date) => {
  const utc = new Date(date);
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
};

export const addUtcDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const formatDateKey = (date) => {
  const utc = new Date(date);
  utc.setUTCHours(0, 0, 0, 0);
  return utc.toISOString().slice(0, 10);
};

export const isoWeekKey = (dateLike) => {
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

export const buildNotebookMatch = ({ notebookId, viewerContext }) => {
  const match = { notebookId: toObjectId(notebookId) };

  if (viewerContext?.allowedWorkspaceIds?.length) {
    match.workspaceId = {
      $in: viewerContext.allowedWorkspaceIds.map((id) => toObjectId(id)),
    };
  } else if (viewerContext?.workspaceId) {
    match.workspaceId = toObjectId(viewerContext.workspaceId);
  }

  if (viewerContext?.noteVisibility?.length) {
    match._id = {
      $in: viewerContext.noteVisibility.map((id) => toObjectId(id)),
    };
  }

  return match;
};

export const buildHistoryMatch = ({ notebookId, viewerContext }) => {
  const match = { "note.notebookId": toObjectId(notebookId) };

  if (viewerContext?.allowedWorkspaceIds?.length) {
    match["note.workspaceId"] = {
      $in: viewerContext.allowedWorkspaceIds.map((id) => toObjectId(id)),
    };
  } else if (viewerContext?.workspaceId) {
    match["note.workspaceId"] = toObjectId(viewerContext.workspaceId);
  }

  return match;
};

export const buildMemberMatch = ({ notebookId }) => ({
  notebookId: toObjectId(notebookId),
});
