import React, { useState } from 'react';
import Icon from '../../src/components/ui/Icon';
import { Page } from '../../types';
import { authService } from '../../services/authService';
import { toastService } from '../../services/toastService';
import { safeStorage } from '../../utils/safeStorage';
import { API_BASE_URL } from '../../config';

const STORAGE_BLOCKED_MSG = 'مرورگر اجازه ذخیره‌سازی را نمیدهد. لطفاً از حالت عادی Safari یا Chrome استفاده کنید.';

interface LoginProps {
  onNavigate: (page: Page) => void;
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onNavigate, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const storageBlocked = !safeStorage.isAvailable();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authService.login(email, password);
      await verifySessionAfterLogin();
      onLoginSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ورود ناموفق بود. لطفاً اطلاعات خود را بررسی کنید.';
      toastService.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await authService.loginWithGoogle();
      await verifySessionAfterLogin();
      onLoginSuccess();
    } catch {
      toastService.error('خطا در اتصال به گوگل. لطفاً دوباره امتحان کنید.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  /**
   * Calls /api/auth/me immediately after a successful login to verify the token
   * is readable by the server. This is a diagnostic-only check — it must never
   * throw or block the login flow regardless of what the server returns.
   *
   * Uses a direct fetch (not apiClient) so that a 401 invalid_token response
   * does NOT trigger onAuthInvalid and clear the freshly-issued session.
   * The session is valid at this point (login just succeeded); if the diagnostic
   * call fails it means the server has a configuration issue, not that the
   * user's credentials are bad.
   *
   * If getToken() returns null the token was not persisted (e.g. storage is
   * blocked by iOS Safari ITP / private browsing). In that case skip the call
   * entirely — there is nothing to verify and the request would fail with 401.
   */
  const verifySessionAfterLogin = async () => {
    const token = authService.getToken();
    if (!token) return; // Token not persisted; nothing to verify
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        let reason: string | undefined;
        try {
          const body = await response.json() as { reason?: string };
          reason = body.reason;
        } catch {
          // ignore parse failure
        }
        console.warn('[Login] login_ok_but_me_401', {
          status: response.status,
          reason: reason ?? '(unparseable response)',
          storageMode: safeStorage.getMode(),
          storageAvailable: safeStorage.isAvailable(),
          storageTest: safeStorage.selfTest(),
        });
      }
    } catch (err) {
      console.warn('[Login] post_login_me_check_failed', err instanceof Error ? err.message : err);
    }
  };

  return (
    <div className="min-h-screen bg-ui-bg flex flex-col items-center justify-center p-4">
      <button 
        onClick={() => onNavigate(Page.HOME)}
        className="absolute top-4 left-4 text-ui-muted hover:text-ui-text"
      >
        <Icon name="ArrowLeft" size={24} strokeWidth={1.8} />
      </button>

      <div className="w-full max-w-md space-y-8">
        {storageBlocked && (
          <div className="flex items-start gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-300" role="alert">
            <Icon name="AlertTriangle" size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-yellow-400" />
            <span>{STORAGE_BLOCKED_MSG}</span>
          </div>
        )}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-400 tracking-tighter mb-2">
            Market<span className="text-ui-text">4U</span>
          </h1>
          <p className="text-ui-muted">خوش آمدید! لطفا وارد حساب کاربری خود شوید.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ui-muted mb-1">ایمیل یا شماره موبایل</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 border border-ui-border bg-ui-surface2 text-ui-text rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-ui-muted"
                  dir="ltr"
                  placeholder="name@example.com"
                />
                <Icon name="Mail" size={20} strokeWidth={1.8} className="absolute right-3 top-3.5 text-ui-muted" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-ui-muted">رمز عبور</label>
                <button type="button" className="text-xs text-brand-400 hover:underline">رمز را فراموش کردید؟</button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 border border-ui-border bg-ui-surface2 text-ui-text rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-ui-muted"
                  dir="ltr"
                  placeholder="••••••••"
                />
                <Icon name="Lock" size={20} strokeWidth={1.8} className="absolute right-3 top-3.5 text-ui-muted" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center py-3.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-500 transition-colors shadow-glow disabled:opacity-70"
          >
            {isLoading ? <Icon name="Loader2" size={20} strokeWidth={1.8} className="animate-spin" /> : 'ورود به حساب'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ui-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-ui-bg text-ui-muted">یا ادامه دهید با</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 border border-ui-border bg-ui-surface text-ui-text font-bold rounded-xl hover:bg-ui-surface2 transition-colors disabled:opacity-70"
        >
          {isGoogleLoading ? (
            <Icon name="Loader2" size={20} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Icon name="Globe" size={20} strokeWidth={1.8} className="text-ui-info" />
          )}
          ورود با گوگل
        </button>

        <p className="text-center text-sm text-ui-muted">
          حساب کاربری ندارید؟{' '}
          <button 
            onClick={() => onNavigate(Page.REGISTER)}
            className="font-bold text-brand-400 hover:text-brand-300"
          >
            ثبت‌نام کنید
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;