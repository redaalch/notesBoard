import "../config/env.js";
import { Server } from "@hocuspocus/server";
import mongoose from "mongoose";
import { WebSocketServer } from "ws";
import { encodeStateAsUpdate } from "yjs";

import { connectDb } from "../config/database.js";
import logger from "../utils/logger.js";
import { verifyAccessToken } from "../utils/tokenService.js";
import CollabDocument from "../models/CollabDocument.js";
import Note from "../models/Note.js";
import NoteHistory from "../models/NoteHistory.js";
import { resolveNoteForUser, touchWorkspaceMember } from "../utils/access.js";

// ── Debounce / throttle helpers ──────────────────────────────────────────────

/**
 * Per-document debounce for awareness DB writes.
 * Buffers the latest payload and flushes after `delay` ms of inactivity.
 */
const AWARENESS_DEBOUNCE_MS = 5_000;
const awarenessTimers = new Map(); // documentName → timeoutId

/**
 * Per-document throttle for NoteHistory creation.
 * At most one history record per `interval` ms per document.
 * Intermediate edits are coalesced — only the latest update is persisted.
 */
const HISTORY_THROTTLE_MS = 30_000;
const historyLastWrite = new Map(); // documentName → timestamp
const historyPending = new Map(); // documentName → { timer, data }

/**
 * Per-document cache for loadNoteForDocument to avoid repeated DB reads
 * on every onChange (which fires per keystroke).
 * Entries expire after 5 minutes.
 */
const NOTE_CACHE_TTL_MS = 5 * 60_000;
const noteInfoCache = new Map(); // documentName → { noteInfo, expiresAt }

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

const collabServer = Server.configure({
  address: "0.0.0.0",
  name: "notesboard-collab",
  maxDocumentSize: 5 * 1024 * 1024,
  async onRequest({ request, response }) {
    if (
      request?.url?.startsWith("/health") ||
      request?.url === "/" ||
      request?.url?.startsWith("/status")
    ) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    }
  },
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
          stored.state.byteLength,
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
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      logger.error("Failed to persist collaborative document", {
        documentName,
        message: error?.message,
      });
    }
  },
  async onAwarenessUpdate({ awareness, documentName, context }) {
    // Debounce: buffer the latest awareness payload and flush once idle.
    // Cursor/selection changes fire many times per second — writing each one
    // to MongoDB is wasteful.  We batch into a single write after 5s of calm.
    const payload = awarenessToPayload(awareness);
    const participants = Object.values(payload).filter(
      (state) => !!state?.user?.id,
    );

    const flush = async () => {
      awarenessTimers.delete(documentName);
      try {
        if (context?.workspaceId && participants.length) {
          await Promise.all(
            participants.map((state) =>
              touchWorkspaceMember(context.workspaceId, state.user.id, {
                lastActiveAt: new Date(),
                displayName: state.user.name,
                avatarColor: state.user.color,
              }),
            ),
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
          { upsert: true },
        );
      } catch (error) {
        logger.error("Awareness update failed", {
          documentName,
          message: error?.message,
        });
      }
    };

    // Clear any pending timer and reschedule
    const existing = awarenessTimers.get(documentName);
    if (existing) clearTimeout(existing);
    awarenessTimers.set(documentName, setTimeout(flush, AWARENESS_DEBOUNCE_MS));
  },
  async onChange({ documentName, context, state, document, update }) {
    if (!context?.userId) {
      return;
    }

    // ── Throttle: at most one NoteHistory record per 30s per document ──────
    // Typing fires onChange per keystroke.  Without throttling, a user typing
    // at 60 WPM creates ~300 history rows/minute.  We coalesce into one write
    // per 30-second window, keeping the latest update.  Some intermediate
    // diffs are intentionally lost — document state is separately persisted
    // via onStoreDocument and the collab Yjs CRDT ensures consistency.
    const now = Date.now();
    const lastWrite = historyLastWrite.get(documentName) ?? 0;
    const elapsed = now - lastWrite;

    const historyState =
      update instanceof Uint8Array
        ? update
        : coerceState(state, document, { documentName, handler: "onChange" });
    if (!historyState) {
      return;
    }

    const writeHistory = async (buf) => {
      try {
        // ── Cached note lookup ────────────────────────────────────────
        let cached = noteInfoCache.get(documentName);
        if (!cached || cached.expiresAt < Date.now()) {
          const noteInfo = await loadNoteForDocument(documentName);
          if (!noteInfo) {
            noteInfoCache.delete(documentName);
            return;
          }
          cached = { noteInfo, expiresAt: Date.now() + NOTE_CACHE_TTL_MS };
          noteInfoCache.set(documentName, cached);
        }
        const { noteInfo } = cached;

        const workspaceId = noteInfo.note.workspaceId ?? context.workspaceId;
        const boardId = noteInfo.note.boardId ?? context.boardId;

        if (!workspaceId || !boardId) {
          logger.warn("Skipping collab history write due to missing context", {
            documentName,
            noteId: String(noteInfo.note._id),
            userId: context.userId,
          });
          return;
        }

        await NoteHistory.create({
          noteId: noteInfo.note._id,
          workspaceId,
          boardId,
          actorId: context.userId,
          eventType: "edit",
          summary: "Edited collaboratively",
          diff: Buffer.from(buf).toString("base64"),
        });
        historyLastWrite.set(documentName, Date.now());
      } catch (error) {
        logger.error("Failed to append note history from collaboration", {
          documentName,
          message: error?.message,
        });
      }
    };

    if (elapsed >= HISTORY_THROTTLE_MS) {
      // Enough time has passed — write immediately
      const pending = historyPending.get(documentName);
      if (pending?.timer) clearTimeout(pending.timer);
      historyPending.delete(documentName);
      await writeHistory(historyState);
    } else {
      // Too soon — schedule a trailing write with the latest update
      const pending = historyPending.get(documentName);
      if (pending?.timer) clearTimeout(pending.timer);
      const delay = HISTORY_THROTTLE_MS - elapsed;
      const timer = setTimeout(() => {
        historyPending.delete(documentName);
        writeHistory(historyState).catch((err) =>
          logger.error("Trailing history write failed", {
            documentName,
            message: err?.message,
          }),
        );
      }, delay);
      historyPending.set(documentName, { timer, data: historyState });
    }
  },
});

export const startCollabServer = async ({
  server,
  path = "/collab",
  port,
} = {}) => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDb();
    }

    if (server) {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const wss = new WebSocketServer({ noServer: true });

      server.on("upgrade", async (request, socket, head) => {
        try {
          const requestUrl = request.url ?? normalizedPath;
          const pathname = new URL(requestUrl, "http://localhost").pathname;
          if (pathname !== normalizedPath) {
            return;
          }

          await collabServer.hooks("onUpgrade", {
            request,
            socket,
            head,
            instance: collabServer,
          });

          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
          });
        } catch (error) {
          socket.destroy();
        }
      });

      wss.on("connection", (ws, request) => {
        collabServer.handleConnection(ws, request);
      });

      logger.info("Collaborative server attached", { path: normalizedPath });
      return collabServer;
    }

    const listenPort =
      port ??
      Number.parseInt(
        process.env.COLLAB_SERVER_PORT ?? process.env.PORT ?? "6001",
        10,
      );

    await collabServer.listen(listenPort, null, { path });
    logger.info("Collaborative server running", { port: listenPort, path });
    return collabServer;
  } catch (error) {
    logger.error("Collaborative server failed to start", {
      message: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
};

const executedDirectly =
  import.meta.url ===
  (typeof process !== "undefined" && process.argv?.[1]
    ? new URL(process.argv[1], "file://").href
    : "");

if (executedDirectly) {
  startCollabServer().catch(() => {
    process.exit(1);
  });
}
