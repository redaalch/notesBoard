import mongoose from "mongoose";
import logger from "../utils/logger.js";

/**
 * MongoDB connection manager with automatic reconnection
 */
class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Connect to MongoDB with retry logic
   */
  async connect() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error("MONGO_URI environment variable is required");
    }

    const options = {
      dbName: process.env.MONGO_DB || "notesBoard",
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip IPv6
    };

    try {
      await mongoose.connect(uri, options);
      this.isConnected = true;
      this.connectionAttempts = 0;

      logger.info("MongoDB connected successfully", {
        database: options.dbName,
        host: mongoose.connection.host,
      });

      this.setupEventHandlers();
    } catch (error) {
      logger.error("MongoDB connection failed", {
        error: error.message,
        attempt: this.connectionAttempts + 1,
      });

      if (this.connectionAttempts < this.maxRetries) {
        this.connectionAttempts++;
        logger.info(`Retrying connection in ${this.retryDelay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }

      throw error;
    }
  }

  /**
   * Setup MongoDB event handlers
   */
  setupEventHandlers() {
    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB connection error", { error: error.message });
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
      this.isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
      this.isConnected = true;
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (this.isConnected) {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed gracefully");
      this.isConnected = false;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
  }
}

// Export singleton instance
export const dbManager = new DatabaseManager();

// Backward compatibility
export const connectDb = () => dbManager.connect();
