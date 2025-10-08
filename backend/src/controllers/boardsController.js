import mongoose from "mongoose";
import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";
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

    const boards = await Board.find({
      workspaceId: {
        $in: workspaceIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select({ name: 1, workspaceId: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: 1 })
      .lean();

    const responseBoards = boards.map((board) => ({
      id: board._id.toString(),
      name: board.name,
      workspaceId: board.workspaceId.toString(),
      workspaceName: workspaceMap.get(board.workspaceId.toString())?.name ?? "",
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    }));

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
