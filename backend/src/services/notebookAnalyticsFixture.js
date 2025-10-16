import mongoose from "mongoose";

import Notebook from "../models/Notebook.js";
import Note from "../models/Note.js";
import NoteHistory from "../models/NoteHistory.js";
import NotebookMember from "../models/NotebookMember.js";
import NoteCollaborator from "../models/NoteCollaborator.js";
import { addUtcDays, startOfUtcDay } from "./notebookAnalyticsShared.js";

const DEFAULT_TAGS = [
  "analytics",
  "ops",
  "research",
  "product",
  "retro",
  "growth",
];

/**
 * Seeds a high-volume dataset designed to validate notebook analytics behaviour.
 * @param {Object} options
 * @param {mongoose.Types.ObjectId} [options.ownerId]
 * @param {string} [options.notebookName]
 * @param {number} [options.days]
 * @param {number} [options.notesPerDay]
 * @param {string[]} [options.tags]
 * @returns {Promise<{ notebook: import("../models/Notebook.js").default, ownerId: mongoose.Types.ObjectId, noteCount: number, historyCount: number }>}
 */
export const seedNotebookAnalyticsDataset = async ({
  ownerId = new mongoose.Types.ObjectId(),
  notebookName = "Analytics Validation",
  days = 90,
  notesPerDay = 12,
  tags = DEFAULT_TAGS,
} = {}) => {
  const baseDate = startOfUtcDay(new Date());
  const notebook = await Notebook.create({
    owner: ownerId,
    name: notebookName,
  });

  const ownerMembership = new NotebookMember({
    notebookId: notebook._id,
    userId: ownerId,
    role: "owner",
    status: "active",
    invitedBy: ownerId,
    invitedAt: baseDate,
    acceptedAt: baseDate,
  });
  ownerMembership.setInviteToken(null);
  await ownerMembership.save();

  const notes = [];
  const histories = [];
  const collaborators = [];
  const workspaceId = new mongoose.Types.ObjectId();
  const boardId = new mongoose.Types.ObjectId();

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const createdAt = addUtcDays(baseDate, -dayOffset);
    for (let noteIndex = 0; noteIndex < notesPerDay; noteIndex += 1) {
      const noteId = new mongoose.Types.ObjectId();
      const tagSampleSize = Math.max(
        1,
        Math.min(tags.length, (noteIndex % 3) + 1)
      );
      const tagSlice = tags.slice(0, tagSampleSize);
      const title = `Auto note ${dayOffset + 1}-${noteIndex + 1}`;
      const content = `Synthetic analytics payload for ${title}`;

      notes.push({
        _id: noteId,
        owner: ownerId,
        notebookId: notebook._id,
        title,
        content,
        contentText: content,
        tags: tagSlice,
        docName: `note:${noteId.toString()}`,
        createdAt,
        updatedAt: createdAt,
      });

      if (noteIndex % 4 === 0) {
        const historyDate = new Date(createdAt);
        historyDate.setUTCHours(12, 0, 0, 0);
        histories.push({
          noteId,
          workspaceId,
          boardId,
          actorId: ownerId,
          eventType: "edit",
          summary: "Automated analytics fixture edit",
          createdAt: historyDate,
          updatedAt: historyDate,
        });
      }

      if (noteIndex % 5 === 0) {
        const collaboratorId = new mongoose.Types.ObjectId();
        collaborators.push({
          noteId,
          userId: collaboratorId,
          invitedBy: ownerId,
          role: noteIndex % 10 === 0 ? "editor" : "commenter",
          invitedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
  }

  if (notes.length) {
    await Note.insertMany(notes, { ordered: false });
  }
  if (histories.length) {
    await NoteHistory.insertMany(histories, { ordered: false });
  }
  if (collaborators.length) {
    await NoteCollaborator.insertMany(collaborators, { ordered: false });
  }

  return {
    notebook,
    ownerId,
    noteCount: notes.length,
    historyCount: histories.length,
  };
};

export default {
  seedNotebookAnalyticsDataset,
};
