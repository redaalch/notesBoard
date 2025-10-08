import dotenv from "dotenv";

let loaded = false;

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

  loaded = true;
};

loadEnv();
