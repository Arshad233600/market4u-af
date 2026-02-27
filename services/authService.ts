
import { User } from '../types';
import { API_BASE_URL, USE_MOCK_DATA } from '../config';
import { safeStorage } from '../utils/safeStorage';

const STORAGE_KEY_USER = 'bazar_af_user';
const STORAGE_KEY_TOKEN = 'bazar_af_token';
const STORAGE_KEY_REFRESH_TOKEN = 'bazar_af_refresh_token';
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (matches server TOKEN_EXPIRATION_MS)

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
      return token;
    } catch {
      return null;
    }
  },

  // Client-side check: returns true if no token or the token's expiry has passed.
  // Handles both:
  //   - 2-part server-issued tokens: base64url(payload).base64url(signature)  [iat in ms]
  //   - 3-part standard JWTs: header.payload.signature  [exp in seconds, iat in seconds]
  // Unknown formats are treated as valid (server will be the final authority).
  isTokenExpired: (): boolean => {
    try {
      const token = safeStorage.getItem(STORAGE_KEY_TOKEN);
      if (!token) return true;
      const parts = token.split('.');

      // 2-part server token: base64url(JSON payload).base64url(signature)
      if (parts.length === 2) {
        // Add padding required by atob for base64url-encoded strings
        const padded = parts[0].replace(/-/g, '+').replace(/_/g, '/');
        const pad = padded.length % 4;
        const b64 = pad ? padded + '='.repeat(4 - pad) : padded;
        const payloadJson = atob(b64);
        const payload = JSON.parse(payloadJson);
        if (payload.iat) {
          const tokenAge = Date.now() - payload.iat; // iat is stored in ms on server
          return tokenAge > TOKEN_EXPIRY_MS;
        }
        return false; // No iat claim → cannot determine age → assume valid
      }

      if (parts.length !== 3) return false; // Unknown format → assume valid
      // Decode the payload (middle part) of the JWT
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      // Use standard JWT `exp` claim (seconds since epoch) if available
      if (payload.exp) return Date.now() / 1000 > payload.exp;
      // Fall back to `iat` (seconds) + custom expiry window
      const tokenAge = Date.now() - (payload.iat || 0) * 1000;
      return tokenAge > TOKEN_EXPIRY_MS; // 30 days
    } catch {
      return false; // Cannot decode → let the server decide
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
          const errBody = await response.json().catch(() => ({}));
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
          const errBody = await response.json().catch(() => ({}));
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
};
