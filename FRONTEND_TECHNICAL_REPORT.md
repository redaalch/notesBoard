# Frontend Technical Report

Date: 2026-04-19

Scope: `frontend/`

Method: repository audit, targeted file review, and validation runs on the current branch state.

Validated commands:

- `npm run lint`
- `npm run test -- --run`
- `npm run build`
- `npx tsc -p frontend/tsconfig.json --noEmit`
- `npm run perf:bundle:report`
- `npm run perf:budget:check`

---

## 1. Executive Summary

The NotesBoard frontend is now in a materially better state than the previous audit.

Previously reported correctness and integration gaps have been fixed:

- offline sync is mounted into the runtime
- service worker bootstrapping is no longer destructive in production
- the service worker now handles the offline manager's `PRECACHE_URLS` message
- ESLint now covers `ts` and `tsx`
- the `HomePage` test suite is aligned with the current dashboard shell
- the `NoteDetailPage` typing regression is fixed
- the broken design-token aliases are corrected

Current delivery status:

- lint passes
- all 117 frontend tests pass
- production build succeeds
- standalone TypeScript typecheck succeeds

The main remaining concerns have shifted away from correctness and toward performance and maintainability:

1. bundle budgets are currently failing
2. the build still emits a circular manual-chunk warning
3. several core modules remain very large
4. offline sync is wired internally, but its status is not yet surfaced anywhere in the UI
5. Lighthouse artifacts are stale relative to the current branch state

Overall assessment:

- Product maturity: high
- Runtime correctness: good
- Quality gate health: good
- Performance readiness: moderate risk
- Maintainability trajectory: moderate risk

---

## 2. What Changed Since The Previous Audit

### 2.1 Runtime and Offline Improvements

The root runtime now mounts `OfflineSyncProvider` in `frontend/src/main.tsx`, which means offline sync initialization is no longer dead code.

The service worker bootstrap is now handled through `syncServiceWorkerRegistration()` in `frontend/src/lib/serviceWorkerLifecycle.ts` instead of unregistering every service worker and deleting all caches on every page load.

The service worker in `frontend/public/sw.js` now supports the `PRECACHE_URLS` message used by `frontend/src/lib/offlineSyncManager.ts`.

Impact:

- offline infrastructure is now actually live in the app runtime
- production boot is safer and more stable
- the offline manager and service worker now speak the same protocol

### 2.2 Tooling and Quality Improvements

`frontend/eslint.config.js` now includes a dedicated `ts`/`tsx` block using `typescript-eslint`, so lint coverage is real instead of JS-only.

`frontend/src/pages/__tests__/HomePage.test.tsx` now renders `HomePage` inside an auth context and reflects the current dashboard-first UI instead of the older sidebar/navbar assumptions.

`frontend/src/pages/NoteDetailPage.tsx` now types `richContent` correctly on the local snapshot shape, clearing the previous `tsc` failure.

### 2.3 Styling Token Cleanup

The Tailwind token aliases in `frontend/tailwind.config.js` now point at defined CSS variables, and paragraph text in `frontend/src/index.css` uses a valid text token.

Impact:

- theme mappings are consistent again
- the earlier silent token fallbacks are gone

---

## 3. Current Frontend Snapshot

### 3.1 Stack

- React 19
- Vite 7
- TypeScript
- React Router 7
- TanStack Query 5
- Tailwind CSS + DaisyUI
- Framer Motion
- TipTap
- Yjs + Hocuspocus
- IndexedDB via `idb`
- `@dnd-kit`
- Sonner

### 3.2 Runtime Shell

The app boots from `frontend/src/main.tsx` with:

- `BrowserRouter`
- `QueryClientProvider`
- `OfflineSyncProvider`
- `AuthProvider`
- `CommandPaletteProvider`
- global toaster
- PWA install prompt

This is now a cleaner representation of the product's actual capabilities than in the earlier audit.

### 3.3 Functional Areas Present

- authentication and session restoration
- notes and notebooks management
- dashboard shell and dashboard analytics widgets
- drag-and-drop note layout
- notebook sharing, publishing, history, and analytics
- collaborative rich-text editing
- AI summaries and tag suggestions
- offline queueing and replay infrastructure
- PWA install support

---

## 4. Validation Snapshot

### 4.1 Command Results

- `npm run lint`: passed
- `npm run test -- --run`: passed
- `npm run build`: passed
- `npx tsc -p frontend/tsconfig.json --noEmit`: passed
- `npm run perf:bundle:report`: passed
- `npm run perf:budget:check`: failed

### 4.2 Test Status

Current frontend test status:

- 10 test files
- 117 passing tests
- 0 failing tests

The previously failing `HomePage` tests are now green.

### 4.3 Performance Status

Bundle budgets are still failing against `frontend/perf-budgets.json`:

- total JS: `1484.67 KB` vs budget `1475 KB`
- total CSS: `212.93 KB` vs budget `210 KB`
- entry JS: `40.68 KB` vs budget `30 KB`

Current largest artifacts from `frontend/perf-reports/bundle-report.md`:

- `vendor-editor-core`: `319.67 KB`
- `index` CSS: `208.75 KB`
- `vendor-react`: `187.95 KB`
- `vendor-editor-collab`: `176.65 KB`
- `vendor-misc`: `96.46 KB`
- entry chunk `index-vJX_G2qs.js`: `40.68 KB`

The build also still emits this warning:

- circular chunk: `index -> vendor-react -> index`

---

## 5. Architecture Strengths

### 5.1 App Structure

The route shell remains solid:

- route-level lazy loading in `frontend/src/App.tsx`
- auth-gated routes through `RequireAuth`
- `SkipToContent` for keyboard users
- `LazyMotion` usage to keep motion setup light

### 5.2 Security Posture

The frontend security model is still one of the stronger areas:

- access token kept in memory instead of `localStorage`
- refresh-token session restoration in `AuthContext`
- safe redirect handling
- defensive API error sanitization
- restricted production API base URL handling

### 5.3 Dashboard System

The dashboard implementation is now better isolated than much of the legacy notes surface:

- `DashboardShell`
- `DashboardSidebar`
- `DashboardTopbar`
- `TweaksPanel`
- `ActivityHeatmap`
- dashboard-specific stylesheet

That separation is good, even though the older `HomePage` surface still carries a large amount of responsibility.

---

## 6. Maintainability Snapshot

### 6.1 Module Counts

- TypeScript/TSX source files: 132
- TSX files: 96
- top-level page files: 17
- top-level component files: 48
- top-level hooks: 9
- top-level lib modules: 14
- top-level contexts: 5
- test files: 10

### 6.2 Largest Files

Largest frontend source files by line count:

| File | Lines |
| --- | ---: |
| `frontend/src/pages/HomePage.tsx` | 2852 |
| `frontend/src/pages/NoteDetailPage.tsx` | 1385 |
| `frontend/src/Components/NotebookAnalyticsDialog.tsx` | 899 |
| `frontend/src/Components/NotebookShareDialog.tsx` | 893 |
| `frontend/src/lib/offlineSyncManager.ts` | 858 |
| `frontend/src/Components/Navbar.tsx` | 749 |
| `frontend/src/pages/LandingPage.tsx` | 748 |
| `frontend/src/Components/Sidebar.tsx` | 678 |
| `frontend/src/pages/DashboardPage.tsx` | 676 |
| `frontend/src/lib/noteTemplates.ts` | 591 |

Interpretation:

- The frontend is feature-rich and operationally sound.
- Complexity is now the bigger long-term risk than failing correctness checks.
- `HomePage.tsx` remains the clearest refactor candidate.

---

## 7. Remaining Issues To Fix

### 7.1 Performance Budgets Are Currently Failing

This is the most important remaining frontend issue.

Evidence:

- `frontend/perf-budgets.json` sets `1475 KB` total JS, `210 KB` total CSS, and `30 KB` entry JS budgets.
- The current bundle report is over all three limits.
- `npm run perf:budget:check` reports failures for total JS, total CSS, and entry JS.

Likely contributing factors:

- `frontend/src/main.tsx` imports both `index.css` and `dashboard-shell.css` globally, so dashboard styling is paid for on every route.
- The root entry now includes offline sync runtime setup through `OfflineSyncProvider` and service worker registration logic.
- The Vite chunking strategy still leaves a relatively large `index` entry chunk.

This is an inference from the current import graph and bundle report, not a fully traced flame graph.

### 7.2 Circular Chunk Warning Still Exists

`frontend/vite.config.ts` still uses `onlyExplicitManualChunks: true` with a manual vendor split strategy, and the current production build still warns about:

- `index -> vendor-react -> index`

This is not a hard failure, but it is a real signal that the chunking strategy needs another pass.

### 7.3 Lighthouse Verification Is Stale

The stored Lighthouse summary in `frontend/perf-reports/lighthouse-summary.json` is dated `2026-03-22`, which predates the current branch state.

That means:

- the bundle budget check is current
- the Lighthouse metrics are not current

The app may still perform well in practice, but the repository does not yet contain up-to-date Lighthouse evidence for the current frontend.

### 7.4 Offline Sync Has No User-Facing Status Surface Yet

Offline sync is now mounted, but `useOfflineSync` has no consumers anywhere in `frontend/src`.

That means queue state, sync progress, and offline errors are not currently surfaced to users. The runtime is wired, but observability is still missing.

### 7.5 Large Modules Still Need Decomposition

The quality gates are green, but several modules remain large enough to slow future iteration:

- `HomePage.tsx`
- `NoteDetailPage.tsx`
- `NotebookAnalyticsDialog.tsx`
- `NotebookShareDialog.tsx`
- `offlineSyncManager.ts`

This is now a maintainability concern more than an immediate bug risk.

---

## 8. Recommended Next Fixes

### Priority 1: Bring Perf Budgets Back Under Threshold

Suggested sequence:

1. route-split or conditionalize `dashboard-shell.css` so non-dashboard routes do not pay for it
2. audit what moved into the root `index` entry chunk and defer non-critical boot logic where possible
3. re-evaluate the current vendor chunk strategy in `vite.config.ts`
4. re-run bundle report and budget check after each change

### Priority 2: Re-run Lighthouse On The Current Branch

After performance changes:

1. run `npm run perf:lighthouse`
2. compare against the existing March baseline
3. decide whether to update `perf-budgets.json` or reduce bundle size further

### Priority 3: Surface Offline Sync State In The UI

Recommended first version:

- queue length indicator
- syncing / offline badge
- last sync timestamp
- retry or manual sync control

This would make the newly mounted offline infrastructure observable and supportable.

### Priority 4: Decompose The Largest Screens

Recommended order:

1. `HomePage.tsx`
2. `NoteDetailPage.tsx`
3. notebook analytics / sharing dialogs
4. `offlineSyncManager.ts`

The current frontend is stable enough that this refactor work can now be done from a stronger baseline.

---

## 9. Bottom Line

The frontend has crossed an important threshold:

- the earlier correctness regressions are fixed
- core quality gates are green
- the app shell, auth model, dashboard system, and editor stack are all in good shape

What remains is mostly optimization and maintainability work, not rescue work.

If the next step is release hardening, the highest-value focus should be:

1. performance budgets
2. chunking cleanup
3. fresh Lighthouse verification
4. modularization of the largest files
