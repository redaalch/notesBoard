import crypto from "crypto";
import jwt from "jsonwebtoken";

import logger from "./logger.js";

let cachedDevSecret;

const getAccessSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    if (!cachedDevSecret) {
      cachedDevSecret = crypto
        .createHash("sha256")
        .update("notesboard-dev-secret")
        .digest("hex");
      logger.warn(
        "JWT_ACCESS_SECRET not set. Using development fallback secret."
      );
    }
    return cachedDevSecret;
  }

  throw new Error("JWT_ACCESS_SECRET is not configured");
};

const getAccessTtl = () => process.env.JWT_ACCESS_TTL || "15m";

const getRefreshTtlMs = () =>
  parseInt(process.env.JWT_REFRESH_TTL_MS || "604800000", 10); // 7 days

export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const generateAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    getAccessSecret(),
    { expiresIn: getAccessTtl() }
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, getAccessSecret());

export const generateRefreshToken = () => {
  const token = crypto.randomBytes(40).toString("hex");
  const hashed = hashToken(token);
  const expiresAt = new Date(Date.now() + getRefreshTtlMs());
  return { token, hashed, expiresAt };
};
