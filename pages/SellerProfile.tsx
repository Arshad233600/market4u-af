
import React, { useEffect, useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { Product } from '../types';
import { azureService } from '../services/azureService';
import ProductCard from '../components/ProductCard';
import { useLanguage } from '../contexts/LanguageContext';

interface SellerProfileProps {
  sellerId: string;
  sellerName: string; // Passed for initial render
  onBack: () => void;
  onProductClick: (product: Product) => void;
}

const SellerProfile: React.FC<SellerProfileProps> = ({ sellerId, sellerName, onBack, onProductClick }) => {
  const { t } = useLanguage();
  const [ads, setAds] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSellerAds = async () => {
        try {
            const data = await azureService.getSellerAds(sellerId);
            setAds(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    fetchSellerAds();
  }, [sellerId]);

  return (
    <div className="pb-20 min-h-screen">
        <div className="bg-ui-surface border-b border-ui-border sticky top-0 z-10 px-4 py-4 flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-ui-surface2 rounded-full">
                <Icon name="ArrowRight" size={20} strokeWidth={1.8} className="text-ui-muted" />
            </button>
            <h2 className="text-lg font-bold text-ui-text">{t('seller_info')}</h2>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Seller Header Card */}
            <div className="bg-ui-surface rounded-2xl shadow-sm border border-ui-border p-6 mb-8 flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="w-24 h-24 bg-gradient-to-tr from-brand-100 to-brand-50 rounded-full flex items-center justify-center text-brand-700 font-bold text-4xl border-4 border-white shadow-md">
                    {sellerName.charAt(0)}
                </div>
                <div className="text-center md:text-right flex-1">
                    <h1 className="text-2xl font-bold text-ui-text flex items-center justify-center md:justify-start gap-2">
                        {sellerName}
                        <Icon name="ShieldCheck" size={24} strokeWidth={1.8} className="text-green-500" />
                    </h1>
                    <div className="flex flex-col md:flex-row gap-4 mt-4 text-sm text-ui-muted justify-center md:justify-start">
                        <div className="flex items-center gap-1">
                            <Icon name="MapPin" size={18} strokeWidth={1.8} />
                            <span>کابل، افغانستان</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Icon name="Calendar" size={18} strokeWidth={1.8} />
                            <span>عضویت: ۱۴۰۲/۰۱/۰۱</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                   {/* Actions like Report or Share could go here */}
                </div>
            </div>

            <h3 className="text-xl font-bold text-ui-text mb-4 border-r-4 border-brand-500 pr-3">
                {t('dash_my_ads')} ({ads.length})
            </h3>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-ui-surface rounded-xl h-64 animate-pulse shadow-sm border border-ui-border"></div>
                    ))}
                </div>
            ) : ads.length === 0 ? (
                <div className="text-center py-20 text-ui-muted bg-ui-surface rounded-2xl border border-dashed border-ui-border">
                    <p>{t('empty_state')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {ads.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onClick={onProductClick}
                        />
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

export default SellerProfile;
