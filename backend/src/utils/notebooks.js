import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";

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
