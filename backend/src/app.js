import "./config/env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

import notesRoutes from "./routes/notesRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import notebookRoutes from "./routes/notebookRoutes.js";
import notebookTemplateRoutes from "./routes/notebookTemplateRoutes.js";
import publishedRoutes from "./routes/publishedRoutes.js";
import rateLimiter from "./middleware/rateLimiter.js";
import requestLogger from "./middleware/requestLogger.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import logger from "./utils/logger.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "../../");
const dist = path.join(ROOT, "frontend", "dist");

const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const frontendOrigin = process.env.FRONTEND_ORIGIN;
if (frontendOrigin) {
  allowedOrigins.push(frontendOrigin);
}

const collabSources = new Set(["ws://localhost:6001", "wss://localhost:6001"]);

if (process.env.COLLAB_WS_URL) {
  collabSources.add(process.env.COLLAB_WS_URL);
}

const publicHost = process.env.PUBLIC_HOST;
if (publicHost) {
  collabSources.add(`wss://${publicHost}/collab`);
}

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  imgSrc: ["'self'", "data:", "blob:", "https://bg.ibelick.com"],
  connectSrc: ["'self'", ...collabSources],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
  workerSrc: ["'self'"],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
};

app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: cspDirectives,
        }
      : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      cb(null, allowedOrigins.includes(origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Request logging (only in development or when explicitly enabled)
if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_REQUEST_LOGGING === "true"
) {
  app.use(requestLogger);
}

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, timestamp: new Date().toISOString() })
);

app.use("/api", rateLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/notebooks", notebookRoutes);
app.use("/api/templates", notebookTemplateRoutes);
app.use("/api/published", publishedRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(dist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).send("Not Found");
    }

    res.sendFile(path.join(dist, "index.html"));
  });
}

// 404 handler for undefined API routes
app.use("/api/*", notFound);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
