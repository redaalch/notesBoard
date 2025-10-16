import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";
import NotebookIndex from "../models/NotebookIndex.js";
import NotebookMember from "../models/NotebookMember.js";
import Note from "../models/Note.js";
import NoteCollaborator from "../models/NoteCollaborator.js";
import { listAccessibleWorkspaceIds } from "../utils/access.js";

const MAX_NOTE_LIMIT = 60;
const PREVIEW_NOTE_LIMIT = 12;

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (_error) {
    return null;
  }
};

const normalizeTag = (tag) => {
  if (typeof tag !== "string") {
    return null;
  }
  const cleaned = tag.trim().toLowerCase();
  return cleaned.length ? cleaned : null;
};

const buildAccessibleNoteFilter = async ({ userId, candidateNotebookIds }) => {
  const ownerObjectId = toObjectId(userId);
  if (!ownerObjectId) {
    return null;
  }

  const [workspaceIds, collaboratorDocs, notebookMemberships] =
    await Promise.all([
      listAccessibleWorkspaceIds(userId),
      NoteCollaborator.find({ userId: ownerObjectId })
        .select({ noteId: 1 })
        .lean(),
      NotebookMember.find({
        userId: ownerObjectId,
        status: "active",
      })
        .select({ notebookId: 1 })
        .lean(),
    ]);

  const workspaceObjectIds = workspaceIds.map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const collaboratorNoteIds = collaboratorDocs
    .map((doc) => (doc.noteId ? doc.noteId.toString() : null))
    .filter(Boolean);

  const notebookMembershipIds = notebookMemberships
    .map((doc) => (doc.notebookId ? doc.notebookId.toString() : null))
    .filter(Boolean);

  const orConditions = [{ owner: ownerObjectId }];

  if (workspaceObjectIds.length) {
    orConditions.push({ workspaceId: { $in: workspaceObjectIds } });
  }

  if (collaboratorNoteIds.length) {
    orConditions.push({
      _id: {
        $in: collaboratorNoteIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    });
  }

  if (notebookMembershipIds.length) {
    orConditions.push({
      notebookId: {
        $in: notebookMembershipIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    });
  }

  if (!orConditions.length) {
    return null;
  }

  const filter =
    orConditions.length === 1 ? orConditions[0] : { $or: orConditions };

  if (candidateNotebookIds?.size) {
    filter.notebookId = {
      $in: Array.from(candidateNotebookIds).map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
    };
  }

  return filter;
};

export const buildSmartNotebook = async ({
  userId,
  tag,
  search,
  limit = PREVIEW_NOTE_LIMIT,
}) => {
  const ownerObjectId = toObjectId(userId);
  if (!ownerObjectId) {
    return null;
  }

  const normalizedTag = normalizeTag(tag);
  const searchTerm =
    typeof search === "string" && search.trim().length ? search.trim() : null;

  if (!normalizedTag && !searchTerm) {
    return {
      id: "smart:empty",
      noteCount: 0,
      notes: [],
      sourceNotebookIds: [],
      matchedTag: null,
      search: null,
      hasMore: false,
    };
  }

  let candidateNotebookIds = new Set();
  if (normalizedTag) {
    const indexMatches = await NotebookIndex.find({
      ownerId: ownerObjectId,
      [`tagFrequencies.${normalizedTag}`]: { $exists: true },
    })
      .select({ notebookId: 1 })
      .lean();
    candidateNotebookIds = new Set(
      indexMatches.map((doc) => doc.notebookId?.toString?.()).filter(Boolean)
    );
  }

  const baseFilter = await buildAccessibleNoteFilter({
    userId,
    candidateNotebookIds,
  });

  if (!baseFilter) {
    return {
      id: `smart:${normalizedTag || "search"}`,
      noteCount: 0,
      notes: [],
      sourceNotebookIds: [],
      matchedTag: normalizedTag,
      search: searchTerm,
      hasMore: false,
    };
  }

  const query = { ...baseFilter };

  if (normalizedTag) {
    query.tags = normalizedTag;
  }

  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  const effectiveLimit = Math.max(
    PREVIEW_NOTE_LIMIT,
    Math.min(Number(limit) || PREVIEW_NOTE_LIMIT, MAX_NOTE_LIMIT)
  );

  const [totalMatches, notes] = await Promise.all([
    Note.countDocuments(query),
    Note.find(query)
      .sort({ updatedAt: -1 })
      .limit(effectiveLimit + 1)
      .select({
        title: 1,
        notebookId: 1,
        updatedAt: 1,
        tags: 1,
      })
      .lean(),
  ]);

  const hasMore = notes.length > effectiveLimit;
  const slicedNotes = hasMore ? notes.slice(0, effectiveLimit) : notes;

  const notebookIdSet = new Set(
    slicedNotes.map((note) => note.notebookId?.toString?.()).filter(Boolean)
  );

  const notebookDocs = await Notebook.find({
    _id: {
      $in: Array.from(notebookIdSet).map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
    },
  })
    .select({ name: 1, color: 1, icon: 1 })
    .lean();

  const notebookNameById = new Map(
    notebookDocs.map((doc) => [doc._id.toString(), doc])
  );

  const previewNotes = slicedNotes.map((note) => ({
    id: note._id.toString(),
    title: note.title,
    notebookId: note.notebookId ? note.notebookId.toString() : null,
    notebook: note.notebookId
      ? notebookNameById.get(note.notebookId.toString()) ?? null
      : null,
    tags: Array.isArray(note.tags) ? note.tags : [],
    updatedAt: note.updatedAt,
  }));

  return {
    id: `smart:${normalizedTag || searchTerm || "mixed"}`,
    matchedTag: normalizedTag,
    search: searchTerm,
    noteCount: totalMatches,
    notes: previewNotes,
    sourceNotebookIds: Array.from(notebookIdSet),
    hasMore,
  };
};

export default {
  buildSmartNotebook,
};
