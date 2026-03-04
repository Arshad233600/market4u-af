# Security Audit Report — Market4U

**Date:** 2026-03-04  
**Scope:** Full codebase — `api/src/`, `components/`, `utils/`, `services/`  
**Auditor:** Automated Static Analysis + Code Review

---

## Summary

| Category | Findings | Critical | High | Medium | Low |
|----------|----------|----------|------|--------|-----|
| SQL Injection | 1 | 0 | 0 | 1 | 0 |
| XSS | 1 | 0 | 0 | 0 | 1 |
| JWT Vulnerabilities | 1 | 0 | 0 | 1 | 0 |
| Authentication Bypass | 0 | — | — | — | — |
| Authorization Issues | 1 | 0 | 1 | 0 | 0 |
| File Upload | 1 | 0 | 1 | 0 | 0 |
| Blob Storage | 1 | 0 | 0 | 1 | 0 |
| Sensitive Data Leakage | 2 | 0 | 0 | 1 | 1 |
| Rate Limiting | 1 | 0 | 0 | 1 | 0 |

**Overall Risk Level: MEDIUM**

---

## 1. SQL Injection

### Finding 1.1 — LIKE Queries with Parameterized Inputs ✅ SAFE
**File:** `api/src/functions/ads.ts` lines 71–110  
**Risk:** Low (mitigated)

The `getAds()` function builds a dynamic SQL query string using string concatenation for the
`WHERE` clause structure, but all user-supplied values are bound via parameterized inputs:

```ts
queryStr += " AND Location LIKE '%' + @Province + '%'";
// ...
req.input("Province", sql.NVarChar, province);
```

The parameterized inputs (`@Province`, `@SearchQuery`, etc.) prevent SQL injection. The query
string itself only references fixed column names and SQL keywords — never raw user input.

**Status:** No action required. Parameterized queries are correctly used throughout.

---

## 2. XSS (Cross-Site Scripting)

### Finding 2.1 — React Default Escaping ✅ SAFE
**File:** All `components/` and `pages/`  
**Risk:** Low (mitigated)

The frontend uses React 19 which escapes all dynamic content by default. A search for
`dangerouslySetInnerHTML` returned no matches. User-generated content rendered in components
(product titles, descriptions, seller names) is treated as text, not HTML.

**Status:** No action required.

---

## 3. JWT Vulnerabilities

### Finding 3.1 — Algorithm Pinning ✅ SAFE
**File:** `api/src/utils/authUtils.ts` line 162  
**Risk:** Low

`jwt.verify` is called with `{ algorithms: ['HS256'] }` which pins the algorithm and prevents
the "algorithm:none" attack vector.

### Finding 3.2 — Refresh Token Grace Window
**File:** `api/src/functions/auth.ts` lines 307–326  
**Risk:** Medium

The refresh endpoint uses `ignoreExpiration: true` and accepts tokens up to 30 days after
standard expiry. A stolen refresh token remains valid for 30 days after the 7-day session
window. There is no token revocation mechanism.

**Recommendation:** Add a token revocation table in the database or use a Redis-backed
denylisted token store. Consider shortening the refresh grace window.

---

## 4. Authentication Bypass

### No bypass vulnerabilities found ✅
All protected routes call `validateToken()` → `authResponse()`. The `isAuthSecretInsecure`
guard returns HTTP 503 (not 401) for misconfigured secrets, preventing silent auth bypass.
The SWA `x-ms-client-principal` header is decoded safely with base64 parsing wrapped in
try/catch.

---

## 5. Authorization Issues

### Finding 5.1 — Admin Role Verified Against DB ✅ SAFE
**File:** `api/src/functions/admin.ts` lines 12–30

Every admin endpoint calls `requireAdmin()` which:
1. Validates the JWT token
2. Queries the database to confirm `Role = 'ADMIN'`

The role is not trusted from the JWT payload — it is always fetched fresh from the DB.

### Finding 5.2 — Ad Ownership Check Inconsistency ⚠️ HIGH
**File:** `api/src/functions/ads.ts` (deleteAd) and `api/src/functions/ads.ts` (updateAd)

`deleteAd` performs the ownership check inline in the UPDATE WHERE clause:
```ts
.query("UPDATE Ads SET IsDeleted = 1 ... WHERE Id = @Id AND UserId = @UserId");
```
If `rowsAffected[0] === 0` it returns **403 Forbidden** (not 404), which discloses whether
the ad exists (timing side-channel when compared with an explicit 404 for unknown IDs).

`updateAd` correctly returns 404 for ownership failures — the inconsistency between the two
endpoints may confuse clients.

**Recommendation:** Standardize the response code for "ad not found or not owned" across
`deleteAd` and `updateAd` (prefer 404 to avoid information disclosure).

---

## 6. File Upload Vulnerabilities

### Finding 6.1 — No MIME Type or File Size Validation ⚠️ HIGH
**File:** `api/src/functions/upload.ts`

```ts
const body = await request.json() as any;
const { fileName, contentType, base64 } = body || {};
// No validation of contentType or base64 size
const buffer = Buffer.from(base64, "base64");
await blobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType || "application/octet-stream" },
});
```

Issues:
- **No file size limit**: An attacker can upload arbitrarily large payloads, causing excessive
  blob storage costs and potential OOM conditions.
- **No MIME type whitelist**: Any content type is accepted. A user can upload `.exe`, `.php`,
  or `.html` files and store them as blobs.
- **Client-supplied `contentType`**: The blob Content-Type is set from the client's request,
  allowing stored XSS if blobs are served directly with `text/html` content type.

**Recommendation:**
1. Add a maximum base64 size check (e.g., 10 MB):  
   `if (base64.length > 10_000_000) return { status: 413, ... }`
2. Validate `contentType` against an allowlist: `['image/jpeg', 'image/png', 'image/webp']`
3. Set `blobContentDisposition: 'attachment'` on uploads to prevent inline rendering.

---

## 7. Blob Storage Access Risks

### Finding 7.1 — SAS Token Scope and Expiry ⚠️ MEDIUM
**File:** `api/src/functions/uploadSas.ts` (if present)

The `AZURE_STORAGE_CONNECTION_STRING` environment variable contains a storage account key that
grants full control of the storage account. If the connection string is leaked via logs,
environment variable exposure, or error messages, an attacker gains full access.

**Recommendation:**
1. Use a Managed Identity for blob access instead of a connection string with account keys.
2. Never log the connection string — ensure `context.error()` does not log `e.message` for
   storage-related errors (which may include the connection string in some error paths).

---

## 8. Sensitive Information Leakage

### Finding 8.1 — DB Error Messages Exposed ⚠️ MEDIUM
**File:** `api/src/functions/favorites.ts`, `messages.ts`, `admin.ts`

Several endpoints return raw error messages:
```ts
return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
```

The `errMessage()` helper exposes the internal `Error.message` which may contain table names,
column names, connection details, or SQL error codes useful to an attacker.

**Recommendation:** Log the full error internally but return only a generic error to the
client (use `requestId` for client-side error correlation).

### Finding 8.2 — Auth Diagnostics Endpoint ℹ️ LOW
**File:** `api/src/functions/auth.ts` lines 354–405

The `/api/auth/diag` endpoint is guarded by `AUTH_DIAG_ENABLED=true` (default: false) and an
allowlist check. The secret fingerprint (SHA-256 prefix) is disclosed. This is acceptable for
operational diagnostics but should remain disabled in production unless actively debugging.

---

## 9. Rate Limiting

### Finding 9.1 — In-Memory Rate Limiter (Non-Distributed) ⚠️ MEDIUM
**File:** `api/src/utils/rateLimit.ts`

The rate limiter uses an in-memory `Map`:
```ts
const rateLimitStore = new Map<string, RateLimitRecord>();
```

Azure Functions scale horizontally across multiple instances. Each instance has its own
in-memory store. A user can bypass the rate limit by having requests routed to different
instances.

Additionally, the login endpoint does **not** use this rate limiter. The rate limiter is only
used for ad posting (in `postAd`).

**Recommendation:**
1. Apply rate limiting to the `/api/auth/login` endpoint to prevent credential stuffing.
2. Replace the in-memory store with a distributed cache (Azure Redis Cache or Azure Table
   Storage) for multi-instance deployments.

---

## Positive Security Controls Observed ✅

- **Parameterized SQL queries** used throughout all DB operations (no string concatenation of user input into SQL)
- **bcrypt** with 10 rounds used for password hashing
- **HS256 algorithm pinned** in JWT sign and verify
- **AUTH_SECRET minimum length** enforced (≥ 32 chars) with known placeholder detection
- **SWA built-in auth** header decoded safely with base64 + try/catch
- **CORS** configured in `staticwebapp.config.json`
- **Filename sanitization** in upload: `fileName.replace(/[^\w.-]/g, "_")`
- **UUID-prefixed blob names** prevent name-based path traversal
- **Admin role always re-verified from DB** (not trusted from JWT)
- **Request ID tracing** for security event correlation

---

## Recommendations Priority

| Priority | Finding | Action |
|----------|---------|--------|
| HIGH | File upload — no size/MIME validation | Add size limit and MIME type allowlist |
| HIGH | Authorization inconsistency | Standardize 403/404 codes in deleteAd |
| MEDIUM | DB error messages exposed | Return generic messages; log internally |
| MEDIUM | Rate limiting not on login | Apply rate limit to /auth/login |
| MEDIUM | In-memory rate limiter | Migrate to distributed cache |
| MEDIUM | Refresh token — no revocation | Add token revocation or shorten grace window |
| LOW | Auth diag endpoint | Keep disabled in production |
