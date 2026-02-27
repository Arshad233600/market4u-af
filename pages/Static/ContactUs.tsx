
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Icon from '../../src/components/ui/Icon';
import { Page } from '../../types';

interface StaticPageProps {
  onNavigate: (page: Page) => void;
}

const ContactUs: React.FC<StaticPageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
          setLoading(false);
          setSubmitted(true);
      }, 1500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 pb-24">
       <div className="flex items-center gap-3 mb-8">
         <button
           onClick={() => onNavigate(Page.HOME)}
           className="p-2 rounded-xl bg-ui-surface2 text-ui-muted hover:text-ui-text hover:bg-ui-surface3 border border-ui-border transition-colors shrink-0"
           aria-label="بازگشت"
         >
           <Icon name="ArrowRight" size={20} strokeWidth={2} />
         </button>
       </div>
       <div className="text-center mb-12">
           <h1 className="text-3xl font-bold text-ui-text mb-4">تماس با پشتیبانی Market4U</h1>
           <p className="text-ui-muted max-w-xl mx-auto">
               تیم پشتیبانی ما همه روزه از ساعت ۸ صبح الی ۸ شب آماده پاسخگویی به سوالات و مشکلات شماست.
           </p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {/* Contact Info Cards */}
           <div className="space-y-4">
               <div className="bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border flex items-start gap-4">
                   <div className="bg-brand-50 p-3 rounded-full text-brand-600"><Icon name="Phone" size={24} strokeWidth={1.8}/></div>
                   <div>
                       <h3 className="font-bold text-ui-text mb-1">شماره تماس</h3>
                       <p className="text-ui-muted dir-ltr text-right mb-1">+93 799 123 456</p>
                       <p className="text-ui-muted dir-ltr text-right">+93 700 987 654</p>
                   </div>
               </div>
               <div className="bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border flex items-start gap-4">
                   <div className="bg-brand-50 p-3 rounded-full text-brand-600"><Icon name="Mail" size={24} strokeWidth={1.8}/></div>
                   <div>
                       <h3 className="font-bold text-ui-text mb-1">ایمیل</h3>
                       <p className="text-ui-muted dir-ltr text-right">support@market4u.com</p>
                       <p className="text-ui-muted dir-ltr text-right">info@market4u.com</p>
                   </div>
               </div>
               <div className="bg-ui-surface p-6 rounded-2xl shadow-sm border border-ui-border flex items-start gap-4">
                   <div className="bg-brand-50 p-3 rounded-full text-brand-600"><Icon name="MapPin" size={24} strokeWidth={1.8}/></div>
                   <div>
                       <h3 className="font-bold text-ui-text mb-1">دفتر مرکزی</h3>
                       <p className="text-ui-muted text-sm leading-6">
                           کابل، شهر نو، جاده انصاری،<br/>
                           ساختمان تکنالوژی، طبقه ۴، واحد ۱۲
                       </p>
                   </div>
               </div>
           </div>

           {/* Contact Form */}
           <div className="md:col-span-2 bg-ui-surface rounded-2xl shadow-lg p-8 border border-ui-border">
               {submitted ? (
                   <div className="h-full flex flex-col items-center justify-center text-center py-10">
                       <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-in zoom-in">
                           <Icon name="Send" size={24} strokeWidth={1.8} />
                       </div>
                       <h3 className="text-2xl font-bold text-ui-text mb-2">پیام شما دریافت شد!</h3>
                       <p className="text-ui-muted max-w-xs">کارشناسان ما در اسرع وقت پیام شما را بررسی کرده و پاسخ خواهند داد.</p>
                       <button onClick={() => setSubmitted(false)} className="mt-8 text-brand-600 font-bold hover:underline">ارسال پیام جدید</button>
                   </div>
               ) : (
                   <form onSubmit={handleSubmit} className="space-y-6">
                       <h3 className="text-xl font-bold text-ui-text">ارسال پیام</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div>
                               <label className="block text-sm font-medium text-ui-muted mb-2">نام و نام خانوادگی</label>
                               <input type="text" required className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" />
                           </div>
                           <div>
                               <label className="block text-sm font-medium text-ui-muted mb-2">شماره تماس</label>
                               <input type="tel" required className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" />
                           </div>
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-ui-muted mb-2">موضوع پیام</label>
                           <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-ui-surface">
                               <option>پیشنهاد و انتقاد</option>
                               <option>گزارش کلاهبرداری</option>
                               <option>مشکل فنی در سایت/اپلیکیشن</option>
                               <option>درخواست همکاری</option>
                           </select>
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-ui-muted mb-2">متن پیام</label>
                           <textarea required rows={5} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"></textarea>
                       </div>
                       <button 
                           type="submit" 
                           disabled={loading}
                           className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                       >
                           {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ارسال پیام'}
                       </button>
                   </form>
               )}
           </div>
       </div>
    </div>
  );
};

export default ContactUs;