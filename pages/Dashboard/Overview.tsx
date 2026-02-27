
import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Wallet, Plus, AlertTriangle, Eye, MousePointerClick,
  MessageSquare, Zap, Activity, Clock
} from 'lucide-react';
import { azureService } from '../../services/azureService';
import { AuthError } from '../../services/apiClient';
import { DashboardStats, Page } from '../../types';
import { authService } from '../../services/authService';

interface OverviewProps {
  onNavigate: (page: Page) => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'brand' | 'blue' | 'purple' | 'yellow' | 'green';
  trend?: string;
  onClick?: () => void;
}

const StatCard = ({ title, value, icon: IconComponent, color, trend, onClick }: StatCardProps) => {
    const colorClasses: Record<string, string> = {
        brand: 'bg-brand-100 text-brand-600',
        blue: 'bg-blue-100 text-blue-600',
        purple: 'bg-purple-100 text-purple-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        green: 'bg-green-100 text-green-600'
    };
    const bgClasses: Record<string, string> = {
        brand: 'bg-brand-50',
        blue: 'bg-blue-50',
        purple: 'bg-purple-50',
        yellow: 'bg-yellow-50',
        green: 'bg-green-50'
    };

    return (
        <div onClick={onClick} className="bg-ui-surface p-5 rounded-2xl shadow-sm border border-ui-border hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 ${bgClasses[color] || 'bg-ui-surface2'} rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
            <div className="relative z-10 flex justify-between items-start mb-3">
                <div className={`p-3 rounded-xl ${colorClasses[color] || 'bg-ui-surface2 text-ui-muted'}`}>
                    <IconComponent className="w-6 h-6" />
                </div>
                {trend && (
                    <span className="flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                        <TrendingUp className="w-3 h-3 mr-1 text-green-600" /> {trend}
                    </span>
                )}
            </div>
            <div className="relative z-10">
                <h3 className="text-2xl font-bold text-ui-text tracking-tight">{value}</h3>
                <p className="text-xs text-ui-muted font-medium mt-1">{title}</p>
            </div>
        </div>
    );
};

const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [isAuthError, setIsAuthError] = useState(false);
  const user = authService.getCurrentUser();

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      // Skip API calls if we already know the token is missing or expired
      if (!authService.getToken() || authService.isTokenExpired()) {
        if (!cancelled) setIsAuthError(true);
        return;
      }
      try {
        const s = await azureService.getDashboardStats();
        if (!cancelled) setStats(s);
      } catch (err) {
        // Auth errors (401): apiClient has already triggered logout + auth-change redirect.
        // We just flag this so we don't keep showing the spinner with stale messaging.
        if (!cancelled) {
          if (err instanceof AuthError) {
            setIsAuthError(true);
          }
          // For other errors (network outage etc.) stats remains null → spinner
        }
      }
      try {
        const acts = await azureService.getRecentActivities();
        if (!cancelled) setActivities(acts);
      } catch {
        // API unavailable - activities remain empty
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isAuthError) {
      // Only call logout when the session is definitively gone (apiClient already ran its
      // definitive logout clearing storage and getCurrentUser returns null), or when the
      // token is client-side expired. On a soft-fail first 401 the user is still in storage,
      // so we must not logout here — that would bypass the 5-second soft-fail window.
      if (!authService.getCurrentUser() || authService.isTokenExpired()) {
        authService.logout();
      }
    }
  }, [isAuthError]);

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'صبح بخیر';
      if (hour < 18) return 'عصر بخیر';
      return 'شب بخیر';
  };

  if (isAuthError) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3">
      <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
      <span className="text-ui-muted font-medium">نشست شما منقضی شده است. در حال انتقال به صفحه ورود...</span>
    </div>
  );

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-96">
      <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
      <span className="text-ui-muted font-medium animate-pulse">در حال تحلیل داده‌های بازار...</span>
    </div>
  );



  // Dynamic Chart Data based on views
  const baseViews = stats.totalViews || 100;
  const chartData = [
      { d: 'شنبه', h: Math.min(100, (baseViews * 0.1 / 5) * 100) }, 
      { d: 'یکشنبه', h: Math.min(100, (baseViews * 0.15 / 5) * 100) },
      { d: 'دوشنبه', h: Math.min(100, (baseViews * 0.12 / 5) * 100) },
      { d: 'سه‌شنبه', h: Math.min(100, (baseViews * 0.2 / 5) * 100) },
      { d: 'چهارشنبه', h: Math.min(100, (baseViews * 0.18 / 5) * 100) },
      { d: 'پنجشنبه', h: Math.min(100, (baseViews * 0.25 / 5) * 100) }, // Weekend peak
      { d: 'جمعه', h: Math.min(100, (baseViews * 0.3 / 5) * 100) }     // Friday peak
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-ui-text flex items-center gap-2">
             {getGreeting()}، {user?.name || 'کاربر عزیز'} 👋
           </h1>
           <p className="text-ui-muted text-sm mt-1">خوش آمدید! وضعیت کسب‌وکار شما در یک نگاه.</p>
        </div>
        <div className="flex gap-3">
           <button onClick={() => onNavigate(Page.DASHBOARD_WALLET)} className="hidden md:flex items-center gap-2 px-4 py-2 bg-ui-surface border border-ui-border text-ui-muted rounded-xl text-sm font-bold hover:bg-ui-surface2 transition-colors">
              <Wallet className="w-4 h-4" />
              موجودی: {stats.walletBalance.toLocaleString()} ؋
           </button>
           <button 
             onClick={() => onNavigate(Page.POST_AD)}
             className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-transform active:scale-95 flex items-center gap-2"
           >
             <Plus className="w-4 h-4 text-white" />
             ثبت آگهی جدید
           </button>
        </div>
      </div>

      {/* Action Required (To-Do List) */}
      {(stats.unreadMessages > 0 || stats.activeAds === 0) && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in slide-in-from-top-4">
            <div className="p-2 bg-orange-100 rounded-full text-orange-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-orange-800 text-sm">اقدامات ضروری</h3>
                <div className="flex flex-wrap gap-2 mt-1">
                    {stats.unreadMessages > 0 && (
                        <span onClick={() => onNavigate(Page.DASHBOARD_CHAT)} className="cursor-pointer text-xs bg-ui-surface text-orange-700 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100 transition-colors">
                            {stats.unreadMessages} پیام خوانده نشده دارید
                        </span>
                    )}
                    {stats.activeAds === 0 && (
                        <span onClick={() => onNavigate(Page.POST_AD)} className="cursor-pointer text-xs bg-ui-surface text-orange-700 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100 transition-colors">
                            شما هیچ آگهی فعالی ندارید، اولین فروش خود را آغاز کنید!
                        </span>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
            title="بازدید کل آگهی‌ها" 
            value={stats.totalViews.toLocaleString()} 
            icon={Eye} 
            color="blue" 
            trend="+۱۲٪" 
            onClick={() => onNavigate(Page.DASHBOARD_ADS)}
        />
        <StatCard 
            title="کلیک روی شماره" 
            value={Math.floor(stats.totalViews * 0.08).toLocaleString()} 
            icon={MousePointerClick} 
            color="purple" 
            trend="+۵٪" 
            onClick={() => onNavigate(Page.DASHBOARD_ADS)}
        />
        <StatCard 
            title="پیام‌های خریداران" 
            value={stats.unreadMessages > 0 ? `${stats.unreadMessages} جدید` : 'همه خوانده شده'} 
            icon={MessageSquare} 
            color="yellow" 
            onClick={() => onNavigate(Page.DASHBOARD_CHAT)}
        />
        <StatCard 
            title="آگهی‌های فعال" 
            value={stats.activeAds} 
            icon={Zap} 
            color="green" 
            onClick={() => onNavigate(Page.DASHBOARD_ADS)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Performance Chart Section */}
        <div className="lg:col-span-2 bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border flex flex-col">
           <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-ui-text flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-600" />
                عملکرد بازدید هفته اخیر
              </h3>
              <select className="text-xs bg-ui-surface2 border border-ui-border rounded-lg px-2 py-1 outline-none text-ui-muted">
                  <option>۷ روز گذشته</option>
                  <option>۳۰ روز گذشته</option>
              </select>
           </div>
           
           <div className="h-48 flex items-end justify-between gap-2 px-2 flex-1">
               {chartData.map((item, i) => (
                   <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                       <div className="w-full bg-ui-surface2 rounded-t-lg relative h-full flex items-end overflow-hidden group-hover:bg-ui-surface2 transition-colors">
                           <div 
                               className="w-full bg-brand-500 opacity-80 group-hover:opacity-100 transition-all duration-700 ease-out rounded-t-lg relative" 
                               style={{ height: `${item.h}%` }}
                           >
                               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                   {Math.floor((item.h / 100) * baseViews * 0.5)} بازدید
                               </div>
                           </div>
                       </div>
                       <span className="text-[10px] text-ui-muted font-medium">{item.d}</span>
                   </div>
               ))}
           </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border">
            <h3 className="font-bold text-ui-text mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                فعالیت‌های اخیر
            </h3>
            
            <div className="space-y-4">
                {activities.length === 0 ? (
                    <p className="text-center text-ui-muted text-xs py-10">هنوز فعالیتی ثبت نشده است.</p>
                ) : (
                    activities.map((act, i) => (
                        <div key={i} className="flex gap-3 items-start pb-4 border-b border-gray-50 last:border-none last:pb-0">
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                act.type === 'AD' ? 'bg-brand-500' : 
                                act.type === 'WALLET' ? 'bg-green-500' : 'bg-yellow-500'
                            }`}></div>
                            <div>
                                <p className="text-sm font-bold text-ui-text">{act.title}</p>
                                {act.detail && <p className="text-xs text-ui-muted mt-0.5">{act.detail}</p>}
                                <p className="text-[10px] text-ui-muted mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {act.date}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <button onClick={() => onNavigate(Page.DASHBOARD_ADS)} className="w-full mt-4 text-xs text-brand-600 font-bold hover:bg-brand-50 py-2 rounded-lg transition-colors">
                مشاهده همه فعالیت‌ها
            </button>
        </div>

      </div>
    </div>
  );
};

export default Overview;
