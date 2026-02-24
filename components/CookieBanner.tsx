
import React, { useState, useEffect } from 'react';
import Icon from '../src/components/ui/Icon';

const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Show banner after a short delay
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 text-white p-4 md:p-6 z-[70] backdrop-blur-md border-t border-gray-700 shadow-2xl animate-in slide-in-from-bottom duration-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-brand-600 p-2 rounded-full hidden md:block">
             <Icon name="Cookie" size={24} strokeWidth={1.8} className="text-white" />
          </div>
          <div>
            <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                <Icon name="Cookie" size={18} strokeWidth={1.8} className="md:hidden" />
                ما از کوکی‌ها استفاده می‌کنیم
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed max-w-2xl text-justify">
              برای بهبود تجربه کاربری، تحلیل ترافیک و ارائه خدمات بهتر، مطابق با استانداردهای بین‌المللی از کوکی‌ها استفاده می‌کنیم. ادامه استفاده شما از سایت به معنی پذیرش این موضوع است.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsVisible(false)}
            className="flex-1 md:flex-none py-2 px-4 text-xs font-bold text-gray-300 hover:text-white transition-colors"
          >
            بعداً
          </button>
          <button 
            onClick={handleAccept}
            className="flex-1 md:flex-none py-2 px-6 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-brand-900/50"
          >
            می‌پذیرم
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
