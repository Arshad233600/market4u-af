
import React from 'react';
import Icon from '../src/components/ui/Icon';
import { Page, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardLayoutProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  user: User | null;
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ activePage, onNavigate, onLogout, user, children }) => {
  const { t } = useLanguage();

  const menuItems = [
    { id: Page.DASHBOARD, label: t('dash_overview'), icon: 'LayoutDashboard' },
    { id: Page.DASHBOARD_ADS, label: t('dash_my_ads'), icon: 'List' },
    { id: Page.DASHBOARD_CHAT, label: t('dash_messages'), icon: 'MessageSquare', badge: user?.reviewCount || 0 },
    { id: Page.DASHBOARD_WALLET, label: t('dash_wallet'), icon: 'Wallet' },
    { id: Page.DASHBOARD_FAVORITES, label: 'علاقه‌مندی‌ها', icon: 'Heart' },
    { id: Page.DASHBOARD_SETTINGS, label: t('dash_settings'), icon: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-ui-bg flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-ui-surface border-l border-ui-border h-screen sticky top-0 z-30">
        <div className="p-6 flex items-center gap-3 border-b border-ui-border bg-ui-surface2">
           <div className="relative">
             <div className="w-14 h-14 bg-ui-surface2 rounded-full flex items-center justify-center text-brand-300 font-bold border-2 border-brand-700/40 overflow-hidden">
               {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover"/> : <Icon name="User" size={28} strokeWidth={1.8} />}
             </div>
             {user?.isVerified && (
               <div className="absolute -bottom-1 -right-1 bg-ui-success border-2 border-ui-surface rounded-full w-5 h-5 flex items-center justify-center">
                 <Icon name="Check" size={14} strokeWidth={2.5} className="text-white" />
               </div>
             )}
           </div>
           <div className="flex-1 min-w-0">
             <h3 className="font-bold text-ui-text text-sm truncate">{user?.name || 'کاربر بازار'}</h3>
             <p className="text-xs text-ui-muted font-medium mt-0.5 dir-ltr text-right">{user?.phone || ''}</p>
             {user?.isVerified && (
               <div className="flex items-center gap-1 mt-1.5">
                 <span className="text-xs bg-brand-900/40 text-brand-300 px-2 py-0.5 rounded-full font-bold border border-brand-700/30">فروشنده تایید شده</span>
               </div>
             )}
           </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-bold text-ui-muted uppercase tracking-wider">منوی اصلی</div>
          {menuItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                  isActive 
                    ? 'bg-brand-900/40 text-brand-300 font-bold ring-1 ring-brand-700/40' 
                    : 'text-ui-muted hover:bg-ui-surface2 hover:text-ui-text'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon name={item.icon} size={20} strokeWidth={isActive ? 2.0 : 1.8} className={`transition-colors ${isActive ? 'text-brand-400' : 'text-ui-muted group-hover:text-ui-text'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                   <span className="bg-ui-danger text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                     {item.badge}
                   </span>
                ) : isActive ? (
                  <Icon name="ChevronRight" size={18} strokeWidth={1.8} className="rotate-180 text-brand-500" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-ui-border space-y-1">
          <button
             onClick={() => onNavigate(Page.HOME)}
             className="w-full flex items-center gap-3 text-ui-muted px-4 py-3 hover:bg-ui-surface2 hover:text-ui-text rounded-xl text-sm font-medium transition-colors group"
          >
            <Icon name="Home" size={20} strokeWidth={1.8} className="group-hover:scale-110 transition-transform" />
            <span>{t('return_to_home')}</span>
          </button>
          <button 
             onClick={onLogout}
             className="w-full flex items-center gap-3 text-ui-danger px-4 py-3 hover:bg-ui-danger/10 rounded-xl text-sm font-bold transition-colors group border border-transparent hover:border-ui-danger/20"
          >
            <Icon name="LogOut" size={20} strokeWidth={1.8} className="group-hover:scale-110 transition-transform" />
            <span>{t('dash_logout')}</span>
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
         {/* Mobile Header for Dashboard */}
         <div className="md:hidden bg-ui-surface px-4 py-3 flex items-center justify-between sticky top-0 z-20 border-b border-ui-border">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-brand-900/40 rounded-full flex items-center justify-center text-brand-300 font-bold border border-brand-700/40">
                 {user?.name?.charAt(0)}
               </div>
               <h2 className="font-bold text-ui-text text-sm">
                 {menuItems.find(i => i.id === activePage)?.label || t('dash_overview')}
               </h2>
             </div>
             <div className="flex items-center gap-2">
                 <button onClick={() => onNavigate(Page.DASHBOARD_CHAT)} className="p-2 text-ui-muted hover:bg-ui-surface2 rounded-full relative" title={t('dash_messages')}>
                    <Icon name="BellRing" size={20} strokeWidth={1.8} />
                    {(user?.reviewCount || 0) > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-ui-danger rounded-full"></span>}
                 </button>
                 <button onClick={() => onNavigate(Page.HOME)} className="p-2 text-ui-muted hover:bg-ui-surface2 rounded-full transition-colors" title={t('return_to_home')}>
                    <Icon name="Home" size={20} strokeWidth={1.8} />
                 </button>
                 <button onClick={onLogout} className="p-2 text-ui-danger hover:bg-ui-danger/10 rounded-full transition-colors" title={t('dash_logout')}>
                    <Icon name="LogOut" size={20} strokeWidth={1.8} />
                 </button>
             </div>
         </div>

         {/* Scrollable Content */}
         <div className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
            <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
               {children}
            </div>
         </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
