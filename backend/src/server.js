// backend/src/server.js
import "./config/env.js";

import app from "./app.js";
import { connectDb } from "./config/db.js";
import logger from "./utils/logger.js";

const PORT = process.env.PORT || 5001;

const start = async () => {
  try {
    await connectDb();
    app.listen(PORT, () => logger.info("Server started", { port: PORT }));
  } catch (error) {
    logger.error("Server failed to start", {
      message: error?.message,
      stack: error?.stack,
    });
    process.exit(1);
  }
};

start();
