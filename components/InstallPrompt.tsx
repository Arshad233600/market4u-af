
import React, { useEffect, useState } from 'react';
import Icon from '../src/components/ui/Icon';

// PWA Install Prompt Event interface
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      // Only show if not dismissed previously
      if (!localStorage.getItem('install_dismissed')) {
          setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
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
      localStorage.setItem('install_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-ui-surface rounded-2xl shadow-2xl border border-brand-100 p-4 z-50 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
            <div className="bg-brand-600 p-3 rounded-xl text-white">
                <Icon name="Smartphone" size={24} strokeWidth={1.8} />
            </div>
            <div>
                <h3 className="font-bold text-gray-900 text-sm">نصب اپلیکیشن بازار</h3>
                <p className="text-xs text-ui-muted mt-1 leading-relaxed">
                    برای دسترسی سریع‌تر و استفاده آفلاین، برنامه را نصب کنید.
                </p>
            </div>
        </div>
        <button onClick={handleDismiss} className="text-ui-muted hover:text-ui-muted">
            <Icon name="X" size={20} strokeWidth={1.8} />
        </button>
      </div>
      <button 
        onClick={handleInstallClick}
        className="w-full mt-4 bg-brand-50 text-brand-700 font-bold py-2.5 rounded-xl hover:bg-brand-100 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <Icon name="Download" size={18} strokeWidth={1.8} />
        نصب رایگان
      </button>
    </div>
  );
};

export default InstallPrompt;
