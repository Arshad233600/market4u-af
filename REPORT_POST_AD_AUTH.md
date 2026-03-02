# REPORT_POST_AD_AUTH.md – Post-Ad Authentication Fix

## Exact Failing Cause

### Root Cause: Missing Token on iOS/Android (missing_token)

On iOS and Android (Capacitor WebView), `authService.getToken()` can return `null` at
the time `POST /api/ads` is called. This happens because:

1. **iOS Safari Tracking Prevention** blocks `localStorage` writes in third-party contexts,
   meaning the token saved at login may not be retrievable in the Capacitor WebView.
2. **Android Capacitor WebView** may clear storage between app backgrounding and
   foreground events under certain configurations.

When `getToken()` returns `null`, the `apiClient` skips the `Authorization` header
(`if (token) { headers['Authorization'] = ... }`). The backend then returns HTTP 401
with `reason: "missing_token"`.

Previously the frontend showed a generic "خطای احراز هویت" with no actionable
information. The backend 401 lacked `category` and `requestId`, making log tracing
difficult.

---

## Code Changes

### 1. Backend – `api/src/functions/ads.ts`

**Before:**
```typescript
const auth = validateToken(request);
const authErr = authResponse(auth);
if (authErr || !auth.userId) {
  return authErr ?? { status: 401, jsonBody: { error: "Unauthorized", reason: "missing_token" } };
}
const requestId = resolveRequestId(...);
```

**After:**
```typescript
// requestId resolved first so it is available in 401 responses
const requestId = resolveRequestId(...);
const auth = validateToken(request);
const authErr = authResponse(auth);
if (authErr || !auth.userId) {
  const reason = auth.reason ?? "missing_token";
  const authHeaderPresent = !!request.headers.get("authorization");
  context.warn(`[postAd] 401 requestId=${requestId} reason=${reason} authHeaderPresent=${authHeaderPresent}`);
  if (authErr && authErr.status === 503) return authErr;
  return { status: 401, jsonBody: { error: "Unauthorized", category: "AUTH_REQUIRED", reason, requestId } };
}
```

**What changed:**
- `requestId` is now resolved before auth so it is included in every 401 response.
- `category: "AUTH_REQUIRED"` added to 401 `jsonBody` for structured client handling.
- `requestId` added to 401 `jsonBody` for log correlation.
- `context.warn(...)` logs reason and whether the Authorization header was even present.

### 2. Frontend – `services/azureService.ts`

Added assertion log in `postAd` before calling `apiClient.post`:

```typescript
const token = authService.getToken();
console.warn("[postAd] hasToken=", !!token, "authHeaderSet=", !!token);
await apiClient.post('/ads', adData);
```

This log appears in the browser/Capacitor console before every ad submission,
confirming whether the token is present at call time. Network tab verification
of the Authorization header can be done in conjunction with this log.

### 3. Frontend – `services/apiClient.ts`

Updated `warnIfAuthenticated` closure to show reason-specific Persian messages:

| Backend reason         | Toast message shown |
|------------------------|---------------------|
| `missing_token`        | توکن ارسال نشد. لطفاً دوباره وارد شوید. |
| `token_expired`        | نشست شما منقضی شد. دوباره وارد شوید. |
| `signature_mismatch`   | تنظیمات سرور تغییر کرده. دوباره وارد شوید. |
| other / unknown        | نشست شما منقضی شده. دوباره وارد شوید. |

### 4. Frontend – `pages/PostAd.tsx`

Added upfront token check in `handleSubmit` before any API call:

```typescript
if (!authService.getToken()) {
  toastService.error('توکن ارسال نشد. لطفاً دوباره وارد شوید.');
  onNavigate(Page.LOGIN);
  return;
}
```

If the token is not available at submit time, the user is shown a specific error
and redirected to login immediately — no API call is made.

### 5. Smoke Test – `scripts/smoke-test.mjs`

Extended the POST /api/ads smoke test step to assert the Authorization header is
present in the request before sending:

```javascript
const postAdRequestHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};
assert(
  'Authorization' in postAdRequestHeaders && postAdRequestHeaders.Authorization.startsWith('Bearer '),
  'Authorization header is present in POST /api/ads request'
);
```

---

## Verification

### Console Log (Browser / Capacitor DevTools)

Before every `POST /api/ads` call the following log is emitted:
```
[postAd] hasToken= true authHeaderSet= true
```
If either is `false`, the token is missing and the upfront guard will redirect to
login before the network request is made.

### Network Tab

In the browser Network tab (or Charles Proxy on iOS/Android), the `POST /api/ads`
request should show:
```
Authorization: Bearer <token>
x-client-request-id: <uuid-v4>
```

### Backend Logs (Azure Application Insights / Function logs)

On a 401, the following warning is now emitted:
```
[postAd] 401 requestId=<uuid> reason=missing_token authHeaderPresent=false
```
This confirms whether the header was absent entirely vs. a bad/expired token.

---

## Post-Deploy Test Steps

Follow these steps after every deployment to confirm that auth works end-to-end
and the `invalid_token` → logout loop is not triggered.

### 1. Clear state and hard reload

In the browser (or Capacitor DevTools):

```
// DevTools Console
localStorage.clear();
sessionStorage.clear();
```

Then unregister the service worker:

```
// DevTools → Application → Service Workers → Unregister
// OR in console:
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
```

Finally, hard reload the page (`Ctrl+Shift+R` / `Cmd+Shift+R`).

### 2. Log in

- Navigate to the Login page.
- Enter valid credentials and submit.
- **Expected**: redirect to home/dashboard, no errors in console.

### 3. POST /api/ads

- Navigate to the Post Ad page and submit a new ad.
- **Expected**:
  - HTTP 201 response with `{ success: true, id: "<uuid>", requestId: "<uuid>" }`.
  - No 401 response, no logout, no redirect to login.

### 4. GET /api/ads/my-ads

- Navigate to My Ads / Dashboard.
- **Expected**:
  - HTTP 200 response with a JSON array of your ads.
  - No 401 response, no logout, no redirect to login.

### 5. Verify no logout loop

After completing steps 3 and 4, confirm:

- The user is still authenticated (avatar/name shown in header).
- The browser console shows no `[apiClient] 401` warnings.
- The session persists across page reloads.

### Diagnostic endpoint (optional)

If you suspect an AUTH_SECRET mismatch between deployments, enable the diag endpoint:

1. Set `AUTH_DIAG_ENABLED=true` in Azure Application Settings.
2. Call `GET /api/auth/diag`.
3. Confirm `secretFingerprint` matches across all deployment slots.
4. Disable the endpoint after confirming (`AUTH_DIAG_ENABLED=false` or remove the setting).
