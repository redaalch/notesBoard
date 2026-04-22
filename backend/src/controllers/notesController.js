import mongoose from "mongoose";
import Note from "../models/Note.js";
import Notebook from "../models/Notebook.js";
import NotebookMember from "../models/NotebookMember.js";
import CollabDocument from "../models/CollabDocument.js";
import NoteHistory from "../models/NoteHistory.js";
import NoteCollaborator from "../models/NoteCollaborator.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import cacheService from "../services/cacheService.js";
import { isValidObjectId } from "../utils/validators.js";
import { enqueueNotebookIndexJob } from "../tasks/notebookIndexingWorker.js";
import {
  resolveNoteForUser,
  resolveWorkspaceForUser,
  listAccessibleWorkspaceIds,
  touchWorkspaceMember,
  getWorkspaceMembership,
  getNotebookMembership,
} from "../utils/access.js";
import {
  appendNotesToNotebookOrder,
  ensureNotebookOwnership,
  removeNotesFromNotebookOrder,
} from "../utils/notebooks.js";
import {
  embedText,
  buildNoteEmbeddingText,
  isEmbeddingEnabled,
} from "../services/embeddingService.js";

/**
 * Fire-and-forget: generate an embedding for a note and persist it.
 * Non-blocking – failures are silently logged.
 */
const generateEmbeddingAsync = (noteId, noteData) => {
  if (!isEmbeddingEnabled()) return;
  setImmediate(async () => {
    try {
      const text = buildNoteEmbeddingText(noteData);
      const embedding = await embedText(text);
      if (embedding) {
        await Note.updateOne(
          { _id: noteId },
          { $set: { embedding, embeddingUpdatedAt: new Date() } },
        );
      }
    } catch (err) {
      logger.debug("Async embedding generation failed", {
        noteId: String(noteId),
        message: err?.message,
      });
    }
  });
};

const INTERNAL_SERVER_ERROR = {
  message: "Internal server error",
};

const INVALID_NOTE_ID = {
  message: "Invalid note id",
};

const NOTE_NOT_FOUND = {
  message: "Note not found",
};

const EDIT_ROLES = new Set(["owner", "admin", "editor"]);
// Destructive bulk actions (delete, move) on notes the user doesn't own
// require at least admin-level workspace access.
const DESTRUCTIVE_ROLES = new Set(["owner", "admin"]);
const NOTEBOOK_WRITE_ROLES = new Set(["owner", "editor"]);

const queueNotebookIndexSafely = async (notebookId, reason) => {
  if (!notebookId) {
    return;
  }
  try {
    await enqueueNotebookIndexJob({ notebookId, reason });
  } catch (error) {
    logger.warn("Failed to enqueue notebook index job", {
      notebookId: notebookId?.toString?.() ?? String(notebookId),
      reason,
      message: error?.message,
    });
  }
};

const MAX_TAGS_PER_NOTE = 8;

const normalizeNoteIds = (ids) => {
  if (!Array.isArray(ids)) return [];
  return Array.from(
    new Set(
      ids
        .map((value) => {
          if (!value) return null;
          const stringValue = String(value).trim();
          if (!isValidObjectId(stringValue)) return null;
          return stringValue;
        })
        .filter(Boolean),
    ),
  );
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((tag) =>
      typeof tag === "string"
        ? tag.trim().toLowerCase().replace(/\s+/g, " ")
        : "",
    )
    .filter(Boolean);

  const unique = Array.from(new Set(cleaned));
  return unique.slice(0, MAX_TAGS_PER_NOTE);
};

export const getAllNotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const requestedWorkspaceId = req.query?.workspaceId;
    const requestedNotebookId = req.query?.notebookId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Parallelize independent membership lookups.
    // Both queries are capped to prevent building massive $in arrays that degrade
    // MongoDB query performance when a user has thousands of memberships.
    const [notebookMemberships, collaboratorDocs] = await Promise.all([
      NotebookMember.find({
        userId: userObjectId,
        status: "active",
      })
        .select({ notebookId: 1, role: 1 })
        .limit(500)
        .lean(),
      NoteCollaborator.find({
        userId: userObjectId,
      })
        .select({ noteId: 1, role: 1 })
        .limit(500)
        .lean(),
    ]);

    const notebookRoleById = new Map();
    const notebookMembershipObjectIds = [];
    notebookMemberships.forEach((membership) => {
      if (!membership?.notebookId) return;
      const key = membership.notebookId.toString();
      notebookRoleById.set(key, membership.role ?? "viewer");
      notebookMembershipObjectIds.push(membership.notebookId);
    });

    const collaboratorByNoteId = new Map();
    const collaboratorNoteObjectIds = [];
    collaboratorDocs.forEach((entry) => {
      if (!entry?.noteId) return;
      const noteIdString = entry.noteId.toString();
      collaboratorByNoteId.set(noteIdString, entry.role);
      collaboratorNoteObjectIds.push(new mongoose.Types.ObjectId(noteIdString));
    });

    const query = {};
    let notebookFilterObjectId = null;
    let filterUncategorized = false;

    if (requestedNotebookId) {
      if (requestedNotebookId === "uncategorized") {
        filterUncategorized = true;
        query.owner = userObjectId;
      } else {
        const notebookAccess = await getNotebookMembership(
          requestedNotebookId,
          userId,
        );
        if (!notebookAccess) {
          return res.status(404).json({ message: "Notebook not found" });
        }
        notebookFilterObjectId = notebookAccess.notebook._id;
        const membershipRole = notebookAccess.membership?.role ?? "owner";
        notebookRoleById.set(notebookFilterObjectId.toString(), membershipRole);
        query.notebookId = notebookFilterObjectId;
      }
    }

    if (requestedWorkspaceId) {
      const context = await resolveWorkspaceForUser(
        requestedWorkspaceId,
        userId,
      );
      if (!context) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      query.workspaceId = context.workspace._id;
      await touchWorkspaceMember(context.workspace._id, userId);
    }

    if (!query.workspaceId && !requestedNotebookId) {
      const accessibleWorkspaceIds = await listAccessibleWorkspaceIds(userId);
      const filters = [{ owner: userObjectId }];

      if (accessibleWorkspaceIds.length) {
        filters.push({
          workspaceId: {
            $in: accessibleWorkspaceIds.map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        });
      }

      if (collaboratorNoteObjectIds.length) {
        filters.push({ _id: { $in: collaboratorNoteObjectIds } });
      }

      if (notebookMembershipObjectIds.length) {
        const uniqueNotebookIds = Array.from(
          new Set(notebookMembershipObjectIds.map((id) => id.toString())),
        ).map((id) => new mongoose.Types.ObjectId(id));
        if (uniqueNotebookIds.length) {
          filters.push({ notebookId: { $in: uniqueNotebookIds } });
        }
      }

      if (filters.length === 1) {
        Object.assign(query, filters[0]);
      } else {
        query.$or = filters;
      }
    }

    if (filterUncategorized) {
      query.notebookId = null;
    } else if (notebookFilterObjectId) {
      query.notebookId = notebookFilterObjectId;
    }

    // ── Pagination ──────────────────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query?.limit, 10) || 50),
    );
    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      Note.find(query)
        .sort({ pinned: -1, updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({ richContent: 0 })
        .lean(),
      Note.countDocuments(query),
    ]);

    const response = notes.map((note) => {
      const noteId = note._id.toString();
      const collabRole = collaboratorByNoteId.get(noteId) ?? null;
      const isOwner = String(note.owner) === String(userId);
      const notebookRole = note.notebookId
        ? (notebookRoleById.get(note.notebookId.toString()) ??
          (isOwner ? "owner" : null))
        : null;
      const accessRole = isOwner
        ? "owner"
        : notebookRole
          ? `notebook:${notebookRole}`
          : collabRole
            ? `collaborator:${collabRole}`
            : "workspace";
      return {
        ...note,
        collaboratorRole: collabRole,
        notebookRole,
        accessRole,
      };
    });

    return res.status(200).json({
      data: response,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error("Error in getAllNotes", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const access = await resolveNoteForUser(id, req.user.id);
    if (!access) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    if (access.workspaceId) {
      await touchWorkspaceMember(access.workspaceId, req.user.id);
    }

    const permissions = access.permissions ?? {};
    const payload = {
      ...access.note,
      membershipRole: permissions.workspaceRole ?? null,
      collaboratorRole: permissions.collaboratorRole ?? null,
      notebookRole: permissions.notebookRole ?? null,
      canManageMembers: permissions.canManageCollaborators ?? false,
      canManageCollaborators: permissions.canManageCollaborators ?? false,
      canEdit: permissions.canEdit ?? false,
      effectiveRole:
        permissions.effectiveRole ??
        (permissions.isOwner
          ? "owner"
          : permissions.canEdit
            ? "editor"
            : "viewer"),
      accessRole: permissions.isOwner
        ? "owner"
        : (permissions.workspaceRole ?? permissions.collaboratorRole ?? null),
    };

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Error in getNoteById", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const createNote = async (req, res) => {
  try {
    const {
      title,
      content,
      tags,
      pinned,
      workspaceId: requestedWorkspaceId,
      notebookId,
      richContent,
      contentText,
    } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "title and content are required" });
    }

    const userId = req.user.id;

    let notebookObjectId = null;
    let notebookAccess = null;
    if (typeof notebookId !== "undefined" && notebookId !== null) {
      if (notebookId !== "" && notebookId !== "uncategorized") {
        notebookAccess = await getNotebookMembership(notebookId, userId);
        if (!notebookAccess) {
          return res.status(404).json({ message: "Notebook not found" });
        }
        const notebookRole = notebookAccess.membership?.role ?? "viewer";
        if (!NOTEBOOK_WRITE_ROLES.has(notebookRole)) {
          return res
            .status(403)
            .json({ message: "Insufficient notebook permissions" });
        }
        notebookObjectId = notebookAccess.notebook._id;
      }
    }

    // Prefer the notebook's workspace when a notebook is selected;
    // otherwise fall back to an explicit workspaceId or the user's default.
    const preferredWorkspaceId =
      notebookAccess?.notebook?.workspaceId ??
      requestedWorkspaceId ??
      req.user?.defaultWorkspace;

    const workspaceContext = await resolveWorkspaceForUser(
      preferredWorkspaceId,
      userId,
    );

    if (!workspaceContext) {
      return res
        .status(404)
        .json({ message: "Workspace not found or inaccessible" });
    }

    const role = workspaceContext.member?.role ?? "owner";
    if (!EDIT_ROLES.has(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    await touchWorkspaceMember(workspaceContext.workspace._id, userId);

    const payload = {
      owner: userId,
      workspaceId: workspaceContext.workspace._id,
      title,
      content,
      tags,
    };

    if (notebookObjectId) {
      payload.notebookId = notebookObjectId;
    } else if (notebookId === "" || notebookId === "uncategorized") {
      payload.notebookId = null;
    }

    if (typeof richContent !== "undefined") {
      payload.richContent = richContent;
    }

    if (typeof contentText === "string") {
      payload.contentText = contentText;
    }

    if (typeof pinned !== "undefined") {
      payload.pinned = typeof pinned === "boolean" ? pinned : Boolean(pinned);
    }

    const savedNote = await Note.create(payload);
    await NoteHistory.create({
      noteId: savedNote._id,
      workspaceId: savedNote.workspaceId,
      actorId: userId,
      eventType: "create",
      summary: "Created note",
      titleSnapshot: savedNote.title ?? "",
      contentSnapshot: (savedNote.contentText ?? savedNote.content ?? "").slice(
        0,
        50_000,
      ),
      tagsSnapshot: Array.isArray(savedNote.tags) ? savedNote.tags : [],
    });

    if (notebookObjectId) {
      await appendNotesToNotebookOrder(notebookObjectId, [savedNote._id]);
    }

    if (notebookObjectId) {
      await queueNotebookIndexSafely(notebookObjectId, "note-create");
    }

    // Fire-and-forget: generate a vector embedding for semantic search
    generateEmbeddingAsync(savedNote._id, {
      title: savedNote.title,
      content: savedNote.content,
      contentText: savedNote.contentText,
      tags: savedNote.tags,
    });

    cacheService.invalidateUserRoutes(userId);
    return res.status(201).json(savedNote);
  } catch (error) {
    logger.error("Error in createNote", { error: error?.message });
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      tags,
      pinned,
      notebookId,
      richContent,
      contentText,
    } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const access = await resolveNoteForUser(id, req.user.id);
    if (!access) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    const permissions = access.permissions ?? {};
    if (!permissions.canEdit) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const updates = {};
    if (typeof title !== "undefined") updates.title = title;
    if (typeof content !== "undefined") updates.content = content;
    if (typeof tags !== "undefined") updates.tags = tags;
    if (typeof pinned !== "undefined") {
      updates.pinned = typeof pinned === "boolean" ? pinned : Boolean(pinned);
    }

    if (typeof richContent !== "undefined") {
      updates.richContent = richContent;
    }

    if (typeof contentText === "string") {
      updates.contentText = contentText;
    }

    let targetNotebookObjectId;
    if (typeof notebookId !== "undefined") {
      if (
        notebookId === null ||
        notebookId === "" ||
        notebookId === "uncategorized"
      ) {
        updates.notebookId = null;
        targetNotebookObjectId = null;
      } else {
        const notebookAccess = await getNotebookMembership(
          notebookId,
          req.user.id,
        );
        if (!notebookAccess) {
          return res.status(404).json({ message: "Notebook not found" });
        }
        const notebookRole = notebookAccess.membership?.role ?? "viewer";
        if (!NOTEBOOK_WRITE_ROLES.has(notebookRole)) {
          return res
            .status(403)
            .json({ message: "Insufficient notebook permissions" });
        }
        updates.notebookId = notebookAccess.notebook._id;
        targetNotebookObjectId = notebookAccess.notebook._id;
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No update data provided" });
    }

    await touchWorkspaceMember(
      updates.workspaceId ?? access.workspaceId ?? access.note.workspaceId,
      req.user.id,
    );

    const updatedNote = await Note.findOneAndUpdate({ _id: id }, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedNote) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    const changes = [];
    let eventType = "edit";

    if (typeof title !== "undefined" && title !== access.note.title) {
      changes.push("title");
      eventType = "title";
    }

    if (typeof content !== "undefined" && content !== access.note.content) {
      changes.push("content");
    }

    if (
      typeof tags !== "undefined" &&
      Array.isArray(tags) &&
      JSON.stringify(tags) !== JSON.stringify(access.note.tags ?? [])
    ) {
      changes.push("tags");
      if (eventType === "edit") {
        eventType = "tag";
      }
    }

    if (
      typeof pinned !== "undefined" &&
      access.note.pinned !== updates.pinned
    ) {
      eventType = updates.pinned ? "pin" : "unpin";
      changes.push("pinned");
    }

    if (
      typeof notebookId !== "undefined" &&
      String(access.note.notebookId ?? "") !==
        String(updatedNote.notebookId ?? "")
    ) {
      eventType = "move";
      changes.push("notebook");
    }

    let historyWorkspaceId =
      updatedNote.workspaceId ??
      updates.workspaceId ??
      access.workspaceId ??
      access.note.workspaceId ??
      null;

    // Legacy notes may miss workspaceId. Derive from user's default workspace.
    if (!historyWorkspaceId && req.user?.defaultWorkspace) {
      const fallbackWorkspace = await resolveWorkspaceForUser(
        req.user.defaultWorkspace,
        req.user.id,
      );
      if (fallbackWorkspace) {
        historyWorkspaceId = fallbackWorkspace.workspace._id;
      }
    }

    if (historyWorkspaceId && !updatedNote.workspaceId) {
      await Note.updateOne(
        { _id: updatedNote._id },
        { $set: { workspaceId: historyWorkspaceId } },
      );
      updatedNote.workspaceId = historyWorkspaceId;
    }

    if (historyWorkspaceId) {
      await NoteHistory.create({
        noteId: updatedNote._id,
        workspaceId: historyWorkspaceId,
        actorId: req.user.id,
        eventType,
        summary:
          changes.length === 0
            ? "Edited note"
            : `Updated ${changes.join(", ")}`,
        titleSnapshot: updatedNote.title ?? "",
        contentSnapshot: (
          updatedNote.contentText ??
          updatedNote.content ??
          ""
        ).slice(0, 50_000),
        tagsSnapshot: Array.isArray(updatedNote.tags) ? updatedNote.tags : [],
      });
    } else {
      logger.warn("Skipping note history entry due to missing context", {
        noteId: String(updatedNote._id),
        userId: req.user.id,
      });
    }

    const previousNotebookId = access.note.notebookId;
    const currentNotebookId = updatedNote.notebookId;
    if (
      typeof notebookId !== "undefined" &&
      String(previousNotebookId ?? "") !== String(currentNotebookId ?? "")
    ) {
      if (previousNotebookId) {
        await removeNotesFromNotebookOrder(previousNotebookId, [
          updatedNote._id,
        ]);
      }
      if (targetNotebookObjectId) {
        await appendNotesToNotebookOrder(targetNotebookObjectId, [
          updatedNote._id,
        ]);
      }
    }

    const indexTargets = new Set();
    if (previousNotebookId) {
      indexTargets.add(previousNotebookId.toString());
    }
    if (updatedNote.notebookId) {
      indexTargets.add(updatedNote.notebookId.toString());
    }
    for (const target of indexTargets) {
      await queueNotebookIndexSafely(target, "note-update");
    }

    // Fire-and-forget: regenerate vector embedding when content changes
    if (
      updates.title ||
      updates.content ||
      updates.contentText ||
      updates.tags
    ) {
      generateEmbeddingAsync(updatedNote._id, {
        title: updatedNote.title,
        content: updatedNote.content,
        contentText: updatedNote.contentText ?? updatedNote.content,
        tags: updatedNote.tags,
      });
    }

    const refreshedAccess = await resolveNoteForUser(
      updatedNote._id,
      req.user.id,
    );
    const nextPermissions =
      refreshedAccess?.permissions ?? access.permissions ?? {};
    const payload = {
      ...updatedNote.toObject(),
      membershipRole: nextPermissions.workspaceRole ?? null,
      collaboratorRole: nextPermissions.collaboratorRole ?? null,
      notebookRole: nextPermissions.notebookRole ?? null,
      canManageMembers: nextPermissions.canManageCollaborators ?? false,
      canManageCollaborators: nextPermissions.canManageCollaborators ?? false,
      canEdit: nextPermissions.canEdit ?? false,
      effectiveRole:
        nextPermissions.effectiveRole ??
        (nextPermissions.isOwner
          ? "owner"
          : nextPermissions.canEdit
            ? "editor"
            : "viewer"),
      accessRole: nextPermissions.isOwner
        ? "owner"
        : (nextPermissions.workspaceRole ??
          nextPermissions.collaboratorRole ??
          null),
    };

    cacheService.invalidateUserRoutes(req.user.id);
    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Error in updateNote", { error: error?.message });
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const access = await resolveNoteForUser(id, req.user.id);
    if (!access) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    const permissions = access.permissions ?? {};
    const isOwner = permissions.isOwner;
    const workspaceRole = permissions.workspaceRole ?? null;
    if (!isOwner && !(workspaceRole && EDIT_ROLES.has(workspaceRole))) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const deletedNote = await Note.findOneAndUpdate(
      { _id: id },
      { $set: { deletedAt: new Date() } },
      { new: true },
    );
    if (!deletedNote) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    await NoteHistory.create({
      noteId: deletedNote._id,
      workspaceId: deletedNote.workspaceId ?? access.workspaceId ?? null,
      actorId: req.user.id,
      eventType: "delete",
      summary: "Moved note to trash",
    });

    if (deletedNote.notebookId) {
      await removeNotesFromNotebookOrder(deletedNote.notebookId, [
        deletedNote._id,
      ]);
      await queueNotebookIndexSafely(deletedNote.notebookId, "note-delete");
    }

    cacheService.invalidateUserRoutes(req.user.id);
    return res.status(200).json({ message: "Moved to trash" });
  } catch (error) {
    logger.error("Error in deleteNote", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const serializeTrashedNote = (note) => {
  const deletedAt = note.deletedAt ? new Date(note.deletedAt) : null;
  const purgeAt = deletedAt
    ? new Date(deletedAt.getTime() + TRASH_RETENTION_MS)
    : null;
  return {
    _id: note._id.toString(),
    title: note.title,
    contentText: note.contentText ?? "",
    tags: Array.isArray(note.tags) ? note.tags : [],
    notebookId: note.notebookId ? note.notebookId.toString() : null,
    workspaceId: note.workspaceId ? note.workspaceId.toString() : null,
    deletedAt: deletedAt ? deletedAt.toISOString() : null,
    purgeAt: purgeAt ? purgeAt.toISOString() : null,
    updatedAt: note.updatedAt ? new Date(note.updatedAt).toISOString() : null,
  };
};

export const listTrashedNotes = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId || !isValidObjectId(ownerId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const notes = await Note.find({ owner: ownerId })
      .setOptions({ onlyTrashed: true })
      .sort({ deletedAt: -1 })
      .select("title contentText tags notebookId workspaceId deletedAt updatedAt")
      .limit(500)
      .lean();

    return res.status(200).json({
      notes: notes.map(serializeTrashedNote),
      retentionDays: 30,
    });
  } catch (error) {
    logger.error("Error in listTrashedNotes", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const restoreNote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const trashed = await Note.findOne({ _id: id, owner: req.user.id })
      .setOptions({ onlyTrashed: true });
    if (!trashed) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    trashed.deletedAt = null;
    await trashed.save();

    await NoteHistory.create({
      noteId: trashed._id,
      workspaceId: trashed.workspaceId ?? null,
      actorId: req.user.id,
      eventType: "edit",
      summary: "Restored note from trash",
    });

    if (trashed.notebookId) {
      await appendNotesToNotebookOrder(trashed.notebookId, [trashed._id]);
      await queueNotebookIndexSafely(trashed.notebookId, "note-restore");
    }

    cacheService.invalidateUserRoutes(req.user.id);
    return res.status(200).json({
      message: "Restored",
      note: {
        _id: trashed._id.toString(),
        notebookId: trashed.notebookId ? trashed.notebookId.toString() : null,
      },
    });
  } catch (error) {
    logger.error("Error in restoreNote", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const purgeNote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const trashed = await Note.findOne({ _id: id, owner: req.user.id })
      .setOptions({ onlyTrashed: true });
    if (!trashed) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    await Note.deleteOne({ _id: trashed._id }).setOptions({ withTrashed: true });

    if (trashed.docName) {
      await CollabDocument.findOneAndDelete({ name: trashed.docName });
    }
    await NoteCollaborator.deleteMany({ noteId: trashed._id });
    await NoteHistory.deleteMany({ noteId: trashed._id });

    cacheService.invalidateUserRoutes(req.user.id);
    return res.status(200).json({ message: "Purged", id: trashed._id.toString() });
  } catch (error) {
    logger.error("Error in purgeNote", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const emptyTrash = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId || !isValidObjectId(ownerId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const trashed = await Note.find({ owner: ownerId })
      .setOptions({ onlyTrashed: true })
      .select("_id docName")
      .lean();

    if (!trashed.length) {
      return res.status(200).json({ purged: 0 });
    }

    const ids = trashed.map((note) => note._id);
    const docNames = trashed.map((note) => note.docName).filter(Boolean);

    await Note.deleteMany({ _id: { $in: ids } }).setOptions({
      withTrashed: true,
    });
    if (docNames.length) {
      await CollabDocument.deleteMany({ name: { $in: docNames } });
    }
    await NoteCollaborator.deleteMany({ noteId: { $in: ids } });
    await NoteHistory.deleteMany({ noteId: { $in: ids } });

    cacheService.invalidateUserRoutes(ownerId);
    return res.status(200).json({ purged: ids.length });
  } catch (error) {
    logger.error("Error in emptyTrash", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getTagStats = async (req, res) => {
  try {
    const ownerId = req.user?.id;

    if (!ownerId || !isValidObjectId(ownerId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    let targetWorkspaceId = null;
    const requestedWorkspaceId = req.query?.workspaceId;
    if (requestedWorkspaceId) {
      const context = await resolveWorkspaceForUser(
        requestedWorkspaceId,
        ownerId,
      );
      if (!context) {
        return res
          .status(404)
          .json({ message: "Workspace not found or inaccessible" });
      }
      targetWorkspaceId = context.workspace._id.toString();
      await touchWorkspaceMember(context.workspace._id, ownerId);
    } else if (req.user?.defaultWorkspace) {
      const context = await resolveWorkspaceForUser(
        req.user.defaultWorkspace,
        ownerId,
      );
      if (context) {
        targetWorkspaceId = context.workspace._id.toString();
      }
    }

    const accessibleWorkspaceIds = await listAccessibleWorkspaceIds(ownerId);
    const workspaceObjectIds = accessibleWorkspaceIds.map(
      (value) => new mongoose.Types.ObjectId(value),
    );

    const ownerMatch = new mongoose.Types.ObjectId(ownerId);
    const matchStage = targetWorkspaceId
      ? {
          workspaceId: new mongoose.Types.ObjectId(targetWorkspaceId),
          tags: { $exists: true, $ne: [] },
        }
      : {
          $and: [
            {
              $or: [
                { owner: ownerMatch },
                ...(workspaceObjectIds.length
                  ? [{ workspaceId: { $in: workspaceObjectIds } }]
                  : []),
              ],
            },
            { tags: { $exists: true, $ne: [] } },
          ],
        };

    const rawAggregation = await Note.aggregate([
      {
        $match: matchStage,
      },
      { $project: { tags: 1 } },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
    ]);

    const normalizeTag = (tag) =>
      typeof tag === "string"
        ? tag.trim().toLowerCase().replace(/\s+/g, " ")
        : "";

    const statsMap = rawAggregation.reduce((acc, { _id, count }) => {
      const normalized = normalizeTag(_id);
      if (!normalized) return acc;

      const currentCount = acc.get(normalized) ?? 0;
      acc.set(normalized, currentCount + count);
      return acc;
    }, new Map());

    const tags = Array.from(statsMap.entries())
      .map(([tag, count]) => ({ _id: tag, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a._id.localeCompare(b._id);
      });

    const uniqueTags = tags.length;
    const topTag = tags[0] ?? null;

    return res.status(200).json({
      tags,
      uniqueTags,
      topTag,
    });
  } catch (error) {
    logger.error("Error in getTagStats", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const bulkUpdateNotes = async (req, res) => {
  try {
    const { action, noteIds, tags = [], notebookId } = req.body ?? {};

    // Invalidate cached routes for this user after any successful bulk mutation
    const _origJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.invalidateUserRoutes(req.user?.id);
      }
      return _origJson(body);
    };

    const validActions = new Set([
      "pin",
      "unpin",
      "delete",
      "addTags",
      "move",
      "moveNotebook",
    ]);
    if (!validActions.has(action)) {
      return res.status(400).json({ message: "Unknown bulk action" });
    }

    const normalizedIds = normalizeNoteIds(noteIds);
    if (!normalizedIds.length) {
      return res.status(400).json({ message: "No valid note ids provided" });
    }

    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const workspaceIds = await listAccessibleWorkspaceIds(ownerId);
    const workspaceObjectIds = workspaceIds.map(
      (value) => new mongoose.Types.ObjectId(value),
    );

    const baseFilter = {
      _id: { $in: normalizedIds.map((id) => new mongoose.Types.ObjectId(id)) },
      $or: [
        { owner: new mongoose.Types.ObjectId(ownerId) },
        ...(workspaceObjectIds.length
          ? [{ workspaceId: { $in: workspaceObjectIds } }]
          : []),
      ],
    };

    if (baseFilter.$or.length === 1) {
      delete baseFilter.$or;
      Object.assign(baseFilter, {
        owner: new mongoose.Types.ObjectId(ownerId),
      });
    }

    const candidateNotes = await Note.find(baseFilter).lean();
    if (!candidateNotes.length) {
      return res.status(200).json({
        action,
        updated: 0,
        deleted: 0,
        noteIds: [],
      });
    }

    // Batch-load all unique workspace memberships in parallel instead of
    // resolving them one-by-one inside the loop (eliminates N+1 DB queries).
    const uniqueWorkspaceIds = [
      ...new Set(
        candidateNotes.map((n) => n.workspaceId?.toString()).filter(Boolean),
      ),
    ];

    const membershipResults = await Promise.all(
      uniqueWorkspaceIds.map((wsId) => getWorkspaceMembership(wsId, ownerId)),
    );

    const membershipRoleByWorkspace = new Map();
    uniqueWorkspaceIds.forEach((wsId, i) => {
      const membership = membershipResults[i];
      const role = membership?.member?.role ?? (membership ? "owner" : null);
      membershipRoleByWorkspace.set(wsId, role);
    });

    // For destructive actions (delete, move) on notes the user doesn't own,
    // require admin/owner workspace role — editors should not be able to
    // delete or relocate other members' notes.
    const requiredRoles =
      action === "delete" || action === "move" ? DESTRUCTIVE_ROLES : EDIT_ROLES;

    const permittedNotes = candidateNotes.filter((note) => {
      if (String(note.owner) === String(ownerId)) return true;
      if (!note.workspaceId) return false;
      const role = membershipRoleByWorkspace.get(note.workspaceId.toString());
      return role && requiredRoles.has(role);
    });

    const allowedIds = permittedNotes.map((note) => note._id);
    if (!allowedIds.length) {
      return res
        .status(403)
        .json({ message: "No editable notes in selection" });
    }

    const touchIds = new Set(
      permittedNotes
        .map((note) => note.workspaceId)
        .filter((value) => !!value)
        .map((value) => value.toString()),
    );

    const touchPromises = [...touchIds].map((workspaceId) =>
      touchWorkspaceMember(workspaceId, ownerId),
    );

    const objectIdArray = allowedIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    if (action === "pin" || action === "unpin") {
      const desiredPinned = action === "pin";
      const result = await Note.updateMany(
        { _id: { $in: objectIdArray } },
        {
          $set: { pinned: desiredPinned },
        },
      );

      await Promise.all([
        ...touchPromises,
        NoteHistory.insertMany(
          permittedNotes.map((note) => ({
            noteId: note._id,
            workspaceId: note.workspaceId ?? null,
            actorId: ownerId,
            eventType: desiredPinned ? "pin" : "unpin",
            summary: desiredPinned ? "Pinned note" : "Unpinned note",
          })),
        ),
      ]);

      return res.status(200).json({
        action,
        updated: result.modifiedCount ?? 0,
        noteIds: normalizedIds,
      });
    }

    if (action === "delete") {
      const now = new Date();
      const result = await Note.updateMany(
        { _id: { $in: objectIdArray } },
        { $set: { deletedAt: now } },
      );

      await Promise.all([
        ...touchPromises,
        NoteHistory.insertMany(
          permittedNotes.map((note) => ({
            noteId: note._id,
            workspaceId: note.workspaceId ?? null,
            actorId: ownerId,
            eventType: "delete",
            summary: "Moved note to trash",
          })),
        ),
      ]);

      const notebookRemovals = new Set(
        permittedNotes
          .map((note) => note.notebookId)
          .filter((id) => id)
          .map((id) => id.toString()),
      );

      for (const notebook of notebookRemovals) {
        await removeNotesFromNotebookOrder(
          new mongoose.Types.ObjectId(notebook),
          objectIdArray,
        );
      }

      for (const notebook of notebookRemovals) {
        await queueNotebookIndexSafely(notebook, "bulk-delete");
      }

      return res.status(200).json({
        action,
        deleted: result.modifiedCount ?? 0,
        noteIds: normalizedIds,
      });
    }

    if (action === "addTags") {
      const normalizedTags = normalizeTags(tags);
      if (!normalizedTags.length) {
        return res
          .status(400)
          .json({ message: "At least one valid tag is required" });
      }

      // Build bulk write ops + history docs in one pass (replaces N+1 sequential loop)
      const bulkOps = [];
      const historyDocs = [];
      const updatedNotebookIds = new Set();
      for (const note of permittedNotes) {
        const existingTags = Array.isArray(note.tags) ? note.tags : [];
        const merged = Array.from(
          new Set([
            ...existingTags.map((tag) => tag.toLowerCase()),
            ...normalizedTags,
          ]),
        ).slice(0, MAX_TAGS_PER_NOTE);

        // Only queue an update when tags actually change
        if (
          merged.length !== existingTags.length ||
          merged.some((t, i) => t !== existingTags[i])
        ) {
          bulkOps.push({
            updateOne: {
              filter: { _id: note._id },
              update: { $set: { tags: merged } },
            },
          });
          historyDocs.push({
            noteId: note._id,
            workspaceId: note.workspaceId ?? null,
            actorId: ownerId,
            eventType: "tag",
            summary: `Added tags: ${normalizedTags.join(", ")}`,
          });
          if (note.notebookId) {
            updatedNotebookIds.add(note.notebookId.toString());
          }
        }
      }

      // Execute bulk write + history insert + workspace touches in parallel
      const bulkPromises = [...touchPromises];
      if (bulkOps.length) {
        bulkPromises.push(Note.bulkWrite(bulkOps, { ordered: false }));
        bulkPromises.push(
          NoteHistory.insertMany(historyDocs, { ordered: false }),
        );
      }
      await Promise.all(bulkPromises);

      // Queue notebook index jobs
      const indexPromises = [...updatedNotebookIds].map((notebookId) =>
        queueNotebookIndexSafely(notebookId, "bulk-add-tags"),
      );
      await Promise.all(indexPromises);

      return res.status(200).json({
        action,
        updated: bulkOps.length,
        noteIds: normalizedIds,
        tags: normalizedTags,
      });
    }

    if (action === "moveNotebook") {
      let targetNotebookId = null;
      if (notebookId && notebookId !== "uncategorized") {
        if (!isValidObjectId(notebookId)) {
          return res
            .status(400)
            .json({ message: "Valid notebookId is required" });
        }
        const notebook = await ensureNotebookOwnership(notebookId, ownerId);
        if (!notebook) {
          return res.status(404).json({ message: "Notebook not found" });
        }
        targetNotebookId = notebook._id;
      }

      const ownNotes = permittedNotes.filter(
        (note) => String(note.owner) === String(ownerId),
      );

      if (!ownNotes.length) {
        return res
          .status(403)
          .json({ message: "Only personal notes can be moved to notebooks" });
      }

      const noteObjectIds = ownNotes.map((note) => note._id);

      await Note.updateMany(
        { _id: { $in: noteObjectIds } },
        { $set: { notebookId: targetNotebookId } },
      );

      const previousNotebookIds = new Set(
        ownNotes
          .map((note) => note.notebookId)
          .filter((value) => value)
          .map((value) => value.toString()),
      );

      for (const notebook of previousNotebookIds) {
        await removeNotesFromNotebookOrder(
          new mongoose.Types.ObjectId(notebook),
          noteObjectIds,
        );
      }

      if (targetNotebookId) {
        await appendNotesToNotebookOrder(targetNotebookId, noteObjectIds);
      }

      const indexTargets = new Set(previousNotebookIds);
      if (targetNotebookId) {
        indexTargets.add(targetNotebookId.toString());
      }

      for (const notebook of indexTargets) {
        await queueNotebookIndexSafely(notebook, "bulk-move-notebook");
      }

      return res.status(200).json({
        action,
        updated: noteObjectIds.length,
        noteIds: normalizedIds,
        notebookId: targetNotebookId ? targetNotebookId.toString() : null,
      });
    }

    return res.status(400).json({ message: "Unsupported action" });
  } catch (error) {
    logger.error("Bulk update notes failed", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getNoteHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const access = await resolveNoteForUser(id, req.user.id);
    if (!access) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    if (access.workspaceId) {
      await touchWorkspaceMember(access.workspaceId, req.user.id);
    }

    const limit = Math.min(
      Number.parseInt(req.query?.limit ?? "100", 10) || 100,
      500,
    );

    const entries = await NoteHistory.find({ noteId: id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const payload = entries.map((entry) => ({
      id: entry._id.toString(),
      eventType: entry.eventType,
      summary: entry.summary,
      actorId: entry.actorId?.toString?.() ?? null,
      createdAt: entry.createdAt,
      diff: entry.diff ?? null,
      awarenessState: entry.awarenessState ?? null,
      titleSnapshot: entry.titleSnapshot ?? null,
      contentSnapshot: entry.contentSnapshot ?? null,
      tagsSnapshot: Array.isArray(entry.tagsSnapshot) ? entry.tagsSnapshot : null,
    }));

    return res.status(200).json({ history: payload });
  } catch (error) {
    logger.error("Failed to fetch note history", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getNoteLayout = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const requestedNotebookId = req.query?.notebookId;
    if (requestedNotebookId && requestedNotebookId !== "uncategorized") {
      const notebook = await ensureNotebookOwnership(
        requestedNotebookId,
        userId,
      );
      if (!notebook) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      const noteIds = Array.isArray(notebook.noteOrder)
        ? notebook.noteOrder.map((id) => id.toString())
        : [];
      return res.status(200).json({ noteIds });
    }

    const user = req.userDocument ?? (await User.findById(userId));
    const noteIds = Array.isArray(user?.customNoteOrder)
      ? user.customNoteOrder.map((id) => id.toString())
      : [];
    return res.status(200).json({ noteIds });
  } catch (error) {
    logger.error("Failed to fetch note layout", {
      error: error?.message,
      userId: req.user?.id,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const updateNoteLayout = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { noteIds, notebookId } = req.body ?? {};
    if (!Array.isArray(noteIds)) {
      return res
        .status(400)
        .json({ message: "noteIds must be provided as an array" });
    }

    const normalizedIds = normalizeNoteIds(noteIds);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const accessibleWorkspaceIds = await listAccessibleWorkspaceIds(userId);
    const workspaceObjectIds = accessibleWorkspaceIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const collaboratorDocs = await NoteCollaborator.find({
      userId: userObjectId,
    })
      .select({ noteId: 1 })
      .lean();

    const collaboratorNoteObjectIds = collaboratorDocs
      .map((entry) => entry?.noteId?.toString?.())
      .filter(Boolean)
      .map((value) => new mongoose.Types.ObjectId(value));

    const normalizedObjectIds = normalizedIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const orConditions = [{ owner: userObjectId }];

    if (workspaceObjectIds.length) {
      orConditions.push({ workspaceId: { $in: workspaceObjectIds } });
    }

    if (collaboratorNoteObjectIds.length) {
      orConditions.push({ _id: { $in: collaboratorNoteObjectIds } });
    }

    if (notebookId && notebookId !== "uncategorized") {
      const access = await getNotebookMembership(notebookId, userId);
      if (!access) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      const { notebook, membership } = access;
      const role = membership?.role;
      if (role !== "owner" && role !== "editor") {
        return res
          .status(403)
          .json({
            message:
              "You do not have permission to reorder notes in this notebook",
          });
      }

      if (!normalizedObjectIds.length) {
        await Notebook.findByIdAndUpdate(notebook._id, { noteOrder: [] });
        return res.status(200).json({ noteIds: [] });
      }

      const session = await mongoose.startSession();
      try {
        let filteredIds;
        await session.withTransaction(async () => {
          const candidates = await Note.find(
            {
              _id: { $in: normalizedObjectIds },
              notebookId: notebook._id,
            },
            { _id: 1 },
          )
            .session(session)
            .lean();

          const allowedSet = new Set(
            candidates.map((note) => note._id.toString()),
          );
          filteredIds = normalizedIds.filter((id) => allowedSet.has(id));

          const notebookOrder = filteredIds.map(
            (id) => new mongoose.Types.ObjectId(id),
          );

          await Notebook.findByIdAndUpdate(
            notebook._id,
            { noteOrder: notebookOrder },
            { session },
          );
        });

        return res.status(200).json({ noteIds: filteredIds });
      } finally {
        await session.endSession();
      }
    }

    if (!normalizedObjectIds.length) {
      await User.findByIdAndUpdate(userId, { customNoteOrder: [] });
      if (req.userDocument) {
        req.userDocument.customNoteOrder = [];
      }
      return res.status(200).json({ noteIds: [] });
    }

    const session = await mongoose.startSession();
    try {
      let filteredIds;
      await session.withTransaction(async () => {
        const candidates = await Note.find(
          {
            _id: { $in: normalizedObjectIds },
            $or: orConditions,
          },
          { _id: 1 },
        )
          .session(session)
          .lean();

        const allowedSet = new Set(
          candidates.map((note) => note._id.toString()),
        );
        filteredIds = normalizedIds.filter((id) => allowedSet.has(id));

        const objectIdOrder = filteredIds.map(
          (id) => new mongoose.Types.ObjectId(id),
        );

        await User.findByIdAndUpdate(
          userId,
          { customNoteOrder: objectIdOrder },
          { session },
        );
      });

      if (req.userDocument) {
        const objectIdOrder = filteredIds.map(
          (id) => new mongoose.Types.ObjectId(id),
        );
        req.userDocument.customNoteOrder = objectIdOrder;
      }

      return res.status(200).json({ noteIds: filteredIds });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    logger.error("Failed to update note layout", {
      error: error?.message,
      stack: error?.stack,
      userId: req.user?.id,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

/* ─────── GET /api/notes/search?q=…&limit=… ─────── */
export const searchNotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const rawQuery = String(req.query.q ?? "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 60);

    if (!rawQuery) {
      return res.status(200).json({ results: [], searchMode: null, query: "" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Build the same access filter used by getAllNotes.
    // Capped at 500 to prevent building massive $in arrays on heavily-shared accounts.
    const [workspaceIds, collaboratorDocs, notebookMemberships] =
      await Promise.all([
        listAccessibleWorkspaceIds(userId),
        NoteCollaborator.find({ userId: userObjectId })
          .select({ noteId: 1 })
          .limit(500)
          .lean(),
        NotebookMember.find({ userId: userObjectId, status: "active" })
          .select({ notebookId: 1 })
          .limit(500)
          .lean(),
      ]);

    const orConditions = [{ owner: userObjectId }];

    if (workspaceIds.length) {
      orConditions.push({
        workspaceId: {
          $in: workspaceIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      });
    }
    const collabNoteIds = collaboratorDocs
      .map((d) => d.noteId?.toString())
      .filter(Boolean);
    if (collabNoteIds.length) {
      orConditions.push({
        _id: {
          $in: collabNoteIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      });
    }
    const memberNotebookIds = notebookMemberships
      .map((d) => d.notebookId?.toString())
      .filter(Boolean);
    if (memberNotebookIds.length) {
      orConditions.push({
        notebookId: {
          $in: memberNotebookIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      });
    }

    const accessFilter =
      orConditions.length === 1 ? orConditions[0] : { $or: orConditions };

    // ── 1. Try semantic (vector) search first ────────────────────────────
    let results = null;
    let searchMode = "keyword";

    if (isEmbeddingEnabled()) {
      try {
        const queryEmbedding = await embedText(rawQuery);
        if (queryEmbedding) {
          const pipeline = [
            {
              $vectorSearch: {
                index: "note_embedding_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: Math.max(limit * 10, 100),
                limit: limit * 2,
              },
            },
            { $addFields: { score: { $meta: "vectorSearchScore" } } },
            { $match: accessFilter },
            { $limit: limit },
            {
              $project: {
                title: 1,
                content: 1,
                contentText: 1,
                tags: 1,
                pinned: 1,
                notebookId: 1,
                updatedAt: 1,
                createdAt: 1,
                owner: 1,
                score: 1,
              },
            },
          ];

          const docs = await Note.aggregate(pipeline);
          if (docs.length > 0) {
            results = docs;
            searchMode = "semantic";
          }
        }
      } catch (vecErr) {
        const msg = vecErr?.message ?? "";
        if (
          !msg.includes("PlanExecutor") &&
          !msg.includes("vectorSearch") &&
          !msg.includes("index not found") &&
          !msg.includes("Atlas")
        ) {
          logger.warn("Vector search error", { message: msg.slice(0, 300) });
        }
        // Fall through to keyword search
      }
    }

    // ── 2. Fallback: MongoDB $text search ────────────────────────────────
    if (!results) {
      const textQuery = { ...accessFilter, $text: { $search: rawQuery } };
      results = await Note.find(textQuery)
        .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
        .limit(limit)
        .select({
          title: 1,
          content: 1,
          contentText: 1,
          tags: 1,
          pinned: 1,
          notebookId: 1,
          updatedAt: 1,
          createdAt: 1,
          owner: 1,
          score: { $meta: "textScore" },
        })
        .lean();
      searchMode = "keyword";
    }

    return res.status(200).json({
      results: results ?? [],
      searchMode,
      query: rawQuery,
    });
  } catch (error) {
    logger.error("Error in searchNotes", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};
