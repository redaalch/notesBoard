import rateLimit from "../config/upstash.js";
import logger from "../utils/logger.js";

const rateLimiter = async (req, res, next) => {
  const clientId = req.user?.id ?? req.ip ?? "anon";
  const routeKey = req.baseUrl || req.originalUrl || "unknown";
  const identifier = `rate:${clientId}:${routeKey}`;

  try {
    const { success, limit, remaining, reset } = await rateLimit.limit(
      identifier
    );

    if (typeof limit !== "undefined") {
      res.setHeader("X-RateLimit-Limit", String(limit));
    }

    if (typeof remaining !== "undefined") {
      res.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(remaining ?? 0, 0))
      );
    }

    if (reset) {
      res.setHeader("X-RateLimit-Reset", String(reset));
    }

    if (!success) {
      logger.warn("Rate limit exceeded", {
        clientId,
        route: routeKey,
        limit,
        remaining,
        reset,
      });

      return res.status(429).json({
        message: "Too many requests. Please slow down and try again shortly.",
      });
    }
    next();
  } catch (error) {
    logger.error("Rate limiter failure", {
      error: error?.message,
      stack: error?.stack,
      clientId,
      route: routeKey,
      identifier,
    });
    next();
  }
};
export default rateLimiter;
