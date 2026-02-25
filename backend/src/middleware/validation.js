import { body, param, query, validationResult } from "express-validator";
import { NOTEBOOK_ANALYTICS_RANGES } from "../../../shared/analyticsTypes.js";

/**
 * Validation middleware creator
 * Validates request and returns errors if any
 */
export const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return res.status(400).json({
      message: "Validation failed",
      errors: formattedErrors,
    });
  };
};

/**
 * Common validation rules
 */
const ANALYTICS_RANGE_VALUES = [...NOTEBOOK_ANALYTICS_RANGES];

export const validationRules = {
  // ID validations
  objectId: (field = "id") =>
    param(field)
      .isMongoId()
      .withMessage(`${field} must be a valid MongoDB ObjectId`),

  // Email validation
  email: () =>
    body("email")
      .isEmail()
      .normalizeEmail({ gmail_remove_dots: false })
      .withMessage("Must be a valid email address"),

  // Password validation
  password: () =>
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one number"),

  // Pagination
  pagination: () => [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],

  // Note validation
  noteTitle: () =>
    body("title")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Title must not exceed 200 characters"),

  noteContent: () =>
    body("content")
      .optional()
      .isString()
      .isLength({ max: 50000 })
      .withMessage("Content must not exceed 50000 characters"),

  noteTags: () =>
    body("tags")
      .optional()
      .isArray()
      .withMessage("Tags must be an array")
      .custom((tags) => tags.every((tag) => typeof tag === "string"))
      .withMessage("All tags must be strings")
      .custom((tags) => tags.length <= 20)
      .withMessage("Maximum 20 tags allowed"),

  // Notebook validation
  notebookName: () =>
    body("name")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Notebook name is required")
      .isLength({ min: 1, max: 100 })
      .withMessage("Notebook name must be between 1 and 100 characters"),

  notebookDescription: () =>
    body("description")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must not exceed 500 characters"),

  // Role validation
  memberRole: () =>
    body("role")
      .isIn(["owner", "editor", "viewer"])
      .withMessage("Role must be one of: owner, editor, viewer"),

  // Date validation
  dateRange: () => [
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO 8601 date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date")
      .custom((endDate, { req }) => {
        if (req.query.startDate && endDate < req.query.startDate) {
          throw new Error("End date must be after start date");
        }
        return true;
      }),
  ],

  analyticsRange: () =>
    query("range")
      .optional()
      .isString()
      .trim()
      .toLowerCase()
      .isIn(ANALYTICS_RANGE_VALUES)
      .withMessage(
        `range must be one of: ${ANALYTICS_RANGE_VALUES.join(", ")}`,
      ),

  notebookPublicSlug: (field = "slug") =>
    body(field)
      .optional()
      .isString()
      .trim()
      .isLength({ min: 6, max: 64 })
      .withMessage("Slug must be between 6 and 64 characters"),

  syncClientId: (field = "clientId") =>
    body(field)
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 64 })
      .withMessage("clientId must be between 1 and 64 characters"),

  syncBaseRevision: (field = "baseRevision") =>
    body(field)
      .optional({ values: "falsy" })
      .isInt({ min: 0 })
      .withMessage("baseRevision must be a non-negative integer"),

  savedQueryName: () =>
    body("name")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ max: 120 })
      .withMessage("Name must be 120 characters or fewer"),

  savedQueryPayload: () => [
    body("query")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 512 })
      .withMessage("Query must be 512 characters or fewer"),
    body("filters")
      .optional({ nullable: true })
      .isObject()
      .withMessage("filters must be an object"),
    body("sort")
      .optional({ nullable: true })
      .isObject()
      .withMessage("sort must be an object"),
    body("scope")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 32 })
      .withMessage("scope must be 32 characters or fewer"),
  ],
};
