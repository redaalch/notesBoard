import mongoose from "mongoose";
import Workspace, { WORKSPACE_ROLES } from "../models/Workspace.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { normalizeEmail, isValidObjectId } from "../utils/validators.js";

export const listUserWorkspaces = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(userId);

    const workspaces = await Workspace.find({
      $or: [{ ownerId: ownerObjectId }, { "members.userId": ownerObjectId }],
    })
      .select({ name: 1, ownerId: 1, members: 1, updatedAt: 1 })
      .sort({ name: 1 })
      .lean();

    const payload = workspaces.map((workspace) => {
      const workspaceId = workspace._id.toString();
      let role = "viewer";

      if (String(workspace.ownerId) === String(userId)) {
        role = "owner";
      } else {
        const membership = (workspace.members ?? []).find(
          (member) => String(member.userId) === String(userId)
        );
        role = membership?.role ?? "viewer";
      }

      return {
        id: workspaceId,
        name: workspace.name ?? "Workspace",
        role,
        memberCount: 1 + (workspace.members?.length ?? 0),
        updatedAt: workspace.updatedAt ?? null,
      };
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Failed to list user workspaces", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

const MANAGE_ROLES = new Set(["owner", "admin"]);
const INVITE_ROLES = WORKSPACE_ROLES.filter((role) => role !== "owner");

const normalizeRole = (value) => {
  if (typeof value !== "string") {
    return "editor";
  }
  const normalized = value.trim().toLowerCase();
  return INVITE_ROLES.includes(normalized) ? normalized : "editor";
};

const getWorkspaceById = async (workspaceId) => Workspace.findById(workspaceId);

const buildUserLookup = async (workspace) => {
  const ids = new Set();
  ids.add(workspace.ownerId.toString());
  (workspace.members ?? []).forEach((member) => {
    ids.add(member.userId.toString());
  });

  const users = await User.find(
    {
      _id: {
        $in: Array.from(ids).map((id) => new mongoose.Types.ObjectId(id)),
      },
    },
    { name: 1, email: 1 }
  ).lean();

  return new Map(
    users.map((user) => [
      user._id.toString(),
      { name: user.name, email: user.email },
    ])
  );
};

const serializeMembers = async (workspace) => {
  const userMap = await buildUserLookup(workspace);
  const ownerId = workspace.ownerId.toString();
  const members = [];

  members.push({
    id: ownerId,
    role: "owner",
    name: userMap.get(ownerId)?.name ?? "Workspace owner",
    email: userMap.get(ownerId)?.email ?? null,
    invitedAt: workspace.createdAt,
    joinedAt: workspace.createdAt,
    lastActiveAt: workspace.updatedAt,
    isOwner: true,
  });

  (workspace.members ?? []).forEach((member) => {
    const memberId = member.userId.toString();
    members.push({
      id: memberId,
      role: member.role,
      name: member.displayName || userMap.get(memberId)?.name || "Collaborator",
      email: userMap.get(memberId)?.email ?? null,
      invitedAt: member.invitedAt ?? workspace.createdAt,
      joinedAt: member.joinedAt ?? member.invitedAt ?? workspace.createdAt,
      lastActiveAt: member.lastActiveAt ?? null,
      isOwner: false,
    });
  });

  return {
    workspaceId: workspace._id.toString(),
    workspaceName: workspace.name,
    members,
  };
};

const resolveRequesterRole = (workspace, userId) => {
  if (String(workspace.ownerId) === String(userId)) {
    return "owner";
  }
  const member = (workspace.members ?? []).find(
    (entry) => String(entry.userId) === String(userId)
  );
  return member?.role ?? null;
};

export const listWorkspaceMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!isValidObjectId(workspaceId)) {
      return res.status(400).json({ message: "Invalid workspace id" });
    }

    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const requesterRole = resolveRequesterRole(workspace, req.user.id);
    if (!requesterRole) {
      return res.status(403).json({ message: "Workspace access denied" });
    }

    const payload = await serializeMembers(workspace);
    return res.status(200).json({
      ...payload,
      membershipRole: requesterRole,
      canManage: MANAGE_ROLES.has(requesterRole),
    });
  } catch (error) {
    logger.error("Failed to list workspace members", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const addWorkspaceMember = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { email, role } = req.body ?? {};

    if (!isValidObjectId(workspaceId)) {
      return res.status(400).json({ message: "Invalid workspace id" });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const desiredRole = normalizeRole(role);

    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const requesterRole = resolveRequesterRole(workspace, req.user.id);
    if (!MANAGE_ROLES.has(requesterRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    if (desiredRole === "owner") {
      return res
        .status(403)
        .json({ message: "Owner role cannot be assigned to members" });
    }

    if (desiredRole === "admin" && requesterRole !== "owner") {
      return res
        .status(403)
        .json({ message: "Only owners can assign admin role" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Unable to add member. Please verify the email address." });
    }

    if (String(user._id) === String(workspace.ownerId)) {
      return res
        .status(400)
        .json({ message: "Owner is already part of the workspace" });
    }

    const now = new Date();
    const userObjectId = new mongoose.Types.ObjectId(user._id);

    // Use atomic operations to avoid read-modify-save race conditions
    const existingMember = (workspace.members ?? []).find(
      (member) => String(member.userId) === String(user._id),
    );

    if (existingMember) {
      // Atomically update the existing member's role
      await Workspace.updateOne(
        { _id: workspace._id, "members.userId": userObjectId },
        {
          $set: {
            "members.$.role": desiredRole,
            "members.$.joinedAt": existingMember.joinedAt ?? now,
            "members.$.invitedAt": existingMember.invitedAt ?? now,
          },
        },
      );
    } else {
      // Atomically push a new member entry
      await Workspace.updateOne(
        { _id: workspace._id },
        {
          $push: {
            members: {
              userId: userObjectId,
              role: desiredRole,
              invitedAt: now,
              joinedAt: now,
              displayName: user.name ?? "",
              avatarColor: "",
              lastActiveAt: now,
            },
          },
        },
      );
    }

    // Re-fetch for serialization
    const updatedWorkspace = await Workspace.findById(workspace._id).lean();
    const payload = await serializeMembers(updatedWorkspace);
    return res.status(existingMember ? 200 : 201).json({
      ...payload,
      membershipRole: requesterRole,
      canManage: MANAGE_ROLES.has(requesterRole),
    });
  } catch (error) {
    logger.error("Failed to add workspace member", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  listUserWorkspaces,
  listWorkspaceMembers,
  addWorkspaceMember,
};
