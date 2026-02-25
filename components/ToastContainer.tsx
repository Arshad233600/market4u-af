
import React, { useEffect, useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { toastService } from '../services/toastService';
import { ToastMessage } from '../types';

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toastService.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className={`
            pointer-events-auto flex items-center gap-3 p-4 rounded-xl shadow-card border animate-in slide-in-from-top-2 fade-in duration-300
            ${toast.type === 'success' ? 'bg-ui-surface border-ui-success/30 text-ui-text' : ''}
            ${toast.type === 'error' ? 'bg-ui-surface border-ui-danger/30 text-ui-text' : ''}
            ${toast.type === 'info' ? 'bg-ui-surface border-ui-info/30 text-ui-text' : ''}
            ${toast.type === 'warning' ? 'bg-ui-surface border-ui-warning/30 text-ui-text' : ''}
          `}
        >
          <div className={`
             flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
             ${toast.type === 'success' ? 'bg-ui-success/20 text-ui-success' : ''}
             ${toast.type === 'error' ? 'bg-ui-danger/20 text-ui-danger' : ''}
             ${toast.type === 'info' ? 'bg-ui-info/20 text-ui-info' : ''}
             ${toast.type === 'warning' ? 'bg-ui-warning/20 text-ui-warning' : ''}
          `}>
             {toast.type === 'success' && <Icon name="CheckCircle" size={20} strokeWidth={1.8} />}
             {toast.type === 'error' && <Icon name="AlertCircle" size={20} strokeWidth={1.8} />}
             {toast.type === 'info' && <Icon name="Info" size={20} strokeWidth={1.8} />}
             {toast.type === 'warning' && <Icon name="AlertTriangle" size={20} strokeWidth={1.8} />}
          </div>
          
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          
          <button 
            onClick={() => toastService.remove(toast.id)}
            className="text-ui-muted hover:text-ui-muted"
          >
            <Icon name="X" size={18} strokeWidth={1.8} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
