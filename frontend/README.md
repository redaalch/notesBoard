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
