# Frontend Optimization Changelog

## 2026-03-22

This changelog records the optimization work completed across Phases 1-6 and captures measurable outcomes plus maintainability trade-offs.

### Baseline vs Current (Bundle)

| Metric         | Baseline (`perf-budgets.json`) | Current (`perf-reports/bundle-report.md`) | Delta |
| -------------- | -----------------------------: | ----------------------------------------: | ----: |
| Total JS (KB)  |                        1488.89 |                                   1492.49 | +3.60 |
| Total CSS (KB) |                         202.90 |                                    202.90 |  0.00 |
| Entry JS (KB)  |                          21.43 |                                     17.69 | -3.74 |
| JS chunks      |                            n/a |                                        46 |   n/a |
| CSS chunks     |                            n/a |                                         2 |   n/a |

### Lighthouse Status

- Current Lighthouse scores in automation are still unstable (`NO_FCP`) in some headless runs.
- CI is now configured for strict mode in Phase 6.2 (`LIGHTHOUSE_STRICT=true`, `PERF_ENFORCE=true`), so this is an active reliability risk until fully stabilized.

### Delivered Changes

- Home page render-path optimization:
  - Grouped high-churn UI state by concern.
  - Staged memoized filtering/sorting selectors.
  - Cached word-count lookups and stabilized child props/callbacks.
  - Added HomePage regression tests for filtering, pagination, and selection/bulk flows.

- Query/cache strategy improvements:
  - Replaced broad invalidation bursts with more targeted invalidation paths.
  - Added optimistic cache updates with rollback for deterministic bulk operations.

- Bundle and asset quick wins:
  - Deferred non-critical UI with `React.lazy` (dialogs, command palette, share collaborator card).
  - Split editor CSS from global payload where possible.
  - Removed duplicate global style token declarations.
  - Moved collaboration libraries into `vendor-editor` to keep `vendor-misc` smaller.
  - Extracted service-worker lifecycle logic from entry path to a lazy-loaded helper.

### Maintainability Trade-offs

- Manual chunking in `vite.config.ts` improves control but increases long-term maintenance cost (dependency drift can affect chunk quality).
- Targeted lazy-loading improves route startup cost but adds more async boundaries and fallback UI states to reason about.
- Optimistic updates improve perceived responsiveness but require careful rollback logic to avoid cache/server drift.
- Strict CI perf enforcement improves guardrails but may increase flaky failures until Lighthouse reliability is fully addressed.

### Experiment Log (Reverted)

- Tested removing `vendor-misc` catch-all to rely on auto-splitting.
  - Result: severe entry regression (`Entry JS` jumped to ~85.6 KB).
  - Action: reverted.

- Tested dynamic importing `yjs` and `@hocuspocus/transformer` in save/revert paths.
  - Result: total JS regression.
  - Action: reverted.

### Next Follow-ups

- Stabilize Lighthouse in CI/headless runs to eliminate `NO_FCP` failures under strict mode.
- Continue monitoring `vendor-editor` growth and consider finer-grained deferred editor/collab loading where safe.
- Keep this changelog updated with each accepted optimization slice and any reverted experiments.
