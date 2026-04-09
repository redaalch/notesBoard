import crypto from "crypto";
import jwt from "jsonwebtoken";

import logger from "./logger.js";

// #3 — Minimum secret strength (32 bytes = 256 bits for HMAC-SHA256)
const MIN_SECRET_BYTES = 32;
const DEFAULT_REFRESH_TTL_MS = 604_800_000; // 7 days

// Ephemeral dev secret — generated once per process, never persisted.
let _ephemeralSecret;

const resolveSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (secret) {
    // #3 — Warn on weak secrets; throw in production.
    if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
      const msg = `JWT_ACCESS_SECRET is shorter than ${MIN_SECRET_BYTES} bytes — use a stronger secret.`;
      if (process.env.NODE_ENV === "production") {
        throw new Error(msg);
      }
      logger.warn(msg);
    }
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    if (!_ephemeralSecret) {
      _ephemeralSecret = crypto.randomBytes(64).toString("hex");
      logger.warn(
        "JWT_ACCESS_SECRET not set. Using random ephemeral secret (tokens will not survive restarts).",
      );
    }
    return _ephemeralSecret;
  }

  throw new Error("JWT_ACCESS_SECRET is not configured");
};

// Cache secrets for fast sign/verify.  Supports graceful rotation: when
// JWT_ACCESS_SECRET changes at runtime (e.g. via a config reload), the old
// secret is kept as a fallback so tokens issued before the rotation still
// verify during the grace period.  The cache is refreshed every 60 s.
let _cachedSecret = null;
let _previousSecret = null;
let _secretResolvedAt = 0;
const SECRET_REFRESH_INTERVAL_MS = 60_000;

const getAccessSecret = () => {
  const now = Date.now();
  if (!_cachedSecret || now - _secretResolvedAt > SECRET_REFRESH_INTERVAL_MS) {
    const fresh = resolveSecret();
    if (_cachedSecret && fresh !== _cachedSecret) {
      _previousSecret = _cachedSecret;
    }
    _cachedSecret = fresh;
    _secretResolvedAt = now;
  }
  return _cachedSecret;
};

/**
 * Return the previous secret (if any) so `verifyAccessToken` can attempt
 * verification with both the current and the rotated-out secret.
 */
const getPreviousSecret = () => _previousSecret;

// #17 — Cache TTL at module load (it never changes at runtime).
const _accessTtl = process.env.JWT_ACCESS_TTL || "15m";

const getRefreshTtlMs = () => {
  const raw = Number(process.env.JWT_REFRESH_TTL_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    if (process.env.JWT_REFRESH_TTL_MS) {
      logger.warn("Invalid JWT_REFRESH_TTL_MS, using default", {
        value: process.env.JWT_REFRESH_TTL_MS,
      });
    }
    return DEFAULT_REFRESH_TTL_MS;
  }
  return raw;
};

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
    { expiresIn: _accessTtl },
  );

// #1 — Pin algorithm to HS256; rejects alg:none and RS/ES tokens.
// During secret rotation, fall back to the previous secret so in-flight
// tokens issued before the rotation still verify during the grace period.
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, getAccessSecret(), { algorithms: ["HS256"] });
  } catch (err) {
    const prev = getPreviousSecret();
    if (prev) {
      return jwt.verify(token, prev, { algorithms: ["HS256"] });
    }
    throw err;
  }
};

export const generateRefreshToken = () => {
  const token = crypto.randomBytes(40).toString("hex");
  const hashed = hashToken(token);
  const expiresAt = new Date(Date.now() + getRefreshTtlMs());
  return { token, hashed, expiresAt };
};

// Test helper — reset cached secret so tests can inject a different
// JWT_ACCESS_SECRET via process.env between test cases.
export const __resetSecretForTesting = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("__resetSecretForTesting must not be called in production");
  }
  _cachedSecret = null;
  _previousSecret = null;
  _secretResolvedAt = 0;
};
