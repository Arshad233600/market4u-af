
import { User } from '../types';
import { API_BASE_URL, USE_MOCK_DATA } from '../config';

const STORAGE_KEY_USER = 'bazar_af_user';
const STORAGE_KEY_TOKEN = 'bazar_af_token';

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
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
  },

  // Get JWT Token for API Calls
  getToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEY_TOKEN);
  },

  // Update Current User Session
  updateUserSession: (updatedUser: User) => {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
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
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
            localStorage.setItem(STORAGE_KEY_TOKEN, mockToken);
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
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || 'نام کاربری یا رمز عبور اشتباه است');
        }

        const data = await response.json();
        // Backend returns { token, user }
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
        localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
        
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
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
          localStorage.setItem(STORAGE_KEY_TOKEN, mockToken);
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
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || 'خطا در ثبت‌نام');
        }

        const data = await response.json();
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
        localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
        
        return data.user;
    } catch (error) {
        console.error("Register API Error:", error);
        throw error;
    }
  },

  loginWithGoogle: async (): Promise<User> => {
    // This would typically involve redirecting to an OAuth provider
    return new Promise((resolve) => {
      setTimeout(() => {
        const googleUser = { ...MOCK_USER, name: 'کاربر گوگل', email: 'user@gmail.com' };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(googleUser));
        localStorage.setItem(STORAGE_KEY_TOKEN, "google_mock_token");
        resolve(googleUser);
      }, 1500);
    });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    window.dispatchEvent(new Event('auth-change'));
  }
};
