
import React from 'react';
import Icon from '../../src/components/ui/Icon';
import { Page } from '../../types';

interface StaticPageProps {
  onNavigate: (page: Page) => void;
}

const AboutUs: React.FC<StaticPageProps> = ({ onNavigate }) => {
  return (
    <div className="bg-white min-h-screen pb-12">
      {/* Hero Section */}
      <div className="bg-brand-900 text-white py-16 px-4 text-center relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
         <h1 className="text-3xl md:text-5xl font-bold mb-6 relative z-10">درباره ما – Market4U</h1>
         <p className="text-brand-100 max-w-3xl mx-auto text-lg leading-relaxed relative z-10">
           Market4U یک پلتفرم مدرن مارکیت‌پلیس است که با هدف ایجاد تحول در خرید و فروش آنلاین و فراهم‌سازی فرصت‌های اقتصادی برای همه ایجاد شده است.
         </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-10 relative z-20">
         
         {/* Story Section */}
         <div className="bg-white rounded-3xl shadow-xl p-8 md:p-10 mb-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4 flex items-center gap-2">
                <span className="w-2 h-8 bg-brand-600 rounded-full"></span>
                داستان ما
            </h2>
            <div className="space-y-4 text-gray-600 leading-8 text-justify">
                <p>
                   Market4U از یک باور ساده اما قدرتمند شکل گرفت: <strong className="text-brand-700">همه باید به فرصت‌های برابر برای خرید، فروش و رشد دسترسی داشته باشند.</strong>
                </p>
                <p>
                   این پلتفرم توسط <strong className="text-gray-900">عبدالله ارشد</strong>، متخصص IT و Cloud، ایجاد شده است. او با سال‌ها تجربه در حوزه تکنولوژی، پشتیبانی سیستم‌ها، شبکه و توسعه پروژه‌های دیجیتال، همواره به دنبال راهی بوده تا تکنولوژی را در خدمت مردم قرار دهد.
                </p>
                <p>
                   هدف او تنها ساخت یک اپلیکیشن نبود؛ بلکه ایجاد پلی دیجیتال میان مردم، کسب‌وکارها و آینده تجارت بود. ما تلاش می‌کنیم موانع تجارت سنتی را از بین ببریم و تجربه‌ای مدرن و دیجیتال ارائه دهیم.
                </p>
            </div>
         </div>

         {/* Mission & Vision Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
             <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-100 p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                 <div className="w-14 h-14 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center mb-6">
                     <Icon name="Target" size={24} strokeWidth={1.8} />
                 </div>
                 <h3 className="font-bold text-gray-900 text-xl mb-3">ماموریت ما</h3>
                 <p className="text-sm text-gray-600 leading-7 text-justify">
                    ماموریت Market4U ایجاد یک محیط امن، هوشمند و کاربرمحور است که در آن فروشندگان بتوانند به‌راحتی محصولات خود را معرفی کرده و کسب‌وکارشان را گسترش دهند، خریداران با اعتماد کامل خرید کنند و تکنولوژی به ابزاری برای پیشرفت جامعه تبدیل شود.
                 </p>
             </div>
             <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                 <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                     <Icon name="Rocket" size={24} strokeWidth={1.8} />
                 </div>
                 <h3 className="font-bold text-gray-900 text-xl mb-3">چشم‌انداز ما</h3>
                 <p className="text-sm text-gray-600 leading-7 text-justify">
                    چشم‌انداز ما تبدیل شدن به یکی از قابل‌اعتمادترین و نوآورترین مارکیت‌پلیس‌ها است. ما آینده‌ای را تصور می‌کنیم که در آن هر فرد، تنها با یک گوشی موبایل، بتواند به بازار بزرگ‌تری متصل شود و فرصت‌های تازه‌ای خلق کند.
                 </p>
             </div>
         </div>

         {/* Values Section */}
         <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-8 text-center">ارزش‌های بنیادین ما</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {[
                    { title: 'اعتماد و امنیت', icon: 'ShieldCheck', color: 'text-green-600', bg: 'bg-green-50' },
                    { title: 'نوآوری', icon: 'Lightbulb', color: 'text-yellow-600', bg: 'bg-yellow-50' },
                    { title: 'سادگی', icon: 'Star', color: 'text-blue-600', bg: 'bg-blue-50' },
                    { title: 'شفافیت', icon: 'Users', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { title: 'رشد پایدار', icon: 'TrendingUp', color: 'text-pink-600', bg: 'bg-pink-50' }
                ].map((val, idx) => (
                    <div key={idx} className="flex flex-col items-center text-center group">
                         <div className={`w-16 h-16 ${val.bg} rounded-full flex items-center justify-center ${val.color} mb-3 group-hover:scale-110 transition-transform`}>
                             <Icon name={val.icon} size={24} strokeWidth={1.8} />
                         </div>
                         <span className="text-sm font-bold text-gray-700">{val.title}</span>
                    </div>
                ))}
            </div>
         </div>

         {/* Support Section */}
         <div className="bg-gradient-to-r from-red-50 via-white to-pink-50 border border-red-100 rounded-3xl p-8 md:p-12 mb-8 text-center relative overflow-hidden">
             <Icon name="Heart" size={24} strokeWidth={1.8} className="w-64 h-64 text-red-100 absolute -top-20 -right-20 opacity-40 rotate-12" />
             <div className="relative z-10">
                 <div className="inline-flex items-center gap-2 bg-red-100 text-red-600 px-4 py-1.5 rounded-full text-xs font-bold mb-4">
                    <Heart className="w-4 h-4 fill-current" />
                    همراه ما باشید
                 </div>
                 <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">حمایت از Market4U ❤️</h3>
                 <p className="text-gray-600 mb-8 max-w-2xl mx-auto leading-8 text-lg">
                    Market4U تنها یک پروژه تکنولوژی نیست؛ بلکه حرکتی برای ساختن آینده‌ای بهتر است. حمایت‌های شما به ما کمک می‌کند تا امکانات هوشمند اضافه کنیم، امنیت را افزایش دهیم و تجربه کاربری بهتری بسازیم.
                 </p>
                 
                 <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                     <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3 w-full md:w-auto justify-center">
                         <div className="bg-blue-50 p-2 rounded-lg"><Icon name="CreditCard" size={24} strokeWidth={1.8} className="text-blue-600" /></div>
                         <div className="text-right">
                             <p className="text-xs text-gray-500 font-bold mb-0.5">PayPal Donation</p>
                             <p className="text-gray-800 font-mono font-bold select-all" dir="ltr">Arshad233600@gmail.com</p>
                         </div>
                     </div>
                 </div>
                 <p className="text-xs text-gray-400 mt-4">هر حمایت شما، نیرویی بزرگ برای ادامه این مسیر خواهد بود.</p>
             </div>
         </div>

         {/* Founder Message */}
         <div className="bg-gray-900 text-white rounded-3xl p-8 md:p-12 text-center relative shadow-2xl">
             <Icon name="Quote" size={24} strokeWidth={1.8} className="w-16 h-16 text-gray-700 absolute top-6 left-6 rotate-180 opacity-50" />
             <div className="relative z-10 max-w-3xl mx-auto">
                 <p className="text-lg md:text-xl italic font-medium leading-9 mb-6 text-gray-200">
                    "ما Market4U را با یک هدف ساختیم: ایجاد فرصت، ساده‌سازی تجارت و نزدیک‌تر کردن مردم به آینده. باور داریم که با هم می‌توانیم چیزی بسازیم که زندگی بسیاری را بهتر کند."
                 </p>
                 <div className="flex flex-col items-center gap-2">
                     <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center font-bold text-xl border-2 border-gray-600">
                        A
                     </div>
                     <div>
                         <div className="font-bold text-white">عبدالله ارشد</div>
                         <div className="text-xs text-gray-400">بنیان‌گذار Market4U</div>
                     </div>
                 </div>
             </div>
         </div>

         <div className="text-center mt-12 pb-8">
             <button onClick={() => onNavigate(Page.CONTACT_US)} className="bg-brand-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 text-lg">
                 تماس با ما
             </button>
         </div>
      </div>
    </div>
  );
};

export default AboutUs;
