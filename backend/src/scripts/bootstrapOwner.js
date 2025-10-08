#!/usr/bin/env node
import mongoose from "mongoose";

import { connectDb } from "../config/db.js";
import Note from "../models/Note.js";
import User from "../models/User.js";
import "../config/env.js";

const REQUIRED_ENVS = [
  "MONGO_URI",
  "MONGO_DB",
  "BOOTSTRAP_USER_EMAIL",
  "BOOTSTRAP_USER_NAME",
  "BOOTSTRAP_USER_PASSWORD",
];

const ensureEnv = () => {
  const missing = REQUIRED_ENVS.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }
};

const run = async () => {
  ensureEnv();
  await connectDb();

  const email = process.env.BOOTSTRAP_USER_EMAIL.toLowerCase().trim();
  const name = process.env.BOOTSTRAP_USER_NAME.trim();
  const password = process.env.BOOTSTRAP_USER_PASSWORD;

  let user = await User.findOne({ email });
  if (!user) {
    user = new User({
      name,
      email,
      passwordHash: "temp",
      role: "admin",
    });
    await user.setPassword(password);
    await user.save();
    console.log(`Created bootstrap user ${email}`);
  } else {
    console.log(`Using existing user ${email}`);
  }

  const result = await Note.updateMany(
    { owner: { $exists: false } },
    { $set: { owner: user._id } }
  );

  console.log(
    `Updated ${
      result.modifiedCount
    } notes to assign owner ${user._id.toString()}`
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Bootstrap script failed", error);
  process.exit(1);
});
