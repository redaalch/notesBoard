import mongoose from "mongoose";

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
    },
    richContent: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
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
      maxlength: 32,
    },
    icon: {
      type: String,
      default: null,
      maxlength: 32,
    },
    tags: {
      type: [String],
      default: [],
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
