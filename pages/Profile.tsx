import React from 'react';
import Icon from '../src/components/ui/Icon';
import { Page, User } from '../types';

interface ProfileProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onNavigate, onLogout }) => {
  return (
    <div className="pb-24 pt-6 px-4 max-w-2xl mx-auto">
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-3xl font-bold mb-3 border-4 border-white shadow-lg relative overflow-hidden">
          {user.avatarUrl ? (
             <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
             <span>{user.name.charAt(0)}</span>
          )}
        </div>
        <h2 className="text-xl font-bold text-ui-text">{user.name}</h2>
        <p className="text-ui-muted text-sm dir-ltr">{user.phone}</p>
        {user.isVerified && (
            <div className="flex items-center gap-1 mt-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                حساب تایید شده
            </div>
        )}
      </div>

      <div className="bg-ui-surface rounded-xl shadow-sm border border-ui-border overflow-hidden mb-6">
        <button 
            onClick={() => onNavigate(Page.DASHBOARD_ADS)}
            className="w-full p-4 border-b border-ui-border flex items-center gap-3 hover:bg-ui-surface2 transition-colors text-right"
        >
            <Icon name="ShoppingBag" size={20} strokeWidth={1.8} className="text-brand-600" />
            <span className="flex-1 font-medium text-ui-muted">آگهی‌های من</span>
        </button>
        <button 
            onClick={() => onNavigate(Page.FAVORITES)}
            className="w-full p-4 border-b border-ui-border flex items-center gap-3 hover:bg-ui-surface2 transition-colors text-right"
        >
            <Icon name="Heart" size={20} strokeWidth={1.8} className="text-red-500" />
            <span className="flex-1 font-medium text-ui-muted">علاقه‌مندی‌ها</span>
        </button>
        <button 
             onClick={() => onNavigate(Page.DASHBOARD_SETTINGS)}
             className="w-full p-4 flex items-center gap-3 hover:bg-ui-surface2 transition-colors text-right"
        >
            <Icon name="MapPin" size={20} strokeWidth={1.8} className="text-ui-muted" />
            <span className="flex-1 font-medium text-ui-muted">آدرس‌ها</span>
        </button>
      </div>

      <div className="bg-ui-surface rounded-xl shadow-sm border border-ui-border overflow-hidden">
        <button 
            onClick={() => onNavigate(Page.DASHBOARD_SETTINGS)}
            className="w-full p-4 border-b border-ui-border flex items-center gap-3 hover:bg-ui-surface2 transition-colors text-right"
        >
            <Icon name="Settings" size={20} strokeWidth={1.8} className="text-ui-muted" />
            <span className="flex-1 font-medium text-ui-muted">تنظیمات</span>
        </button>
        <button 
            onClick={onLogout}
            className="w-full p-4 flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600 text-right"
        >
            <Icon name="LogOut" size={20} strokeWidth={1.8} />
            <span className="flex-1 font-medium">خروج از حساب</span>
        </button>
      </div>

      <p className="text-center text-ui-muted text-xs mt-8">نسخه ۱.۱.۰</p>
    </div>
  );
};

export default Profile;