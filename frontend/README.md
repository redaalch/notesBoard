# NotesBoard Frontend

React + Vite SPA that powers the NotesBoard web client. The app reads shared contracts from `@shared` so analytics responses stay type-safe across packages.

## Getting Started

```bash
npm install
npm run dev
```

### Analytics Feature Flag

Notebook analytics are gated behind `VITE_ENABLE_NOTEBOOK_ANALYTICS=true` in `.env.local`. Restart the dev server after toggling the flag. Range selectors, dialogs, and shared types live in `@shared/analyticsTypes.js`.

## Validation & Tooling

- `npm run lint` – runs ESLint against the entire frontend (including `@shared`).
- `npm run build` – produces an optimized bundle that mirrors production.
- Shared analytics contracts live in `shared/analyticsTypes.js`; import via `@shared/analyticsTypes.js` to avoid drift.

## Lighthouse Workflow

Build a production preview before running Lighthouse to avoid dev-server noise:

```bash
npm run build
npm run preview
npx lighthouse http://localhost:4173 --preset=desktop
```

Use the `--only-categories=performance` flag for quick perf spot checks, or keep the default preset for full reports. Capture reports in CI artifacts or attach them to feature validation checklists.

## Phase 1 Performance Baseline

Phase 1 introduces repeatable baseline artifacts in `frontend/perf-reports/`.

```bash
npm run perf:baseline
```

This command runs a production build, writes bundle size summaries (`bundle-report.json` and `bundle-report.md`), starts a preview server, and generates desktop/mobile Lighthouse reports with a `lighthouse-summary.json` rollup.

To persist the latest run as the tracked baseline in `perf-budgets.json`:

```bash
npm run perf:baseline:update
```

If Lighthouse cannot render a frame in headless environments, the script writes a failure-state summary and continues in non-strict mode. Use strict mode to fail the run:

```bash
LIGHTHOUSE_STRICT=true npm run perf:lighthouse
```

## Performance Budgets

Budgets are defined in `frontend/perf-budgets.json`.

```bash
# Report-only mode (default)
npm run perf:budget:check

# Enforced mode (non-zero exit on failures)
PERF_ENFORCE=true npm run perf:budget:check
```

In report-only mode, missing Lighthouse scores are reported as warnings (non-blocking). Set `PERF_ENFORCE=true` to treat them as failures.

Use `npm run perf:ci` to run baseline + budget checks in one flow.

## Repeatable Local Perf Workflow

Use this checklist when validating performance changes so results are comparable across refactors.

1. Start from a clean state.
   - Close heavy apps/tabs and keep CPU load low.
   - Use the same branch and dependency lockfile state.
2. Generate baseline artifacts.
   - `npm run perf:baseline`
   - Confirm files were updated in `perf-reports/`.
3. Run budget checks in report-only mode.
   - `npm run perf:budget:check`
   - Keep `PERF_ENFORCE` disabled during refactor iterations.
4. Re-run baseline at least one more time.
   - Compare the two `lighthouse-summary.json` runs to catch one-off spikes.
   - If Lighthouse reports `NO_FCP`, rerun once after closing extra windows/apps.
5. Capture React DevTools Profiler traces for target interactions.
   - Record each flow separately: search typing, tag toggle, sort change, selection mode toggle, bulk action.
   - Save traces with clear names (`home-search-before`, `home-search-after`, etc.).
   - Compare commit duration and render count, not just FPS.
6. Update tracked baseline only after intentional improvements.
   - `npm run perf:baseline:update`
   - Include before/after numbers in PR notes.

This workflow keeps thresholds stable while still surfacing warning-level regressions during active optimization work.

## Optimization Changelog

Phase-by-phase outcomes, before/after metrics, and trade-offs are tracked in:

- `frontend/docs/OPTIMIZATION_CHANGELOG.md`
