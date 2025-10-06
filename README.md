# notesBoard

## Backend authentication & security updates

The API now requires authenticated requests. Each note is owned by a user and
CRUD endpoints validate ownership automatically.

### Environment variables

Add the following secrets to your backend `.env` file:

- `MONGO_URI` – connection string
- `MONGO_DB` – database name
- `JWT_ACCESS_SECRET` – secret used to sign access tokens
- `JWT_ACCESS_TTL` – optional TTL (defaults to `15m`)
- `JWT_REFRESH_TTL_MS` – optional refresh lifetime in milliseconds (defaults to 7 days)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` – optional; enables rate limiting when configured
- `MAILER_TO_GO_URL` – SMTP connection string from Mailer To Go
- `MAIL_FROM_ADDRESS` – optional custom “from” email (defaults to `NotesBoard <no-reply@MAIL_FROM_DOMAIN>`)
- `MAIL_FROM_DOMAIN` – optional domain used when `MAIL_FROM_ADDRESS` is not provided
- `PASSWORD_RESET_URL` – absolute URL of the frontend reset page; `{token}` placeholder will be substituted if present (otherwise appended as `?token=`)
- `PASSWORD_RESET_TTL_MS` – optional validity window for reset links in milliseconds (defaults to 1 hour)
- `RATELIMIT_REQUEST_LIMIT` – optional override for the number of requests per window (defaults to 100 outside tests)
- `RATELIMIT_WINDOW` – optional window duration string for rate limiting (defaults to `60 s`)

> **Heads up:** When `NODE_ENV` is not `production`, the server will fall back to an
> internal development secret if `JWT_ACCESS_SECRET` isn't set. This keeps local
> environments from crashing, but you should always provide a unique secret for any
> real deployment.

### Bootstrap existing data

If you are upgrading from a version that did not support users, run:

```bash
cd backend
npm run bootstrap-owner
```

This script provisions an initial user (set `BOOTSTRAP_USER_EMAIL`,
`BOOTSTRAP_USER_NAME`, `BOOTSTRAP_USER_PASSWORD`) and assigns ownership to notes
that predate the auth system.

### API authentication flow

1. `POST /api/auth/register` – create account (returns access token, sets refresh cookie)
2. `POST /api/auth/login` – obtain tokens for existing user
3. `POST /api/auth/refresh` – rotate refresh token using the HTTP-only cookie
4. `POST /api/auth/logout` – revoke the active refresh session
5. `POST /api/auth/password/forgot` – request a password reset email (returns a generic success message)
6. `POST /api/auth/password/reset` – submit a new password with a valid reset token
7. `GET /api/auth/me` – fetch the authenticated profile (requires `Authorization: Bearer <token>`)

All `/api/notes` endpoints now require a valid `Authorization` header.
