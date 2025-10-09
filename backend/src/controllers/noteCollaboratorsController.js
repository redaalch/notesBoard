import mongoose from "mongoose";
import NoteCollaborator, {
  NOTE_COLLAB_ROLES,
} from "../models/NoteCollaborator.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { normalizeEmail, isValidObjectId } from "../utils/validators.js";
import { resolveNoteForUser } from "../utils/access.js";
import { sendMail } from "../utils/mailer.js";

const COLLABORATOR_ROLE_DEFAULT = "editor";

const SUPPORTED_ROLES = NOTE_COLLAB_ROLES;

const normalizeRole = (value) => {
  if (typeof value !== "string") {
    return COLLABORATOR_ROLE_DEFAULT;
  }
  const candidate = value.trim().toLowerCase();
  return SUPPORTED_ROLES.includes(candidate)
    ? candidate
    : COLLABORATOR_ROLE_DEFAULT;
};

const parseUrlCandidate = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const allowlist = ["http:", "https:"];

  try {
    const url = new URL(trimmed);
    if (!allowlist.includes(url.protocol)) {
      return null;
    }
    return url;
  } catch (_error) {
    try {
      const url = new URL(`https://${trimmed}`);
      if (!allowlist.includes(url.protocol)) {
        return null;
      }
      return url;
    } catch (_error) {
      return null;
    }
  }
};

const buildNoteLink = (noteId) => {
  const candidates = [
    process.env.NOTE_COLLABORATION_URL,
    process.env.CLIENT_APP_URL,
    process.env.FRONTEND_URL,
  ];

  for (const candidate of candidates) {
    const parsed = parseUrlCandidate(candidate);
    if (parsed) {
      if (!parsed.pathname || parsed.pathname === "/") {
        parsed.pathname = `/note/${noteId}`;
      } else if (!parsed.pathname.includes(noteId)) {
        parsed.pathname = `${parsed.pathname.replace(
          /\/$/,
          ""
        )}/note/${noteId}`;
      }
      return parsed.toString();
    }
  }

  return `http://localhost:5173/note/${noteId}`;
};

const buildCollaboratorPayload = async (noteId) => {
  const collaborators = await NoteCollaborator.find({ noteId })
    .sort({ invitedAt: 1 })
    .lean();

  if (!collaborators.length) {
    return [];
  }

  const userIds = collaborators.map((entry) => entry.userId);
  const inviterIds = collaborators.map((entry) => entry.invitedBy);
  const uniqueIds = Array.from(
    new Set(
      [...userIds, ...inviterIds].filter(Boolean).map((id) => id.toString())
    )
  );

  const users = await User.find(
    {
      _id: {
        $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    },
    { name: 1, email: 1 }
  ).lean();

  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  return collaborators.map((entry) => {
    const user = userMap.get(entry.userId.toString());
    const inviter = userMap.get(entry.invitedBy?.toString?.() ?? "");
    return {
      id: entry.userId.toString(),
      role: entry.role,
      name: user?.name ?? null,
      email: user?.email ?? null,
      invitedAt: entry.invitedAt,
      invitedBy: entry.invitedBy?.toString?.() ?? null,
      invitedByName: inviter?.name ?? null,
    };
  });
};

const sendCollaboratorEmail = async ({ invitee, inviter, note, role }) => {
  if (!invitee?.email) {
    return;
  }

  const noteUrl = buildNoteLink(note._id.toString());
  const subject = `${
    inviter?.name ?? "A teammate"
  } invited you to collaborate on "${note.title}"`;
  const roleLabel =
    role === "editor" ? "edit" : role === "commenter" ? "comment on" : "view";

  const text = `Hi ${invitee.name || invitee.email},\n\n${
    inviter?.name || "A teammate"
  } added you as a collaborator on the note "${
    note.title
  }".\n\nYou can ${roleLabel} the note here: ${noteUrl}\n\nIf you weren't expecting this invitation you can ignore this email.`;

  const html = `<!doctype html><html><body><p>Hi ${
    invitee.name || invitee.email
  },</p><p><strong>${
    inviter?.name || "A teammate"
  }</strong> added you as a collaborator on the note "${
    note.title
  }".</p><p>You can ${roleLabel} the note by clicking the button below.</p><p><a href="${noteUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background-color:#6366f1;color:#ffffff;text-decoration:none">Open note</a></p><p>If you weren't expecting this invitation you can safely ignore this email.</p></body></html>`;

  try {
    await sendMail({
      to: invitee.email,
      subject,
      text,
      html,
    });
  } catch (error) {
    logger.error("Failed to send collaborator invite email", {
      error: error?.message,
      to: invitee.email,
      noteId: note._id?.toString?.() ?? null,
    });
  }
};

export const listNoteCollaborators = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const access = await resolveNoteForUser(id, req.user.id);
    if (!access) {
      return res.status(404).json({ message: "Note not found" });
    }

    const collaborators = await buildCollaboratorPayload(access.note._id);

    return res.status(200).json({
      noteId: access.note._id.toString(),
      collaborators,
      canManage: access.permissions?.canManageCollaborators ?? false,
    });
  } catch (error) {
    logger.error("Failed to list note collaborators", {
      error: error?.message,
      noteId: req.params?.id,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const addNoteCollaborator = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body ?? {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const access = await resolveNoteForUser(id, req.user.id);
    if (!access) {
      return res.status(404).json({ message: "Note not found" });
    }

    if (!access.permissions?.canManageCollaborators) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const collaboratorRole = normalizeRole(role);
    const invitee = await User.findOne({ email: normalizedEmail }).lean();
    if (!invitee) {
      return res.status(404).json({ message: "User not found" });
    }

    if (String(invitee._id) === String(access.ownerId)) {
      return res
        .status(400)
        .json({ message: "Note owner already has full access" });
    }

    const now = new Date();
    await NoteCollaborator.findOneAndUpdate(
      {
        noteId: access.note._id,
        userId: invitee._id,
      },
      {
        $set: {
          role: collaboratorRole,
        },
        $setOnInsert: {
          invitedBy: req.user.id,
          invitedAt: now,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const collaborators = await buildCollaboratorPayload(access.note._id);

    await sendCollaboratorEmail({
      invitee,
      inviter: { name: req.user.name, email: req.user.email },
      note: access.note,
      role: collaboratorRole,
    });

    return res.status(201).json({
      noteId: access.note._id.toString(),
      collaborators,
      canManage: access.permissions?.canManageCollaborators ?? false,
    });
  } catch (error) {
    logger.error("Failed to add note collaborator", {
      error: error?.message,
      noteId: req.params?.id,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removeNoteCollaborator = async (req, res) => {
  try {
    const { id, collaboratorId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(collaboratorId)) {
      return res.status(400).json({ message: "Invalid identifier" });
    }

    const access = await resolveNoteForUser(id, req.user.id);
    if (!access) {
      return res.status(404).json({ message: "Note not found" });
    }

    if (!access.permissions?.canManageCollaborators) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    await NoteCollaborator.findOneAndDelete({
      noteId: access.note._id,
      userId: new mongoose.Types.ObjectId(collaboratorId),
    });

    const collaborators = await buildCollaboratorPayload(access.note._id);

    return res.status(200).json({
      noteId: access.note._id.toString(),
      collaborators,
      canManage: access.permissions?.canManageCollaborators ?? false,
    });
  } catch (error) {
    logger.error("Failed to remove note collaborator", {
      error: error?.message,
      noteId: req.params?.id,
      collaboratorId: req.params?.collaboratorId,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  listNoteCollaborators,
  addNoteCollaborator,
  removeNoteCollaborator,
};
