import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  test: {
    root: ".",
    include: ["tests/**/*.test.{js,ts}"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    clearMocks: true,
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{js,ts}"],
      exclude: ["src/scripts/**"],
    },
  },
});
