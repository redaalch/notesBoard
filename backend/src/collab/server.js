import "../config/env.js";
import { Server } from "@hocuspocus/server";
import cors from "cors";
import express from "express";
import { encodeStateAsUpdate } from "yjs";

import { connectDb } from "../config/db.js";
import logger from "../utils/logger.js";
import { verifyAccessToken } from "../utils/tokenService.js";
import CollabDocument from "../models/CollabDocument.js";
import Note from "../models/Note.js";
import NoteHistory from "../models/NoteHistory.js";
import { resolveNoteForUser, touchWorkspaceMember } from "../utils/access.js";

const parseDocumentName = (documentName) => {
  if (typeof documentName !== "string") return null;
  if (documentName.startsWith("note:")) {
    return documentName.slice(5);
  }
  return null;
};

const getTokenFromHeaders = (headers = {}) => {
  const header = headers.authorization || headers.Authorization;
  if (!header || typeof header !== "string") return null;
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
};

const awarenessToPayload = (awareness) => {
  try {
    if (!awareness) return {};
    if (typeof awareness.getStates === "function") {
      return Object.fromEntries(awareness.getStates().entries());
    }
    if (awareness instanceof Map) {
      return Object.fromEntries(awareness.entries());
    }
    if (Array.isArray(awareness)) {
      return Object.fromEntries(awareness);
    }
  } catch (error) {
    logger.warn("Unable to serialize awareness state", {
      message: error?.message,
    });
  }
  return {};
};

const loadNoteForDocument = async (documentName) => {
  const noteId = parseDocumentName(documentName);
  if (!noteId) {
    return null;
  }

  const note = await Note.findOne({ docName: documentName }).lean();
  if (note) {
    return { noteId, note };
  }

  // Fallback to direct lookup if docName not yet persisted
  const fallback = await Note.findById(noteId).lean();
  if (fallback) {
    return { noteId, note: fallback };
  }
  return null;
};

const coerceState = (state, document, logContext) => {
  if (state instanceof Uint8Array) {
    return state;
  }

  if (document) {
    try {
      return encodeStateAsUpdate(document);
    } catch (error) {
      logger.error("Failed to encode document state", {
        ...logContext,
        message: error?.message,
      });
    }
  }

  logger.warn("Unable to coerce document state to Uint8Array", {
    ...logContext,
    stateType: typeof state,
  });
  return null;
};

const allowOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
if (process.env.FRONTEND_ORIGIN) {
  allowOrigins.push(process.env.FRONTEND_ORIGIN);
}

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, allowOrigins.includes(origin));
    },
    methods: ["GET"],
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = Server.configure({
  address: "0.0.0.0",
  name: "notesboard-collab",
  maxDocumentSize: 5 * 1024 * 1024,
  async onAuthenticate(data) {
    const token = data.token || getTokenFromHeaders(data.requestHeaders);
    if (!token) {
      throw new Error("Missing authentication token");
    }

    const payload = verifyAccessToken(token);
    const userId = payload.sub;
    const noteId = parseDocumentName(data.documentName);
    if (!noteId) {
      throw new Error("Invalid document requested");
    }

    const access = await resolveNoteForUser(noteId, userId);
    if (!access) {
      throw new Error("Note access denied");
    }

    if (!access.permissions?.canEdit) {
      throw new Error("Note editing denied");
    }

    if (access.workspaceId) {
      await touchWorkspaceMember(access.workspaceId, userId);
    }

    data.context = {
      userId,
      noteId,
      workspaceId: access.workspaceId,
      boardId: access.boardId,
    };

    return { userId };
  },
  async onLoadDocument({ documentName }) {
    try {
      const stored = await CollabDocument.findOne({
        name: documentName,
      }).lean();
      if (stored?.state) {
        return new Uint8Array(
          stored.state.buffer,
          stored.state.byteOffset,
          stored.state.byteLength
        );
      }
    } catch (error) {
      logger.error("Failed to load collaborative document", {
        documentName,
        message: error?.message,
      });
    }
    return null;
  },
  async onStoreDocument({ documentName, state, document }) {
    try {
      const nextState = coerceState(state, document, { documentName });
      if (!nextState) {
        return;
      }
      await CollabDocument.findOneAndUpdate(
        { name: documentName },
        {
          $set: {
            state: Buffer.from(nextState),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            name: documentName,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      logger.error("Failed to persist collaborative document", {
        documentName,
        message: error?.message,
      });
    }
  },
  async onAwarenessUpdate({ awareness, documentName, context }) {
    try {
      const payload = awarenessToPayload(awareness);
      const participants = Object.values(payload).filter(
        (state) => !!state?.user?.id
      );

      if (context?.workspaceId && participants.length) {
        await Promise.all(
          participants.map((state) =>
            touchWorkspaceMember(context.workspaceId, state.user.id, {
              lastActiveAt: new Date(),
              displayName: state.user.name,
              avatarColor: state.user.color,
            })
          )
        );
      }

      await CollabDocument.findOneAndUpdate(
        { name: documentName },
        {
          $set: {
            awareness: payload,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error("Awareness update failed", {
        documentName,
        message: error?.message,
      });
    }
  },
  async onChange({ documentName, context, state, document, update }) {
    if (!context?.userId) {
      return;
    }
    try {
      const historyState =
        update instanceof Uint8Array
          ? update
          : coerceState(state, document, { documentName, handler: "onChange" });
      if (!historyState) {
        return;
      }
      const noteInfo = await loadNoteForDocument(documentName);
      if (!noteInfo) {
        return;
      }
      await NoteHistory.create({
        noteId: noteInfo.note._id,
        workspaceId: noteInfo.note.workspaceId ?? null,
        boardId: noteInfo.note.boardId ?? null,
        actorId: context.userId,
        eventType: "edit",
        summary: "Edited collaboratively",
        diff: Buffer.from(historyState).toString("base64"),
      });
    } catch (error) {
      logger.error("Failed to append note history from collaboration", {
        documentName,
        message: error?.message,
      });
    }
  },
});

const PORT = Number.parseInt(process.env.COLLAB_SERVER_PORT ?? "6001", 10);

const start = async () => {
  try {
    await connectDb();
    const httpServer = app.listen(PORT, "0.0.0.0", () => {
      logger.info("Collaborative HTTP server running", { port: PORT });
    });

    await server.listen({ server: httpServer });
    logger.info("Collaborative WebSocket server running", { port: PORT });
  } catch (error) {
    logger.error("Collaborative server failed to start", {
      message: error?.message,
      stack: error?.stack,
    });
    process.exit(1);
  }
};

start();
