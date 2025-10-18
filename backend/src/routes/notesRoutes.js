import express from "express";
import {
  createNote,
  deleteNote,
  getAllNotes,
  updateNote,
  getNoteById,
  getTagStats,
  bulkUpdateNotes,
  getNoteHistory,
  getNoteLayout,
  updateNoteLayout,
} from "../controllers/notesController.js";
import {
  addNoteCollaborator,
  listNoteCollaborators,
  removeNoteCollaborator,
} from "../controllers/noteCollaboratorsController.js";
import auth from "../middleware/auth.js";
import { validate, validationRules } from "../middleware/validation.js";
import { body, query } from "express-validator";

const router = express.Router();

// All routes require authentication
router.use(auth);

// List notes with pagination
router.get(
  "/",
  validate([...validationRules.pagination(), query("tag").optional().trim()]),
  getAllNotes
);

// Note layout routes
router.get("/layout", getNoteLayout);
router.put(
  "/layout",
  validate([
    body("noteIds").isArray().withMessage("noteIds must be an array"),
    body("noteIds.*")
      .isMongoId()
      .optional()
      .withMessage("Each noteId must be a valid MongoDB ID"),
    body("notebookId")
      .optional()
      .custom((value) => {
        if (value === "uncategorized" || value === "all") return true;
        return validationRules.objectId("notebookId").custom(() => true);
      })
      .withMessage(
        "notebookId must be a valid MongoDB ID or 'uncategorized' or 'all'"
      ),
  ]),
  updateNoteLayout
);

// Tag statistics
router.get("/tags/stats", getTagStats);

// Bulk update notes
router.post(
  "/bulk",
  validate([
    body("noteIds")
      .isArray({ min: 1 })
      .withMessage("noteIds must be a non-empty array"),
    body("noteIds.*").isMongoId().withMessage("Each noteId must be valid"),
    body("action").isString().withMessage("Action is required"),
  ]),
  bulkUpdateNotes
);

// Note history
router.get(
  "/:id/history",
  validate([validationRules.objectId("id"), ...validationRules.pagination()]),
  getNoteHistory
);

// Collaborators routes
router.get(
  "/:id/collaborators",
  validate([validationRules.objectId("id")]),
  listNoteCollaborators
);

router.post(
  "/:id/collaborators",
  validate([
    validationRules.objectId("id"),
    validationRules.email(),
    body("permission")
      .isIn(["view", "edit"])
      .withMessage("Permission must be view or edit"),
  ]),
  addNoteCollaborator
);

router.delete(
  "/:id/collaborators/:collaboratorId",
  validate([
    validationRules.objectId("id"),
    validationRules.objectId("collaboratorId"),
  ]),
  removeNoteCollaborator
);

// Get single note
router.get("/:id", validate([validationRules.objectId("id")]), getNoteById);

// Create note
router.post(
  "/",
  validate([
    body("title")
      .notEmpty()
      .withMessage("Title is required")
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Title must not exceed 200 characters"),
    body("content")
      .notEmpty()
      .withMessage("Content is required")
      .isString()
      .isLength({ max: 50000 })
      .withMessage("Content must not exceed 50000 characters"),
    validationRules.noteTags(),
    body("pinned").optional().isBoolean().withMessage("Pinned must be boolean"),
    body("notebookId")
      .optional()
      .custom((value) => {
        if (!value || value === null) return true;
        return /^[0-9a-fA-F]{24}$/.test(value);
      })
      .withMessage("Invalid notebook ID"),
    body("workspaceId")
      .optional()
      .isMongoId()
      .withMessage("Invalid workspace ID"),
  ]),
  createNote
);

// Update note
router.put(
  "/:id",
  validate([
    validationRules.objectId("id"),
    validationRules.noteTitle(),
    validationRules.noteContent(),
    validationRules.noteTags(),
    body("pinned").optional().isBoolean().withMessage("Pinned must be boolean"),
    body("archived")
      .optional()
      .isBoolean()
      .withMessage("Archived must be boolean"),
  ]),
  updateNote
);

// Delete note
router.delete("/:id", validate([validationRules.objectId("id")]), deleteNote);

export default router;
