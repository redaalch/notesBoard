# NotesBoard — Agent Guide

Full-stack MERN monorepo: collaborative note-taking platform with real-time editing, notebooks, analytics, and AI features.

## Structure

- `backend/` — Express API server (Node.js 20.x, MongoDB/Mongoose)
- `frontend/` — React 19 + TypeScript UI (Vite, TailwindCSS, DaisyUI)
- `shared/` — Shared TypeScript types (analyticsTypes, notebookOptions)
- `package.json` — Root workspace config

## Stack

- **Backend:** Node.js 20, Express 4, Mongoose 8, JWT (HS256), bcryptjs (12 rounds)
- **Frontend:** React 19, Vite 7, TailwindCSS, DaisyUI, React Query, TipTap editor, Yjs/Hocuspocus (CRDT collab)
- **DB:** MongoDB (via Mongoose), Upstash Redis (rate limiting)
- **AI:** Groq API (Llama 3.3 70B) for summarization/tags, Google Gemini for embeddings
- **Auth:** JWT access tokens + HTTP-only refresh token cookies, max 5 sessions per user

## Domain Model

Access hierarchy: workspace → notebook → note
Roles (descending): owner > admin > editor > commenter > viewer

## Conventions

- **Error handling:** all async handlers wrapped in `asyncHandler()`; centralized `errorHandler` middleware
- **Validation:** express-validator with NoSQL operator stripping (`$`, `.` removed recursively)
- **Caching:** NodeCache in-memory (auth 10s TTL, routes 5min TTL); prefix-based invalidation on mutations
- **Security:** Helmet CSP/HSTS, CORS whitelist, rate limiting (Redis-backed, fail-closed), token size guard (>2KB rejected)
- **Async ops:** fire-and-forget for embeddings/indexing; debounce/throttle for collab awareness and history writes
- **Naming:** files camelCase (`notesController.js`), React components PascalCase (`NoteCard.tsx`)
- **Commits:** conventional commits (feat, fix, refactor, docs)

## Key Commands

```bash
# Root
npm run dev          # start both API and web dev servers
npm run build        # build frontend
npm start            # start API in production

# Backend (cd backend)
npm run dev          # tsx watch mode
npm test             # Vitest
npm run collab       # start collab WebSocket server standalone

# Frontend (cd frontend)
npm run dev          # Vite dev server (port 5173)
npm test             # Vitest
npm run perf:ci      # full performance budget checks
```
