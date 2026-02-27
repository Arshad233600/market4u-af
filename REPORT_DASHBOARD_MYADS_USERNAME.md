# Report: Dashboard "My Ads" Empty & Missing User Name

## Root Causes

### 1. Wrong Route Registration Order (Primary Cause of Empty "My Ads")
`GET /api/ads/my-ads` was registered **after** `GET /api/ads/{id}` in
`api/src/functions/ads.ts`. Azure Functions v4 resolves routes in registration
order, so requests to `/api/ads/my-ads` were matched by the `ads/{id}` handler
(with `id = "my-ads"`) — which returned 404 because no ad with that ID exists.
The `getMyAds` function was never reached.

### 2. Swallowed 401 in `azureService.getMyAds` (Secondary Cause)
Even when the route was correct, any authentication failure returned a silent
empty array (`catch { return []; }`). A missing or expired token would silently
produce an empty list with no feedback to the user.

### 3. Guest Fallback in `postAd` (Ownership Issue)
`postAd` allowed anonymous submissions via a shared `guest_user_0` account,
meaning ads posted without a token would never appear in any user's "My Ads"
list because their `UserId` was `guest_user_0`, not the authenticated user's ID.

### 4. Missing User Name in Header
The `Header.tsx` component rendered no profile button for logged-in users
(only an admin button for ADMIN-role accounts), so the user's name was never
displayed.

---

## Files Changed

| File | Change |
|---|---|
| `api/src/functions/ads.ts` | Moved `ads/my-ads` and `ads/user/{userId}` route registrations **before** `ads/{id}` |
| `api/src/functions/ads.ts` | `postAd` now requires authentication; returns 401 if no valid token; guest fallback removed |
| `services/azureService.ts` | Imported `ApiError`; `getMyAds` now shows toast on 401 (`لطفاً دوباره وارد شوید`) and 404 (`مسیر my-ads در سرور موجود نیست`), logs `requestId`/`category`, and re-throws `AuthError` so the caller can react |
| `components/Header.tsx` | Added profile button for all logged-in users showing `user.name` (or `user.email` as fallback), navigating to the Dashboard |

---

## Verification Steps

### Verify "My Ads" shows posted ads
1. Register or log in.
2. Post a new ad (POST `/api/ads`).
3. Navigate to Dashboard → "My Ads".
4. The newly posted ad must appear in the list.

### Verify authentication is enforced
1. Clear local storage (remove the auth token).
2. Navigate to Dashboard → "My Ads".
3. The app should show the toast "لطفاً دوباره وارد شوید" and no silent empty list.

### Verify header shows user name
1. Log in with an account that has a `Name` set in the database.
2. The header profile button should show the user's name.
3. If `Name` is empty/null, the button should fall back to the user's email.
4. Clicking the profile button navigates to the Dashboard.

### Verify route order (backend)
Inspect `api/src/functions/ads.ts` — the `app.http` registrations must appear
in this order:
```
ads          → getAds
ads/my-ads   → getMyAds        ← static routes before parameterised
ads/user/{userId} → getSellerAds
ads/{id}     → getAdDetail     ← parameterised last
```

### Verify postAd requires a token
1. Send `POST /api/ads` without an `Authorization` header.
2. The response must be `HTTP 401 Unauthorized`.
3. Guest posts are no longer accepted.
