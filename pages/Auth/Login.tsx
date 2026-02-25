import React, { useState } from 'react';
import Icon from '../../src/components/ui/Icon';
import { Page } from '../../types';
import { authService } from '../../services/authService';
import { toastService } from '../../services/toastService';

interface LoginProps {
  onNavigate: (page: Page) => void;
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onNavigate, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authService.login(email, password);
      onLoginSuccess();
    } catch {
      toastService.error('ورود ناموفق بود. لطفاً اطلاعات خود را بررسی کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await authService.loginWithGoogle();
      onLoginSuccess();
    } catch {
      toastService.error('خطا در اتصال به گوگل. لطفاً دوباره امتحان کنید.');
    } finally {
      setIsGoogleLoading(false);
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