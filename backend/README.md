# Backend

This package powers the NotesBoard API — notes, notebooks, boards, workspaces, real-time collaboration, analytics, and publishing.

## Environment

Copy `.env.example` to `.env` and configure the following variables before running any scripts:

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | Connection string for the primary MongoDB deployment. |
| `MONGO_DB` | Optional database name override when the URI does not embed one. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Secrets for signing JWT tokens. |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_MS` | Access and refresh token lifetimes. |
| `PASSWORD_RESET_URL` | Base URL used in password reset emails. |
| `NODE_ENV` | Set to `production` in production environments. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis credentials for distributed rate limiting. Falls back to a pass-through limiter when absent. |
| `NOTEBOOK_ANALYTICS_SNAPSHOT_DAYS` | (Optional) Overrides how many days the snapshot cron ingests per run. |
| `NOTEBOOK_ANALYTICS_SEED_OWNER_EMAIL` | (Optional) Default owner email for analytics fixture seeding. |
| `NOTEBOOK_ANALYTICS_SEED_OWNER_NAME` | (Optional) Display name for the seed owner account. |
| `NOTEBOOK_ANALYTICS_SEED_OWNER_PASSWORD` | (Optional) Password used when the seed owner account is auto-created. |
| `NOTEBOOK_ANALYTICS_SEED_NOTEBOOK_NAME` | (Optional) Custom label for the synthetic analytics notebook. |
| `NOTEBOOK_ANALYTICS_SEED_DAYS` | (Optional) Days of history that the seeding script will generate. |
| `NOTEBOOK_ANALYTICS_SEED_NOTES_PER_DAY` | (Optional) Notes created per day during seeding. |
| `DISABLE_ANALYTICS_CRON` | (Optional) Set to `true` to disable the scheduled snapshot cron job. |

## Scripts

Run scripts from the backend package using `npm run <script>`:

- `dev` – start the API in watch mode (tsx).
- `start` – start the API without hot reload.
- `build` – compile TypeScript to JavaScript.
- `typecheck` – run `tsc --noEmit` for type checking only.
- `test` – execute the full Vitest suite.
- `test:analytics` – run analytics-focused unit and smoke tests only.
- `collab` – start the real-time collaboration server standalone.
- `bootstrap-owner` – create or update the initial admin owner account.
- `backfill-notebook-members` – populate the `NotebookMember` collection for existing notebooks.
- `analytics-snapshots` – generate or warm notebook analytics snapshots; accepts `--days=<n>` and `--warm=7d,30d`.
- `seed-analytics-fixtures` – populate a high-volume analytics dataset. Options include `--owner=<email>`, `--owner-name=<name>`, `--owner-password=<password>`, `--notebook=<name>`, `--days=<n>`, and `--per-day=<n>`.

Example: `npm run seed-analytics-fixtures -- --owner=analytics@example.com --days=120 --per-day=10`

## Architecture

```
src/
├── app.js                   Express application setup (middleware, routes)
├── server.js                HTTP + WebSocket server bootstrap, graceful shutdown
├── collab/                  Real-time collaboration server (Hocuspocus / Y.js)
├── config/                  Database, environment, Upstash rate-limit config
├── controllers/             Request handlers (auth, notes, notebooks, boards, workspaces, etc.)
├── middleware/              Auth, rate limiting, validation, error handling, analytics context
├── models/                  Mongoose schemas (17 models)
├── routes/                  Express route definitions
├── scripts/                 CLI scripts (bootstrap, backfill, seed, snapshots)
├── services/                Business logic (analytics, caching, recommendations, undo, sync)
├── tasks/                   Background workers (analytics snapshots scheduler, notebook indexing)
└── utils/                   Shared utilities (tokens, logger, mailer, text analytics, validators)
```

### Key Models

| Model | Purpose |
| --- | --- |
| `User` | Authentication, refresh tokens, email verification, custom note ordering |
| `Workspace` | Multi-tenant workspace with embedded members |
| `Board` | Grouping entity within a workspace |
| `Notebook` | Note container with ordering, publishing, offline sync |
| `Note` | Individual note (title, content, rich content, tags, pinning) |
| `NoteCollaborator` | Per-note sharing/permissions |
| `NoteHistory` | Audit log for note-level events |
| `NotebookMember` | Notebook-level membership and roles |
| `NotebookEvent` | Notebook-level event log |
| `NotebookAnalyticsSnapshot` | Pre-computed daily analytics snapshots |
| `NotebookIndex` | TF-IDF vector index for notebook recommendations |
| `NotebookTemplate` | Reusable notebook templates with embedded notes |
| `NotebookPublication` | Published HTML snapshots of notebooks |
| `NotebookSyncState` | Offline sync state per user/client |
| `SavedNotebookQuery` | User-saved analytics query configurations |
| `ShareLink` | Tokenized share links for boards and notebooks |
| `CollabDocument` | Y.js collaboration document state |

## API Routes

### Authentication (`/api/auth`)
- `POST /register` – create account
- `POST /login` – authenticate and receive tokens
- `POST /refresh` – rotate access token
- `POST /logout` – invalidate session
- `POST /password/forgot` – request password reset email
- `POST /password/reset` – reset password with token
- `POST /verify-email/resend` – resend verification email
- `GET /verify-email` – verify email with token
- `GET /me` – current user profile
- `PUT /me` – update profile (name, email)
- `PUT /me/password` – change password

### Notes (`/api/notes`)
- `GET /` – list notes (supports `boardId`, `notebookId` query filters)
- `POST /` – create note
- `GET /:id` – get note by ID
- `PUT /:id` – update note
- `DELETE /:id` – delete note
- `POST /bulk` – bulk operations (move, delete, tag, archive)
- `GET /tags/stats` – tag usage statistics
- `GET /layout` – get custom note ordering
- `PUT /layout` – update custom note ordering

### Notebooks (`/api/notebooks`)
- `GET /` – list notebooks
- `POST /` – create notebook
- `GET /:id` – get notebook
- `PUT /:id` – update notebook
- `DELETE /:id` – delete notebook
- Full sub-routes for: members, analytics, sync, publishing, share links, saved queries, events, undo

### Notebook Analytics (`/api/notebooks/:id/analytics`)
- `GET /` – aggregate overview metrics
- `GET /activity` – daily creation trend data
- `GET /tags` – tag leaderboard for the selected range
- `GET /collaborators` – collaborator role breakdown
- `GET /snapshots` – raw snapshot series including coverage metadata

Supply the `range` query parameter using shared values from `shared/analyticsTypes.js` (`7d`, `30d`, `90d`, `365d`).

### Boards (`/api/boards`)
- `GET /` – list boards across user workspaces
- `POST /` – create board
- `PUT /:id` – update board
- `DELETE /:id` – delete board

### Workspaces (`/api/workspaces`)
- `GET /` – list user workspaces
- `POST /` – create workspace
- `GET /:id/members` – list workspace members
- `POST /:id/members` – invite member

### Notebook Templates (`/api/notebook-templates`)
- `GET /` – list templates
- `POST /` – create template from notebook
- `GET /:id` – get template details
- `PUT /:id` – update template
- `DELETE /:id` – delete template
- `POST /:id/instantiate` – create notebook from template

### Published Notebooks (`/api/published`)
- `GET /notebooks/:slug` – view published notebook (public, no auth)

## Caching Strategy

The backend uses a two-tier caching approach:

1. **Auth middleware cache** – 30-second TTL in-memory cache for user lookups, keyed by user ID. Eliminates a MongoDB query on every authenticated request. Invalidated on profile or password changes.

2. **Analytics cache** – 60–120 second TTL for computed analytics responses. Cache keys include notebook ID, range, and viewer context to prevent cross-user data leaks.

3. **Request-level memoization** – `req.analyticsMemo` map deduplicates DB calls within a single request lifecycle.

4. **Route middleware cache** – optional `cacheService.middleware(ttl)` for Express routes. Keys include user identity to prevent leaking data across sessions.

## Rate Limiting

Rate limiting is powered by Upstash Redis (distributed) with an in-process fallback.

- Applied globally to all `/api` routes.
- Keys are bucketed by **route pattern** (not full URL) to prevent per-ID bucket dilution on REST endpoints.
- Returns standard `X-RateLimit-*` response headers.
- Fails open on limiter errors to avoid blocking legitimate traffic.

## Real-Time Collaboration

The collaboration server (`src/collab/server.js`) uses Hocuspocus with Y.js for conflict-free real-time editing:

- WebSocket upgrade from the same HTTP server.
- JWT-authenticated connections.
- Persists Y.js document state to MongoDB via `CollabDocument`.
- Tracks presence/awareness for cursor positions.
- Writes note history entries on document changes.

## Background Tasks

### Analytics Snapshot Scheduler (`tasks/analyticsSnapshotScheduler.js`)
- Configurable cron schedule (default: periodic).
- Iterates notebooks via cursor-based streaming to control memory.
- Runs 5 parallel aggregation sub-queries per notebook snapshot.
- Automatic retention pruning of old snapshots.
- Can be disabled via `DISABLE_ANALYTICS_CRON`.

### Notebook Indexing Worker (`tasks/notebookIndexingWorker.js`)
- Watches MongoDB change streams on the `Note` collection.
- Builds TF-IDF vectors for notebook recommendation/search.
- Sequential queue processing to avoid overwhelming the database.
- Periodic backfill cron for stale/missing indexes.

## Graceful Shutdown

The server handles `SIGTERM`, `SIGINT`, `uncaughtException`, and `unhandledRejection`:

1. Stops the analytics snapshot scheduler.
2. Stops the notebook indexing worker.
3. Closes the HTTP server (drains in-flight requests).
4. Disconnects from MongoDB.
5. Exits with appropriate code.

A `isShuttingDown` flag prevents duplicate shutdown attempts from concurrent signals.

## Security

- **Helmet** – security headers including CSP in production.
- **CORS** – configured per environment.
- **JWT** – access tokens (short-lived) + refresh tokens (HTTP-only cookie).
- **bcrypt** – password hashing with cost factor 12.
- **Token hashing** – share link tokens, password reset tokens, and email verification tokens are SHA-256 hashed before storage.
- **Input validation** – express-validator rules on all mutation endpoints with bounded limits (max tags: 20, max pagination: 100, max note content lengths).

## Database Indexes

All models define comprehensive indexes. Key patterns:

- **Compound indexes** for common query + sort patterns (e.g., `{ owner: 1, updatedAt: -1 }`, `{ notebookId: 1, createdAt: -1 }`).
- **Unique constraints** on business keys (`email`, `notebookId + date`, `notebookId + userId`).
- **Sparse indexes** for optional unique fields (`docName`, `inviteTokenHash`, `passwordReset.token`, `emailVerification.token`).
- **Text indexes** on `Note` for full-text search (`title`, `content`).
- **TTL index** on `ShareLink.expiresAt` for automatic cleanup of expired share links.
- **Partial indexes** where applicable (e.g., `publicSlug` only for published notebooks).

## Testing

Vitest powers the backend test suite:

- `npm run test` – full test suite.
- `npm run test:analytics` – analytics-focused unit, integration, and performance tests.

Key test files:
- `tests/auth.notes.e2e.test.js` – end-to-end auth + notes integration.
- `tests/note.validation.test.js` – note validation rules.
- `tests/notebook.analytics.controller.test.js` – analytics controller.
- `tests/notebook.analytics.service.test.js` – analytics service logic.
- `tests/notebook.analytics.performance.test.js` – high-volume performance budget verification.
- `tests/notebook.savedQueries.controller.test.js` – saved query CRUD.
- `tests/notebook.undo.service.test.js` – undo/event-sourcing service.

Uses `mongodb-memory-server` for isolated test databases.

## Performance Audit Summary

The following performance improvements have been applied and/or documented:

### Applied Fixes

| Area | Fix |
| --- | --- |
| **Auth middleware** | Added 30s in-memory user cache with `.lean()` + `.select()` projection. Eliminates a full User document fetch on every authenticated request. Exported `invalidateUserCache()` for mutation paths. |
| **Rate limiter** | Changed key strategy from `req.originalUrl` (per-URL) to `req.route.path` (per-pattern). Prevents bucket dilution on REST routes with dynamic IDs. |
| **Cache service** | Route cache middleware key now includes `req.user.id` to prevent cross-user data leaks on authenticated routes. |
| **Analytics cache** | Cache key includes viewer context (user ID + workspace ID) to prevent cross-user data leaks. |
| **Graceful shutdown** | Server now closes `httpServer` before disconnecting DB, allowing in-flight requests to drain. Added `isShuttingDown` guard against duplicate shutdown. |
| **Duplicate shutdown handlers** | Removed `SIGINT`/`SIGTERM` handlers from `database.js` that raced with `server.js` shutdown flow. |
| **User model indexes** | Added sparse indexes on `passwordReset.token` and `emailVerification.token` for O(1) token lookups. |
| **ShareLink indexes** | Added compound indexes `{ boardId, revokedAt }` and `{ notebookId, revokedAt }` for active-link queries. Added TTL index on `expiresAt` for automatic expired-link cleanup. |
| **Stale partial index** | Replaced `NotebookAnalyticsSnapshot`'s frozen-date partial index with a simple descending index. The original date was evaluated once at startup and became useless after 180 days. |
| **Notes controller** | Parallelized `NotebookMember` + `NoteCollaborator` lookups in `getAllNotes`. Added `.select({ richContent: 0 })` to exclude heavy fields from list responses. |
| **Templates controller** | Added `.select()` on `listNotebookTemplates` to exclude embedded notes array. Replaced sequential `Note.create()` loop with `Note.insertMany()` in template instantiation. |
| **Sync controller** | Parallelized note fetch and sync state lookup. Added `.select({ richContent: 0 })` projection. |
| **Auth controller** | `updateProfile` and `changePassword` now fetch full Mongoose documents directly (accommodating lean auth middleware), with cache invalidation after saves. |

### Known Issues (Documented for Future Work)

| # | Severity | Area | Issue |
| --- | --- | --- | --- |
| 1 | Medium | `notebookAnalyticsService.js` | `resolveLastActivity` performs expensive `$lookup` + `$unwind` across all note history. Consider adding a `lastEditedAt` field on `Note`. |
| 2 | Medium | `notebookAnalyticsSnapshotService.js` | `$lookup` runs before `$match` in collaborator/history aggregations — reversing join direction would reduce work. |
| 3 | Medium | `collab/server.js` | `onChange` and `onAwarenessUpdate` write to DB on every keystroke/cursor move with no debouncing. Should batch writes on a 2–5s interval. |
| 4 | Medium | `collab/server.js` | No `maxConnections` or `maxPayload` on the WebSocket server. |
| 5 | Medium | `notebookUndoService.js` | Sequential `Note.updateOne` in `restoreNotebook` loop — should use `bulkWrite`. |
| 6 | Medium | `analyticsSnapshotScheduler.js` | Iterates all notebooks sequentially with no concurrency control. Should process 5–10 in parallel with `p-limit`. |
| 7 | Medium | `notebookIndexingWorker.js` | Change stream triggers indexing on every Note change with no debounce/cooldown window. |
| 8 | Low | Auth routes | No route-level rate limiting on `/login`, `/register`, `/password/forgot` — abuse-prone public endpoints. Global limiter applies but stricter per-route limits are recommended. |
| 9 | Low | Published routes | `GET /notebooks/:slug` is unauthenticated with no rate limiting or slug validation. |
| 10 | Low | `notesController.js` | `getAllNotes` has no pagination — returns all matching notes in one response. Add cursor or offset pagination. |
| 11 | Low | `cacheService.js` | `NodeCache` has no max-key limit — memory can grow unbounded in long-running processes. |
| 12 | Low | `Workspace.members` | Embedded member array is unbounded — should be extracted to a `WorkspaceMember` collection at scale. |
| 13 | Low | Redundant indexes | ~10 single-field indexes are left-prefix subsets of existing compound indexes and can be dropped to reclaim RAM and write throughput. |
| 14 | Low | `config/db.js` | Dead code — duplicate connection module without pool settings or retry logic. Safe to remove. |
