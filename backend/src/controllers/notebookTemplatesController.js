import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";
import Note from "../models/Note.js";
import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";
import NotebookTemplate from "../models/NotebookTemplate.js";
import logger from "../utils/logger.js";
import {
  ensureNotebookOwnership,
  normalizeObjectId,
} from "../utils/notebooks.js";
import {
  isAllowedNotebookColor,
  isAllowedNotebookIcon,
  normalizeNotebookColor,
  normalizeNotebookIcon,
} from "../../../shared/notebookOptions.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };
const MAX_TEMPLATE_NOTES = Number(
  process.env.NOTEBOOK_TEMPLATE_NOTE_LIMIT ?? 200
);
const MAX_TEMPLATE_BYTES = Number(
  process.env.NOTEBOOK_TEMPLATE_SIZE_LIMIT ?? 750000
);
const TEMPLATE_TAG_LIMIT = 8;

const sanitizeTemplateTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(cleaned));
  return unique.slice(0, TEMPLATE_TAG_LIMIT);
};

const computeEstimatedSize = (payload) => {
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch (error) {
    logger.error("Failed to compute template size", {
      message: error?.message,
    });
    return 0;
  }
};

const orderNotesForTemplate = (notebook, notes) => {
  const order = Array.isArray(notebook.noteOrder)
    ? notebook.noteOrder.map((id) => id.toString())
    : [];
  const noteMap = new Map(notes.map((note) => [note._id.toString(), note]));

  const ordered = [];

  order.forEach((noteId) => {
    const item = noteMap.get(noteId);
    if (item) {
      ordered.push(item);
      noteMap.delete(noteId);
    }
  });

  if (noteMap.size) {
    const remaining = Array.from(noteMap.values()).sort((a, b) => {
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdA - createdB;
    });
    ordered.push(...remaining);
  }

  return ordered;
};

const buildTemplateNotes = (orderedNotes) =>
  orderedNotes.map((note, index) => ({
    title: note.title,
    content: note.content,
    richContent:
      note.richContent && typeof note.richContent === "object"
        ? JSON.parse(JSON.stringify(note.richContent))
        : null,
    tags: Array.isArray(note.tags) ? note.tags : [],
    pinned: Boolean(note.pinned),
    boardId: note.boardId ? note.boardId.toString() : null,
    workspaceId: note.workspaceId ? note.workspaceId.toString() : null,
    position: index,
  }));

const ensureUniqueNotebookName = async (ownerId, desiredName) => {
  const baseName = desiredName.trim().slice(0, 160) || "Untitled notebook";
  let candidate = baseName;
  let suffix = 1;
  const MAX_ATTEMPTS = 20;

  while (suffix <= MAX_ATTEMPTS) {
    const exists = await Notebook.exists({ owner: ownerId, name: candidate });
    if (!exists) {
      return candidate;
    }
    suffix += 1;
    candidate = `${baseName} (${suffix})`;
  }

  throw new Error("Unable to generate unique notebook name");
};

export const exportNotebookTemplate = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const notebook = await ensureNotebookOwnership(id, ownerId);
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    const notes = await Note.find({
      owner: new mongoose.Types.ObjectId(ownerId),
      notebookId: notebook._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    if (notes.length > MAX_TEMPLATE_NOTES) {
      return res.status(413).json({
        message: `Notebook exceeds template limit of ${MAX_TEMPLATE_NOTES} notes. Split it before exporting.`,
      });
    }

    const orderedNotes = orderNotesForTemplate(notebook, notes);
    const templateNotes = buildTemplateNotes(orderedNotes);
    const estimatedSize = computeEstimatedSize(templateNotes);

    if (estimatedSize > MAX_TEMPLATE_BYTES) {
      return res.status(413).json({
        message:
          "Notebook template payload is too large to export. Try removing large rich content blocks.",
      });
    }

    const {
      name: desiredName,
      description: desiredDescription,
      tags,
    } = req.body ?? {};

    const templateName =
      typeof desiredName === "string" && desiredName.trim().length
        ? desiredName.trim()
        : notebook.name;
    const templateDescription =
      typeof desiredDescription === "string"
        ? desiredDescription.trim()
        : notebook.description ?? "";

    const sanitizedTags = sanitizeTemplateTags(tags ?? []);

    try {
      const template = await NotebookTemplate.create({
        owner: ownerId,
        sourceNotebookId: notebook._id,
        name: templateName,
        description: templateDescription,
        color: notebook.color ?? null,
        icon: notebook.icon ?? null,
        tags: sanitizedTags,
        noteCount: templateNotes.length,
        estimatedSize,
        notes: templateNotes,
      });

      return res.status(201).json({
        id: template._id.toString(),
        name: template.name,
        description: template.description,
        tags: template.tags,
        noteCount: template.noteCount,
        estimatedSize: template.estimatedSize,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res
          .status(409)
          .json({ message: "A template with this name already exists" });
      }
      throw error;
    }
  } catch (error) {
    logger.error("Failed to export notebook template", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const listNotebookTemplates = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const templates = await NotebookTemplate.find({ owner: ownerId })
      .sort({ updatedAt: -1 })
      .lean();

    const payload = templates.map((template) => ({
      id: template._id.toString(),
      name: template.name,
      description: template.description,
      tags: template.tags ?? [],
      color: template.color,
      icon: template.icon,
      noteCount: template.noteCount ?? 0,
      estimatedSize: template.estimatedSize ?? 0,
      updatedAt: template.updatedAt,
      createdAt: template.createdAt,
    }));

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Failed to list notebook templates", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getNotebookTemplate = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const templateObjectId = normalizeObjectId(req.params?.id);
    if (!templateObjectId) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const template = await NotebookTemplate.findOne({
      _id: templateObjectId,
      owner: new mongoose.Types.ObjectId(ownerId),
    }).lean();

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const boardCounts = new Map();
    const workspaceCounts = new Map();
    const boardIds = new Set();
    const workspaceIds = new Set();

    (template.notes ?? []).forEach((note) => {
      const boardId = note?.boardId ? String(note.boardId) : null;
      if (boardId) {
        boardCounts.set(boardId, (boardCounts.get(boardId) ?? 0) + 1);
        if (mongoose.Types.ObjectId.isValid(boardId)) {
          boardIds.add(boardId);
        }
      }

      const workspaceId = note?.workspaceId ? String(note.workspaceId) : null;
      if (workspaceId) {
        workspaceCounts.set(
          workspaceId,
          (workspaceCounts.get(workspaceId) ?? 0) + 1
        );
        if (mongoose.Types.ObjectId.isValid(workspaceId)) {
          workspaceIds.add(workspaceId);
        }
      }
    });

    const boardDocs = boardIds.size
      ? await Board.find({
          _id: {
            $in: Array.from(boardIds).map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          },
        })
          .select({ name: 1, workspaceId: 1 })
          .lean()
      : [];

    const workspaceDocs = workspaceIds.size
      ? await Workspace.find({
          _id: {
            $in: Array.from(workspaceIds).map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          },
        })
          .select({ name: 1 })
          .lean()
      : [];

    const workspaceMetaById = new Map(
      workspaceDocs.map((entry) => [entry._id.toString(), entry])
    );
    const boardMetaById = new Map(
      boardDocs.map((entry) => [entry._id.toString(), entry])
    );

    const workspaceSummaries = Array.from(workspaceCounts.entries()).map(
      ([workspaceId, count]) => {
        const workspaceMeta = workspaceMetaById.get(workspaceId) ?? null;
        return {
          id: workspaceId,
          name: workspaceMeta?.name ?? null,
          noteCount: count,
        };
      }
    );

    const boardSummaries = Array.from(boardCounts.entries()).map(
      ([boardId, count]) => {
        const boardMeta = boardMetaById.get(boardId) ?? null;
        const metaWorkspaceId = boardMeta?.workspaceId
          ? boardMeta.workspaceId.toString()
          : null;
        const workspaceMeta = metaWorkspaceId
          ? workspaceMetaById.get(metaWorkspaceId) ?? null
          : null;

        return {
          id: boardId,
          name: boardMeta?.name ?? null,
          workspaceId: metaWorkspaceId,
          workspaceName: workspaceMeta?.name ?? null,
          noteCount: count,
        };
      }
    );

    return res.status(200).json({
      id: template._id.toString(),
      name: template.name,
      description: template.description,
      tags: template.tags ?? [],
      color: template.color,
      icon: template.icon,
      noteCount: template.noteCount ?? template.notes?.length ?? 0,
      estimatedSize: template.estimatedSize ?? 0,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      notes: (template.notes ?? []).map((note) => ({
        title: note.title,
        content: note.content,
        richContent: note.richContent ?? null,
        tags: Array.isArray(note.tags) ? note.tags : [],
        pinned: Boolean(note.pinned),
        position: note.position ?? 0,
        boardId: note.boardId ?? null,
        workspaceId: note.workspaceId ?? null,
      })),
      workspaces: workspaceSummaries,
      boards: boardSummaries,
    });
  } catch (error) {
    logger.error("Failed to fetch notebook template", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const instantiateNotebookTemplate = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const templateObjectId = normalizeObjectId(req.params?.id);
    if (!templateObjectId) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const template = await NotebookTemplate.findOne({
      _id: templateObjectId,
      owner: new mongoose.Types.ObjectId(ownerId),
    }).lean();

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const {
      name: desiredName,
      description: desiredDescription,
      color: desiredColor,
      icon: desiredIcon,
      workspaceId,
      workspaceMappings,
      boardMappings,
    } = req.body ?? {};

    const normalizedWorkspaceId = normalizeObjectId(workspaceId);
    const sanitizedWorkspaceMappings =
      workspaceMappings && typeof workspaceMappings === "object"
        ? workspaceMappings
        : {};
    const sanitizedBoardMappings =
      boardMappings && typeof boardMappings === "object" ? boardMappings : {};

    let targetColor = template.color ?? null;
    if (desiredColor !== undefined) {
      if (desiredColor === null || desiredColor === "") {
        targetColor = null;
      } else if (isAllowedNotebookColor(desiredColor)) {
        targetColor = normalizeNotebookColor(desiredColor);
      } else {
        return res.status(400).json({ message: "Invalid notebook color" });
      }
    }

    let targetIcon = template.icon ?? null;
    if (desiredIcon !== undefined) {
      if (desiredIcon === null || desiredIcon === "") {
        targetIcon = null;
      } else if (isAllowedNotebookIcon(desiredIcon)) {
        targetIcon = normalizeNotebookIcon(desiredIcon);
      } else {
        return res.status(400).json({ message: "Invalid notebook icon" });
      }
    }

    const notebookName = await ensureUniqueNotebookName(
      ownerId,
      typeof desiredName === "string" && desiredName.trim().length
        ? desiredName.trim()
        : template.name
    );

    const notebookDescription =
      typeof desiredDescription === "string"
        ? desiredDescription.trim()
        : template.description ?? "";

    const notebook = await Notebook.create({
      owner: ownerId,
      name: notebookName,
      description: notebookDescription,
      color: targetColor,
      icon: targetIcon,
      workspaceId: normalizedWorkspaceId,
    });

    const notePayload = (template.notes ?? []).map((note) => {
      const originalWorkspaceId = note.workspaceId ?? null;
      const targetWorkspace = normalizedWorkspaceId
        ? normalizedWorkspaceId
        : normalizeObjectId(sanitizedWorkspaceMappings[originalWorkspaceId]);
      const targetBoard = normalizeObjectId(
        sanitizedBoardMappings[note.boardId ?? ""]
      );
      return {
        owner: ownerId,
        notebookId: notebook._id,
        workspaceId: targetWorkspace,
        boardId: targetBoard,
        title: note.title,
        content: note.content,
        richContent: note.richContent ?? null,
        tags: Array.isArray(note.tags) ? note.tags : [],
        pinned: Boolean(note.pinned),
      };
    });

    const insertedNotes = [];
    if (notePayload.length) {
      for (const payload of notePayload) {
        // Sequential creation keeps middleware & validations intact
        // while preserving note order from template definition.
        // eslint-disable-next-line no-await-in-loop
        const created = await Note.create(payload);
        insertedNotes.push(created);
      }

      const orderedIds = insertedNotes.map((note) => note._id);
      await Notebook.updateOne(
        { _id: notebook._id },
        { $set: { noteOrder: orderedIds } }
      );
    }

    await NotebookTemplate.updateOne(
      { _id: templateObjectId },
      { $set: { lastUsedAt: new Date() } }
    );

    return res.status(201).json({
      notebookId: notebook._id.toString(),
      name: notebook.name,
      noteCount: insertedNotes.length,
      createdAt: notebook.createdAt,
    });
  } catch (error) {
    logger.error("Failed to instantiate notebook template", {
      message: error?.message,
    });
    if (error.message === "Unable to generate unique notebook name") {
      return res
        .status(409)
        .json({ message: "Unable to generate a unique notebook name" });
    }
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const deleteNotebookTemplate = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const templateObjectId = normalizeObjectId(req.params?.id);
    if (!templateObjectId) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const deleted = await NotebookTemplate.findOneAndDelete({
      _id: templateObjectId,
      owner: new mongoose.Types.ObjectId(ownerId),
    });

    if (!deleted) {
      return res.status(404).json({ message: "Template not found" });
    }

    return res.status(204).send();
  } catch (error) {
    logger.error("Failed to delete notebook template", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export default {
  exportNotebookTemplate,
  listNotebookTemplates,
  getNotebookTemplate,
  instantiateNotebookTemplate,
  deleteNotebookTemplate,
};
