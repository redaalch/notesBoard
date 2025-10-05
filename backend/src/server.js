// backend/src/server.js
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
const ROOT = path.join(__dirname, "../../");
const dist = path.join(ROOT, "frontend", "dist");

// dev CORS only
const allowed = ["http://localhost:5173", "http://127.0.0.1:5173"];
app.use(
  cors({
    origin: (origin, cb) => {
      // allow tools like curl/Postman (no origin)
      if (!origin) return cb(null, true);
      cb(null, allowed.includes(origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // only if you’ll send cookies
  })
);
app.options("*", cors());
app.use(express.json());
// ✅ Health check (quick way to see server is alive)
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ✅ Rate limiter ONLY if configured, and ONLY for /api
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;
if (hasUpstash) app.use("/api", rateLimiter);

// ✅ API routes FIRST
app.use("/api/notes", notesRoutes);

// serve built frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(dist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).send("Not Found");
    res.sendFile(path.join(dist, "index.html"));
  });
}

// ✅ Global error handler so 500s are visible in logs + JSON to client
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

connectDb().then(() => {
  app.listen(PORT, () => console.log("Server started on", PORT));
});
