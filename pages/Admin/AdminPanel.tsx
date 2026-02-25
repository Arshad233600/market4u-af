
import React, { useEffect, useState, useCallback } from 'react';
import Icon from '../../src/components/ui/Icon';
import { azureService } from '../../services/azureService';
import { Product, User as UserType } from '../../types';
import { Page } from '../../types';

interface AdminPanelProps {
    onNavigate: (page: Page) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'ADS' | 'USERS'>('ADS');
    const [pendingAds, setPendingAds] = useState<Product[]>([]);
    const [pendingUsers, setPendingUsers] = useState<UserType[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        if (activeTab === 'ADS') {
            const data = await azureService.adminGetPendingAds();
            setPendingAds(data);
        } else {
            const data = await azureService.adminGetPendingVerifications();
            setPendingUsers(data);
        }
        setLoading(false);
    }, [activeTab]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchData();
    }, [fetchData]);

    const handleAdAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
        if (!confirm('آیا مطمئن هستید؟')) return;
        
        if (action === 'APPROVE') {
            await azureService.adminApproveAd(id);
        } else {
            await azureService.adminRejectAd(id);
        }
        setPendingAds(prev => prev.filter(ad => ad.id !== id));
    };

    const handleUserAction = async (id: string, action: 'VERIFY' | 'REJECT') => {
        if (!confirm('آیا مطمئن هستید؟')) return;

        if (action === 'VERIFY') {
            await azureService.adminVerifyUser(id, 'VERIFIED');
        } else {
            await azureService.adminVerifyUser(id, 'REJECTED');
        }
        setPendingUsers(prev => prev.filter(u => u.id !== id));
    };

    return (
        <div className="min-h-screen bg-ui-surface2 pb-20">
            {/* Header */}
            <div className="bg-gray-900 text-white p-6 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Icon name="Shield" size={24} strokeWidth={1.8} className="text-green-400" />
                        <div>
                            <h1 className="text-2xl font-bold">پنل مدیریت بازار</h1>
                            <p className="text-xs text-ui-muted mt-1">نسخه ۱.۰ - دسترسی مدیر ارشد</p>
                        </div>
                    </div>
                    <button onClick={() => onNavigate(Page.HOME)} className="text-sm bg-ui-surface/10 hover:bg-ui-surface/20 px-4 py-2 rounded-lg">
                        خروج از پنل
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Tabs */}
                <div className="flex gap-4 mb-8">
                    <button 
                        onClick={() => setActiveTab('ADS')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'ADS' ? 'bg-ui-surface shadow-md text-brand-600 ring-1 ring-brand-100' : 'bg-ui-surface2 text-ui-muted hover:bg-gray-300'}`}
                    >
                        <Icon name="FileText" size={20} strokeWidth={1.8} />
                        بررسی آگهی‌ها
                        {pendingAds.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingAds.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('USERS')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'USERS' ? 'bg-ui-surface shadow-md text-brand-600 ring-1 ring-brand-100' : 'bg-ui-surface2 text-ui-muted hover:bg-gray-300'}`}
                    >
                        <Icon name="User" size={20} strokeWidth={1.8} />
                        احراز هویت کاربران
                        {pendingUsers.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingUsers.length}</span>}
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="text-center py-20 text-ui-muted">در حال بارگذاری اطلاعات...</div>
                ) : (
                    <>
                        {activeTab === 'ADS' && (
                            <div className="space-y-4">
                                {pendingAds.length === 0 ? (
                                    <div className="bg-ui-surface p-12 rounded-2xl shadow-sm text-center text-ui-muted">
                                        <Icon name="CheckCircle" size={24} strokeWidth={1.8} className="text-green-500 mx-auto mb-4" />
                                        <p>تبریک! هیچ آگهی در انتظار بررسی وجود ندارد.</p>
                                    </div>
                                ) : (
                                    pendingAds.map(ad => (
                                        <div key={ad.id} className="bg-ui-surface p-4 rounded-xl shadow-sm border border-ui-border flex flex-col md:flex-row gap-4">
                                            <div className="w-full md:w-48 h-32 bg-ui-surface2 rounded-lg overflow-hidden shrink-0">
                                                <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-lg text-ui-text">{ad.title}</h3>
                                                        <p className="text-brand-600 font-bold mt-1">{ad.price.toLocaleString()} ؋</p>
                                                    </div>
                                                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">در انتظار تایید</span>
                                                </div>
                                                <p className="text-sm text-ui-muted mt-3 line-clamp-2">{ad.description}</p>
                                                <div className="text-xs text-ui-muted mt-2 flex gap-3">
                                                    <span>دسته‌بندی: {ad.category}</span>
                                                    <span>فروشنده: {ad.sellerName}</span>
                                                    <span>موقعیت: {ad.location}</span>
                                                </div>
                                            </div>
                                            <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-r border-ui-border pt-4 md:pt-0 md:pr-4">
                                                <button onClick={() => handleAdAction(ad.id, 'APPROVE')} className="flex items-center justify-center gap-2 bg-green-50 text-green-600 hover:bg-green-100 px-4 py-2 rounded-lg font-bold transition-colors">
                                                    <Icon name="CheckCircle" size={20} strokeWidth={1.8} className="text-green-600" /> تایید
                                                </button>
                                                <button onClick={() => handleAdAction(ad.id, 'REJECT')} className="flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-bold transition-colors">
                                                    <Icon name="XCircle" size={20} strokeWidth={1.8} className="text-red-600" /> رد کردن
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'USERS' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingUsers.length === 0 ? (
                                    <div className="col-span-full bg-ui-surface p-12 rounded-2xl shadow-sm text-center text-ui-muted">
                                        <Icon name="CheckCircle" size={24} strokeWidth={1.8} className="text-green-500 mx-auto mb-4" />
                                        <p>هیچ درخواست احراز هویتی وجود ندارد.</p>
                                    </div>
                                ) : (
                                    pendingUsers.map(user => (
                                        <div key={user.id} className="bg-ui-surface p-6 rounded-xl shadow-sm border border-ui-border">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 bg-ui-surface2 rounded-full flex items-center justify-center text-xl font-bold text-ui-muted">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-ui-text">{user.name}</h3>
                                                    <p className="text-sm text-ui-muted dir-ltr text-right">{user.phone}</p>
                                                </div>
                                            </div>
                                            <div className="bg-ui-surface2 p-4 rounded-lg mb-4 text-center">
                                                <p className="text-xs text-ui-muted mb-2">تصویر تذکره</p>
                                                <div className="h-32 bg-ui-surface2 rounded flex items-center justify-center text-ui-muted cursor-pointer hover:bg-gray-300">
                                                    <Icon name="Eye" size={24} strokeWidth={1.8} className="mr-2" /> مشاهده مدرک
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleUserAction(user.id, 'VERIFY')} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700">تایید هویت</button>
                                                <button onClick={() => handleUserAction(user.id, 'REJECT')} className="flex-1 bg-ui-surface2 text-ui-muted py-2 rounded-lg font-bold hover:bg-ui-surface2">رد درخواست</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
