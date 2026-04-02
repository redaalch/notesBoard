import User from "../models/User.js";
import { verifyAccessToken } from "../utils/tokenService.js";
import logger from "../utils/logger.js";
import { extractBearerToken } from "../utils/http.js";
import NodeCache from "node-cache";
import {
  MAX_TOKEN_BYTES,
  USER_CACHE_TTL_SECONDS,
  USER_CACHE_MAX_KEYS,
} from "../utils/constants.js";

// Short-lived cache to avoid hitting MongoDB on every authenticated request.
// TTL 10s: shorter window means role/permission changes propagate faster.
// Note: this is an in-process cache — in a multi-instance deployment, each
// server has its own cache and changes won't immediately propagate to other
// instances. Explicit invalidation via invalidateUserCache() covers the
// common cases (password change, role update). For stricter consistency,
// replace with a shared Redis cache.
// useClones: true — each get() returns a deep copy so controller mutations
// (e.g. req.userDocument.customNoteOrder = ...) never corrupt the cached entry.
const userCache = new NodeCache({
  stdTTL: USER_CACHE_TTL_SECONDS,
  checkperiod: USER_CACHE_TTL_SECONDS,
  useClones: true,
  maxKeys: USER_CACHE_MAX_KEYS,
});

const USER_PROJECTION =
  "name email role defaultWorkspace defaultBoard passwordChangedAt";

const auth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ message: "Authorization required" });
    }

    // Guard against oversized tokens — JWTs are typically <1 KB. Parsing an
    // attacker-supplied multi-MB string in jwt.verify is expensive.
    if (token.length > MAX_TOKEN_BYTES) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const payload = verifyAccessToken(token);
    const userId = payload.sub;

    let user = userCache.get(userId);
    if (!user) {
      user = await User.findById(userId).select(USER_PROJECTION).lean();
      if (user) {
        userCache.set(userId, user);
      }
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Reject tokens issued before the most recent password change / reset.
    // JWT `iat` is in seconds; passwordChangedAt is a Date.
    if (user.passwordChangedAt && payload.iat) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (payload.iat < changedAtSec) {
        return res.status(401).json({ message: "Token revoked" });
      }
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name,
      defaultWorkspace: user.defaultWorkspace?.toString?.() ?? null,
      defaultBoard: user.defaultBoard?.toString?.() ?? null,
    };
    // NOTE: req.userDocument is a lean POJO — callers needing Mongoose methods
    // should fetch the full document explicitly.
    req.userDocument = user;

    return next();
  } catch (error) {
    logger.warn("Auth middleware rejected request", {
      error: error?.message,
    });
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * Invalidate the auth user cache for a specific user.
 * Call after password change, role change, or profile update.
 */
export const invalidateUserCache = (userId) => {
  userCache.del(String(userId));
};

export default auth;
