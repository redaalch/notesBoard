import mongoose from "mongoose";
import Workspace from "../models/Workspace.js";
import Board from "../models/Board.js";
import Note from "../models/Note.js";
import { isValidObjectId } from "./validators.js";

const toObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));

export const getWorkspaceMembership = async (workspaceId, userId) => {
  if (!workspaceId || !userId) return null;
  if (!isValidObjectId(workspaceId) || !isValidObjectId(userId)) {
    return null;
  }

  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) {
    return null;
  }

  if (String(workspace.ownerId) === String(userId)) {
    return {
      workspace,
      member: { role: "owner", lastActiveAt: workspace.updatedAt },
    };
  }

  const member = (workspace.members ?? []).find(
    (entry) => String(entry.userId) === String(userId)
  );
  if (!member) {
    return null;
  }

  return { workspace, member };
};

export const ensureWorkspaceMember = async (workspaceId, userId) => {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    const error = new Error("Workspace access denied");
    error.status = 403;
    throw error;
  }
  return membership;
};

export const resolveBoardForUser = async (boardId, userId) => {
  if (!boardId || !userId) return null;
  if (!isValidObjectId(boardId)) {
    return null;
  }

  const board = await Board.findById(boardId).lean();
  if (!board) {
    return null;
  }

  const membership = await getWorkspaceMembership(board.workspaceId, userId);
  if (!membership) {
    return null;
  }

  return { board, workspace: membership.workspace, member: membership.member };
};

export const resolveNoteForUser = async (noteId, userId) => {
  if (!noteId || !userId) return null;
  if (!isValidObjectId(noteId)) {
    return null;
  }

  const note = await Note.findById(noteId).lean();
  if (!note) {
    return null;
  }

  const workspaceId = note.workspaceId ?? note.owner;
  if (!workspaceId) {
    return null;
  }

  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership && String(note.owner) !== String(userId)) {
    return null;
  }

  return {
    note,
    workspaceId: note.workspaceId ?? null,
    boardId: note.boardId ?? null,
    ownerId: note.owner,
    membership,
  };
};

export const touchWorkspaceMember = async (workspaceId, userId, patch = {}) => {
  if (!workspaceId || !userId) return null;
  if (!isValidObjectId(workspaceId) || !isValidObjectId(userId)) {
    return null;
  }

  const update = {
    "members.$.lastActiveAt": patch.lastActiveAt ?? new Date(),
  };

  if (patch.displayName !== undefined) {
    update["members.$.displayName"] = patch.displayName;
  }
  if (patch.avatarColor !== undefined) {
    update["members.$.avatarColor"] = patch.avatarColor;
  }

  const result = await Workspace.updateOne(
    { _id: toObjectId(workspaceId), "members.userId": toObjectId(userId) },
    { $set: update }
  ).exec();

  if (!result?.modifiedCount) {
    await Workspace.updateOne(
      { _id: toObjectId(workspaceId), ownerId: toObjectId(userId) },
      {
        $set: {
          updatedAt: update["members.$.lastActiveAt"] ?? new Date(),
        },
      }
    ).exec();
  }
};

export const listAccessibleWorkspaceIds = async (userId) => {
  if (!userId || !isValidObjectId(userId)) {
    return [];
  }

  const workspaces = await Workspace.find(
    {
      $or: [
        { ownerId: toObjectId(userId) },
        { "members.userId": toObjectId(userId) },
      ],
    },
    { _id: 1 }
  ).lean();

  return workspaces.map((workspace) => workspace._id.toString());
};
