import dotenv from "dotenv";

let loaded = false;

const REQUIRED_IN_PRODUCTION = [
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "FRONTEND_ORIGIN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

const RECOMMENDED = [
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "FRONTEND_ORIGIN",
];

export const loadEnv = () => {
  if (loaded) {
    return;
  }

  const result = dotenv.config();
  if (result.error && process.env.NODE_ENV !== "test") {
    console.warn("[env] Failed to load .env file", {
      error: result.error.message,
    });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test";

  if (isProduction) {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
    if (missing.length) {
      throw new Error(
        `Missing required environment variables for production: ${missing.join(", ")}`,
      );
    }
  } else if (!isTest) {
    const missing = RECOMMENDED.filter((key) => !process.env[key]);
    if (missing.length) {
      console.warn(
        `[env] Recommended environment variables not set: ${missing.join(", ")}. Using fallback defaults.`,
      );
    }
  }

  loaded = true;
};

loadEnv();
