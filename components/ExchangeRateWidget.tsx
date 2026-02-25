
import React from 'react';
import Icon from '../src/components/ui/Icon';
import { EXCHANGE_RATES } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

const ExchangeRateWidget: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="bg-ui-surface border-b border-ui-border">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-ui-muted flex items-center gap-1">
                <span className="w-2 h-2 bg-ui-success rounded-full animate-pulse"></span>
                {t('rates_title')}
            </h3>
            <span className="text-xs text-ui-muted/60">بروزرسانی: ۱۰ دقیقه پیش</span>
        </div>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {EXCHANGE_RATES.map((rate) => (
                <div key={rate.currency} className="flex-shrink-0 bg-ui-surface2 rounded-lg p-2 min-w-[120px] border border-ui-border flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-ui-text text-sm flex items-center gap-1">
                            {rate.flag} {rate.currency}
                        </span>
                        {rate.trend === 'up' && <Icon name="TrendingUp" size={14} strokeWidth={1.8} className="text-ui-success" />}
                        {rate.trend === 'down' && <Icon name="TrendingDown" size={14} strokeWidth={1.8} className="text-ui-danger" />}
                        {rate.trend === 'stable' && <Icon name="Minus" size={14} strokeWidth={1.8} className="text-ui-muted" />}
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <div className="text-ui-muted">{t('rates_buy')}: <span className="text-ui-text font-bold dir-ltr">{rate.buy}</span></div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ExchangeRateWidget;
