import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";
import Note from "../models/Note.js";
import {
  appendNotesToNotebookOrder,
  removeNotesFromNotebookOrder,
} from "../utils/notebooks.js";

const toObjectId = (value) => {
  if (!value && value !== 0) return null;
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (_error) {
    return null;
  }
};

const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
};

const restoreNotebookFields = async ({ notebook, inverse, session }) => {
  const previous = toPlainObject(inverse.previous);
  if (!Object.keys(previous).length) {
    throw new Error("UNDO_UNSUPPORTED_PAYLOAD");
  }

  const allowedKeys = ["name", "color", "icon", "description"];
  const payload = {};
  allowedKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(previous, key)) {
      payload[key] = previous[key];
    }
  });

  if (!Object.keys(payload).length) {
    throw new Error("UNDO_UNSUPPORTED_PAYLOAD");
  }

  await Notebook.updateOne(
    { _id: notebook._id },
    { $set: payload },
    { session }
  );

  return {
    affectedNotebookIds: [notebook._id.toString()],
  };
};

const restoreNoteNotebook = async ({ notebook, inverse, session }) => {
  const previousNotebookIds = Array.isArray(inverse.previousNotebookIds)
    ? inverse.previousNotebookIds
    : [];

  if (!previousNotebookIds.length) {
    throw new Error("UNDO_UNSUPPORTED_PAYLOAD");
  }

  const noteIdEntries = previousNotebookIds
    .map((entry) => {
      const noteId = toObjectId(entry.noteId);
      if (!noteId) {
        return null;
      }
      const notebookId = entry.notebookId ? toObjectId(entry.notebookId) : null;
      return { noteId, notebookId };
    })
    .filter(Boolean);

  if (!noteIdEntries.length) {
    throw new Error("UNDO_UNSUPPORTED_PAYLOAD");
  }

  const noteIds = noteIdEntries.map((entry) => entry.noteId);

  const bulkOperations = noteIdEntries.map((entry) => ({
    updateOne: {
      filter: { _id: entry.noteId },
      update: { $set: { notebookId: entry.notebookId } },
    },
  }));

  await Note.bulkWrite(bulkOperations, { session });

  await removeNotesFromNotebookOrder(notebook._id, noteIds, { session });

  const groupByNotebook = noteIdEntries.reduce((acc, entry) => {
    if (!entry.notebookId) {
      return acc;
    }
    const key = entry.notebookId.toString();
    if (!acc.has(key)) {
      acc.set(key, []);
    }
    acc.get(key).push(entry.noteId);
    return acc;
  }, new Map());

  for (const [
    targetNotebookId,
    notesForNotebook,
  ] of groupByNotebook.entries()) {
    await appendNotesToNotebookOrder(
      new mongoose.Types.ObjectId(targetNotebookId),
      notesForNotebook,
      { session }
    );
  }

  return {
    affectedNotebookIds: Array.from(
      new Set([notebook._id.toString(), ...Array.from(groupByNotebook.keys())])
    ),
  };
};

const ACTION_HANDLERS = new Map([
  ["restoreNotebookFields", restoreNotebookFields],
  ["restoreNoteNotebook", restoreNoteNotebook],
]);

export const applyUndoForNotebookEvent = async ({
  notebook,
  event,
  session,
}) => {
  const inverseMap = event.inversePayload;
  const inverse =
    inverseMap instanceof Map ? toPlainObject(inverseMap) : inverseMap;
  const action =
    inverse?.action ?? (inverse?.previous ? "restoreNotebookFields" : null);

  if (!action || !ACTION_HANDLERS.has(action)) {
    return {
      supported: false,
      reason: "unsupported-action",
    };
  }

  const handler = ACTION_HANDLERS.get(action);
  const result = await handler({ notebook, inverse, session });

  return {
    supported: true,
    action,
    ...(result ?? {}),
  };
};

export default {
  applyUndoForNotebookEvent,
};
