import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

//create a rateLimiter that allows configurable throughput (tests default to 5/min)
dotenv.config();

const TEST_REQUEST_LIMIT = 5;
const DEFAULT_REQUEST_LIMIT = 100;
const DEFAULT_WINDOW = "60 s";

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

const rateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(requestLimit, windowDuration),
});
export default rateLimit;
