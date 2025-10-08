import "./env.js";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import logger from "../utils/logger.js";

// create a rateLimiter that allows configurable throughput (tests default to 5/min)

const TEST_REQUEST_LIMIT = 5;
const DEFAULT_REQUEST_LIMIT = 100;
const DEFAULT_WINDOW = "60 s";
const REQUIRED_UPSTASH_ENV = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const requestLimit =
  process.env.NODE_ENV === "test"
    ? TEST_REQUEST_LIMIT
    : parsePositiveInt(process.env.RATELIMIT_REQUEST_LIMIT) ??
      DEFAULT_REQUEST_LIMIT;

const windowDuration = process.env.RATELIMIT_WINDOW || DEFAULT_WINDOW;

let missingConfigWarned = false;

const hasUpstashConfig = REQUIRED_UPSTASH_ENV.every(
  (key) => !!process.env[key]
);

const buildFallbackLimiter = () => ({
  limit: async () => ({
    success: true,
    limit: requestLimit,
    remaining: requestLimit,
    reset: Math.floor(Date.now() / 1000) + 60,
  }),
});

const buildRateLimiter = () => {
  if (!hasUpstashConfig) {
    if (!missingConfigWarned && process.env.NODE_ENV !== "test") {
      const missing = REQUIRED_UPSTASH_ENV.filter((key) => !process.env[key]);
      logger.warn("Upstash configuration missing; rate limiting disabled", {
        missing,
      });
    }
    missingConfigWarned = true;
    return buildFallbackLimiter();
  }

  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requestLimit, windowDuration),
  });
};

const rateLimit = buildRateLimiter();

export default rateLimit;
