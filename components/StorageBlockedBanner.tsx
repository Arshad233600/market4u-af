
import React, { useState, useEffect } from 'react';
import Icon from '../src/components/ui/Icon';

/**
 * Persistent banner shown when the browser blocks persistent storage (e.g.
 * Safari ITP / private-browsing mode) and the app received a 401 on a
 * protected endpoint.  The banner asks the user to switch to a compatible
 * browser context; it cannot be dismissed because the underlying problem
 * persists for the duration of the session.
 */
const StorageBlockedBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleStorageBlocked401 = () => setVisible(true);
    window.addEventListener('storage-blocked-401', handleStorageBlocked401);
    return () => window.removeEventListener('storage-blocked-401', handleStorageBlocked401);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="bg-ui-warning/10 border-b border-ui-warning/40 text-ui-warning px-4 py-2.5 flex items-center gap-3 text-xs sticky top-0 z-[70]"
    >
      <Icon name="AlertTriangle" size={16} strokeWidth={2} className="shrink-0 text-ui-warning" />
      <span className="flex-1">
        مرورگر شما ذخیره‌سازی را مسدود کرده است. برای استفاده کامل، لطفاً در یک مرورگر سازگار (مانند Chrome یا Firefox) وارد شوید.
      </span>
    </div>
  );
};

export default StorageBlockedBanner;
