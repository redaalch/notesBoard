import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";
import NotebookIndex from "../models/NotebookIndex.js";
import NotebookMember from "../models/NotebookMember.js";
import Note from "../models/Note.js";
import NoteCollaborator from "../models/NoteCollaborator.js";
import { listAccessibleWorkspaceIds } from "../utils/access.js";

const MAX_NOTE_LIMIT = 60;
const PREVIEW_NOTE_LIMIT = 12;
const SUPPORTED_SORT_FIELDS = new Set([
  "updatedAt",
  "createdAt",
  "title",
  "pinned",
  "score",
]);

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

const mapLikeToObject = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return { ...value };
  }
  return value;
};

const normalizeTagList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((tag) => normalizeTag(tag))
    .filter(Boolean)
    .slice(0, 8);
};

const hasActiveFilters = (filters) => {
  if (!filters || typeof filters !== "object") {
    return false;
  }
  return Object.values(filters).some((value) => value !== undefined);
};

const sanitizeNotebookIdList = (values = []) => {
  return values
    .map((value) => toObjectId(value))
    .filter(Boolean)
    .map((objectId) => objectId.toString());
};

const normalizeSortSpec = (rawSort) => {
  const sortInput = mapLikeToObject(rawSort) ?? {};
  const entries = Object.entries(sortInput);
  if (!entries.length) {
    return null;
  }

  const sortSpec = entries.reduce((acc, [field, direction]) => {
    if (!SUPPORTED_SORT_FIELDS.has(field)) {
      return acc;
    }
    const normalizedDirection = String(direction ?? "desc").toLowerCase();
    const value = ["asc", "1", "true"].includes(normalizedDirection) ? 1 : -1;
    acc[field] = value;
    return acc;
  }, {});

  return Object.keys(sortSpec).length ? sortSpec : null;
};

const buildDateRangeFilter = (filters = {}) => {
  const range = {};
  if (filters.updatedAfter) {
    const afterDate = new Date(filters.updatedAfter);
    if (!Number.isNaN(afterDate.getTime())) {
      range.$gte = afterDate;
    }
  }
  if (filters.updatedBefore) {
    const beforeDate = new Date(filters.updatedBefore);
    if (!Number.isNaN(beforeDate.getTime())) {
      range.$lte = beforeDate;
    }
  }
  return Object.keys(range).length ? range : null;
};

const buildAccessibleNoteFilter = async ({
  userId,
  candidateNotebookIds,
  excludedNotebookIds,
}) => {
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

  if (excludedNotebookIds?.size) {
    filter.notebookId = {
      ...(filter.notebookId ?? {}),
      $nin: Array.from(excludedNotebookIds).map(
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
  savedQuery = null,
}) => {
  const ownerObjectId = toObjectId(userId);
  if (!ownerObjectId) {
    return null;
  }
  const normalizedTag = normalizeTag(tag);
  const savedQueryFilters = savedQuery?.filters || null;
  const savedQuerySort = normalizeSortSpec(savedQuery?.sort);
  const savedQuerySearch =
    typeof savedQuery?.query === "string" && savedQuery.query.trim().length
      ? savedQuery.query.trim()
      : null;
  const searchTerm =
    typeof search === "string" && search.trim().length
      ? search.trim()
      : savedQuerySearch;

  const aggregatedTags = new Set();
  if (normalizedTag) {
    aggregatedTags.add(normalizedTag);
  }
  normalizeTagList(savedQueryFilters?.tags).forEach((t) =>
    aggregatedTags.add(t)
  );

  if (
    !aggregatedTags.size &&
    !searchTerm &&
    !hasActiveFilters(savedQueryFilters)
  ) {
    return {
      id: "smart:empty",
      noteCount: 0,
      notes: [],
      sourceNotebookIds: [],
      matchedTag: null,
      search: null,
      hasMore: false,
      savedQueryId: savedQuery?.id ?? null,
      appliedFilters: savedQueryFilters ?? null,
    };
  }

  const candidateNotebookIds = new Set();
  const excludedNotebookIds = new Set();

  if (savedQuery?.notebookId) {
    candidateNotebookIds.add(savedQuery.notebookId);
  }

  sanitizeNotebookIdList(savedQueryFilters?.notebookIds).forEach((id) =>
    candidateNotebookIds.add(id)
  );
  sanitizeNotebookIdList(
    savedQueryFilters?.notebookId ? [savedQueryFilters.notebookId] : []
  ).forEach((id) => candidateNotebookIds.add(id));
  sanitizeNotebookIdList(savedQueryFilters?.excludeNotebookIds).forEach((id) =>
    excludedNotebookIds.add(id)
  );

  let tagNarrowingSet = new Set();
  if (aggregatedTags.size) {
    const tagMatches = await NotebookIndex.find({
      ownerId: ownerObjectId,
      $or: Array.from(aggregatedTags).map((tagValue) => ({
        [`tagFrequencies.${tagValue}`]: { $exists: true },
      })),
    })
      .select({ notebookId: 1 })
      .lean();
    tagNarrowingSet = new Set(
      tagMatches.map((doc) => doc.notebookId?.toString?.()).filter(Boolean)
    );
  }

  if (tagNarrowingSet.size) {
    const union =
      candidateNotebookIds.size === 0
        ? tagNarrowingSet
        : new Set(
            Array.from(candidateNotebookIds).filter((id) =>
              tagNarrowingSet.has(id)
            )
          );
    candidateNotebookIds.clear();
    union.forEach((id) => candidateNotebookIds.add(id));
  }

  const baseFilter = await buildAccessibleNoteFilter({
    userId,
    candidateNotebookIds,
    excludedNotebookIds,
  });

  if (!baseFilter) {
    return {
      id: `smart:${aggregatedTags.values().next().value || "search"}`,
      noteCount: 0,
      notes: [],
      sourceNotebookIds: [],
      matchedTag: aggregatedTags.size ? Array.from(aggregatedTags)[0] : null,
      search: searchTerm,
      hasMore: false,
      savedQueryId: savedQuery?.id ?? null,
      appliedFilters: savedQueryFilters ?? null,
    };
  }

  const query = { ...baseFilter };

  if (aggregatedTags.size === 1) {
    query.tags = Array.from(aggregatedTags)[0];
  } else if (aggregatedTags.size > 1) {
    query.tags = { $all: Array.from(aggregatedTags) };
  }

  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  if (savedQueryFilters) {
    if (typeof savedQueryFilters.pinned === "boolean") {
      query.pinned = savedQueryFilters.pinned;
    }

    if (savedQueryFilters.workspaceId) {
      const workspaceIds = sanitizeNotebookIdList(
        Array.isArray(savedQueryFilters.workspaceId)
          ? savedQueryFilters.workspaceId
          : [savedQueryFilters.workspaceId]
      ).map((id) => new mongoose.Types.ObjectId(id));
      if (workspaceIds.length) {
        query.workspaceId = { $in: workspaceIds };
      }
    } else if (Array.isArray(savedQueryFilters.workspaceIds)) {
      const workspaceIds = sanitizeNotebookIdList(
        savedQueryFilters.workspaceIds
      ).map((id) => new mongoose.Types.ObjectId(id));
      if (workspaceIds.length) {
        query.workspaceId = { $in: workspaceIds };
      }
    }

    if (savedQueryFilters.notebookId && !candidateNotebookIds.size) {
      const singleId = toObjectId(savedQueryFilters.notebookId);
      if (singleId) {
        query.notebookId = singleId;
      }
    }

    const dateRange = buildDateRangeFilter(savedQueryFilters);
    if (dateRange) {
      query.updatedAt = dateRange;
    }
  }

  const effectiveLimit = Math.max(
    PREVIEW_NOTE_LIMIT,
    Math.min(Number(limit) || PREVIEW_NOTE_LIMIT, MAX_NOTE_LIMIT)
  );

  const sortSpec = (() => {
    if (searchTerm) {
      return { score: { $meta: "textScore" }, updatedAt: -1 };
    }
    if (savedQuerySort) {
      return savedQuerySort;
    }
    return { updatedAt: -1 };
  })();

  const projection = {
    title: 1,
    notebookId: 1,
    updatedAt: 1,
    tags: 1,
    pinned: 1,
  };

  if (searchTerm) {
    projection.score = { $meta: "textScore" };
  }

  const [totalMatches, notes] = await Promise.all([
    Note.countDocuments(query),
    Note.find(query)
      .sort(sortSpec)
      .limit(effectiveLimit + 1)
      .select(projection)
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
    pinned: Boolean(note.pinned),
    score: note.score,
  }));

  return {
    id: `smart:${
      savedQuery?.id || Array.from(aggregatedTags)[0] || searchTerm || "mixed"
    }`,
    matchedTag:
      aggregatedTags.size === 1 ? Array.from(aggregatedTags)[0] : null,
    search: searchTerm,
    noteCount: totalMatches,
    notes: previewNotes,
    sourceNotebookIds: Array.from(notebookIdSet),
    hasMore,
    savedQueryId: savedQuery?.id ?? null,
    appliedFilters: savedQueryFilters ?? null,
    appliedSort: sortSpec,
  };
};

export default {
  buildSmartNotebook,
};
