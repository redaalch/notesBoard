import mongoose from "mongoose";
import {
  NOTEBOOK_COLOR_VALUES,
  NOTEBOOK_ICON_NAMES,
} from "../../../shared/notebookOptions.js";

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
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
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
      unique: true,
      sparse: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publicMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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
  { timestamps: true }
);

notebookSchema.index({ owner: 1, name: 1 }, { unique: true });
notebookSchema.index({ isPublic: 1, publicSlug: 1 });
notebookSchema.index({ owner: 1, offlineRevision: -1 });

const Notebook = mongoose.model("Notebook", notebookSchema);

export default Notebook;
