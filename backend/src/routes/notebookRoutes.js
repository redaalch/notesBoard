import express from "express";
import auth from "../middleware/auth.js";
import rateLimiter from "../middleware/rateLimiter.js";
import { validate, validationRules } from "../middleware/validation.js";
import { body } from "express-validator";
import {
  listNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  moveNotesToNotebook,
} from "../controllers/notebooksController.js";
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

const router = express.Router();

// Authentication and rate limiting for all routes
router.use(auth);
router.use(rateLimiter);

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

export default router;
