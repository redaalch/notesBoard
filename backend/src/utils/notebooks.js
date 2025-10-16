import crypto from "node:crypto";
import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";

const PUBLIC_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{4,62})[a-z0-9]$/i;

export const normalizeObjectId = (value) => {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (_error) {
    return null;
  }
};

export const ensureNotebookOwnership = async (
  notebookId,
  ownerId,
  options = {}
) => {
  const objectId = normalizeObjectId(notebookId);
  if (!objectId || !ownerId) {
    return null;
  }

  const query = Notebook.findOne({
    _id: objectId,
    owner: new mongoose.Types.ObjectId(ownerId),
  }).lean();

  if (options?.session) {
    query.session(options.session);
  }

  const notebook = await query;

  return notebook;
};

export const removeNotesFromNotebookOrder = async (
  notebookId,
  noteIds,
  options = {}
) => {
  if (!notebookId || !Array.isArray(noteIds) || !noteIds.length) {
    return;
  }

  const update = Notebook.updateOne(
    { _id: notebookId },
    { $pull: { noteOrder: { $in: noteIds } } }
  );

  if (options?.session) {
    update.session(options.session);
  }

  await update;
};

export const appendNotesToNotebookOrder = async (
  notebookId,
  noteIds,
  options = {}
) => {
  if (!notebookId || !Array.isArray(noteIds) || !noteIds.length) {
    return;
  }

  const update = Notebook.updateOne(
    { _id: notebookId },
    { $addToSet: { noteOrder: { $each: noteIds } } }
  );

  if (options?.session) {
    update.session(options.session);
  }

  await update;
};

export const normalizeNotebookPublicSlug = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed.length || trimmed.length > 64) {
    return null;
  }

  const normalized = trimmed
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized || normalized.length < 6) {
    return null;
  }

  if (!PUBLIC_SLUG_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

export const generateNotebookPublicSlug = (length = 16) => {
  const safeLength = Math.max(6, Math.min(32, Number(length) || 16));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bytes = crypto.randomBytes(Math.ceil((safeLength * 5) / 8));
    const encoded = bytes.toString("base64url").replace(/[^a-z0-9]/gi, "");
    const candidate = encoded.slice(0, safeLength).padEnd(safeLength, "0");
    const normalized = normalizeNotebookPublicSlug(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return normalizeNotebookPublicSlug(
    `notebook-${Date.now().toString(36).slice(-safeLength)}`
  );
};

export const computeNotebookSnapshotHash = (snapshot) => {
  if (snapshot === null || snapshot === undefined) {
    return null;
  }

  let serialized;
  if (typeof snapshot === "string") {
    serialized = snapshot;
  } else {
    try {
      serialized = JSON.stringify(snapshot);
    } catch (_error) {
      return null;
    }
  }

  return crypto.createHash("sha256").update(serialized).digest("hex");
};

export const bumpNotebookOfflineRevision = async (
  notebookId,
  { session, snapshotHash } = {}
) => {
  if (!notebookId) {
    return null;
  }

  const update = Notebook.findOneAndUpdate(
    { _id: notebookId },
    {
      $inc: { offlineRevision: 1 },
      ...(snapshotHash
        ? {
            $set: {
              offlineSnapshotHash: snapshotHash,
              offlineSnapshotUpdatedAt: new Date(),
            },
          }
        : {}),
    },
    {
      new: true,
      lean: true,
      session: session ?? undefined,
    }
  );

  const notebook = await update;
  return notebook?.offlineRevision ?? null;
};

export const resetNotebookOfflineSnapshot = async (
  notebookId,
  { session } = {}
) => {
  if (!notebookId) {
    return;
  }

  const update = Notebook.updateOne(
    { _id: notebookId },
    {
      $set: {
        offlineSnapshotHash: null,
        offlineSnapshotUpdatedAt: null,
        offlineRevision: 0,
      },
    }
  );

  if (session) {
    update.session(session);
  }

  await update;
};
