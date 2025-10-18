import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";
import Note from "../models/Note.js";
import NotebookSyncState from "../models/NotebookSyncState.js";
import logger from "../utils/logger.js";
import {
  appendNotesToNotebookOrder,
  bumpNotebookOfflineRevision,
  computeNotebookSnapshotHash,
  ensureNotebookOwnership,
  normalizeObjectId,
  removeNotesFromNotebookOrder,
} from "../utils/notebooks.js";
import { appendNotebookEvent } from "../services/notebookEventService.js";
import { enqueueNotebookIndexJob } from "../tasks/notebookIndexingWorker.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

const MAX_OFFLINE_OPERATIONS = 100;

const mapLikeToObject = (value) => {
  if (!value) {
    return {};
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
};

const serializeNote = (note) => {
  if (!note) {
    return null;
  }
  return {
    id: note._id.toString(),
    title: note.title,
    content: note.content,
    contentText: note.contentText ?? note.content ?? "",
    tags: Array.isArray(note.tags) ? note.tags : [],
    pinned: Boolean(note.pinned),
    updatedAt: note.updatedAt,
    createdAt: note.createdAt,
    notebookId: note.notebookId?.toString?.() ?? null,
    workspaceId: note.workspaceId?.toString?.() ?? null,
    boardId: note.boardId?.toString?.() ?? null,
  };
};

const sanitizeOperations = (operations) => {
  if (!Array.isArray(operations)) {
    return [];
  }
  return operations.slice(0, MAX_OFFLINE_OPERATIONS).map((op) => {
    if (!op || typeof op !== "object") {
      return null;
    }
    const type = String(op.type ?? op.opType ?? "")
      .trim()
      .toLowerCase();
    const payload = op.payload ?? op.note ?? null;
    const opId = typeof op.opId === "string" ? op.opId.trim() : null;
    return {
      type,
      payload,
      noteId: normalizeObjectId(op.noteId) ?? normalizeObjectId(op.id) ?? null,
      opId,
    };
  });
};

const applyNoteUpsert = async ({ notebook, payload, ownerId, session }) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const noteId = normalizeObjectId(payload.id ?? payload.noteId);
  const title = typeof payload.title === "string" ? payload.title.trim() : null;
  const content =
    typeof payload.content === "string" ? payload.content : payload.body ?? "";
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  const pinned = Boolean(payload.pinned);

  if (!title || !content) {
    throw new Error("INVALID_NOTE_PAYLOAD");
  }

  let noteDoc;
  const isUpdate = Boolean(noteId);
  const baseUpdate = {
    title,
    content,
    tags,
    pinned,
    notebookId: notebook._id,
  };

  if (noteId) {
    noteDoc = await Note.findOneAndUpdate(
      { _id: noteId, owner: ownerId },
      {
        $set: {
          ...baseUpdate,
          contentText:
            typeof payload.contentText === "string"
              ? payload.contentText
              : content,
        },
      },
      { new: true, session }
    );
    if (!noteDoc) {
      throw new Error("NOTE_NOT_FOUND");
    }
  } else {
    const newNote = await Note.create(
      [
        {
          owner: ownerId,
          notebookId: notebook._id,
          workspaceId: notebook.workspaceId ?? null,
          boardId: null,
          title,
          content,
          tags,
          pinned,
          contentText:
            typeof payload.contentText === "string"
              ? payload.contentText
              : content,
        },
      ],
      { session }
    );
    noteDoc = newNote[0];
    await appendNotesToNotebookOrder(notebook._id, [noteDoc._id], {
      session,
    });
  }

  return { note: noteDoc, created: !isUpdate };
};

const applyNoteDelete = async ({ notebook, noteId, ownerId, session }) => {
  if (!noteId) {
    throw new Error("INVALID_NOTE_ID");
  }

  const result = await Note.findOneAndDelete(
    { _id: noteId, owner: ownerId, notebookId: notebook._id },
    { session }
  );

  if (!result) {
    throw new Error("NOTE_NOT_FOUND");
  }

  await removeNotesFromNotebookOrder(notebook._id, [noteId], { session });

  return result;
};

export const getNotebookSyncState = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { clientId = null, withNotes = "true" } = req.query ?? {};

    const notebook = await ensureNotebookOwnership(id, ownerId);
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    const includeNotes = String(withNotes).toLowerCase() !== "false";

    let notes = [];
    if (includeNotes) {
      const noteDocs = await Note.find({ notebookId: notebook._id })
        .sort({ updatedAt: -1 })
        .lean();
      notes = noteDocs
        .map((doc) => serializeNote(doc))
        .filter((entry) => entry !== null);
    }

    const syncState = await NotebookSyncState.findOne({
      notebookId: notebook._id,
      userId: new mongoose.Types.ObjectId(ownerId),
      ...(clientId ? { clientId: String(clientId) } : {}),
    }).lean();

    return res.status(200).json({
      revision: notebook.offlineRevision ?? 0,
      snapshotHash: notebook.offlineSnapshotHash ?? null,
      snapshotUpdatedAt: notebook.offlineSnapshotUpdatedAt ?? null,
      notes,
      pendingOperations: syncState?.pendingOperations ?? [],
      baseRevision: syncState?.baseRevision ?? null,
      currentRevision: syncState?.currentRevision ?? null,
      lastSyncedAt: syncState?.lastSyncedAt ?? null,
      metadata: mapLikeToObject(syncState?.metadata),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to fetch notebook sync state", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

const queueNotebookIndexSafely = async (notebookId, reason) => {
  if (!notebookId) {
    return;
  }

  try {
    await enqueueNotebookIndexJob({
      notebookId,
      reason,
      force: reason === "offline-sync" ? true : undefined,
    });
  } catch (error) {
    logger.warn("Failed to enqueue notebook index job (sync)", {
      notebookId: notebookId?.toString?.() ?? String(notebookId),
      reason,
      message: error?.message,
    });
  }
};

export const pushNotebookSyncState = async (req, res) => {
  const session = await mongoose.startSession();
  let responsePayload = null;
  let notebookForIndexing = null;
  let indexReason = null;
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      await session.endSession();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const { id } = req.params;
    const {
      clientId = null,
      baseRevision = null,
      operations: rawOperations = [],
      snapshot = null,
      noteOrder = null,
    } = req.body ?? {};

    const operations = sanitizeOperations(rawOperations).filter(Boolean);

    await session.withTransaction(async () => {
      const notebook = await Notebook.findOne({
        _id: id,
        owner: ownerObjectId,
      }).session(session);

      if (!notebook) {
        throw new Error("NOTEBOOK_NOT_FOUND");
      }

      const serverRevision = notebook.offlineRevision ?? 0;
      const clientRevision = Number.parseInt(baseRevision, 10) || 0;

      if (clientRevision < serverRevision) {
        const conflictError = new Error("REVISION_CONFLICT");
        conflictError.serverRevision = serverRevision;
        conflictError.snapshotHash = notebook.offlineSnapshotHash ?? null;
        conflictError.snapshotUpdatedAt =
          notebook.offlineSnapshotUpdatedAt ?? null;
        throw conflictError;
      }

      const applied = [];
      const createdNotes = [];
      const updatedNotes = [];
      const deletedNoteIds = [];

      for (const operation of operations) {
        if (!operation?.type) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (
          operation.type === "note.upsert" ||
          operation.type === "note.create"
        ) {
          const { note: noteDoc, created } = await applyNoteUpsert({
            notebook,
            payload: operation.payload,
            ownerId: ownerObjectId,
            session,
          });
          applied.push({
            opId: operation.opId,
            type: "note.upsert",
            noteId: noteDoc._id.toString(),
          });
          if (created) {
            createdNotes.push(noteDoc._id.toString());
          } else {
            updatedNotes.push(noteDoc._id.toString());
          }
          continue;
        }

        if (operation.type === "note.delete") {
          const noteDoc = await applyNoteDelete({
            notebook,
            noteId: operation.noteId,
            ownerId: ownerObjectId,
            session,
          });
          applied.push({
            opId: operation.opId,
            type: "note.delete",
            noteId: noteDoc._id.toString(),
          });
          deletedNoteIds.push(noteDoc._id.toString());
          continue;
        }

        if (operation.type === "notebook.noteorder") {
          if (Array.isArray(operation.payload)) {
            const normalizedOrder = operation.payload
              .map((value) => normalizeObjectId(value))
              .filter(Boolean);
            notebook.noteOrder = normalizedOrder;
            await notebook.save({ session, validateModifiedOnly: true });
            applied.push({
              opId: operation.opId,
              type: "notebook.noteorder",
              noteOrder: normalizedOrder.map((value) => value.toString()),
            });
          }
          continue;
        }
      }

      if (Array.isArray(noteOrder)) {
        const normalizedOrder = noteOrder
          .map((value) => normalizeObjectId(value))
          .filter(Boolean);
        notebook.noteOrder = normalizedOrder;
        await notebook.save({ session, validateModifiedOnly: true });
      }

      let snapshotHash = null;
      if (snapshot !== null && snapshot !== undefined) {
        snapshotHash = computeNotebookSnapshotHash(snapshot);
      }

      const shouldBumpRevision =
        operations.length > 0 ||
        Array.isArray(noteOrder) ||
        (snapshot !== null && snapshot !== undefined);

      let nextRevision = serverRevision;
      if (shouldBumpRevision) {
        nextRevision =
          (await bumpNotebookOfflineRevision(notebook._id, {
            session,
            snapshotHash,
          })) ?? serverRevision + 1;
      }

      const syncStateUpdate = {
        notebookId: notebook._id,
        ownerId: notebook.owner,
        userId: ownerObjectId,
        baseRevision: clientRevision,
        currentRevision: nextRevision,
        lastSyncedAt: new Date(),
        pendingOperations: [],
        metadata: new Map(),
      };

      if (clientId) {
        syncStateUpdate.clientId = String(clientId);
      }
      if (snapshot !== null && snapshot !== undefined) {
        syncStateUpdate.snapshot = snapshot;
      }

      await NotebookSyncState.findOneAndUpdate(
        {
          notebookId: notebook._id,
          userId: ownerObjectId,
          ...(clientId ? { clientId: String(clientId) } : {}),
        },
        { $set: syncStateUpdate },
        { upsert: true, session }
      );

      if (applied.length) {
        await appendNotebookEvent(
          {
            notebookId: notebook._id,
            ownerId: notebook.owner,
            workspaceId: notebook.workspaceId ?? null,
            actorId: ownerObjectId,
            eventType: "notebook.sync",
            commandName: "pushNotebookSyncState",
            summary: `Applied ${applied.length} offline operations`,
            payload: {
              applied,
              createdNotes,
              updatedNotes,
              deletedNoteIds,
            },
            inversePayload: {
              action: "noop",
            },
          },
          { session }
        );

        notebookForIndexing = notebook._id;
        indexReason = "offline-sync";
      }

      responsePayload = {
        revision: nextRevision,
        applied,
        createdNotes,
        updatedNotes,
        deletedNoteIds,
        serverTime: new Date().toISOString(),
        snapshotHash,
      };
    });
  } catch (error) {
    await session.endSession();
    if (error?.message === "NOTEBOOK_NOT_FOUND") {
      return res.status(404).json({ message: "Notebook not found" });
    }
    if (error?.message === "REVISION_CONFLICT") {
      return res.status(409).json({
        message: "Revision conflict",
        serverRevision: error?.serverRevision ?? null,
        snapshotHash: error?.snapshotHash ?? null,
        snapshotUpdatedAt: error?.snapshotUpdatedAt ?? null,
      });
    }
    if (error?.message === "INVALID_NOTE_PAYLOAD") {
      return res.status(400).json({ message: "Invalid note payload" });
    }
    if (
      error?.message === "INVALID_NOTE_ID" ||
      error?.message === "NOTE_NOT_FOUND"
    ) {
      return res.status(404).json({ message: "Note not found" });
    }

    logger.error("Failed to push notebook sync state", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();
  if (responsePayload) {
    return res.status(200).json(responsePayload);
  }
  return res.status(200).json({ revision: null });
};

export default {
  getNotebookSyncState,
  pushNotebookSyncState,
};
