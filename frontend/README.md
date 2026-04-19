# Frontend

This workspace contains the NotesBoard frontend application built with Vite, React, TypeScript, Tailwind CSS, React Router, TanStack Query, and TipTap/Yjs collaboration tooling.

## Getting Started

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

When `VITE_API_BASE_URL` is not set, the app defaults to `window.location.origin + /api`, which is convenient for same-origin deployments.

## Environment Variables

Copy `.env.example` to `.env` and set the values you need:

- `VITE_ENABLE_NOTEBOOK_ANALYTICS`: Enables notebook analytics UI features.
- `VITE_API_BASE_URL`: Optional HTTP API base URL for local or split-origin setups.
- `VITE_COLLAB_SERVER_URL`: WebSocket server for collaborative editing.
- `VITE_COLLAB_PATH`: Optional path appended to the collaboration server URL.
- `VITE_PUBLIC_NOTEBOOK_BASE_URL`: Base URL used for published notebook links in share flows.

## Useful Scripts

- `npm run dev`: Start the Vite dev server.
- `npm run build`: Create a production build in `dist/`.
- `npm run preview`: Preview the production build locally.
- `npm run lint`: Run ESLint.
- `npm run test`: Run Vitest in watch mode.
- `npm run test:coverage`: Run tests with coverage output.
- `npm run perf:ci`: Run the frontend performance baseline and budget checks.

## Project Notes

- `@shared` resolves to the repository's top-level `shared/` directory.
- Production assets are emitted to `frontend/dist/`.
- Additional UI references live in `DESIGN_SYSTEM.md` and `COMPONENT_SHOWCASE.md`.
