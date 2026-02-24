
import React from 'react';
import Icon from '../src/components/ui/Icon';
import { EXCHANGE_RATES } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

const ExchangeRateWidget: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {t('rates_title')}
            </h3>
            <span className="text-[10px] text-gray-400">بروزرسانی: ۱۰ دقیقه پیش</span>
        </div>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {EXCHANGE_RATES.map((rate) => (
                <div key={rate.currency} className="flex-shrink-0 bg-gray-50 rounded-lg p-2 min-w-[120px] border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-800 text-sm flex items-center gap-1">
                            {rate.flag} {rate.currency}
                        </span>
                        {rate.trend === 'up' && <Icon name="TrendingUp" size={12} strokeWidth={1.8} className="text-green-500" />}
                        {rate.trend === 'down' && <Icon name="TrendingDown" size={12} strokeWidth={1.8} className="text-red-500" />}
                        {rate.trend === 'stable' && <Icon name="Minus" size={12} strokeWidth={1.8} className="text-gray-400" />}
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <div className="text-gray-500">{t('rates_buy')}: <span className="text-gray-800 font-bold dir-ltr">{rate.buy}</span></div>
                        {/* <div className="text-gray-500">{t('rates_sell')}: <span className="text-gray-800 font-bold dir-ltr">{rate.sell}</span></div> */}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ExchangeRateWidget;
