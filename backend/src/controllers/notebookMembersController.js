import mongoose from "mongoose";
import NotebookMember, {
  NOTEBOOK_MEMBER_ROLES,
} from "../models/NotebookMember.js";
import Notebook from "../models/Notebook.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { normalizeEmail, isValidObjectId } from "../utils/validators.js";
import { ensureNotebookAccess } from "../utils/access.js";
import { sendMail } from "../utils/mailer.js";

const NOTEBOOK_MEMBER_MANAGE_ROLES = new Set(["owner", "editor"]);
const DEFAULT_INVITE_TTL_HOURS = Number.isFinite(
  Number(process.env.NOTEBOOK_INVITE_TTL_HOURS)
)
  ? Number(process.env.NOTEBOOK_INVITE_TTL_HOURS)
  : 168; // 7 days
const MAX_INVITE_TTL_HOURS = 24 * 30; // 30 days

const parseInviteExpiration = (expiresInHours) => {
  const numeric = Number(expiresInHours);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  const clamped = Math.min(Math.max(numeric, 1), MAX_INVITE_TTL_HOURS);
  const ms = clamped * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
};

const toMetadataMap = (value) => {
  if (value instanceof Map) {
    return value;
  }
  if (value && typeof value === "object") {
    return new Map(Object.entries(value));
  }
  return new Map();
};

const serializeMetadata = (value) => {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (value && typeof value === "object") {
    return value;
  }
  return {};
};

const getActorRole = (context) => context?.membership?.role ?? "viewer";

const canManageMembers = (context) =>
  NOTEBOOK_MEMBER_MANAGE_ROLES.has(getActorRole(context));

const buildNotebookInviteLink = (token, notebookId) => {
  const candidates = [
    process.env.NOTEBOOK_INVITE_URL,
    process.env.CLIENT_APP_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if (!url.pathname || url.pathname === "/") {
        url.pathname = "/notebook/invite";
      }
      url.searchParams.set("token", token);
      if (notebookId) {
        url.searchParams.set("notebookId", notebookId.toString());
      }
      return url.toString();
    } catch (_error) {
      continue;
    }
  }

  const base = "http://localhost:5173/notebook/invite";
  const fallbackUrl = new URL(base);
  fallbackUrl.searchParams.set("token", token);
  if (notebookId) {
    fallbackUrl.searchParams.set("notebookId", notebookId.toString());
  }
  return fallbackUrl.toString();
};

const buildNotebookMemberPayload = async (notebook) => {
  const notebookId =
    notebook._id instanceof mongoose.Types.ObjectId
      ? notebook._id
      : new mongoose.Types.ObjectId(notebook._id);

  const memberships = await NotebookMember.find({ notebookId })
    .sort({ invitedAt: 1, createdAt: 1 })
    .lean();

  const ownerId =
    notebook.owner instanceof mongoose.Types.ObjectId
      ? notebook.owner.toString()
      : notebook.owner?.toString?.() ?? null;

  const referencedUserIds = new Set();
  memberships.forEach((entry) => {
    if (entry.userId) referencedUserIds.add(entry.userId.toString());
    if (entry.invitedBy) referencedUserIds.add(entry.invitedBy.toString());
    if (entry.revokedBy) referencedUserIds.add(entry.revokedBy.toString());
  });
  if (ownerId) {
    referencedUserIds.add(ownerId);
  }

  const users = referencedUserIds.size
    ? await User.find(
        {
          _id: {
            $in: Array.from(referencedUserIds).map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          },
        },
        { _id: 1, name: 1, email: 1 }
      ).lean()
    : [];
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  const payload = memberships.map((member) => {
    const memberId = member.userId?.toString?.() ?? null;
    const user = memberId ? userMap.get(memberId) : null;
    const invitedById = member.invitedBy?.toString?.() ?? null;
    const inviter = invitedById ? userMap.get(invitedById) : null;
    const revokedById = member.revokedBy?.toString?.() ?? null;
    const revoker = revokedById ? userMap.get(revokedById) : null;
    const metadata = serializeMetadata(member.metadata);

    return {
      id: member._id.toString(),
      userId: memberId,
      role: member.role,
      status: member.status,
      email: user?.email ?? metadata.email ?? null,
      name: user?.name ?? metadata.name ?? null,
      invitedAt: member.invitedAt ?? null,
      invitedBy: invitedById,
      invitedByName: inviter?.name ?? null,
      acceptedAt: member.acceptedAt ?? null,
      revokedAt: member.revokedAt ?? null,
      revokedBy: revokedById,
      revokedByName: revoker?.name ?? null,
      lastNotifiedAt: member.lastNotifiedAt ?? null,
      metadata,
    };
  });

  const ownerIncluded = payload.some((entry) => entry.role === "owner");
  if (!ownerIncluded && ownerId) {
    const ownerUser = userMap.get(ownerId) ?? null;
    payload.unshift({
      id: null,
      userId: ownerId,
      role: "owner",
      status: "active",
      email: ownerUser?.email ?? null,
      name: ownerUser?.name ?? "Notebook Owner",
      invitedAt: notebook.createdAt ?? null,
      invitedBy: ownerId,
      invitedByName: ownerUser?.name ?? null,
      acceptedAt: notebook.createdAt ?? null,
      revokedAt: null,
      revokedBy: null,
      revokedByName: null,
      lastNotifiedAt: null,
      metadata: { legacy: true },
    });
  }

  return payload;
};

const sendInvitationEmail = async ({
  invitee,
  inviter,
  notebook,
  role,
  token,
}) => {
  if (!invitee?.email) return;

  const inviteUrl = buildNotebookInviteLink(
    token,
    notebook._id?.toString?.() ?? null
  );

  const roleLabel = role === "editor" ? "edit" : "view";
  const subject = `${
    inviter?.name ?? "A teammate"
  } invited you to ${roleLabel} the notebook "${notebook.name}"`;
  const html = `<!doctype html><html><body><p>Hi ${
    invitee.name || invitee.email
  },</p><p><strong>${
    inviter?.name || "A teammate"
  }</strong> invited you to ${roleLabel} the notebook "${
    notebook.name
  }".</p><p><a href="${inviteUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background-color:#6366f1;color:#ffffff;text-decoration:none">Open notebook</a></p><p>If you weren't expecting this invitation you can safely ignore this email.</p></body></html>`;
  const text = `Hi ${invitee.name || invitee.email},\n\n${
    inviter?.name || "A teammate"
  } invited you to ${roleLabel} the notebook "${
    notebook.name
  }".\n\nJoin here: ${inviteUrl}\n\nIf you weren't expecting this invitation you can ignore this email.`;

  try {
    await sendMail({
      to: invitee.email,
      subject,
      html,
      text,
    });
  } catch (error) {
    logger.error("Failed to send notebook invitation email", {
      error: error?.message,
      notebookId: notebook._id?.toString?.() ?? null,
      invitee: invitee.email,
    });
  }
};

export const listNotebookMembers = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid notebook id" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    const members = await buildNotebookMemberPayload(context.notebook);

    return res.status(200).json({
      notebookId: context.notebook._id.toString(),
      members,
      role: getActorRole(context),
      canManage: canManageMembers(context),
    });
  } catch (error) {
    logger.error("Failed to list notebook members", {
      error: error?.message,
      notebookId: req.params?.id,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const inviteNotebookMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, expiresInHours } = req.body ?? {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid notebook id" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!canManageMembers(context)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const actorRole = getActorRole(context);
    const normalizedRole = NOTEBOOK_MEMBER_ROLES.includes(role)
      ? role
      : "viewer";
    if (normalizedRole === "owner" && actorRole !== "owner") {
      return res
        .status(403)
        .json({ message: "Only owners can assign owner role" });
    }

    if (String(user._id) === String(context.notebook.owner)) {
      return res
        .status(400)
        .json({ message: "Notebook owner already has full access" });
    }

    const existing = await NotebookMember.findOne({
      notebookId: context.notebook._id,
      userId: user._id,
    });

    const now = new Date();
    const rawToken = NotebookMember.generateInviteToken();
    const expiresAt =
      parseInviteExpiration(expiresInHours) ??
      new Date(now.getTime() + DEFAULT_INVITE_TTL_HOURS * 60 * 60 * 1000);

    if (existing) {
      if (existing.isActive()) {
        return res
          .status(409)
          .json({ message: "User is already a member of this notebook" });
      }

      existing.role = normalizedRole;
      existing.status = "pending";
      existing.invitedAt = now;
      existing.invitedBy = new mongoose.Types.ObjectId(req.user.id);
      existing.revokedAt = null;
      existing.revokedBy = null;
      existing.metadata = toMetadataMap(existing.metadata);
      existing.metadata.set("email", user.email);
      if (user.name) {
        existing.metadata.set("name", user.name);
      }
      existing.metadata = existing.metadata ?? new Map();
      existing.metadata.set?.("email", user.email);
      existing.setInviteToken(rawToken, expiresAt);
      await existing.save();
    } else {
      const member = new NotebookMember({
        notebookId: context.notebook._id,
        userId: user._id,
        role: normalizedRole,
        status: "pending",
        invitedAt: now,
        metadata: new Map([
          ["email", user.email],
          ["name", user.name ?? null],
        ]),
        lastNotifiedAt: now,
        metadata: new Map([["email", user.email]]),
      });
      member.setInviteToken(rawToken, expiresAt);
      await member.save();
    }

    await sendInvitationEmail({
      invitee: user,
      inviter: { name: req.user.name, email: req.user.email },
      notebook: context.notebook,
      role: normalizedRole,
      token: rawToken,
    });

    const members = await buildNotebookMemberPayload(context.notebook);

    return res.status(201).json({
      notebookId: context.notebook._id.toString(),
      members,
      canManage: true,
    });
  } catch (error) {
    logger.error("Failed to invite notebook member", {
      error: error?.message,
      notebookId: req.params?.id,
    });
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Duplicate invitation" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resendNotebookInvitation = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "Invalid identifier" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!canManageMembers(context)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const member = await NotebookMember.findOne({
      _id: new mongoose.Types.ObjectId(memberId),
      notebookId: context.notebook._id,
    });

    if (!member || member.status !== "pending") {
      return res.status(404).json({ message: "Invitation not found" });
    }

    const user = await User.findById(member.userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();
    const rawToken = NotebookMember.generateInviteToken();
    const expiresAt = new Date(
      now.getTime() + DEFAULT_INVITE_TTL_HOURS * 60 * 60 * 1000
    );

    member.invitedAt = now;
    member.lastNotifiedAt = now;
    member.invitedBy = new mongoose.Types.ObjectId(req.user.id);
    member.metadata = toMetadataMap(member.metadata);
    member.metadata.set("email", user.email);
    if (user.name) {
      member.metadata.set("name", user.name);
    }
    member.setInviteToken(rawToken, expiresAt);

    await member.save();

    await sendInvitationEmail({
      invitee: user,
      inviter: { name: req.user.name, email: req.user.email },
      notebook: context.notebook,
      role: member.role,
      token: rawToken,
    });

    const members = await buildNotebookMemberPayload(context.notebook);

    return res.status(200).json({
      notebookId: context.notebook._id.toString(),
      members,
      canManage: true,
    });
  } catch (error) {
    logger.error("Failed to resend notebook invitation", {
      error: error?.message,
      notebookId: req.params?.id,
      memberId: req.params?.memberId,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const revokeNotebookInvitation = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "Invalid identifier" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!canManageMembers(context)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const member = await NotebookMember.findOne({
      _id: new mongoose.Types.ObjectId(memberId),
      notebookId: context.notebook._id,
    });

    if (!member) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (member.role === "owner") {
      return res
        .status(400)
        .json({ message: "Cannot revoke owner membership" });
    }

    member.markRevoked(new mongoose.Types.ObjectId(req.user.id));
    await member.save();

    const members = await buildNotebookMemberPayload(context.notebook);

    return res.status(200).json({
      notebookId: context.notebook._id.toString(),
      members,
      canManage: true,
    });
  } catch (error) {
    logger.error("Failed to revoke notebook invitation", {
      error: error?.message,
      notebookId: req.params?.id,
      memberId: req.params?.memberId,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateNotebookMemberRole = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body ?? {};

    if (!isValidObjectId(id) || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "Invalid identifier" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!canManageMembers(context)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const normalizedRole = NOTEBOOK_MEMBER_ROLES.includes(role) ? role : null;
    if (!normalizedRole) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const member = await NotebookMember.findOne({
      _id: new mongoose.Types.ObjectId(memberId),
      notebookId: context.notebook._id,
    });

    if (!member || !member.isActive()) {
      return res.status(404).json({ message: "Member not found" });
    }

    const actorRole = getActorRole(context);
    if (normalizedRole === "owner" && actorRole !== "owner") {
      return res
        .status(403)
        .json({ message: "Only owners can promote other members to owner" });
    }

    if (member.role === "owner" && normalizedRole !== "owner") {
      const otherOwners = await NotebookMember.countDocuments({
        notebookId: context.notebook._id,
        role: "owner",
        status: "active",
        _id: { $ne: member._id },
      });
      if (!otherOwners) {
        return res
          .status(400)
          .json({ message: "Cannot remove the last owner of a notebook" });
      }
    }

    member.role = normalizedRole;
    await member.save();

    const members = await buildNotebookMemberPayload(context.notebook);

    return res.status(200).json({
      notebookId: context.notebook._id.toString(),
      members,
      canManage: true,
    });
  } catch (error) {
    logger.error("Failed to update notebook member role", {
      error: error?.message,
      notebookId: req.params?.id,
      memberId: req.params?.memberId,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removeNotebookMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "Invalid identifier" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!canManageMembers(context)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const member = await NotebookMember.findOne({
      _id: new mongoose.Types.ObjectId(memberId),
      notebookId: context.notebook._id,
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.role === "owner") {
      return res
        .status(400)
        .json({ message: "Cannot remove an owner from the notebook" });
    }

    member.markRevoked(new mongoose.Types.ObjectId(req.user.id));
    await member.save();

    const members = await buildNotebookMemberPayload(context.notebook);

    return res.status(200).json({
      notebookId: context.notebook._id.toString(),
      members,
      canManage: true,
    });
  } catch (error) {
    logger.error("Failed to remove notebook member", {
      error: error?.message,
      notebookId: req.params?.id,
      memberId: req.params?.memberId,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptNotebookInvitation = async (req, res) => {
  try {
    const { token } = req.body ?? {};
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invitation token is required" });
    }

    const tokenHash = NotebookMember.hashToken(token);
    const member = await NotebookMember.findOne({ inviteTokenHash: tokenHash });

    if (!member) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (member.status === "revoked") {
      return res.status(410).json({ message: "Invitation has been revoked" });
    }

    if (member.isActive()) {
      return res.status(409).json({ message: "Invitation already accepted" });
    }

    if (
      member.inviteExpiresAt &&
      member.inviteExpiresAt.getTime() < Date.now()
    ) {
      return res.status(410).json({ message: "Invitation has expired" });
    }

    if (String(member.userId) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ message: "Invitation does not belong to this user" });
    }

    member.markAccepted(new Date());
    member.lastNotifiedAt = new Date();
    await member.save();

    const notebook = await Notebook.findById(member.notebookId).lean();
    if (!notebook) {
      return res
        .status(200)
        .json({ message: "Invitation accepted", notebookRemoved: true });
    }

    const members = await buildNotebookMemberPayload(notebook);

    return res.status(200).json({
      notebookId: notebook._id.toString(),
      members,
      accepted: true,
    });
  } catch (error) {
    logger.error("Failed to accept notebook invitation", {
      error: error?.message,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  listNotebookMembers,
  inviteNotebookMember,
  resendNotebookInvitation,
  revokeNotebookInvitation,
  updateNotebookMemberRole,
  removeNotebookMember,
  acceptNotebookInvitation,
};
