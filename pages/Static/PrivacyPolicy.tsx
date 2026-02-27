
import React from 'react';
import { UserX } from 'lucide-react';
import Icon from '../../src/components/ui/Icon';
import { Page } from '../../types';

interface StaticPageProps {
  onNavigate: (page: Page) => void;
}

const PrivacyPolicy: React.FC<StaticPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-20 bg-ui-surface">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b">
         <button
           onClick={() => onNavigate(Page.HOME)}
           className="p-2 rounded-xl bg-ui-surface2 text-ui-muted hover:text-ui-text hover:bg-ui-surface3 border border-ui-border transition-colors shrink-0"
           aria-label="بازگشت"
         >
           <Icon name="ArrowRight" size={20} strokeWidth={2} />
         </button>
         <div className="bg-brand-50 p-3 rounded-2xl">
            <Icon name="Lock" size={24} strokeWidth={1.8} className="text-brand-600" />
         </div>
         <div>
            <h1 className="text-2xl md:text-3xl font-bold text-ui-text">سیاست حفظ حریم خصوصی</h1>
            <p className="text-sm text-ui-muted mt-1">تعهد ما به حفاظت از داده‌های شما</p>
         </div>
      </div>

      <div className="space-y-10">
         <p className="text-ui-muted text-sm leading-7 text-justify">
             در Market4U، حریم خصوصی شما اولویت ماست. این سند توضیح می‌دهد که ما چه اطلاعاتی را جمع‌آوری می‌کنیم، چگونه از آن‌ها استفاده می‌کنیم و چه حقوقی دارید. ما متعهد به رعایت استانداردهای بین‌المللی حفاظت از داده‌ها هستیم.
         </p>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="Database" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۱. اطلاعاتی که جمع‌آوری می‌کنیم
             </h2>
             <div className="grid md:grid-cols-2 gap-4">
                 <div className="bg-ui-surface2 p-4 rounded-xl">
                     <h3 className="font-bold text-sm text-ui-text mb-2">اطلاعات هویتی</h3>
                     <p className="text-xs text-ui-muted leading-5">نام، شماره تلفن، آدرس ایمیل و عکس پروفایل که هنگام ثبت‌نام وارد می‌کنید.</p>
                 </div>
                 <div className="bg-ui-surface2 p-4 rounded-xl">
                     <h3 className="font-bold text-sm text-ui-text mb-2">اطلاعات دستگاه و موقعیت</h3>
                     <p className="text-xs text-ui-muted leading-5">مدل دستگاه، آدرس IP و موقعیت تقریبی (برای نمایش آگهی‌های نزدیک).</p>
                 </div>
                 <div className="bg-ui-surface2 p-4 rounded-xl">
                     <h3 className="font-bold text-sm text-ui-text mb-2">فعالیت‌ها</h3>
                     <p className="text-xs text-ui-muted leading-5">آگهی‌های بازدید شده، جستجوها و پیام‌های رد و بدل شده در چت امن.</p>
                 </div>
                 <div className="bg-ui-surface2 p-4 rounded-xl">
                     <h3 className="font-bold text-sm text-ui-text mb-2">کوکی‌ها</h3>
                     <p className="text-xs text-ui-muted leading-5">داده‌های ذخیره شده در مرورگر برای حفظ نشست کاربری و تنظیمات.</p>
                 </div>
             </div>
         </section>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="Server" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۲. نحوه استفاده از اطلاعات
             </h2>
             <ul className="list-disc list-inside space-y-2 text-sm text-ui-muted pr-4 leading-7">
                 <li><strong>ارائه خدمات:</strong> ایجاد حساب کاربری، انتشار آگهی و برقراری ارتباط بین خریدار و فروشنده.</li>
                 <li><strong>امنیت:</strong> تشخیص فعالیت‌های مشکوک، کلاهبرداری و جلوگیری از دسترسی غیرمجاز.</li>
                 <li><strong>بهبود تجربه:</strong> پیشنهاد آگهی‌های مرتبط بر اساس سلیقه و جستجوهای قبلی شما.</li>
                 <li><strong>ارتباطات:</strong> ارسال پیامک تایید، اعلانات سیستم و پاسخ به درخواست‌های پشتیبانی.</li>
             </ul>
         </section>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="Eye" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۳. اشتراک‌گذاری اطلاعات
             </h2>
             <p className="text-ui-muted text-sm leading-7 text-justify mb-4">
                 ما هرگز اطلاعات شخصی شما را به شرکت‌های ثالث نمی‌فروشیم. اطلاعات شما تنها در موارد زیر به اشتراک گذاشته می‌شود:
             </p>
             <ul className="space-y-2 text-sm text-ui-muted pr-4">
                 <li className="flex items-start gap-2">
                     <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5">عمومی</span>
                     <span>اطلاعات آگهی (عکس، عنوان، شهر) برای همه کاربران قابل مشاهده است. شماره تماس فقط در صورت تمایل شما نمایش داده می‌شود.</span>
                 </li>
                 <li className="flex items-start gap-2">
                     <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5">قانونی</span>
                     <span>در صورت درخواست رسمی مقامات قضایی افغانستان، موظف به همکاری هستیم.</span>
                 </li>
             </ul>
         </section>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <UserX className="w-5 h-5 text-brand-600" />
                 ۴. حقوق کاربر (حذف حساب)
             </h2>
             <p className="text-ui-muted text-sm leading-7 text-justify">
                 شما حق دارید هر زمان که بخواهید به اطلاعات خود دسترسی داشته باشید، آن‌ها را ویرایش کنید یا درخواست حذف کامل حساب کاربری و داده‌های خود را بدهید. برای حذف حساب، از منوی تنظیمات در اپلیکیشن اقدام کنید یا به support@market4u.com ایمیل بزنید.
             </p>
         </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;