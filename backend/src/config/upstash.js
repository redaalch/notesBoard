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

const WINDOW_RE = /^\d+\s*(s|ms|m|h|d)$/;
const rawWindow = process.env.RATELIMIT_WINDOW || DEFAULT_WINDOW;
const windowDuration = WINDOW_RE.test(rawWindow.trim()) ? rawWindow.trim() : DEFAULT_WINDOW;

let missingConfigWarned = false;

const hasUpstashConfig = REQUIRED_UPSTASH_ENV.every(
  (key) => !!process.env[key]
);

/**
 * Simple in-memory sliding-window rate limiter for dev/test environments.
 * Tracks request timestamps per identifier and enforces the same limits
 * as the production Upstash limiter.
 */
const buildFallbackLimiter = () => {
  const buckets = new Map(); // identifier → [timestamps]
  const WINDOW_MS = 60_000;

  // Periodically prune stale buckets to prevent unbounded growth
  const PRUNE_INTERVAL_MS = 5 * 60_000;
  const pruneTimer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, bucket] of buckets) {
      const filtered = bucket.ts.slice(bucket.head).filter((t) => t > cutoff);
      if (filtered.length === 0) {
        buckets.delete(key);
      } else {
        buckets.set(key, { ts: filtered, head: 0 });
      }
    }
  }, PRUNE_INTERVAL_MS);
  if (pruneTimer.unref) pruneTimer.unref();

  return {
    limit: async (identifier) => {
      const now = Date.now();
      const cutoff = now - WINDOW_MS;
      let bucket = buckets.get(identifier);
      if (!bucket) {
        bucket = { ts: [], head: 0 };
        buckets.set(identifier, bucket);
      }

      // Skip expired entries (O(1) amortised — advances an index instead of shifting)
      while (bucket.head < bucket.ts.length && bucket.ts[bucket.head] <= cutoff) {
        bucket.head++;
      }

      // Compact when more than half the array is dead entries
      if (bucket.head > bucket.ts.length / 2) {
        bucket.ts = bucket.ts.slice(bucket.head);
        bucket.head = 0;
      }

      const active = bucket.ts.length - bucket.head;
      const remaining = Math.max(requestLimit - active - 1, 0);
      const success = active < requestLimit;

      if (success) {
        bucket.ts.push(now);
      }

      return {
        success,
        limit: requestLimit,
        remaining,
        reset: Math.floor((now + WINDOW_MS) / 1000),
      };
    },
  };
};

const buildRateLimiter = () => {
  if (!hasUpstashConfig) {
    const missing = REQUIRED_UPSTASH_ENV.filter((key) => !process.env[key]);

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Upstash rate limiter is required in production. Missing env vars: ${missing.join(", ")}`,
      );
    }

    if (!missingConfigWarned && process.env.NODE_ENV !== "test") {
      logger.warn("Upstash configuration missing; using in-memory fallback", {
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
