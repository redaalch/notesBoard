import User from "../models/User.js";
import { verifyAccessToken } from "../utils/tokenService.js";
import logger from "../utils/logger.js";
import { extractBearerToken } from "../utils/http.js";
import NodeCache from "node-cache";

// Short-lived cache to avoid hitting MongoDB on every authenticated request.
// TTL 30s balances freshness vs eliminating redundant DB lookups.
const userCache = new NodeCache({
  stdTTL: 30,
  checkperiod: 15,
  useClones: false,
});

const USER_PROJECTION = "name email role defaultWorkspace defaultBoard";

const auth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
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
