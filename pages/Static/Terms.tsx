
import React from 'react';
import Icon from '../../src/components/ui/Icon';

const Terms: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-20 bg-ui-surface">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b">
         <div className="bg-brand-50 p-3 rounded-2xl">
            <Icon name="Scale" size={24} strokeWidth={1.8} className="text-brand-600" />
         </div>
         <div>
            <h1 className="text-2xl md:text-3xl font-bold text-ui-text">شرایط و قوانین استفاده</h1>
            <p className="text-sm text-ui-muted mt-1">آخرین بروزرسانی: ۱۰ جدی ۱۴۰۳</p>
         </div>
      </div>

      <div className="space-y-10">
         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="FileText" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۱. مقدمه و پذیرش توافق‌نامه
             </h2>
             <p className="text-ui-muted text-sm leading-7 text-justify">
                 به «Market4U» خوش آمدید. با ثبت‌نام، دسترسی یا استفاده از خدمات ما، شما موافقت می‌کنید که به شرایط این قرارداد ("شرایط خدمات") پایبند باشید. این پلتفرم صرفاً یک واسط تکنولوژیک (Venue) جهت اتصال خریداران و فروشندگان است و هیچ‌گونه مالکیتی بر کالاهای مبادله شده ندارد.
             </p>
         </section>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="UserCheck" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۲. حساب کاربری و احراز هویت
             </h2>
             <ul className="list-disc list-inside space-y-2 text-sm text-ui-muted pr-4">
                 <li>کاربران باید حداقل ۱۸ سال سن داشته باشند.</li>
                 <li>اطلاعات وارد شده در پروفایل (نام، شماره تماس) باید واقعی و دقیق باشد.</li>
                 <li>مسئولیت امنیت رمز عبور و تمامی فعالیت‌های انجام شده با حساب کاربری، مستقیماً بر عهده کاربر است.</li>
                 <li>Market4U حق دارد برای جلوگیری از کلاهبرداری، از کاربران مدارک هویتی (تذکره/پاسپورت) درخواست کند.</li>
             </ul>
         </section>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="AlertTriangle" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۳. کالاهای ممنوعه و رفتار کاربران
             </h2>
             <p className="text-sm text-ui-muted mb-2">انتشار محتوا یا فروش اقلام زیر اکیداً ممنوع است و منجر به مسدودسازی دائم حساب و پیگرد قانونی خواهد شد:</p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-ui-muted pr-4">
                 <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>اسلحه گرم، سرد و مواد منفجره</div>
                 <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>مواد مخدر و مشروبات الکلی</div>
                 <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>داروهای بدون نسخه و تجهیزات جاسوسی</div>
                 <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>مدارک شناسایی جعلی</div>
             </div>
         </section>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="Shield" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۴. سلب مسئولیت (Limitation of Liability)
             </h2>
             <div className="bg-ui-surface2 border border-ui-border p-4 rounded-xl text-sm text-ui-muted leading-7 text-justify">
                 <strong>مهم:</strong> Market4U هیچ‌گونه دخالتی در قیمت‌گذاری، کیفیت، امنیت یا قانونی بودن کالاهای درج شده ندارد. ما صحت اطلاعات کاربران را تضمین نمی‌کنیم. تمامی معاملات با مسئولیت و ریسک شخصی خریدار و فروشنده انجام می‌شود. ما در برابر هرگونه خسارت مالی، جانی یا معنوی ناشی از معاملات کاربران، هیچ‌گونه مسئولیتی نداریم.
             </div>
         </section>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="Copyright" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۵. مالکیت معنوی
             </h2>
             <p className="text-ui-muted text-sm leading-7 text-justify">
                 تمامی حقوق طراحی، نام تجاری، لوگو و کدهای نرم‌افزاری متعلق به «Market4U» است. کاربران حق کپی‌برداری یا مهندسی معکوس از خدمات ما را ندارند. محتوای آگهی‌ها (عکس و متن) متعلق به کاربر صادرکننده است، اما کاربر با انتشار آن، مجوزی جهانی و رایگان برای نمایش آن در پلتفرم به ما اعطا می‌کند.
             </p>
         </section>

         <section>
             <h2 className="text-lg font-bold text-ui-text mb-3 flex items-center gap-2">
                 <Icon name="Gavel" size={20} strokeWidth={1.8} className="text-brand-600" />
                 ۶. حل اختلاف و قانون حاکم
             </h2>
             <p className="text-ui-muted text-sm leading-7 text-justify">
                 این توافق‌نامه تابع قوانین جمهوری اسلامی افغانستان است. در صورت بروز اختلاف، طرفین ابتدا تلاش می‌کنند از طریق مذاکره و تیم پشتیبانی Market4U مشکل را حل کنند. در غیر این صورت، مراجع قضایی کابل صالح به رسیدگی خواهند بود.
             </p>
         </section>
      </div>
    </div>
  );
};

export default Terms;