import Note from "../models/Note.js";
import NotePublication from "../models/NotePublication.js";
import logger from "../utils/logger.js";
import { normalizeNotebookPublicSlug as normalizePublicSlug } from "../utils/notebooks.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

const serializeDate = (value) =>
  value instanceof Date
    ? value.toISOString()
    : value
      ? new Date(value).toISOString()
      : null;

const serializeSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== "object") {
    return { note: null };
  }

  const raw = snapshot.note ?? null;
  if (!raw) {
    return { note: null };
  }

  return {
    note: {
      id: raw.id ?? null,
      title: raw.title ?? "Untitled note",
      content: raw.content ?? "",
      contentText: raw.contentText ?? raw.content ?? "",
      richContent: raw.richContent ?? null,
      tags: Array.isArray(raw.tags) ? [...raw.tags] : [],
      pinned: Boolean(raw.pinned),
      createdAt: serializeDate(raw.createdAt),
      updatedAt: serializeDate(raw.updatedAt),
    },
  };
};

export const getPublishedNoteBySlug = async (req, res) => {
  try {
    const rawSlug = req.params?.slug ?? "";
    const slug = normalizePublicSlug(rawSlug);

    if (!slug) {
      return res.status(400).json({ message: "Invalid slug" });
    }

    const publication = await NotePublication.findOne({ publicSlug: slug })
      .select({
        noteId: 1,
        ownerId: 1,
        publicSlug: 1,
        publishedAt: 1,
        updatedAt: 1,
        snapshot: 1,
      })
      .lean();

    if (!publication) {
      return res.status(404).json({ message: "Note not found" });
    }

    const note = await Note.findOne({ _id: publication.noteId })
      .select({ isPublic: 1, publicSlug: 1 })
      .lean();

    if (!note || !note.isPublic || note.publicSlug !== slug) {
      return res.status(404).json({ message: "Note not found" });
    }

    const { note: serializedNote } = serializeSnapshot(publication.snapshot);

    return res.status(200).json({
      slug,
      publishedAt: serializeDate(publication.publishedAt),
      updatedAt: serializeDate(publication.updatedAt),
      note: serializedNote,
    });
  } catch (error) {
    logger.error("Failed to load published note", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export default {
  getPublishedNoteBySlug,
};
