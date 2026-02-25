
import React, { useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { Product, ProductCondition } from '../types';
import { APP_STRINGS } from '../constants';
import { azureService } from '../services/azureService';
import OptimizedImage from './OptimizedImage';
import { getRelativeTime } from '../utils/dateUtils';

const CONDITION_LABELS: Record<ProductCondition, { label: string; color: string }> = {
  new: { label: 'نو', color: 'bg-ui-success/20 text-ui-success' },
  used: { label: 'کارکرده', color: 'bg-ui-warning/20 text-ui-warning' },
  damaged: { label: 'معیوب', color: 'bg-ui-danger/20 text-ui-danger' },
};

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
      className="bg-ui-surface rounded-xl shadow-card border border-ui-border overflow-hidden hover:border-brand-700/40 hover:shadow-glow transition-all cursor-pointer flex flex-col h-full"
    >
      <div className="relative aspect-[4/3] w-full bg-ui-surface2">
        <OptimizedImage 
          src={product.imageUrl} 
          alt={product.title} 
          className="w-full h-full object-cover"
        />
        <button 
          className={`absolute top-2 left-2 p-1.5 backdrop-blur-sm rounded-full transition-colors z-10 ${
            isFavorite ? 'bg-ui-danger/20 text-ui-danger' : 'bg-black/30 text-white hover:bg-black/50'
          }`}
          onClick={handleToggleFavorite}
        >
          <Icon name="Heart" size={18} strokeWidth={1.8} className={isFavorite ? 'fill-current' : ''} />
        </button>
        {product.isPromoted && (
          <span className="absolute top-2 right-2 bg-ui-warning text-black text-xs font-bold px-2 py-1 rounded-md z-10">
            ویژه
          </span>
        )}
      </div>
      
      <div className="p-3 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-brand-300 line-clamp-1 text-lg">{product.price.toLocaleString()} {APP_STRINGS.currency}</h3>
          {product.isNegotiable && (
            <span className="text-[10px] font-bold bg-brand-900/40 text-brand-300 px-1.5 py-0.5 rounded border border-brand-700/30 whitespace-nowrap">مذاکره</span>
          )}
        </div>
        <p className="text-ui-text text-sm line-clamp-2 mb-2 flex-1">{product.title}</p>

        {/* Condition & Delivery badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          {product.condition && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CONDITION_LABELS[product.condition].color}`}>
              {CONDITION_LABELS[product.condition].label}
            </span>
          )}
          {product.deliveryAvailable && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ui-info/20 text-ui-info flex items-center gap-0.5">
              <Icon name="Truck" size={10} strokeWidth={2} />
              ارسال
            </span>
          )}
        </div>
        
        <div className="flex items-center text-ui-muted text-xs gap-1 mt-auto">
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
