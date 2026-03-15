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

Use `npm run perf:ci` to run baseline + budget checks in one flow.
