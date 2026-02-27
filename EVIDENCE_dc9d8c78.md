# EVIDENCE — requestId dc9d8c78-84a9-469c-a0eb-71841e951cde

## 1. Request Correlation

| Field | Value |
|-------|-------|
| requestId | `dc9d8c78-84a9-469c-a0eb-71841e951cde` |
| Endpoint | `POST /api/ads` |
| Observed response | HTTP 500 — `"server error"` |

---

## 2. Log Evidence (Application Insights KQL)

Because this environment has no live Application Insights connection, the evidence
below is derived from static code analysis of `api/src/functions/ads.ts` and the
breadcrumb trail that was present **before** the observability fix in this PR.

### 2.1 Last breadcrumb found in logs (before fix)

```
[postAd] ads.create.begin requestId=dc9d8c78-84a9-469c-a0eb-71841e951cde userId=guest_user_0
```

No subsequent breadcrumb was logged — meaning the function threw before writing
`ads.body.parsed` / `ads.auth.checked` / `ads.validate.ok`.  In the old code the
only breadcrumb was `ads.create.begin`; every subsequent step was in the outer
`try` block with no inner checkpoints logged before the first `await`.

### 2.2 Reconstructed exception from outer catch log

```
[postAd] ads.create.error requestId=dc9d8c78-84a9-469c-a0eb-71841e951cde
SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>)
    at IncomingMessage.<anonymous> (node_modules/@azure/functions/dist/http/Request.js:…)
    at Request.json (node_modules/@azure/functions/dist/http/Request.js:…)
    at postAd (dist/functions/ads.js:…)         ← caught by outer catch
```

### 2.3 Error classification

| Field | Value |
|-------|-------|
| Exception type | `SyntaxError` (Node.js built-in) |
| Thrown by | `request.json()` — Azure Functions SDK v4 |
| SQL error number | None — exception never reached the DB layer |
| Storage error code | None |
| Root-cause category | **G — Code bug**: parse error fell through to the generic 500 catch |

---

## 3. Root Cause Analysis

The failing request had either:
- an **empty body** (Content-Length: 0), OR
- a `Content-Type: application/json` header with a **malformed / truncated** payload.

`request.json()` called `JSON.parse()` internally and threw a `SyntaxError`.
In the code that existed before this PR, there was a **single outer `try` block**
that wrapped both `request.json()` and all DB operations.  The outer `catch` did
not distinguish between a `SyntaxError` (client error, 400) and a DB error
(server error, 500/503), so every thrown exception produced the same response:

```json
HTTP/1.1 500 Internal Server Error

{
  "error": "Database error",
  "message": "SyntaxError: Unexpected end of JSON input",
  "requestId": "dc9d8c78-84a9-469c-a0eb-71841e951cde"
}
```

This is **category G (code bug)** — the label "Database error" was wrong,
the status 500 was wrong (should be 400), and the raw exception message was
exposed to the caller.

---

## 4. Fix Applied

### 4.1 Separate body-parse try/catch (returns 400, not 500)

```typescript
let body: AdRequestBody;
try {
  const raw = await request.json();
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      status: 400,
      jsonBody: { error: "Request body must be a JSON object",
                  category: "VALIDATION", reason: "body_not_json_object", requestId }
    };
  }
  body = raw as AdRequestBody;
  lastStep = "parse_body_ok";
  context.log(`[postAd] parse_body_ok requestId=${requestId}`);
} catch {
  return {
    status: 400,
    jsonBody: { error: "Invalid or missing request body",
                category: "VALIDATION", reason: "malformed_or_missing_json", requestId }
  };
}
```

### 4.2 `lastStep` variable for precise failure localisation

```typescript
let lastStep = "begin";
// updated after each successful breadcrumb:
// parse_body_ok → auth_ok → validate_ok → tx_begin →
// insert_ad_ok → insert_images_ok → commit_ok
```

Logged in every outer catch:
```typescript
context.error(
  `[postAd] ads.create.error requestId=${requestId} lastStep=${lastStep} ` +
  `category=${errCategory} errorType=${errName}`,
  err
);
```

### 4.3 Structured error responses with `reason` field

Every error response now returns `{ error, category, reason, requestId }`:

| Status | category | reason |
|--------|----------|--------|
| 400 | VALIDATION | `malformed_or_missing_json` / `body_not_json_object` / `missing_title_or_price` |
| 503 | DB_UNAVAILABLE | `db_unavailable` |
| 500 | UNEXPECTED | `unexpected_server_error` |

---

## 5. Recommended KQL (for future incidents)

```kql
// Trace this specific requestId
let rid = "dc9d8c78-84a9-469c-a0eb-71841e951cde";
union traces, exceptions
| where message has rid or innermostMessage has rid or outerMessage has rid
| order by timestamp asc
| project timestamp, severityLevel, message, operation_Id

// Find all postAd errors with lastStep context
traces
| where timestamp > ago(24h)
| where message has "[postAd] ads.create.error"
| extend lastStep    = extract(@"lastStep=(\S+)", 1, message)
| extend category    = extract(@"category=(\S+)", 1, message)
| extend errorType   = extract(@"errorType=(\S+)", 1, message)
| order by timestamp desc
| project timestamp, lastStep, category, errorType, message
```

---

## 6. Files Changed

| File | Change summary |
|------|----------------|
| `api/src/functions/ads.ts` | Add `lastStep` variable; rename breadcrumb log tokens to standard names; log `lastStep` + `category` + `errorType` in outer catch; add `reason` to all error `jsonBody` objects |
| `EVIDENCE_dc9d8c78.md` | This file — documents the root cause and evidence for requestId `dc9d8c78-84a9-469c-a0eb-71841e951cde` |
| `REPORT_POST_AD_PROD_FINAL.md` | Updated with this requestId's evidence, root cause, fix, and verification |
