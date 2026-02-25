
import React from 'react';
import Icon from '../../src/components/ui/Icon';

const SafetyTips: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-20">
      <div className="bg-brand-600 bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 text-white rounded-3xl p-8 mb-10 text-center shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-ui-surface/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="relative z-10">
            <Icon name="ShieldCheck" size={24} strokeWidth={1.8} className="w-20 h-20 mx-auto mb-4 opacity-90 drop-shadow-md" />
            <h1 className="text-2xl md:text-4xl font-bold mb-3 drop-shadow-sm">مرکز امنیت Market4U</h1>
            <p className="text-brand-50 max-w-xl mx-auto text-lg font-medium opacity-95">راهنمای جامع برای خرید و فروش امن و جلوگیری از کلاهبرداری</p>
          </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="space-y-6">
              <h2 className="text-xl font-bold text-ui-text border-r-4 border-brand-500 pr-3">قوانین طلایی برای خریداران</h2>
              
              <div className="flex gap-4">
                  <div className="bg-red-50 p-3 rounded-full h-fit text-red-600"><Icon name="Banknote" size={24} strokeWidth={1.8} /></div>
                  <div>
                      <h3 className="font-bold text-ui-text mb-1">هرگز بیعانه ندهید</h3>
                      <p className="text-sm text-ui-muted leading-6 text-justify">
                          مهمترین قانون: تحت هیچ شرایطی، قبل از دیدن کالا و دریافت آن، پولی به عنوان «بیعانه»، «شیرینی» یا «رزرو» واریز نکنید. کلاهبرداران معمولاً با قیمت‌های بسیار پایین شما را وسوسه می‌کنند.
                      </p>
                  </div>
              </div>

              <div className="flex gap-4">
                  <div className="bg-orange-50 p-3 rounded-full h-fit text-orange-600"><Icon name="MapPin" size={24} strokeWidth={1.8} /></div>
                  <div>
                      <h3 className="font-bold text-ui-text mb-1">قرار در مکان عمومی</h3>
                      <p className="text-sm text-ui-muted leading-6 text-justify">
                          همیشه در مکان‌های شلوغ و امن (مانند پارک‌ها، مراکز خرید یا جلوی ایستگاه پلیس) قرار بگذارید. از رفتن به خانه‌های شخصی یا مکان‌های خلوت خودداری کنید.
                      </p>
                  </div>
              </div>

              <div className="flex gap-4">
                  <div className="bg-blue-50 p-3 rounded-full h-fit text-blue-600"><Icon name="Lock" size={24} strokeWidth={1.8} /></div>
                  <div>
                      <h3 className="font-bold text-ui-text mb-1">اطلاعات بانکی را ندهید</h3>
                      <p className="text-sm text-ui-muted leading-6 text-justify">
                          اطلاعات حساس بانکی مثل رمز دوم، CVV2 یا تاریخ انقضا کارت خود را به هیچ‌کس ندهید. Market4U هرگز از شما چنین اطلاعاتی نمی‌خواهد.
                      </p>
                  </div>
              </div>
          </div>

          <div className="space-y-6">
              <h2 className="text-xl font-bold text-ui-text border-r-4 border-brand-500 pr-3">قوانین طلایی برای فروشندگان</h2>

              <div className="flex gap-4">
                  <div className="bg-green-50 p-3 rounded-full h-fit text-green-600"><Icon name="Banknote" size={24} strokeWidth={1.8} /></div>
                  <div>
                      <h3 className="font-bold text-ui-text mb-1">رسید جعلی را بشناسید</h3>
                      <p className="text-sm text-ui-muted leading-6 text-justify">
                          اگر خریدار ادعا کرد پول را کارت‌به‌کارت کرده و رسید نشان داد، حتماً موجودی حساب خود را از طریق موبایل‌بانک چک کنید. پیامک بانک ممکن است جعلی باشد.
                      </p>
                  </div>
              </div>

              <div className="flex gap-4">
                  <div className="bg-purple-50 p-3 rounded-full h-fit text-purple-600"><Icon name="Smartphone" size={24} strokeWidth={1.8} /></div>
                  <div>
                      <h3 className="font-bold text-ui-text mb-1">ارتباط فقط در چت Market4U</h3>
                      <p className="text-sm text-ui-muted leading-6 text-justify">
                          سعی کنید مکالمات را داخل اپلیکیشن نگه دارید. کلاهبرداران معمولاً سعی می‌کنند شما را به واتساپ یا تلگرام ببرند تا ردیابی نشوند.
                      </p>
                  </div>
              </div>
          </div>
      </div>

      <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
              <Icon name="AlertTriangle" size={24} strokeWidth={1.8} />
              <h3 className="font-bold text-lg">چگونه کلاهبرداری را گزارش دهم؟</h3>
          </div>
          <p className="text-sm text-ui-muted max-w-2xl mx-auto mb-4">
              اگر آگهی مشکوکی دیدید یا کاربری رفتار نامناسبی داشت، لطفاً بلافاصله از طریق دکمه «گزارش آگهی» در صفحه محصول یا تماس با پشتیبانی ما را مطلع کنید.
          </p>
          <button className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
              تماس با پشتیبانی
          </button>
      </div>
    </div>
  );
};

export default SafetyTips;
