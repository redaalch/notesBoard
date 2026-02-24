import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setupTests.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/Components/**/*.{js,jsx,ts,tsx}"],
    },
    clearMocks: true,
  },
});
