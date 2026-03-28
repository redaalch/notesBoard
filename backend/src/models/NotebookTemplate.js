import mongoose from "mongoose";
import {
  NOTEBOOK_COLOR_VALUES,
  NOTEBOOK_ICON_NAMES,
} from "../../../shared/notebookOptions.ts";

const MAX_TEMPLATE_TAGS = 20;

const templateNoteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    content: {
      type: String,
      required: true,
      default: "",
      maxlength: 50000,
    },
    richContent: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => !v || v.length <= 8,
        message: "Template note tags cannot exceed 8 entries",
      },
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    boardId: {
      type: String,
      default: null,
      maxlength: 48,
    },
    workspaceId: {
      type: String,
      default: null,
      maxlength: 48,
    },
    position: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const notebookTemplateSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceNotebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    color: {
      type: String,
      default: null,
      enum: [null, ...NOTEBOOK_COLOR_VALUES],
    },
    icon: {
      type: String,
      default: null,
      enum: [null, ...NOTEBOOK_ICON_NAMES],
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => !v || v.length <= MAX_TEMPLATE_TAGS,
        message: `Template tags cannot exceed ${MAX_TEMPLATE_TAGS} entries`,
      },
    },
    noteCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: [templateNoteSchema],
      default: [],
      validate: {
        validator: (v) => !v || v.length <= 100,
        message: "Template cannot contain more than 100 notes",
      },
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

notebookTemplateSchema.index({ owner: 1, name: 1 }, { unique: true });

const NotebookTemplate = mongoose.model(
  "NotebookTemplate",
  notebookTemplateSchema
);

export default NotebookTemplate;
