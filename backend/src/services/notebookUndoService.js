import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";
import Note from "../models/Note.js";
import NotebookMember from "../models/NotebookMember.js";
import ShareLink from "../models/ShareLink.js";
import NotebookPublication from "../models/NotebookPublication.js";
import CollabDocument from "../models/CollabDocument.js";
import NotebookIndex from "../models/NotebookIndex.js";
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

const toPlainArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value;
};

const toDate = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const decodeStateBuffer = (encoded) => {
  if (!encoded || typeof encoded !== "string") {
    return null;
  }
  try {
    return Buffer.from(encoded, "base64");
  } catch (_error) {
    return null;
  }
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

const deleteNotebook = async ({ notebook, session }) => {
  const notebookId = toObjectId(notebook?._id);
  if (!notebookId) {
    throw new Error("UNDO_UNSUPPORTED_PAYLOAD");
  }

  await Promise.all([
    Note.deleteMany({ notebookId }, { session }),
    NotebookMember.deleteMany({ notebookId }, { session }),
    ShareLink.deleteMany({ notebookId }, { session }),
    NotebookPublication.deleteMany({ notebookId }, { session }),
    NotebookIndex.deleteOne({ notebookId }, { session }),
  ]);

  await Notebook.deleteOne({ _id: notebookId }, { session });

  return {
    affectedNotebookIds: [],
  };
};

const restoreNotebook = async ({ notebook, inverse, event, session }) => {
  const snapshot = toPlainObject(inverse.notebook);
  if (!Object.keys(snapshot).length) {
    throw new Error("UNDO_UNSUPPORTED_PAYLOAD");
  }

  const notebookId = toObjectId(snapshot.id ?? notebook?._id);
  const ownerId = toObjectId(snapshot.owner ?? notebook?.owner);

  if (!notebookId || !ownerId) {
    throw new Error("UNDO_UNSUPPORTED_PAYLOAD");
  }

  const workspaceId = toObjectId(snapshot.workspaceId);
  const isPublic = Boolean(snapshot.isPublic);

  await Notebook.create(
    [
      {
        _id: notebookId,
        owner: ownerId,
        workspaceId,
        name: snapshot.name ?? "Untitled Notebook",
        description: snapshot.description ?? "",
        color: snapshot.color ?? null,
        icon: snapshot.icon ?? null,
        isPublic,
        publicSlug: snapshot.publicSlug ?? null,
        publicMetadata: toPlainObject(snapshot.publicMetadata) ?? null,
        publishedAt: toDate(snapshot.publishedAt),
        noteOrder: Array.isArray(snapshot.noteOrder)
          ? snapshot.noteOrder
              .map((value) => toObjectId(value))
              .filter((value) => value !== null)
          : [],
        offlineRevision: snapshot.offlineRevision ?? 0,
        offlineSnapshotHash: snapshot.offlineSnapshotHash ?? null,
        offlineSnapshotUpdatedAt: toDate(snapshot.offlineSnapshotUpdatedAt),
      },
    ],
    { session }
  );

  const memberSnapshots = toPlainArray(inverse.members);
  const memberDocs = memberSnapshots
    .map((member) => {
      const userId = toObjectId(member.userId);
      if (!userId) {
        return null;
      }
      return {
        notebookId,
        userId,
        role: member.role ?? "viewer",
        status: member.status ?? "pending",
        invitedBy: toObjectId(member.invitedBy) ?? ownerId,
        invitedAt: toDate(member.invitedAt) ?? new Date(),
        inviteTokenHash: member.inviteTokenHash ?? null,
        inviteExpiresAt: toDate(member.inviteExpiresAt),
        acceptedAt: toDate(member.acceptedAt),
        revokedAt: toDate(member.revokedAt),
        revokedBy: toObjectId(member.revokedBy),
        lastNotifiedAt: toDate(member.lastNotifiedAt),
        metadata: toPlainObject(member.metadata),
        createdAt: toDate(member.createdAt) ?? undefined,
        updatedAt: toDate(member.updatedAt) ?? undefined,
      };
    })
    .filter(Boolean);

  const ownerMembershipExists = memberDocs.some(
    (doc) => doc.userId?.toString?.() === ownerId.toString()
  );

  if (!ownerMembershipExists) {
    memberDocs.push({
      notebookId,
      userId: ownerId,
      role: "owner",
      status: "active",
      invitedBy: ownerId,
      invitedAt: new Date(),
      acceptedAt: new Date(),
      metadata: {},
    });
  }

  if (memberDocs.length) {
    await NotebookMember.insertMany(memberDocs, {
      session,
      ordered: false,
    });
  }

  const noteSnapshots = toPlainArray(inverse.notes);
  const noteObjectIds = noteSnapshots
    .map((note) => toObjectId(note.id))
    .filter((value) => value !== null);

  const existingNotes = noteObjectIds.length
    ? await Note.find({ _id: { $in: noteObjectIds } })
        .session(session)
        .select({ _id: 1, notebookId: 1 })
        .lean()
    : [];

  const existingNoteMap = new Map(
    existingNotes.map((doc) => [doc._id.toString(), doc])
  );

  const notesToInsert = [];
  const notesToUpdate = [];
  const previousNotebookIds = new Map();

  noteSnapshots.forEach((snapshotNote) => {
    const noteId = toObjectId(snapshotNote.id);
    if (!noteId) {
      return;
    }

    const owner = toObjectId(snapshotNote.owner) ?? ownerId;
    const workspaceIdValue = toObjectId(snapshotNote.workspaceId);
    const boardIdValue = toObjectId(snapshotNote.boardId);
    const normalizedTags = Array.isArray(snapshotNote.tags)
      ? snapshotNote.tags.filter((tag) => typeof tag === "string")
      : [];

    const baseNote = {
      _id: noteId,
      owner,
      notebookId,
      workspaceId: workspaceIdValue,
      boardId: boardIdValue,
      title: snapshotNote.title ?? "",
      content: snapshotNote.content ?? "",
      contentText: snapshotNote.contentText ?? snapshotNote.content ?? "",
      tags: normalizedTags,
      pinned: Boolean(snapshotNote.pinned),
      docName: snapshotNote.docName ?? undefined,
      richContent: snapshotNote.richContent ?? null,
      createdAt: toDate(snapshotNote.createdAt) ?? undefined,
      updatedAt: toDate(snapshotNote.updatedAt) ?? undefined,
    };

    const existing = existingNoteMap.get(noteId.toString());
    if (existing) {
      notesToUpdate.push(baseNote);
      if (
        existing.notebookId &&
        existing.notebookId.toString() !== notebookId.toString()
      ) {
        const key = existing.notebookId.toString();
        if (!previousNotebookIds.has(key)) {
          previousNotebookIds.set(key, []);
        }
        previousNotebookIds.get(key).push(noteId);
      }
    } else {
      notesToInsert.push(baseNote);
    }
  });

  if (notesToInsert.length) {
    await Note.insertMany(notesToInsert, { session, ordered: false });
  }

  for (const notePayload of notesToUpdate) {
    const updateSet = { ...notePayload };
    delete updateSet._id;
    await Note.updateOne(
      { _id: notePayload._id },
      { $set: updateSet },
      { session }
    );
  }

  for (const [previousNotebookId, noteIdsForNotebook] of previousNotebookIds) {
    await removeNotesFromNotebookOrder(
      new mongoose.Types.ObjectId(previousNotebookId),
      noteIdsForNotebook,
      { session }
    );
  }

  const eventPayload = toPlainObject(event?.payload);
  const targetNotebookFromPayload = toObjectId(eventPayload?.targetNotebookId);
  const movedNoteIds = toPlainArray(eventPayload?.noteIds)
    .map((value) => toObjectId(value))
    .filter((value) => value !== null);

  if (targetNotebookFromPayload && movedNoteIds.length) {
    await removeNotesFromNotebookOrder(
      targetNotebookFromPayload,
      movedNoteIds,
      { session }
    );
  }

  const noteOrderIds = Array.isArray(snapshot.noteOrder)
    ? snapshot.noteOrder
        .map((value) => toObjectId(value))
        .filter((value) => value !== null)
    : [];

  if (noteOrderIds.length) {
    await Notebook.updateOne(
      { _id: notebookId },
      { $set: { noteOrder: noteOrderIds } },
      { session }
    );
  }

  const shareLinkSnapshots = toPlainArray(inverse.shareLinks);
  if (shareLinkSnapshots.length) {
    const shareLinkDocs = shareLinkSnapshots
      .map((link) => ({
        notebookId,
        boardId: toObjectId(link.boardId),
        resourceType: link.resourceType ?? "notebook",
        tokenHash: link.tokenHash,
        role: link.role ?? "viewer",
        expiresAt: toDate(link.expiresAt),
        createdBy: toObjectId(link.createdBy) ?? ownerId,
        revokedAt: toDate(link.revokedAt),
        revokedBy: toObjectId(link.revokedBy),
        lastAccessedAt: toDate(link.lastAccessedAt),
        metadata: toPlainObject(link.metadata),
      }))
      .filter((doc) => typeof doc.tokenHash === "string");

    if (shareLinkDocs.length) {
      await ShareLink.insertMany(shareLinkDocs, {
        session,
        ordered: false,
      });
    }
  }

  if (inverse.deleteCollaborative && Array.isArray(inverse.collabDocuments)) {
    const collabDocs = inverse.collabDocuments
      .map((doc) => {
        if (!doc?.name) {
          return null;
        }
        const state = decodeStateBuffer(doc.state);
        if (!state) {
          return null;
        }
        return {
          name: doc.name,
          state,
          awareness: toPlainObject(doc.awareness),
          updatedAt: toDate(doc.updatedAt) ?? new Date(),
        };
      })
      .filter(Boolean);

    if (collabDocs.length) {
      await CollabDocument.insertMany(collabDocs, {
        session,
        ordered: false,
      });
    }
  }

  if (isPublic && inverse.publication) {
    const publicationSnapshot = toPlainObject(inverse.publication);
    const publicationOwner = toObjectId(publicationSnapshot.ownerId) ?? ownerId;
    await NotebookPublication.findOneAndUpdate(
      { notebookId },
      {
        $set: {
          ownerId: publicationOwner,
          publicSlug: publicationSnapshot.publicSlug ?? snapshot.publicSlug,
          snapshot: publicationSnapshot.snapshot ?? null,
          snapshotHash: publicationSnapshot.snapshotHash ?? null,
          html: publicationSnapshot.html ?? null,
          metadata: toPlainObject(publicationSnapshot.metadata),
          publishedAt:
            toDate(publicationSnapshot.publishedAt) ??
            toDate(snapshot.publishedAt) ??
            new Date(),
        },
      },
      { upsert: true, session, new: true }
    );
  }

  const affectedNotebookIds = new Set([notebookId.toString()]);
  previousNotebookIds.forEach((_, key) => affectedNotebookIds.add(key));
  if (targetNotebookFromPayload) {
    affectedNotebookIds.add(targetNotebookFromPayload.toString());
  }

  return {
    affectedNotebookIds: Array.from(affectedNotebookIds),
  };
};

const restoreNotebookPublication = async ({ notebook, inverse, session }) => {
  const previous = toPlainObject(inverse.previous);
  if (!Object.keys(previous).length) {
    throw new Error("UNDO_UNSUPPORTED_PAYLOAD");
  }

  const updatePayload = {
    isPublic: Boolean(previous.isPublic),
    publicSlug: previous.publicSlug ?? null,
    publicMetadata: previous.publicMetadata ?? null,
    publishedAt: toDate(previous.publishedAt),
    offlineSnapshotHash: previous.offlineSnapshotHash ?? null,
    offlineSnapshotUpdatedAt: toDate(previous.offlineSnapshotUpdatedAt),
  };

  if (!updatePayload.isPublic) {
    updatePayload.publicSlug = null;
    updatePayload.publicMetadata = null;
    updatePayload.publishedAt = null;
  }

  await Notebook.updateOne(
    { _id: notebook._id },
    { $set: updatePayload },
    { session }
  );

  const publicationSnapshot = toPlainObject(previous.publication);

  if (publicationSnapshot && publicationSnapshot.publicSlug) {
    const publicationOwner =
      toObjectId(publicationSnapshot.ownerId) ?? notebook.owner;

    await NotebookPublication.findOneAndUpdate(
      { notebookId: notebook._id },
      {
        $set: {
          ownerId: publicationOwner,
          publicSlug: publicationSnapshot.publicSlug,
          snapshot: publicationSnapshot.snapshot ?? null,
          snapshotHash: publicationSnapshot.snapshotHash ?? null,
          html: publicationSnapshot.html ?? null,
          metadata: toPlainObject(publicationSnapshot.metadata),
          publishedAt: toDate(publicationSnapshot.publishedAt) ?? new Date(),
        },
      },
      { upsert: true, session, new: true }
    );
  } else {
    await NotebookPublication.deleteMany(
      { notebookId: notebook._id },
      { session }
    );
  }

  return {
    affectedNotebookIds: [notebook._id.toString()],
  };
};

const ACTION_HANDLERS = new Map([
  ["restoreNotebookFields", restoreNotebookFields],
  ["restoreNoteNotebook", restoreNoteNotebook],
  ["deleteNotebook", deleteNotebook],
  ["restoreNotebook", restoreNotebook],
  ["restoreNotebookPublication", restoreNotebookPublication],
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
  const result = await handler({ notebook, inverse, event, session });

  return {
    supported: true,
    action,
    ...(result ?? {}),
  };
};

export default {
  applyUndoForNotebookEvent,
};
