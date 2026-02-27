# REPORT_AUTH_IOS.md — iOS Safari Auth Error Investigation & Fixes

## Root Cause Analysis

### Primary Cause: Safari Intelligent Tracking Prevention (ITP) blocks localStorage

iOS Safari's Tracking Prevention can silently block `localStorage` access at runtime,
even after a successful login. When this happens:

1. The token returned by `/api/auth/login` is written to `localStorage` — but the write is silently dropped or throws `SecurityError`.
2. On the next app open (or after a tab switch), `getToken()` reads `null` from storage.
3. Every protected API call sends no `Authorization` header.
4. The backend returns `401 { error: "Unauthorized", reason: "missing_token" }`.
5. `apiClient` shows `"خطای احراز هویت"` toast — repeatedly, on every poll cycle.

This explains the reported symptoms:
- "Tracking Prevention blocked access to storage" warnings in Safari DevTools.
- Auth-error toasts appearing immediately after a successful login.
- 401 responses from GET /api/notifications (a polling endpoint), causing toast spam.

### Secondary Cause: AUTH_SECRET misconfiguration returns 401 instead of 503

When `AUTH_SECRET` is missing or set to the insecure default `"CHANGE_ME_IN_AZURE"`,
`validateToken()` returns `{ isAuthenticated: false, reason: "missing_auth_secret" }`.
Handlers were converting this to a 401 — indistinguishable from a real client error.
Operators could not tell from the response whether the problem was client-side or server config.

---

## Fixes Applied

### PHASE 2 — StorageAdapter (dual-write) — `utils/safeStorage.ts`

**Before:** `SafeStorage` picks ONE backend (localStorage OR sessionStorage OR memory)
at construction time and only reads/writes to that one backend.

**After:**
- `setItem` writes to **both** `localStorage` and `sessionStorage` (best-effort, each in its own `try/catch`). Falls back to in-memory only if both are blocked.
- `getItem` reads from `localStorage` first, then `sessionStorage`, then memory.

This means the token survives even if:
- Safari's ITP blocks `localStorage` at a random later point (token is still in `sessionStorage`).
- A fresh tab opens and `sessionStorage` is empty (token is still in `localStorage`).

### PHASE 1 — Enhanced 401 logging — `services/apiClient.ts`

Every 401 now logs:
```
[apiClient] 401 on GET /notifications reason: missing_token requestId: <uuid> hasToken: false
```
Fields: endpoint, reason (from backend JSON), requestId (from response or correlation ID), hasToken (boolean).

### PHASE 3 — Toast spam prevention — `services/toastService.ts`

Added `authWarning(msg)` method with a **60-second cooldown**.
The notification polling endpoint fires every few seconds; without a cooldown,
each 401 generates a new toast. Now at most one auth-error toast is shown per minute.

### PHASE 5 — Differentiated UX messages — `services/apiClient.ts`

| Condition | Message shown |
|-----------|---------------|
| 401 + no token in storage | "توکن ذخیره نشده. Safari مانع ذخیره‌سازی شد. لطفاً از Chrome یا حالت عادی Safari استفاده کنید." |
| 401 + token present but rejected | "نشست شما منقضی شده. دوباره وارد شوید." |

### PHASE 4 — Backend 503 for misconfigured AUTH_SECRET — `api/src/utils/authUtils.ts` + `api/src/utils/responses.ts`

Added `authResponse(auth)` helper:
- Returns `null` on success (authenticated).
- Returns **503** with `{ error: "misconfigured_auth", reason: "missing_auth_secret" | "insecure_default_secret" }` when AUTH_SECRET is not set or uses the default value.
- Returns **401** for all real client auth failures (expired token, signature mismatch, missing token from client).

Added `serviceUnavailable(reason)` response builder in `responses.ts`.

All protected API handlers (ads, notifications, messages, dashboard, favorites, user, wallet, auth) updated to use `authResponse(auth)`.

Added startup check in `api/src/index.ts` that logs a loud warning if `AUTH_SECRET` is insecure on server start.

---

## Verification Steps

### 1. Verify dual-write storage

In Safari DevTools > Application > Storage:
```javascript
// After login, both should have the token:
localStorage.getItem('bazar_af_token')    // should not be null
sessionStorage.getItem('bazar_af_token')  // should not be null
```

### 2. Verify 401 logging

In Safari DevTools > Console, filter `[apiClient] 401`:
```
[apiClient] 401 on GET /notifications reason: missing_token requestId: abc-123 hasToken: false
```
Confirms the token was not attached (storage blocked) rather than rejected by the server.

### 3. Verify toast cooldown

Open Network Throttling to "Offline" for 5 seconds, then restore. Multiple 401s should
produce only **one** toast, not a toast per request.

### 4. Verify differentiated messages

- Block `localStorage` via ITP simulation → login → navigate: should see the Safari-specific message.
- Let token expire (or use a malformed token) → reload: should see "نشست شما منقضی شده".

### 5. Verify 503 for misconfigured AUTH_SECRET

```bash
# Temporarily unset AUTH_SECRET in Azure Application Settings.
# Any protected endpoint should now return:
curl -H "Authorization: Bearer test" https://<your-app>/api/ads/my-ads
# Expected: 503 { "success": false, "error": "misconfigured_auth", "reason": "missing_auth_secret" }
# (not 401)
```

### 6. Confirm AUTH_SECRET in Azure

In Azure Portal > App Service > Configuration > Application Settings:
- `AUTH_SECRET` must be set to a random value ≥ 32 characters.
- It must **not** be `"CHANGE_ME_IN_AZURE"`.
- The `/api/health` endpoint reports `authSecret: "ok"` when configured correctly.

---

## Files Changed

| File | Change |
|------|--------|
| `utils/safeStorage.ts` | Dual-write setItem + dual-read getItem |
| `services/apiClient.ts` | requestId logging, differentiated toast messages, 60s cooldown |
| `services/toastService.ts` | Added `authWarning()` with 60-second cooldown |
| `api/src/utils/authUtils.ts` | Added `authResponse()` helper (503 for secret misconfiguration) |
| `api/src/utils/responses.ts` | Added `serviceUnavailable()` helper |
| `api/src/index.ts` | Startup check that warns on insecure AUTH_SECRET |
| `api/src/functions/ads.ts` | Use `authResponse()` in all protected handlers |
| `api/src/functions/notifications.ts` | Use `authResponse()` |
| `api/src/functions/messages.ts` | Use `authResponse()` |
| `api/src/functions/dashboard.ts` | Use `authResponse()` |
| `api/src/functions/favorites.ts` | Use `authResponse()` |
| `api/src/functions/user.ts` | Use `authResponse()` |
| `api/src/functions/wallet.ts` | Use `authResponse()` |
| `api/src/functions/auth.ts` | Use `authResponse()` in getMe |
| `api/src/functions/admin.ts` | Use `authResponse()` in requireAdmin |
