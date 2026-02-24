import React, { useEffect, useState } from 'react';
import Icon from '../src/components/ui/Icon';

/**
 * Update Available Banner
 * Shows when a new service worker is waiting
 */
const UpdateBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Check for waiting service worker
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        setRegistration(reg);
        setShowBanner(true);
      }
    });

    // Listen for new service worker installation
    const handleControllerChange = () => {
      console.log('[SW] New service worker activated, reloading...');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check for updates when app becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.ready.then((reg) => {
          reg.update();
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setShowBanner(false);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-brand-600 text-white px-4 py-3 shadow-lg animate-in slide-in-from-top">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Icon name="RefreshCw" size={20} strokeWidth={2.0} className="shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">نسخه جدید در دسترس است</p>
            <p className="text-xs text-brand-100 mt-0.5">یک نسخه بهبود یافته آماده نصب است</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdate}
            className="bg-white text-brand-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-50 transition-colors"
          >
            بروزرسانی
          </button>
          <button
            onClick={() => setShowBanner(false)}
            className="p-2 hover:bg-brand-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <Icon name="X" size={18} strokeWidth={2.0} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
