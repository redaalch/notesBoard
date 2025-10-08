import crypto from "crypto";
import mongoose from "mongoose";

const shareLinkSchema = new mongoose.Schema(
  {
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
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
    },
  },
  { timestamps: true }
);

shareLinkSchema.statics.hash = function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
};

const ShareLink = mongoose.model("ShareLink", shareLinkSchema);

export default ShareLink;
