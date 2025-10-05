// server.js (or backend/src/server.js)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import notesRoutes from "./routes/notesRoutes.js";
import { connectDb } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "../../");
const distPath = path.join(ROOT_DIR, "frontend", "dist");

app.use(express.json());

// CORS only in dev
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: "http://localhost:5173" }));
}

// ✅ Rate limiter ONLY for API, and only if configured
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
if (hasUpstash) {
  app.use("/api", rateLimiter);
} else {
  console.warn("Rate limiter disabled: UPSTASH env vars missing");
}

// API routes FIRST
app.use("/api/notes", notesRoutes);

// Serve built frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).send("Not Found");
    res.sendFile(path.join(distPath, "index.html"));
  });
}

connectDb().then(() => {
  app.listen(PORT, () => console.log("Server started on", PORT));
});
