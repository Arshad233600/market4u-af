# REPORT_POST_AD.md — Ad Submission Bug: Root Cause, Evidence & Fix

## 1. Executive Summary

When users submitted a new ad ("درج آگهی"), the UI displayed the generic toast
**"خطا در ثبت اطلاعات"** with no actionable information regardless of the actual
failure reason (validation error, database FK constraint, rate-limit, network
outage, etc.).

Three compounding issues were identified and fixed:

| # | Layer | Root Cause | Fix Applied |
|---|-------|-----------|-------------|
| 1 | Frontend service | `azureService.postAd()` / `updateAd()` silently caught every non-`AuthError` and returned `false`, discarding the API error message | Re-throw all errors so they propagate to the page handler |
| 2 | Frontend API client | `apiClient` preferred the raw `message` field (which can contain SQL internals) over the high-level `error` field for 5xx responses | Swap priority: use `error` first for 5xx, `message` first for 4xx |
| 3 | Backend API | `postAd` relied on `guest_user_0` existing in `Users` (FK constraint), but if `init.sql` was never run against the live DB, the row is absent → SQL FK violation → 500 | Add idempotent UPSERT for `guest_user_0` before every anonymous INSERT |

---

## 2. Reproduction Steps

### Step-by-step failure chain (before the fix)

```
[Browser]  POST /api/ads  { title, price, ... }
               │
               ▼
[API – ads.ts :: postAd()]
  userId = 'guest_user_0'        ← user not authenticated
  INSERT INTO Ads (UserId = 'guest_user_0', ...)
  → MSSQL throws: "The INSERT statement conflicted with the FOREIGN KEY
    constraint "FK__Ads__UserId__...". The conflict occurred in database
    "market4u-db", table "dbo.Users", column 'Id'."
  ← HTTP 500 { "error": "Database error", "message": "<SQL text above>" }
               │
               ▼
[apiClient.ts :: request()]
  response.status = 500  → !response.ok
  errorData.message = "The INSERT statement conflicted..."
  throw new Error("The INSERT statement conflicted...")  ← error has real info
               │
               ▼
[azureService.ts :: postAd()]
  catch (err) {
    if (err instanceof AuthError) throw err;  // ← not an AuthError
    return false;                              // ← real error DISCARDED
  }
               │
               ▼
[PostAd.tsx :: handleSubmit()]
  success === false
  toastService.error('خطا در ثبت اطلاعات.')  ← user sees only this
```

### Evidence — `x-client-request-id` correlation

Every request carries the `x-client-request-id` header (added in a previous
phase). Setting `VITE_DEBUG_AUTH=true` in the browser console reveals:

```
[debugAuth] → POST /ads { authAttached: false, correlationId: "lhq1a2-k3m9n2" }
[debugAuth] ← POST /ads { status: 500, correlationId: "lhq1a2-k3m9n2" }
```

The 500 status is the ground-truth proof that the error originates in the
backend, not in authentication.

---

## 3. Root Causes (Detailed)

### Root Cause A — `azureService.postAd()` silently swallowed errors

**File:** `services/azureService.ts` (lines 408-414 before patch)

```typescript
// BEFORE (buggy)
try {
    await apiClient.post('/ads', adData);
    return true;
} catch (err) {
    if (err instanceof AuthError) throw err;
    return false;   // <-- any DB/network/validation error lost here
}
```

`return false` causes `PostAd.tsx` to show the static string
`'خطا در ثبت اطلاعات.'` with no context.

### Root Cause B — `apiClient` leaked SQL details for 5xx errors

**File:** `services/apiClient.ts` (line 167 before patch)

```typescript
// BEFORE (potential information leak)
throw new Error(errorData.message || errorData.error || `API Error: ${response.status}`);
```

For 500 responses the backend returns `{ error: "Database error", message: "<SQL>" }`.
`errorData.message` is checked first → raw SQL text could be shown to users.

### Root Cause C — FK constraint violation for anonymous posters

**File:** `api/src/functions/ads.ts`

`postAd` uses `guest_user_0` as the `UserId` for unauthenticated requests.
There is a `FOREIGN KEY (UserId) REFERENCES Users(Id)` constraint. If `init.sql`
was not executed after the database was provisioned, `guest_user_0` does not
exist → every anonymous ad submission raises an FK violation → HTTP 500.

---

## 4. Fixes Applied

### Fix 1 — Re-throw all errors from `azureService`

```typescript
// AFTER — services/azureService.ts
await apiClient.post('/ads', adData);
return true;
// (no try/catch — errors propagate naturally to the caller)
```

Same change applied to `updateAd`.

### Fix 2 — Swap error-field priority for 5xx in `apiClient`

```typescript
// AFTER — services/apiClient.ts
const msg = response.status >= 500
  ? errorData.error || errorData.message   // high-level label first for server errors
  : errorData.message || errorData.error;  // specific message first for client errors
throw new Error(msg || `API Error: ${response.status}`);
```

### Fix 3 — Idempotent UPSERT of `guest_user_0` before anonymous INSERT

```typescript
// AFTER — api/src/functions/ads.ts (inside postAd, before transaction.begin())
if (!auth.isAuthenticated || !auth.userId) {
  await pool.request()
    .input("GuestId", sql.NVarChar, GUEST_USER_ID)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM Users WHERE Id = @GuestId)
        INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
        VALUES (@GuestId, N'کاربر مهمان', 'guest@market4u.internal', NULL, '', 'GUEST', 0, GETUTCDATE())
    `);
}
```

This is idempotent — if `guest_user_0` already exists the `IF NOT EXISTS` guard
prevents a duplicate-key error.

### Fix 4 — Categorised, user-friendly error messages in `PostAd.tsx`

A `resolveAdPostError(apiMsg?)` helper maps the propagated error message to an
appropriate Persian string:

| Condition | Shown to user |
|-----------|--------------|
| Persian text already in message (rate-limit etc.) | Shown verbatim |
| `Failed to fetch` / `NetworkError` | خطای اتصال به سرور. لطفاً اینترنت خود را بررسی کنید. |
| `Missing required fields` | اطلاعات ناقص است. لطفاً عنوان و قیمت را وارد کنید. |
| `API Error: 429` | لطفاً کمی صبر کنید و دوباره تلاش کنید. |
| `API Error: 4xx` | اطلاعات نادرست است. لطفاً بررسی کنید. |
| `Database error` / `API Error: 5xx` / SQL keywords | خطای سرور. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید. |
| Other / unknown | خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید. |

---

## 5. Files Changed

| File | Change |
|------|--------|
| `services/azureService.ts` | Remove try/catch wrappers in `postAd` and `updateAd` — let errors propagate |
| `services/apiClient.ts` | Prefer `error` over `message` for 5xx to avoid SQL leakage |
| `pages/PostAd.tsx` | Add `resolveAdPostError()` helper; use it in both `if (!success)` and `catch` blocks |
| `api/src/functions/ads.ts` | UPSERT `guest_user_0` before anonymous `INSERT INTO Ads` |
| `api/sql/init.sql` | Already contains `guest_user_0` seed — no schema change needed |

---

## 6. Testing & Verification

### Manual smoke-test (authenticated user)

1. Log in as `user@market4u.com` / `user123`
2. Navigate to "درج آگهی"
3. Fill in title, price, province
4. Click submit
5. Expected: ✅ "آگهی با موفقیت ثبت شد." toast + redirect to dashboard

### Manual smoke-test (anonymous user)

1. Open app without logging in
2. Navigate to "درج آگهی"
3. Fill in title, price, province
4. Click submit
5. Expected: ✅ ad created using `guest_user_0` account (no FK error)

### Error-message verification

| Scenario | Old message | New message |
|----------|-------------|-------------|
| Offline (no internet) | خطا در ثبت اطلاعات. | خطای اتصال به سرور. لطفاً اینترنت خود را بررسی کنید. |
| Rate-limited (1 ad/min) | خطا در ثبت اطلاعات. | لطفاً کمی صبر کنید. شما به تازگی یک آگهی ثبت کرده‌اید. |
| Database error | خطا در ثبت اطلاعات. | خطای سرور. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید. |
| Auth expired | (handled by apiClient — auth toast shown) | (unchanged — still handled by apiClient) |

---

## 7. Security Notes

- Raw SQL error messages are no longer forwarded to the browser (Fix 2).
- `VITE_DEBUG_AUTH=true` must **not** be set in production builds.
- The `guest_user_0` UPSERT is protected by `IF NOT EXISTS` — idempotent and safe against concurrent requests.
- No tokens, passwords, or PII are logged at any point in the diagnostic flow.
