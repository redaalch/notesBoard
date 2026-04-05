# Security Decisions — Accepted Risks

This document records security findings that were reviewed during the April 2026 audit and determined to be non-issues or acceptable risks given the application's architecture.

---

## 1. WebSocket Token Replay

**Finding:** The Hocuspocus collaborative editing server receives the JWT once at connection time (`onAuthenticate`). A stolen token could be replayed to open a WebSocket session until the JWT expires.

**Why this is acceptable:**

- The JWT is short-lived (default 15 minutes). An attacker would need to steal the token and use it before expiry.
- Every connection is authenticated via `verifyAccessToken()` and authorized via `resolveNoteForUser()` — the server verifies the user has `canEdit` permission on the specific note.
- If a user's access is revoked, existing connections are force-closed via `forceCloseConnection()` / `forceCloseConnectionsForUser()` (collab server re-checks permissions on changes).
- WebSocket connections are transport-encrypted (WSS in production). Token theft requires a separate vulnerability (XSS, MITM on plaintext).
- Adding per-message re-authentication would break the Yjs/Hocuspocus protocol and add significant latency to every keystroke sync.

**Mitigation already in place:**
- Short JWT TTL (15m)
- Per-connection auth + permission check
- Force-close on permission revocation
- HTTPS/WSS in production

---

## 2. Offline Sync — No CSRF Token

**Finding:** The offline sync manager (`offlineSyncManager.ts`) replays queued mutations (create/update/delete notes) when the browser comes back online. These requests do not carry a CSRF token.

**Why this is acceptable:**

- All mutating API requests use `Authorization: Bearer <JWT>` headers, not cookies. CSRF attacks exploit cookie-based authentication where the browser auto-attaches credentials. Bearer tokens in the `Authorization` header are never auto-sent by the browser — an attacker's page cannot forge these requests.
- The Axios instance injects the token from in-memory state (`AuthContext`), not from a cookie. A cross-origin page has no way to read or set this header.
- CORS is configured with a strict origin whitelist, blocking cross-origin requests entirely.
- Adding CSRF tokens would add complexity to the offline queue (tokens expire, requiring refresh before replay) without providing meaningful protection given the Bearer-token auth model.

**Mitigation already in place:**
- Bearer token auth (not cookie-based)
- CORS origin whitelist
- Helmet security headers (including `X-Content-Type-Options: nosniff`)

---

*Reviewed: 2026-04-04*
