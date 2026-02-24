
import React, { useState, useEffect } from 'react';
import Icon from '../src/components/ui/Icon';
import CategoryPills from '../components/CategoryPills';
import ProductCard from '../components/ProductCard';
import ExchangeRateWidget from '../components/ExchangeRateWidget';
import { PROVINCES, DISTRICTS, SORT_OPTIONS, CATEGORIES } from '../constants';
import { Product } from '../types';
import { azureService, SearchFilters } from '../services/azureService';
import { useLanguage } from '../contexts/LanguageContext';
import { toastService } from '../services/toastService';
import { findClosestProvince } from '../utils/locationUtils';

interface HomeProps {
  onProductClick: (product: Product) => void;
  searchQuery: string;
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
        <div className="border-b border-gray-100 py-4 last:border-0">
            <button 
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between text-right mb-2 group"
            >
                <span className="font-bold text-gray-800 text-sm group-hover:text-brand-600 transition-colors flex items-center gap-2">
                    {title}
                    {count ? <span className="bg-brand-100 text-brand-700 text-[10px] px-1.5 py-0.5 rounded-full">{count}</span> : null}
                </span>
                <Icon name="ChevronDown" size={18} strokeWidth={1.8} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pt-2 pb-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

const Home: React.FC<HomeProps> = ({ onProductClick, searchQuery }) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // --- Filter States ---
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Staged Filter States (Applied only when user clicks "Show Results")
  const [tempProvince, setTempProvince] = useState<string>('all');
  const [tempDistrict, setTempDistrict] = useState<string>('');
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempSort, setTempSort] = useState('newest');
  const [tempDynamicFilters, setTempDynamicFilters] = useState<Record<string, string | number>>({});

  // Active Applied Filters (Used for fetching data)
  const [appliedFilters, setAppliedFilters] = useState({
      province: 'all',
      district: '',
      minPrice: '',
      maxPrice: '',
      sort: 'newest',
      dynamicFilters: {} as Record<string, string | number>
  });

  // Sync temp filters with applied filters when modal opens
  useEffect(() => {
      if (showFilters) {
          setTempProvince(appliedFilters.province);
          setTempDistrict(appliedFilters.district);
          setTempMinPrice(appliedFilters.minPrice);
          setTempMaxPrice(appliedFilters.maxPrice);
          setTempSort(appliedFilters.sort);
          setTempDynamicFilters(appliedFilters.dynamicFilters);
      }
  }, [showFilters, appliedFilters]);

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
                  
                  toastService.info(`موقعیت شما تشخیص داده شد: ${closest.name}`);
              } else {
                  toastService.warning('موقعیت شما شناسایی نشد.');
              }
              setIsLocating(false);
          },
          (error) => {
              console.error('Location Error:', error);
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
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    
    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, selectedCategory, appliedFilters]);

  const handleApplyFilters = () => {
      setAppliedFilters({
          province: tempProvince,
          district: tempDistrict,
          minPrice: tempMinPrice,
          maxPrice: tempMaxPrice,
          sort: tempSort,
          dynamicFilters: tempDynamicFilters
      });
      setShowFilters(false);
  };

  const handleResetFilters = () => {
      setTempProvince('all');
      setTempDistrict('');
      setTempMinPrice('');
      setTempMaxPrice('');
      setTempSort('newest');
      setTempDynamicFilters({});
  };

  const activeCategoryConfig = CATEGORIES.find(c => c.id === selectedCategory);
  
  // Calculate active filter count badge
  const activeCount = 
      (appliedFilters.province !== 'all' ? 1 : 0) + 
      (appliedFilters.district ? 1 : 0) +
      (appliedFilters.minPrice ? 1 : 0) + 
      (appliedFilters.maxPrice ? 1 : 0) +
      (Object.keys(appliedFilters.dynamicFilters).length);

  // Pass location handler to Header via a Portal or Context would be ideal, 
  // but for this structure we assume Header is rendered in App.tsx. 
  // Since Home controls the product feed, we handle logic here. 
  // NOTE: In a real app, 'appliedFilters.province' should probably be in a Context.

  return (
    <div className="pb-20 min-h-screen bg-gray-50">
      
      {/* Exchange Rate Widget */}
      <ExchangeRateWidget />

      {/* Smart Location Banner (If filtered by location) */}
      {appliedFilters.province !== 'all' && (
          <div className="bg-brand-50 border-b border-brand-100 px-4 py-2 flex items-center justify-between text-xs text-brand-700 animate-in slide-in-from-top">
              <div className="flex items-center gap-2">
                  <Icon name="MapPin" size={18} strokeWidth={1.8} />
                  <span>نمایش آگهی‌های <b>{appliedFilters.province}</b></span>
              </div>
              <button 
                onClick={() => setAppliedFilters(prev => ({...prev, province: 'all'}))}
                className="text-brand-600 hover:text-brand-800 underline"
              >
                  مشاهده همه شهرها
              </button>
          </div>
      )}

      {/* Category & Filter Bar */}
      <div className="sticky top-16 z-20 sm:top-[4rem] bg-white border-b border-gray-100 shadow-sm">
         <div className="flex items-center pl-4 py-2">
             <div className="flex-1 overflow-hidden">
                <CategoryPills selectedId={selectedCategory} onSelect={(id) => { setSelectedCategory(id); setTempDynamicFilters({}); }} />
             </div>
             <div className="h-8 w-px bg-gray-200 mx-2"></div>
             <button 
                onClick={() => setShowFilters(true)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl whitespace-nowrap transition-all active:scale-95 ${
                  activeCount > 0 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' 
                  : 'text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200'
                }`}
             >
                <Icon name="SlidersHorizontal" size={18} strokeWidth={1.8} />
                <span className="hidden sm:inline">{t('filter_btn')}</span>
                <span className="sm:hidden">فیلتر</span>
                {activeCount > 0 && (
                    <span className="w-5 h-5 flex items-center justify-center bg-white text-brand-600 text-[10px] rounded-full shadow-sm ml-1">
                      {activeCount}
                    </span>
                )}
             </button>
         </div>
      </div>

      {/* Manual Locate Trigger (Mobile mostly) */}
      <div className="px-4 mt-4 md:hidden">
          <button 
            onClick={handleSmartLocation}
            disabled={isLocating}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
              {isLocating ? <Icon name="Loader2" size={18} strokeWidth={1.8} className="animate-spin" /> : <Icon name="Crosshair" size={18} strokeWidth={1.8} />}
              آگهی‌های اطراف من را پیدا کن
          </button>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4 px-1">
             <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                 <Icon name="Search" size={20} strokeWidth={1.8} className="text-brand-500" />
                 {t('hero_title')}
                 {selectedCategory !== 'all' && <span className="text-sm font-normal text-gray-500">در {t(activeCategoryConfig?.translationKey as any)}</span>}
             </h2>
             {/* Simple sort for desktop, hidden on mobile as it's in drawer */}
             <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1 rounded-lg border border-gray-100">
                <span>{t('sort_label')}</span>
                <select 
                    value={appliedFilters.sort} 
                    onChange={(e) => setAppliedFilters({...appliedFilters, sort: e.target.value})}
                    className="border-none bg-transparent font-medium text-gray-800 outline-none cursor-pointer"
                >
                    {SORT_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                </select>
             </div>
        </div>
        
        {loading ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {[...Array(8)].map((_, i) => (
                     <div key={i} className="bg-white rounded-xl h-72 animate-pulse shadow-sm border border-gray-100 p-4">
                        <div className="w-full h-40 bg-gray-200 rounded-lg mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                     </div>
                 ))}
             </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200 mx-4">
             <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                 <Icon name="RefreshCw" size={40} strokeWidth={1.8} className="text-gray-300" />
             </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t('empty_state')}</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">هیچ آگهی با این مشخصات پیدا نشد. پیشنهاد می‌کنیم فیلترها را تغییر دهید.</p>
            <button 
                onClick={() => {
                    setSelectedCategory('all');
                    setAppliedFilters({
                        province: 'all',
                        district: '',
                        minPrice: '',
                        maxPrice: '',
                        sort: 'newest',
                        dynamicFilters: {}
                    });
                }}
                className="text-brand-600 bg-brand-50 px-8 py-3 rounded-xl text-sm font-bold hover:bg-brand-100 transition-colors"
            >
                نمایش همه آگهی‌ها
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onClick={onProductClick} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Professional Filter Drawer */}
      {showFilters && (
          <div className="fixed inset-0 z-[60] flex justify-end isolation-auto">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in" 
                onClick={() => setShowFilters(false)}
              />
              
              {/* Drawer Content */}
              <div className="relative w-full md:max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white z-10">
                      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <Icon name="SlidersHorizontal" size={20} strokeWidth={1.8} className="text-brand-600" />
                          فیلترهای پیشرفته
                      </h2>
                      <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                          <Icon name="X" size={24} strokeWidth={1.8} />
                      </button>
                  </div>

                  {/* Scrollable Body */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-1">
                      
                      {/* Sort Section */}
                      <FilterSection title="مرتب‌سازی" isOpen={true}>
                          <div className="flex flex-wrap gap-2">
                              {SORT_OPTIONS.map(opt => (
                                  <button
                                    key={opt.id}
                                    onClick={() => setTempSort(opt.id)}
                                    className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                                        tempSort === opt.id 
                                        ? 'bg-brand-50 border-brand-200 text-brand-700' 
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
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
                                className="w-full flex items-center justify-center gap-2 text-brand-600 bg-brand-50 border border-brand-100 rounded-xl py-2.5 text-sm font-bold hover:bg-brand-100 transition-colors"
                              >
                                  {isLocating ? <Icon name="Loader2" size={18} strokeWidth={1.8} className="animate-spin" /> : <Icon name="Crosshair" size={18} strokeWidth={1.8} />}
                                  یافتن موقعیت من (GPS)
                              </button>
                              
                              <div className="relative">
                                  <label className="text-xs text-gray-500 font-bold mb-1 block">ولایت (استان)</label>
                                  <select 
                                      value={tempProvince}
                                      onChange={(e) => setTempProvince(e.target.value)}
                                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                                  >
                                      {PROVINCES.map(p => (
                                          <option key={p.id} value={p.id === 'all' ? 'all' : p.name}>{p.name}</option> 
                                      ))}
                                  </select>
                                  <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-8 text-gray-400 pointer-events-none" />
                              </div>

                              {/* Smart District Selector */}
                              {tempProvince !== 'all' && DISTRICTS[tempProvince] && (
                                  <div className="relative animate-in slide-in-from-top-2 fade-in">
                                      <label className="text-xs text-gray-500 font-bold mb-1 block">ناحیه / ولسوالی</label>
                                      <select 
                                          value={tempDistrict}
                                          onChange={(e) => setTempDistrict(e.target.value)}
                                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                                      >
                                          <option value="">همه نواحی</option>
                                          {DISTRICTS[tempProvince].map(d => (
                                              <option key={d} value={d}>{d}</option>
                                          ))}
                                      </select>
                                      <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-8 text-gray-400 pointer-events-none" />
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
                                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-center text-sm font-bold dir-ltr"
                                  />
                                  <span className="absolute right-3 top-3.5 text-xs text-gray-400">از</span>
                              </div>
                              <span className="text-gray-300">-</span>
                              <div className="relative flex-1">
                                  <input 
                                      type="number" 
                                      placeholder="حداکثر" 
                                      value={tempMaxPrice}
                                      onChange={(e) => setTempMaxPrice(e.target.value)}
                                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-center text-sm font-bold dir-ltr"
                                  />
                                  <span className="absolute right-3 top-3.5 text-xs text-gray-400">تا</span>
                              </div>
                          </div>
                          <p className="text-center text-xs text-gray-400 mt-2">قیمت‌ها به افغانی (؋) هستند</p>
                      </FilterSection>
                      
                      {/* Dynamic Category Filters */}
                      {activeCategoryConfig?.filterConfig && activeCategoryConfig.filterConfig.length > 0 && (
                        <FilterSection title={`ویژگی‌های ${t(activeCategoryConfig.translationKey as any)}`} isOpen={true}>
                           <div className="space-y-4">
                              {activeCategoryConfig.filterConfig.map(filter => (
                                <div key={filter.key}>
                                  <label className="text-xs text-gray-500 font-bold mb-1 block">{filter.label}</label>
                                  
                                  {filter.type === 'select' && (
                                     <div className="relative">
                                       <select
                                         value={tempDynamicFilters[filter.key] || ''}
                                         onChange={(e) => setTempDynamicFilters({...tempDynamicFilters, [filter.key]: e.target.value})}
                                         className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                                       >
                                         <option value="">همه</option>
                                         {filter.options?.map(opt => (
                                           <option key={opt} value={opt}>{opt}</option>
                                         ))}
                                       </select>
                                       <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" />
                                     </div>
                                  )}

                                  {filter.type === 'range' && (
                                      <div className="flex gap-2 items-center">
                                        <input 
                                          type="number"
                                          placeholder={`از ${filter.min}`}
                                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-center text-sm"
                                          onChange={(e) => setTempDynamicFilters({...tempDynamicFilters, [`${filter.key}_min`]: e.target.value})}
                                        />
                                        <span className="text-gray-300">-</span>
                                        <input 
                                          type="number"
                                          placeholder={`تا ${filter.max}`}
                                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-center text-sm"
                                          onChange={(e) => setTempDynamicFilters({...tempDynamicFilters, [`${filter.key}_max`]: e.target.value})}
                                        />
                                      </div>
                                  )}
                                </div>
                              ))}
                           </div>
                        </FilterSection>
                      )}
                  </div>

                  {/* Sticky Footer */}
                  <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                      <div className="flex gap-3">
                          <button 
                              onClick={handleResetFilters}
                              className="px-6 py-3.5 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors border border-gray-200 text-sm flex-shrink-0"
                          >
                              <Icon name="RefreshCw" size={18} strokeWidth={1.8} />
                          </button>
                          <button 
                              onClick={handleApplyFilters}
                              className="flex-1 py-3.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-200 transition-transform active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                          >
                              مشاهده نتایج
                              <Icon name="ChevronLeft" size={18} strokeWidth={1.8} />
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
