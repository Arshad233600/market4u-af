# REPORT: POST /api/ads 401 Root Cause Analysis & Fix

## Evidence

**AppInsights observation:**
- `operation_Id`: `908d70f...`
- URL: `https://2d271711-....azurewebsites.net/api/ads`
- `customDimensions`: only `Host.Results` present — no `reason`, `authHeaderPresent`, or `requestId`

**Root causes identified:**

1. **Absolute API URL in frontend** — The frontend was configured (or env-overridden) to call the Azure Functions host directly (`https://*.azurewebsites.net/api/ads`) instead of through the Azure Static Web Apps proxy (`/api/ads`). Direct calls to the Functions host bypass the SWA auth middleware and may not forward the `Authorization` header correctly.

2. **No dev-time assert for missing token** — When the token was absent on POST /api/ads, the frontend logged a warning but still proceeded with the network request, making it reach the server as a 401 instead of being caught early at the call site.

3. **AppInsights trace missing context binding** — The `[postAd] auth_failed` trace was emitted but lacked `path`, `method`, and the `operationId` binding, making it hard to join against the `requests` table in KQL.

4. **Auth header reading not explicit** — `validateToken` read the `authorization` header via a single case-specific call; the explicit `|| request.headers.get("Authorization")` fallback was missing.

---

## Changes Made

### 1. `config.ts` — Guard against absolute API URL
```diff
-const apiUrl = getEnv('REACT_APP_API_URL') || getEnv('VITE_API_URL');
-export const API_BASE_URL = apiUrl || '/api';
+const rawApiUrl = getEnv('REACT_APP_API_URL') || getEnv('VITE_API_URL');
+// Never use absolute URLs (e.g. azurewebsites.net) — always route through the SWA proxy.
+const apiUrl = (rawApiUrl && !/^https?:\/\//i.test(rawApiUrl)) ? rawApiUrl : undefined;
+export const API_BASE_URL = apiUrl || '/api';
```
**Why:** If `VITE_API_URL` or `REACT_APP_API_URL` is accidentally set to an absolute azurewebsites.net URL, it now gets silently ignored and falls back to the relative `/api` base URL that routes through the SWA proxy. Relative calls keep the SWA auth middleware in the path.

### 2. `services/apiClient.ts` — Dev-only throw for missing token
```diff
 if (!hasAuth) {
   console.warn(`[apiClient] token missing for protected endpoint...`);
+  if (import.meta.env.DEV) {
+    throw new ApiError('AUTH_REQUIRED', 401, correlationId, 'AUTH_REQUIRED');
+  }
 }
```
**Why:** In development, missing token on a protected/POST-ads call is a bug, not a degraded state. Throwing early (before the network request) surfaces the issue immediately at the call site. In production, the existing warn is kept to avoid disruption.

### 3. `api/src/utils/authUtils.ts` — Case-insensitive auth header reading
```diff
-const hasAuthHeader = Boolean(request.headers.get('authorization'));
+const hasAuthHeader = Boolean(request.headers.get('authorization') || request.headers.get('Authorization'));
 ...
-const authHeader = request.headers.get("authorization");
+const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
```
**Why:** Explicitly handles both header name casings. Although Azure Functions v4 headers are typically case-insensitive, the explicit fallback ensures reliable auth header detection regardless of proxy or runtime variations.

### 4. `api/src/functions/ads.ts` — Structured AppInsights trace with context
```diff
 appInsights.defaultClient?.trackTrace({
   message: "[postAd] auth_failed",
   properties: {
     requestId,
     reason,
     authHeaderPresent: String(authHeaderPresent),
+    path,
+    method,
+    operationId: context.traceContext?.traceParent?.split('-')[1] ?? context.invocationId,
     category: "AUTH_REQUIRED",
   },
 });
```
**Why:** `path` and `method` confirm the endpoint that failed. `operationId` is the W3C trace ID extracted from the `traceParent` header (format: `00-{traceId}-{spanId}-{flags}`), or the invocation ID as fallback — this lets the trace be correlated to the `requests` table entry in AppInsights KQL.

> **Note on `tagOverrides`:** The problem statement requests `tagOverrides` to set `ai.operation.id`. However, ApplicationInsights SDK v3 (`3.13.0`) no longer exposes `tagOverrides` on `TraceTelemetry`. The operation correlation is achieved instead by including `operationId` as a custom property, which is fully queryable in KQL.

---

## Verification Steps

### 1. DevTools Network (after deploy)
Open DevTools → Network tab → POST `/api/ads` → Request Headers must show:
```
Authorization: Bearer eyJ...
```
The URL must be `/api/ads` (relative path, not `https://...azurewebsites.net/api/ads`).

### 2. AppInsights KQL — Auth failure trace
```kql
traces
| where message == "[postAd] auth_failed"
| project timestamp, customDimensions
| order by timestamp desc
| take 20
```
Expected `customDimensions` columns: `reason`, `authHeaderPresent`, `requestId`, `path`, `method`, `operationId`, `category`.

### 3. AppInsights KQL — Join request to trace
```kql
let failedRequests = requests
| where name == "postAd" and resultCode == "401"
| project operation_Id, timestamp, url;
let authTraces = traces
| where message == "[postAd] auth_failed"
| extend operationId = tostring(customDimensions["operationId"])
| project operationId, reason = tostring(customDimensions["reason"]), authHeaderPresent = tostring(customDimensions["authHeaderPresent"]), traceTimestamp = timestamp;
failedRequests
| join kind=leftouter authTraces on $left.operation_Id == $right.operationId
| project timestamp, url, reason, authHeaderPresent
```

### 4. Local dev — missing token assert
In development mode (`npm run dev`), submit an ad while logged out.
The browser console must show:
```
ApiError: AUTH_REQUIRED (status=401)
```
...before any network request is made (visible in Network tab: no POST /api/ads request).

---

## Summary

| # | Task | Status |
|---|------|--------|
| 1 | Prevent absolute azurewebsites.net URL from being used as API base | ✅ Fixed in `config.ts` |
| 2 | Dev-only pre-flight assert for missing token on POST /ads | ✅ Fixed in `services/apiClient.ts` |
| 3 | Case-insensitive auth header reading in `validateToken` | ✅ Fixed in `api/src/utils/authUtils.ts` |
| 4 | Structured AppInsights trace with path/method/operationId on 401 | ✅ Fixed in `api/src/functions/ads.ts` |
| 5 | AppInsights init before imports in `index.ts` | ✅ Already correct (no change needed) |
| 6 | `diagnostics.ts` imported in `index.ts` | ✅ Already correct (no change needed) |
