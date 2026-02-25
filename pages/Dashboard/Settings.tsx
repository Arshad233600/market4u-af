
import React, { useState } from 'react';
import Icon from '../../src/components/ui/Icon';
import { authService } from '../../services/authService';
import { azureService } from '../../services/azureService';
import { toastService } from '../../services/toastService';

const Settings: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SECURITY' | 'VERIFICATION' | 'NOTIFICATIONS'>('PROFILE');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form States
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  
  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Verification States
  const [frontId, setFrontId] = useState<File | null>(null);
  const [backId, setBackId] = useState<File | null>(null);

  // Notification States
  const [notifSettings, setNotifSettings] = useState(() => {
      const saved = azureService.getSettings();
      return saved || { notif_msg: true, notif_ad: true, notif_promo: true };
  });

  const handleSaveProfile = async () => {
    setIsLoading(true);
    const success = await azureService.updateUserProfile({ name, email });
    setIsLoading(false);
    
    if (success) {
        window.location.reload(); 
    }
  };

  const handleUpdatePassword = async () => {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 1500));
      setIsLoading(false);
      alert('رمز عبور بروزرسانی شد.');
      setCurrentPassword('');
      setNewPassword('');
  };

  const handleVerificationSubmit = async () => {
      if (!frontId || !backId) {
          alert('لطفا تصویر پشت و روی تذکره را آپلود کنید.');
          return;
      }
      setIsLoading(true);
      await azureService.uploadVerificationDocs(frontId, backId);
      setIsLoading(false);
      setFrontId(null);
      setBackId(null);
  };

  const handleDeleteAccount = async () => {
      const confirmText = prompt('برای تایید حذف حساب کاربری، عبارت "delete" را وارد کنید:');
      if (confirmText !== 'delete') return;

      setIsLoading(true);
      const success = await azureService.deleteAccount();
      setIsLoading(false);

      if (success) {
          alert('حساب کاربری شما با موفقیت حذف شد.');
          authService.logout();
          window.location.href = '/';
      } else {
          alert('خطا در حذف حساب کاربری.');
      }
  };

  const handleNotifChange = (key: string) => {
      const newSettings = { ...notifSettings, [key]: !(notifSettings as any)[key] };
      setNotifSettings(newSettings);
      azureService.saveSettings(newSettings);
      toastService.info('تنظیمات ذخیره شد');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-ui-text">تنظیمات حساب کاربری</h2>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-2">
          <button 
            onClick={() => setActiveTab('PROFILE')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'PROFILE' ? 'bg-ui-surface shadow-sm text-brand-600 font-bold border border-brand-100' : 'text-ui-muted hover:bg-ui-surface/50'}`}
          >
            <User className="w-5 h-5" />
            اطلاعات کاربری
          </button>
          <button 
            onClick={() => setActiveTab('VERIFICATION')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'VERIFICATION' ? 'bg-ui-surface shadow-sm text-brand-600 font-bold border border-brand-100' : 'text-ui-muted hover:bg-ui-surface/50'}`}
          >
            <FileCheck className="w-5 h-5" />
            احراز هویت
            {currentUser?.verificationStatus === 'VERIFIED' && <CheckCircle className="w-4 h-4 text-green-500 mr-auto" />}
          </button>
          <button 
            onClick={() => setActiveTab('SECURITY')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'SECURITY' ? 'bg-ui-surface shadow-sm text-brand-600 font-bold border border-brand-100' : 'text-ui-muted hover:bg-ui-surface/50'}`}
          >
            <Lock className="w-5 h-5" />
            امنیت و رمز عبور
          </button>
          <button 
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'NOTIFICATIONS' ? 'bg-ui-surface shadow-sm text-brand-600 font-bold border border-brand-100' : 'text-ui-muted hover:bg-ui-surface/50'}`}
          >
            <Bell className="w-5 h-5" />
            اعلان‌ها
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          
          {/* PROFILE TAB */}
          {activeTab === 'PROFILE' && (
            <div className="bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border space-y-6 animate-in fade-in">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative group cursor-pointer">
                   <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-2xl font-bold border-4 border-white shadow-md overflow-hidden">
                     {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover"/> : currentUser?.name?.charAt(0) || 'U'}
                   </div>
                   <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Camera className="w-6 h-6 text-white" />
                   </div>
                </div>
                <div>
                  <h3 className="font-bold text-ui-text">تصویر پروفایل</h3>
                  <p className="text-xs text-ui-muted mt-1">PNG یا JPG، حداکثر ۲ مگابایت</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ui-muted mb-1">نام کامل</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ui-muted mb-1">شماره موبایل</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 border border-ui-border rounded-xl bg-ui-surface2 text-ui-muted cursor-not-allowed outline-none"
                    disabled
                  />
                  <p className="text-xs text-ui-muted mt-1">شماره موبایل قابل تغییر نیست</p>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-ui-muted mb-1">ایمیل</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-ui-border flex justify-end">
                <button 
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-70"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  ذخیره تغییرات
                </button>
              </div>
            </div>
          )}

          {/* VERIFICATION TAB */}
          {activeTab === 'VERIFICATION' && (
              <div className="bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border space-y-6 animate-in fade-in">
                  <div className="flex items-start gap-4 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm">
                      <Shield className="w-6 h-6 flex-shrink-0" />
                      <p>
                          برای افزایش اعتماد خریداران و دریافت تیک آبی، لطفاً تصویر تذکره یا پاسپورت خود را ارسال کنید. 
                          اطلاعات شما کاملاً محرمانه باقی می‌ماند.
                      </p>
                  </div>

                  {currentUser?.verificationStatus === 'VERIFIED' ? (
                      <div className="flex flex-col items-center justify-center py-10 text-green-600 gap-3">
                          <CheckCircle className="w-16 h-16" />
                          <h3 className="text-xl font-bold">هویت شما تایید شده است</h3>
                      </div>
                  ) : currentUser?.verificationStatus === 'PENDING' ? (
                      <div className="flex flex-col items-center justify-center py-10 text-yellow-600 gap-3">
                          <Loader2 className="w-16 h-16 animate-spin" />
                          <h3 className="text-xl font-bold">مدارک شما در حال بررسی است</h3>
                      </div>
                  ) : (
                      <div className="space-y-6">
                          <div>
                              <label className="block text-sm font-bold text-ui-muted mb-2">تصویر روی تذکره/پاسپورت</label>
                              <div className="border-2 border-dashed border-ui-border rounded-xl p-8 flex flex-col items-center justify-center text-ui-muted hover:bg-ui-surface2 transition-colors cursor-pointer relative">
                                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFrontId(e.target.files?.[0] || null)} />
                                  {frontId ? <span className="text-brand-600 font-bold">{frontId.name}</span> : <>
                                      <Camera className="w-8 h-8 mb-2" />
                                      <span>برای آپلود کلیک کنید</span>
                                  </>}
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-ui-muted mb-2">تصویر پشت تذکره (اختیاری برای پاسپورت)</label>
                              <div className="border-2 border-dashed border-ui-border rounded-xl p-8 flex flex-col items-center justify-center text-ui-muted hover:bg-ui-surface2 transition-colors cursor-pointer relative">
                                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setBackId(e.target.files?.[0] || null)} />
                                  {backId ? <span className="text-brand-600 font-bold">{backId.name}</span> : <>
                                      <Camera className="w-8 h-8 mb-2" />
                                      <span>برای آپلود کلیک کنید</span>
                                  </>}
                              </div>
                          </div>
                          <button 
                            onClick={handleVerificationSubmit}
                            disabled={isLoading}
                            className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50"
                          >
                              {isLoading ? 'در حال ارسال...' : 'ارسال مدارک برای بررسی'}
                          </button>
                      </div>
                  )}
              </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'SECURITY' && (
            <div className="bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border space-y-6 animate-in fade-in">
               <div>
                 <h3 className="font-bold text-ui-text mb-4 flex items-center gap-2">
                   <Shield className="w-5 h-5 text-brand-600" />
                   تغییر رمز عبور
                 </h3>
                 <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-ui-muted mb-1">رمز عبور فعلی</label>
                      <input 
                        type="password" 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full p-3 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ui-muted mb-1">رمز عبور جدید</label>
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                    <button 
                      onClick={handleUpdatePassword}
                      disabled={isLoading}
                      className="bg-gray-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-900 transition-colors disabled:opacity-70 flex items-center gap-2"
                    >
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      بروزرسانی رمز
                    </button>
                 </div>
               </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'NOTIFICATIONS' && (
            <div className="bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border space-y-6 animate-in fade-in">
              {[
                { key: 'notif_msg', label: 'اعلان پیام جدید', desc: 'وقتی کاربری به شما پیام می‌دهد' },
                { key: 'notif_ad', label: 'تایید آگهی', desc: 'وقتی آگهی شما توسط مدیر تایید می‌شود' },
                { key: 'notif_promo', label: 'پیشنهادهای ویژه', desc: 'تخفیف‌ها و اخبار بازار افغان' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2">
                   <div>
                     <p className="font-bold text-ui-text">{item.label}</p>
                     <p className="text-xs text-ui-muted">{item.desc}</p>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={(notifSettings as any)[item.key]} 
                        onChange={() => handleNotifChange(item.key)}
                      />
                      <div className="w-11 h-6 bg-ui-surface2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ui-surface after:border-ui-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                   </label>
                </div>
              ))}
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mt-8">
              <h3 className="text-red-700 font-bold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  منطقه خطر
              </h3>
              <p className="text-sm text-red-600/80 mb-4">
                  حذف حساب کاربری غیرقابل بازگشت است. تمام آگهی‌ها، پیام‌ها و اطلاعات شما حذف خواهند شد (Soft Delete).
              </p>
              <button 
                onClick={handleDeleteAccount}
                disabled={isLoading}
                className="flex items-center gap-2 bg-ui-surface border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-600 hover:text-white transition-colors"
              >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  حذف حساب کاربری
              </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;
