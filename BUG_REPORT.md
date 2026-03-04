# Bug Report — Market4U

**Date:** 2026-03-04  
**Environment:** Code review + automated test analysis  
**Project:** Market4U — Azure Static Web App + Azure Functions (Node.js)

---

## BUG-001 — In-memory rate limiter bypassed in multi-instance deployments

| Field | Value |
|-------|-------|
| **Severity** | High |
| **File** | `api/src/utils/rateLimit.ts` |
| **Category** | Functional / Security |

**Description:**  
The rate limiter is backed by an in-memory `Map` per Azure Functions instance. When Azure
scales out to multiple instances, each instance has its own independent rate limit counter.
A user making requests that land on different instances can exceed the configured limit
without any single instance detecting it.

**Reproduction:**
1. Deploy the API to Azure Functions with scale-out enabled.
2. Submit rapid-fire ad creation requests. If requests are load-balanced across ≥ 2 instances,
   each instance's counter stays below the limit even if the total exceeds it.

**Suggested Fix:**  
Replace `rateLimitStore: Map` with an Azure Redis Cache or Azure Table Storage backend.
Alternatively, use Azure API Management's built-in rate limiting policy.

---

## BUG-002 — `deleteAd` returns HTTP 403 instead of HTTP 404 when ad is not found

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **File** | `api/src/functions/ads.ts` (~line 590) |
| **Category** | API Contract |

**Description:**  
`deleteAd` performs the ownership and existence check in a single UPDATE query:
```ts
.query("UPDATE Ads SET IsDeleted = 1 ... WHERE Id = @Id AND UserId = @UserId");
if (result.rowsAffected[0] === 0) {
    return { status: 403, jsonBody: { error: "Forbidden or Not Found" } };
}
```
This returns 403 Forbidden for both "ad belongs to someone else" AND "ad does not exist at
all". The `updateAd` function correctly returns 404 for the same scenario. The inconsistency
confuses API clients.

**Reproduction:**
1. Call `DELETE /api/ads/nonexistent-id` with valid auth.
2. Observe HTTP 403 response (expected HTTP 404).

**Suggested Fix:**  
Split the check into two queries (first check existence, then check ownership) or return
404 when `rowsAffected[0] === 0`:
```ts
if (result.rowsAffected[0] === 0) {
    return { status: 404, jsonBody: { error: "Ad not found" } };
}
```

---

## BUG-003 — File upload accepts any MIME type and has no size limit

| Field | Value |
|-------|-------|
| **Severity** | High |
| **File** | `api/src/functions/upload.ts` |
| **Category** | Security / Stability |

**Description:**  
The upload endpoint accepts any base64-encoded content without validating:
- The content type (allows uploading `.exe`, `.html`, `.php` files).
- The file size (no limit on payload size; can cause OOM or excessive storage costs).
- The MIME type (client-supplied `contentType` is written to blob headers).

**Reproduction:**
1. Send a POST request to `/api/upload` with `base64` of any file and `contentType: "text/html"`.
2. The file is stored in Azure Blob Storage and the URL is returned.

**Suggested Fix:**
```ts
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return { status: 400, jsonBody: { error: 'Unsupported file type' } };
}
const buffer = Buffer.from(base64, 'base64');
if (buffer.byteLength > MAX_SIZE_BYTES) {
    return { status: 413, jsonBody: { error: 'File too large (max 10 MB)' } };
}
```

---

## BUG-004 — `getInbox` silently returns empty array when DB not configured

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **File** | `api/src/functions/messages.ts` lines 20–31 |
| **Category** | Operational / Observability |

**Description:**  
The `getInbox` function checks for a SQL connection string before calling the database:
```ts
const connStr = process.env.SqlConnectionString || ...;
if (!connStr && (!process.env.DB_SERVER || ...)) {
    console.error("[getInbox] database connection string not configured");
    return { status: 200, jsonBody: [] };
}
```
It returns HTTP 200 with an empty array when the database is not configured. This masking
behavior means that a misconfigured production deployment will silently appear to have no
messages, rather than surfacing an error.

**Reproduction:**
1. Remove `SqlConnectionString` from Azure Application Settings.
2. Call `GET /api/messages/inbox` with a valid auth token.
3. Receive HTTP 200 with `[]` — no error is signaled to the client.

**Suggested Fix:**  
Return HTTP 503 Service Unavailable (consistent with other endpoints) instead of masking the
misconfiguration:
```ts
return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
```

---

## BUG-005 — Rate limiting not applied to `/api/auth/login`

| Field | Value |
|-------|-------|
| **Severity** | High |
| **File** | `api/src/functions/auth.ts` |
| **Category** | Security |

**Description:**  
The login endpoint has no rate limiting. An attacker can make unlimited login attempts
against any email address, enabling password-spraying and credential stuffing attacks.

**Reproduction:**
1. Send 1000 POST requests to `/api/auth/login` with the same email and different passwords.
2. All requests are processed; no 429 response is returned.

**Suggested Fix:**  
Apply the existing `checkRateLimit` utility at the start of the `login` handler, keyed on
the email address (or IP address via `x-forwarded-for`):
```ts
const rateResult = checkRateLimit({ identifier: email, maxRequests: 10, windowMs: 15 * 60 * 1000 });
if (!rateResult.allowed) {
    return { status: 429, jsonBody: { error: 'Too many login attempts. Try again later.' } };
}
```

---

## BUG-006 — DB error messages exposed in API responses

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **File** | `api/src/functions/favorites.ts`, `messages.ts`, `admin.ts` |
| **Category** | Security / Information Disclosure |

**Description:**  
Multiple endpoints return raw database error messages in the response body:
```ts
return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
```
The `errMessage()` helper returns `err.message` which can include SQL error codes, table
names, column names, and connection details — information useful to an attacker.

**Reproduction:**
1. Trigger a DB error (e.g., by providing a value that exceeds column length).
2. Observe that the response body contains the raw SQL error message.

**Suggested Fix:**  
Log the error internally with a request ID, but return only a generic error to clients:
```ts
context.error(`[endpoint] DB error requestId=${requestId}`, err);
return { status: 500, jsonBody: { error: 'Internal server error', requestId } };
```

---

## BUG-007 — Refresh token grace window is 30 days without revocation

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **File** | `api/src/functions/auth.ts` lines 270–327 |
| **Category** | Security |

**Description:**  
The `refreshTokenHandler` accepts expired tokens with `ignoreExpiration: true` within a
30-day grace window. If a user's device is stolen or a token is compromised after expiry,
the attacker can still obtain a fresh token for up to 30 days.

There is no token revocation mechanism (no blocklist or version field).

**Suggested Fix:**
1. Add a `token_version` (integer) field to the Users table.
2. Increment it on password change or explicit logout.
3. Include the version in the JWT payload; reject tokens with an outdated version.

---

## BUG-008 — `isAuthSecretInsecure` is a module-level constant (cannot be changed after startup)

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `api/src/utils/authUtils.ts` lines 13–59 |
| **Category** | Operational |

**Description:**  
`isAuthSecretInsecure` is evaluated once when the module loads. If `AUTH_SECRET` is
updated in Azure Application Settings, the Azure Functions host must be restarted for the
new secret to take effect and for `isAuthSecretInsecure` to be recomputed.

This is expected behavior for Azure Functions, but the documentation/error messages do not
make this restart requirement explicit.

**Suggested Fix:**  
Add a comment or startup log message noting that a host restart is required after rotating
`AUTH_SECRET`. No code change required.

---

## BUG-009 — `appInsights.defaultClient` used without null check in some paths

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **File** | `api/src/functions/auth.ts` lines 60–102 |
| **Category** | Stability |

**Description:**  
Some telemetry calls use the `?.` optional chaining operator (`telemetry?.trackEvent(...)`),
but in the module initializer `const telemetry = appInsights.defaultClient` — if Application
Insights is not configured, `telemetry` is `null`. The optional chaining prevents crashes
at runtime, but a direct `telemetry.trackEvent(...)` call (without `?.`) would throw.

A review of the codebase shows all `telemetry` calls correctly use `?.`, so no active bug
exists. This is a low-priority concern to keep in mind when adding new telemetry calls.

**Suggested Fix:**  
Add an ESLint rule or code review checklist item: "Always use `?.` when calling
`appInsights.defaultClient` methods."
