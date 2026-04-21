import "./config/env.js";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

import notesRoutes from "./routes/notesRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import notebookRoutes from "./routes/notebookRoutes.js";
import notebookTemplateRoutes from "./routes/notebookTemplateRoutes.js";
import publishedRoutes from "./routes/publishedRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import rateLimiter from "./middleware/rateLimiter.js";
import privateCacheHeaders from "./middleware/privateCacheHeaders.js";
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

const allowedOrigins = [];
if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.push(process.env.FRONTEND_ORIGIN);
}
if (!isProduction) {
  allowedOrigins.push("http://localhost:5173", "http://127.0.0.1:5173");
}

const collabSources = new Set();
if (process.env.COLLAB_WS_URL) {
  collabSources.add(process.env.COLLAB_WS_URL);
}
if (!isProduction) {
  collabSources.add("ws://localhost:6001");
  collabSources.add("wss://localhost:6001");
}

const publicHost = process.env.PUBLIC_HOST;
if (publicHost) {
  collabSources.add(`wss://${publicHost}/collab`);
}

// Generate a per-request nonce for inline styles so we can drop 'unsafe-inline'
// from the CSP style-src directive.  The nonce is exposed to the frontend via
// the `res.locals.cspNonce` property so it can be injected into the HTML shell.
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "https://fonts.googleapis.com",
              (_req, res) => `'nonce-${res.locals.cspNonce}'`,
            ],
            imgSrc: ["'self'", "data:", "blob:", "https://bg.ibelick.com"],
            connectSrc: ["'self'", ...collabSources],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            workerSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  }),
);
// Apply CORS only to API routes. Browser navigation/static asset requests
// (/, favicon, sw.js) usually have no Origin header and should not be blocked.
app.use(
  "/api",
  cors({
    origin: (origin, cb) => {
      // Allow requests without Origin (curl, server-to-server, health checks).
      if (!origin) return cb(null, true);
      cb(null, allowedOrigins.includes(origin));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Compress all HTTP responses (gzip/deflate)
app.use(compression());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// Request logging (only in development or when explicitly enabled)
if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_REQUEST_LOGGING === "true"
) {
  app.use(requestLogger);
}

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, timestamp: new Date().toISOString() }),
);

app.use("/api", rateLimiter);

// Private cache headers + ETag for all GET responses (ensures CDNs never cache user data)
app.use("/api", privateCacheHeaders);

app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/notebooks", notebookRoutes);
app.use("/api/templates", notebookTemplateRoutes);
app.use("/api/published", publishedRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/activity", activityRoutes);

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
