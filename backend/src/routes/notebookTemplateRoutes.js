import express from "express";
import auth from "../middleware/auth.js";
import rateLimiter from "../middleware/rateLimiter.js";
import { validate, validationRules } from "../middleware/validation.js";
import { body } from "express-validator";
import {
  getNotebookTemplate,
  instantiateNotebookTemplate,
  listNotebookTemplates,
  deleteNotebookTemplate,
} from "../controllers/notebookTemplatesController.js";

const router = express.Router();

router.use(auth);
router.use(rateLimiter);

router.get("/", listNotebookTemplates);

router.get(
  "/:id",
  validate([validationRules.objectId("id")]),
  getNotebookTemplate
);

router.post(
  "/:id/instantiate",
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
    body("color").optional().isString().withMessage("Color must be a string"),
    body("icon").optional().isString().withMessage("Icon must be a string"),
    body("workspaceId")
      .optional()
      .isMongoId()
      .withMessage("workspaceId must be a valid id"),
    body("workspaceMappings")
      .optional()
      .isObject()
      .withMessage("workspaceMappings must be an object"),
    body("boardMappings")
      .optional()
      .isObject()
      .withMessage("boardMappings must be an object"),
  ]),
  instantiateNotebookTemplate
);

router.delete(
  "/:id",
  validate([validationRules.objectId("id")]),
  deleteNotebookTemplate
);

export default router;
