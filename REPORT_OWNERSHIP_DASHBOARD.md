# REPORT_OWNERSHIP_DASHBOARD.md

## Summary

Two inter-related bugs prevented ad ownership and user profile display from working correctly:

1. **Dashboard "آگهی‌های من" showed 0 ads** — caused by a route-registration conflict in the Azure Functions backend.
2. **Ads posted without user linkage** — caused by the guest fallback (`guest_user_0`) being allowed even for authenticated users if the token ever failed validation.
3. **User name absent from site header** — for regular (non-ADMIN) logged-in users, the Header component rendered an empty `<div>` instead of the user's name.

---

## Root Cause

### Bug 1 — Route Conflict (`ads/my-ads` matched by `ads/{id}`)

**File:** `api/src/functions/ads.ts`

The Azure Functions route registrations were ordered as follows:

```
app.http("getAdDetail",  route: "ads/{id}",     ← registered FIRST
app.http("getMyAds",     route: "ads/my-ads",   ← registered SECOND
```

In the Azure Functions v4 Node.js programming model, when `ads/{id}` is registered before the literal route `ads/my-ads`, a `GET /api/ads/my-ads` request is matched by the parameterised route with `{id} = "my-ads"`, invoking `getAdDetail` instead of `getMyAds`. `getAdDetail` queries `SELECT … WHERE Id = 'my-ads'`, finds nothing, and returns `HTTP 404`. The `azureService.getMyAds` catch block silently returns `[]`, causing the dashboard to display zero ads.

**Evidence:**
- `getAdDetail` returns `{ error: "Not found" }` for any non-existent ad ID.
- `azureService.getMyAds` catches all errors and returns `[]`.
- Dashboard shows `0` regardless of how many ads the user has posted.

### Bug 2 — Guest Fallback in `postAd`

**File:** `api/src/functions/ads.ts`

```typescript
// BEFORE (buggy):
const GUEST_USER_ID = 'guest_user_0';
const userId = auth.isAuthenticated && auth.userId ? auth.userId : GUEST_USER_ID;
```

Any edge-case where token validation silently failed (e.g., transient `AUTH_SECRET` misconfiguration, network replay, slightly clock-skewed `iat`) caused ads to be written with `UserId = 'guest_user_0'`. Those ads were publicly visible (status `ACTIVE`) but never appeared in the authenticated user's dashboard query (`WHERE UserId = @realUserId`).

### Bug 3 — User Name Not Shown in Header

**File:** `components/Header.tsx`

For regular (non-ADMIN) authenticated users, the Header's user block rendered:
```tsx
{user ? (
  <div className="flex items-center gap-1.5">
    {user.role === 'ADMIN' && <button>مدیریت</button>}
    {/* Nothing for regular users */}
  </div>
) : <button>ورود</button>}
```

Regular users saw no visual indication that they were logged in; their name was never displayed.

---

## Exact Files Changed

| File | Change |
|---|---|
| `api/src/functions/ads.ts` | 1) Reorder route registrations: `getMyAds` and `getSellerAds` registered **before** `getAdDetail`. 2) `postAd` now requires authentication (returns `HTTP 401` if not authenticated). 3) Removed `guest_user_0` fallback and in-memory IP rate-limit map (only needed for guest posting). 4) Added safe structured log: `auth.ok=true resolvedUserId=<id> isGuest=false`. |
| `components/Header.tsx` | Added user name + profile button for regular logged-in users. |

---

## Fix Details

### Fix 1 — Route Ordering

```typescript
// AFTER (correct order):
app.http("getAds",       { route: "ads",           ... });
app.http("getMyAds",     { route: "ads/my-ads",    ... }); // literal BEFORE parameterised
app.http("getSellerAds", { route: "ads/user/{userId}", ... }); // literal prefix BEFORE {id}
app.http("getAdDetail",  { route: "ads/{id}",      ... }); // parameterised LAST
```

### Fix 2 — Require Authentication for `postAd`

```typescript
// AFTER:
const auth = validateToken(request);
if (!auth.isAuthenticated || !auth.userId) {
  return { status: 401, jsonBody: { error: "احراز هویت الزامی است.", category: "AUTH_REQUIRED", reason: auth.reason ?? "missing_token" } };
}
const userId = auth.userId; // always the real user, never guest
```

### Fix 3 — Header User Name

```tsx
// AFTER (Header.tsx):
<button onClick={() => onNavigate(Page.DASHBOARD)} ...>
  <Icon name="User" ... />
  <span>{user.name || 'پروفایل'}</span>
</button>
```

---

## Verification Steps

1. **Login** as a real user (email + password).
2. **Post an ad** → backend returns `HTTP 201 + { success: true, id, requestId }`.
   - Confirm log line: `[postAd] ads.create.begin … auth.ok=true resolvedUserId=<userId> isGuest=false`
3. **Open Dashboard → "آگهی‌های من"** → ad appears in the list.
   - `GET /api/ads/my-ads` now calls `getMyAds` (not `getAdDetail`), returning the user's ads.
4. **Header** shows the user's name (e.g., "احمد شاه") with a "پروفایل" button.
5. **Public ad page** shows the correct seller name (from `LEFT JOIN Users`).

---

## Data Repair (Existing Ads Under guest_user_0)

Ads already committed under `UserId = 'guest_user_0'` before this fix cannot be automatically reassigned (no session-to-user mapping was logged). The following SQL identifies them:

```sql
SELECT Id, Title, CreatedAt
FROM Ads
WHERE UserId = 'guest_user_0' AND IsDeleted = 0
ORDER BY CreatedAt DESC;
```

If you can correlate an ad's `CreatedAt` timestamp with a user's registration/session time, you may reassign it:

```sql
UPDATE Ads
SET UserId = '<real_user_id>'
WHERE Id = '<ad_id>' AND UserId = 'guest_user_0';
```

Otherwise, leave them as guest. New posts from this fix onwards will always be linked to the authenticated user.

---

## Security Notes

- No secrets or tokens are logged. Only `userId` (non-sensitive DB primary key) is included in log lines.
- The `AUTH_REQUIRED` 401 response does not expose internal error detail — only the structured `reason` field.
- Guest posting is now entirely blocked; this removes the `guest_user_0` shared-account attack surface.
