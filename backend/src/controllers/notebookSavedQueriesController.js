import mongoose from "mongoose";
import SavedNotebookQuery from "../models/SavedNotebookQuery.js";
import { ensureNotebookOwnership } from "../utils/notebooks.js";
import logger from "../utils/logger.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

const sanitizeObject = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return null;
  }
};

const mapLikeToObject = (value) => {
  if (!value) {
    return {};
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (Array.isArray(value)) {
    return { ...value };
  }
  if (typeof value === "object") {
    return value;
  }
  return {};
};

export const listSavedNotebookQueries = async (req, res) => {
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

    const queries = await SavedNotebookQuery.find({
      notebookId: notebook._id,
      userId: new mongoose.Types.ObjectId(ownerId),
    })
      .sort({ updatedAt: -1 })
      .lean();

    const payload = queries.map((entry) => ({
      id: entry._id.toString(),
      name: entry.name,
      query: entry.query ?? "",
      filters: entry.filters ?? null,
      sort: mapLikeToObject(entry.sort),
      scope: entry.scope ?? "notebook",
      metadata: mapLikeToObject(entry.metadata),
      lastUsedAt: entry.lastUsedAt ?? null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));

    return res.status(200).json({ queries: payload });
  } catch (error) {
    logger.error("Failed to list saved notebook queries", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const createSavedNotebookQuery = async (req, res) => {
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

    const {
      name,
      query = "",
      filters = null,
      sort = null,
      scope = "notebook",
    } = req.body ?? {};

    const doc = await SavedNotebookQuery.create({
      notebookId: notebook._id,
      ownerId: notebook.owner,
      userId: new mongoose.Types.ObjectId(ownerId),
      name: name.trim(),
      query: typeof query === "string" ? query.trim() : "",
      filters: sanitizeObject(filters),
      sort: sanitizeObject(sort) ?? new Map(),
      scope: typeof scope === "string" ? scope.trim().slice(0, 32) : "notebook",
    });

    return res.status(201).json({
      id: doc._id.toString(),
      name: doc.name,
      query: doc.query ?? "",
      filters: doc.filters ?? null,
      sort: mapLikeToObject(doc.sort),
      scope: doc.scope ?? "notebook",
      metadata: {},
      lastUsedAt: doc.lastUsedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "A saved query with this name already exists" });
    }
    logger.error("Failed to create saved notebook query", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const updateSavedNotebookQuery = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id, queryId } = req.params;
    const notebook = await ensureNotebookOwnership(id, ownerId);
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!mongoose.Types.ObjectId.isValid(queryId)) {
      return res.status(400).json({ message: "Invalid query id" });
    }

    const update = {};
    if (typeof req.body?.name === "string") {
      update.name = req.body.name.trim();
    }
    if (typeof req.body?.query === "string" || req.body?.query === "") {
      update.query = (req.body.query ?? "").toString().trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "filters")) {
      update.filters = sanitizeObject(req.body.filters);
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "sort")) {
      update.sort = sanitizeObject(req.body.sort) ?? new Map();
    }
    if (typeof req.body?.scope === "string") {
      update.scope = req.body.scope.trim().slice(0, 32);
    }

    if (!Object.keys(update).length) {
      return res
        .status(400)
        .json({ message: "No saved query fields provided for update" });
    }

    const doc = await SavedNotebookQuery.findOneAndUpdate(
      {
        _id: queryId,
        notebookId: notebook._id,
        userId: new mongoose.Types.ObjectId(ownerId),
      },
      {
        $set: update,
        $setOnInsert: {
          ownerId: notebook.owner,
        },
      },
      {
        new: true,
      }
    );

    if (!doc) {
      return res.status(404).json({ message: "Saved query not found" });
    }

    return res.status(200).json({
      id: doc._id.toString(),
      name: doc.name,
      query: doc.query ?? "",
      filters: doc.filters ?? null,
      sort: mapLikeToObject(doc.sort),
      scope: doc.scope ?? "notebook",
      metadata: mapLikeToObject(doc.metadata),
      lastUsedAt: doc.lastUsedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "A saved query with this name already exists" });
    }
    logger.error("Failed to update saved notebook query", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const deleteSavedNotebookQuery = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id, queryId } = req.params;
    const notebook = await ensureNotebookOwnership(id, ownerId);
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!mongoose.Types.ObjectId.isValid(queryId)) {
      return res.status(400).json({ message: "Invalid query id" });
    }

    const result = await SavedNotebookQuery.deleteOne({
      _id: queryId,
      notebookId: notebook._id,
      userId: new mongoose.Types.ObjectId(ownerId),
    });

    if (!result?.deletedCount) {
      return res.status(404).json({ message: "Saved query not found" });
    }

    return res.status(204).send();
  } catch (error) {
    logger.error("Failed to delete saved notebook query", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const touchSavedNotebookQuery = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id, queryId } = req.params;
    const notebook = await ensureNotebookOwnership(id, ownerId);
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    if (!mongoose.Types.ObjectId.isValid(queryId)) {
      return res.status(400).json({ message: "Invalid query id" });
    }

    const now = new Date();
    const doc = await SavedNotebookQuery.findOneAndUpdate(
      {
        _id: queryId,
        notebookId: notebook._id,
        userId: new mongoose.Types.ObjectId(ownerId),
      },
      { $set: { lastUsedAt: now } },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ message: "Saved query not found" });
    }

    return res.status(200).json({
      id: doc._id.toString(),
      lastUsedAt: doc.lastUsedAt ?? now,
    });
  } catch (error) {
    logger.error("Failed to update saved query usage", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export default {
  listSavedNotebookQueries,
  createSavedNotebookQuery,
  updateSavedNotebookQuery,
  deleteSavedNotebookQuery,
  touchSavedNotebookQuery,
};
