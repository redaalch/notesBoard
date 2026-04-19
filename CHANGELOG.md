# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-05

### Security Audit

Full-stack security audit covering backend and frontend. Findings classified by
severity (CRITICAL / HIGH / MEDIUM / LOW) and resolved across two sessions.

#### Backend

### CRITICAL

- Pinned JWT algorithm to HS256 — rejects `alg:none` and RS/ES key-confusion attacks
- Enforced minimum secret strength (32 bytes) — throws in production, warns in dev

### HIGH

- Added `passwordChangedAt` check so tokens issued before a password change are rejected
- Enforced admin-level access for destructive note operations (delete, bulk delete)
- Added IP tracking to refresh token sessions for audit trail
- Hardened rate limiter client identification (uses `X-Forwarded-For` chain properly)

### MEDIUM

- Added validation limits: note metadata (50 keys, 16 KB), richContent (512 KB object check), diff/awarenessState (object type + size + key limits)
- Stripped embedding vectors from API responses to prevent leakage
- Enforced `MAX_BULK_NOTE_IDS = 100` on bulk endpoints
- Added input validation to `/layout` GET route
- Hardened cookie `sameSite` attribute for production
- Implemented CSP nonce generation for inline styles
- Added atomic transaction support for owner demotion in notebook member roles
- Cleaned up orphaned `SavedNotebookQuery` and `NoteHistory` on notebook deletion

### LOW

- Added JWT secret rotation with graceful fallback to previous secret (60s refresh interval)
- Added `ip` field to refresh token subdocument schema
- Upgraded `nodemailer` 6.10.1 -> 8.0.4 (fixes SMTP injection, address parser DoS, domain confusion)

#### Frontend

### CRITICAL

- Fixed XSS in `markdownToHtml` — all user text is now HTML-escaped before inline formatting via a token-based approach

### HIGH

- Created `safeRedirect.ts` — prevents open redirects via `//evil.com`, `/\evil.com`, and absolute URL bypasses; applied to LoginPage, RegisterPage, VerifyEmailPage, RequireAuth

### MEDIUM

- Created `sanitize.ts` with hardened DOMPurify config — restricts tags to safe prose subset, blocks `javascript:` and `data:` URIs, strips `on*` handlers and arbitrary `data-*` attrs
- Replaced all raw `DOMPurify.sanitize()` calls with `sanitizeHtml()` (TemplateGalleryModal, CreatePage, published pages)
- Created `extractApiError()` — blocks 5xx messages, HTML, stack traces, enforces 200-char limit; applied across 22+ files
- Added CSP meta tag to `index.html` (`default-src 'self'`, `frame-ancestors 'none'`)
- Disabled source maps in production build (`build.sourcemap: false`)
- Added API base URL origin validation in `axios.ts` to prevent exfiltration

### LOW

- Dev-guarded `console.error` calls in NoteDetailPage, HomePage, NoteCard to prevent error object leakage in production
- Preserved `theme` localStorage key during "Clear local cache" command palette action
- Fixed race condition in VerifyEmailPage with ref-based deduplication to prevent duplicate verify calls

### Tests

- Added `sanitize.test.ts` — 30 tests covering `sanitizeHtml` and `extractApiError`
- Added `safeRedirect.test.ts` — 19 tests covering `isSafeRedirect` and `safeRedirectPath`
- Added `markdownToHtml.test.ts` — 21 tests covering markdown rendering and XSS prevention
- Added `tokenService.unit.test.js` — 16 tests covering JWT sign/verify, secret rotation, hashToken, refresh tokens

### Documentation

- Created `SECURITY_DECISIONS.md` — documents accepted risks (WebSocket token replay, offline sync CSRF) with rationale

### Dependencies

- Upgraded `nodemailer` 6.10.1 -> 8.0.4
- Resolved all `npm audit` vulnerabilities in backend (0 remaining) and frontend production deps (0 remaining)
- Added `audit:all` root script for CI integration
