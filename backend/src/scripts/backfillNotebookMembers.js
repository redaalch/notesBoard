#!/usr/bin/env node
import mongoose from "mongoose";

import { connectDb } from "../config/db.js";
import Notebook from "../models/Notebook.js";
import NotebookMember from "../models/NotebookMember.js";
import "../config/env.js";

const run = async () => {
  await connectDb();

  const cursor = Notebook.find({}, { _id: 1, owner: 1, createdAt: 1 }).cursor();
  let processed = 0;
  let created = 0;

  for await (const notebook of cursor) {
    processed += 1;

    if (!notebook?.owner) {
      continue;
    }

    const existing = await NotebookMember.findOne({
      notebookId: notebook._id,
      userId: notebook.owner,
    })
      .select({ _id: 1 })
      .lean();

    if (existing) {
      continue;
    }

    await NotebookMember.create({
      notebookId: notebook._id,
      userId: notebook.owner,
      role: "owner",
      status: "active",
      invitedBy: notebook.owner,
      invitedAt: notebook.createdAt ?? new Date(),
      acceptedAt: notebook.createdAt ?? new Date(),
      metadata: new Map([["backfilled", true]]),
    });

    created += 1;
  }

  console.log(
    `Processed ${processed} notebooks. Created ${created} owner memberships.`
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Notebook member backfill failed", error);
  process.exit(1);
});
