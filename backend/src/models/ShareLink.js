import crypto from "crypto";
import mongoose from "mongoose";

const NOTEBOOK_SHARE_ROLES = ["viewer", "editor"];

const shareLinkSchema = new mongoose.Schema(
  {
    resourceType: {
      type: String,
      enum: ["notebook"],
      default: "notebook",
      index: true,
    },
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: NOTEBOOK_SHARE_ROLES,
      default: "viewer",
    },
    expiresAt: {
      type: Date,
      default: null,
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
      validate: {
        validator: (v) => {
          if (!v || v.size === 0) return true;
          if (v.size > 50) return false;
          try { return JSON.stringify(Object.fromEntries(v)).length <= 16_000; } catch { return false; }
        },
        message: "metadata must have at most 50 entries and not exceed 16 KB",
      },
    },
  },
  { timestamps: true },
);

shareLinkSchema.statics.hash = function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
};

shareLinkSchema.statics.generateToken = function generateToken(size = 24) {
  return crypto.randomBytes(size).toString("hex");
};

shareLinkSchema.methods.isExpired = function isExpired(
  referenceDate = new Date(),
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
  when = new Date(),
) {
  this.revokedAt = when;
  this.revokedBy = actorId ?? null;
};

shareLinkSchema.pre("validate", function ensureRoleMatchesResource(next) {
  if (!NOTEBOOK_SHARE_ROLES.includes(this.role)) {
    this.role = "viewer";
  }
  next();
});

shareLinkSchema.index(
  { notebookId: 1, revokedAt: 1 },
  { name: "notebook_active_links" },
);
shareLinkSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, name: "share_link_ttl" },
);

const ShareLink = mongoose.model("ShareLink", shareLinkSchema);

export default ShareLink;
