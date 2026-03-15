
import { User } from '../types';
import { API_BASE_URL, USE_MOCK_DATA } from '../config';
import { safeStorage } from '../utils/safeStorage';

const STORAGE_KEY_USER = 'bazar_af_user';
const STORAGE_KEY_TOKEN = 'bazar_af_token';
const STORAGE_KEY_REFRESH_TOKEN = 'bazar_af_refresh_token';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (matches server TOKEN_EXPIRATION_SECONDS)
// Proactively treat tokens expiring within this window as already expired so the
// client refreshes before the server rejects them. This prevents DevTools 401 errors
// caused by minor clock skew between the browser and the server.
const TOKEN_EXPIRY_BUFFER_SECONDS = 30;

// Mock Data for Offline/Demo Mode
const MOCK_USER: User = {
  id: 'user_123',
  name: 'احمد شاه',
  phone: '0799999999',
  email: 'ahmad@example.com',
  avatarUrl: '',
  isVerified: true,
  joinDate: '۱۴۰۲/۰۱/۰۱',
  role: 'USER'
};

export const authService = {
  // Get Current User
  getCurrentUser: (): User | null => {
    try {
        const stored = safeStorage.getItem(STORAGE_KEY_USER);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
  },

  // Get JWT Token for API Calls
  getToken: (): string | null => {
    try {
      const token = safeStorage.getItem(STORAGE_KEY_TOKEN);
      if (!token) return null;
      // In production mode, mock tokens from a previous demo/mock session are invalid
      // against the real backend and would trigger an immediate 401 → logout loop.
      // Detect and clear them so the user is shown the login screen cleanly.
      if (!USE_MOCK_DATA && (/^mock_token_/.test(token) || /^google_mock_token$/i.test(token))) {
        // Track telemetry event without leaking the token value
        console.warn('[auth] auth.mock_token_detected_in_production — clearing stale mock session');
        safeStorage.removeItem(STORAGE_KEY_TOKEN);
        safeStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
        safeStorage.removeItem(STORAGE_KEY_USER);
        // Notify the UI so React state reflects the cleared session immediately,
        // rather than waiting for a subsequent 401 to trigger the logout flow.
        window.dispatchEvent(new Event('auth-change'));
        return null;
      }
      // The server issues standard 3-part JWTs (header.payload.signature via jwt.sign HS256).
      // Old 2-part tokens from a previous custom HMAC implementation are no longer accepted.
      // Detect and clear any non-standard token so the user is prompted to re-authenticate.
      if (!USE_MOCK_DATA && token.split('.').length !== 3) {
        console.warn('[auth] token_format_invalid — clearing stale token (expected standard 3-part JWT)');
        safeStorage.removeItem(STORAGE_KEY_TOKEN);
        safeStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
        safeStorage.removeItem(STORAGE_KEY_USER);
        window.dispatchEvent(new Event('auth-change'));
        return null;
      }
      // Validate the JWT payload contains the required `uid` claim that the server
      // uses for authentication. Tokens missing `uid` would be rejected by the server
      // with reason "invalid_token" (401). Detect and clear them client-side so the
      // user is prompted to re-authenticate cleanly instead of getting a 401 error.
      if (!USE_MOCK_DATA) {
        try {
          const parts = token.split('.');
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          if (!payload.uid) {
            console.warn('[auth] token_missing_uid — clearing stale token (expected uid claim in JWT payload)');
            safeStorage.removeItem(STORAGE_KEY_TOKEN);
            safeStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
            safeStorage.removeItem(STORAGE_KEY_USER);
            window.dispatchEvent(new Event('auth-change'));
            return null;
          }
        } catch {
          // If we can't decode the payload, let the server validate and reject it.
        }
      }
      return token;
    } catch {
      return null;
    }
  },

  // Client-side check: returns true if no token or the token's expiry has passed.
  // Handles standard 3-part JWTs: header.payload.signature [exp in seconds, iat in seconds]
  // Tokens in unknown formats or missing the exp claim are treated as expired
  // so the user is directed to re-authenticate rather than receiving a server 401.
  isTokenExpired: (): boolean => {
    try {
      const token = safeStorage.getItem(STORAGE_KEY_TOKEN);
      if (!token) return true;
      const parts = token.split('.');
      if (parts.length !== 3) return true; // Non-standard format → treat as expired
      // Decode the payload (middle part) of the standard JWT
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      // Use standard JWT `exp` claim (seconds since epoch) if available.
      // Subtract TOKEN_EXPIRY_BUFFER_SECONDS so tokens expiring within the buffer
      // window are treated as already expired, triggering a proactive refresh before
      // the server rejects them. This prevents DevTools 401 errors caused by minor
      // clock skew between the browser and the server.
      if (payload.exp) return Date.now() / 1000 > payload.exp - TOKEN_EXPIRY_BUFFER_SECONDS;
      // Fall back to `iat` (seconds since epoch) + TOKEN_EXPIRY_MS window
      const tokenAge = Date.now() - (payload.iat || 0) * 1000;
      return tokenAge > TOKEN_EXPIRY_MS;
    } catch {
      return true; // Cannot decode → treat as expired so the user is prompted to re-authenticate
    }
  },

  // Update Current User Session
  updateUserSession: (updatedUser: User) => {
    safeStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    window.dispatchEvent(new Event('auth-change'));
  },

  // Login
  login: async (email: string, password: string): Promise<User> => {
    // 1. MOCK MODE
    if (USE_MOCK_DATA) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (email && password) {
            const mockToken = "mock_token_" + Date.now(); 
            const user = { ...MOCK_USER, email };
            safeStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
            safeStorage.setItem(STORAGE_KEY_TOKEN, mockToken);
            resolve(user);
          } else {
            reject(new Error('ایمیل یا رمز عبور اشتباه است'));
          }
        }, 1000);
      });
    }

    // 2. PRODUCTION MODE (Real Backend)
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({})) as { error?: string; message?: string; reason?: string };
          // 503 means the server is misconfigured (AUTH_SECRET missing/insecure or DB not
          // configured) or the DB is temporarily unavailable.
          // Distinguish transient (db_unavailable → retry) from permanent (misconfiguration)
          // so users know whether to wait or contact support.
          if (response.status === 503) {
            if (errBody.reason === 'db_unavailable') {
              throw new Error('سرور موقتاً در دسترس نیست. لطفاً چند لحظه صبر کنید و دوباره تلاش کنید.');
            }
            throw new Error('سرویس در دسترس نیست. لطفاً با پشتیبانی تماس بگیرید.');
          }
          if (response.status === 500) {
            throw new Error('خطای داخلی سرور. لطفاً دوباره تلاش کنید.');
          }
          throw new Error(errBody.error || errBody.message || 'نام کاربری یا رمز عبور اشتباه است');
        }

        const responseData = await response.json();
        // Backend returns { success: true, data: { token, user } }
        const data = responseData.data ?? responseData;
        if (!data.user || !data.token) {
          throw new Error('پاسخ سرور نامعتبر است. لطفاً دوباره تلاش کنید.');
        }
        safeStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
        safeStorage.setItem(STORAGE_KEY_TOKEN, data.token);
        
        return data.user;
    } catch (error) {
        console.error("Login API Error:", error);
        throw error;
    }
  },

  // Register
  register: async (name: string, email: string, password: string): Promise<User> => {
    // 1. MOCK MODE
    if (USE_MOCK_DATA) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const newUser = { ...MOCK_USER, name, email, id: `u_${Date.now()}` };
          const mockToken = "mock_token_" + Date.now();
          safeStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
          safeStorage.setItem(STORAGE_KEY_TOKEN, mockToken);
          resolve(newUser);
        }, 1000);
      });
    }

    // 2. PRODUCTION MODE
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({})) as { error?: string; message?: string; reason?: string };
          if (response.status === 503) {
            if (errBody.reason === 'db_unavailable') {
              throw new Error('سرور موقتاً در دسترس نیست. لطفاً چند لحظه صبر کنید و دوباره تلاش کنید.');
            }
            throw new Error('سرویس در دسترس نیست. لطفاً با پشتیبانی تماس بگیرید.');
          }
          if (response.status === 500) {
            throw new Error('خطای داخلی سرور. لطفاً دوباره تلاش کنید.');
          }
          throw new Error(errBody.error || errBody.message || 'خطا در ثبت‌نام');
        }

        const responseData = await response.json();
        // Backend returns { success: true, data: { token, user } }
        const data = responseData.data ?? responseData;
        if (!data.user || !data.token) {
          throw new Error('پاسخ سرور نامعتبر است. لطفاً دوباره تلاش کنید.');
        }
        safeStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
        safeStorage.setItem(STORAGE_KEY_TOKEN, data.token);
        
        return data.user;
    } catch (error) {
        console.error("Register API Error:", error);
        throw error;
    }
  },

  loginWithGoogle: async (): Promise<User> => {
    // MOCK MODE: simulate Google login with demo data
    if (USE_MOCK_DATA) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const googleUser = { ...MOCK_USER, name: 'کاربر گوگل', email: 'user@gmail.com' };
          safeStorage.setItem(STORAGE_KEY_USER, JSON.stringify(googleUser));
          safeStorage.setItem(STORAGE_KEY_TOKEN, "google_mock_token");
          resolve(googleUser);
        }, 1500);
      });
    }

    // PRODUCTION MODE: redirect to Azure SWA built-in Google auth provider.
    // After sign-in, Azure SWA automatically provides the x-ms-client-principal
    // header on all API requests so no token needs to be stored client-side.
    const redirectUri = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/.auth/login/google?post_login_redirect_uri=${redirectUri}`;
    // This promise never resolves because the page is being redirected.
    return new Promise(() => {});
  },

  logout: () => {
    safeStorage.removeItem(STORAGE_KEY_USER);
    safeStorage.removeItem(STORAGE_KEY_TOKEN);
    safeStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
    window.dispatchEvent(new CustomEvent('auth-change', { detail: { reason: 'user_logout' } }));
  },

  /**
   * PHASE 1 — Single centralized handler for an invalid/expired session.
   *
   * ALL code paths that detect an invalid token (401 responses, client-side
   * expiry checks, etc.) MUST call this method instead of calling logout()
   * directly. This ensures:
   *   1. Auth state is cleared in exactly one place.
   *   2. Every invalidation is logged with a reason for diagnostics.
   *   3. The auth-change event fires exactly once per invalidation event.
   */
  onAuthInvalid: (reason: string) => {
    console.warn(`[auth] session_invalidated reason=${reason}`);
    safeStorage.removeItem(STORAGE_KEY_USER);
    safeStorage.removeItem(STORAGE_KEY_TOKEN);
    safeStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
    window.dispatchEvent(new CustomEvent('auth-change', { detail: { reason } }));
  },

  /**
   * Silently exchange the current (possibly expired) token for a fresh one.
   * Returns the new token string on success, or null if the server rejects it
   * (e.g. token_too_old, signature_mismatch, server mis-configuration).
   *
   * When the server explicitly rejects the token (401), the stale token and
   * user data are cleared from storage so the user is not stuck in a loop
   * where every subsequent page load retries with the same invalid token.
   */
  refreshToken: async (): Promise<string | null> => {
    const token = safeStorage.getItem(STORAGE_KEY_TOKEN);
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        // 503 from refresh = server misconfiguration (e.g. AUTH_SECRET not set,
        // insecure placeholder). Parse the reason and throw so callers can
        // distinguish a config error from a simple token rejection (401).
        if (response.status === 503) {
          let reason = 'server_unavailable';
          try {
            const errBody = await response.json() as { reason?: string };
            if (errBody.reason) reason = errBody.reason;
          } catch { /* ignore parse failure */ }
          throw new Error(`refresh_server_error:${reason}`);
        }
        // 401 = server definitively rejected the token (e.g. signed with a
        // different secret after server rebuild, or token is too old).
        // Clear the stale credentials so the user is prompted to log in
        // fresh instead of being stuck retrying the same invalid token.
        if (response.status === 401) {
          console.warn('[auth] refresh_token_rejected — clearing stale session');
          safeStorage.removeItem(STORAGE_KEY_TOKEN);
          safeStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
          safeStorage.removeItem(STORAGE_KEY_USER);
          window.dispatchEvent(new Event('auth-change'));
        }
        return null;
      }
      const body = await response.json().catch(() => null);
      const data = body?.data ?? body;
      const newToken: string | undefined = data?.token;
      if (!newToken) return null;
      safeStorage.setItem(STORAGE_KEY_TOKEN, newToken);
      return newToken;
    } catch (err) {
      // Re-throw server misconfiguration errors so callers can handle them
      if (err instanceof Error && err.message.startsWith('refresh_server_error:')) throw err;
      return null;
    }
  },
};
