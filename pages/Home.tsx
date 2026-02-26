
import React, { useState, useEffect } from 'react';
import Icon from '../src/components/ui/Icon';
import CategoryPills from '../components/CategoryPills';
import ProductCard from '../components/ProductCard';
import ExchangeRateWidget from '../components/ExchangeRateWidget';
import { PROVINCES, DISTRICTS, SORT_OPTIONS, CATEGORIES } from '../constants';
import { Product, Page } from '../types';
import { azureService, SearchFilters } from '../services/azureService';
import { useLanguage } from '../contexts/LanguageContext';
import { toastService } from '../services/toastService';
import { findClosestProvince } from '../utils/locationUtils';

interface HomeProps {
  onProductClick: (product: Product) => void;
  searchQuery: string;
  onNavigate?: (page: Page) => void;
  onLocationChange?: (locationName: string) => void;
}

// --- Helper Component: Filter Accordion Section ---
const FilterSection: React.FC<{ 
    title: string; 
    isOpen?: boolean; 
    children: React.ReactNode;
    count?: number;
}> = ({ title, isOpen = true, children, count }) => {
    const [open, setOpen] = useState(isOpen);
    return (
        <div className="border-b border-ui-border py-4 last:border-0">
            <button 
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between text-right mb-2 group"
            >
                <span className="font-bold text-ui-text text-sm group-hover:text-brand-400 transition-colors flex items-center gap-2">
                    {title}
                    {count ? <span className="bg-brand-900/40 text-brand-300 text-xs px-1.5 py-0.5 rounded-full">{count}</span> : null}
                </span>
                <Icon name="ChevronDown" size={18} strokeWidth={1.8} className={`text-ui-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pt-2 pb-1">
                    {children}
                </div>
            </div>
        </div>
    );
};


const Home: React.FC<HomeProps> = ({ onProductClick, searchQuery, onNavigate, onLocationChange }) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // --- Filter States ---
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Staged Filter States (Applied only when user clicks "Show Results")
  const [tempCategory, setTempCategory] = useState<string>('all');
  const [tempProvince, setTempProvince] = useState<string>('all');
  const [tempDistrict, setTempDistrict] = useState<string>('');
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempSort, setTempSort] = useState('newest');
  const [tempCondition, setTempCondition] = useState<string>('');
  const [tempDynamicFilters, setTempDynamicFilters] = useState<Record<string, string | number>>({});

  // Active Applied Filters (Used for fetching data)
  const [appliedFilters, setAppliedFilters] = useState({
      province: 'all',
      district: '',
      minPrice: '',
      maxPrice: '',
      sort: 'newest',
      condition: '',
      dynamicFilters: {} as Record<string, string | number>
  });

  // Sync temp filters with applied filters when modal opens
  useEffect(() => {
      if (showFilters) {
          setTempCategory(selectedCategory);
          setTempProvince(appliedFilters.province);
          setTempDistrict(appliedFilters.district);
          setTempMinPrice(appliedFilters.minPrice);
          setTempMaxPrice(appliedFilters.maxPrice);
          setTempSort(appliedFilters.sort);
          setTempCondition(appliedFilters.condition);
          setTempDynamicFilters(appliedFilters.dynamicFilters);
      }
  }, [showFilters, appliedFilters, selectedCategory]);

  // Automatic Location Detection on First Load
  useEffect(() => {
      const hasCheckedLocation = sessionStorage.getItem('location_checked');
      if (!hasCheckedLocation && navigator.geolocation) {
          handleSmartLocation();
          sessionStorage.setItem('location_checked', 'true');
      }
  }, []);

  const handleSmartLocation = () => {
      setIsLocating(true);
      if (!navigator.geolocation) {
          toastService.error('مرورگر شما از مکان‌یابی پشتیبانی نمی‌کند.');
          setIsLocating(false);
          return;
      }

      navigator.geolocation.getCurrentPosition(
          (position) => {
              const { latitude, longitude } = position.coords;
              const closest = findClosestProvince(latitude, longitude);
              
              if (closest) {
                  setAppliedFilters(prev => ({ ...prev, province: closest.name }));
                  // Update Temp Province in case filter modal is next
                  setTempProvince(closest.name);
                  onLocationChange?.(closest.name);
                  toastService.info(`موقعیت شما تشخیص داده شد: ${closest.name}`);
              } else {
                  toastService.warning('موقعیت شما شناسایی نشد.');
              }
              setIsLocating(false);
          },
          (error) => {
              // PERMISSION_DENIED (code 1) is expected when user declines - log as warn, not error
              if (error.code === error.PERMISSION_DENIED) {
                  console.warn('Location permission denied by user.');
              } else {
                  console.warn('Location Error:', error);
              }
              // Don't spam error toast on automatic check, only log
              setIsLocating(false);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
  };

  // Reset district when province changes
  useEffect(() => {
      if (tempProvince === 'all') {
          setTempDistrict('');
      } else {
          // If the selected district doesn't belong to the new province, reset it
          const districts = DISTRICTS[tempProvince] || [];
          if (tempDistrict && !districts.includes(tempDistrict)) {
              setTempDistrict('');
          }
      }
  }, [tempProvince, tempDistrict]);

  // Fetch Products
  useEffect(() => {
    const fetchProducts = async () => {
        setLoading(true);
        const filters: SearchFilters = {
            query: searchQuery,
            category: selectedCategory,
            province: appliedFilters.province,
            district: appliedFilters.district,
            minPrice: appliedFilters.minPrice ? Number(appliedFilters.minPrice) : undefined,
            maxPrice: appliedFilters.maxPrice ? Number(appliedFilters.maxPrice) : undefined,
            sort: appliedFilters.sort,
            // dynamicFilters: appliedFilters.dynamicFilters (In real API)
        };
        
        try {
            const data = await azureService.searchAds(filters);
            setProducts(data);
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };
    
    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, selectedCategory, appliedFilters]);

  const handleApplyFilters = () => {
      if (tempCategory !== selectedCategory) {
          setTempDynamicFilters({});
      }
      setSelectedCategory(tempCategory);
      setAppliedFilters({
          province: tempProvince,
          district: tempDistrict,
          minPrice: tempMinPrice,
          maxPrice: tempMaxPrice,
          sort: tempSort,
          condition: tempCondition,
          dynamicFilters: tempCategory !== selectedCategory ? {} : tempDynamicFilters
      });
      onLocationChange?.(tempProvince === 'all' ? 'کل افغانستان' : tempProvince);
      setShowFilters(false);
  };

  const handleResetFilters = () => {
      setTempCategory('all');
      setTempProvince('all');
      setTempDistrict('');
      setTempMinPrice('');
      setTempMaxPrice('');
      setTempSort('newest');
      setTempCondition('');
      setTempDynamicFilters({});
  };

  const activeCategoryConfig = CATEGORIES.find(c => c.id === selectedCategory);
  
  // Calculate active filter count badge
  const activeCount = 
      (selectedCategory !== 'all' ? 1 : 0) +
      (appliedFilters.province !== 'all' ? 1 : 0) + 
      (appliedFilters.district ? 1 : 0) +
      (appliedFilters.minPrice ? 1 : 0) + 
      (appliedFilters.maxPrice ? 1 : 0) +
      (appliedFilters.condition ? 1 : 0) +
      (Object.keys(appliedFilters.dynamicFilters).length);

  // Pass location handler to Header via a Portal or Context would be ideal, 
  // but for this structure we assume Header is rendered in App.tsx. 
  // Since Home controls the product feed, we handle logic here. 
  // NOTE: In a real app, 'appliedFilters.province' should probably be in a Context.

  return (
    <div className="pb-20 min-h-screen">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden bg-hero-gradient border-b border-brand-800/30">
        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-600/6 rounded-full blur-3xl pointer-events-none" />
        {/* Afghan flag stripe accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-black via-brand-500 to-red-600 opacity-70" />

        <div className="max-w-7xl mx-auto px-4 pt-6 pb-5 relative">
          {/* Badge */}
          <div className="flex justify-center mb-4 animate-fadeUp" style={{ animationDelay: '0ms', animationFillMode: 'both' }}>
            <span className="inline-flex items-center gap-2 bg-brand-500/12 border border-brand-500/25 rounded-full px-4 py-1.5 text-brand-300 text-xs font-bold">
              <span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
              🇦🇫 بزرگترین بازار آنلاین افغانستان
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-center text-2xl sm:text-3xl font-black text-ui-text mb-2 leading-snug animate-fadeUp" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
            خرید و فروش آسان در
            <span className="text-gradient"> مارکت‌فور‌یو</span>
          </h1>
          <p className="text-center text-sm text-ui-muted mb-5 max-w-xs mx-auto leading-relaxed animate-fadeUp" style={{ animationDelay: '140ms', animationFillMode: 'both' }}>
            هر چه نیاز دارید بیابید یا آگهی خود را رایگان ثبت کنید
          </p>

          {/* Stats Row */}
          <div className="flex items-center justify-center gap-5 sm:gap-8 mb-5 flex-wrap animate-fadeUp" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            {[
              { icon: 'Tag',     value: '+۱۰ هزار', label: 'آگهی فعال' },
              { icon: 'MapPin',  value: '۳۴',       label: 'ولایت' },
              { icon: 'Grid2x2', value: '+۲۰',      label: 'دسته‌بندی' },
              { icon: 'Users',   value: '+۵۰ هزار', label: 'کاربر' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-1.5">
                <Icon name={stat.icon as any} size={15} strokeWidth={2} className="text-brand-400 shrink-0" />
                <span className="font-black text-ui-text text-sm">{stat.value}</span>
                <span className="text-ui-muted text-xs">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-3 animate-fadeUp" style={{ animationDelay: '260ms', animationFillMode: 'both' }}>
            {onNavigate && (
              <button
                onClick={() => onNavigate(Page.POST_AD)}
                className="btn-brand text-white px-6 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 press"
              >
                <Icon name="PlusCircle" size={17} strokeWidth={2.5} />
                آگهی رایگان بده
              </button>
            )}
            <button
              onClick={() => setSelectedCategory('all')}
              className="bg-ui-surface2 border border-ui-border text-ui-text px-6 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-ui-surface3 hover:border-brand-700/40 transition-all press"
            >
              <Icon name="Search" size={17} strokeWidth={2} className="text-brand-400" />
              مرور آگهی‌ها
            </button>
          </div>
        </div>
      </div>

      {/* Exchange Rate Widget */}
      <ExchangeRateWidget />

      {/* Smart Location Banner */}
      {appliedFilters.province !== 'all' && (
        <div className="bg-brand-950/60 border-b border-brand-800/40 px-4 py-2 flex items-center justify-between text-xs text-brand-300 animate-slideInLeft">
          <div className="flex items-center gap-2">
            <Icon name="MapPin" size={15} strokeWidth={2} className="text-brand-400" />
            <span>آگهی‌های <b className="text-brand-200">{appliedFilters.province}</b></span>
          </div>
          <button
            onClick={() => {
              setAppliedFilters(prev => ({ ...prev, province: 'all' }));
              onLocationChange?.('کل افغانستان');
            }}
            className="text-brand-400 hover:text-brand-200 text-xs font-bold flex items-center gap-1 transition-colors"
          >
            <Icon name="X" size={14} strokeWidth={2.5} />
            همه شهرها
          </button>
        </div>
      )}

      {/* Category & Filter Bar */}
      <div className="sticky top-[118px] sm:top-[64px] z-20 glass border-b border-ui-border">
        <div className="flex items-center pl-3 pr-1">
          <div className="flex-1 overflow-hidden">
            <CategoryPills
              selectedId={selectedCategory}
              onSelect={(id) => { setSelectedCategory(id); setTempDynamicFilters({}); }}
            />
          </div>
          <div className="h-6 w-px bg-ui-border mx-2 shrink-0" />
          <button
            onClick={() => setShowFilters(true)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all press shrink-0 ${
              activeCount > 0
                ? 'btn-brand text-white'
                : 'text-ui-muted bg-ui-surface2 hover:bg-ui-surface3 border border-ui-border'
            }`}
          >
            <Icon name="SlidersHorizontal" size={15} strokeWidth={2} />
            <span className="hidden sm:inline">{t('filter_btn')}</span>
            <span className="sm:hidden">فیلتر</span>
            {activeCount > 0 && (
              <span className="w-5 h-5 flex items-center justify-center bg-white/20 text-white text-xs font-black rounded-full">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-5 px-1">
          <h2 className="text-base font-bold text-ui-text flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-brand-gradient flex items-center justify-center shrink-0">
              <Icon name="LayoutGrid" size={14} strokeWidth={2.5} className="text-white" />
            </span>
            {t('hero_title')}
            {selectedCategory !== 'all' && (
              <span className="text-xs font-normal text-ui-muted">
                در {t(activeCategoryConfig?.translationKey as any)}
              </span>
            )}
          </h2>
          {/* Sort - Desktop */}
          <div className="hidden md:flex items-center gap-2 text-xs text-ui-muted bg-ui-surface2 px-3 py-2 rounded-xl border border-ui-border">
            <Icon name="ArrowUpDown" size={14} strokeWidth={2} className="text-ui-subtle" />
            <span>{t('sort_label')}</span>
            <select
              value={appliedFilters.sort}
              onChange={(e) => setAppliedFilters({ ...appliedFilters, sort: e.target.value })}
              className="border-none bg-transparent font-bold text-ui-text outline-none cursor-pointer text-xs"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id} className="bg-ui-surface text-ui-text">{opt.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-ui-surface rounded-2xl border border-ui-border overflow-hidden">
                <div className="aspect-[4/3] skeleton" />
                <div className="p-3.5 space-y-2.5">
                  <div className="h-5 skeleton rounded-lg w-2/3" />
                  <div className="h-3.5 skeleton rounded-lg w-full" />
                  <div className="h-3.5 skeleton rounded-lg w-3/4" />
                  <div className="h-3 skeleton rounded-lg w-1/2 mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-ui-surface rounded-3xl border border-dashed border-ui-border mx-4 animate-fadeUp">
            <div className="w-20 h-20 bg-ui-surface2 rounded-3xl flex items-center justify-center mb-5 shadow-soft">
              <Icon name="SearchX" size={36} strokeWidth={1.5} className="text-ui-muted" />
            </div>
            <h3 className="text-base font-bold text-ui-text mb-2">{t('empty_state')}</h3>
            <p className="text-sm text-ui-muted mb-6 max-w-xs mx-auto leading-relaxed">
              هیچ آگهی با این مشخصات پیدا نشد. پیشنهاد می‌کنیم فیلترها را تغییر دهید.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setAppliedFilters({
                  province: 'all',
                  district: '',
                  minPrice: '',
                  maxPrice: '',
                  sort: 'newest',
                  condition: '',
                  dynamicFilters: {},
                });
              }}
              className="btn-brand text-white px-8 py-2.5 rounded-2xl text-sm font-bold"
            >
              نمایش همه آگهی‌ها
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {products.map((product, idx) => (
              <div
                key={product.id}
                className="animate-fadeUp"
                style={{ animationDelay: `${Math.min(idx * 40, 320)}ms`, animationFillMode: 'both' }}
              >
                <ProductCard
                  product={product}
                  onClick={onProductClick}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Professional Filter Drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowFilters(false)}
          />

          {/* Drawer */}
          <div className="relative w-full md:max-w-md bg-ui-surface h-full shadow-float flex flex-col animate-slideInRight">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-ui-border">
              <h2 className="text-base font-bold text-ui-text flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-brand-gradient flex items-center justify-center">
                  <Icon name="SlidersHorizontal" size={14} strokeWidth={2.5} className="text-white" />
                </span>
                فیلترهای پیشرفته
              </h2>
              <button
                onClick={() => setShowFilters(false)}
                className="w-8 h-8 hover:bg-ui-surface2 rounded-xl flex items-center justify-center text-ui-muted transition-colors press"
              >
                <Icon name="X" size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-1">

              {/* Category Section */}
              <FilterSection title="دسته‌بندی" isOpen={true} count={tempCategory !== 'all' ? 1 : 0}>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => {
                    const isSelected = tempCategory === cat.id;
                    const catName = t(cat.translationKey as any);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          if (cat.id !== tempCategory) setTempDynamicFilters({});
                          setTempCategory(cat.id);
                        }}
                        className={`flex items-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl border transition-all press ${
                          isSelected
                            ? 'bg-brand-950/60 border-brand-600/60 text-brand-300'
                            : 'bg-ui-surface2 border-ui-border text-ui-muted hover:border-ui-border2'
                        }`}
                      >
                        <Icon
                          name={(cat.icon || 'MoreHorizontal') as any}
                          size={14}
                          strokeWidth={isSelected ? 2.5 : 2}
                          className={isSelected ? 'text-brand-400' : 'text-ui-subtle'}
                        />
                        <span className="truncate">{catName}</span>
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              {/* Sort Section */}
              <FilterSection title="مرتب‌سازی" isOpen={true}>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTempSort(opt.id)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all press ${
                        tempSort === opt.id
                          ? 'bg-brand-950/60 border-brand-600/60 text-brand-300'
                          : 'bg-ui-surface2 border-ui-border text-ui-muted hover:border-ui-border2'
                      }`}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              </FilterSection>

              {/* Location Section */}
              <FilterSection title="موقعیت مکانی" isOpen={true} count={tempProvince !== 'all' ? (tempDistrict ? 2 : 1) : 0}>
                <div className="space-y-3">
                  <button
                    onClick={handleSmartLocation}
                    className="w-full flex items-center justify-center gap-2 text-brand-400 bg-brand-950/50 border border-brand-800/50 rounded-2xl py-2.5 text-xs font-bold hover:bg-brand-950/70 transition-colors press"
                  >
                    {isLocating
                      ? <Icon name="Loader2" size={15} strokeWidth={2} className="animate-spin" />
                      : <Icon name="Crosshair" size={15} strokeWidth={2} />
                    }
                    یافتن موقعیت من (GPS)
                  </button>

                  <div className="relative">
                    <label className="text-xs text-ui-muted font-bold mb-1.5 block">ولایت (استان)</label>
                    <select
                      value={tempProvince}
                      onChange={(e) => setTempProvince(e.target.value)}
                      className="w-full p-3 bg-ui-surface2 border border-ui-border rounded-2xl appearance-none focus:ring-2 focus:ring-brand-500/40 outline-none text-sm font-medium text-ui-text"
                    >
                      {PROVINCES.map(p => (
                        <option key={p.id} value={p.id === 'all' ? 'all' : p.name} className="bg-ui-surface text-ui-text">{p.name}</option>
                      ))}
                    </select>
                    <Icon name="ChevronDown" size={16} strokeWidth={2} className="absolute left-3 top-9 text-ui-muted pointer-events-none" />
                  </div>

                  {tempProvince !== 'all' && DISTRICTS[tempProvince] && (
                    <div className="relative animate-fadeUp">
                      <label className="text-xs text-ui-muted font-bold mb-1.5 block">ناحیه / ولسوالی</label>
                      <select
                        value={tempDistrict}
                        onChange={(e) => setTempDistrict(e.target.value)}
                        className="w-full p-3 bg-ui-surface2 border border-ui-border rounded-2xl appearance-none focus:ring-2 focus:ring-brand-500/40 outline-none text-sm font-medium text-ui-text"
                      >
                        <option value="" className="bg-ui-surface text-ui-text">همه نواحی</option>
                        {DISTRICTS[tempProvince].map(d => (
                          <option key={d} value={d} className="bg-ui-surface text-ui-text">{d}</option>
                        ))}
                      </select>
                      <Icon name="ChevronDown" size={16} strokeWidth={2} className="absolute left-3 top-9 text-ui-muted pointer-events-none" />
                    </div>
                  )}
                </div>
              </FilterSection>

              {/* Price Section */}
              <FilterSection title="محدوده قیمت" isOpen={true} count={tempMinPrice || tempMaxPrice ? 1 : 0}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="حداقل"
                      value={tempMinPrice}
                      onChange={(e) => setTempMinPrice(e.target.value)}
                      className="w-full p-3 bg-ui-surface2 border border-ui-border rounded-2xl focus:ring-2 focus:ring-brand-500/40 outline-none text-center text-sm font-bold dir-ltr text-ui-text placeholder:text-ui-subtle"
                    />
                    <span className="absolute right-3 top-3.5 text-xs text-ui-subtle">از</span>
                  </div>
                  <div className="w-4 h-px bg-ui-border shrink-0" />
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="حداکثر"
                      value={tempMaxPrice}
                      onChange={(e) => setTempMaxPrice(e.target.value)}
                      className="w-full p-3 bg-ui-surface2 border border-ui-border rounded-2xl focus:ring-2 focus:ring-brand-500/40 outline-none text-center text-sm font-bold dir-ltr text-ui-text placeholder:text-ui-subtle"
                    />
                    <span className="absolute right-3 top-3.5 text-xs text-ui-subtle">تا</span>
                  </div>
                </div>
                <p className="text-center text-xs text-ui-subtle mt-2">قیمت‌ها به افغانی (؋) هستند</p>
              </FilterSection>

              {/* Condition Section */}
              <FilterSection title={t('condition_label')} isOpen={true} count={tempCondition ? 1 : 0}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: '', label: 'همه' },
                    { id: 'new', label: t('condition_new') },
                    { id: 'used', label: t('condition_used') },
                    { id: 'damaged', label: t('condition_damaged') },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTempCondition(opt.id)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all press ${
                        tempCondition === opt.id
                          ? 'bg-brand-950/60 border-brand-600/60 text-brand-300'
                          : 'bg-ui-surface2 border-ui-border text-ui-muted hover:border-ui-border2'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              {/* Dynamic Category Filters */}
              {(() => {
                const tempCatConfig = CATEGORIES.find(c => c.id === tempCategory);
                return tempCatConfig?.filterConfig && tempCatConfig.filterConfig.length > 0 && (
                  <FilterSection title={`ویژگی‌های ${t(tempCatConfig.translationKey as any)}`} isOpen={true}>
                    <div className="space-y-4">
                      {tempCatConfig.filterConfig.map(filter => (
                        <div key={filter.key}>
                          <label className="text-xs text-ui-muted font-bold mb-1.5 block">{filter.label}</label>
                          {filter.type === 'select' && (
                            <div className="relative">
                              <select
                                value={tempDynamicFilters[filter.key] || ''}
                                onChange={(e) => setTempDynamicFilters({ ...tempDynamicFilters, [filter.key]: e.target.value })}
                                className="w-full p-3 bg-ui-surface2 border border-ui-border rounded-2xl appearance-none focus:ring-2 focus:ring-brand-500/40 outline-none text-sm text-ui-text"
                              >
                                <option value="" className="bg-ui-surface text-ui-text">همه</option>
                                {filter.options?.map(opt => (
                                  <option key={opt} value={opt} className="bg-ui-surface text-ui-text">{opt}</option>
                                ))}
                              </select>
                              <Icon name="ChevronDown" size={16} strokeWidth={2} className="absolute left-3 top-3.5 text-ui-muted pointer-events-none" />
                            </div>
                          )}
                          {filter.type === 'range' && (
                            <div className="flex gap-2 items-center">
                              <input
                                type="number"
                                placeholder={`از ${filter.min}`}
                                className="w-full p-3 bg-ui-surface2 border border-ui-border rounded-2xl focus:ring-2 focus:ring-brand-500/40 outline-none text-center text-sm text-ui-text placeholder:text-ui-subtle"
                                onChange={(e) => setTempDynamicFilters({ ...tempDynamicFilters, [`${filter.key}_min`]: e.target.value })}
                              />
                              <span className="text-ui-subtle shrink-0">-</span>
                              <input
                                type="number"
                                placeholder={`تا ${filter.max}`}
                                className="w-full p-3 bg-ui-surface2 border border-ui-border rounded-2xl focus:ring-2 focus:ring-brand-500/40 outline-none text-center text-sm text-ui-text placeholder:text-ui-subtle"
                                onChange={(e) => setTempDynamicFilters({ ...tempDynamicFilters, [`${filter.key}_max`]: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </FilterSection>
                );
              })()}
            </div>

            {/* Sticky Footer */}
            <div className="p-4 border-t border-ui-border bg-ui-surface/80 backdrop-blur">
              <div className="flex gap-3">
                <button
                  onClick={handleResetFilters}
                  className="w-12 h-12 flex items-center justify-center text-ui-muted hover:bg-ui-surface2 rounded-2xl transition-colors border border-ui-border press shrink-0"
                  title="پاک کردن فیلترها"
                >
                  <Icon name="RefreshCw" size={17} strokeWidth={2} />
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 btn-brand text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 h-12"
                >
                  مشاهده نتایج
                  <Icon name="ChevronLeft" size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
