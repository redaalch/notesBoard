import Notebook from "../models/Notebook.js";
import NotebookPublication from "../models/NotebookPublication.js";
import logger from "../utils/logger.js";
import { normalizeNotebookPublicSlug } from "../utils/notebooks.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

const toPlainObject = (value) => {
  if (!value) return null;
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return JSON.parse(JSON.stringify(value));
  }
  return null;
};

const serializeDate = (value) =>
  value instanceof Date
    ? value.toISOString()
    : value
    ? new Date(value).toISOString()
    : null;

const serializeSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== "object") {
    return { notebook: null, notes: [] };
  }

  const notebook = snapshot.notebook ?? null;
  const notes = Array.isArray(snapshot.notes) ? snapshot.notes : [];

  const serializedNotebook = notebook
    ? {
        id: notebook.id ?? null,
        name: notebook.name ?? "Untitled notebook",
        description: notebook.description ?? "",
        color: notebook.color ?? null,
        icon: notebook.icon ?? null,
        owner: notebook.owner ?? null,
        workspaceId: notebook.workspaceId ?? null,
        publishedAt: serializeDate(notebook.publishedAt),
        noteOrder: Array.isArray(notebook.noteOrder)
          ? notebook.noteOrder.map((value) => String(value))
          : [],
      }
    : null;

  const serializedNotes = notes.map((note) => ({
    id: note.id ?? null,
    title: note.title ?? "Untitled note",
    content: note.content ?? "",
    contentText: note.contentText ?? note.content ?? "",
    tags: Array.isArray(note.tags) ? [...note.tags] : [],
    pinned: Boolean(note.pinned),
    createdAt: serializeDate(note.createdAt),
    updatedAt: serializeDate(note.updatedAt),
  }));

  if (serializedNotebook && serializedNotebook.noteOrder.length) {
    const orderMap = new Map(
      serializedNotebook.noteOrder.map((value, index) => [String(value), index])
    );
    serializedNotes.sort((a, b) => {
      const aOrder = orderMap.has(String(a.id))
        ? orderMap.get(String(a.id))
        : Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.has(String(b.id))
        ? orderMap.get(String(b.id))
        : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    });
  }

  return {
    notebook: serializedNotebook,
    notes: serializedNotes,
  };
};

export const getPublishedNotebookBySlug = async (req, res) => {
  try {
    const rawSlug = req.params?.slug ?? "";
    const slug = normalizeNotebookPublicSlug(rawSlug);

    if (!slug) {
      return res.status(400).json({ message: "Invalid slug" });
    }

    const publication = await NotebookPublication.findOne({
      publicSlug: slug,
    })
      .select({
        notebookId: 1,
        ownerId: 1,
        publicSlug: 1,
        publishedAt: 1,
        updatedAt: 1,
        snapshot: 1,
        metadata: 1,
      })
      .lean();

    if (!publication) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    const notebook = await Notebook.findOne({
      _id: publication.notebookId,
    })
      .select({ isPublic: 1, publicSlug: 1 })
      .lean();

    if (!notebook || !notebook.isPublic || notebook.publicSlug !== slug) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    const metadata = toPlainObject(publication.metadata) ?? {};
    const { notebook: snapshotNotebook, notes } = serializeSnapshot(
      publication.snapshot
    );

    return res.status(200).json({
      slug,
      publishedAt: serializeDate(publication.publishedAt),
      updatedAt: serializeDate(publication.updatedAt),
      metadata,
      notebook: snapshotNotebook,
      notes,
    });
  } catch (error) {
    logger.error("Failed to load published notebook", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export default {
  getPublishedNotebookBySlug,
};
