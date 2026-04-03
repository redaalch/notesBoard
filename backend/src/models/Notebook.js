import mongoose from "mongoose";
import {
  NOTEBOOK_COLOR_VALUES,
  NOTEBOOK_ICON_NAMES,
} from "../../../shared/notebookOptions.ts";

const SCRIPT_LIKE_PATTERN =
  /<\/?\s*(script|iframe|object|embed|link|style|meta|form)\b/i;

const isSafeName = (value) => {
  if (typeof value !== "string" || !value.trim().length) return false;
  return !SCRIPT_LIKE_PATTERN.test(value);
};

const notebookSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      validate: {
        validator: isSafeName,
        message: "Name contains disallowed content.",
      },
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
      validate: {
        validator: (v) => !v || !SCRIPT_LIKE_PATTERN.test(v),
        message: "Description contains disallowed content.",
      },
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    publicSlug: {
      type: String,
      default: null,
      maxlength: 64,
      validate: {
        validator: (v) => v === null || /^[a-z0-9-]+$/.test(v),
        message: "Slug may only contain lowercase letters, numbers, and hyphens",
      },
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publicMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (v) => {
          if (v == null) return true;
          if (typeof v !== "object" || Array.isArray(v)) return false;
          if (Object.keys(v).length > 50) return false;
          try { return JSON.stringify(v).length <= 32_000; } catch { return false; }
        },
        message: "publicMetadata must be a plain object with at most 50 keys and not exceed 32 KB",
      },
    },
    color: {
      type: String,
      default: null,
      maxlength: 32,
      enum: [null, ...NOTEBOOK_COLOR_VALUES],
    },
    icon: {
      type: String,
      default: null,
      maxlength: 32,
      enum: [null, ...NOTEBOOK_ICON_NAMES],
    },
    noteOrder: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Note",
        },
      ],
      default: [],
      validate: {
        validator: (v) => !v || v.length <= 500,
        message: "noteOrder cannot exceed 500 entries",
      },
    },
    offlineRevision: {
      type: Number,
      min: 0,
      default: 0,
    },
    offlineSnapshotHash: {
      type: String,
      default: null,
      maxlength: 128,
    },
    offlineSnapshotUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

notebookSchema.index({ owner: 1, name: 1 }, { unique: true });
notebookSchema.index(
  { publicSlug: 1 },
  {
    unique: true,
    partialFilterExpression: { publicSlug: { $type: "string" } },
  },
);
notebookSchema.index({ owner: 1, offlineRevision: -1 });

notebookSchema.virtual("ownerId").get(function () {
  return this.owner;
}).set(function (v) {
  this.owner = v;
});
notebookSchema.set("toJSON", { virtuals: true });
notebookSchema.set("toObject", { virtuals: true });

const Notebook = mongoose.model("Notebook", notebookSchema);

export default Notebook;
