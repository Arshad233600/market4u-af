
import React, { useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { Product, ProductCondition } from '../types';
import { APP_STRINGS } from '../constants';
import { azureService } from '../services/azureService';
import OptimizedImage from './OptimizedImage';
import { getRelativeTime } from '../utils/dateUtils';
import { AuthError } from '../services/apiClient';
import { authService } from '../services/authService';

const CONDITION_LABELS: Record<ProductCondition, { label: string; color: string }> = {
  new: { label: 'نو', color: 'bg-ui-success/15 text-ui-success' },
  used: { label: 'کارکرده', color: 'bg-ui-warning/15 text-ui-warning' },
  damaged: { label: 'معیوب', color: 'bg-ui-danger/15 text-ui-danger' },
};

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const [isFavorite, setIsFavorite] = useState(product.isFavorite || false);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !isFavorite;
    setIsFavorite(newState);
    try {
      await azureService.toggleFavorite(product.id);
    } catch (err) {
      if (err instanceof AuthError) {
        authService.onAuthInvalid(err.reason ?? 'invalid_token');
        return;
      }
      setIsFavorite(!newState);
      console.error("Failed to toggle favorite");
    }
  };

  const displayDate = product.postedDate.includes('پیش') || product.postedDate.includes('الان')
    ? product.postedDate
    : getRelativeTime(product.postedDate);

  return (
    <div
      onClick={() => onClick(product)}
      className="group relative bg-ui-surface rounded-2xl border border-ui-border overflow-hidden cursor-pointer flex flex-col h-full transition-all duration-300 hover:-translate-y-1 hover:border-brand-700/40 hover:shadow-float press"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-ui-surface2 overflow-hidden">
        <OptimizedImage
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Favorite button */}
        <button
          className={`absolute top-2.5 left-2.5 w-8 h-8 glass-sm rounded-xl flex items-center justify-center transition-all duration-200 z-10 ${
            isFavorite ? 'text-ui-danger bg-ui-danger/20' : 'text-white hover:text-ui-danger hover:bg-ui-danger/20'
          }`}
          onClick={handleToggleFavorite}
          aria-label={isFavorite ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}
        >
          <Icon name="Heart" size={15} strokeWidth={2} className={isFavorite ? 'fill-current' : ''} />
        </button>

        {/* Promoted badge */}
        {product.isPromoted && (
          <span className="absolute top-2.5 right-2.5 bg-ui-warning text-black text-xs font-black px-2 py-0.5 rounded-lg z-10 flex items-center gap-1">
            <Icon name="Zap" size={13} strokeWidth={2.5} />
            ویژه
          </span>
        )}

        {/* Delivery badge */}
        {product.deliveryAvailable && (
          <span className="absolute bottom-2.5 right-2.5 glass-sm text-ui-info text-xs font-bold px-2 py-0.5 rounded-lg z-10 flex items-center gap-1">
            <Icon name="Truck" size={13} strokeWidth={2} />
            ارسال
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col flex-1 gap-2">
        {/* Price */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-black text-gradient leading-none">
            {product.price.toLocaleString()}
            <span className="text-xs font-bold text-brand-500 mr-1">{APP_STRINGS.currency}</span>
          </span>
          {product.isNegotiable && (
            <span className="text-xs font-bold bg-brand-950/60 text-brand-400 px-1.5 py-0.5 rounded-lg border border-brand-800/40 whitespace-nowrap shrink-0">
              قابل معامله
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-ui-text text-sm font-medium line-clamp-2 leading-snug flex-1">{product.title}</p>

        {/* Condition */}
        {product.condition && (
          <span className={`self-start text-xs font-bold px-2 py-0.5 rounded-lg ${CONDITION_LABELS[product.condition].color}`}>
            {CONDITION_LABELS[product.condition].label}
          </span>
        )}

        {/* Footer */}
        <div className="flex items-center text-ui-subtle text-xs gap-1 pt-1 border-t border-ui-border mt-auto">
          <Icon name="MapPin" size={13} strokeWidth={2} className="text-ui-muted shrink-0" />
          <span className="truncate text-ui-muted">{product.location}</span>
          <span className="mx-0.5 text-ui-border">•</span>
          <span className="shrink-0">{displayDate}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
