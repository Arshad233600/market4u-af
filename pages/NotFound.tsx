
import React from 'react';
import Icon from '../src/components/ui/Icon';
import { Page } from '../types';

interface NotFoundProps {
  onNavigate: (page: Page) => void;
}

const NotFound: React.FC<NotFoundProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-32 h-32 bg-ui-surface2 rounded-full flex items-center justify-center mb-6 text-ui-muted">
          <Icon name="AlertCircle" size={24} strokeWidth={1.8} className="w-16 h-16" />
      </div>
      <h1 className="text-4xl font-bold text-ui-text mb-2">۴۰۴</h1>
      <h2 className="text-xl font-bold text-ui-muted mb-4">صفحه مورد نظر پیدا نشد!</h2>
      <p className="text-ui-muted max-w-sm mb-8">
          ممکن است آدرس را اشتباه وارد کرده باشید یا این صفحه حذف شده باشد.
      </p>
      <button 
        onClick={() => onNavigate(Page.HOME)}
        className="flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
      >
        <Icon name="Home" size={20} strokeWidth={1.8} />
        بازگشت به خانه
      </button>
    </div>
  );
};

export default NotFound;
