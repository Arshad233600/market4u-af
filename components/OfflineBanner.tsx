
import React, { useState, useEffect } from 'react';
import Icon from '../src/components/ui/Icon';

const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between text-xs sticky top-0 z-[60] animate-in slide-in-from-top">
      <div className="flex items-center gap-2">
        <Icon name="WifiOff" size={18} strokeWidth={1.8} className="text-red-400" />
        <span>شما آفلاین هستید. برخی امکانات ممکن است کار نکنند.</span>
      </div>
      <button 
        onClick={() => window.location.reload()} 
        className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded hover:bg-white/20"
      >
        <Icon name="RefreshCw" size={12} strokeWidth={1.8} />
        تلاش مجدد
      </button>
    </div>
  );
};

export default OfflineBanner;
