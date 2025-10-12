import express from "express";
import auth from "../middleware/auth.js";
import rateLimiter from "../middleware/rateLimiter.js";
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

router.use(auth);
router.use(rateLimiter);

router.get("/", listNotebooks);
router.post("/", createNotebook);
router.post("/invitations/accept", acceptNotebookInvitation);
router.get("/:id/members", listNotebookMembers);
router.post("/:id/members", inviteNotebookMember);
router.patch("/:id/members/:memberId", updateNotebookMemberRole);
router.delete("/:id/members/:memberId", removeNotebookMember);
router.post("/:id/invitations/:memberId/resend", resendNotebookInvitation);
router.post("/:id/invitations/:memberId/revoke", revokeNotebookInvitation);
router.get("/:id/share-links", listNotebookShareLinks);
router.post("/:id/share-links", createNotebookShareLink);
router.delete("/:id/share-links/:shareLinkId", revokeNotebookShareLink);
router.patch("/:id", updateNotebook);
router.delete("/:id", deleteNotebook);
router.post("/:id/move", moveNotesToNotebook);

export default router;
