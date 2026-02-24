import React, { useState } from 'react';
import Icon from '../../src/components/ui/Icon';
import { Page } from '../../types';
import { authService } from '../../services/authService';

interface RegisterProps {
  onNavigate: (page: Page) => void;
  onLoginSuccess: () => void;
}

const Register: React.FC<RegisterProps> = ({ onNavigate, onLoginSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authService.register(name, email, password);
      onLoginSuccess();
    } catch {
      alert('ثبت‌نام ناموفق بود.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <button 
        onClick={() => onNavigate(Page.LOGIN)}
        className="absolute top-4 left-4 text-gray-500 hover:text-gray-800"
      >
        <Icon name="ArrowLeft" size={24} strokeWidth={1.8} />
      </button>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-600 tracking-tighter mb-2">
            Market<span className="text-gray-800">4U</span>
          </h1>
          <p className="text-gray-500">ایجاد حساب کاربری جدید</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نام کامل</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                  placeholder="احمد ضیا"
                />
                <Icon name="User" size={20} strokeWidth={1.8} className="absolute right-3 top-3.5 text-gray-400" />
              </div>
            </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
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
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 disabled:opacity-70"
          >
            {isLoading ? <Icon name="Loader2" size={20} strokeWidth={1.8} className="animate-spin" /> : 'ثبت نام'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          قبلاً حساب دارید؟{' '}
          <button 
            onClick={() => onNavigate(Page.LOGIN)}
            className="font-bold text-brand-600 hover:text-brand-700"
          >
            وارد شوید
          </button>
        </p>
      </div>
    </div>
  );
};

export default Register;