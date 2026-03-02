# Auth 401 Fix — Diagnosis & Verification Report

## Root Cause

Protected endpoints (`GET /api/ads/my-ads`, `POST /api/ads`) returned HTTP 401 with
`reason: "invalid_token"` because:

1. **AUTH_SECRET inconsistency** — `jwt.sign` (login) and `jwt.verify` (middleware) were
   reading `process.env.AUTH_SECRET` via different code paths that could diverge (e.g. one
   read the raw value, another trimmed it). Even one trailing newline produces a completely
   different HS256 signature.

2. **Client logout loop** — `apiClient.ts` responded to any `invalid_token` 401 by calling
   `authService.onAuthInvalid`, which immediately cleared the session. The user was logged out
   the moment they tried to post an ad, with no recovery attempt.

---

## Changes Made

### 1. `api/src/utils/authSecret.ts` (NEW)
Single source of truth for `AUTH_SECRET`:
- `getAuthSecretStrict()` — reads `process.env.AUTH_SECRET`, trims whitespace, validates
  length ≥ 32, throws with a clear error if missing or too short.
- `getSecretFingerprint(secret)` — returns first 12 hex chars of SHA-256(secret). Safe to
  log; never reveals the raw secret.
- `getSecretDiagnostics()` — returns `{ secretLength, secretFingerprint }`.

### 2. `api/src/utils/authUtils.ts`
- Now imports and calls `getAuthSecretStrict()` for all secret reads (sign, verify, refresh).
- `getAuthSecretOrThrow()` is kept as a thin wrapper for backward compatibility.
- Startup log upgraded: `secretLength` + `secretFingerprint` are printed instead of raw length.
- `validateToken`: token `iat` and `exp` (decoded without verification) are now logged on
  every auth check so you can see in Application Insights exactly when the client token was
  issued and when it expired.

### 3. `api/src/functions/auth.ts`
- `signToken` and `refreshTokenHandler` now call `getAuthSecretStrict()` directly.
- **New endpoint**: `GET /api/auth/diag` (feature-gated by `AUTH_DIAG_ENABLED=true`).

### 4. `api/src/functions/diagnostics.ts`
- Full `/api/diagnostics/auth` response now includes `secretLength` and `secretFingerprint`
  alongside the sign/verify round-trip result.

### 5. `services/apiClient.ts`
- **Fix**: `invalid_token` 401 no longer immediately logs the user out. Instead it first
  attempts a silent token refresh (same flow as `token_expired`). Only if refresh fails is an
  `AuthError` thrown, leaving session management to the UI rather than silently destroying it.

---

## How to Reproduce the Bug

1. Deploy the old code to Azure Static Web App.
2. Log in via `POST /api/auth/login` — note the token in localStorage.
3. Immediately `POST /api/ads` with the valid `Authorization: Bearer <token>` header.
4. Observe HTTP 401 `{ reason: "invalid_token" }` in the Network panel.
5. Observe the user is redirected to the login screen (logout loop).

---

## How to Verify the Fix (Network + App Insights)

### Network panel
1. After login: `POST /api/auth/login` → 200 with a token.
2. `POST /api/ads` → 200 (no more 401).
3. If you deliberately rotate `AUTH_SECRET` mid-session: `POST /api/ads` → 401 →
   client silently calls `POST /api/auth/refresh` → retries → succeeds (or prompts
   re-login via `AuthError`, not a silent logout).

### Application Insights (Traces)
Every token validation now emits:
```
[Auth] token_header alg=HS256 iat=<unix_ts> exp=<unix_ts> requestId=<uuid>
Verifying with secretLength=64 secretFingerprint=<12-char-hex>
```

Compare `secretFingerprint` across the sign log (login function) and verify log (ads
function). If they differ, `AUTH_SECRET` is not the same in all deployment slots.

### Auth diag endpoint
Enable in Azure Application Settings:
```
AUTH_DIAG_ENABLED = true
DIAG_ALLOWLIST    = <your-allowlist-token>
```

Then call:
```
GET /api/auth/diag
X-Diag-Allowlist: <your-allowlist-token>
```

Expected response:
```json
{
  "secretLength": 64,
  "secretFingerprint": "a1b2c3d4e5f6",
  "nodeEnv": "production",
  "buildCommitSha": "<git-sha>"
}
```

Call this on every deployment slot / region. If `secretFingerprint` differs between slots,
you have found the misconfiguration.

---

## Post-Deployment Checklist

1. **Rotate AUTH_SECRET** in Azure → Static Web App → Configuration → Application settings:
   ```bash
   openssl rand -hex 32
   ```
2. **Set a fresh secret value** — must be ≥ 32 characters, no leading/trailing whitespace.
3. **Redeploy** (trigger a new GitHub Actions workflow run or manual deploy).
4. **Notify users**: existing sessions will receive a one-time `token_expired` or
   `invalid_auth_secret` 401. The client now silently refreshes; users who cannot refresh
   (token > 30 days old) will be prompted to re-login instead of being silently logged out.
5. **Clear service workers** if PWA is in use: old cached fetch handlers may intercept auth
   headers. In Chrome DevTools → Application → Service Workers → Unregister.
6. **Verify** using `GET /api/auth/diag` across all slots as described above.

---

## Expected Diag Output After Fix

```
[STARTUP] AUTH_SECRET configured secretLength=64 secretFingerprint=a1b2c3d4e5f6
[Auth] token_header alg=HS256 iat=1751234567 exp=1751839367 requestId=<uuid>
Verifying with secretLength=64 secretFingerprint=a1b2c3d4e5f6
```

If `secretFingerprint` on the "Signing" log (login) matches the "Verifying" log (ads/me),
authentication is deterministic and the 401 loop is resolved.
