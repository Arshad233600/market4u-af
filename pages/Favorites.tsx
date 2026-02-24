import React, { useEffect, useState } from 'react';
import Icon from '../src/components/ui/Icon';
import ProductCard from '../components/ProductCard';
import { Product } from '../types';
import { azureService } from '../services/azureService';

interface FavoritesProps {
    onProductClick: (product: Product) => void;
    onBack: () => void;
}

const Favorites: React.FC<FavoritesProps> = ({ onProductClick, onBack }) => {
    const [favorites, setFavorites] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFavs = async () => {
            try {
                const data = await azureService.getFavorites();
                setFavorites(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchFavs();
    }, []);

    return (
        <div className="pb-20 min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
                    <Icon name="ArrowRight" size={20} strokeWidth={1.8} className="text-gray-600" />
                </button>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Icon name="Heart" size={20} strokeWidth={1.8} className="text-red-500 fill-current" />
                    علاقه‌مندی‌ها
                </h2>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl h-64 animate-pulse shadow-sm border border-gray-100"></div>
                        ))}
                    </div>
                ) : favorites.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                            <Icon name="Heart" size={24} strokeWidth={1.8} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">لیست علاقه‌مندی‌های شما خالی است</h3>
                        <p className="text-gray-500 max-w-xs mx-auto">
                            آگهی‌هایی که دوست دارید را با زدن دکمه قلب ذخیره کنید تا بعداً راحت‌تر پیدا کنید.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {favorites.map((product) => (
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

export default Favorites;