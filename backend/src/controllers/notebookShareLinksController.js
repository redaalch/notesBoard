import mongoose from "mongoose";
import ShareLink from "../models/ShareLink.js";
import Notebook from "../models/Notebook.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { isValidObjectId } from "../utils/validators.js";
import { ensureNotebookAccess } from "../utils/access.js";

const MANAGE_ROLES = new Set(["owner", "editor"]);
const NOTEBOOK_SHARE_ROLES = new Set(["viewer", "editor"]);
const DEFAULT_SHARE_TTL_HOURS = Number.isFinite(
  Number(process.env.NOTEBOOK_SHARE_LINK_TTL_HOURS)
)
  ? Number(process.env.NOTEBOOK_SHARE_LINK_TTL_HOURS)
  : 168;
const MAX_SHARE_TTL_HOURS = 24 * 90; // 90 days

const clampExpiration = (hours) => {
  const numeric = Number(hours);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  const clamped = Math.min(Math.max(numeric, 1), MAX_SHARE_TTL_HOURS);
  return new Date(Date.now() + clamped * 60 * 60 * 1000);
};

const buildShareLinkUrl = (token, notebookId) => {
  const candidates = [
    process.env.NOTEBOOK_SHARE_URL,
    process.env.CLIENT_APP_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if (!url.pathname || url.pathname === "/") {
        url.pathname = "/notebook/share";
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

  const fallback = new URL("http://localhost:5173/notebook/share");
  fallback.searchParams.set("token", token);
  if (notebookId) {
    fallback.searchParams.set("notebookId", notebookId.toString());
  }
  return fallback.toString();
};

const toLeanUserMap = async (members) => {
  const ids = new Set();
  members.forEach((entry) => {
    if (entry.createdBy) ids.add(entry.createdBy.toString());
    if (entry.revokedBy) ids.add(entry.revokedBy.toString());
  });
  if (!ids.size) {
    return new Map();
  }
  const users = await User.find(
    {
      _id: {
        $in: Array.from(ids).map((id) => new mongoose.Types.ObjectId(id)),
      },
    },
    { _id: 1, name: 1, email: 1 }
  ).lean();
  return new Map(users.map((user) => [user._id.toString(), user]));
};

const serializeShareLink = (link, userMap) => {
  const createdById = link.createdBy?.toString?.() ?? null;
  const revokedById = link.revokedBy?.toString?.() ?? null;
  const creator = createdById ? userMap.get(createdById) : null;
  const revoker = revokedById ? userMap.get(revokedById) : null;

  return {
    id: link._id.toString(),
    role: link.role,
    expiresAt: link.expiresAt ?? null,
    createdAt: link.createdAt ?? null,
    createdBy: createdById,
    createdByName: creator?.name ?? null,
    revokedAt: link.revokedAt ?? null,
    revokedBy: revokedById,
    revokedByName: revoker?.name ?? null,
    lastAccessedAt: link.lastAccessedAt ?? null,
    metadata:
      link.metadata instanceof Map
        ? Object.fromEntries(link.metadata.entries())
        : link.metadata ?? {},
    token: null,
  };
};

const ensureManage = (context) => MANAGE_ROLES.has(context?.membership?.role);

export const listNotebookShareLinks = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid notebook id" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!ensureManage(context)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const links = await ShareLink.find({
      notebookId: context.notebook._id,
      resourceType: "notebook",
    })
      .sort({ createdAt: -1 })
      .lean();

    const userMap = await toLeanUserMap(links);
    const payload = links.map((link) => serializeShareLink(link, userMap));

    return res.status(200).json({
      notebookId: context.notebook._id.toString(),
      shareLinks: payload,
      canManage: true,
    });
  } catch (error) {
    logger.error("Failed to list notebook share links", {
      error: error?.message,
      notebookId: req.params?.id,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createNotebookShareLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, expiresInHours } = req.body ?? {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid notebook id" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!ensureManage(context)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const normalizedRole = NOTEBOOK_SHARE_ROLES.has(role) ? role : "viewer";
    const now = new Date();

    const noExpiryRequested =
      expiresInHours === null ||
      expiresInHours === "" ||
      (typeof expiresInHours === "string" &&
        ["never", "none", "no-expiry", "infinite"].includes(
          expiresInHours.trim().toLowerCase()
        ));

    const expiresAt = noExpiryRequested
      ? null
      : clampExpiration(expiresInHours) ??
        new Date(now.getTime() + DEFAULT_SHARE_TTL_HOURS * 60 * 60 * 1000);
    const rawToken = ShareLink.generateToken();
    const tokenHash = ShareLink.hash(rawToken);

    const link = await ShareLink.create({
      resourceType: "notebook",
      notebookId: context.notebook._id,
      tokenHash,
      role: normalizedRole,
      expiresAt,
      createdBy: new mongoose.Types.ObjectId(req.user.id),
      metadata: new Map([
        ["createdByName", req.user.name ?? null],
        ["role", normalizedRole],
      ]),
    });

    const shareUrl = buildShareLinkUrl(
      rawToken,
      context.notebook._id?.toString?.() ?? null
    );

    return res.status(201).json({
      notebookId: context.notebook._id.toString(),
      shareLink: {
        ...serializeShareLink(link.toObject(), new Map()),
        token: rawToken,
        url: shareUrl,
      },
      canManage: true,
    });
  } catch (error) {
    logger.error("Failed to create notebook share link", {
      error: error?.message,
      notebookId: req.params?.id,
    });
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Duplicate share link" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const revokeNotebookShareLink = async (req, res) => {
  try {
    const { id, shareLinkId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(shareLinkId)) {
      return res.status(400).json({ message: "Invalid identifier" });
    }

    const context = await ensureNotebookAccess(id, req.user.id);
    if (!context) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!ensureManage(context)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const link = await ShareLink.findOne({
      _id: new mongoose.Types.ObjectId(shareLinkId),
      notebookId: context.notebook._id,
      resourceType: "notebook",
    });

    if (!link) {
      return res.status(404).json({ message: "Share link not found" });
    }

    if (!link.revokedAt) {
      link.markRevoked(new mongoose.Types.ObjectId(req.user.id));
      await link.save();
    }

    const links = await ShareLink.find({
      notebookId: context.notebook._id,
      resourceType: "notebook",
    })
      .sort({ createdAt: -1 })
      .lean();

    const userMap = await toLeanUserMap(links);

    return res.status(200).json({
      notebookId: context.notebook._id.toString(),
      shareLinks: links.map((entry) => serializeShareLink(entry, userMap)),
      canManage: true,
    });
  } catch (error) {
    logger.error("Failed to revoke notebook share link", {
      error: error?.message,
      notebookId: req.params?.id,
      shareLinkId: req.params?.shareLinkId,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resolveNotebookShareToken = async (token) => {
  if (!token || typeof token !== "string") {
    return null;
  }
  try {
    const tokenHash = ShareLink.hash(token);
    const link = await ShareLink.findOne({ tokenHash }).lean();
    if (!link) {
      return null;
    }
    if (link.revokedAt) {
      return null;
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return null;
    }
    const notebook = await Notebook.findById(link.notebookId).lean();
    if (!notebook) {
      return null;
    }
    return { link, notebook };
  } catch (error) {
    logger.error("Failed to resolve notebook share token", {
      error: error?.message,
    });
    return null;
  }
};

export default {
  listNotebookShareLinks,
  createNotebookShareLink,
  revokeNotebookShareLink,
};
