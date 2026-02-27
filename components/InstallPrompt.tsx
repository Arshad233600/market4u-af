
import React, { useEffect, useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { safeStorage } from '../utils/safeStorage';

// PWA Install Prompt Event interface
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Returns true when running on an iOS device (iPhone / iPod / iPad) */
function isIOS(): boolean {
  return /iphone|ipod|ipad/i.test(navigator.userAgent);
}

/** Returns true when the web app is already installed and running standalone */
function isInStandaloneMode(): boolean {
  return (
    ('standalone' in window.navigator && (window.navigator as Navigator & { standalone: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSPrompt] = useState<boolean>(() => {
    if (safeStorage.getItem('install_dismissed')) return false;
    return isIOS() && !isInStandaloneMode();
  });
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (safeStorage.getItem('install_dismissed')) return false;
    return isIOS() && !isInStandaloneMode();
  });

  useEffect(() => {
    if (safeStorage.getItem('install_dismissed')) return;
    if (isIOSPrompt) return; // already handled by lazy initializer

    // Android/Chrome: listen for the native install prompt
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isIOSPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    safeStorage.setItem('install_dismissed', 'true');
  };

  if (!isVisible) return null;

  // ---- iOS instructions banner ----
  if (isIOSPrompt) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-ui-surface rounded-2xl shadow-card border border-ui-border p-4 z-50 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-3 items-center">
            <div className="bg-brand-600 p-3 rounded-xl text-white">
              <Icon name="Smartphone" size={24} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="font-bold text-ui-text text-sm">نصب اپ روی آیفون</h3>
              <p className="text-xs text-ui-muted mt-0.5">بدون نیاز به App Store</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-ui-muted hover:text-ui-text">
            <Icon name="X" size={20} strokeWidth={1.8} />
          </button>
        </div>
        <ol className="text-xs text-ui-text space-y-2 pr-1">
          <li className="flex items-start gap-2">
            <span className="bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">۱</span>
            <span>در <strong>Safari</strong> این صفحه را باز کنید</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">۲</span>
            <span>دکمه <strong>اشتراک‌گذاری</strong> <Icon name="Share" size={13} className="inline" /> را بزنید</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">۳</span>
            <span>روی <strong>«افزودن به صفحه اصلی»</strong> ضربه بزنید</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-brand-600 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">۴</span>
            <span><strong>افزودن</strong> را تأیید کنید ✅</span>
          </li>
        </ol>
        <button
          onClick={handleDismiss}
          className="w-full mt-4 border border-ui-border text-ui-muted font-medium py-2 rounded-xl hover:bg-ui-border/30 transition-colors text-sm"
        >
          باشه، متوجه شدم
        </button>
      </div>
    );
  }

  // ---- Android / Chrome native install banner ----
  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-ui-surface rounded-2xl shadow-card border border-ui-border p-4 z-50 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
            <div className="bg-brand-600 p-3 rounded-xl text-white">
                <Icon name="Smartphone" size={24} strokeWidth={1.8} />
            </div>
            <div>
                <h3 className="font-bold text-ui-text text-sm">نصب اپلیکیشن بازار</h3>
                <p className="text-xs text-ui-muted mt-1 leading-relaxed">
                    برای دسترسی سریع‌تر و استفاده آفلاین، برنامه را نصب کنید.
                </p>
            </div>
        </div>
        <button onClick={handleDismiss} className="text-ui-muted hover:text-ui-text">
            <Icon name="X" size={20} strokeWidth={1.8} />
        </button>
      </div>
      <button 
        onClick={handleInstallClick}
        className="w-full mt-4 bg-brand-600 text-white font-bold py-2.5 rounded-xl hover:bg-brand-500 transition-colors flex items-center justify-center gap-2 text-sm shadow-glow"
      >
        <Icon name="Download" size={18} strokeWidth={1.8} />
        نصب رایگان
      </button>
    </div>
  );
};

export default InstallPrompt;
