# Contributing to NotesBoard

Thank you for contributing to NotesBoard.

## Prerequisites

- Node.js 20.x
- npm 10.x
- MongoDB instance
- Optional: Upstash Redis and AI provider keys for full feature coverage

## Local Setup

1. Fork and clone the repository.
2. Install dependencies from the repo root.
3. Create local environment files.

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

## Development Workflow

1. Create a feature branch from `main`.
2. Make focused changes with clear commit messages.
3. Run quality checks before opening a pull request.
4. Open a PR with a clear summary and test notes.

Run the app locally:

```bash
npm run dev
```

Useful workspace commands:

```bash
# Backend only
npm run dev -w backend

# Frontend only
npm run dev -w frontend

# Standalone collaboration server
npm run collab -w backend
```

## Quality Checks

Run these before submitting your PR:

```bash
# Backend tests
npm test -w backend

# Frontend tests (single run)
npm test -w frontend -- --run

# Backend typecheck
npm run typecheck -w backend

# Frontend lint
npm run lint -w frontend
```

If your change touches performance-sensitive frontend paths, also run:

```bash
npm run perf:ci -w frontend
```

## Commit Style

Use conventional commit prefixes:

- `feat`
- `fix`
- `refactor`
- `docs`

Examples:

- `feat: add notebook publish conflict handling`
- `fix: guard offline queue replay when notebook is missing`
- `docs: update setup instructions for local redis`

## Pull Request Guidelines

- Keep PRs focused and scoped to one logical change.
- Include a short description of what changed and why.
- Add test notes (what you ran and results).
- Include screenshots or recordings for UI changes.
- Link related issues when relevant.

## Security

Do not open public issues for sensitive vulnerabilities.

Security decisions and controls are documented in `SECURITY_DECISIONS.md`.
