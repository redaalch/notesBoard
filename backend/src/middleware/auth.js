import User from "../models/User.js";
import { verifyAccessToken } from "../utils/tokenService.js";
import logger from "../utils/logger.js";
import { extractBearerToken } from "../utils/http.js";

const auth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      defaultWorkspace: user.defaultWorkspace?.toString?.() ?? null,
      defaultBoard: user.defaultBoard?.toString?.() ?? null,
    };
    req.userDocument = user;

    return next();
  } catch (error) {
    logger.warn("Auth middleware rejected request", {
      error: error?.message,
    });
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export default auth;
