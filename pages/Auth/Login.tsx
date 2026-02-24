import React, { useState } from 'react';
import Icon from '../../src/components/ui/Icon';
import { Page } from '../../types';
import { authService } from '../../services/authService';

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
      alert('ورود ناموفق بود. لطفا دوباره تلاش کنید.');
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
      alert('خطا در اتصال به گوگل.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <button 
        onClick={() => onNavigate(Page.HOME)}
        className="absolute top-4 left-4 text-gray-500 hover:text-gray-800"
      >
        <Icon name="ArrowLeft" size={24} strokeWidth={1.8} />
      </button>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-600 tracking-tighter mb-2">
            Market<span className="text-gray-800">4U</span>
          </h1>
          <p className="text-gray-500">خوش آمدید! لطفا وارد حساب کاربری خود شوید.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ایمیل یا شماره موبایل</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                  dir="ltr"
                  placeholder="name@example.com"
                />
                <Icon name="Mail" size={20} strokeWidth={1.8} className="absolute right-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">رمز عبور</label>
                <button type="button" className="text-xs text-brand-600 hover:underline">رمز را فراموش کردید؟</button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                  dir="ltr"
                  placeholder="••••••••"
                />
                <Icon name="Lock" size={20} strokeWidth={1.8} className="absolute right-3 top-3.5 text-gray-400" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center py-3.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 disabled:opacity-70"
          >
            {isLoading ? <Icon name="Loader2" size={20} strokeWidth={1.8} className="animate-spin" /> : 'ورود به حساب'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">یا ادامه دهید با</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 border border-gray-300 bg-white text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-70"
        >
          {isGoogleLoading ? (
            <Icon name="Loader2" size={20} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Icon name="Globe" size={20} strokeWidth={1.8} className="text-blue-600" />
          )}
          ورود با گوگل
        </button>

        <p className="text-center text-sm text-gray-600">
          حساب کاربری ندارید؟{' '}
          <button 
            onClick={() => onNavigate(Page.REGISTER)}
            className="font-bold text-brand-600 hover:text-brand-700"
          >
            ثبت‌نام کنید
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;