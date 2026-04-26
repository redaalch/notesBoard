import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compression from "vite-plugin-compression";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getVendorChunkName(id: string): string | null {
  if (!id.includes("node_modules")) return null;

  const isPackage = (pkg: string) =>
    id.includes(`/node_modules/${pkg}/`) ||
    id.includes(`/node_modules/.pnpm/${pkg}@`);

  if (isPackage("react") || isPackage("react-dom") || isPackage("scheduler")) {
    return "vendor-react";
  }

  if (id.includes("react-router") || id.includes("@remix-run/router")) {
    return "vendor-router";
  }

  if (id.includes("@tanstack/")) {
    return "vendor-query";
  }

  if (id.includes("sonner")) {
    return "vendor-sonner";
  }

  if (
    id.includes("@hocuspocus/") ||
    id.includes("y-prosemirror") ||
    id.includes("y-protocols") ||
    id.includes("y-indexeddb") ||
    id.includes("lib0") ||
    (id.includes("yjs") && !id.includes("highlight.js")) ||
    id.includes("@tiptap/extension-collaboration")
  ) {
    return "vendor-editor-collab";
  }

  if (
    id.includes("highlight.js") ||
    id.includes("lowlight") ||
    id.includes("@tiptap/extension-code-block-lowlight")
  ) {
    return "vendor-editor-highlight";
  }

  if (
    id.includes("@tiptap/") ||
    id.includes("prosemirror-") ||
    id.includes("tippy.js")
  ) {
    return "vendor-editor-core";
  }

  if (id.includes("framer-motion") || id.includes("motion")) {
    return "vendor-motion";
  }

  if (id.includes("@dnd-kit/")) {
    return "vendor-dnd";
  }

  if (id.includes("lucide-react")) {
    return "vendor-icons";
  }

  return "vendor-misc";
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: "gzip", threshold: 1024, deleteOriginFile: false }),
    compression({ algorithm: "brotliCompress", threshold: 1024, deleteOriginFile: false, ext: ".br" }),
  ],
  build: {
    sourcemap: "hidden",
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          return getVendorChunkName(id);
        },
      },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
