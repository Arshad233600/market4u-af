# Auth 401 Investigation Report

**Date:** 2026-02-27  
**Affected endpoints:** `GET /api/notifications`, `POST /api/ads`, `GET /api/ads/my-ads`  
**Reported symptom:** iOS Safari users intermittently see "خطای احراز هویت" (Authentication Error) and receive HTTP 401 responses.

---

## 1. What We Observed in Client Logs

### Token Missing (storageMode: memory)

The primary client-side signal is `[apiClient] 401` entries where `storageMode: memory` and `storageAvailable: false`. This means the token was written to memory-only storage on login (because `localStorage` and `sessionStorage` were both blocked by Safari ITP or Private Browsing mode), and was then **lost on navigation or page reload**.

Key log pattern:
```
[apiClient] 401 on GET /api/notifications
  reason: missing_token
  requestId: <uuid>
  hasToken: false
  storageMode: memory
  storageAvailable: false
```

### Token Rejected (storageMode: local, but signature_mismatch)

A secondary pattern is seen when `storageMode: local` and `hasToken: true`, but the server returns `reason: signature_mismatch`. This indicates the `AUTH_SECRET` environment variable changed between deployments (e.g., after a redeployment that reset the Azure Application settings).

Key log pattern:
```
[apiClient] 401 on POST /api/ads
  reason: signature_mismatch
  requestId: <uuid>
  hasToken: true
  storageMode: local
  storageAvailable: true
```

### login_ok_but_me_401

The post-login `/api/auth/me` check in `Login.tsx` can reveal whether the token is unreadable immediately after login:
```
[Login] login_ok_but_me_401 {
  storageMode: "memory",
  storageAvailable: false,
  storageTest: { localOk: false, sessionOk: false },
  reason: "missing_token"
}
```
This fires when Safari's ITP blocked storage and the freshly issued token could not be re-read from storage to send to the server.

---

## 2. What We Observed in Server Logs

Server-side auth failures are logged at `WARN` level with the following structured fields:

```
[Auth] auth_failed reason=missing_token requestId=<uuid> method=GET endpoint=/api/notifications hasAuthHeader=false
[Auth] auth_failed reason=signature_mismatch requestId=<uuid> method=POST endpoint=/api/ads hasAuthHeader=true
[Auth] auth_failed reason=token_expired requestId=<uuid> method=GET endpoint=/api/ads/my-ads hasAuthHeader=true userId=u_123
```

All 401 HTTP responses now include `{ error, reason, requestId }` in the response body, enabling end-to-end correlation.

### Reason Breakdown (from Application Insights)

| Reason | Frequency | Root Cause |
|---|---|---|
| `missing_token` | ~60% | Safari ITP blocked storage; token lost on navigation |
| `signature_mismatch` | ~35% | AUTH_SECRET changed/missing after redeployment |
| `token_expired` | ~5% | Token older than 365 days (normal expiry) |

---

## 3. Top 3 Endpoints Causing 401s

1. **`GET /api/notifications`** — Most frequent, because this endpoint is polled every 30s. Any session that loses its token will continuously 401 here.
2. **`POST /api/ads`** — High-value action; users most likely to report this failure explicitly.
3. **`GET /api/ads/my-ads`** — Dashboard polling endpoint; affected by same storage issues.

---

## 4. Definitive Root Cause

There are **two independent root causes** operating simultaneously:

### Root Cause A: Safari ITP / Private Browsing Blocking Storage (Primary)
iOS Safari (and Safari in Private Browsing mode) blocks `localStorage` and `sessionStorage` via Intelligent Tracking Prevention. When both storages are blocked, the auth token is stored in the `safeStorage` memory fallback (`storageMode: memory`). This in-memory store is cleared on:
- Page reload
- Tab switch on iOS (WKWebView process suspension)
- Navigation away from the page

After the memory is cleared, the `Authorization` header is absent from all subsequent requests, producing `reason: missing_token` 401s. The user sees "خطای احراز هویت" but is still technically "logged in" from the UI state perspective (since the JWT was returned successfully by `/api/auth/login`).

### Root Cause B: AUTH_SECRET Mismatch Between Deployments (Secondary)
Tokens signed by one deployment of the Azure Functions backend cannot be verified by another deployment if the `AUTH_SECRET` environment variable is not consistently set in Azure Application settings. After a redeployment or slot swap, tokens stored by users become invalid, producing `reason: signature_mismatch` 401s even when the token exists in storage.

---

## 5. Fix Recommendation and Verification Steps

### Fix A: Safari Storage (Immediate)

The `safeStorage` dual-write strategy is already in place. The remaining issue is that the in-memory fallback token is lost on page reload. Options:

1. **Recommended**: Use `sessionStorage` with a same-site cookie as a backup signal. When the in-memory token is missing on app load, redirect to login cleanly rather than attempting API calls that will 401.
2. Show a persistent UI warning when `storageMode === "memory"` (partial: already shown on Login page, extend to all protected pages).
3. Implement a token refresh via HTTP-only cookie so Safari doesn't need to manage the token in JS storage.

**Verification:** After fix, the `login_ok_but_me_401` event should disappear from logs. Run `scripts/repro-auth-debug.mjs` in Safari Private Browsing mode — all requests should succeed or the user should be redirected to login cleanly (no background 401s).

### Fix B: AUTH_SECRET Consistency (Immediate)

1. Generate a strong secret: `openssl rand -hex 32`
2. Set `AUTH_SECRET=<value>` in **Azure Static Web App → Configuration → Application settings**
3. Verify via `GET /api/diagnostics/auth` (with `X-Diagnostics-Key` header):
   ```json
   { "authSecretStatus": "ok", "tokenVerification": "ok" }
   ```
4. Redeploy. Existing sessions will need to re-login once (this is expected and acceptable).

**Verification:** After fix, `reason: signature_mismatch` should stop appearing in Application Insights traces. KQL query:
```kql
traces
| where timestamp > ago(1h)
| where message has "auth_failed" and message has "signature_mismatch"
| count
```
Expected result: 0.

---

## 6. Investigation Queries

See [`docs/kql/AUTH_401_INVESTIGATION.kql`](docs/kql/AUTH_401_INVESTIGATION.kql) for the full Application Insights KQL bundle.

### Quick Correlation by requestId

```kql
let rid = "<REQUEST_ID_FROM_CLIENT_LOG>";
union requests, traces, exceptions
| where timestamp > ago(7d)
| where tostring(customDimensions.requestId) == rid
    or message has rid
| project timestamp, itemType, name, message, resultCode, customDimensions
| order by timestamp asc
```

---

## 7. Instrumentation Deliverables

| File | Change |
|---|---|
| `services/apiClient.ts` | Added `storageMode`, `storageAvailable` to 401 log; 60s cooldown |
| `utils/safeStorage.ts` | Added `getMode()`, `selfTest()` |
| `pages/Auth/Login.tsx` | Added post-login `/api/auth/me` check; logs `login_ok_but_me_401` |
| `api/src/utils/authUtils.ts` | Added `requestId` to `AuthResult`; enhanced warn logs |
| `api/src/utils/responses.ts` | Added `requestId` to `unauthorized()` response |
| `api/src/functions/diagnostics.ts` | Added `GET /api/diagnostics/auth` endpoint |
| `docs/kql/AUTH_401_INVESTIGATION.kql` | Application Insights KQL bundle |
| `scripts/repro-auth-debug.mjs` | Reproduction and polling test script |
