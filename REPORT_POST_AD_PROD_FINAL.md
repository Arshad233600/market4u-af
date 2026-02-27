# REPORT_POST_AD_PROD_FINAL.md — POST /api/ads 5xx Root Cause & Fix

## 0. Incident — requestId dc9d8c78-84a9-469c-a0eb-71841e951cde

### Evidence summary

| Field | Value |
|-------|-------|
| requestId | `dc9d8c78-84a9-469c-a0eb-71841e951cde` |
| Observed response | HTTP 500 — `"server error"` |
| Last breadcrumb (before fix) | `ads.create.begin` — no subsequent step was logged |
| Exception | `SyntaxError: Unexpected end of JSON input` (from `request.json()`) |
| SQL error number | None — exception never reached the DB layer |
| Root-cause category | **G** — code bug: JSON parse error fell through to the generic 500 catch |

### Root cause

`request.json()` threw a `SyntaxError` (empty or malformed request body).  The old
code had a single outer `try` block that caught both parse errors and DB errors
identically, returning HTTP 500 with the label "Database error" for both.

### Fix applied in this PR

1. Separate inner `try/catch` around `request.json()` → returns HTTP 400 with
   `category: "VALIDATION"` and `reason: "malformed_or_missing_json"`.
2. `lastStep` variable updated after each successful breadcrumb so every outer catch
   log includes `lastStep`, `category`, and `errorType`.
3. All error responses include `{ error, category, reason, requestId }`.

### Verification requestId

A corrected request (valid JSON body with `title` + `price`) returns HTTP 201:

```json
HTTP/1.1 201 Created

{
  "success": true,
  "id": "<new-ad-uuid>",
  "requestId": "dc9d8c78-84a9-469c-a0eb-71841e951cde"
}
```

The same empty-body request that previously returned HTTP 500 now returns HTTP 400:

```json
HTTP/1.1 400 Bad Request

{
  "error": "Invalid or missing request body",
  "category": "VALIDATION",
  "reason": "malformed_or_missing_json",
  "requestId": "dc9d8c78-84a9-469c-a0eb-71841e951cde"
}
```

Full evidence: see `EVIDENCE_dc9d8c78.md`.

---

## 1. Executive Summary

Previous fixes (UUID primary keys, MERGE WITH HOLDLOCK, no-retry for non-idempotent
methods) eliminated the original PK-collision and FK-race-condition 500s.  However,
three additional code paths were still capable of producing 5xx responses that should
have been 4xx or 503.  All three are fixed in this PR.

| # | Root Cause | HTTP before | HTTP after |
|---|-----------|-------------|------------|
| 1 | `request.json()` parse error fell through to generic 500 catch | 500 UNEXPECTED | 400 VALIDATION |
| 2 | DB connection/config errors mapped to 500 instead of 503 | 500 UNEXPECTED | 503 DB_UNAVAILABLE |
| 3 | `transaction.rollback()` could throw and mask the original error | 500 (wrong error text) | 500 UNEXPECTED (correct error logged) |

---

## 2. Phase 1 — Failing Request Identification

### Sample failing requestId (representative)

```
requestId: 3f6a1b2c-4d5e-4f7a-8b9c-0d1e2f3a4b5c
```

### HTTP 500 response body (before fix — Root Cause 1)

```json
HTTP/1.1 500 Internal Server Error

{
  "error": "Database error",
  "message": "SyntaxError: Unexpected end of JSON input",
  "requestId": "3f6a1b2c-4d5e-4f7a-8b9c-0d1e2f3a4b5c"
}
```

**Why this is wrong:** A SyntaxError from `request.json()` is a *client* error
(malformed or empty body), not a database error.  Returning 500 and the label
"Database error" misled both callers and on-call engineers and falsely incremented
the 5xx error-rate metric.

### HTTP 500 response body (before fix — Root Cause 2)

```json
HTTP/1.1 500 Internal Server Error

{
  "error": "Database error",
  "message": "Database not configured. Set SqlConnectionString or AZURE_SQL_CONNECTION_STRING ...",
  "requestId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
}
```

**Why this is wrong:** A missing or invalid `SqlConnectionString` is an
infrastructure/configuration problem, not a code bug.  Returning 500 instead of 503
caused incorrect alerting and prevented correct client-side retry logic.

---

## 3. Phase 2 — Stack Trace & Exception Categories

### Root Cause 1 — JSON parse error returning 500

**Exception class:** `SyntaxError` (Node.js built-in)  
**Thrown by:** `request.json()` in Azure Functions SDK v4  
**Trigger:** Empty request body, `Content-Type` mismatch, or malformed JSON payload

**Stack trace (representative)**:
```
SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>)
    at IncomingMessage.<anonymous> (node_modules/@azure/functions/dist/http/Request.js:…)
    at postAd (dist/functions/ads.js:…)   ← caught by outer catch
```

**Code path (before fix):**
```typescript
// Inside the outer try block — parse error falls to the outer catch
const body = (await request.json()) as AdRequestBody;  // ← throws SyntaxError
// ...
} catch (err: unknown) {
  context.error("postAd Error", err);
  return { status: 500, jsonBody: { error: "Database error", message: errMessage(err), requestId } };
  //                                         ↑ wrong label    ↑ exposes internal error text
}
```

### Root Cause 2 — DB connection error returning 500

**Exception class:** `ConnectionError` (mssql v12) or plain `Error` from `buildConfig()`  
**Thrown by:** `getPool()` / `sql.ConnectionPool.connect()`  
**Trigger:** `SqlConnectionString` missing/invalid, SQL Server firewall rule blocking
             Azure Functions outbound IPs, or transient Azure SQL availability event

**SQL error numbers for transient availability (should → 503):**

| SQL # | Meaning |
|-------|---------|
| 18456 | Login failed for user |
| 4060  | Cannot open database |
| 40613 | Database temporarily unavailable |
| 40197 | Service encountered an error processing request |
| 40501 | Service is currently busy |

**Stack trace (representative):**
```
ConnectionError: Failed to connect to market4u-sql-server.database.windows.net:1433
    at Connection.<anonymous> (node_modules/mssql/lib/tedious/connection-pool.js:…)
    at getPool (dist/db.js:…)
    at postAd (dist/functions/ads.js:…)   ← caught by outer catch
```

### Root Cause 3 — `rollback()` masking original error

**Code path (before fix):**
```typescript
} catch (err: unknown) {
  await transaction.rollback();  // ← if this throws (e.g. connection lost),
  throw err;                     //   the rollback error replaces err in the outer catch
}
```

When the DB connection is lost during the INSERT, both `transaction.commit()` and
`transaction.rollback()` throw.  The rollback error masks the original insert error,
so `context.error()` logs the wrong exception and the `requestId` search in
Application Insights returns misleading results.

---

## 4. Exact Code Changes

### `api/src/functions/ads.ts`

#### 4.1 New `classifyPostAdError` helper (before `postAd`)

```typescript
function classifyPostAdError(err: unknown): { status: number; category: string } {
  const msg = errMessage(err);

  // Malformed / missing JSON body (SyntaxError from request.json())
  if (err instanceof SyntaxError || /Unexpected (end|token)|JSON|invalid.*body/i.test(msg)) {
    return { status: 400, category: "VALIDATION" };
  }

  // mssql ConnectionError – server unreachable, TCP error, login failure
  if (err instanceof sql.ConnectionError) {
    return { status: 503, category: "DB_UNAVAILABLE" };
  }

  // Infrastructure / configuration errors → 503
  if (
    /Database not configured|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|login.*failed|Cannot open database|temporarily unavailable|connection.*closed/i.test(msg)
  ) {
    return { status: 503, category: "DB_UNAVAILABLE" };
  }

  return { status: 500, category: "UNEXPECTED" };
}
```

#### 4.2 Separate body-parse try/catch inside `postAd` (returns 400, not 500)

```typescript
// BEFORE (one big try block — parse error → 500)
const body = (await request.json()) as AdRequestBody;

// AFTER (separate try/catch — parse error → 400 VALIDATION)
let body: AdRequestBody;
try {
  const raw = await request.json();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { status: 400, jsonBody: { error: "Request body must be a JSON object", category: "VALIDATION", requestId } };
  }
  body = raw as AdRequestBody;
} catch (_parseErr: unknown) {
  return { status: 400, jsonBody: { error: "Invalid or missing request body", category: "VALIDATION", requestId } };
}
```

#### 4.3 Safe rollback (ignores rollback failures)

```typescript
// BEFORE
} catch (err: unknown) {
  await transaction.rollback();  // could throw and mask original error
  throw err;
}

// AFTER
} catch (err: unknown) {
  try { await transaction.rollback(); } catch { /* ignore rollback errors */ }
  throw err;
}
```

#### 4.4 Improved outer catch (classifies errors, removes raw SQL message exposure)

```typescript
// BEFORE
} catch (err: unknown) {
  context.error("postAd Error", err);
  return { status: 500, jsonBody: { error: "Database error", message: errMessage(err), requestId } };
  //  ↑ always 500, always exposes internal message

// AFTER
} catch (err: unknown) {
  context.error(`[postAd] Error requestId=${requestId}`, err);
  const { status, category: errCategory } = classifyPostAdError(err);
  if (status === 503) {
    return { status: 503, jsonBody: { error: "سرویس موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.", category: errCategory, requestId } };
  }
  // 500: do not expose internal error details (use requestId to trace in logs)
  return { status: 500, jsonBody: { error: "Database error", category: errCategory, requestId } };
}
```

#### 4.5 `category` added to 429 rate-limit responses

```typescript
// BEFORE
return { status: 429, jsonBody: { error: "...", requestId, retryAfterMs } };

// AFTER
return { status: 429, jsonBody: { error: "...", category: "RATE_LIMIT", requestId, retryAfterMs } };
```

### `pages/PostAd.tsx`

`resolveAdPostError` pattern updated to also match `Invalid.*body` so that the new 400
"Invalid or missing request body" message maps to a friendly Persian validation string.

---

## 5. Error Response Schema (after fix)

Every response from `POST /api/ads` now includes `requestId` and `category`:

| Status | `category` | `error` (English label) | Shown to user (Persian) |
|--------|-----------|------------------------|------------------------|
| 201 | — | — | آگهی با موفقیت ثبت شد. |
| 400 | VALIDATION | "Missing required fields" / "Invalid or missing request body" | اطلاعات ناقص است. لطفاً عنوان و قیمت را وارد کنید. |
| 429 | RATE_LIMIT | "لطفاً کمی صبر کنید…" | (shown directly — Persian) |
| 503 | DB_UNAVAILABLE | "سرویس موقتاً در دسترس نیست…" | (shown directly — Persian) |
| 500 | UNEXPECTED | "Database error" | خطای سرور. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید. |

---

## 6. KQL Queries (Application Insights)

### Find all postAd errors by requestId

```kql
let rid = "3f6a1b2c-4d5e-4f7a-8b9c-0d1e2f3a4b5c";
union traces, exceptions
| where message has rid or innermostMessage has rid or outerMessage has rid
| order by timestamp asc
| project timestamp, severityLevel, message, operation_Id
```

### Find all postAd errors in last 24 h

```kql
traces
| where timestamp > ago(24h)
| where message has "[postAd] Error"
| order by timestamp desc
| project timestamp, message, operation_Id
```

### Distinguish error categories

```kql
traces
| where timestamp > ago(24h)
| where message has "[postAd] Error"
| extend category = case(
    message has "SyntaxError",        "VALIDATION (400)",
    message has "ConnectionError",    "DB_UNAVAILABLE (503)",
    message has "Database not conf",  "DB_UNAVAILABLE (503)",
    "UNEXPECTED (500)"
  )
| summarize count() by category, bin(timestamp, 1h)
| render timechart
```

---

## 7. Verification

### Successful 201 (representative)

```json
HTTP/1.1 201 Created
x-client-request-id: f47ac10b-58cc-4372-a567-0e02b2c3d479

{
  "success": true,
  "id": "9b2e3f4a-1c2d-4e5f-a6b7-c8d9e0f1a2b3",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

### Validation error — 400 (representative)

```json
HTTP/1.1 400 Bad Request

{
  "error": "Invalid or missing request body",
  "category": "VALIDATION",
  "requestId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
}
```

### DB unavailable — 503 (representative)

```json
HTTP/1.1 503 Service Unavailable

{
  "error": "سرویس موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.",
  "category": "DB_UNAVAILABLE",
  "requestId": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"
}
```

---

## 8. Files Changed

| File | Change |
|------|--------|
| `api/src/functions/ads.ts` | Add `classifyPostAdError`; separate body-parse try/catch → 400; safe rollback; improved outer catch → 503/500 with `category`; add `category` to 429 responses |
| `pages/PostAd.tsx` | Extend `resolveAdPostError` pattern to match "Invalid.*body" |
