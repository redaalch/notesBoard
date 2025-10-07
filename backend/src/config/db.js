// backend/src/config/db.js
import mongoose from "mongoose";
import logger from "../utils/logger.js";

export const connectDb = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing");

  try {
    await mongoose.connect(uri, { dbName: process.env.MONGO_DB || undefined });
    logger.info("Mongo connected", { dbName: process.env.MONGO_DB });
  } catch (error) {
    logger.error("Mongo connect error", {
      error: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
};
