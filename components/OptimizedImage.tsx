
import React, { useState } from 'react';
import Icon from '../src/components/ui/Icon';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
}

/** Detect slow connection using the Network Information API */
const isSlowConnection = (): boolean => {
  const connection = (navigator as any).connection;
  if (!connection) return false;
  return connection.saveData === true || connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g';
};

const OptimizedImage: React.FC<OptimizedImageProps> = ({ src, alt, className, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  // On very slow/save-data connections default to deferred (user must tap to load)
  const [deferred, setDeferred] = useState(() => isSlowConnection());

  if (deferred) {
    return (
      <div
        className={`relative overflow-hidden bg-ui-surface2 flex items-center justify-center cursor-pointer ${className}`}
        onClick={() => setDeferred(false)}
        title="برای نمایش تصویر ضربه بزنید"
      >
        <div className="flex flex-col items-center gap-1 text-ui-subtle select-none pointer-events-none">
          <Icon name="ImageIcon" size={28} strokeWidth={1.5} />
          <span className="text-[10px]">نمایش تصویر</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse z-10">
          <Icon name="ImageIcon" size={32} strokeWidth={1.8} className="text-gray-300" />
        </div>
      )}
      
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400 z-10">
          <Icon name="ImageIcon" size={32} strokeWidth={1.8} className="mb-2 opacity-50" />
          <span className="text-[10px]">خطا در بارگذاری</span>
          <button 
            onClick={() => setHasError(false)} 
            className="mt-2 text-xs text-brand-600 flex items-center gap-1"
          >
            <Icon name="RefreshCw" size={12} strokeWidth={1.8} /> تلاش مجدد
          </button>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          loading="lazy" // Native Lazy Loading
          decoding="async"
          {...props}
        />
      )}
    </div>
  );
};

export default OptimizedImage;
