# REPORT_SAFARI_AUTH_FIX.md — Safari / PWA Authentication Resilience

## Problem

Safari's Intelligent Tracking Prevention (ITP) can silently block `localStorage`
at runtime, even after a successful login.  In PWA / home-screen contexts the
restriction is stricter and can also affect `sessionStorage`.

**Symptoms:**
- "Tracking Prevention blocked access to storage" in Safari DevTools console.
- Token written on login is silently dropped → `getToken()` returns `null`.
- Every protected API call sends no `Authorization` header → backend returns 401.
- Repeated "نشست منقضی شده" toasts appear immediately after login.

---

## Phases Implemented

### PHASE 1 — SafeStorage class (`utils/safeStorage.ts`)

A `SafeStorage` wrapper replaces all direct `localStorage` calls.

**Fallback chain (detection at construction time):**
1. `localStorage` — preferred; survives app restarts.
2. `sessionStorage` — falls back when localStorage is blocked.
3. In-memory `Map` — last resort; data is ephemeral (lost on tab close).

All `setItem` / `getItem` / `removeItem` calls are wrapped in `try/catch` so
a `SecurityError` thrown by the browser never propagates to application code.

### PHASE 2 — Dual token persistence (`utils/safeStorage.ts`)

- **`setItem`** writes to **both** `localStorage` AND `sessionStorage` (best-effort,
  each in its own `try/catch`).  Falls back to in-memory only when both are blocked.
- **`getItem`** reads from `localStorage` first, then `sessionStorage`, then memory.

This ensures the token survives regardless of which storage backend is available
at the moment of the read (e.g. ITP blocks localStorage on second app open but
sessionStorage is still readable in that tab).

**`authService.ts`** uses `safeStorage` for all token / user reads and writes.
On login success the token is therefore persisted to both storages automatically.

### PHASE 3 — Hard verification (`services/apiClient.ts`)

Before every outgoing request:

1. **Missing-token warning** — if `authService.getToken()` returns `null`:
   ```
   [apiClient] token missing before GET /notifications — storage may be blocked
   ```
   Helps distinguish "token lost due to ITP" from "user not logged in".

2. **Protected-endpoint assertion** — if the endpoint matches
   `/user|notifications|favorites|messages|wallet|admin|upload|dashboard/`
   and no `Authorization` header was attached:
   ```
   [apiClient] protected endpoint /notifications has no Authorization header — user may lose session
   ```
   Surfaces the exact call site in DevTools without throwing an error in production.

### PHASE 4 — UX (`pages/Auth/Login.tsx`)

When `safeStorage.isAvailable()` returns `false` (i.e. the in-memory fallback is
active because both localStorage and sessionStorage are blocked), the Login page
shows a persistent yellow alert banner:

> مرورگر اجازه ذخیره‌سازی را نمیدهد. لطفاً از حالت عادی Safari یا Chrome استفاده کنید.

The banner:
- Is rendered **before** the form so it is immediately visible.
- Uses `role="alert"` for screen-reader accessibility.
- Disappears automatically if the user switches to a browser that allows storage
  (the check is synchronous at component render time).

---

## Files Changed

| File | Change |
|------|--------|
| `utils/safeStorage.ts` | SafeStorage class with LS→SS→memory fallback, dual-write setItem, dual-read getItem |
| `services/authService.ts` | All storage calls use `safeStorage` instead of `localStorage` directly |
| `services/apiClient.ts` | PHASE 3: console.warn for missing token + protected-endpoint assertion |
| `pages/Auth/Login.tsx` | PHASE 4: storage-blocked UX banner |

---

## Verification

### 1. Simulate ITP storage block (Safari DevTools)

In Safari > Develop > Experimental Features, enable "Intelligent Tracking Prevention Debug Mode".
Visit the app, log in, then reload:

```javascript
// In DevTools console after reload, both should be non-null:
localStorage.getItem('bazar_af_token')
sessionStorage.getItem('bazar_af_token')
```

### 2. Simulate full storage block (in-memory fallback)

Add the following **before** the app loads to simulate both storages blocked:

```javascript
Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); };
```

Expected:
- Login page shows the yellow Arabic warning banner.
- Login still succeeds (token held in memory for the session duration).
- `[apiClient] token missing …` warnings appear in the console on the next app reload
  (token was not persisted).

### 3. Verify console warnings for protected endpoints

Log in, then manually clear the token from all storages:

```javascript
localStorage.removeItem('bazar_af_token');
sessionStorage.removeItem('bazar_af_token');
```

Navigate to Dashboard. The console should show:
```
[apiClient] token missing before GET /notifications — storage may be blocked
[apiClient] protected endpoint /notifications has no Authorization header — user may lose session
```

### 4. Verify dual-write

After login:
```javascript
localStorage.getItem('bazar_af_token')    // non-null
sessionStorage.getItem('bazar_af_token')  // non-null
```
