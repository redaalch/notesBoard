import express from "express";
import {
  register,
  login,
  refresh,
  logout,
  me,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendEmailVerification,
} from "../controllers/authController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/password/forgot", requestPasswordReset);
router.post("/password/reset", resetPassword);
router.post("/verify-email", verifyEmail);
router.post("/verify-email/resend", resendEmailVerification);
router.get("/me", auth, me);

export default router;
