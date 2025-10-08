import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { normalizeEmail } from "../utils/validators.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/tokenService.js";
import { sendMail } from "../utils/mailer.js";

const REFRESH_COOKIE = "nb_refresh_token";
const isProduction = process.env.NODE_ENV === "production";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };
const EMAIL_REQUIRED = { message: "Email is required" };
const EMAIL_AND_PASSWORD_REQUIRED = {
  message: "Email and password required",
};
const INVALID_CREDENTIALS = { message: "Invalid credentials" };
const INVALID_OR_EXPIRED_RESET_TOKEN = {
  message: "Invalid or expired reset token",
};
const EMAIL_NOT_VERIFIED = {
  message: "Please verify your email before signing in.",
};
const INVALID_OR_EXPIRED_VERIFICATION_TOKEN = {
  message: "Invalid or expired verification token",
};

const DEFAULT_EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const parseBoolean = (value) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return null;
};

const normalizeHostCandidate = (value) => {
  if (!value || typeof value !== "string") return null;
  const first = value.split(",")[0]?.trim();
  if (!first) return null;

  try {
    return new URL(`http://${first}`).hostname.toLowerCase();
  } catch (_error) {
    return first.toLowerCase();
  }
};

const extractIpv4FromMapped = (host) => {
  if (!host) return host;
  const match = /^::ffff:(.+)$/i.exec(host);
  if (match) {
    return match[1];
  }
  return host;
};

const isPrivateIpv4 = (host) => {
  if (!host) return false;
  const candidate = extractIpv4FromMapped(host);
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(candidate)) {
    return false;
  }

  if (candidate.startsWith("127.")) return true;
  if (candidate.startsWith("10.")) return true;
  if (candidate.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(candidate)) return true;
  if (candidate === "0.0.0.0") return true;
  return false;
};

const isLocalHostname = (host) => {
  if (!host) return false;
  const normalized = extractIpv4FromMapped(host);
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "::" ||
    normalized.endsWith(".local") ||
    isPrivateIpv4(normalized)
  );
};

const shouldUseSecureCookies = (req) => {
  const override = parseBoolean(process.env.COOKIE_SECURE);
  if (override !== null) {
    return override;
  }

  if (!isProduction) {
    return false;
  }

  if (req?.secure) {
    return true;
  }

  const forwardedProto = req?.get?.("x-forwarded-proto");
  if (forwardedProto) {
    const proto = forwardedProto.split(",")[0]?.trim()?.toLowerCase();
    if (proto === "https") return true;
    if (proto === "http") return false;
  }

  const hostCandidates = [
    req?.get?.("x-forwarded-host"),
    req?.get?.("x-forwarded-server"),
    req?.hostname,
    req?.headers?.host,
  ];

  for (const candidate of hostCandidates) {
    const host = normalizeHostCandidate(candidate);
    if (host && isLocalHostname(host)) {
      return false;
    }
  }

  return true;
};

const baseCookieOptions = (req) => {
  const secure = shouldUseSecureCookies(req);
  const configuredDomain = process.env.COOKIE_DOMAIN?.trim();
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "strict" : "lax",
    path: "/",
    priority: "high",
    ...(configuredDomain ? { domain: configuredDomain } : {}),
  };
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  emailVerified: Boolean(user.emailVerified),
  emailVerifiedAt: user.emailVerifiedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const passwordOk = (password) => {
  if (typeof password !== "string") return false;
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

const DEFAULT_PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

const getPasswordResetTtlMs = () => {
  const raw = Number.parseInt(process.env.PASSWORD_RESET_TTL_MS || "", 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return DEFAULT_PASSWORD_RESET_TTL_MS;
};

const getEmailVerificationTtlMs = () => {
  const raw = Number.parseInt(process.env.EMAIL_VERIFICATION_TTL_MS || "", 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return DEFAULT_EMAIL_VERIFICATION_TTL_MS;
};

const generateEmailVerificationToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const hashed = hashToken(token);
  const expiresAt = new Date(Date.now() + getEmailVerificationTtlMs());
  return { token, hashed, expiresAt };
};

const parseUrlCandidate = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const allowlist = ["http:", "https:"];

  try {
    const url = new URL(trimmed);
    if (!allowlist.includes(url.protocol)) {
      return null;
    }
    return url;
  } catch (_error) {
    try {
      const url = new URL(`https://${trimmed}`);
      if (!allowlist.includes(url.protocol)) {
        return null;
      }
      return url;
    } catch (_error) {
      return null;
    }
  }
};

const buildPasswordResetLink = (req, token, redirectUrl) => {
  const candidates = [
    redirectUrl,
    process.env.PASSWORD_RESET_URL,
    process.env.CLIENT_APP_URL,
    process.env.FRONTEND_URL,
    req?.get?.("origin"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string" && candidate.includes("{token}")) {
      return candidate.replace("{token}", encodeURIComponent(token));
    }

    const parsed = parseUrlCandidate(candidate);
    if (parsed) {
      parsed.searchParams.set("token", token);
      return parsed.toString();
    }
  }

  const protocol =
    req?.protocol && ["http", "https"].includes(req.protocol)
      ? req.protocol
      : "https";
  const host = req?.get?.("host") || "localhost";
  const fallback = new URL("/reset-password", `${protocol}://${host}`);
  fallback.searchParams.set("token", token);
  return fallback.toString();
};

const buildEmailVerificationLink = (req, token, redirectUrl) => {
  const candidates = [
    redirectUrl,
    process.env.EMAIL_VERIFICATION_URL,
    process.env.CLIENT_APP_URL,
    process.env.FRONTEND_URL,
    req?.get?.("origin"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string" && candidate.includes("{token}")) {
      return candidate.replace("{token}", encodeURIComponent(token));
    }

    const parsed = parseUrlCandidate(candidate);
    if (parsed) {
      if (!parsed.pathname || parsed.pathname === "/") {
        parsed.pathname = "/verify-email";
      }
      parsed.searchParams.set("token", token);
      return parsed.toString();
    }
  }

  const protocol =
    req?.protocol && ["http", "https"].includes(req.protocol)
      ? req.protocol
      : "https";
  const host = req?.get?.("host") || "localhost";
  const fallback = new URL("/verify-email", `${protocol}://${host}`);
  fallback.searchParams.set("token", token);
  return fallback.toString();
};

const sendEmailVerification = async (user, req, token, redirectUrl) => {
  const verifyLink = buildEmailVerificationLink(req, token, redirectUrl);

  await sendMail({
    to: user.email,
    subject: "Confirm your NotesBoard account",
    text: `Hi ${
      user.name || "there"
    },\n\nThanks for signing up for NotesBoard! Please confirm your email address by visiting the link below:\n${verifyLink}\n\nIf you did not sign up, you can safely ignore this email.`,
    html: `<!doctype html><html><body><p>Hi ${
      user.name || "there"
    },</p><p>Thanks for signing up for NotesBoard! Please confirm your email address by clicking the link below:</p><p><a href="${verifyLink}">Confirm your email</a></p><p>If you did not sign up, you can safely ignore this email.</p></body></html>`,
  });
};

const PASSWORD_RESET_GENERIC_RESPONSE = {
  message:
    "If an account exists for that email, you'll receive a password reset email shortly.",
};

const cookieOptions = (req, expiresAt) => ({
  ...baseCookieOptions(req),
  expires: expiresAt,
});

const issueSession = async (user, req, res, meta = {}) => {
  const accessToken = generateAccessToken(user);
  const { token: refreshToken, hashed, expiresAt } = generateRefreshToken();

  user.addRefreshToken({
    token: hashed,
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  await user.save();

  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(req, expiresAt));

  return {
    accessToken,
    expiresIn: process.env.JWT_ACCESS_TTL || "15m",
    refreshExpiresAt: expiresAt,
  };
};

const clearSession = async (user, hashedToken, req, res) => {
  if (user && hashedToken) {
    user.removeRefreshToken(hashedToken);
    await user.save();
  }

  res.clearCookie(REFRESH_COOKIE, baseCookieOptions(req));
};

export const register = async (req, res) => {
  try {
    const { name, email, password, verificationRedirectUrl } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json(EMAIL_REQUIRED);
    }
    if (!passwordOk(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 chars and include upper, lower, and number",
      });
    }

    const existing = await User.findOne({ email: normalizedEmail });

    if (existing && existing.emailVerified) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const verification = generateEmailVerificationToken();

    const candidateUser =
      existing ??
      new User({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: "temp",
        emailVerified: false,
      });

    candidateUser.name = name.trim();
    candidateUser.email = normalizedEmail;
    candidateUser.emailVerified = false;
    candidateUser.emailVerifiedAt = undefined;

    await candidateUser.setPassword(password);
    candidateUser.setEmailVerificationToken(
      verification.hashed,
      verification.expiresAt
    );
    candidateUser.clearRefreshTokens();

    await candidateUser.save();

    try {
      await sendEmailVerification(
        candidateUser,
        req,
        verification.token,
        verificationRedirectUrl
      );
    } catch (error) {
      logger.error("Verification email send failed", {
        error: error?.message,
        userId: candidateUser.id,
      });

      if (!existing) {
        try {
          await candidateUser.deleteOne();
        } catch (cleanupError) {
          logger.warn("Failed to delete user after email send failure", {
            cleanupError: cleanupError?.message,
            userId: candidateUser.id,
          });
        }
      }

      return res
        .status(500)
        .json({ message: "Failed to send verification email" });
    }

    const statusCode = existing ? 200 : 202;
    const message = existing
      ? "We refreshed your registration. Check your inbox to confirm your email."
      : "Account created. Check your email to confirm your address.";

    return res.status(statusCode).json({ message });
  } catch (error) {
    logger.error("Register failed", {
      error: error?.message,
      stack: error?.stack,
    });
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const resendEmailVerification = async (req, res) => {
  try {
    const { email, verificationRedirectUrl } = req.body ?? {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json(EMAIL_REQUIRED);
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists for that email, we'll send a verification link.",
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        message: "This email is already verified. You can sign in.",
      });
    }

    const verification = generateEmailVerificationToken();
    user.setEmailVerificationToken(verification.hashed, verification.expiresAt);
    user.clearRefreshTokens();
    await user.save();

    try {
      await sendEmailVerification(
        user,
        req,
        verification.token,
        verificationRedirectUrl
      );
    } catch (error) {
      logger.error("Verification email resend failed", {
        error: error?.message,
        userId: user.id,
      });
      return res.status(500).json({
        message: "Failed to send verification email. Please try again later.",
      });
    }

    return res.status(200).json({
      message: "Verification email sent. Check your inbox to confirm.",
    });
  } catch (error) {
    logger.error("Resend email verification failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email, redirectUrl } = req.body ?? {};

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json(EMAIL_REQUIRED);
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json(PASSWORD_RESET_GENERIC_RESPONSE);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const hashed = hashToken(token);
    const expiresAt = new Date(Date.now() + getPasswordResetTtlMs());

    user.setPasswordResetToken(hashed, expiresAt);
    await user.save();

    const resetLink = buildPasswordResetLink(req, token, redirectUrl);

    try {
      await sendMail({
        to: user.email,
        subject: "Reset your NotesBoard password",
        text: `We received a request to reset your NotesBoard password. Use the link below to choose a new password:\n${resetLink}\nIf you did not request this, you can ignore this message.`,
        html: `<!doctype html><html><body><p>We received a request to reset your NotesBoard password.</p><p><a href="${resetLink}">Reset your password</a></p><p>If you did not request this, you can safely ignore this email.</p></body></html>`,
      });
    } catch (error) {
      logger.error("Password reset email failed", {
        error: error?.message,
        userId: user.id,
      });
      return res
        .status(500)
        .json({ message: "Failed to send password reset email" });
    }

    return res.status(200).json(PASSWORD_RESET_GENERIC_RESPONSE);
  } catch (error) {
    logger.error("Password reset request failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json(EMAIL_AND_PASSWORD_REQUIRED);
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    if (!user.emailVerified) {
      return res.status(403).json(EMAIL_NOT_VERIFIED);
    }

    const session = await issueSession(user, req, res, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });

    return res.status(200).json({
      user: sanitizeUser(user),
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    });
  } catch (error) {
    logger.error("Login failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body ?? {};

    if (!token || typeof token !== "string" || token.length < 20) {
      return res.status(400).json({ message: "A valid token is required" });
    }

    const hashed = hashToken(token);
    const user = await User.findOne({ "emailVerification.token": hashed });

    if (!user || !user.emailVerification?.expiresAt) {
      return res.status(400).json(INVALID_OR_EXPIRED_VERIFICATION_TOKEN);
    }

    if (user.emailVerification.expiresAt < new Date()) {
      user.clearEmailVerificationToken();
      await user.save();
      return res.status(400).json(INVALID_OR_EXPIRED_VERIFICATION_TOKEN);
    }

    user.markEmailVerified();
    user.clearRefreshTokens();

    const session = await issueSession(user, req, res, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });

    return res.status(200).json({
      user: sanitizeUser(user),
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    });
  } catch (error) {
    logger.error("Email verification failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body ?? {};

    if (!token || typeof token !== "string" || token.length < 20) {
      return res.status(400).json({ message: "A valid token is required" });
    }

    if (!passwordOk(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 chars and include upper, lower, and number",
      });
    }

    const hashed = hashToken(token);
    const user = await User.findOne({ "passwordReset.token": hashed });

    if (!user || !user.passwordReset?.expiresAt) {
      return res.status(400).json(INVALID_OR_EXPIRED_RESET_TOKEN);
    }

    if (user.passwordReset.expiresAt < new Date()) {
      user.clearPasswordResetToken();
      await user.save();
      return res.status(400).json(INVALID_OR_EXPIRED_RESET_TOKEN);
    }

    await user.setPassword(password);
    user.clearPasswordResetToken();
    user.clearRefreshTokens();
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    logger.error("Password reset failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      return res.status(204).send();
    }

    const hashed = hashToken(refreshToken);
    const user = await User.findOne({ "refreshTokens.token": hashed });
    if (!user) {
      await clearSession(null, null, req, res);
      return res.status(401).json({ message: "Invalid session" });
    }

    const tokenEntry = user.refreshTokens.find(
      (entry) => entry.token === hashed
    );
    if (!tokenEntry) {
      await clearSession(user, hashed, req, res);
      return res.status(401).json({ message: "Invalid session" });
    }

    if (tokenEntry.expiresAt < new Date()) {
      await clearSession(user, hashed, req, res);
      return res.status(401).json({ message: "Session expired" });
    }

    user.removeRefreshToken(hashed);

    const session = await issueSession(user, req, res, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });

    return res.status(200).json({
      user: sanitizeUser(user),
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    });
  } catch (error) {
    logger.error("Refresh failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      res.clearCookie(REFRESH_COOKIE, baseCookieOptions(req));
      return res.status(204).send();
    }

    const hashed = hashToken(refreshToken);
    const user = await User.findOne({ "refreshTokens.token": hashed });
    await clearSession(user, hashed, req, res);

    return res.status(204).send();
  } catch (error) {
    logger.error("Logout failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = req.userDocument;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { name, email, currentPassword, verificationRedirectUrl } =
      req.body ?? {};

    let hasUpdates = false;
    let emailChanged = false;
    let message = "Profile updated successfully.";

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }
      const trimmedName = name.trim();
      if (trimmedName !== user.name) {
        user.name = trimmedName;
        hasUpdates = true;
      }
    }

    let verificationToken;
    let previousState;

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json(EMAIL_REQUIRED);
      }

      if (normalizedEmail !== user.email) {
        if (!currentPassword || typeof currentPassword !== "string") {
          return res.status(400).json({
            message: "Current password is required to change email",
          });
        }

        const passwordMatches = await user.comparePassword(currentPassword);
        if (!passwordMatches) {
          return res
            .status(400)
            .json({ message: "Current password is incorrect" });
        }

        const existing = await User.findOne({ email: normalizedEmail });
        if (existing && existing.id !== user.id) {
          return res.status(409).json({ message: "Email already registered" });
        }

        const verification = generateEmailVerificationToken();

        previousState = {
          email: user.email,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          emailVerification: user.emailVerification
            ? { ...user.emailVerification }
            : undefined,
          refreshTokens: [...user.refreshTokens],
        };

        user.email = normalizedEmail;
        user.emailVerified = false;
        user.emailVerifiedAt = undefined;
        user.setEmailVerificationToken(
          verification.hashed,
          verification.expiresAt
        );
        user.clearRefreshTokens();

        verificationToken = verification.token;
        emailChanged = true;
        hasUpdates = true;
        message =
          "Email updated. Check your inbox to confirm your new address.";
      }
    }

    if (!hasUpdates) {
      return res.status(200).json({
        user: sanitizeUser(user),
        message: "No changes detected.",
      });
    }

    await user.save();

    let session = null;

    if (emailChanged) {
      try {
        await sendEmailVerification(
          user,
          req,
          verificationToken,
          verificationRedirectUrl
        );
      } catch (error) {
        logger.error("Email change verification send failed", {
          error: error?.message,
          userId: user.id,
        });

        if (previousState) {
          user.email = previousState.email;
          user.emailVerified = previousState.emailVerified;
          user.emailVerifiedAt = previousState.emailVerifiedAt;
          user.emailVerification = previousState.emailVerification;
          user.refreshTokens = previousState.refreshTokens;
          await user.save();
        }

        return res.status(500).json({
          message: "Failed to send verification email to the new address.",
        });
      }

      session = await issueSession(user, req, res, {
        userAgent: req.get("user-agent"),
        ip: req.ip,
      });
    }

    return res.status(200).json({
      user: sanitizeUser(user),
      message,
      emailVerificationRequired: emailChanged,
      ...(session
        ? {
            accessToken: session.accessToken,
            expiresIn: session.expiresIn,
          }
        : {}),
    });
  } catch (error) {
    logger.error("Update profile failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const changePassword = async (req, res) => {
  try {
    const user = req.userDocument;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body ?? {};

    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({
        message: "Current password is required",
      });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({
        message: "A new password is required",
      });
    }

    const matches = await user.comparePassword(currentPassword);
    if (!matches) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (!passwordOk(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 chars and include upper, lower, and number",
      });
    }

    await user.setPassword(newPassword);
    user.clearRefreshTokens();
    await user.save();

    const session = await issueSession(user, req, res, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });

    return res.status(200).json({
      message: "Password updated successfully",
      user: sanitizeUser(user),
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    });
  } catch (error) {
    logger.error("Change password failed", {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const me = async (req, res) => {
  return res.status(200).json({ user: sanitizeUser(req.userDocument) });
};

export { REFRESH_COOKIE };
