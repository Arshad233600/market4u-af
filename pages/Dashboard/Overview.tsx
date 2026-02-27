
import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Wallet, Plus, AlertTriangle, Eye, MousePointerClick,
  MessageSquare, Zap, Activity, Clock, LogOut, RefreshCw
} from 'lucide-react';
import { azureService } from '../../services/azureService';
import { DashboardStats, Page } from '../../types';
import { authService } from '../../services/authService';

interface OverviewProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
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

const Overview: React.FC<OverviewProps> = ({ onNavigate, onLogout }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [chartPeriod, setChartPeriod] = useState<'7' | '30'>('7');
  const user = authService.getCurrentUser();

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      if (!cancelled) {
        setStats(null);
        setLoadError(null);
      }
      // Client-side pre-flight check:
      // If the token is client-side expired, attempt a silent refresh first.
      // We never invalidate the session automatically — the user must log out
      // explicitly. If no token exists or refresh fails, just proceed and let
      // the API layer surface any errors to the UI.
      if (authService.isTokenExpired()) {
        try {
          await authService.refreshToken();
        } catch (err) {
          // Refresh request failed (e.g. network error); proceed anyway.
          console.warn('[auth] Token refresh failed in Overview pre-flight:', err instanceof Error ? err.message : err);
        }
      }
      try {
        const s = await azureService.getDashboardStats();
        if (!cancelled) setStats(s);
      } catch (err) {
        // For all errors (network outage, server error, auth errors),
        // show an error message with a retry option instead of an infinite spinner.
        // The session is never invalidated automatically.
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'خطای ناشناخته';
          setLoadError(msg);
        }
      }
      try {
        const acts = await azureService.getRecentActivities();
        if (!cancelled) setActivities(acts);
      } catch {
        // Activities are non-critical; silently ignore failures.
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [loadKey]);

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'صبح بخیر';
      if (hour < 18) return 'عصر بخیر';
      return 'شب بخیر';
  };

  if (loadError) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <AlertTriangle className="w-12 h-12 text-yellow-500" />
      <p className="text-ui-muted font-medium text-center max-w-sm">خطا در بارگذاری اطلاعات. لطفاً دوباره تلاش کنید.</p>
      <button
        onClick={() => setLoadKey(k => k + 1)}
        className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        تلاش مجدد
      </button>
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
  // Scale bars proportionally: 30-day period shows ~4x more cumulative views than 7-day
  const periodMultiplier = chartPeriod === '30' ? 4 : 1;
  const chartData = [
      { d: 'شنبه', h: Math.min(100, (baseViews * 0.1 / 5) * 100 * periodMultiplier) }, 
      { d: 'یکشنبه', h: Math.min(100, (baseViews * 0.15 / 5) * 100 * periodMultiplier) },
      { d: 'دوشنبه', h: Math.min(100, (baseViews * 0.12 / 5) * 100 * periodMultiplier) },
      { d: 'سه‌شنبه', h: Math.min(100, (baseViews * 0.2 / 5) * 100 * periodMultiplier) },
      { d: 'چهارشنبه', h: Math.min(100, (baseViews * 0.18 / 5) * 100 * periodMultiplier) },
      { d: 'پنجشنبه', h: Math.min(100, (baseViews * 0.25 / 5) * 100 * periodMultiplier) },
      { d: 'جمعه', h: Math.min(100, (baseViews * 0.3 / 5) * 100 * periodMultiplier) }
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
           <button
             onClick={onLogout}
             className="flex items-center gap-2 px-4 py-2 bg-ui-danger/10 text-ui-danger rounded-xl text-sm font-bold border border-ui-danger/20 hover:bg-ui-danger/20 transition-colors"
           >
             <LogOut className="w-4 h-4" />
             <span className="hidden sm:inline">خروج</span>
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
                عملکرد بازدید {chartPeriod === '7' ? 'هفته' : 'ماه'} اخیر
              </h3>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as '7' | '30')}
                className="text-xs bg-ui-surface2 border border-ui-border rounded-lg px-2 py-1 outline-none text-ui-muted"
              >
                  <option value="7">۷ روز گذشته</option>
                  <option value="30">۳۰ روز گذشته</option>
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
