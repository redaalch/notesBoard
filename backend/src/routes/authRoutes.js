import express from "express";
import {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendEmailVerification,
  updateProfile,
  changePassword,
} from "../controllers/authController.js";
import auth from "../middleware/auth.js";
import { validate, validationRules } from "../middleware/validation.js";
import { body } from "express-validator";

const router = express.Router();

// Authentication routes with validation
router.post(
  "/register",
  validate([
    validationRules.email(),
    validationRules.password(),
    body("name").trim().notEmpty().withMessage("Name is required"),
  ]),
  register
);

router.post(
  "/login",
  validate([validationRules.email(), validationRules.password()]),
  login
);

router.post("/refresh", refresh);
router.post("/logout", logout);

router.post(
  "/password/forgot",
  validate([validationRules.email()]),
  requestPasswordReset
);

router.post(
  "/password/reset",
  validate([
    body("token").trim().notEmpty().withMessage("Reset token is required"),
    validationRules.password(),
  ]),
  resetPassword
);

router.post(
  "/verify-email",
  validate([
    body("token")
      .trim()
      .notEmpty()
      .withMessage("Verification token is required"),
  ]),
  verifyEmail
);

router.post(
  "/verify-email/resend",
  validate([validationRules.email()]),
  resendEmailVerification
);

router.put(
  "/profile",
  auth,
  validate([
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
  ]),
  updateProfile
);

router.post(
  "/password/change",
  auth,
  validate([
    body("currentPassword")
      .trim()
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .trim()
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("New password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("New password must contain at least one lowercase letter")
      .matches(/[0-9]/)
      .withMessage("New password must contain at least one number"),
  ]),
  changePassword
);

export default router;
