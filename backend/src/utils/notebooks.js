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

export const ensureNotebookOwnership = async (notebookId, ownerId) => {
  const objectId = normalizeObjectId(notebookId);
  if (!objectId || !ownerId) {
    return null;
  }

  const notebook = await Notebook.findOne({
    _id: objectId,
    owner: new mongoose.Types.ObjectId(ownerId),
  }).lean();

  return notebook;
};

export const removeNotesFromNotebookOrder = async (notebookId, noteIds) => {
  if (!notebookId || !Array.isArray(noteIds) || !noteIds.length) {
    return;
  }

  await Notebook.updateOne(
    { _id: notebookId },
    { $pull: { noteOrder: { $in: noteIds } } }
  );
};

export const appendNotesToNotebookOrder = async (notebookId, noteIds) => {
  if (!notebookId || !Array.isArray(noteIds) || !noteIds.length) {
    return;
  }

  await Notebook.updateOne(
    { _id: notebookId },
    { $addToSet: { noteOrder: { $each: noteIds } } }
  );
};
