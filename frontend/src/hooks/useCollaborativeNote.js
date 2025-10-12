import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { Awareness } from "y-protocols/awareness";
import useAuth from "./useAuth.js";

const resolveCollabUrl = () => {
  const explicitUrl = import.meta.env.VITE_COLLAB_SERVER_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const rawPath = import.meta.env.VITE_COLLAB_PATH || "/collab";
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  const buildUrl = (baseUrl) => {
    try {
      const url = new URL(baseUrl);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = path;
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  };

  const candidates = [];

  const apiBase =
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");
  candidates.push(apiBase);

  if (typeof window !== "undefined" && window.location?.origin) {
    candidates.push(window.location.origin);
  }

  if (import.meta.env.DEV) {
    candidates.push("http://localhost:5001");
  }

  candidates.push("http://localhost");

  for (const candidate of candidates) {
    const resolved = buildUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return `ws://localhost:5001${path}`;
};

const DEFAULT_COLLAB_URL = resolveCollabUrl();

const decodeJWT = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const buildInitialNode = (note) => {
  if (!note) {
    return null;
  }
  if (note.richContent) {
    return note.richContent;
  }

  const text = typeof note.content === "string" ? note.content : "";

  // Split text by line breaks and create separate paragraphs
  if (text) {
    const lines = text.split(/\r?\n/);
    const paragraphs = lines.map((line) => ({
      type: "paragraph",
      content: line.trim()
        ? [
            {
              type: "text",
              text: line,
            },
          ]
        : [],
    }));

    return {
      type: "doc",
      content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }],
    };
  }

  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
};

const hashColor = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  const colors = [
    "#6366F1",
    "#EC4899",
    "#F97316",
    "#10B981",
    "#14B8A6",
    "#8B5CF6",
    "#0EA5E9",
    "#F59E0B",
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const useCollaborativeNote = (noteId, note) => {
  const { accessToken, user, refresh } = useAuth();
  const providerRef = useRef(null);
  const docRef = useRef(null);
  const awarenessRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const [status, setStatus] = useState("connecting");
  const [participants, setParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);

  const color = useMemo(() => {
    const source = user?.id ?? "anonymous";
    return hashColor(source);
  }, [user?.id]);

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!accessToken || !refresh) {
      return undefined;
    }

    const payload = decodeJWT(accessToken);
    if (!payload?.exp) {
      return undefined;
    }

    const expiresAt = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Refresh 2 minutes before expiration, or immediately if already expired
    const refreshIn = Math.max(0, timeUntilExpiry - 2 * 60 * 1000);

    if (import.meta.env.DEV) {
      console.debug("[useCollaborativeNote] Token refresh scheduled", {
        expiresIn: Math.round(timeUntilExpiry / 1000 / 60),
        refreshIn: Math.round(refreshIn / 1000 / 60),
      });
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const newToken = await refresh();
        if (newToken && providerRef.current) {
          // Update provider with new token
          providerRef.current.configuration.token = newToken;
          if (import.meta.env.DEV) {
            console.debug(
              "[useCollaborativeNote] Token refreshed successfully"
            );
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("[useCollaborativeNote] Token refresh failed:", error);
        }
      }
    }, refreshIn);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [accessToken, refresh]);

  useEffect(() => {
    if (!noteId || !user || !accessToken) {
      return undefined;
    }

    const yDoc = new Y.Doc();
    const awareness = new Awareness(yDoc);
    const provider = new HocuspocusProvider({
      url: DEFAULT_COLLAB_URL,
      name: `note:${noteId}`,
      document: yDoc,
      token: accessToken,
      awareness,
      onAuthenticationFailed: ({ reason }) => {
        if (import.meta.env.DEV) {
          console.warn(
            "[HocuspocusProvider] Auth failed - token may be expired:",
            reason
          );
        }
      },
      onClose: ({ event }) => {
        // Only log unexpected closures in dev mode
        if (import.meta.env.DEV && event.code !== 1000 && event.code !== 1001) {
          console.warn("[HocuspocusProvider] Connection closed:", {
            code: event.code,
            reason: event.reason,
          });
        }
      },
    });

    providerRef.current = provider;
    docRef.current = yDoc;
    awarenessRef.current = awareness;

    const handleStatus = ({ status: nextStatus }) => {
      setStatus(nextStatus);
    };

    const emitParticipants = () => {
      const states = [];
      const typing = [];
      const now = Date.now();

      awareness.getStates().forEach((state) => {
        if (state?.user?.id) {
          states.push(state.user);

          // Check if user is typing (last activity within 3 seconds)
          if (
            state.typing &&
            state.lastTyping &&
            now - state.lastTyping < 3000 &&
            state.user.id !== user?.id // Exclude current user
          ) {
            typing.push(state.user);
          }
        }
      });

      // Use queueMicrotask to defer state update and avoid setState during render
      queueMicrotask(() => {
        setParticipants(states);
        setTypingUsers(typing);
      });
    };

    provider.on("status", handleStatus);
    awareness.on("update", emitParticipants);

    awareness.setLocalStateField("user", {
      id: user.id,
      name: user.name,
      color,
    });
    emitParticipants();

    const applyInitialContent = () => {
      if (!note) return;
      const fragment = yDoc.getXmlFragment("default");
      if (fragment.length !== 0) {
        return;
      }
      const initialNode = buildInitialNode(note);
      if (!initialNode) {
        return;
      }

      const seedDoc = TiptapTransformer.toYdoc(initialNode, "default");
      const update = Y.encodeStateAsUpdate(seedDoc);
      Y.applyUpdate(yDoc, update);
    };

    const handleSynced = ({ state: isSynced }) => {
      if (isSynced) {
        applyInitialContent();
      }
    };

    provider.on("synced", handleSynced);

    return () => {
      provider.off("status", handleStatus);
      awareness.off("update", emitParticipants);
      provider.off("synced", handleSynced);
      provider.destroy();
      yDoc.destroy();
    };
  }, [noteId, user, accessToken, color, note]);

  useEffect(() => {
    if (awarenessRef.current && user) {
      awarenessRef.current.setLocalStateField("user", {
        id: user.id,
        name: user.name,
        color,
      });
    }
  }, [user, color]);

  const signalTyping = () => {
    if (awarenessRef.current && user) {
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set typing state
      awarenessRef.current.setLocalStateField("typing", true);
      awarenessRef.current.setLocalStateField("lastTyping", Date.now());

      // Clear typing state after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (awarenessRef.current) {
          awarenessRef.current.setLocalStateField("typing", false);
        }
      }, 3000);
    }
  };

  return {
    provider: providerRef.current,
    doc: docRef.current,
    status,
    participants,
    typingUsers,
    color,
    signalTyping,
  };
};

export default useCollaborativeNote;
