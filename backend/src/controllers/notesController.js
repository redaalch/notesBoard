import mongoose from "mongoose";
import Note from "../models/Note.js";
import Notebook from "../models/Notebook.js";
import NotebookMember from "../models/NotebookMember.js";
import CollabDocument from "../models/CollabDocument.js";
import NoteHistory from "../models/NoteHistory.js";
import NoteCollaborator from "../models/NoteCollaborator.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { isValidObjectId } from "../utils/validators.js";
import {
  resolveBoardForUser,
  resolveNoteForUser,
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
const NOTEBOOK_WRITE_ROLES = new Set(["owner", "editor"]);

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
        .filter(Boolean)
    )
  );
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((tag) =>
      typeof tag === "string"
        ? tag.trim().toLowerCase().replace(/\s+/g, " ")
        : ""
    )
    .filter(Boolean);

  const unique = Array.from(new Set(cleaned));
  return unique.slice(0, MAX_TAGS_PER_NOTE);
};

export const getAllNotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const requestedBoardId = req.query?.boardId;
    const requestedNotebookId = req.query?.notebookId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const notebookMemberships = await NotebookMember.find({
      userId: userObjectId,
      status: "active",
    })
      .select({ notebookId: 1, role: 1 })
      .lean();

    const notebookRoleById = new Map();
    const notebookMembershipObjectIds = [];
    notebookMemberships.forEach((membership) => {
      if (!membership?.notebookId) return;
      const key = membership.notebookId.toString();
      notebookRoleById.set(key, membership.role ?? "viewer");
      notebookMembershipObjectIds.push(membership.notebookId);
    });

    const collaboratorDocs = await NoteCollaborator.find({
      userId: userObjectId,
    })
      .select({ noteId: 1, role: 1 })
      .lean();

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
          userId
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

    if (requestedBoardId) {
      const context = await resolveBoardForUser(requestedBoardId, userId);
      if (!context) {
        return res.status(404).json({ message: "Board not found" });
      }
      query.boardId = context.board._id;
      query.workspaceId = context.workspace._id;
      await touchWorkspaceMember(context.workspace._id, userId);
    }

    if (!query.boardId && !requestedNotebookId) {
      const accessibleWorkspaceIds = await listAccessibleWorkspaceIds(userId);
      const filters = [{ owner: userObjectId }];

      if (accessibleWorkspaceIds.length) {
        filters.push({
          workspaceId: {
            $in: accessibleWorkspaceIds.map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          },
        });
      }

      if (collaboratorNoteObjectIds.length) {
        filters.push({ _id: { $in: collaboratorNoteObjectIds } });
      }

      if (notebookMembershipObjectIds.length) {
        const uniqueNotebookIds = Array.from(
          new Set(notebookMembershipObjectIds.map((id) => id.toString()))
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

    const notes = await Note.find(query)
      .sort({ pinned: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    const response = notes.map((note) => {
      const noteId = note._id.toString();
      const collabRole = collaboratorByNoteId.get(noteId) ?? null;
      const isOwner = String(note.owner) === String(userId);
      const notebookRole = note.notebookId
        ? notebookRoleById.get(note.notebookId.toString()) ??
          (isOwner ? "owner" : null)
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

    return res.status(200).json(response);
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
        : permissions.workspaceRole ?? permissions.collaboratorRole ?? null,
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
      boardId,
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
    const boardContext =
      (await resolveBoardForUser(boardId, userId)) ??
      (await resolveBoardForUser(req.user?.defaultBoard, userId));

    if (!boardContext) {
      return res
        .status(404)
        .json({ message: "Board not found or inaccessible" });
    }

    const role = boardContext.member?.role ?? "owner";
    if (!EDIT_ROLES.has(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    await touchWorkspaceMember(boardContext.workspace._id, userId);

    const payload = {
      owner: userId,
      workspaceId: boardContext.workspace._id,
      boardId: boardContext.board._id,
      title,
      content,
      tags,
    };

    let notebookObjectId = null;
    if (typeof notebookId !== "undefined" && notebookId !== null) {
      if (notebookId === "" || notebookId === "uncategorized") {
        payload.notebookId = null;
      } else {
        const notebookAccess = await getNotebookMembership(notebookId, userId);
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
        payload.notebookId = notebookObjectId;
      }
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
      boardId: savedNote.boardId,
      actorId: userId,
      eventType: "create",
      summary: "Created note",
    });

    if (notebookObjectId) {
      await appendNotesToNotebookOrder(notebookObjectId, [savedNote._id]);
    }
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
      boardId,
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

    if (typeof boardId !== "undefined") {
      const boardContext = await resolveBoardForUser(boardId, req.user.id);
      if (!boardContext) {
        return res
          .status(404)
          .json({ message: "Board not found or inaccessible" });
      }
      const boardRole = boardContext.member?.role ?? "owner";
      if (!EDIT_ROLES.has(boardRole)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      updates.boardId = boardContext.board._id;
      updates.workspaceId = boardContext.workspace._id;
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
          req.user.id
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
      req.user.id
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
      typeof boardId !== "undefined" &&
      String(access.note.boardId ?? "") !== String(updatedNote.boardId ?? "")
    ) {
      eventType = "move";
      changes.push("board");
    }

    if (
      typeof notebookId !== "undefined" &&
      String(access.note.notebookId ?? "") !==
        String(updatedNote.notebookId ?? "")
    ) {
      changes.push("notebook");
    }

    await NoteHistory.create({
      noteId: updatedNote._id,
      workspaceId: updatedNote.workspaceId ?? access.workspaceId ?? null,
      boardId: updatedNote.boardId ?? access.boardId ?? null,
      actorId: req.user.id,
      eventType,
      summary:
        changes.length === 0 ? "Edited note" : `Updated ${changes.join(", ")}`,
    });

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

    const refreshedAccess = await resolveNoteForUser(
      updatedNote._id,
      req.user.id
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
        : nextPermissions.workspaceRole ??
          nextPermissions.collaboratorRole ??
          null,
    };

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

    const deletedNote = await Note.findOneAndDelete({ _id: id });
    if (!deletedNote) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    if (deletedNote.docName) {
      await CollabDocument.findOneAndDelete({ name: deletedNote.docName });
    }

    await NoteCollaborator.deleteMany({ noteId: deletedNote._id });

    await NoteHistory.create({
      noteId: deletedNote._id,
      workspaceId: deletedNote.workspaceId ?? access.workspaceId ?? null,
      boardId: deletedNote.boardId ?? access.boardId ?? null,
      actorId: req.user.id,
      eventType: "delete",
      summary: "Deleted note",
    });

    if (deletedNote.notebookId) {
      await removeNotesFromNotebookOrder(deletedNote.notebookId, [
        deletedNote._id,
      ]);
    }

    // 204 No Content is common; 200 is fine too.
    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    logger.error("Error in deleteNote", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getTagStats = async (req, res) => {
  try {
    const ownerId = req.user?.id;

    if (!ownerId || !isValidObjectId(ownerId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    let targetBoardId = req.query?.boardId;
    let targetWorkspaceId = null;
    if (targetBoardId) {
      const context = await resolveBoardForUser(targetBoardId, ownerId);
      if (!context) {
        return res
          .status(404)
          .json({ message: "Board not found or inaccessible" });
      }
      targetBoardId = context.board._id.toString();
      targetWorkspaceId = context.workspace._id.toString();
      await touchWorkspaceMember(context.workspace._id, ownerId);
    } else if (req.user?.defaultBoard) {
      const context = await resolveBoardForUser(req.user.defaultBoard, ownerId);
      if (context) {
        targetBoardId = context.board._id.toString();
        targetWorkspaceId = context.workspace._id.toString();
      }
    }

    const accessibleWorkspaceIds = await listAccessibleWorkspaceIds(ownerId);
    const workspaceObjectIds = accessibleWorkspaceIds.map(
      (value) => new mongoose.Types.ObjectId(value)
    );

    const ownerMatch = new mongoose.Types.ObjectId(ownerId);
    const matchStage = targetBoardId
      ? {
          boardId: new mongoose.Types.ObjectId(targetBoardId),
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

    if (targetWorkspaceId) {
      matchStage.workspaceId = new mongoose.Types.ObjectId(targetWorkspaceId);
    }

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
    const { action, noteIds, tags = [], boardId, notebookId } = req.body ?? {};

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
      (value) => new mongoose.Types.ObjectId(value)
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

    const membershipCache = new Map();
    const resolveRole = async (workspaceId) => {
      if (!workspaceId) return null;
      const key = workspaceId.toString();
      if (membershipCache.has(key)) {
        return membershipCache.get(key);
      }
      const membership = await getWorkspaceMembership(workspaceId, ownerId);
      const role = membership?.member?.role ?? (membership ? "owner" : null);
      membershipCache.set(key, role);
      return role;
    };

    const permittedNotes = [];
    for (const note of candidateNotes) {
      const isOwner = String(note.owner) === String(ownerId);
      let role = null;
      if (note.workspaceId) {
        role = await resolveRole(note.workspaceId);
      }
      if (isOwner || (role && EDIT_ROLES.has(role))) {
        permittedNotes.push(note);
      }
    }

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
        .map((value) => value.toString())
    );

    const touchPromises = [...touchIds].map((workspaceId) =>
      touchWorkspaceMember(workspaceId, ownerId)
    );

    const objectIdArray = allowedIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    if (action === "pin" || action === "unpin") {
      const desiredPinned = action === "pin";
      const result = await Note.updateMany(
        { _id: { $in: objectIdArray } },
        {
          $set: { pinned: desiredPinned },
        }
      );

      await Promise.all([
        ...touchPromises,
        NoteHistory.insertMany(
          permittedNotes.map((note) => ({
            noteId: note._id,
            workspaceId: note.workspaceId ?? null,
            boardId: note.boardId ?? null,
            actorId: ownerId,
            eventType: desiredPinned ? "pin" : "unpin",
            summary: desiredPinned ? "Pinned note" : "Unpinned note",
          }))
        ),
      ]);

      return res.status(200).json({
        action,
        updated: result.modifiedCount ?? 0,
        noteIds: normalizedIds,
      });
    }

    if (action === "delete") {
      const docNames = permittedNotes
        .map((note) => note.docName)
        .filter((name) => typeof name === "string" && name.length > 0);

      if (docNames.length) {
        await CollabDocument.deleteMany({ name: { $in: docNames } });
      }

      const result = await Note.deleteMany({ _id: { $in: objectIdArray } });
      await NoteCollaborator.deleteMany({ noteId: { $in: objectIdArray } });

      await Promise.all([
        ...touchPromises,
        NoteHistory.insertMany(
          permittedNotes.map((note) => ({
            noteId: note._id,
            workspaceId: note.workspaceId ?? null,
            boardId: note.boardId ?? null,
            actorId: ownerId,
            eventType: "delete",
            summary: "Deleted note",
          }))
        ),
      ]);

      const notebookRemovals = new Set(
        permittedNotes
          .map((note) => note.notebookId)
          .filter((id) => id)
          .map((id) => id.toString())
      );

      for (const notebook of notebookRemovals) {
        await removeNotesFromNotebookOrder(
          new mongoose.Types.ObjectId(notebook),
          objectIdArray
        );
      }

      return res.status(200).json({
        action,
        deleted: result.deletedCount ?? 0,
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

      let updatedCount = 0;
      for (const note of permittedNotes) {
        const existingTags = Array.isArray(note.tags) ? note.tags : [];
        const merged = Array.from(
          new Set([
            ...existingTags.map((tag) => tag.toLowerCase()),
            ...normalizedTags,
          ])
        ).slice(0, MAX_TAGS_PER_NOTE);
        const result = await Note.updateOne(
          { _id: note._id },
          { $set: { tags: merged } }
        );
        if (result.modifiedCount) {
          updatedCount += 1;
          await NoteHistory.create({
            noteId: note._id,
            workspaceId: note.workspaceId ?? null,
            boardId: note.boardId ?? null,
            actorId: ownerId,
            eventType: "tag",
            summary: `Added tags: ${normalizedTags.join(", ")}`,
          });
        }
      }

      await Promise.all(touchPromises);

      return res.status(200).json({
        action,
        updated: updatedCount,
        noteIds: normalizedIds,
        tags: normalizedTags,
      });
    }

    if (action === "move") {
      const boardContext = await resolveBoardForUser(boardId, ownerId);
      if (!boardContext) {
        return res
          .status(404)
          .json({ message: "Board not found or inaccessible" });
      }

      const boardRole = boardContext.member?.role ?? "owner";
      if (!EDIT_ROLES.has(boardRole)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const result = await Note.updateMany(
        { _id: { $in: objectIdArray } },
        {
          $set: {
            boardId: boardContext.board._id,
            workspaceId: boardContext.workspace._id,
          },
        }
      );

      await Promise.all([
        ...touchPromises,
        touchWorkspaceMember(boardContext.workspace._id, ownerId),
        NoteHistory.insertMany(
          permittedNotes.map((note) => ({
            noteId: note._id,
            workspaceId: boardContext.workspace._id,
            boardId: boardContext.board._id,
            actorId: ownerId,
            eventType: "move",
            summary: `Moved to ${boardContext.board.name}`,
          }))
        ),
      ]);

      return res.status(200).json({
        action,
        updated: result.modifiedCount ?? 0,
        noteIds: normalizedIds,
        boardId: boardContext.board._id,
      });
    }

    if (action === "moveNotebook") {
      let targetNotebookId = null;
      if (notebookId && notebookId !== "uncategorized") {
        const notebook = await ensureNotebookOwnership(notebookId, ownerId);
        if (!notebook) {
          return res.status(404).json({ message: "Notebook not found" });
        }
        targetNotebookId = notebook._id;
      }

      const ownNotes = permittedNotes.filter(
        (note) => String(note.owner) === String(ownerId)
      );

      if (!ownNotes.length) {
        return res
          .status(403)
          .json({ message: "Only personal notes can be moved to notebooks" });
      }

      const noteObjectIds = ownNotes.map((note) => note._id);

      await Note.updateMany(
        { _id: { $in: noteObjectIds } },
        { $set: { notebookId: targetNotebookId } }
      );

      const previousNotebookIds = new Set(
        ownNotes
          .map((note) => note.notebookId)
          .filter((value) => value)
          .map((value) => value.toString())
      );

      for (const notebook of previousNotebookIds) {
        await removeNotesFromNotebookOrder(
          new mongoose.Types.ObjectId(notebook),
          noteObjectIds
        );
      }

      if (targetNotebookId) {
        await appendNotesToNotebookOrder(targetNotebookId, noteObjectIds);
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
      500
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
    }));

    return res.status(200).json({ history: payload });
  } catch (error) {
    logger.error("Failed to fetch note history", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getNotePresence = async (req, res) => {
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

    const docName = access.note?.docName ?? `note:${id}`;
    const collabDoc = await CollabDocument.findOne({ name: docName })
      .select({ awareness: 1, updatedAt: 1 })
      .lean();

    return res.status(200).json({
      updatedAt: collabDoc?.updatedAt ?? null,
      awareness: collabDoc?.awareness ?? {},
    });
  } catch (error) {
    logger.error("Failed to fetch note presence", { error: error?.message });
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
        userId
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
    const { noteIds, notebookId } = req.body ?? {};
    const normalizedIds = normalizeNoteIds(noteIds);
    const userId = req.user.id;

    if (!normalizedIds.length) {
      if (notebookId && notebookId !== "uncategorized") {
        const notebook = await ensureNotebookOwnership(notebookId, userId);
        if (!notebook) {
          return res.status(404).json({ message: "Notebook not found" });
        }
        await Notebook.findByIdAndUpdate(notebook._id, { noteOrder: [] });
        return res.status(200).json({ noteIds: [] });
      }

      await User.findByIdAndUpdate(userId, { customNoteOrder: [] });
      if (req.userDocument) {
        req.userDocument.customNoteOrder = [];
      }
      return res.status(200).json({ noteIds: [] });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const accessibleWorkspaceIds = await listAccessibleWorkspaceIds(userId);
    const workspaceObjectIds = accessibleWorkspaceIds.map(
      (value) => new mongoose.Types.ObjectId(value)
    );

    const collaboratorDocs = await NoteCollaborator.find({
      userId: userObjectId,
    })
      .select({ noteId: 1 })
      .lean();

    const collaboratorNoteObjectIds = collaboratorDocs
      .map((entry) => entry?.noteId)
      .filter((noteId) =>
        noteId ? mongoose.Types.ObjectId.isValid(noteId) : false
      )
      .map((noteId) => new mongoose.Types.ObjectId(noteId));

    const orConditions = [{ owner: userObjectId }];

    if (workspaceObjectIds.length) {
      orConditions.push({ workspaceId: { $in: workspaceObjectIds } });
    }

    if (collaboratorNoteObjectIds.length) {
      orConditions.push({ _id: { $in: collaboratorNoteObjectIds } });
    }

    if (notebookId && notebookId !== "uncategorized") {
      const notebook = await ensureNotebookOwnership(notebookId, userId);
      if (!notebook) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      const candidates = await Note.find(
        {
          _id: {
            $in: normalizedIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
          owner: userObjectId,
          notebookId: notebook._id,
        },
        { _id: 1 }
      ).lean();

      const allowedSet = new Set(candidates.map((note) => note._id.toString()));
      const filteredIds = normalizedIds.filter((id) => allowedSet.has(id));

      const objectIdOrder = filteredIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      await Notebook.findByIdAndUpdate(notebook._id, {
        noteOrder: objectIdOrder,
      });

      return res.status(200).json({ noteIds: filteredIds });
    }

    const candidates = await Note.find(
      {
        _id: {
          $in: normalizedIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        $or: orConditions,
      },
      { _id: 1 }
    ).lean();

    const allowedSet = new Set(candidates.map((note) => note._id.toString()));
    const filteredIds = normalizedIds.filter((id) => allowedSet.has(id));

    const objectIdOrder = filteredIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    await User.findByIdAndUpdate(userId, {
      customNoteOrder: objectIdOrder,
    });

    if (req.userDocument) {
      req.userDocument.customNoteOrder = objectIdOrder;
    }

    return res.status(200).json({ noteIds: filteredIds });
  } catch (error) {
    logger.error("Failed to update note layout", {
      error: error?.message,
      stack: error?.stack,
      userId: req.user?.id,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};
