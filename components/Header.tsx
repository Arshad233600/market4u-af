
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../src/components/ui/Icon';
import { Page, User, Notification } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { azureService } from '../services/azureService';

interface HeaderProps {
  onSearch: (query: string) => void;
  onNavigate: (page: Page | 'ADMIN_PANEL') => void;
  user: User | null;
  currentLocationName?: string;
  onRequestLocation?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSearch, onNavigate, user, currentLocationName, onRequestLocation }) => {
  const { t, toggleLanguage } = useLanguage();
  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (user) {
      const data = await azureService.getNotifications();
      setNotifications(data);
    }
  }, [user]);

  useEffect(() => {
    void fetchNotifications();
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSearchFocused(false);
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
    setSearchFocused(false);
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    onSearch(val);
  };

  return (
    <header className="w-full">
      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 h-[60px] flex items-center gap-3">

        {/* Logo */}
        <button
          onClick={() => onNavigate(Page.HOME)}
          className="flex items-center gap-1.5 shrink-0 group"
          aria-label="Market4U - صفحه اصلی"
        >
          <div className="w-8 h-8 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-all">
            <span className="text-white font-black text-xs tracking-tight">M4</span>
          </div>
          <span className="hidden sm:block text-lg font-black text-gradient tracking-tight">
            Market4U
          </span>
        </button>

        {/* Search Bar - Desktop */}
        <div className="flex-1 max-w-2xl relative hidden sm:block" ref={searchRef}>
          <div className={`relative transition-all duration-200 ${searchFocused ? 'scale-[1.01]' : ''}`}>
            <div className={`absolute inset-0 rounded-2xl transition-all duration-200 ${searchFocused ? 'ring-2 ring-brand-500/40' : ''}`} />
            <input
              type="text"
              value={searchValue}
              placeholder={t('search_placeholder')}
              className="w-full h-[42px] pr-11 pl-10 bg-ui-surface2 rounded-2xl border border-ui-border focus:border-brand-700/50 text-ui-text placeholder:text-ui-subtle text-sm transition-all outline-none"
              onChange={handleSearchInput}
              onFocus={() => { setSearchFocused(true); if (suggestions.length > 0) setShowSuggestions(true); }}
            />
            <Icon name="Search" size={18} strokeWidth={2} className="absolute right-3.5 top-3 text-ui-muted pointer-events-none" />
            {searchValue && (
              <button
                onClick={() => { setSearchValue(''); onSearch(''); }}
                className="absolute left-3 top-3 text-ui-subtle hover:text-ui-muted transition-colors"
              >
                <Icon name="X" size={16} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-2 glass rounded-2xl shadow-float border border-ui-border overflow-hidden z-50 animate-fadeUp">
              <ul>
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => handleSelectSuggestion(s)}
                    className="px-4 py-3 hover:bg-ui-surface2 cursor-pointer text-sm text-ui-text flex items-center gap-3 border-b border-ui-border last:border-none transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-ui-surface2 flex items-center justify-center shrink-0">
                      <Icon name="Search" size={14} strokeWidth={2} className="text-brand-400" />
                    </div>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 mr-auto sm:mr-0">

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 text-xs font-bold text-brand-400 bg-brand-950/60 hover:bg-brand-950/80 px-2.5 py-1.5 rounded-xl transition-colors border border-brand-800/50"
          >
            <Icon name="Globe" size={13} strokeWidth={2} />
            <span className="hidden xs:inline">{t('lang_switch')}</span>
          </button>

          {/* Location Button (Desktop) */}
          <button
            onClick={onRequestLocation}
            className={`hidden md:flex items-center gap-1.5 text-xs font-medium transition-all px-2.5 py-1.5 rounded-xl border ${
              currentLocationName && currentLocationName !== 'کل افغانستان'
                ? 'text-brand-300 bg-brand-950/60 border-brand-800/50 font-bold'
                : 'text-ui-muted hover:text-brand-400 bg-ui-surface2 border-ui-border hover:border-brand-800/50'
            }`}
            title="یافتن آگهی‌های اطراف من"
          >
            <Icon
              name={currentLocationName && currentLocationName !== 'کل افغانستان' ? 'MapPin' : 'Crosshair'}
              size={15}
              strokeWidth={2}
            />
            <span className="max-w-[80px] truncate">
              {currentLocationName === 'کل افغانستان' || !currentLocationName ? t('location') : currentLocationName}
            </span>
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); void fetchNotifications(); }}
              className="relative w-9 h-9 flex items-center justify-center text-ui-muted hover:text-ui-text bg-ui-surface2 hover:bg-ui-surface3 rounded-xl transition-all border border-ui-border"
            >
              <Icon name="Bell" size={18} strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-ui-danger rounded-full border-2 border-ui-bg animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-full left-0 mt-2 w-80 glass rounded-2xl shadow-float border border-ui-border overflow-hidden z-[60] animate-fadeUp">
                <div className="p-3.5 border-b border-ui-border flex justify-between items-center bg-ui-surface2/50">
                  <h4 className="font-bold text-ui-text text-sm flex items-center gap-2">
                    <Icon name="Bell" size={15} strokeWidth={2} className="text-brand-400" />
                    اعلان‌ها
                    {unreadCount > 0 && (
                      <span className="bg-ui-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                    )}
                  </h4>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                      <Icon name="CheckCircle" size={12} strokeWidth={2} />
                      خواندن همه
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-ui-muted">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-ui-surface2 flex items-center justify-center">
                        <Icon name="Bell" size={22} strokeWidth={1.5} className="opacity-40" />
                      </div>
                      <p className="text-xs">هیچ اعلان جدیدی ندارید.</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`p-3.5 border-b border-ui-border last:border-none hover:bg-ui-surface2/60 transition-colors ${!notif.isRead ? 'bg-ui-info/5' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                            notif.type === 'success' ? 'bg-ui-success/15 text-ui-success' :
                            notif.type === 'warning' ? 'bg-ui-warning/15 text-ui-warning' :
                            'bg-ui-info/15 text-ui-info'
                          }`}>
                            {notif.type === 'success' ? <Icon name="CheckCircle" size={16} strokeWidth={2} /> :
                             notif.type === 'warning' ? <Icon name="AlertTriangle" size={16} strokeWidth={2} /> :
                             <Icon name="Info" size={16} strokeWidth={2} />}
                          </div>
                          <div className="min-w-0">
                            <h5 className={`text-sm leading-tight ${!notif.isRead ? 'font-bold text-ui-text' : 'text-ui-muted'}`}>{notif.title}</h5>
                            <p className="text-xs text-ui-muted mt-1 leading-relaxed line-clamp-2">{notif.message}</p>
                            <span className="text-[10px] text-ui-subtle mt-1.5 block">{notif.date}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2.5 text-center bg-ui-surface2/30 border-t border-ui-border">
                  <button
                    onClick={() => { setShowNotifications(false); onNavigate(Page.DASHBOARD_SETTINGS); }}
                    className="text-xs text-brand-400 font-bold hover:text-brand-300 transition-colors"
                  >
                    تنظیمات اعلان
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User / Login */}
          {user ? (
            <div className="flex items-center gap-1.5">
              {user.role === 'ADMIN' && (
                <button
                  onClick={() => onNavigate('ADMIN_PANEL')}
                  className="hidden md:flex items-center gap-1.5 bg-ui-surface2 text-ui-text px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-ui-surface3 border border-ui-border transition-colors"
                >
                  <Icon name="Shield" size={13} strokeWidth={2} className="text-brand-400" />
                  <span>مدیریت</span>
                </button>
              )}
              <button
                onClick={() => onNavigate(Page.DASHBOARD)}
                className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-glow hover:shadow-glow-lg transition-all press"
                aria-label="پروفایل کاربری"
              >
                <Icon name="User" size={17} strokeWidth={2} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate(Page.LOGIN)}
              className="hidden md:flex items-center gap-2 btn-brand text-white px-4 py-2 rounded-xl text-sm font-bold"
            >
              <Icon name="LogIn" size={16} strokeWidth={2} className="rtl:rotate-180" />
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
            className="w-full h-[42px] pr-11 pl-9 bg-ui-surface2 rounded-2xl border border-ui-border focus:border-brand-700/50 focus:ring-2 focus:ring-brand-500/20 text-ui-text placeholder:text-ui-subtle text-sm outline-none transition-all"
            onChange={handleSearchInput}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <Icon name="Search" size={18} strokeWidth={2} className="absolute right-3.5 top-3 text-ui-muted pointer-events-none" />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); onSearch(''); }}
              className="absolute left-3 top-3 text-ui-subtle hover:text-ui-muted"
            >
              <Icon name="X" size={16} strokeWidth={2} />
            </button>
          )}
        </div>
        {showSuggestions && (
          <div className="absolute left-4 right-4 mt-2 glass rounded-2xl shadow-float border border-ui-border overflow-hidden z-50 animate-fadeUp">
            <ul>
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onClick={() => handleSelectSuggestion(s)}
                  className="px-4 py-3 hover:bg-ui-surface2 cursor-pointer text-sm text-ui-text flex items-center gap-3 border-b border-ui-border last:border-none"
                >
                  <Icon name="Search" size={14} strokeWidth={2} className="text-brand-400 shrink-0" />
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
