
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../src/components/ui/Icon';
import { Page, User, Notification } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { azureService } from '../services/azureService';

interface HeaderProps {
  onSearch: (query: string) => void;
  onNavigate: (page: Page | 'ADMIN_PANEL') => void;
  user: User | null;
  currentLocationName?: string; // Prop to show detected location
  onRequestLocation?: () => void; // Prop to trigger location detection
}

const Header: React.FC<HeaderProps> = ({ onSearch, onNavigate, user, currentLocationName, onRequestLocation }) => {
  const { t, toggleLanguage } = useLanguage();
  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Load Notifications
  const fetchNotifications = useCallback(async () => {
      if (user) {
          const data = await azureService.getNotifications();
          setNotifications(data);
      }
  }, [user]);

  useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchNotifications();
      // Poll for new notifications occasionally (simulating real-time)
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllRead = async () => {
      await azureService.markNotificationRead();
      void fetchNotifications();
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
        if (searchValue.length > 1) {
            const results = await azureService.getSearchSuggestions(searchValue);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };
    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Close suggestions/notifications when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
              setShowSuggestions(false);
          }
          if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
              setShowNotifications(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: string) => {
      setSearchValue(suggestion);
      onSearch(suggestion);
      setShowSuggestions(false);
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchValue(val);
      onSearch(val);
  };

  return (
    <header className="w-full">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* Logo & Mobile Menu */}
        <div className="flex items-center gap-2">
          <button 
            className="p-2 -mr-2 md:hidden text-ui-muted active:bg-ui-surface2 rounded-full"
            onClick={() => onNavigate(user ? Page.PROFILE : Page.LOGIN)}
            aria-label="منوی کاربری"
          >
            <Icon name="Menu" size={24} strokeWidth={1.8} />
          </button>
          <div 
            className="text-2xl font-bold text-brand-400 tracking-tighter cursor-pointer flex items-center"
            onClick={() => onNavigate(Page.HOME)}
          >
            {t('app_name')}
          </div>
        </div>

        {/* Search Bar - Desktop */}
        <div className="flex-1 max-w-2xl relative hidden sm:block" ref={searchRef}>
          <div className="relative">
            <input 
              type="text" 
              value={searchValue}
              placeholder={t('search_placeholder')}
              className="w-full h-10 pr-10 pl-4 bg-ui-surface2 rounded-full border border-ui-border focus:ring-2 focus:ring-brand-500 text-ui-text placeholder:text-ui-muted text-sm transition-all outline-none"
              onChange={handleSearchInput}
              onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
            />
            <Icon name="Search" size={20} strokeWidth={1.8} className="absolute right-3 top-2.5 text-ui-muted" />
            {searchValue && (
                <button onClick={() => { setSearchValue(''); onSearch(''); }} className="absolute left-3 top-2.5 text-ui-muted hover:text-ui-text">
                    <Icon name="X" size={18} strokeWidth={1.8} />
                </button>
            )}
          </div>
          {/* Autocomplete Dropdown */}
          {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-ui-surface rounded-xl shadow-card border border-ui-border overflow-hidden z-50">
                  <ul>
                      {suggestions.map((s, i) => (
                          <li 
                            key={i} 
                            onClick={() => handleSelectSuggestion(s)}
                            className="px-4 py-3 hover:bg-ui-surface2 cursor-pointer text-sm text-ui-text flex items-center gap-2 border-b border-ui-border last:border-none"
                          >
                              <Icon name="Search" size={18} strokeWidth={1.8} className="text-ui-muted" />
                              {s}
                          </li>
                      ))}
                  </ul>
              </div>
          )}
        </div>

        {/* Location & Actions */}
        <div className="flex items-center gap-3 md:gap-4">
          
          {/* Language Switcher */}
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-1 text-xs font-bold text-brand-400 bg-brand-900/40 hover:bg-brand-900/60 px-3 py-1.5 rounded-full transition-colors border border-brand-700/40"
          >
            <Icon name="Globe" size={14} strokeWidth={1.8} />
            <span>{t('lang_switch')}</span>
          </button>

          {/* Smart Location Button */}
          <button 
            onClick={onRequestLocation}
            className={`hidden md:flex items-center gap-1 text-sm transition-colors px-2 py-1 rounded-lg ${currentLocationName && currentLocationName !== 'کل افغانستان' ? 'text-brand-400 bg-brand-900/40 font-bold border border-brand-700/40' : 'text-ui-muted hover:text-brand-400'}`}
            title="یافتن آگهی‌های اطراف من"
          >
            {currentLocationName && currentLocationName !== 'کل افغانستان' ? <Icon name="MapPin" size={18} strokeWidth={1.8} /> : <Icon name="Crosshair" size={18} strokeWidth={1.8} />}
            <span>{currentLocationName === 'کل افغانستان' || !currentLocationName ? t('location') : currentLocationName}</span>
          </button>
          
          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
              <button 
                onClick={() => { setShowNotifications(!showNotifications); void fetchNotifications(); }}
                className="relative p-2 text-ui-muted hover:text-ui-text hover:bg-ui-surface2 rounded-full transition-colors"
              >
                <Icon name="Bell" size={24} strokeWidth={1.8} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 left-1 w-2.5 h-2.5 bg-ui-danger rounded-full border-2 border-ui-surface animate-pulse"></span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-ui-surface rounded-xl shadow-card border border-ui-border overflow-hidden z-[60]">
                      <div className="p-3 border-b border-ui-border flex justify-between items-center bg-ui-surface2">
                          <h4 className="font-bold text-ui-text text-sm">اعلان‌ها</h4>
                          {unreadCount > 0 && (
                              <button onClick={markAllRead} className="text-[10px] text-brand-400 cursor-pointer hover:underline flex items-center gap-1">
                                  <Icon name="CheckCircle" size={12} strokeWidth={2.0} />
                                  خواندن همه
                              </button>
                          )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                              <div className="p-8 text-center text-ui-muted">
                                  <Icon name="Bell" size={32} strokeWidth={1.8} className="mx-auto mb-2 opacity-50" />
                                  <p className="text-xs">هیچ اعلان جدیدی ندارید.</p>
                              </div>
                          ) : (
                              notifications.map(notif => (
                                  <div key={notif.id} className={`p-4 border-b border-ui-border last:border-none hover:bg-ui-surface2 transition-colors ${!notif.isRead ? 'bg-ui-info/5' : ''}`}>
                                      <div className="flex gap-3">
                                          <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                              notif.type === 'success' ? 'bg-ui-success/20 text-ui-success' :
                                              notif.type === 'warning' ? 'bg-ui-warning/20 text-ui-warning' :
                                              'bg-ui-info/20 text-ui-info'
                                          }`}>
                                              {notif.type === 'success' ? <Icon name="CheckCircle" size={18} strokeWidth={1.8} /> :
                                              notif.type === 'warning' ? <Icon name="AlertTriangle" size={18} strokeWidth={1.8} /> :
                                              <Icon name="Info" size={18} strokeWidth={1.8} />}
                                          </div>
                                          <div>
                                              <h5 className={`text-sm ${!notif.isRead ? 'font-bold text-ui-text' : 'text-ui-muted'}`}>{notif.title}</h5>
                                              <p className="text-xs text-ui-muted mt-1 leading-relaxed">{notif.message}</p>
                                              <span className="text-[10px] text-ui-muted/60 mt-2 block">{notif.date}</span>
                                          </div>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                      <div className="p-2 text-center bg-ui-surface2 border-t border-ui-border">
                          <button onClick={() => { setShowNotifications(false); onNavigate(Page.DASHBOARD_SETTINGS); }} className="text-xs text-brand-400 font-bold hover:underline">
                              تنظیمات اعلان
                          </button>
                      </div>
                  </div>
              )}
          </div>
          
          {user ? (
            <div className="flex items-center gap-2">
                {user.role === 'ADMIN' && (
                    <button 
                        onClick={() => onNavigate('ADMIN_PANEL')}
                        className="hidden md:flex items-center gap-1 bg-ui-surface2 text-ui-text px-3 py-1.5 rounded-full text-xs font-bold hover:bg-ui-surface border border-ui-border transition-colors"
                        title="پنل مدیریت"
                    >
                        <Icon name="Shield" size={14} strokeWidth={1.8} className="text-brand-400" />
                        <span>مدیریت</span>
                    </button>
                )}
                <button 
                onClick={() => onNavigate(Page.DASHBOARD)}
                className="w-9 h-9 bg-brand-800/60 rounded-full flex items-center justify-center text-brand-300 font-bold border border-brand-700/50 cursor-pointer hover:bg-brand-800 transition-colors"
                aria-label="پروفایل کاربری"
                >
                <Icon name="User" size={20} strokeWidth={1.8} className="text-brand-300" />
                </button>
            </div>
          ) : (
            <button 
              onClick={() => onNavigate(Page.LOGIN)}
              className="hidden md:flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-500 transition-colors shadow-glow"
            >
              <Icon name="LogIn" size={18} strokeWidth={1.8} className="rtl:rotate-180 text-white" />
              {t('login_btn')}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="sm:hidden px-4 pb-3" ref={searchRef}>
         <div className="relative">
            <input 
              type="text" 
              value={searchValue}
              placeholder={t('search_placeholder')}
              className="w-full h-10 pr-10 pl-8 bg-ui-surface2 rounded-full border border-ui-border focus:ring-2 focus:ring-brand-500 text-ui-text placeholder:text-ui-muted text-sm outline-none"
              onChange={handleSearchInput}
              onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
            />
            <Icon name="Search" size={20} strokeWidth={1.8} className="absolute right-3 top-2.5 text-ui-muted" />
            {searchValue && (
                <button onClick={() => { setSearchValue(''); onSearch(''); }} className="absolute left-3 top-2.5 text-ui-muted hover:text-ui-text">
                    <Icon name="X" size={18} strokeWidth={1.8} />
                </button>
            )}
         </div>
         {/* Mobile Suggestions */}
         {showSuggestions && (
             <div className="absolute left-4 right-4 mt-2 bg-ui-surface rounded-xl shadow-card border border-ui-border overflow-hidden z-50">
                 <ul>
                     {suggestions.map((s, i) => (
                         <li 
                           key={i} 
                           onClick={() => handleSelectSuggestion(s)}
                           className="px-4 py-3 hover:bg-ui-surface2 cursor-pointer text-sm text-ui-text flex items-center gap-2 border-b border-ui-border last:border-none"
                         >
                             <Icon name="Search" size={18} strokeWidth={1.8} className="text-ui-muted" />
                             {s}
                         </li>
                     ))}
                 </ul>
             </div>
         )}
      </div>
    </header>
  );
};

export default Header;
