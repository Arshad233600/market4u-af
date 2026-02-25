
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
    <nav className="md:hidden pb-safe">
      <div className="flex justify-around items-center h-[70px] px-2">
        {navItems.map((item) => {
          const isActive = activePage === item.id;

          if (item.special) {
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center justify-center w-full h-full"
                aria-label={item.label}
              >
                <div className="btn-brand w-14 h-14 rounded-2xl flex items-center justify-center -mt-6 shadow-glow-lg press">
                  <Icon name={item.icon} size={26} strokeWidth={2.5} className="text-white" />
                </div>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center justify-center w-full h-full gap-1 press"
              aria-label={item.label}
            >
              <div className={`relative w-11 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
                isActive ? 'bg-brand-500/15' : ''
              }`}>
                <Icon
                  name={item.icon}
                  size={24}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={`transition-all duration-200 ${isActive ? 'text-brand-400' : 'text-ui-subtle'}`}
                />
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-400" />
                )}
              </div>
              <span className={`text-xs font-medium transition-colors duration-200 ${
                isActive ? 'text-brand-400' : 'text-ui-subtle'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
