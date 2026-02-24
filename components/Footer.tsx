
import React, { useEffect, useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { Page } from '../types';

interface FooterProps {
  onNavigate: (page: Page) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [version, setVersion] = useState<string>('loading...');
  const [linkCopied, setLinkCopied] = useState(false);

  const handleShareApp = () => {
    const appUrl = window.location.origin;
    if (navigator.share) {
      navigator.share({
        title: 'Market4U - بازار افغان',
        text: 'بازارچه آنلاین خرید و فروش در افغانستان',
        url: appUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(appUrl).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setVersion(data.version || 'unknown'))
      .catch(() => setVersion('dev'));
  }, []);

  return (
    <footer className="bg-brand-900 text-white pt-12 pb-24 md:pb-8 mt-auto border-t border-brand-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* About Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              Market<span className="text-brand-300">4U</span>
            </h3>
            <p className="text-brand-100 text-sm leading-relaxed text-justify">
              مارکت‌پلیس مدرن برای خرید و فروش امن و آسان. ما با هدف اتصال خریداران و فروشندگان و ایجاد فرصت‌های اقتصادی برابر فعالیت می‌کنیم.
            </p>
            <div className="flex gap-4 pt-2">
              <a href="#" className="p-2 bg-white/10 rounded-full hover:bg-brand-500 transition-colors"><Icon name="Facebook" size={20} strokeWidth={1.8} /></a>
              <a href="#" className="p-2 bg-white/10 rounded-full hover:bg-brand-500 transition-colors"><Icon name="Instagram" size={20} strokeWidth={1.8} /></a>
              <a href="#" className="p-2 bg-white/10 rounded-full hover:bg-brand-500 transition-colors"><Icon name="Twitter" size={20} strokeWidth={1.8} /></a>
            </div>
            <button
              onClick={handleShareApp}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors"
            >
              <Icon name={linkCopied ? 'Check' : 'Share2'} size={16} strokeWidth={1.8} />
              {linkCopied ? 'لینک کپی شد!' : 'اشتراک‌گذاری اپ'}
            </button>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-white">دسترسی سریع</h4>
            <ul className="space-y-2 text-sm text-brand-100">
              <li><button onClick={() => onNavigate(Page.HOME)} className="hover:text-white hover:translate-x-1 transition-all">صفحه اصلی</button></li>
              <li><button onClick={() => onNavigate(Page.POST_AD)} className="hover:text-white hover:translate-x-1 transition-all">ثبت آگهی رایگان</button></li>
              <li><button onClick={() => onNavigate(Page.DASHBOARD)} className="hover:text-white hover:translate-x-1 transition-all">حساب کاربری من</button></li>
              <li><button onClick={() => onNavigate(Page.DASHBOARD_CHAT)} className="hover:text-white hover:translate-x-1 transition-all">پیام‌ها</button></li>
            </ul>
          </div>

          {/* Legal & Help */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-white">اعتماد و قوانین</h4>
            <ul className="space-y-2 text-sm text-brand-100">
              <li className="flex items-center gap-2">
                  <Icon name="ShieldCheck" size={18} strokeWidth={1.8} className="opacity-70" />
                  <button onClick={() => onNavigate(Page.SAFETY)} className="hover:text-white hover:translate-x-1 transition-all">مرکز امنیت</button>
              </li>
              <li className="flex items-center gap-2">
                  <Icon name="FileText" size={18} strokeWidth={1.8} className="opacity-70" />
                  <button onClick={() => onNavigate(Page.TERMS)} className="hover:text-white hover:translate-x-1 transition-all">قوانین و مقررات</button>
              </li>
              <li className="flex items-center gap-2">
                  <Icon name="Lock" size={18} strokeWidth={1.8} className="opacity-70" />
                  <button onClick={() => onNavigate(Page.PRIVACY)} className="hover:text-white hover:translate-x-1 transition-all">حریم خصوصی</button>
              </li>
              <li><button onClick={() => onNavigate(Page.ABOUT_US)} className="hover:text-white hover:translate-x-1 transition-all">درباره ما</button></li>
              <li><button onClick={() => onNavigate(Page.CONTACT_US)} className="hover:text-white hover:translate-x-1 transition-all">تماس با پشتیبانی</button></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-white">تماس با ما</h4>
            <ul className="space-y-3 text-sm text-brand-100">
              <li className="flex items-start gap-3">
                <Icon name="MapPin" size={20} strokeWidth={1.8} className="text-brand-400 shrink-0" />
                <span>کابل، شهر نو، جاده انصاری، ساختمان تکنالوژی، طبقه ۴</span>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="Phone" size={20} strokeWidth={1.8} className="text-brand-400 shrink-0" />
                <span className="dir-ltr text-right">+93 799 000 000</span>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="Mail" size={20} strokeWidth={1.8} className="text-brand-400 shrink-0" />
                <span className="dir-ltr text-right">support@market4u.com</span>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-brand-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-brand-300">
          <p>© ۱۴۰۳ Market4U. تمامی حقوق محفوظ است.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 bg-brand-800 px-2 py-1 rounded text-brand-200">
              <Icon name="Cloud" size={12} strokeWidth={1.8} /> Azure Ready
            </span>
            <span className="flex items-center gap-1 bg-brand-800 px-2 py-1 rounded text-brand-200">
              <Icon name="Code" size={12} strokeWidth={1.8} /> v{version}
            </span>
            <p className="flex items-center gap-1">
              ساخته شده با <Icon name="Heart" size={12} strokeWidth={1.8} className="text-red-500 fill-current" /> برای مردم
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
