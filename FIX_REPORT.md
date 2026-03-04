# FIX_REPORT.md — Market4U Security Fix Pack

**Date:** 2026-03-04  
**Scope:** P0 and P1 security/bug fixes from SECURITY_AUDIT.md and BUG_REPORT.md  
**Fixes:** BUG-001 through BUG-006

---

## Summary of Changes

| Bug | Severity | File(s) | Status |
|-----|----------|---------|--------|
| BUG-005 | P0 / High | `api/src/functions/auth.ts` | ✅ Fixed |
| BUG-003 | P0 / High | `api/src/functions/upload.ts` | ✅ Fixed |
| BUG-001 | P0 / High | `api/src/utils/rateLimit.ts` | ✅ Guarded + TODO |
| BUG-006 | P1 / Med | `favorites.ts`, `messages.ts`, `admin.ts`, `ads.ts`, `responses.ts` | ✅ Fixed |
| BUG-004 | P1 / Med | `api/src/functions/messages.ts` | ✅ Fixed |
| BUG-002 | P1 / Med | `api/src/functions/ads.ts` | ✅ Fixed |

---

## Detailed Changes

### BUG-005 — Rate Limiting on Login (P0)

**File:** `api/src/functions/auth.ts`

The `login` handler now calls `checkRateLimit` before any database access.

- **Identifier:** `login:<email>:<clientIp>` — combines email with the first IP from
  `x-forwarded-for` (falls back to `x-client-ip`, then email-only).
- **Limit:** 10 requests per 15-minute window per identifier.
- **Response on limit exceeded:** HTTP 429 `{ error: "Too many login attempts. Please try again later." }`.
- Separate email+IP pairs have independent counters (no cross-contamination).

**How to verify:**
```bash
# Send 11 rapid POSTs to /api/auth/login with the same email
# The 11th request should return HTTP 429
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://<your-app>/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

---

### BUG-003 — Hardened File Upload Endpoint (P0)

**File:** `api/src/functions/upload.ts`

- **MIME type allowlist:** Only `image/jpeg`, `image/png`, `image/webp`, `image/gif` are accepted.
  Any other content type returns HTTP 400.
- **Maximum file size:** 10 MB (buffer.byteLength). Payloads exceeding this return HTTP 413.
- **Base64 validation:** The base64 string is validated with a regex before decoding.
  Invalid base64 returns HTTP 400.
- **Safe blob headers:**
  - `blobContentType` is always taken from the **validated allowlist** (never from client-supplied value after validation).
  - `blobContentDisposition` is set to `attachment; filename="<safeName>"` to prevent inline rendering / stored XSS.
- **Error response:** No internal details are exposed on storage failure.

**How to verify:**
```bash
# Reject text/html
curl -X POST .../api/upload \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"evil.html","contentType":"text/html","base64":"SGVsbG8="}'
# → 400 Unsupported file type

# Reject >10MB
# → 413 File too large

# Accept image/jpeg under limit
# → 200 { ok: true, url: "..." }
```

---

### BUG-001 — In-Memory Rate Limiter Guard (P0)

**File:** `api/src/utils/rateLimit.ts`

The in-memory rate limiter is a single-instance store that cannot prevent bypass
across horizontally-scaled Azure Functions instances.

**Changes:**
- A **startup warning** is emitted when `NODE_ENV=production`:
  ```
  [rateLimit] WARNING: using in-memory rate-limit store in production. ...
  Configure RATE_LIMIT_REDIS_URL to enable the distributed store (BUG-001).
  ```
- A clear TODO documents the path to a Redis/APIM-backed store.

**TODO for full fix:**  
Implement a Redis store using `RATE_LIMIT_REDIS_URL` (Azure Cache for Redis) or configure
Azure API Management rate-limit policies. The abstraction in `rateLimit.ts` is ready for
a drop-in replacement.

---

### BUG-006 — Generic Error Responses (P1)

**Files:** `api/src/utils/responses.ts`, `favorites.ts`, `messages.ts`, `admin.ts`, `ads.ts`, `upload.ts`

Raw database error messages (SQL error codes, table names, column names) were previously
returned to API clients via `{ error: "Database error", message: err.message }`.

**Changes:**
- `serverError()` in `responses.ts` no longer includes error `detail` in the response body.
- All `catch` blocks in `favorites.ts`, `messages.ts`, `admin.ts`, and `ads.ts` now return
  `{ error: "Internal server error" }` without any internal details.
- `upload.ts` catch block similarly returns a generic message.
- Detailed errors continue to be logged server-side via `context.error(...)`.

**How to verify:**
Trigger a DB error (e.g. disconnect the database or provide an invalid query) and observe
that the response contains only `{ error: "Internal server error" }` — no SQL text, no
stack trace, no connection strings.

---

### BUG-004 — `getInbox` Returns 503 When DB Not Configured (P1)

**File:** `api/src/functions/messages.ts`

Previously `getInbox` returned `HTTP 200 []` when `SqlConnectionString` was not configured,
silently masking a misconfiguration.

**Changes:**
- Returns **HTTP 503** `{ error: "Service temporarily unavailable" }` when no DB connection
  string is detected.
- The `catch` block also returns 500 (not 200 []) on unexpected errors.

**How to verify:**
Remove `SqlConnectionString` from Azure Application Settings.  
Call `GET /api/messages/inbox` with a valid auth token.  
Expected response: `HTTP 503 { error: "Service temporarily unavailable" }`.

---

### BUG-002 — `deleteAd` Returns 404 (Not 403) (P1)

**File:** `api/src/functions/ads.ts`

`deleteAd` previously returned HTTP 403 when `rowsAffected[0] === 0`, disclosing whether
the ad existed (timing side-channel) and inconsistent with `updateAd` (which returns 404).

**Changes:**
- `deleteAd` now returns **HTTP 404** `{ error: "Ad not found" }` when no rows are affected,
  consistent with `updateAd` and `updateAdStatus`.

**How to verify:**
```bash
curl -X DELETE .../api/ads/nonexistent-id \
  -H "Authorization: Bearer <token>"
# → 404 { error: "Ad not found" }
```

---

## CI Gate

**File:** `.github/workflows/azure-static-web-apps.yml`

A new step **"Run API tests"** (`npm test --prefix api`) was added between the
"Install API dependencies" and "Build API" steps. The build will now fail if any
API test fails.

The `api/vitest.config.ts` file was also created so that `npm test` (which runs `vitest run`)
uses a dedicated config instead of accidentally loading the root `vite.config.ts`
(which requires the `vite` package not installed in the `api` directory).

---

## Test Coverage Added

| Test file | New tests |
|-----------|-----------|
| `auth.test.ts` | 4 new rate-limit tests (429 response, key construction, identifier isolation) |
| `upload.test.ts` | 12 new tests (MIME allowlist, size limit, base64 validation, content-disposition, error safety) |
| `messages.test.ts` | 1 new test (503 when DB not configured) |
| `ads.test.ts` | Updated: `deleteAd` 403→404 expectation |
| `responses.test.ts` | Updated: `serverError` no longer leaks details |

**Total tests:** 152 (was 133; +19 new tests, 0 deleted)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RATE_LIMIT_REDIS_URL` | Optional (TODO) | Redis connection URL for distributed rate limiting (BUG-001). When not set, in-memory store is used with a production warning. |

All previously required environment variables (`AUTH_SECRET`, `SqlConnectionString`,
`AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`) remain unchanged.

---

## Security Summary

| Finding | Fixed? | Notes |
|---------|--------|-------|
| BUG-005: No rate limit on login | ✅ | In-memory; see BUG-001 for distributed fix |
| BUG-003: Upload MIME/size bypass | ✅ | Allowlist + 10 MB cap + attachment disposition |
| BUG-001: In-memory rate limiter | ⚠️ Partial | Production warning added; Redis TODO documented |
| BUG-006: DB error leakage | ✅ | Generic messages only; details logged server-side |
| BUG-004: getInbox silent 200 | ✅ | Now returns 503 on DB misconfiguration |
| BUG-002: deleteAd 403 disclosure | ✅ | Returns 404 uniformly |
