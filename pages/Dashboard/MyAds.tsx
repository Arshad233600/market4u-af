
import React, { useEffect, useState } from 'react';
import {
  CheckCircle, Clock, XCircle, Filter, TrendingUp, Rocket,
  Eye, MousePointerClick, AlertCircle, Edit,
  Loader2, Trash2, X
} from 'lucide-react';
import { azureService } from '../../services/azureService';
import { Product, AdStatus } from '../../types';
import { APP_STRINGS } from '../../constants';
import { toastService } from '../../services/toastService';

interface MyAdsProps {
    onEdit?: (product: Product) => void;
}

const MyAds: React.FC<MyAdsProps> = ({ onEdit }) => {
  const [ads, setAds] = useState<Product[]>([]);
  const [filter, setFilter] = useState<'ALL' | AdStatus>('ALL');
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [promoteModalAd, setPromoteModalAd] = useState<Product | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ adId: string; action: 'delete' | 'sold' } | null>(null);

  useEffect(() => {
    const loadAds = async () => {
      try {
        const data = await azureService.getMyAds();
        setAds(data);
      } catch {
        setAds([]);
      }
    };
    loadAds();
  }, []);

  const handleStatusChange = async (adId: string, newStatus: AdStatus) => {
      setLoadingActionId(adId);
      const success = await azureService.updateAdStatus(adId, newStatus);
      setLoadingActionId(null);
      setConfirmAction(null);

      if (success) {
           setAds(prev => prev.map(ad => ad.id === adId ? { ...ad, status: newStatus } : ad));
           toastService.success('وضعیت آگهی تغییر کرد.');
      } else {
           toastService.error('خطا در تغییر وضعیت.');
      }
  };

  const handleDelete = async (adId: string) => {
      setLoadingActionId(adId);
      const success = await azureService.deleteAd(adId);
      setLoadingActionId(null);
      setConfirmAction(null);

      if (success) {
          setAds(prev => prev.filter(ad => ad.id !== adId));
          toastService.success('آگهی با موفقیت حذف شد.');
      } else {
          toastService.error('خطا در حذف آگهی.');
      }
  };

  const handleConfirmAction = () => {
      if (!confirmAction) return;
      if (confirmAction.action === 'delete') {
          handleDelete(confirmAction.adId);
      } else if (confirmAction.action === 'sold') {
          handleStatusChange(confirmAction.adId, AdStatus.SOLD);
      }
  };

  const handlePromote = async (plan: 'URGENT' | 'LADDER') => {
      if (!promoteModalAd) return;
      setLoadingActionId(promoteModalAd.id);
      const success = await azureService.promoteAd(promoteModalAd.id, plan);
      setLoadingActionId(null);
      setPromoteModalAd(null);
      if (success && plan === 'URGENT') {
          setAds(prev => prev.map(ad => ad.id === promoteModalAd.id ? { ...ad, isPromoted: true } : ad));
          toastService.success('آگهی شما ارتقا یافت!');
      }
  };

  const getStatusBadge = (status: AdStatus) => {
    switch (status) {
      case AdStatus.ACTIVE:
        return <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5" /> منتشر شده</span>;
      case AdStatus.PENDING:
        return <span className="flex items-center gap-1.5 text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2.5 py-1 rounded-full"><Clock className="w-3.5 h-3.5" /> در انتظار بررسی</span>;
      case AdStatus.SOLD:
        return <span className="flex items-center gap-1.5 text-xs font-bold text-ui-muted bg-ui-surface2 border border-ui-border px-2.5 py-1 rounded-full">فروخته شده</span>;
      case AdStatus.REJECTED:
        return <span className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full"><XCircle className="w-3.5 h-3.5" /> رد شده</span>;
      default:
        return <span className="flex items-center gap-1.5 text-xs font-bold text-ui-muted bg-ui-surface2 border border-ui-border px-2.5 py-1 rounded-full">منقضی</span>;
    }
  };

  const filteredAds = filter === 'ALL' ? ads : ads.filter(a => a.status === filter);

  // Mock analytics generation
  const getMockAnalytics = (views: number) => ({
      clicks: Math.floor(views * 0.15),
      ctr: ((Math.floor(views * 0.15) / views) * 100).toFixed(1)
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-ui-text">مدیریت آگهی‌ها</h2>
            <p className="text-sm text-ui-muted mt-1">آگهی‌های خود را مدیریت، ویرایش یا ارتقا دهید.</p>
        </div>
        <button className="flex items-center gap-2 text-sm text-brand-600 font-bold hover:bg-brand-50 px-3 py-2 rounded-lg transition-colors">
            <TrendingUp className="w-4 h-4" />
            تحلیل کلی
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-ui-border overflow-x-auto no-scrollbar">
          <div className="flex gap-6 min-w-max px-2">
            {[
                { id: 'ALL', label: 'همه' },
                { id: AdStatus.ACTIVE, label: 'فعال' },
                { id: AdStatus.PENDING, label: 'در انتظار' },
                { id: AdStatus.SOLD, label: 'فروخته شده' },
                { id: AdStatus.REJECTED, label: 'رد شده' },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
                        filter === tab.id 
                        ? 'border-brand-600 text-brand-600' 
                        : 'border-transparent text-ui-muted hover:text-ui-text'
                    }`}
                >
                    {tab.label}
                    <span className={`mr-2 text-xs py-0.5 px-1.5 rounded-full ${filter === tab.id ? 'bg-brand-100' : 'bg-ui-surface2'}`}>
                        {tab.id === 'ALL' ? ads.length : ads.filter(a => a.status === tab.id).length}
                    </span>
                </button>
            ))}
          </div>
      </div>

      <div className="space-y-4">
        {filteredAds.length === 0 ? (
          <div className="text-center py-20 bg-ui-surface rounded-2xl border border-dashed border-ui-border">
             <div className="mx-auto w-16 h-16 bg-ui-surface2 rounded-full flex items-center justify-center mb-4 text-ui-muted">
                <Filter className="w-8 h-8" />
             </div>
             <p className="text-ui-muted font-medium">هیچ آگهی در این بخش یافت نشد.</p>
          </div>
        ) : (
          filteredAds.map((ad) => {
            const stats = getMockAnalytics(ad.views || 0);
            return (
            <div key={ad.id} className="bg-ui-surface p-4 rounded-2xl shadow-sm border border-ui-border flex flex-col gap-4 hover:border-brand-200 transition-colors">
               
               <div className="flex gap-4">
                    {/* Image */}
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-ui-surface2 rounded-xl overflow-hidden flex-shrink-0 relative group">
                        <img src={ad.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={ad.title} />
                        {ad.isPromoted && <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1"><Rocket className="w-3 h-3 text-yellow-900"/> ویژه</span>}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-ui-text text-lg line-clamp-1 hover:text-brand-600 cursor-pointer">{ad.title}</h4>
                            </div>
                            <p className="text-brand-600 text-lg font-bold mt-1">{ad.price.toLocaleString()} {APP_STRINGS.currency}</p>
                            
                            {/* Analytics Row */}
                            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-ui-muted bg-ui-surface2 p-2 rounded-lg w-fit">
                                <span className="flex items-center gap-1.5" title="تعداد بازدید"><Eye className="w-3.5 h-3.5 text-blue-500" /> <b>{ad.views}</b> بازدید</span>
                                <span className="w-px h-3 bg-gray-300"></span>
                                <span className="flex items-center gap-1.5" title="تعداد تماس/چت"><MousePointerClick className="w-3.5 h-3.5 text-purple-500" /> <b>{stats.clicks}</b> تعامل</span>
                                <span className="w-px h-3 bg-gray-300"></span>
                                <span className="text-ui-muted">{ad.postedDate}</span>
                            </div>
                        </div>
                    </div>
               </div>

               {/* Rejected Reason Banner */}
               {ad.status === AdStatus.REJECTED && (
                   <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-3 rounded-xl flex items-start gap-2">
                       <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                       <p>این آگهی به دلیل <b>«عدم تطابق عکس با محصول»</b> رد شده است. لطفاً ویرایش کنید.</p>
                   </div>
               )}

               {/* Footer Actions */}
               <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-50 mt-1">
                    {getStatusBadge(ad.status)}
                    
                    {confirmAction?.adId === ad.id ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                            <span className="text-xs text-ui-muted">
                                {confirmAction.action === 'delete' ? 'حذف این آگهی؟' : 'آیا فروخته شد؟'}
                            </span>
                            <button
                                onClick={handleConfirmAction}
                                disabled={loadingActionId === ad.id}
                                className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loadingActionId === ad.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'بله، مطمئنم'}
                            </button>
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="text-xs font-bold text-ui-muted hover:bg-ui-surface2 px-3 py-1.5 rounded-lg transition-colors border border-ui-border"
                            >
                                انصراف
                            </button>
                        </div>
                    ) : (
                    <div className="flex gap-2">
                        {ad.status === AdStatus.ACTIVE && (
                        <>
                            <button 
                                onClick={() => setPromoteModalAd(ad)}
                                className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                            >
                                <Rocket className="w-3.5 h-3.5 text-white" />
                                افزایش بازدید
                            </button>
                            <button 
                                onClick={() => setConfirmAction({ adId: ad.id, action: 'sold' })}
                                className="flex items-center gap-1.5 text-xs font-bold text-ui-muted bg-ui-surface border border-ui-border hover:bg-ui-surface2 px-4 py-2 rounded-xl transition-colors"
                            >
                                فروختم
                            </button>
                        </>
                        )}
                        <button 
                            onClick={() => onEdit && onEdit(ad)}
                            disabled={loadingActionId === ad.id}
                            className="flex items-center gap-1.5 text-xs font-bold text-ui-muted bg-ui-surface border border-ui-border hover:bg-ui-surface2 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <Edit className="w-3.5 h-3.5" />
                            ویرایش
                        </button>
                        <button 
                            onClick={() => setConfirmAction({ adId: ad.id, action: 'delete' })}
                            disabled={loadingActionId === ad.id}
                            className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {loadingActionId === ad.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                    )}
               </div>
            </div>
            )
          })
        )}
      </div>

      {/* Promotion Modal */}
      {promoteModalAd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-ui-surface rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
                  <button onClick={() => setPromoteModalAd(null)} className="absolute top-4 left-4 p-1 hover:bg-ui-surface2 rounded-full"><X className="w-5 h-5"/></button>
                  <div className="text-center mb-6">
                     <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 text-orange-600">
                         <Rocket className="w-8 h-8" />
                     </div>
                     <h3 className="text-xl font-bold text-ui-text">افزایش بازدید آگهی</h3>
                     <p className="text-sm text-ui-muted mt-1">با ارتقای آگهی، مشتریان بیشتری محصول شما را می‌بینند.</p>
                  </div>

                  <div className="space-y-3">
                      <button 
                        onClick={() => handlePromote('URGENT')}
                        disabled={loadingActionId === promoteModalAd.id}
                        className="w-full border-2 border-orange-100 bg-orange-50/50 hover:bg-orange-50 p-4 rounded-2xl flex items-center justify-between group transition-colors relative overflow-hidden"
                      >
                          <div className="flex items-center gap-3 relative z-10">
                              <div className="bg-orange-500 text-white p-2.5 rounded-xl"><Rocket className="w-6 h-6" /></div>
                              <div className="text-right">
                                  <p className="font-bold text-ui-text">نشان فوری و ویژه</p>
                                  <p className="text-xs text-ui-muted mt-0.5">۳ روز در صدر لیست + برچسب ویژه</p>
                              </div>
                          </div>
                          <span className="font-bold text-brand-600 bg-ui-surface px-3 py-1 rounded-lg shadow-sm">۲۰۰ ؋</span>
                      </button>

                      <button 
                        onClick={() => handlePromote('LADDER')}
                        disabled={loadingActionId === promoteModalAd.id}
                        className="w-full border border-ui-border bg-ui-surface hover:bg-ui-surface2 p-4 rounded-2xl flex items-center justify-between group transition-colors"
                      >
                           <div className="flex items-center gap-3">
                              <div className="bg-ui-surface2 text-ui-muted p-2.5 rounded-xl"><TrendingUp className="w-6 h-6" /></div>
                              <div className="text-right">
                                  <p className="font-bold text-ui-text">نردبان</p>
                                  <p className="text-xs text-ui-muted mt-0.5">آگهی به اول لیست باز می‌گردد</p>
                              </div>
                          </div>
                          <span className="font-bold text-ui-muted">۵۰ ؋</span>
                      </button>
                  </div>
                  {loadingActionId === promoteModalAd.id && <div className="absolute inset-0 bg-ui-surface/50 flex items-center justify-center rounded-2xl"><Loader2 className="w-8 h-8 animate-spin text-brand-600"/></div>}
              </div>
          </div>
      )}
    </div>
  );
};

export default MyAds;
