import mongoose from "mongoose";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/tokenService.js";

const REFRESH_COOKIE = "nb_refresh_token";
const isProduction = process.env.NODE_ENV === "production";

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
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

const cookieOptions = (expiresAt) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict",
  expires: expiresAt,
  path: "/",
});

const issueSession = async (user, res, meta = {}) => {
  const accessToken = generateAccessToken(user);
  const { token: refreshToken, hashed, expiresAt } = generateRefreshToken();

  user.addRefreshToken({
    token: hashed,
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  await user.save();

  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(expiresAt));

  return {
    accessToken,
    expiresIn: process.env.JWT_ACCESS_TTL || "15m",
    refreshExpiresAt: expiresAt,
  };
};

const clearSession = async (user, hashedToken, res) => {
  if (user && hashedToken) {
    user.removeRefreshToken(hashedToken);
    await user.save();
  }

  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!passwordOk(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 chars and include upper, lower, and number",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: "temp",
    });

    await user.setPassword(password);

    const session = await issueSession(user, res, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });

    return res.status(201).json({
      user: sanitizeUser(user),
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    });
  } catch (error) {
    logger.error("Register failed", { error: error?.message });
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const session = await issueSession(user, res, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });

    return res.status(200).json({
      user: sanitizeUser(user),
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    });
  } catch (error) {
    logger.error("Login failed", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({ message: "Missing refresh token" });
    }

    const hashed = hashToken(refreshToken);
    const user = await User.findOne({ "refreshTokens.token": hashed });
    if (!user) {
      await clearSession(null, null, res);
      return res.status(401).json({ message: "Invalid session" });
    }

    const tokenEntry = user.refreshTokens.find(
      (entry) => entry.token === hashed
    );
    if (!tokenEntry) {
      await clearSession(user, hashed, res);
      return res.status(401).json({ message: "Invalid session" });
    }

    if (tokenEntry.expiresAt < new Date()) {
      await clearSession(user, hashed, res);
      return res.status(401).json({ message: "Session expired" });
    }

    user.removeRefreshToken(hashed);

    const session = await issueSession(user, res, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });

    return res.status(200).json({
      user: sanitizeUser(user),
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    });
  } catch (error) {
    logger.error("Refresh failed", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      res.clearCookie(REFRESH_COOKIE, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        path: "/",
      });
      return res.status(204).send();
    }

    const hashed = hashToken(refreshToken);
    const user = await User.findOne({ "refreshTokens.token": hashed });
    await clearSession(user, hashed, res);

    return res.status(204).send();
  } catch (error) {
    logger.error("Logout failed", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const me = async (req, res) => {
  return res.status(200).json({ user: sanitizeUser(req.userDocument) });
};

export { REFRESH_COOKIE };
