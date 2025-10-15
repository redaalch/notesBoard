// backend/src/server.js
import "./config/env.js";

import http from "http";
import app from "./app.js";
import { dbManager } from "./config/database.js";
import logger from "./utils/logger.js";
import { startCollabServer } from "./collab/server.js";
import {
  scheduleNotebookSnapshotJob,
  stopNotebookSnapshotJob,
} from "./tasks/analyticsSnapshotScheduler.js";

const PORT = process.env.PORT || 5001;

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    stopNotebookSnapshotJob();
    // Close database connection
    await dbManager.disconnect();
    logger.info("Database connection closed");

    // Exit process
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown", { error: error.message });
    process.exit(1);
  }
};

const start = async () => {
  try {
    // Connect to database
    await dbManager.connect();

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Start HTTP server
    await new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(PORT, () => {
        httpServer.off("error", reject);
        logger.info("Server started successfully", {
          port: PORT,
          env: process.env.NODE_ENV || "development",
          nodeVersion: process.version,
        });
        resolve();
      });
    });

    // Start collaboration server
    await startCollabServer({ server: httpServer });

    scheduleNotebookSnapshotJob();

    // Setup graceful shutdown handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception", {
        error: error.message,
        stack: error.stack,
      });
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled promise rejection", {
        reason,
        promise,
      });
      gracefulShutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    logger.error("Server failed to start", {
      message: error?.message,
      stack: error?.stack,
    });
    process.exit(1);
  }
};

start();
