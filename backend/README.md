# Backend

This package powers the NotesBoard API, including notebook analytics ingestion and reporting.

## Environment

Copy `.env.example` to `.env` and configure the following variables before running any scripts:

| Variable                                  | Purpose                                                               |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `MONGO_URI`                               | Connection string for the primary MongoDB deployment.                 |
| `MONGO_DB`                                | Optional database name override when the URI does not embed one.      |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Secrets for signing JWT tokens.                                       |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_MS`    | Access and refresh token lifetimes.                                   |
| `PASSWORD_RESET_URL`                      | Base URL used in password reset emails.                               |
| `NODE_ENV`                                | Set to `production` in production environments.                       |
| `NOTEBOOK_ANALYTICS_SNAPSHOT_DAYS`        | (Optional) Overrides how many days the snapshot cron ingests per run. |
| `NOTEBOOK_ANALYTICS_SEED_OWNER_EMAIL`     | (Optional) Default owner email for analytics fixture seeding.         |
| `NOTEBOOK_ANALYTICS_SEED_OWNER_NAME`      | (Optional) Display name for the seed owner account.                   |
| `NOTEBOOK_ANALYTICS_SEED_OWNER_PASSWORD`  | (Optional) Password used when the seed owner account is auto-created. |
| `NOTEBOOK_ANALYTICS_SEED_NOTEBOOK_NAME`   | (Optional) Custom label for the synthetic analytics notebook.         |
| `NOTEBOOK_ANALYTICS_SEED_DAYS`            | (Optional) Days of history that the seeding script will generate.     |
| `NOTEBOOK_ANALYTICS_SEED_NOTES_PER_DAY`   | (Optional) Notes created per day during seeding.                      |

## Scripts

Run scripts from the backend package using `npm run <script>`:

- `dev` – start the API in watch mode.
- `start` – start the API without hot reload.
- `test` – execute the full Vitest suite.
- `test:analytics` – run analytics-focused unit and smoke tests only.
- `analytics-snapshots` – generate or warm notebook analytics snapshots; accepts `--days=<n>` and `--warm=7d,30d`.
- `seed-analytics-fixtures` – populate a high-volume analytics dataset. Options include `--owner=<email>`, `--owner-name=<name>`, `--owner-password=<password>`, `--notebook=<name>`, `--days=<n>`, and `--per-day=<n>`.

Example: `npm run seed-analytics-fixtures -- --owner=analytics@example.com --days=120 --per-day=10`

## Notebook Analytics API

All analytics routes live under `/api/notebooks/:id/analytics` and require authentication. Supply the `range` query parameter using one of the shared values exported from `shared/analyticsTypes.js` (`7d`, `30d`, `90d`, `365d`).

- `GET /api/notebooks/:id/analytics` – aggregate overview metrics. Response matches the `NotebookAnalyticsOverview` type.
- `GET /api/notebooks/:id/analytics/activity` – daily creation trend data.
- `GET /api/notebooks/:id/analytics/tags` – tag leaderboard for the selected range.
- `GET /api/notebooks/:id/analytics/collaborators` – collaborator role breakdown.
- `GET /api/notebooks/:id/analytics/snapshots` – raw snapshot series including coverage metadata.

See `shared/analyticsTypes.js` for the complete contract shared with the frontend.

## Cron and Operations

- Schedule the snapshot task (`npm run analytics-snapshots`) via your process manager or cron. Recommended cadence: hourly or daily depending on traffic. Tune `NOTEBOOK_ANALYTICS_SNAPSHOT_DAYS` to control the backfill window; defaults to `1`.
- For cache warm-up, pass `--warm=7d,30d,90d` to the snapshot script so frequently accessed ranges stay fast.
- Re-run `seed-analytics-fixtures` in staging whenever analytics regressions need to be reproduced against a large dataset.

## Testing

Vitest powers the backend test suite. The analytics smoke test in `tests/notebook.analytics.performance.test.js` verifies that high-volume datasets compute within budget. Run `npm run test:analytics` during performance investigations or CI checks that target analytics changes.
