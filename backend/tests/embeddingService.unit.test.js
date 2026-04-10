import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const loadEmbeddingService = async () => {
  vi.resetModules();
  return import("../src/services/embeddingService.js");
};

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: "production" };
  delete process.env.EMBEDDING_PROVIDER;
  delete process.env.EMBEDDING_MODEL;
  delete process.env.EMBEDDING_DIMENSIONS;
  delete process.env.EMBEDDING_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("embeddingService module init", () => {
  it("loads without throwing when embeddings are disabled", async () => {
    const service = await loadEmbeddingService();

    expect(service.EMBEDDING_DIMENSIONS).toBe(3072);
    expect(service.isEmbeddingEnabled()).toBe(false);
  });

  it("uses the configured provider model when deriving dimensions", async () => {
    process.env.EMBEDDING_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.GROQ_EMBEDDING_MODEL = "nomic-embed-text-v1.5";

    const service = await loadEmbeddingService();

    expect(service.EMBEDDING_DIMENSIONS).toBe(768);
    expect(service.isEmbeddingEnabled()).toBe(true);
  });
});
