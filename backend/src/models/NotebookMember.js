import crypto from "crypto";
import mongoose from "mongoose";

export const NOTEBOOK_MEMBER_ROLES = ["owner", "editor", "viewer"];
export const NOTEBOOK_MEMBER_STATUSES = ["pending", "active", "revoked"];

const NOTEBOOK_MEMBER_ACTIVE_STATUSES = new Set(["active"]);

const notebookMemberSchema = new mongoose.Schema(
  {
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: NOTEBOOK_MEMBER_ROLES,
      default: "viewer",
    },
    status: {
      type: String,
      enum: NOTEBOOK_MEMBER_STATUSES,
      default: "pending",
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    inviteTokenHash: {
      type: String,
      default: undefined,
    },
    inviteExpiresAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => ({}),
      validate: {
        validator: (v) => {
          if (!v || v.size === 0) return true;
          try { return JSON.stringify(Object.fromEntries(v)).length <= 16_000; } catch { return false; }
        },
        message: "metadata exceeds the 16 KB size limit",
      },
    },
  },
  { timestamps: true },
);

notebookMemberSchema.index(
  { notebookId: 1, userId: 1 },
  { name: "notebook_member_unique", unique: true },
);

notebookMemberSchema.index(
  { notebookId: 1, status: 1, role: 1 },
  { name: "notebook_member_status_role" },
);

// Unique constraint on inviteTokenHash only when the field actually exists.
// sparse:true alone doesn't skip `null` — it only skips `undefined` / missing.
notebookMemberSchema.index(
  { inviteTokenHash: 1 },
  {
    name: "inviteTokenHash_unique_partial",
    unique: true,
    partialFilterExpression: {
      inviteTokenHash: { $type: "string" },
    },
  },
);

const hashToken = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

notebookMemberSchema.statics.generateInviteToken = function generateInviteToken(
  size = 32,
) {
  return crypto.randomBytes(size).toString("hex");
};

notebookMemberSchema.statics.hashToken = hashToken;

notebookMemberSchema.methods.setInviteToken = function setInviteToken(
  rawToken,
  expiresAt,
) {
  if (!rawToken) {
    this.set("inviteTokenHash", undefined);
    this.set("inviteExpiresAt", null);
    return;
  }

  this.set("inviteTokenHash", hashToken(rawToken));
  this.set("inviteExpiresAt", expiresAt ?? null);
};

notebookMemberSchema.methods.markAccepted = function markAccepted(
  date = new Date(),
) {
  this.status = "active";
  this.acceptedAt = date;
  this.setInviteToken(null);
};

notebookMemberSchema.methods.markRevoked = function markRevoked(
  actorId,
  date = new Date(),
) {
  this.status = "revoked";
  this.revokedAt = date;
  this.revokedBy = actorId ?? null;
  this.setInviteToken(null);
};

notebookMemberSchema.methods.isActive = function isActive() {
  return NOTEBOOK_MEMBER_ACTIVE_STATUSES.has(this.status);
};

const NotebookMember = mongoose.model("NotebookMember", notebookMemberSchema);

export default NotebookMember;
