// backend/src/config/db.js
import mongoose from "mongoose";
export const connectDb = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing");
  try {
    await mongoose.connect(uri, { dbName: process.env.MONGO_DB || undefined });
    console.log("Mongo connected");
  } catch (err) {
    console.error("Mongo connect error:", err);
    throw err;
  }
};
