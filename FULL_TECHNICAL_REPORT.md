# NotesBoard Full Technical Report

Generated: 2026-04-19

Scope:
- Monorepo root
- backend/
- frontend/
- shared/

Method:
- Direct source inspection across runtime, routes, controllers, models, middleware, services, tasks, and key docs/config.
- Canonical tracked-file inventory from git list (289 tracked files).
- Current working tree state included (modified/untracked files).

---

## 1) Repository Profile

### 1.1 Monorepo layout

- Root package: npm workspaces for backend, frontend, shared.
- Backend: Node.js + Express + Mongoose API, real-time collaboration, analytics, AI integrations.
- Frontend: React 19 + Vite + TypeScript SPA with offline sync and PWA features.
- Shared: cross-package contracts (analytics ranges/types and notebook option enums).

### 1.2 File inventory summary (tracked)

- Total tracked files: 289
- Top-level distribution:
  - frontend: 160
  - backend: 115
  - shared: 5
  - root/meta: 9
- Extension profile:
  - 113 .js
  - 96 .tsx
  - 39 .ts
  - 12 .json
  - 7 .mjs
  - 6 .md
  - plus css/svg/webmanifest/yml/png/html

### 1.3 Complexity hotspots (line count)

Largest non-lockfile sources include:
- frontend/src/pages/HomePage.tsx (2852)
- backend/src/controllers/notesController.js (1778)
- frontend/src/pages/NoteDetailPage.tsx (1385)
- backend/src/controllers/notebooksController.js (1355)
- backend/src/controllers/authController.js (1038)
- frontend/src/Components/NotebookAnalyticsDialog.tsx (899)
- frontend/src/Components/NotebookShareDialog.tsx (893)
- frontend/src/lib/offlineSyncManager.ts (858)

---

## 2) End-to-End Architecture

## 2.1 High-level flow

1. Browser loads SPA shell.
2. Frontend tries session restore via POST /api/auth/refresh (HTTP-only refresh cookie).
3. Access token is held in-memory and attached as Bearer token to API calls.
4. Express API validates JWT and resolves workspace/notebook/note access.
5. Controllers execute domain logic; models enforce schema/index constraints.
6. Background side-effects fire: note history, embeddings, notebook indexing jobs, analytics snapshots.
7. For collaborative notes, Hocuspocus/Yjs syncs real-time updates over WebSocket.
8. Frontend offline layer queues mutations in IndexedDB when offline and replays/syncs on reconnect.

## 2.2 Core domains

- Identity and sessions
- Workspace membership and roles
- Notebook ownership/members/share links/publication
- Notes and note collaboration
- Analytics and snapshots
- Offline synchronization and conflict handling
- AI-assisted features (summaries, tags, embeddings, transcription)

---

## 3) Backend Deep Dive

## 3.1 Runtime bootstrap and middleware chain

Boot files:
- backend/src/server.js
- backend/src/app.js

Behavior:
- Loads env, connects MongoDB, starts HTTP server, mounts collab server.
- Schedules analytics snapshot job and notebook indexing worker.
- Global graceful shutdown for SIGTERM/SIGINT/uncaughtException/unhandledRejection.

Middleware order (app.js):
1. CSP nonce generation.
2. Helmet (strict CSP in production, HSTS, referrer policy).
3. CORS (API-scoped, whitelist, credentials enabled).
4. Compression.
5. JSON/urlencoded parsers + cookie parser.
6. Optional request logger.
7. Health endpoint.
8. Global rate limiter for /api.
9. Private cache headers for /api GETs.
10. Route mounts.
11. API 404 handler.
12. Global error handler.

## 3.2 Configuration and infrastructure

- Environment policy in backend/src/config/env.js:
  - Required in production: MONGO_URI, JWT_ACCESS_SECRET, FRONTEND_ORIGIN, Upstash creds.
- Mongo connection manager in backend/src/config/database.js:
  - retry logic, pool sizing, event handlers.
- Upstash/fallback rate limiting in backend/src/config/upstash.js:
  - production requires Upstash config; dev/test can use in-memory fallback.

## 3.3 Authentication and session security

Core files:
- backend/src/controllers/authController.js
- backend/src/middleware/auth.js
- backend/src/utils/tokenService.js

Design:
- Access token: JWT bearer, short-lived.
- Refresh token: random secret, hashed in DB, stored in HTTP-only cookie.
- Max active refresh sessions per user: 5.
- Email verification and password reset tokens are hashed before storage.

Important behaviors:
- Cookie security auto-detect + env override.
- Password strength enforcement.
- Session rotation on refresh.
- passwordChangedAt invalidates old access tokens.
- profile/password changes clear refresh sessions and re-issue session.

## 3.4 Access-control model

Core file:
- backend/src/utils/access.js

Role hierarchy and checks:
- Workspace roles: owner/admin/editor/commenter/viewer.
- Notebook member roles: owner/editor/viewer (active status required).
- Note collaborator roles: editor/commenter/viewer.

Resolution strategy:
- For notes, effective permissions combine owner + workspace membership + notebook membership + note collaborator role.
- Edit/manage rights are resolved with clear role sets.
- Owner fast-path avoids extra DB lookups.

## 3.5 API route map

Mounted route groups:
- /api/auth
- /api/notes
- /api/notebooks
- /api/templates
- /api/workspaces
- /api/ai
- /api/activity
- /api/published

### Auth
- POST /register
- POST /login
- POST /refresh
- POST /logout
- POST /password/forgot
- POST /password/reset
- POST /verify-email
- POST /verify-email/resend
- GET /me
- PUT /profile
- POST /password/change

### Notes
- GET /
- GET /layout
- PUT /layout
- GET /tags/stats
- GET /trash
- DELETE /trash
- POST /trash/:id/restore
- DELETE /trash/:id
- GET /search
- POST /bulk
- GET /:id/history
- GET /:id/collaborators
- POST /:id/collaborators
- DELETE /:id/collaborators/:collaboratorId
- GET /:id/publish
- POST /:id/publish
- DELETE /:id/publish
- GET /:id
- POST /
- PUT /:id
- DELETE /:id

### Notebooks
- POST /import
- GET /recommendations
- GET /smart
- GET /
- POST /
- POST /:id/templates
- POST /invitations/accept
- Members/invitations/share links management routes
- Analytics routes:
  - GET /:id/analytics
  - GET /:id/analytics/activity
  - GET /:id/analytics/tags
  - GET /:id/analytics/collaborators
  - GET /:id/analytics/snapshots
- Notebook CRUD + move + export
- History/undo routes
- Offline sync routes:
  - GET /:id/sync
  - POST /:id/sync
- Publishing routes:
  - GET /:id/publish
  - POST /:id/publish
  - DELETE /:id/publish
- Saved query routes:
  - GET /:id/saved-queries
  - POST /:id/saved-queries
  - PATCH /:id/saved-queries/:queryId
  - DELETE /:id/saved-queries/:queryId
  - POST /:id/saved-queries/:queryId/use

### Templates
- GET /
- GET /:id
- POST /:id/instantiate
- DELETE /:id

### Workspaces
- GET /
- GET /:workspaceId/members
- POST /:workspaceId/members
- GET /:workspaceId/predictions

### AI
- GET /status
- POST /notes/:id/summary
- POST /notes/:id/suggest-tags
- POST /notes/:id/embed
- PATCH /notes/:id/action-items/:itemId
- POST /generate-template
- POST /transcribe

### Activity
- GET /heatmap

### Public read-only
- GET /published/notebooks/:slug
- GET /published/notes/:slug

## 3.6 Controllers and domain logic

### Notes controller (largest domain orchestrator)

File: backend/src/controllers/notesController.js

Key capabilities:
- Paginated note listing with access filters and collaborator/notebook/workspace visibility.
- create/update/delete note flows with role checks.
- Soft-delete trash lifecycle: list/restore/purge/empty.
- Bulk operations (pin/unpin/delete/addTags/move/moveNotebook) with stricter checks for destructive actions.
- Note history retrieval.
- Custom note layout read/write.
- Search pipeline: semantic vector-first when available, fallback text search.
- Side effects: note history writes, embedding regeneration, notebook indexing queue, route cache invalidation.

### Notebooks controller

File: backend/src/controllers/notebooksController.js

Key capabilities:
- Notebook CRUD with transaction-aware handling (fallback when transactions unsupported).
- Deletion modes (move notes vs delete notes) with cascade cleanup:
  - members, share links, publication docs, index docs, saved queries, note history, collab docs.
- noteOrder management helpers for reorder safety.
- Smart notebook and recommendation endpoints.
- Notebook event history retrieval.
- Undo endpoint with event conflict checks and notebook event replay via notebookUndoService.

### Membership and sharing

Files:
- backend/src/controllers/notebookMembersController.js
- backend/src/controllers/notebookShareLinksController.js
- backend/src/controllers/noteCollaboratorsController.js

Capabilities:
- Notebook invitations with hashed invite tokens + TTL.
- Role assignment and member revocation.
- Last-owner demotion guard.
- Notebook share-link creation/revocation with hashed tokens.
- Note-level collaborator management + collab socket access revocation.

### Publishing

Files:
- backend/src/controllers/notebookPublishingController.js
- backend/src/controllers/notePublishingController.js
- backend/src/controllers/publishedNotebooksController.js
- backend/src/controllers/publishedNotesController.js

Capabilities:
- Publish/unpublish for notebook and note.
- Slug normalization and uniqueness checks.
- Snapshot generation + hash persistence.
- Public routes serve immutable snapshot payloads while confirming current public state.

### Templates/import/export

Files:
- backend/src/controllers/notebookTemplatesController.js
- backend/src/controllers/notebookImportController.js
- backend/src/controllers/notebookExportController.js

Capabilities:
- Export notebook as reusable template with size/count limits.
- Instantiate template into notebook with optional workspace mapping.
- ZIP export bundle with markdown + metadata manifest.
- Import from markdown/zip into notebook + note history creation.

### Sync and analytics

Files:
- backend/src/controllers/notebookSyncController.js
- backend/src/controllers/notebookAnalyticsController.js
- backend/src/controllers/activityController.js
- backend/src/controllers/workspacePredictionsController.js

Capabilities:
- Offline sync state pull and operation push with revision conflict control.
- Operation application: note upsert/delete + notebook order updates.
- Notebook analytics overview/activity/tags/collaborators/snapshots.
- User activity heatmap endpoint.
- Workspace prediction endpoint.

### AI and transcription

Files:
- backend/src/controllers/aiController.js
- backend/src/controllers/transcriptionController.js

Capabilities:
- Summary/action-item generation.
- Tag suggestion.
- On-demand embedding regeneration.
- Action-item completion toggle.
- AI template generation.
- Audio transcription endpoint with MIME validation.

## 3.7 Data model and persistence

### Primary entities

- User: auth profile, hashed password, refresh token sessions, verification/reset state, defaultWorkspace, passwordChangedAt.
- Workspace: owner + embedded members (role/status/activity).
- Notebook: ownership, workspace linkage, note ordering, publication metadata, offline revision/snapshot hash, soft-delete field.
- Note: content, tags, rich content, embeddings, AI outputs, publish flags, soft-delete field.

### Collaboration and sharing entities

- NotebookMember: notebook ACL + invite token lifecycle.
- NoteCollaborator: per-note ACL.
- ShareLink: hashed tokenized links for notebook sharing.
- CollabDocument: persisted Yjs state + awareness.

### History/analytics/index entities

- NoteHistory: note-level audit events + optional snapshots/diffs.
- NotebookEvent: notebook event log with inverse payload for undo.
- NotebookAnalyticsSnapshot: periodic precomputed metrics.
- NotebookIndex: token/tag vector index + job state.
- NotebookSyncState: per-user/client sync cursor and pending ops.
- SavedNotebookQuery: saved query definitions.
- NotebookTemplate: reusable template payload.
- NotePublication / NotebookPublication: public snapshots.

### Indexing patterns

- Compound ownership/query indexes across notes/notebooks/history/events.
- Text index on Note (title+content).
- Partial unique indexes for optional keys (publicSlug, invite token hash).
- TTL indexes for cleanup (trash docs, invite/share links, collab staleness, expirable history/events).

## 3.8 Services and background tasks

### Service layer

Key files:
- notebookAnalyticsService.js
- notebookAnalyticsSnapshotService.js
- notebookRecommendationService.js
- notebookSmartService.js
- notebookUndoService.js
- embeddingService.js
- aiService.js
- transcriptionService.js
- cacheService.js
- productivityPredictionService.js

Responsibilities:
- analytical aggregations and derived metrics.
- recommendation and smart notebook materialization.
- event-based undo execution.
- embedding generation and AI utility flows.
- centralized in-process caching.

### Tasks

Key files:
- tasks/analyticsSnapshotScheduler.js
- tasks/notebookIndexingWorker.js

Responsibilities:
- scheduled notebook analytics snapshots.
- notebook indexing queue + change-driven reindexing.

## 3.9 Real-time collaboration

Core file:
- backend/src/collab/server.js

Architecture:
- Hocuspocus server attached to main HTTP server.
- Authenticated connections (JWT).
- Permission checks on note access/edit.
- Yjs document state persisted in CollabDocument.
- Awareness/presence events recorded and throttled logic for history side effects.

## 3.10 Backend security posture

Implemented controls observed in code:
- Helmet with production CSP and nonce-based inline style support.
- Strict CORS allowlist behavior for API routes.
- JWT verification hardening and token size guard in auth middleware.
- Hashed token storage for reset/verify/share/invite flows.
- Input validation via express-validator across routes.
- Content/tag sanitization and anti-injection checks in Note schema.
- Rate limiting with route-keyed identifiers and fail-closed behavior.
- User-scoped route cache keys to avoid cross-user cache leakage.

---

## 4) Frontend Deep Dive

## 4.1 Boot and provider composition

Entry files:
- frontend/src/main.tsx
- frontend/src/App.tsx

Provider stack:
- BrowserRouter
- QueryClientProvider
- OfflineSyncProvider
- AuthProvider
- CommandPaletteProvider

Routing:
- Lazy-loaded page boundaries for public and protected routes.
- RequireAuth gate on authenticated pages.
- Dedicated published notebook/note routes.

## 4.2 Auth/session client model

Core files:
- frontend/src/contexts/AuthContext.tsx
- frontend/src/lib/axios.ts

Behavior:
- Access token stored in memory, not localStorage.
- Session restoration through /auth/refresh using HTTP-only cookie.
- Axios response interceptor retries once after refresh on 401.
- Profile/password mutation flows update token/user state and clear stale query cache.

## 4.3 Offline architecture

Core files:
- frontend/src/contexts/OfflineSyncContext.tsx
- frontend/src/lib/offlineSyncManager.ts
- frontend/src/lib/offlineDB.ts
- frontend/src/lib/notebookSyncClient.ts

Design:
- IndexedDB stores:
  - response cache
  - notebook cache
  - note cache
  - mutation queue
  - metadata and notebook sync metadata
- While offline:
  - GETs can return cached payloads.
  - writes are queued as offline mutations.
- On reconnect/manual sync:
  - queue is replayed.
  - notebook-aware operations are batched through /notebooks/:id/sync.
  - revision conflicts trigger snapshot refresh.

## 4.4 Service worker and PWA lifecycle

Core files:
- frontend/public/sw.js
- frontend/src/lib/serviceWorkerLifecycle.ts
- frontend/public/manifest.webmanifest

Behavior:
- Static precache and cache versioning.
- Dynamic precache support via postMessage PRECACHE_URLS.
- Cache-first fallback strategy for same-origin static assets.
- API calls are intentionally not cached in service worker.
- In production: register/update service worker.
- In non-production: unregister and clear notesboard-* caches.

## 4.5 Collaboration/editor client

Core file:
- frontend/src/hooks/useCollaborativeNote.ts

Behavior:
- Builds Hocuspocus provider with async token resolver.
- Initializes Y.Doc and Awareness.
- Seeds initial content from note snapshot where needed.
- Tracks participants and typing presence.
- Schedules token refresh before JWT expiry.

## 4.6 UI architecture

Main areas:
- Page layer in frontend/src/pages/
- Component layer in frontend/src/Components/
- Dashboard subsystem in frontend/src/Components/dashboard/
- UI primitives in frontend/src/Components/ui/

Notable design characteristics:
- Large feature-rich HomePage and NoteDetailPage modules.
- Dedicated dialogs/drawers for analytics/history/sharing/templates.
- Command palette and keyboard-shortcut support.
- Mobile navigation components present.

## 4.7 Styling and design system

Core files:
- frontend/src/index.css
- frontend/tailwind.config.js
- frontend/src/styles/dashboard-shell.css

Design system:
- DaisyUI themes notesLight/notesDark.
- CSS variable token system for spacing, typography, colors, shadows, radii.
- Tailwind extensions mapped to CSS variables.
- Custom component utility classes and motion keyframes.

## 4.8 Frontend security posture

Core files:
- frontend/src/lib/sanitize.ts
- frontend/src/lib/safeRedirect.ts
- frontend/src/lib/markdownToHtml.ts
- frontend/src/lib/axios.ts

Controls:
- Hardened HTML sanitization profile for user-rendered content.
- Safe internal redirect guards.
- Escaped markdown-to-HTML transform with constrained formatting.
- API error message hardening helper.
- API base URL trust checks in production.

## 4.9 Tooling, tests, and performance pipeline

Core files:
- frontend/eslint.config.js
- frontend/vitest.config.js
- frontend/vite.config.ts
- frontend/perf-budgets.json
- frontend/scripts/perf/*

Observed:
- ESLint covers JS/TS/TSX.
- Vitest with jsdom setup and coverage config.
- Manual vendor chunk strategy in Vite.
- Perf scripts for baseline, budget checks, Lighthouse, and reports.
- Current budgets are strict and can fail CI if over threshold.

---

## 5) Shared Package

Files:
- shared/analyticsTypes.ts
- shared/analyticsTypes.js
- shared/notebookOptions.ts
- shared/notebookOptions.js
- shared/package.json

Role:
- Source of truth for notebook analytics range constants and analytics contracts.
- Source of allowed notebook color/icon options reused by backend validators and frontend UIs.

---

## 6) Build, Run, and Operations

## 6.1 Root scripts

- npm run dev: concurrent backend+frontend dev servers.
- npm run start: production backend start.
- npm run build: frontend production build.

## 6.2 Backend scripts

- dev/start/test/typecheck
- collab standalone server
- bootstrap/backfill scripts
- analytics snapshot generation and fixture seeding

## 6.3 Frontend scripts

- dev/build/preview/lint/test
- perf baseline/report/budget/lighthouse workflows

---

## 7) Current Working Tree State

The workspace is currently dirty with many modified files and a few untracked files.

Modified highlights include:
- backend runtime/controllers/models/routes/services/tests
- frontend app shell/components/pages/styles/lib/config
- root lockfile

Untracked files at the time of audit:
- FRONTEND_TECHNICAL_REPORT.md
- frontend/src/lib/lineDiff.ts
- frontend/src/lib/noteExport.ts

This report reflects the current workspace state, not only the last committed baseline.

---

## 8) Risks and Recommendations

## 8.1 Highest-value near-term actions

1. Reduce frontend bundle overages against perf budgets.
2. Decompose largest frontend modules (HomePage, NoteDetailPage, analytics/share dialogs).
3. Keep notebook sync/replay observability visible in UI.
4. Expand e2e tests for notebook sharing/publishing/sync conflict paths.
5. Add periodic schema/index health review to avoid index bloat as features evolve.

## 8.2 Positive architecture signals

- Strong access-control layering (workspace/notebook/note).
- Clear event/history model supporting undo.
- Real-time collab integrated with persistent CRDT documents.
- Thoughtful security controls across backend and frontend.
- Shared contracts reduce drift between packages.

---

## 9) Full Tracked File Inventory (289 files)

Canonical source: git tracked files snapshot.

- .github/workflows/ci.yml
- .gitignore
- .vscode/settings.json
- CHANGELOG.md
- README.md
- SECURITY_DECISIONS.md
- backend/.env.example
- backend/.gitignore
- backend/README.md
- backend/package-lock.json
- backend/package.json
- backend/scripts/loginTest.mjs
- backend/scripts/verifySmtp.mjs
- backend/src/app.js
- backend/src/collab/server.js
- backend/src/config/database.js
- backend/src/config/env.js
- backend/src/config/upstash.js
- backend/src/controllers/activityController.js
- backend/src/controllers/aiController.js
- backend/src/controllers/authController.js
- backend/src/controllers/noteCollaboratorsController.js
- backend/src/controllers/notePublishingController.js
- backend/src/controllers/notebookAnalyticsController.js
- backend/src/controllers/notebookExportController.js
- backend/src/controllers/notebookImportController.js
- backend/src/controllers/notebookMembersController.js
- backend/src/controllers/notebookPublishingController.js
- backend/src/controllers/notebookSavedQueriesController.js
- backend/src/controllers/notebookShareLinksController.js
- backend/src/controllers/notebookSyncController.js
- backend/src/controllers/notebookTemplatesController.js
- backend/src/controllers/notebooksController.js
- backend/src/controllers/notesController.js
- backend/src/controllers/publishedNotebooksController.js
- backend/src/controllers/publishedNotesController.js
- backend/src/controllers/transcriptionController.js
- backend/src/controllers/workspacePredictionsController.js
- backend/src/controllers/workspacesController.js
- backend/src/middleware/analyticsContext.js
- backend/src/middleware/asyncHandler.js
- backend/src/middleware/auth.js
- backend/src/middleware/errorHandler.js
- backend/src/middleware/notFound.js
- backend/src/middleware/privateCacheHeaders.js
- backend/src/middleware/rateLimiter.js
- backend/src/middleware/requestLogger.js
- backend/src/middleware/validation.js
- backend/src/models/CollabDocument.js
- backend/src/models/Note.js
- backend/src/models/NoteCollaborator.js
- backend/src/models/NoteHistory.js
- backend/src/models/NotePublication.js
- backend/src/models/Notebook.js
- backend/src/models/NotebookAnalyticsSnapshot.js
- backend/src/models/NotebookEvent.js
- backend/src/models/NotebookIndex.js
- backend/src/models/NotebookMember.js
- backend/src/models/NotebookPublication.js
- backend/src/models/NotebookSyncState.js
- backend/src/models/NotebookTemplate.js
- backend/src/models/SavedNotebookQuery.js
- backend/src/models/ShareLink.js
- backend/src/models/User.js
- backend/src/models/Workspace.js
- backend/src/routes/activityRoutes.js
- backend/src/routes/aiRoutes.js
- backend/src/routes/authRoutes.js
- backend/src/routes/notebookRoutes.js
- backend/src/routes/notebookTemplateRoutes.js
- backend/src/routes/notesRoutes.js
- backend/src/routes/publishedRoutes.js
- backend/src/routes/workspaceRoutes.js
- backend/src/scripts/backfillEmbeddings.js
- backend/src/scripts/backfillNotebookMembers.js
- backend/src/scripts/backfillWorkspaceIds.js
- backend/src/scripts/bootstrapOwner.js
- backend/src/scripts/generateNotebookAnalyticsSnapshots.js
- backend/src/scripts/seedNotebookAnalyticsFixtures.js
- backend/src/server.js
- backend/src/services/aiService.js
- backend/src/services/analyticsService.js
- backend/src/services/cacheService.js
- backend/src/services/embeddingService.js
- backend/src/services/notebookAnalyticsFixture.js
- backend/src/services/notebookAnalyticsService.js
- backend/src/services/notebookAnalyticsShared.js
- backend/src/services/notebookAnalyticsSnapshotService.js
- backend/src/services/notebookEventService.js
- backend/src/services/notebookRecommendationService.js
- backend/src/services/notebookSmartService.js
- backend/src/services/notebookUndoService.js
- backend/src/services/productivityPredictionService.js
- backend/src/services/transcriptionService.js
- backend/src/tasks/analyticsSnapshotScheduler.js
- backend/src/tasks/notebookIndexingWorker.js
- backend/src/utils/access.js
- backend/src/utils/constants.js
- backend/src/utils/http.js
- backend/src/utils/http.ts
- backend/src/utils/logger.js
- backend/src/utils/mailer.js
- backend/src/utils/notebooks.js
- backend/src/utils/slugify.js
- backend/src/utils/textAnalytics.js
- backend/src/utils/tokenService.js
- backend/src/utils/validators.js
- backend/tests/access.unit.test.js
- backend/tests/activity.heatmap.test.js
- backend/tests/auth.notes.e2e.test.js
- backend/tests/embeddingService.unit.test.js
- backend/tests/note.validation.test.js
- backend/tests/notebook.analytics.controller.test.js
- backend/tests/notebook.analytics.performance.test.js
- backend/tests/notebook.analytics.service.test.js
- backend/tests/notebook.savedQueries.controller.test.js
- backend/tests/notebook.undo.service.test.js
- backend/tests/tokenService.unit.test.js
- backend/tests/validators.unit.test.js
- backend/tsconfig.json
- backend/vitest.config.js
- frontend/.env.example
- frontend/.gitignore
- frontend/COMPONENT_SHOWCASE.md
- frontend/DESIGN_SYSTEM.md
- frontend/eslint.config.js
- frontend/index.html
- frontend/package-lock.json
- frontend/package.json
- frontend/perf-budgets.json
- frontend/postcss.config.js
- frontend/public/logo.svg
- frontend/public/manifest.webmanifest
- frontend/public/notesboard-thumbnail.png
- frontend/public/notesboard-thumbnail.svg
- frontend/public/sw.js
- frontend/public/vite.svg
- frontend/scripts/perf/check-budgets.mjs
- frontend/scripts/perf/report-bundles.mjs
- frontend/scripts/perf/run-lighthouse.mjs
- frontend/scripts/perf/update-baseline.mjs
- frontend/scripts/perf/verify-vendor-graph.mjs
- frontend/src/App.tsx
- frontend/src/Components/AiSummaryCard.tsx
- frontend/src/Components/AiTagSuggestions.tsx
- frontend/src/Components/AnimatedButton.tsx
- frontend/src/Components/BulkActionsBar.tsx
- frontend/src/Components/CollaborativeEditor.tsx
- frontend/src/Components/CommandPalette.tsx
- frontend/src/Components/ConfirmDialog.tsx
- frontend/src/Components/EmptyState.tsx
- frontend/src/Components/ErrorState.tsx
- frontend/src/Components/FilterPopover.tsx
- frontend/src/Components/FloatingActionButton.tsx
- frontend/src/Components/KeyboardShortcutsHelp.tsx
- frontend/src/Components/LazyImage.tsx
- frontend/src/Components/Logo.tsx
- frontend/src/Components/MobileBottomNav.tsx
- frontend/src/Components/Navbar.tsx
- frontend/src/Components/NoteCard.tsx
- frontend/src/Components/NoteCollaboratorsCard.tsx
- frontend/src/Components/NoteHistoryDrawer.tsx
- frontend/src/Components/NoteHistoryTimeline.tsx
- frontend/src/Components/NoteSkeleton.tsx
- frontend/src/Components/NotebookAnalyticsDialog.tsx
- frontend/src/Components/NotebookHistoryDialog.tsx
- frontend/src/Components/NotebookInsightsDrawer.tsx
- frontend/src/Components/NotebookPublishDialog.tsx
- frontend/src/Components/NotebookShareDialog.tsx
- frontend/src/Components/NotebookTemplateGalleryModal.tsx
- frontend/src/Components/NotesNotFound.tsx
- frontend/src/Components/NotesStats.tsx
- frontend/src/Components/PageTransition.tsx
- frontend/src/Components/PresenceAvatars.tsx
- frontend/src/Components/PwaInstallPrompt.tsx
- frontend/src/Components/RateLimitedUI.tsx
- frontend/src/Components/RequireAuth.tsx
- frontend/src/Components/SaveNotebookTemplateDialog.tsx
- frontend/src/Components/SavedNotebookQueryDialog.tsx
- frontend/src/Components/Sidebar.tsx
- frontend/src/Components/SimpleEditor.tsx
- frontend/src/Components/Skeleton.tsx
- frontend/src/Components/SkipToContent.tsx
- frontend/src/Components/SlashCommands.tsx
- frontend/src/Components/Sparkline.tsx
- frontend/src/Components/TagInput.tsx
- frontend/src/Components/TemplateGalleryModal.tsx
- frontend/src/Components/Toolbar.tsx
- frontend/src/Components/TypingIndicator.tsx
- frontend/src/Components/VoiceInputButton.tsx
- frontend/src/Components/WorkspaceMembersCard.tsx
- frontend/src/Components/__tests__/NotebookHistoryDialog.test.tsx
- frontend/src/Components/__tests__/NotebookInsightsDrawer.test.tsx
- frontend/src/Components/__tests__/NotebookPublishDialog.test.tsx
- frontend/src/Components/dashboard/ActivityHeatmap.tsx
- frontend/src/Components/dashboard/DashboardShell.tsx
- frontend/src/Components/dashboard/DashboardSidebar.tsx
- frontend/src/Components/dashboard/DashboardTopbar.tsx
- frontend/src/Components/dashboard/TweaksPanel.tsx
- frontend/src/Components/ui/Button.tsx
- frontend/src/Components/ui/Card.tsx
- frontend/src/Components/ui/Chip.tsx
- frontend/src/Components/ui/Container.tsx
- frontend/src/Components/ui/CustomIcons.tsx
- frontend/src/Components/ui/Icon.tsx
- frontend/src/Components/ui/MetricTile.tsx
- frontend/src/Components/ui/Section.tsx
- frontend/src/Components/ui/Stack.tsx
- frontend/src/Components/ui/Surface.tsx
- frontend/src/Components/ui/Tag.tsx
- frontend/src/Components/ui/index.ts
- frontend/src/assets/logo.svg
- frontend/src/contexts/AuthContext.tsx
- frontend/src/contexts/CommandPaletteContext.tsx
- frontend/src/contexts/OfflineSyncContext.tsx
- frontend/src/contexts/__tests__/AuthContext.test.tsx
- frontend/src/contexts/authContext.ts
- frontend/src/contexts/offlineSyncContext.ts
- frontend/src/hooks/__tests__/useNotebookDialogs.test.ts
- frontend/src/hooks/useActivityHeatmap.ts
- frontend/src/hooks/useAiFeatures.ts
- frontend/src/hooks/useAuth.ts
- frontend/src/hooks/useCollaborativeNote.ts
- frontend/src/hooks/useNotebookDialogs.ts
- frontend/src/hooks/useOfflineSync.ts
- frontend/src/hooks/useScrollReveal.ts
- frontend/src/hooks/useSemanticSearch.ts
- frontend/src/hooks/useVoiceInput.ts
- frontend/src/index.css
- frontend/src/lib/Utils.ts
- frontend/src/lib/__tests__/markdownToHtml.test.ts
- frontend/src/lib/__tests__/safeRedirect.test.ts
- frontend/src/lib/__tests__/sanitize.test.ts
- frontend/src/lib/axios.ts
- frontend/src/lib/cn.ts
- frontend/src/lib/lowlight.ts
- frontend/src/lib/markdownToHtml.ts
- frontend/src/lib/noteTemplates.ts
- frontend/src/lib/notebookSyncClient.ts
- frontend/src/lib/offlineDB.ts
- frontend/src/lib/offlineSyncManager.ts
- frontend/src/lib/safeRedirect.ts
- frontend/src/lib/sanitize.ts
- frontend/src/lib/serviceWorkerLifecycle.ts
- frontend/src/main.tsx
- frontend/src/pages/CreatePage.tsx
- frontend/src/pages/DashboardPage.tsx
- frontend/src/pages/ForgotPasswordPage.tsx
- frontend/src/pages/HomePage.tsx
- frontend/src/pages/LandingPage.tsx
- frontend/src/pages/LoginPage.tsx
- frontend/src/pages/NoteDetailPage.tsx
- frontend/src/pages/NotebookInvitePage.tsx
- frontend/src/pages/PrivacyPage.tsx
- frontend/src/pages/ProfilePage.tsx
- frontend/src/pages/RegisterPage.tsx
- frontend/src/pages/ResetPasswordPage.tsx
- frontend/src/pages/TermsPage.tsx
- frontend/src/pages/TrashPage.tsx
- frontend/src/pages/VerifyEmailPage.tsx
- frontend/src/pages/__tests__/HomePage.test.tsx
- frontend/src/pages/home/BulkMoveNotebookDialog.tsx
- frontend/src/pages/home/BulkTagDialog.tsx
- frontend/src/pages/home/HomePageDnD.tsx
- frontend/src/pages/home/NotebookDeleteDialog.tsx
- frontend/src/pages/home/NotebookFormDialog.tsx
- frontend/src/pages/home/__tests__/homePageUtils.test.ts
- frontend/src/pages/home/homePageUtils.ts
- frontend/src/pages/published-note-page.tsx
- frontend/src/pages/published-notebook-page.tsx
- frontend/src/styles/dashboard-shell.css
- frontend/src/styles/editor.css
- frontend/src/test/setupTests.ts
- frontend/src/types/api.ts
- frontend/src/types/icon.ts
- frontend/src/vite-env.d.ts
- frontend/tailwind.config.js
- frontend/tsconfig.json
- frontend/vite-env.d.ts
- frontend/vite.config.ts
- frontend/vitest.config.js
- package-lock.json
- package.json
- shared/analyticsTypes.js
- shared/analyticsTypes.ts
- shared/notebookOptions.js
- shared/notebookOptions.ts
- shared/package.json
- tsconfig.json
