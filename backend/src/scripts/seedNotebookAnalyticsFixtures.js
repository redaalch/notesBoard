#!/usr/bin/env node
import mongoose from "mongoose";

import "../config/env.js";
import { connectDb } from "../config/db.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { seedNotebookAnalyticsDataset } from "../services/notebookAnalyticsFixture.js";

const REQUIRED_ENVS = ["MONGO_URI"];

const ensureEnv = () => {
  const missing = REQUIRED_ENVS.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }
};

const parseOptions = () => {
  const options = {
    ownerEmail: process.env.NOTEBOOK_ANALYTICS_SEED_OWNER_EMAIL ?? null,
    ownerName:
      process.env.NOTEBOOK_ANALYTICS_SEED_OWNER_NAME ?? "Analytics Owner",
    ownerPassword:
      process.env.NOTEBOOK_ANALYTICS_SEED_OWNER_PASSWORD ?? "Analytics!234",
    notebookName:
      process.env.NOTEBOOK_ANALYTICS_SEED_NOTEBOOK_NAME ??
      "Analytics Validation",
    days: Number.parseInt(process.env.NOTEBOOK_ANALYTICS_SEED_DAYS ?? "90", 10),
    notesPerDay: Number.parseInt(
      process.env.NOTEBOOK_ANALYTICS_SEED_NOTES_PER_DAY ?? "12",
      10
    ),
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--owner=")) {
      options.ownerEmail = arg.split("=")[1] ?? options.ownerEmail;
    } else if (arg.startsWith("--owner-name=")) {
      options.ownerName = arg.split("=")[1] ?? options.ownerName;
    } else if (arg.startsWith("--owner-password=")) {
      options.ownerPassword = arg.split("=")[1] ?? options.ownerPassword;
    } else if (arg.startsWith("--notebook=")) {
      options.notebookName = arg.split("=")[1] ?? options.notebookName;
    } else if (arg.startsWith("--days=")) {
      options.days = Number.parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--per-day=")) {
      options.notesPerDay = Number.parseInt(arg.split("=")[1], 10);
    }
  });

  if (!Number.isFinite(options.days) || options.days <= 0) {
    options.days = 90;
  }
  if (!Number.isFinite(options.notesPerDay) || options.notesPerDay <= 0) {
    options.notesPerDay = 12;
  }

  return options;
};

const ensureOwnerEmail = (email) => {
  if (!email) {
    console.error(
      "An owner email must be provided via NOTEBOOK_ANALYTICS_SEED_OWNER_EMAIL or --owner=<email>."
    );
    process.exit(1);
  }
};

const resolveOwner = async ({ ownerEmail, ownerName, ownerPassword }) => {
  const normalizedEmail = ownerEmail.toLowerCase().trim();
  let owner = await User.findOne({ email: normalizedEmail });
  if (!owner) {
    owner = new User({
      name: ownerName,
      email: normalizedEmail,
      passwordHash: "temp",
      role: "admin",
    });
    await owner.setPassword(ownerPassword);
    owner.emailVerified = true;
    owner.emailVerifiedAt = new Date();
    await owner.save();
    logger.info("Created analytics seed owner", { email: normalizedEmail });
  } else {
    logger.info("Using existing analytics seed owner", {
      email: normalizedEmail,
      id: owner._id.toString(),
    });
  }
  return owner;
};

const run = async () => {
  ensureEnv();
  const options = parseOptions();
  ensureOwnerEmail(options.ownerEmail);

  await connectDb();

  const owner = await resolveOwner(options);

  const seeded = await seedNotebookAnalyticsDataset({
    ownerId: owner._id,
    notebookName: options.notebookName,
    days: options.days,
    notesPerDay: options.notesPerDay,
  });

  logger.info("Seeded notebook analytics dataset", {
    notebookId: seeded.notebook._id.toString(),
    ownerId: owner._id.toString(),
    notes: seeded.noteCount,
    histories: seeded.historyCount,
    days: options.days,
    notesPerDay: options.notesPerDay,
  });

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  logger.error("Notebook analytics seed script failed", {
    message: error?.message,
    stack: error?.stack,
  });
  mongoose
    .disconnect()
    .catch(() => null)
    .finally(() => process.exit(1));
});
