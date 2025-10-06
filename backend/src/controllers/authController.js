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
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "strict" : "lax",
    path: "/",
  };
};

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

    const session = await issueSession(user, req, res, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });

    return res.status(201).json({
      user: sanitizeUser(user),
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    });
  } catch (error) {
    logger.error("Register failed", {
      error: error?.message,
      stack: error?.stack,
    });
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
    return res.status(500).json({ message: "Internal server error" });
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
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const me = async (req, res) => {
  return res.status(200).json({ user: sanitizeUser(req.userDocument) });
};

export { REFRESH_COOKIE };
