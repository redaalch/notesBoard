import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";
import NotebookMember from "../models/NotebookMember.js";
import NotebookIndex from "../models/NotebookIndex.js";
import NotebookPublication from "../models/NotebookPublication.js";
import SavedNotebookQuery from "../models/SavedNotebookQuery.js";
import NoteCollaborator from "../models/NoteCollaborator.js";
import { buildNotebookVector } from "../utils/textAnalytics.js";

const DEFAULT_LIMIT = 6;
const MAX_CANDIDATES = 60;

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

const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
};

const cosineSimilarity = (vectorA = {}, vectorB = {}) => {
  const keysA = Object.keys(vectorA);
  if (!keysA.length) {
    return 0;
  }
  const keysB = new Set(Object.keys(vectorB));
  if (!keysB.size) {
    return 0;
  }

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  keysA.forEach((key) => {
    const weightA = Number.parseFloat(vectorA[key] ?? 0);
    magnitudeA += weightA * weightA;
    if (keysB.has(key)) {
      const weightB = Number.parseFloat(vectorB[key] ?? 0);
      dot += weightA * weightB;
    }
  });

  Object.keys(vectorB).forEach((key) => {
    const weight = Number.parseFloat(vectorB[key] ?? 0);
    magnitudeB += weight * weight;
  });

  if (!dot || magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

const computeTagScore = (noteTags = [], tagFrequencies = {}) => {
  if (!Array.isArray(noteTags) || !noteTags.length) {
    return { score: 0, matches: [] };
  }

  const normalizedTags = noteTags
    .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (!normalizedTags.length) {
    return { score: 0, matches: [] };
  }

  const matches = [];
  let weightedSum = 0;

  normalizedTags.forEach((tag) => {
    if (Object.prototype.hasOwnProperty.call(tagFrequencies, tag)) {
      const frequency = Number.parseFloat(tagFrequencies[tag] ?? 1);
      matches.push(tag);
      weightedSum += Math.log(1 + Math.max(1, frequency));
    }
  });

  if (!matches.length) {
    return { score: 0, matches: [] };
  }

  const maxPossible = normalizedTags.length * Math.log(1 + 10);
  const score = Math.min(1, weightedSum / Math.max(1, maxPossible));
  return { score, matches };
};

const computeCollaboratorScore = (collaboratorIds, notebookMembers) => {
  if (!collaboratorIds.size || !notebookMembers.size) {
    return { score: 0, matches: [] };
  }

  const matches = [];
  collaboratorIds.forEach((id) => {
    if (notebookMembers.has(id)) {
      matches.push(id);
    }
  });

  if (!matches.length) {
    return { score: 0, matches: [] };
  }

  const score = Math.min(1, matches.length / collaboratorIds.size);
  return { score, matches };
};

const normalizeVector = (rawVector) => {
  const vector = toPlainObject(rawVector);
  const entries = Object.entries(vector);
  if (!entries.length) {
    return {};
  }
  return entries.reduce((acc, [key, value]) => {
    const numericValue = Number.parseFloat(value ?? 0);
    if (!Number.isFinite(numericValue) || numericValue === 0) {
      return acc;
    }
    acc[key] = numericValue;
    return acc;
  }, {});
};

export const getNotebookRecommendations = async ({
  userId,
  note,
  limit = DEFAULT_LIMIT,
}) => {
  if (!userId || !note?._id) {
    return [];
  }

  const limitValue = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 12));
  const ownerObjectId = toObjectId(userId);
  if (!ownerObjectId) {
    return [];
  }

  const ownedNotebooks = await Notebook.find({ owner: ownerObjectId })
    .select({ _id: 1, name: 1, description: 1, updatedAt: 1 })
    .lean();

  const membershipDocs = await NotebookMember.find({
    userId: ownerObjectId,
    status: "active",
  })
    .select({ notebookId: 1, role: 1 })
    .lean();

  const candidateNotebookIds = new Set(
    ownedNotebooks.map((doc) => doc._id.toString())
  );

  membershipDocs.forEach((doc) => {
    if (doc?.notebookId) {
      candidateNotebookIds.add(doc.notebookId.toString());
    }
  });

  if (note.notebookId) {
    candidateNotebookIds.delete(note.notebookId.toString());
  }

  if (!candidateNotebookIds.size) {
    return [];
  }

  const limitedIds = Array.from(candidateNotebookIds).slice(0, MAX_CANDIDATES);
  const objectIds = limitedIds.map((id) => new mongoose.Types.ObjectId(id));

  const [
    indexDocs,
    notebookDocs,
    membershipDetails,
    noteCollaborators,
    savedQueries,
    publications,
  ] = await Promise.all([
    NotebookIndex.find({ notebookId: { $in: objectIds } })
      .select({
        notebookId: 1,
        vector: 1,
        tagFrequencies: 1,
        noteCount: 1,
        lastIndexedAt: 1,
        metadata: 1,
      })
      .lean(),
    Notebook.find({ _id: { $in: objectIds } })
      .select({
        name: 1,
        description: 1,
        updatedAt: 1,
        owner: 1,
        offlineRevision: 1,
        isPublic: 1,
        publicSlug: 1,
        publishedAt: 1,
      })
      .lean(),
    NotebookMember.find({
      notebookId: { $in: objectIds },
      status: "active",
    })
      .select({ notebookId: 1, userId: 1 })
      .lean(),
    NoteCollaborator.find({ noteId: note._id }).select({ userId: 1 }).lean(),
    SavedNotebookQuery.find({
      notebookId: { $in: objectIds },
      userId: ownerObjectId,
    })
      .select({ notebookId: 1, lastUsedAt: 1 })
      .lean(),
    NotebookPublication.find({ notebookId: { $in: objectIds } })
      .select({ notebookId: 1, publishedAt: 1 })
      .lean(),
  ]);

  const indexByNotebookId = new Map(
    indexDocs.map((doc) => [doc.notebookId.toString(), doc])
  );
  const notebookById = new Map(
    notebookDocs.map((doc) => [doc._id.toString(), doc])
  );

  const membersByNotebook = membershipDetails.reduce((acc, entry) => {
    if (!entry.notebookId || !entry.userId) {
      return acc;
    }
    const key = entry.notebookId.toString();
    if (!acc.has(key)) {
      acc.set(key, new Set());
    }
    acc.get(key).add(entry.userId.toString());
    return acc;
  }, new Map());

  const savedQueryStats = savedQueries.reduce((acc, entry) => {
    if (!entry.notebookId) {
      return acc;
    }
    const key = entry.notebookId.toString();
    if (!acc.has(key)) {
      acc.set(key, { count: 0, lastUsedAt: null });
    }
    const current = acc.get(key);
    current.count += 1;
    if (
      entry.lastUsedAt &&
      (!current.lastUsedAt || entry.lastUsedAt > current.lastUsedAt)
    ) {
      current.lastUsedAt = entry.lastUsedAt;
    }
    return acc;
  }, new Map());

  const publicationByNotebook = new Map(
    publications.map((doc) => [doc.notebookId.toString(), doc])
  );

  const collaboratorIds = new Set(
    noteCollaborators
      .map((entry) => entry.userId?.toString?.())
      .filter((id) => id && id !== userId)
  );

  const noteVectorResult = buildNotebookVector(
    [
      {
        title: note.title,
        content: note.content,
        contentText: note.contentText,
      },
    ],
    { maxTerms: 200 }
  );

  const noteVector = normalizeVector(noteVectorResult.vector);
  const noteTags = Array.isArray(note.tags) ? note.tags : [];

  const recommendations = [];

  limitedIds.forEach((notebookId) => {
    const notebook = notebookById.get(notebookId);
    if (!notebook) {
      return;
    }

    const index = indexByNotebookId.get(notebookId) ?? {
      vector: {},
      tagFrequencies: {},
      noteCount: 0,
      metadata: {},
    };

    const vector = normalizeVector(index.vector);
    const cosine = cosineSimilarity(noteVector, vector);

    const tagResult = computeTagScore(
      noteTags,
      toPlainObject(index.tagFrequencies)
    );
    const memberSet = membersByNotebook.get(notebookId) ?? new Set();
    const collaboratorResult = computeCollaboratorScore(
      collaboratorIds,
      memberSet
    );

    const relevanceScore =
      cosine * 0.6 + tagResult.score * 0.3 + collaboratorResult.score * 0.1;

    const revisionScore = Math.min(
      0.15,
      Math.max(0, (notebook.offlineRevision ?? 0) * 0.01)
    );

    const savedQueryInfo = savedQueryStats.get(notebookId) ?? {
      count: 0,
      lastUsedAt: null,
    };
    const savedQueryScore = Math.min(0.15, savedQueryInfo.count * 0.03);

    const publication = publicationByNotebook.get(notebookId) ?? null;
    const publicationScore = publication ? 0.1 : 0;

    const freshnessScore = (() => {
      if (savedQueryInfo.lastUsedAt) {
        const ageMs = Date.now() - savedQueryInfo.lastUsedAt.getTime();
        const thirtyDays = 1000 * 60 * 60 * 24 * 30;
        return Math.max(0, Math.min(0.1, 0.1 - ageMs / (thirtyDays * 10)));
      }
      return 0;
    })();

    const metaBoost =
      revisionScore + savedQueryScore + publicationScore + freshnessScore;

    const blendedScore = Math.min(1, relevanceScore * 0.7 + metaBoost);

    if (blendedScore <= 0) {
      return;
    }

    recommendations.push({
      notebookId,
      score: blendedScore,
      relevanceScore,
      cosine,
      tagScore: tagResult.score,
      collaboratorScore: collaboratorResult.score,
      matchedTags: tagResult.matches,
      matchedCollaborators: collaboratorResult.matches,
      notebook,
      index,
      revisionScore,
      savedQueryScore,
      savedQueryCount: savedQueryInfo.count,
      publicationScore,
      freshnessScore,
      publication,
    });
  });

  recommendations.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (b.index?.lastIndexedAt ?? 0) - (a.index?.lastIndexedAt ?? 0);
  });

  return recommendations.slice(0, limitValue).map((entry) => ({
    id: entry.notebookId,
    name: entry.notebook?.name ?? "Untitled Notebook",
    description: entry.notebook?.description ?? "",
    score: Number.parseFloat(entry.score.toFixed(4)),
    relevanceScore: Number.parseFloat(entry.relevanceScore.toFixed(4)),
    cosine: Number.parseFloat(entry.cosine.toFixed(4)),
    tagScore: Number.parseFloat(entry.tagScore.toFixed(4)),
    collaboratorScore: Number.parseFloat(entry.collaboratorScore.toFixed(4)),
    revisionScore: Number.parseFloat(entry.revisionScore.toFixed(4)),
    savedQueryScore: Number.parseFloat(entry.savedQueryScore.toFixed(4)),
    publicationScore: Number.parseFloat(entry.publicationScore.toFixed(4)),
    freshnessScore: Number.parseFloat(entry.freshnessScore.toFixed(4)),
    matchedTags: entry.matchedTags,
    matchedCollaborators: entry.matchedCollaborators,
    noteCount: entry.index?.noteCount ?? 0,
    lastIndexedAt: entry.index?.lastIndexedAt ?? null,
    updatedAt: entry.notebook?.updatedAt ?? null,
    offlineRevision: entry.notebook?.offlineRevision ?? 0,
    savedQueryCount: entry.savedQueryCount,
    isPublic: Boolean(entry.notebook?.isPublic),
    publicSlug: entry.notebook?.publicSlug ?? null,
    publishedAt:
      entry.notebook?.publishedAt ?? entry.publication?.publishedAt ?? null,
    metadata: (() => {
      const meta = toPlainObject(entry.index?.metadata);
      return {
        documents: meta.documents ?? null,
        distinctTerms: meta.distinctTerms ?? null,
        totalTagApplications: meta.totalTagApplications ?? null,
      };
    })(),
  }));
};

export default {
  getNotebookRecommendations,
};
