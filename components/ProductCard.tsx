
import React, { useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { Product } from '../types';
import { APP_STRINGS } from '../constants';
import { azureService } from '../services/azureService';
import OptimizedImage from './OptimizedImage';
import { getRelativeTime } from '../utils/dateUtils';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  // Initialize from props
  const [isFavorite, setIsFavorite] = useState(product.isFavorite || false);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistic Update
    const newState = !isFavorite;
    setIsFavorite(newState);

    try {
        await azureService.toggleFavorite(product.id);
    } catch {
        // Revert on error
        setIsFavorite(!newState);
        console.error("Failed to toggle favorite");
    }
  };

  // Try to parse the date, if it's a relative string like '2 ساعت پیش' keep it, otherwise format it
  const displayDate = product.postedDate.includes('پیش') || product.postedDate.includes('الان') 
    ? product.postedDate 
    : getRelativeTime(product.postedDate);

  return (
    <div 
      onClick={() => onClick(product)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col h-full"
    >
      <div className="relative aspect-[4/3] w-full bg-gray-100">
        <OptimizedImage 
          src={product.imageUrl} 
          alt={product.title} 
          className="w-full h-full object-cover"
        />
        <button 
          className={`absolute top-2 left-2 p-1.5 backdrop-blur-sm rounded-full transition-colors z-10 ${
            isFavorite ? 'bg-red-50 text-red-500' : 'bg-black/30 text-white hover:bg-black/50'
          }`}
          onClick={handleToggleFavorite}
        >
          <Icon name="Heart" size={18} strokeWidth={1.8} className={isFavorite ? 'fill-current' : ''} />
        </button>
        {product.isPromoted && (
          <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-md z-10">
            ویژه
          </span>
        )}
      </div>
      
      <div className="p-3 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-gray-800 line-clamp-1 text-lg">{product.price.toLocaleString()} {APP_STRINGS.currency}</h3>
        </div>
        <p className="text-gray-700 text-sm line-clamp-2 mb-2 flex-1">{product.title}</p>
        
        <div className="flex items-center text-gray-400 text-xs gap-1 mt-auto">
          <Icon name="MapPin" size={12} strokeWidth={1.8} />
          <span className="truncate">{product.location}</span>
          <span className="mx-1">•</span>
          <span>{displayDate}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
