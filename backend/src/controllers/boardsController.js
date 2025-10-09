import mongoose from "mongoose";
import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

const normalizeId = (value) => {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (_error) {
    return null;
  }
};

export const listBoards = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const ownerQueryId = normalizeId(userId);
    if (!ownerQueryId) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const workspaces = await Workspace.find({
      $or: [{ ownerId: ownerQueryId }, { "members.userId": ownerQueryId }],
    })
      .select({ name: 1 })
      .lean();

    if (!workspaces.length) {
      return res.status(200).json({ boards: [], defaultBoardId: null });
    }

    const workspaceMap = new Map(
      workspaces.map((workspace) => [workspace._id.toString(), workspace])
    );
    const workspaceIds = Array.from(workspaceMap.keys());

    const collaboratorIds = new Set();
    workspaces.forEach((workspace) => {
      collaboratorIds.add(workspace.ownerId.toString());
      (workspace.members ?? []).forEach((member) =>
        collaboratorIds.add(member.userId.toString())
      );
    });

    const users = await User.find(
      {
        _id: {
          $in: Array.from(collaboratorIds).map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
      },
      { name: 1, email: 1 }
    ).lean();
    const userMap = new Map(
      users.map((user) => [
        user._id.toString(),
        { name: user.name, email: user.email },
      ])
    );

    const boards = await Board.find({
      workspaceId: {
        $in: workspaceIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select({ name: 1, workspaceId: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: 1 })
      .lean();

    const responseBoards = boards.map((board) => {
      const workspace = workspaceMap.get(board.workspaceId.toString());
      const collaborators = [];
      const seenCollaborators = new Set();

      if (workspace) {
        const ownerId = workspace.ownerId.toString();
        seenCollaborators.add(ownerId);
        const ownerMember = (workspace.members ?? []).find(
          (member) => String(member.userId) === ownerId
        );
        collaborators.push({
          id: ownerId,
          role: "owner",
          name:
            ownerMember?.displayName ??
            userMap.get(ownerId)?.name ??
            "Workspace owner",
          lastActiveAt: ownerMember?.lastActiveAt ?? workspace.updatedAt,
          avatarColor: ownerMember?.avatarColor ?? null,
        });

        (workspace.members ?? []).forEach((member) => {
          const memberId = member.userId.toString();
          if (seenCollaborators.has(memberId)) return;
          seenCollaborators.add(memberId);
          collaborators.push({
            id: memberId,
            role: member.role,
            name:
              member.displayName ||
              userMap.get(memberId)?.name ||
              "Collaborator",
            lastActiveAt: member.lastActiveAt ?? member.joinedAt,
            avatarColor: member.avatarColor ?? null,
          });
        });
      }

      return {
        id: board._id.toString(),
        name: board.name,
        workspaceId: board.workspaceId.toString(),
        workspaceName: workspace?.name ?? "",
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        collaborators,
      };
    });

    return res.status(200).json({
      boards: responseBoards,
      defaultBoardId: req.user?.defaultBoard ?? null,
    });
  } catch (error) {
    logger.error("Error listing boards", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export default { listBoards };
