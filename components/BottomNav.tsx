
import React from 'react';
import Icon from '../src/components/ui/Icon';
import { Page } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface BottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activePage, onNavigate }) => {
  const { t } = useLanguage();

  const navItems = [
    { id: Page.HOME, icon: 'Home', label: t('nav_home') },
    { id: Page.DASHBOARD_CHAT, icon: 'MessageCircle', label: t('nav_messages') },
    { id: Page.POST_AD, icon: 'Plus', label: t('nav_post'), special: true },
    { id: Page.PROFILE, icon: 'User', label: t('nav_profile') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {item.special ? (
                <div className="bg-brand-600 text-white p-2 rounded-xl shadow-lg -mt-6 border-4 border-white active:scale-95 transition-transform">
                  <Icon name={item.icon} size={28} strokeWidth={1.8} className="text-white" />
                </div>
              ) : (
                <>
                  <Icon name={item.icon} size={24} strokeWidth={isActive ? 2.0 : 1.8} />
                  <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
