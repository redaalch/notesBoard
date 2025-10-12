import crypto from "crypto";
import mongoose from "mongoose";

const NOTEBOOK_SHARE_ROLES = ["viewer", "editor"];
const BOARD_SHARE_ROLES = ["viewer", "commenter", "editor"];

const shareLinkSchema = new mongoose.Schema(
  {
    resourceType: {
      type: String,
      enum: ["board", "notebook"],
      default: "board",
      index: true,
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      default: null,
      index: true,
    },
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      default: null,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["viewer", "commenter", "editor"],
      default: "viewer",
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

shareLinkSchema.statics.hash = function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
};

shareLinkSchema.statics.generateToken = function generateToken(size = 24) {
  return crypto.randomBytes(size).toString("hex");
};

shareLinkSchema.methods.isExpired = function isExpired(
  referenceDate = new Date()
) {
  if (this.revokedAt) {
    return true;
  }
  if (!this.expiresAt) {
    return false;
  }
  return this.expiresAt <= referenceDate;
};

shareLinkSchema.methods.markRevoked = function markRevoked(
  actorId,
  when = new Date()
) {
  this.revokedAt = when;
  this.revokedBy = actorId ?? null;
};

shareLinkSchema.pre("validate", function ensureResourceContext(next) {
  if (!this.resourceType) {
    if (this.notebookId) {
      this.resourceType = "notebook";
    } else if (this.boardId) {
      this.resourceType = "board";
    }
  }

  if (this.boardId && this.notebookId) {
    this.invalidate(
      "notebookId",
      "Cannot set both boardId and notebookId on a share link"
    );
  }

  if (this.resourceType === "board" && !this.boardId) {
    this.invalidate("boardId", "Board id is required for board share link");
  }

  if (this.resourceType === "notebook" && !this.notebookId) {
    this.invalidate(
      "notebookId",
      "Notebook id is required for notebook share link"
    );
  }

  next();
});

shareLinkSchema.pre("validate", function ensureRoleMatchesResource(next) {
  if (
    this.resourceType === "notebook" &&
    !NOTEBOOK_SHARE_ROLES.includes(this.role)
  ) {
    this.role = "viewer";
  }

  if (this.resourceType === "board" && !BOARD_SHARE_ROLES.includes(this.role)) {
    this.role = "viewer";
  }

  next();
});

const ShareLink = mongoose.model("ShareLink", shareLinkSchema);

export default ShareLink;
