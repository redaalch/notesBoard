import express from "express";
import auth from "../middleware/auth.js";
import rateLimiter from "../middleware/rateLimiter.js";
import { validate, validationRules } from "../middleware/validation.js";
import { body, query } from "express-validator";
import {
  listNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  moveNotesToNotebook,
  getNotebookRecommendations,
  getSmartNotebook,
  getNotebookHistory,
  undoNotebookHistoryEvent,
} from "../controllers/notebooksController.js";
import { exportNotebookTemplate } from "../controllers/notebookTemplatesController.js";
import {
  listNotebookMembers,
  inviteNotebookMember,
  resendNotebookInvitation,
  revokeNotebookInvitation,
  updateNotebookMemberRole,
  removeNotebookMember,
  acceptNotebookInvitation,
} from "../controllers/notebookMembersController.js";
import {
  listNotebookShareLinks,
  createNotebookShareLink,
  revokeNotebookShareLink,
} from "../controllers/notebookShareLinksController.js";
import {
  getNotebookAnalytics,
  getNotebookAnalyticsActivity,
  getNotebookAnalyticsTags,
  getNotebookAnalyticsCollaborators,
  getNotebookAnalyticsSnapshots,
} from "../controllers/notebookAnalyticsController.js";
import ensureNotebookAnalyticsContext from "../middleware/analyticsContext.js";

const router = express.Router();

// Authentication and rate limiting for all routes
router.use(auth);
router.use(rateLimiter);

router.get(
  "/recommendations",
  validate([
    query("noteId")
      .isMongoId()
      .withMessage("noteId query parameter must be a valid id"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage("limit must be between 1 and 20"),
  ]),
  getNotebookRecommendations
);

router.get(
  "/smart",
  validate([
    query("tag").optional().isString().trim().isLength({ max: 64 }),
    query("search").optional().isString().trim().isLength({ max: 120 }),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 60 })
      .withMessage("limit must be between 1 and 60"),
  ]),
  getSmartNotebook
);

// List all notebooks
router.get("/", listNotebooks);

// Create notebook
router.post(
  "/",
  validate([
    validationRules.notebookName(),
    validationRules.notebookDescription(),
  ]),
  createNotebook
);

router.post(
  "/:id/templates",
  validate([
    validationRules.objectId("id"),
    body("name")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 160 })
      .withMessage("Name must be 160 characters or fewer"),
    body("description")
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage("Description must be 500 characters or fewer"),
    body("tags")
      .optional()
      .isArray({ max: 8 })
      .withMessage("Tags must be an array with at most 8 entries"),
    body("tags.*")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 32 })
      .withMessage("Each tag must be 1-32 characters"),
  ]),
  exportNotebookTemplate
);

// Accept notebook invitation
router.post(
  "/invitations/accept",
  validate([
    body("token").trim().notEmpty().withMessage("Invitation token is required"),
  ]),
  acceptNotebookInvitation
);

// Member management routes
router.get(
  "/:id/members",
  validate([validationRules.objectId("id")]),
  listNotebookMembers
);

router.post(
  "/:id/members",
  validate([
    validationRules.objectId("id"),
    validationRules.email(),
    validationRules.memberRole(),
  ]),
  inviteNotebookMember
);

router.patch(
  "/:id/members/:memberId",
  validate([
    validationRules.objectId("id"),
    validationRules.objectId("memberId"),
    validationRules.memberRole(),
  ]),
  updateNotebookMemberRole
);

router.delete(
  "/:id/members/:memberId",
  validate([
    validationRules.objectId("id"),
    validationRules.objectId("memberId"),
  ]),
  removeNotebookMember
);

// Invitation management
router.post(
  "/:id/invitations/:memberId/resend",
  validate([
    validationRules.objectId("id"),
    validationRules.objectId("memberId"),
  ]),
  resendNotebookInvitation
);

router.post(
  "/:id/invitations/:memberId/revoke",
  validate([
    validationRules.objectId("id"),
    validationRules.objectId("memberId"),
  ]),
  revokeNotebookInvitation
);

// Share link management
router.get(
  "/:id/share-links",
  validate([validationRules.objectId("id")]),
  listNotebookShareLinks
);

router.post(
  "/:id/share-links",
  validate([
    validationRules.objectId("id"),
    body("expiresAt")
      .optional()
      .isISO8601()
      .toDate()
      .withMessage("expiresAt must be a valid date"),
    validationRules.memberRole(),
  ]),
  createNotebookShareLink
);

router.delete(
  "/:id/share-links/:shareLinkId",
  validate([
    validationRules.objectId("id"),
    validationRules.objectId("shareLinkId"),
  ]),
  revokeNotebookShareLink
);

router.get(
  "/:id/analytics/activity",
  validate([validationRules.objectId("id"), validationRules.analyticsRange()]),
  ensureNotebookAnalyticsContext,
  getNotebookAnalyticsActivity
);

router.get(
  "/:id/analytics/tags",
  validate([validationRules.objectId("id"), validationRules.analyticsRange()]),
  ensureNotebookAnalyticsContext,
  getNotebookAnalyticsTags
);

router.get(
  "/:id/analytics/collaborators",
  validate([validationRules.objectId("id"), validationRules.analyticsRange()]),
  ensureNotebookAnalyticsContext,
  getNotebookAnalyticsCollaborators
);

router.get(
  "/:id/analytics/snapshots",
  validate([validationRules.objectId("id"), validationRules.analyticsRange()]),
  ensureNotebookAnalyticsContext,
  getNotebookAnalyticsSnapshots
);

router.get(
  "/:id/analytics",
  validate([validationRules.objectId("id"), validationRules.analyticsRange()]),
  ensureNotebookAnalyticsContext,
  getNotebookAnalytics
);

// Update notebook
router.patch(
  "/:id",
  validate([
    validationRules.objectId("id"),
    validationRules.notebookName(),
    validationRules.notebookDescription(),
  ]),
  updateNotebook
);

// Delete notebook
router.delete(
  "/:id",
  validate([validationRules.objectId("id")]),
  deleteNotebook
);

// Move notes to notebook
router.post(
  "/:id/move",
  validate([
    validationRules.objectId("id"),
    body("noteIds")
      .isArray({ min: 1 })
      .withMessage("noteIds must be a non-empty array"),
    body("noteIds.*").isMongoId().withMessage("Each noteId must be valid"),
  ]),
  moveNotesToNotebook
);

router.get(
  "/:id/history",
  validate([
    validationRules.objectId("id"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage("limit must be between 1 and 200"),
  ]),
  getNotebookHistory
);

router.post(
  "/:id/history/undo",
  validate([
    validationRules.objectId("id"),
    body("eventId")
      .isMongoId()
      .withMessage("eventId must be a valid MongoDB ObjectId"),
  ]),
  undoNotebookHistoryEvent
);

export default router;
