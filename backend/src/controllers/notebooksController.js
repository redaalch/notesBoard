import mongoose from "mongoose";
import Note from "../models/Note.js";
import CollabDocument from "../models/CollabDocument.js";
import NoteHistory from "../models/NoteHistory.js";
import logger from "../utils/logger.js";
import Notebook from "../models/Notebook.js";
import NotebookMember from "../models/NotebookMember.js";
import ShareLink from "../models/ShareLink.js";
import NotebookIndex from "../models/NotebookIndex.js";
import NotebookEvent from "../models/NotebookEvent.js";
import NotebookPublication from "../models/NotebookPublication.js";
import {
  appendNotesToNotebookOrder,
  ensureNotebookOwnership,
  normalizeObjectId,
  removeNotesFromNotebookOrder,
} from "../utils/notebooks.js";
import SavedNotebookQuery from "../models/SavedNotebookQuery.js";
import { resolveNoteForUser } from "../utils/access.js";
import {
  isAllowedNotebookColor,
  isAllowedNotebookIcon,
  normalizeNotebookColor,
  normalizeNotebookIcon,
} from "../../../shared/notebookOptions.js";
import { appendNotebookEvent } from "../services/notebookEventService.js";
import { enqueueNotebookIndexJob } from "../tasks/notebookIndexingWorker.js";
import { getNotebookRecommendations as computeNotebookRecommendations } from "../services/notebookRecommendationService.js";
import { buildSmartNotebook } from "../services/notebookSmartService.js";
import { applyUndoForNotebookEvent } from "../services/notebookUndoService.js";

const TRANSACTION_UNSUPPORTED_MESSAGE =
  "Transaction numbers are only allowed on a replica set member or mongos";

const isTransactionUnsupported = (error) =>
  typeof error?.message === "string" &&
  error.message.includes(TRANSACTION_UNSUPPORTED_MESSAGE);

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

const queueNotebookIndexSafely = async (notebookId, reason, options = {}) => {
  if (!notebookId) {
    return;
  }

  try {
    await enqueueNotebookIndexJob({
      notebookId,
      reason,
      force: options.force ?? false,
    });
  } catch (error) {
    logger.warn("Failed to enqueue notebook index job", {
      notebookId: notebookId?.toString?.() ?? String(notebookId),
      reason,
      message: error?.message,
    });
  }
};

const mapLikeToPlainObject = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "object") {
    return value;
  }
  return null;
};

const serializeDate = (value) =>
  value instanceof Date
    ? value.toISOString()
    : value
    ? new Date(value).toISOString()
    : null;

const serializeNotebookSnapshot = (notebookDoc) => {
  if (!notebookDoc) {
    return null;
  }

  return {
    id: notebookDoc._id?.toString?.() ?? null,
    owner: notebookDoc.owner?.toString?.() ?? null,
    workspaceId: notebookDoc.workspaceId?.toString?.() ?? null,
    name: notebookDoc.name ?? null,
    description: notebookDoc.description ?? "",
    color: notebookDoc.color ?? null,
    icon: notebookDoc.icon ?? null,
    isPublic: Boolean(notebookDoc.isPublic),
    publicSlug: notebookDoc.publicSlug ?? null,
    publicMetadata: mapLikeToPlainObject(notebookDoc.publicMetadata) ?? null,
    publishedAt: serializeDate(notebookDoc.publishedAt),
    noteOrder: Array.isArray(notebookDoc.noteOrder)
      ? notebookDoc.noteOrder
          .map((entry) => entry?.toString?.())
          .filter(Boolean)
      : [],
    offlineRevision: notebookDoc.offlineRevision ?? 0,
    offlineSnapshotHash: notebookDoc.offlineSnapshotHash ?? null,
    offlineSnapshotUpdatedAt: serializeDate(
      notebookDoc.offlineSnapshotUpdatedAt
    ),
    createdAt: serializeDate(notebookDoc.createdAt),
    updatedAt: serializeDate(notebookDoc.updatedAt),
  };
};

const serializeNoteSnapshot = (noteDoc) => {
  if (!noteDoc) {
    return null;
  }

  return {
    id: noteDoc._id?.toString?.() ?? null,
    owner: noteDoc.owner?.toString?.() ?? null,
    workspaceId: noteDoc.workspaceId?.toString?.() ?? null,
    boardId: noteDoc.boardId?.toString?.() ?? null,
    title: noteDoc.title ?? "",
    content: noteDoc.content ?? "",
    contentText: noteDoc.contentText ?? noteDoc.content ?? "",
    tags: Array.isArray(noteDoc.tags) ? [...noteDoc.tags] : [],
    pinned: Boolean(noteDoc.pinned),
    notebookId: noteDoc.notebookId?.toString?.() ?? null,
    createdAt: serializeDate(noteDoc.createdAt),
    updatedAt: serializeDate(noteDoc.updatedAt),
    docName: noteDoc.docName ?? null,
    richContent: noteDoc.richContent ?? null,
  };
};

const serializeMemberSnapshot = (memberDoc) => {
  if (!memberDoc) {
    return null;
  }

  return {
    id: memberDoc._id?.toString?.() ?? null,
    notebookId: memberDoc.notebookId?.toString?.() ?? null,
    userId: memberDoc.userId?.toString?.() ?? null,
    role: memberDoc.role ?? "viewer",
    status: memberDoc.status ?? "pending",
    invitedBy: memberDoc.invitedBy?.toString?.() ?? null,
    invitedAt: serializeDate(memberDoc.invitedAt),
    inviteTokenHash: memberDoc.inviteTokenHash ?? null,
    inviteExpiresAt: serializeDate(memberDoc.inviteExpiresAt),
    acceptedAt: serializeDate(memberDoc.acceptedAt),
    revokedAt: serializeDate(memberDoc.revokedAt),
    revokedBy: memberDoc.revokedBy?.toString?.() ?? null,
    lastNotifiedAt: serializeDate(memberDoc.lastNotifiedAt),
    metadata: mapLikeToPlainObject(memberDoc.metadata) ?? {},
    createdAt: serializeDate(memberDoc.createdAt),
    updatedAt: serializeDate(memberDoc.updatedAt),
  };
};

const serializeShareLinkSnapshot = (linkDoc) => {
  if (!linkDoc) {
    return null;
  }

  return {
    id: linkDoc._id?.toString?.() ?? null,
    resourceType: linkDoc.resourceType ?? "notebook",
    notebookId: linkDoc.notebookId?.toString?.() ?? null,
    boardId: linkDoc.boardId?.toString?.() ?? null,
    tokenHash: linkDoc.tokenHash ?? null,
    role: linkDoc.role ?? "viewer",
    expiresAt: serializeDate(linkDoc.expiresAt),
    createdBy: linkDoc.createdBy?.toString?.() ?? null,
    revokedAt: serializeDate(linkDoc.revokedAt),
    revokedBy: linkDoc.revokedBy?.toString?.() ?? null,
    lastAccessedAt: serializeDate(linkDoc.lastAccessedAt),
    metadata: mapLikeToPlainObject(linkDoc.metadata) ?? {},
    createdAt: serializeDate(linkDoc.createdAt),
    updatedAt: serializeDate(linkDoc.updatedAt),
  };
};

const serializeCollabDocumentSnapshot = (doc) => {
  if (!doc) {
    return null;
  }

  return {
    name: doc.name ?? null,
    state: doc.state ? Buffer.from(doc.state).toString("base64") : null,
    awareness: mapLikeToPlainObject(doc.awareness) ?? {},
    createdAt: serializeDate(doc.createdAt),
    updatedAt: serializeDate(doc.updatedAt),
  };
};

const serializeNotebookEvent = (event) => {
  if (!event) {
    return null;
  }

  const raw = event.toObject?.({ depopulate: true }) ?? event;
  const payload = mapLikeToPlainObject(raw.payload);
  const inversePayload = mapLikeToPlainObject(raw.inversePayload);
  const metadata = mapLikeToPlainObject(raw.metadata);

  return {
    id: raw._id?.toString?.() ?? null,
    notebookId: raw.notebookId?.toString?.() ?? null,
    actorId: raw.actorId?.toString?.() ?? null,
    eventType: raw.eventType ?? null,
    commandName: raw.commandName ?? null,
    summary: raw.summary ?? null,
    noteId: raw.noteId?.toString?.() ?? null,
    prevEventId: raw.prevEventId?.toString?.() ?? null,
    parentEventId: raw.parentEventId?.toString?.() ?? null,
    version: raw.version ?? 1,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    payload,
    inversePayload,
    metadata,
  };
};

export const listNotebooks = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notebooks = await Notebook.find({ owner: ownerId })
      .sort({ createdAt: 1 })
      .lean();

    const notebookIds = notebooks.map((doc) => doc._id);
    const counts = await Note.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(ownerId),
        },
      },
      {
        $group: {
          _id: "$notebookId",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(
      counts.map((entry) => [String(entry._id), entry.count])
    );

    const response = notebooks.map((notebook) => ({
      id: notebook._id.toString(),
      name: notebook.name,
      color: notebook.color,
      icon: notebook.icon,
      description: notebook.description,
      noteCount: countMap.get(notebook._id.toString()) ?? 0,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    }));

    const uncategorizedCount =
      countMap.get("null") ?? countMap.get("undefined") ?? 0;

    return res.status(200).json({
      notebooks: response,
      uncategorizedCount,
    });
  } catch (error) {
    logger.error("Failed to list notebooks", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const createNotebook = async (req, res) => {
  const ownerId = req.user?.id;
  if (!ownerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { name, color, icon, description = "" } = req.body ?? {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Name is required" });
  }

  if (color !== undefined && !isAllowedNotebookColor(color)) {
    return res.status(400).json({ message: "Invalid notebook color" });
  }

  if (icon !== undefined && !isAllowedNotebookIcon(icon)) {
    return res.status(400).json({ message: "Invalid notebook icon" });
  }

  const normalizedColor =
    color === undefined ? null : normalizeNotebookColor(color);
  const normalizedIcon =
    icon === undefined ? null : normalizeNotebookIcon(icon);
  const normalizedDescription =
    typeof description === "string" ? description.trim() : "";

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (sessionError) {
    logger.warn(
      "Failed to start mongoose session; continuing without transaction",
      {
        message: sessionError?.message,
      }
    );
    session = null;
  }

  const runCreate = async (activeSession = null) => {
    const createOptions = {};
    if (activeSession) {
      createOptions.session = activeSession;
    }

    const [notebook] = await Notebook.create(
      [
        {
          owner: ownerId,
          name: name.trim(),
          color: normalizedColor,
          icon: normalizedIcon,
          description: normalizedDescription,
        },
      ],
      createOptions
    );

    const notebookObject = notebook.toObject();

    try {
      const membershipOptions = {};
      if (activeSession) {
        membershipOptions.session = activeSession;
      }
      await NotebookMember.findOneAndUpdate(
        {
          notebookId: notebook._id,
          userId: notebook.owner,
        },
        {
          $setOnInsert: {
            role: "owner",
            status: "active",
            invitedBy: notebook.owner,
            invitedAt: notebook.createdAt ?? new Date(),
            acceptedAt: notebook.createdAt ?? new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          ...membershipOptions,
        }
      );
    } catch (membershipError) {
      logger.error("Failed to seed notebook owner membership", {
        message: membershipError?.message,
        notebookId: notebook._id?.toString?.() ?? null,
      });
    }

    const eventOptions = activeSession ? { session: activeSession } : {};

    await appendNotebookEvent(
      {
        notebookId: notebook._id,
        ownerId: notebook.owner,
        workspaceId: notebook.workspaceId ?? null,
        actorId: notebook.owner,
        eventType: "notebook.create",
        commandName: "createNotebook",
        summary: `Created notebook ${notebook.name}`,
        payload: {
          name: notebook.name,
          color: notebook.color,
          icon: notebook.icon,
          description: notebook.description,
        },
        inversePayload: {
          action: "deleteNotebook",
          notebookId: notebook._id,
        },
      },
      eventOptions
    );

    return notebookObject;
  };

  let notebookRecord = null;

  try {
    if (session) {
      try {
        await session.withTransaction(async () => {
          notebookRecord = await runCreate(session);
        });
      } catch (error) {
        if (isTransactionUnsupported(error)) {
          logger.warn(
            "MongoDB deployment does not support transactions; retrying notebook create without session"
          );
          notebookRecord = await runCreate(null);
        } else {
          throw error;
        }
      }
    } else {
      notebookRecord = await runCreate(null);
    }
  } catch (error) {
    if (session) {
      await session.endSession();
    }
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "A notebook with this name already exists" });
    }
    logger.error("Failed to create notebook", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  if (session) {
    await session.endSession();
  }

  if (notebookRecord) {
    await queueNotebookIndexSafely(notebookRecord._id, "notebook-create", {
      force: true,
    });

    return res.status(201).json({
      id: notebookRecord._id.toString(),
      name: notebookRecord.name,
      color: notebookRecord.color,
      icon: notebookRecord.icon,
      description: notebookRecord.description,
      createdAt: notebookRecord.createdAt,
      updatedAt: notebookRecord.updatedAt,
    });
  }

  return res.status(500).json(INTERNAL_SERVER_ERROR);
};

export const updateNotebook = async (req, res) => {
  const ownerId = req.user?.id;
  if (!ownerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id } = req.params;

  const updates = {};
  const { name, color, icon, description } = req.body ?? {};

  if (typeof name === "string" && name.trim().length) {
    updates.name = name.trim();
  }

  if (color !== undefined) {
    if (!isAllowedNotebookColor(color)) {
      return res.status(400).json({ message: "Invalid notebook color" });
    }
    updates.color = normalizeNotebookColor(color);
  }

  if (icon !== undefined) {
    if (!isAllowedNotebookIcon(icon)) {
      return res.status(400).json({ message: "Invalid notebook icon" });
    }
    updates.icon = normalizeNotebookIcon(icon);
  }

  if (typeof description === "string") {
    updates.description = description.trim();
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: "No updates provided" });
  }

  const session = await mongoose.startSession();
  let updatedNotebook = null;
  const actorObjectId = new mongoose.Types.ObjectId(ownerId);

  try {
    await session.withTransaction(async () => {
      const notebookDoc = await Notebook.findOne({
        _id: id,
        owner: actorObjectId,
      }).session(session);

      if (!notebookDoc) {
        throw new Error("NOTEBOOK_NOT_FOUND");
      }

      const previousState = {
        name: notebookDoc.name,
        color: notebookDoc.color,
        icon: notebookDoc.icon,
        description: notebookDoc.description,
      };

      Object.entries(updates).forEach(([key, value]) => {
        notebookDoc.set(key, value);
      });

      await notebookDoc.save({ session });
      updatedNotebook = notebookDoc.toObject();

      await appendNotebookEvent(
        {
          notebookId: notebookDoc._id,
          ownerId: notebookDoc.owner,
          workspaceId: notebookDoc.workspaceId ?? null,
          actorId: actorObjectId,
          eventType: "notebook.update",
          commandName: "updateNotebook",
          summary: `Updated notebook ${notebookDoc.name}`,
          payload: {
            updates,
          },
          inversePayload: {
            action: "restoreNotebookFields",
            previous: previousState,
          },
        },
        { session }
      );
    });
  } catch (error) {
    await session.endSession();
    if (error?.message === "NOTEBOOK_NOT_FOUND") {
      return res.status(404).json({ message: "Notebook not found" });
    }
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "A notebook with this name already exists" });
    }
    logger.error("Failed to update notebook", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();

  if (updatedNotebook) {
    await queueNotebookIndexSafely(updatedNotebook._id, "notebook-update");

    return res.status(200).json({
      id: updatedNotebook._id.toString(),
      name: updatedNotebook.name,
      color: updatedNotebook.color,
      icon: updatedNotebook.icon,
      description: updatedNotebook.description,
      createdAt: updatedNotebook.createdAt,
      updatedAt: updatedNotebook.updatedAt,
    });
  }

  return res.status(500).json(INTERNAL_SERVER_ERROR);
};

export const deleteNotebook = async (req, res) => {
  const ownerId = req.user?.id;
  if (!ownerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id } = req.params;
  const {
    mode = "move",
    targetNotebookId = null,
    deleteCollaborative = false,
  } = req.body ?? {};

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const session = await mongoose.startSession();
  let responsePayload = null;
  let targetNotebookObjectId = null;
  let sourceNotebookId = null;

  try {
    await session.withTransaction(async () => {
      const notebookDoc = await Notebook.findOne({
        _id: id,
        owner: ownerObjectId,
      }).session(session);

      if (!notebookDoc) {
        throw new Error("NOTEBOOK_NOT_FOUND");
      }

      sourceNotebookId = notebookDoc._id;

      if (mode === "move" && targetNotebookId) {
        if (String(targetNotebookId) === String(notebookDoc._id)) {
          throw new Error("NOTEBOOK_TARGET_INVALID");
        }
        const targetNotebook = await Notebook.findOne({
          _id: targetNotebookId,
          owner: ownerObjectId,
        })
          .session(session)
          .lean();

        if (!targetNotebook) {
          throw new Error("TARGET_NOTEBOOK_NOT_FOUND");
        }
        targetNotebookObjectId = targetNotebook._id;
      }

      const noteDocs = await Note.find({ notebookId: notebookDoc._id })
        .session(session)
        .lean();

      const noteIds = noteDocs.map((doc) => doc._id);
      const docNames = noteDocs
        .map((doc) => doc.docName)
        .filter((value) => typeof value === "string" && value.length > 0);

      const memberDocs = await NotebookMember.find({
        notebookId: notebookDoc._id,
      })
        .session(session)
        .lean();

      const shareLinkDocs = await ShareLink.find({
        notebookId: notebookDoc._id,
      })
        .session(session)
        .lean();

      const publicationDoc = await NotebookPublication.findOne({
        notebookId: notebookDoc._id,
      })
        .session(session)
        .lean();

      const collabDocs =
        deleteCollaborative && docNames.length
          ? await CollabDocument.find({ name: { $in: docNames } })
              .session(session)
              .lean()
          : [];

      let deletedNotes = 0;
      let movedNotes = 0;

      if (mode === "delete") {
        if (noteIds.length) {
          const deleteResult = await Note.deleteMany(
            { _id: { $in: noteIds } },
            { session }
          );
          deletedNotes = deleteResult?.deletedCount ?? noteIds.length;
          if (docNames.length && deleteCollaborative) {
            await CollabDocument.deleteMany(
              { name: { $in: docNames } },
              { session }
            );
          }
          if (noteDocs.length) {
            const historyPayload = noteDocs.map((note) => ({
              noteId: note._id,
              workspaceId: note.workspaceId ?? null,
              boardId: note.boardId ?? null,
              actorId: ownerObjectId,
              eventType: "delete",
              summary: "Deleted as part of notebook removal",
            }));
            await NoteHistory.insertMany(historyPayload, { session });
          }
        }
      } else {
        const updatePayload = targetNotebookObjectId
          ? { notebookId: targetNotebookObjectId }
          : { notebookId: null };
        if (noteIds.length) {
          const updateResult = await Note.updateMany(
            { _id: { $in: noteIds } },
            { $set: updatePayload },
            { session }
          );
          movedNotes = updateResult?.modifiedCount ?? noteIds.length;
          if (targetNotebookObjectId) {
            await appendNotesToNotebookOrder(targetNotebookObjectId, noteIds, {
              session,
            });
          }
        }
      }

      if (noteIds.length) {
        await removeNotesFromNotebookOrder(notebookDoc._id, noteIds, {
          session,
        });
      }

      await Notebook.deleteOne({ _id: notebookDoc._id }, { session });

      await Promise.all([
        NotebookMember.deleteMany({ notebookId: notebookDoc._id }, { session }),
        ShareLink.deleteMany({ notebookId: notebookDoc._id }, { session }),
        NotebookPublication.deleteMany(
          { notebookId: notebookDoc._id },
          { session }
        ),
        NotebookIndex.deleteOne({ notebookId: notebookDoc._id }, { session }),
      ]);

      await appendNotebookEvent(
        {
          notebookId: notebookDoc._id,
          ownerId: notebookDoc.owner,
          workspaceId: notebookDoc.workspaceId ?? null,
          actorId: ownerObjectId,
          eventType: "notebook.delete",
          commandName: "deleteNotebook",
          summary: `Deleted notebook ${notebookDoc.name}`,
          payload: {
            mode,
            targetNotebookId: targetNotebookObjectId
              ? targetNotebookObjectId.toString()
              : null,
            deletedNotes,
            movedNotes,
            noteIds: noteIds.map((docId) => docId.toString()),
          },
          inversePayload: {
            action: "restoreNotebook",
            notebook: serializeNotebookSnapshot(notebookDoc),
            notes: noteDocs
              .map((note) => serializeNoteSnapshot(note))
              .filter(Boolean),
            members: memberDocs
              .map((member) => serializeMemberSnapshot(member))
              .filter(Boolean),
            shareLinks: shareLinkDocs
              .map((link) => serializeShareLinkSnapshot(link))
              .filter(Boolean),
            collabDocuments: collabDocs
              .map((doc) => serializeCollabDocumentSnapshot(doc))
              .filter(Boolean),
            publication: publicationDoc
              ? {
                  id: publicationDoc._id?.toString?.() ?? null,
                  publicSlug: publicationDoc.publicSlug ?? null,
                  snapshot: mapLikeToPlainObject(publicationDoc.snapshot),
                  snapshotHash: publicationDoc.snapshotHash ?? null,
                  html: publicationDoc.html ?? null,
                  metadata: mapLikeToPlainObject(publicationDoc.metadata) ?? {},
                  publishedAt: serializeDate(publicationDoc.publishedAt),
                  createdAt: serializeDate(publicationDoc.createdAt),
                  updatedAt: serializeDate(publicationDoc.updatedAt),
                }
              : null,
            deleteCollaborative: Boolean(
              deleteCollaborative && docNames.length
            ),
          },
        },
        { session }
      );

      responsePayload = {
        id: notebookDoc._id.toString(),
        deletedNotes,
        movedNotes,
      };
    });
  } catch (error) {
    await session.endSession();
    if (error?.message === "NOTEBOOK_NOT_FOUND") {
      return res.status(404).json({ message: "Notebook not found" });
    }
    if (error?.message === "TARGET_NOTEBOOK_NOT_FOUND") {
      return res.status(404).json({ message: "Target notebook not found" });
    }
    if (error?.message === "NOTEBOOK_TARGET_INVALID") {
      return res
        .status(400)
        .json({ message: "Cannot move notes to the same notebook" });
    }
    logger.error("Failed to delete notebook", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();

  if (responsePayload) {
    if (targetNotebookObjectId) {
      await queueNotebookIndexSafely(
        targetNotebookObjectId,
        "notebook-delete-move",
        { force: true }
      );
    }

    if (sourceNotebookId) {
      await NotebookIndex.deleteOne({ notebookId: sourceNotebookId });
    }

    return res.status(200).json(responsePayload);
  }

  return res.status(500).json(INTERNAL_SERVER_ERROR);
};

export const moveNotesToNotebook = async (req, res) => {
  const ownerId = req.user?.id;
  if (!ownerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id } = req.params;
  const { noteIds } = req.body ?? {};
  if (!Array.isArray(noteIds) || !noteIds.length) {
    return res.status(400).json({ message: "No note ids provided" });
  }

  const normalized = noteIds
    .map((value) => normalizeObjectId(value))
    .filter(Boolean);
  if (!normalized.length) {
    return res.status(400).json({ message: "No valid note ids provided" });
  }

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const session = await mongoose.startSession();
  let movedCount = 0;
  const affectedNotebookIds = new Set();
  let responseNotebookId = id;

  try {
    await session.withTransaction(async () => {
      const notebook = await ensureNotebookOwnership(id, ownerId, {
        session,
      });

      if (!notebook) {
        throw new Error("NOTEBOOK_NOT_FOUND");
      }

      responseNotebookId = notebook._id.toString();

      const notes = await Note.find({
        _id: { $in: normalized },
        owner: ownerObjectId,
      })
        .session(session)
        .select({ _id: 1, notebookId: 1 })
        .lean();

      if (!notes.length) {
        throw new Error("NO_NOTES_FOUND");
      }

      const noteObjectIds = notes.map((note) => note._id);
      const updateResult = await Note.updateMany(
        { _id: { $in: noteObjectIds } },
        { $set: { notebookId: notebook._id } },
        { session }
      );
      movedCount = updateResult?.modifiedCount ?? notes.length;

      const sourceNotebookIds = new Set(
        notes
          .map((note) => note.notebookId)
          .filter((value) => value)
          .map((value) => value.toString())
      );

      for (const notebookId of sourceNotebookIds) {
        affectedNotebookIds.add(notebookId);
        await removeNotesFromNotebookOrder(
          new mongoose.Types.ObjectId(notebookId),
          noteObjectIds,
          { session }
        );
      }

      await appendNotesToNotebookOrder(notebook._id, noteObjectIds, {
        session,
      });
      affectedNotebookIds.add(notebook._id.toString());

      await appendNotebookEvent(
        {
          notebookId: notebook._id,
          ownerId: notebook.owner,
          workspaceId: notebook.workspaceId ?? null,
          actorId: ownerObjectId,
          eventType: "notebook.move-notes",
          commandName: "moveNotesToNotebook",
          summary: `Moved ${movedCount} notes into ${notebook.name}`,
          payload: {
            noteIds: noteObjectIds.map((value) => value.toString()),
            sourceNotebookIds: Array.from(sourceNotebookIds),
          },
          inversePayload: {
            action: "restoreNoteNotebook",
            noteIds: noteObjectIds.map((value) => value.toString()),
            previousNotebookIds: notes.map((note) => ({
              noteId: note._id.toString(),
              notebookId: note.notebookId ? note.notebookId.toString() : null,
            })),
          },
        },
        { session }
      );
    });
  } catch (error) {
    await session.endSession();
    if (error?.message === "NOTEBOOK_NOT_FOUND") {
      return res.status(404).json({ message: "Notebook not found" });
    }
    if (error?.message === "NO_NOTES_FOUND") {
      return res.status(404).json({ message: "No matching notes found" });
    }
    logger.error("Failed to move notes to notebook", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();

  for (const notebookId of affectedNotebookIds) {
    await queueNotebookIndexSafely(notebookId, "move-notes");
  }

  return res.status(200).json({
    notebookId: responseNotebookId,
    moved: movedCount,
  });
};

export const getNotebookRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const noteId = req.query?.noteId;
    if (!noteId || !mongoose.Types.ObjectId.isValid(noteId)) {
      return res
        .status(400)
        .json({ message: "A valid noteId query parameter is required" });
    }

    const access = await resolveNoteForUser(noteId, userId);
    if (!access) {
      return res.status(404).json({ message: "Note not found" });
    }

    const note = access.note?.toObject?.({ depopulate: true }) ?? access.note;
    const limit = req.query?.limit;

    const recommendations = await computeNotebookRecommendations({
      userId,
      note,
      limit,
    });

    return res.status(200).json({ recommendations });
  } catch (error) {
    logger.error("Failed to compute notebook recommendations", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getSmartNotebook = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      tag = null,
      search = null,
      limit = undefined,
      savedQueryId = null,
    } = req.query ?? {};

    let savedQuery = null;
    if (savedQueryId) {
      if (!mongoose.Types.ObjectId.isValid(savedQueryId)) {
        return res.status(400).json({ message: "Invalid savedQueryId" });
      }

      savedQuery = await SavedNotebookQuery.findOne({
        _id: savedQueryId,
        userId: new mongoose.Types.ObjectId(userId),
      }).lean();

      if (!savedQuery) {
        return res.status(404).json({ message: "Saved query not found" });
      }
    }

    if (!tag && !search && !savedQuery) {
      return res.status(400).json({
        message: "tag, search or savedQueryId query parameter is required",
      });
    }

    const mapLikeToObject = (value) => {
      if (!value) return null;
      if (value instanceof Map) {
        return Object.fromEntries(value.entries());
      }
      if (typeof value === "object" && !Array.isArray(value)) {
        return { ...value };
      }
      return value;
    };

    const normalizedSavedQuery = savedQuery
      ? {
          id: savedQuery._id.toString(),
          notebookId: savedQuery.notebookId?.toString?.() ?? null,
          ownerId: savedQuery.ownerId?.toString?.() ?? null,
          userId: savedQuery.userId?.toString?.() ?? null,
          name: savedQuery.name,
          query: savedQuery.query ?? "",
          filters:
            savedQuery.filters && typeof savedQuery.filters === "object"
              ? JSON.parse(JSON.stringify(savedQuery.filters))
              : null,
          sort: mapLikeToObject(savedQuery.sort),
          scope: savedQuery.scope ?? "notebook",
          metadata: mapLikeToObject(savedQuery.metadata),
        }
      : null;

    const smartNotebook = await buildSmartNotebook({
      userId,
      tag,
      search,
      limit,
      savedQuery: normalizedSavedQuery,
    });

    return res.status(200).json(smartNotebook ?? {});
  } catch (error) {
    logger.error("Failed to build smart notebook", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getNotebookHistory = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid notebook id" });
    }

    const notebook = await ensureNotebookOwnership(id, ownerId);
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    const limit = Math.max(
      1,
      Math.min(Number.parseInt(req.query?.limit ?? "50", 10) || 50, 200)
    );

    const events = await NotebookEvent.find({ notebookId: notebook._id })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = events.length > limit;
    const trimmed = hasMore ? events.slice(0, limit) : events;

    const payload = trimmed
      .map((event) => serializeNotebookEvent(event))
      .filter(Boolean);

    return res.status(200).json({ events: payload, hasMore });
  } catch (error) {
    logger.error("Failed to fetch notebook history", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const undoNotebookHistoryEvent = async (req, res) => {
  const ownerId = req.user?.id;
  if (!ownerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id } = req.params;
  const { eventId } = req.body ?? {};

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid notebook id" });
  }

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ message: "A valid eventId is required" });
  }

  const session = await mongoose.startSession();
  let undoSummary = null;

  try {
    await session.withTransaction(async () => {
      const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
      const notebookObjectId = new mongoose.Types.ObjectId(id);
      const eventObjectId = new mongoose.Types.ObjectId(eventId);

      const event = await NotebookEvent.findOne({
        _id: eventObjectId,
        notebookId: notebookObjectId,
      }).session(session);

      if (!event) {
        throw new Error("EVENT_NOT_FOUND");
      }

      if (event.ownerId?.toString?.() !== ownerId) {
        throw new Error("NOTEBOOK_NOT_FOUND");
      }

      const eventMetadata = mapLikeToPlainObject(event.metadata) ?? {};
      if (eventMetadata?.undoneAt) {
        throw new Error("EVENT_ALREADY_UNDONE");
      }

      const inversePayload = mapLikeToPlainObject(event.inversePayload) ?? {};
      const inferredAction = inversePayload?.action ?? null;
      const fallbackAction = inversePayload?.previous
        ? "restoreNotebookFields"
        : null;
      const undoAction = inferredAction ?? fallbackAction;

      let notebook = await Notebook.findOne({
        _id: notebookObjectId,
        owner: ownerObjectId,
      }).session(session);

      if (!notebook) {
        if (undoAction === "restoreNotebook") {
          const workspaceIdValue = inversePayload?.notebook?.workspaceId;
          const workspaceId =
            workspaceIdValue &&
            mongoose.Types.ObjectId.isValid(workspaceIdValue)
              ? new mongoose.Types.ObjectId(workspaceIdValue)
              : null;

          notebook = {
            _id: notebookObjectId,
            owner: ownerObjectId,
            workspaceId,
          };
        } else {
          throw new Error("NOTEBOOK_NOT_FOUND");
        }
      }

      const newerEvent = await NotebookEvent.findOne({
        notebookId: notebookObjectId,
        createdAt: { $gt: event.createdAt },
      })
        .sort({ createdAt: 1 })
        .session(session);

      if (newerEvent) {
        throw new Error("EVENT_CONFLICT");
      }

      const undoResult = await applyUndoForNotebookEvent({
        notebook,
        event,
        session,
      });

      if (!undoResult?.supported) {
        throw new Error("UNDO_UNSUPPORTED");
      }

      const now = new Date();

      await NotebookEvent.updateOne(
        { _id: event._id },
        {
          $set: {
            "metadata.undoneAt": now,
            "metadata.undoneBy": ownerObjectId,
            "metadata.undoAction": undoResult.action ?? null,
          },
        },
        { session }
      );

      const workspaceContext = (() => {
        if (notebook?.workspaceId) {
          return notebook.workspaceId;
        }
        const workspaceIdValue = inversePayload?.notebook?.workspaceId;
        if (
          workspaceIdValue &&
          mongoose.Types.ObjectId.isValid(workspaceIdValue)
        ) {
          return new mongoose.Types.ObjectId(workspaceIdValue);
        }
        return null;
      })();

      const undoEntry = await appendNotebookEvent(
        {
          notebookId: event.notebookId,
          ownerId: event.ownerId,
          workspaceId: workspaceContext,
          actorId: ownerObjectId,
          eventType: "notebook.undo",
          commandName: "undoNotebookEvent",
          summary: `Undid ${event.commandName ?? event.eventType}`,
          payload: {
            undoOf: event._id,
            action: undoResult.action ?? null,
          },
          inversePayload: {
            action: "noop",
            originalEventId: event._id,
          },
          metadata: {
            undoOf: event._id,
            undoAction: undoResult.action ?? null,
          },
        },
        { session }
      );

      undoSummary = {
        success: true,
        action: undoResult.action ?? null,
        undoneEventId: event._id.toString(),
        undoEventId: undoEntry?._id?.toString?.() ?? null,
        affectedNotebookIds: Array.from(
          new Set(undoResult.affectedNotebookIds ?? [])
        ),
      };
    });
  } catch (error) {
    await session.endSession();

    if (error?.message === "NOTEBOOK_NOT_FOUND") {
      return res.status(404).json({ message: "Notebook not found" });
    }
    if (error?.message === "EVENT_NOT_FOUND") {
      return res.status(404).json({ message: "Event not found" });
    }
    if (error?.message === "EVENT_ALREADY_UNDONE") {
      return res.status(409).json({ message: "Event already undone" });
    }
    if (error?.message === "EVENT_CONFLICT") {
      return res
        .status(409)
        .json({ message: "Newer history entries exist for this notebook" });
    }
    if (
      error?.message === "UNDO_UNSUPPORTED" ||
      error?.message === "UNDO_UNSUPPORTED_PAYLOAD"
    ) {
      return res
        .status(409)
        .json({ message: "Undo is not supported for this event" });
    }

    logger.error("Failed to undo notebook event", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();

  if (!undoSummary) {
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  const indexIds = new Set(undoSummary.affectedNotebookIds ?? []);
  for (const notebookId of indexIds) {
    await queueNotebookIndexSafely(notebookId, "undo");
  }

  return res.status(200).json(undoSummary);
};

export default {
  listNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  moveNotesToNotebook,
  getNotebookRecommendations,
  getSmartNotebook,
  getNotebookHistory,
  undoNotebookHistoryEvent,
};
