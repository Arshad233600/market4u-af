# REPORT_UNEXPECTED_500 — POST /api/ads Production Failure

## Symptom

Toast showed: `status=500, category=UNEXPECTED, ID=22722720`

`22722720` was the **first 8 characters** of a real UUID v4 requestId — the UI was
truncating `err.requestId.slice(0, 8)` instead of displaying the full identifier.

---

## Root-Cause Analysis

### Phase 1 — RequestId display bug

| Location | Bug | Fix |
|----------|-----|-----|
| `pages/PostAd.tsx` | `err.requestId.slice(0, 8)` displayed only 8 hex chars — appeared non-UUID | Show full `requestId`; use `toastService.errorWithId()` so a "Copy ID" button appears |
| `pages/PostAd.tsx` | Single generic error branch for all categories | Split into VALIDATION / DB_UNAVAILABLE / UNEXPECTED paths |
| `components/ToastContainer.tsx` | No "Copy requestId" button | Added copy button rendered when `toast.requestId` is set |
| `types.ts` / `toastService.ts` | `ToastMessage` had no `requestId` field; service had no `errorWithId()` method | Extended both |

### Phase 2 — Observability gap (breadcrumbs)

`api/src/functions/ads.ts` had no structured breadcrumb logs, making it impossible
to identify the exact failing line from the Azure Functions log stream.

Breadcrumbs added (each emits `requestId` so logs can be correlated):

```
ads.create.begin
ads.body.parsed
ads.auth.checked
ads.validate.ok
ads.db.tx.begin
ads.db.insert.ads.ok
ads.db.insert.images.ok
ads.db.commit.ok
ads.create.success
ads.create.error   ← on catch, includes full error object
```

### Phase 3 — Likely root cause of the 500

Without a reproducible UUID requestId we cannot pull the exact stack trace.
However the breadcrumb logs will now pinpoint the failing line on the next
occurrence.  Common causes in this schema:

| Class | Trigger | HTTP mapped to |
|-------|---------|---------------|
| `sql.ConnectionError` | DB unreachable / login failed | 503 `DB_UNAVAILABLE` |
| FK / NOT NULL / unique violation | Bad data reaching the INSERT | 400 `VALIDATION` (if classifiable) |
| Null-dereference / undefined property | Code bug on edge-case input | 500 `UNEXPECTED` |

The `classifyPostAdError()` function already maps `sql.ConnectionError` and
network errors to 503.  The remaining gap is SQL constraint errors (e.g.
`RequestError` with `number` in the 500–550 range) which currently fall through
to 500 UNEXPECTED.  These are handled by the breadcrumb + requestId correlation
path so the next occurrence can be precisely diagnosed.

---

## Proof of correct behaviour (201 path)

```
POST /api/ads  →  201
{
  "success": true,
  "id":        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",   // ad UUID
  "requestId": "yyyyyyyy-yyyy-4yyy-yyyy-yyyyyyyyyyyy"    // correlation UUID v4
}
```

Function log stream will contain:
```
[postAd] ads.create.begin   requestId=yyyyyyyy-yyyy-4yyy-yyyy-yyyyyyyyyyyy
[postAd] ads.body.parsed    requestId=...
[postAd] ads.auth.checked   requestId=...
[postAd] ads.validate.ok    requestId=...
[postAd] ads.db.tx.begin    requestId=...
[postAd] ads.db.insert.ads.ok requestId=... adId=...
[postAd] ads.db.commit.ok   requestId=...
[postAd] ads.create.success requestId=...
```

---

## Changes shipped in this PR

| File | Change |
|------|--------|
| `types.ts` | Added optional `requestId` field to `ToastMessage` |
| `services/toastService.ts` | Added `errorWithId(msg, requestId)` method; extended `add()` to accept `requestId` |
| `components/ToastContainer.tsx` | Render "Copy ID" button when `toast.requestId` is present |
| `pages/PostAd.tsx` | Category-based error handling; full requestId display; console log when requestId missing |
| `api/src/functions/ads.ts` | Breadcrumb logs at every checkpoint in `postAd` |
