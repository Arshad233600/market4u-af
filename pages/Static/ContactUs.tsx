
import React, { useState } from 'react';
import Icon from '../../src/components/ui/Icon';

const ContactUs: React.FC = () => {
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
       <div className="text-center mb-12">
           <h1 className="text-3xl font-bold text-gray-900 mb-4">تماس با پشتیبانی Market4U</h1>
           <p className="text-gray-500 max-w-xl mx-auto">
               تیم پشتیبانی ما همه روزه از ساعت ۸ صبح الی ۸ شب آماده پاسخگویی به سوالات و مشکلات شماست.
           </p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {/* Contact Info Cards */}
           <div className="space-y-4">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
                   <div className="bg-brand-50 p-3 rounded-full text-brand-600"><Icon name="Phone" size={24} strokeWidth={1.8}/></div>
                   <div>
                       <h3 className="font-bold text-gray-800 mb-1">شماره تماس</h3>
                       <p className="text-gray-600 dir-ltr text-right mb-1">+93 799 123 456</p>
                       <p className="text-gray-600 dir-ltr text-right">+93 700 987 654</p>
                   </div>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
                   <div className="bg-brand-50 p-3 rounded-full text-brand-600"><Icon name="Mail" size={24} strokeWidth={1.8}/></div>
                   <div>
                       <h3 className="font-bold text-gray-800 mb-1">ایمیل</h3>
                       <p className="text-gray-600 dir-ltr text-right">support@market4u.com</p>
                       <p className="text-gray-600 dir-ltr text-right">info@market4u.com</p>
                   </div>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
                   <div className="bg-brand-50 p-3 rounded-full text-brand-600"><Icon name="MapPin" size={24} strokeWidth={1.8}/></div>
                   <div>
                       <h3 className="font-bold text-gray-800 mb-1">دفتر مرکزی</h3>
                       <p className="text-gray-600 text-sm leading-6">
                           کابل، شهر نو، جاده انصاری،<br/>
                           ساختمان تکنالوژی، طبقه ۴، واحد ۱۲
                       </p>
                   </div>
               </div>
           </div>

           {/* Contact Form */}
           <div className="md:col-span-2 bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
               {submitted ? (
                   <div className="h-full flex flex-col items-center justify-center text-center py-10">
                       <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-in zoom-in">
                           <Icon name="Send" size={24} strokeWidth={1.8} />
                       </div>
                       <h3 className="text-2xl font-bold text-gray-800 mb-2">پیام شما دریافت شد!</h3>
                       <p className="text-gray-500 max-w-xs">کارشناسان ما در اسرع وقت پیام شما را بررسی کرده و پاسخ خواهند داد.</p>
                       <button onClick={() => setSubmitted(false)} className="mt-8 text-brand-600 font-bold hover:underline">ارسال پیام جدید</button>
                   </div>
               ) : (
                   <form onSubmit={handleSubmit} className="space-y-6">
                       <h3 className="text-xl font-bold text-gray-800">ارسال پیام</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div>
                               <label className="block text-sm font-medium text-gray-700 mb-2">نام و نام خانوادگی</label>
                               <input type="text" required className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" />
                           </div>
                           <div>
                               <label className="block text-sm font-medium text-gray-700 mb-2">شماره تماس</label>
                               <input type="tel" required className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" />
                           </div>
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-gray-700 mb-2">موضوع پیام</label>
                           <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white">
                               <option>پیشنهاد و انتقاد</option>
                               <option>گزارش کلاهبرداری</option>
                               <option>مشکل فنی در سایت/اپلیکیشن</option>
                               <option>درخواست همکاری</option>
                           </select>
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-gray-700 mb-2">متن پیام</label>
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