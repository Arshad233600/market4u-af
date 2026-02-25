
import React, { useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { CATEGORIES, PROVINCES, DISTRICTS, DISTRICT_LOCATIONS } from '../constants';
import { generateAdDescription } from '../services/geminiService';
import { azureService } from '../services/azureService';
import { Page, Product, ProductCondition } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { TRANSLATIONS } from '../translations';
import LocationPicker from '../components/LocationPicker';
import { toastService } from '../services/toastService';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface PostAdProps {
    onNavigate: (page: Page) => void;
    existingAd?: Product | null; // Optional prop for edit mode
}

// Category-specific title placeholder hints
const CATEGORY_TITLE_PLACEHOLDERS: Record<string, string> = {
  real_estate: 'مثلا: آپارتمان ۳ اتاقه در شهرنو...',
  vehicles: 'مثلا: تویوتا کرولا مدل ۲۰۱۸، رنگ سفید...',
  electronics: 'مثلا: آیفون ۱۴ پرو مکس ۲۵۶ گیگ...',
  home_kitchen: 'مثلا: مبلمان راحتی ۷ نفره...',
  fashion: 'مثلا: پیراهن مردانه سایز L...',
  entertainment: 'مثلا: کتاب ریاضی دوازدهم...',
  baby: 'مثلا: کالسکه نوزاد Chicco...',
  sports: 'مثلا: توپ فوتبال نایک سایز ۵...',
  business: 'مثلا: ماشین لاندری صنعتی...',
  services: 'مثلا: تدریس خصوصی ریاضی...',
};

const PostAd: React.FC<PostAdProps> = ({ onNavigate, existingAd }) => {
  const { t } = useLanguage();
  // Form States
  const [title, setTitle] = useState(existingAd?.title || '');
  
  // Default category selection logic
  const defaultCategory = CATEGORIES.find(c => c.id !== 'all');
  const [category, setCategory] = useState(existingAd?.category || defaultCategory?.id || '');
  const [subCategory, setSubCategory] = useState(existingAd?.subCategory || '');
  
  const [price, setPrice] = useState(existingAd?.price.toString() || '');
  
  // Location
  const [province, setProvince] = useState(() => {
      if (existingAd) {
          const parts = existingAd.location.split(' - ');
          return parts[0] || '';
      }
      return '';
  });
  const [district, setDistrict] = useState(() => {
      if (existingAd) {
          const parts = existingAd.location.split(' - ');
          return parts[1] || '';
      }
      return '';
  });
  
  // Coordinates State
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | undefined>(() => {
      if (existingAd && existingAd.latitude && existingAd.longitude) {
          return { lat: existingAd.latitude, lng: existingAd.longitude };
      }
      return undefined;
  });
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(() => {
      if (existingAd && existingAd.latitude && existingAd.longitude) {
          return { lat: existingAd.latitude, lng: existingAd.longitude };
      }
      return null;
  });
  
  const [description, setDescription] = useState(existingAd?.description || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  
  // Images
  const [images, setImages] = useState<string[]>(existingAd?.imageUrls || (existingAd?.imageUrl ? [existingAd.imageUrl] : []));
  const [uploadingImages, setUploadingImages] = useState<boolean[]>([]);

  // Dynamic Fields State (Stores generic key-value pairs based on category config)
  const [dynamicValues, setDynamicValues] = useState<Record<string, string | number>>(existingAd?.dynamicFields || {});

  // New marketplace fields
  const [condition, setCondition] = useState<ProductCondition>(existingAd?.condition || 'used');
  const [isNegotiable, setIsNegotiable] = useState(existingAd?.isNegotiable || false);
  const [deliveryAvailable, setDeliveryAvailable] = useState(existingAd?.deliveryAvailable || false);

  const activeCategory = CATEGORIES.find(c => c.id === category);
  const subCategories = activeCategory?.subcategories || [];
  const availableDistricts = DISTRICTS[province] || [];

  // Handle Category Change
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCategory = e.target.value;
      setCategory(newCategory);
      
      // Reset subcategory and dynamic values if category changes
      if (!existingAd || newCategory !== existingAd.category) {
          setSubCategory('');
          setDynamicValues({});
      } else {
          // If switching back to original category, restore original values
          setSubCategory(existingAd.subCategory || '');
          setDynamicValues(existingAd.dynamicFields || {});
      }
  };

  // Handle Province Change
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const pName = e.target.value;
      setProvince(pName);
      setDistrict('');
      
      const pData = PROVINCES.find(p => p.name === pName);
      if (pData && pData.lat && pData.lng) {
          setMapCenter({ lat: pData.lat, lng: pData.lng });
          setCoords({ lat: pData.lat, lng: pData.lng });
      }
  };

  // Handle District Change
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const dName = e.target.value;
      setDistrict(dName);

      if (DISTRICT_LOCATIONS[dName]) {
          const loc = DISTRICT_LOCATIONS[dName];
          setMapCenter({ lat: loc.lat, lng: loc.lng });
          setCoords({ lat: loc.lat, lng: loc.lng });
      } else {
          // If no specific coordinate for district, keep map at province level but update text
          console.warn(`No coordinates found for district: ${dName}`);
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const files: File[] = Array.from(e.target.files);
      const remainingSlots = 5 - images.length;
      const filesToUpload = files.slice(0, remainingSlots);

      if (filesToUpload.length === 0) {
          toastService.error('حداکثر ۵ عکس می‌توانید انتخاب کنید.');
          return;
      }

      setUploadingImages(prev => [...prev, ...new Array(filesToUpload.length).fill(true)]);
      
      const uploadPromises = filesToUpload.map(async (file) => {
          if (file.size > 5 * 1024 * 1024) {
              toastService.error(`فایل ${file.name} بزرگتر از ۵ مگابایت است.`);
              return null;
          }
          return await azureService.uploadImage(file);
      });

      const results = await Promise.all(uploadPromises);
      const successfulUrls = results.filter((url): url is string => url !== null);

      setImages(prev => [...prev, ...successfulUrls]);
      setUploadingImages(prev => prev.slice(0, prev.length - filesToUpload.length));

      if (successfulUrls.length < filesToUpload.length) {
          toastService.error('برخی از عکس‌ها آپلود نشدند.');
      }
    }
  };

  const handleGenerateDescription = async () => {
    if (!title || !category || !province) {
        alert('لطفا عنوان، دسته‌بندی و موقعیت را وارد کنید.');
        return;
    }
    setIsGenerating(true);
    // Include dynamic values in the prompt context if possible
    const attributes = Object.entries(dynamicValues).map(([k, v]) => `${k}: ${v}`).join(', ');
    const fullContext = `${title} (${attributes})`;
    
    const generated = await generateAdDescription(fullContext, category, province);
    setDescription(generated);
    setIsGenerating(false);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('مرورگر شما از قابلیت تبدیل صدا به متن پشتیبانی نمی‌کند.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fa-AF'; // Dari/Persian
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setDescription(prev => (prev ? prev + ' ' + transcript : transcript));
    };
    recognition.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!province) { alert("لطفا ولایت را انتخاب کنید"); return; }
      if (!title || !price) { alert("لطفا عنوان و قیمت را وارد کنید"); return; }
      if (subCategories.length > 0 && !subCategory) { alert("لطفا زیرمجموعه را انتخاب کنید"); return; }
      
      setIsSubmitting(true);
      const fullLocation = district ? `${province} - ${district}` : province;

      const adData = {
          title, category, subCategory, price, location: fullLocation,
          latitude: coords?.lat, longitude: coords?.lng,
          description, imageUrls: images, dynamicFields: dynamicValues,
          condition, isNegotiable, deliveryAvailable
      };

      let success = false;
      if (existingAd) {
          success = await azureService.updateAd(existingAd.id, adData);
          if (success) toastService.success('آگهی با موفقیت ویرایش شد و در انتظار تایید است.');
      } else {
          success = await azureService.postAd(adData);
          if (success) toastService.success('آگهی با موفقیت ثبت شد.');
      }
      
      setIsSubmitting(false);

      if (success) {
          onNavigate(Page.DASHBOARD_ADS);
      } else {
          toastService.error('خطا در ثبت اطلاعات.');
      }
  }

  // Helper to handle dynamic input changes
  const handleDynamicChange = (key: string, value: string | number) => {
      setDynamicValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 pt-6 px-4">
      <h2 className="text-2xl font-bold text-ui-text mb-6 flex items-center gap-2">
          {existingAd ? t('post_title_edit') : t('post_title')}
      </h2>
      
      {existingAd && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl mb-6 text-sm">
             <Icon name="Info" size={20} strokeWidth={1.8} className="inline-block ml-2 align-middle" />
             توجه: با ویرایش آگهی، وضعیت آن مجدداً به «در انتظار تایید» تغییر خواهد کرد.
          </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Images Section */}
        <div className="bg-ui-surface p-5 rounded-2xl border border-ui-border shadow-sm">
            <label className="block text-sm font-bold text-ui-muted mb-3">{t('post_lbl_images')} (حداکثر ۵ عکس)</label>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                <div className={`relative flex-shrink-0 w-24 h-24 bg-brand-600 rounded-xl flex flex-col items-center justify-center text-white transition-transform cursor-pointer hover:scale-105 active:scale-95 shadow-sm`}>
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handleImageUpload} 
                      accept="image/*" 
                      multiple
                      disabled={uploadingImages.length > 0}
                    />
                    {uploadingImages.length > 0 ? <Icon name="Loader2" size={32} strokeWidth={1.8} className="animate-spin" /> : <Icon name="Plus" size={32} strokeWidth={1.8} className="mb-1 text-white" />}
                    <span className="text-[10px] font-bold">{uploadingImages.length > 0 ? '...' : 'افزودن عکس'}</span>
                </div>
                {images.map((img, idx) => (
                    <div key={idx} className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-ui-border shadow-sm group">
                        <img src={img} alt="preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md opacity-90 hover:opacity-100">
                            <Icon name="X" size={12} strokeWidth={1.8} />
                        </button>
                    </div>
                ))}  
            </div>
        </div>

        {/* Basic Information */}
        <div className="bg-ui-surface p-5 rounded-2xl border border-ui-border shadow-sm space-y-5">
            <h3 className="font-bold text-ui-text border-b border-ui-border pb-2">اطلاعات پایه</h3>

            {/* Category Visual Picker */}
            <div>
                <label className="block text-xs font-bold text-ui-muted mb-2">{t('post_lbl_category')} <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                                const syntheticEvent = { target: { value: c.id } } as React.ChangeEvent<HTMLSelectElement>;
                                handleCategoryChange(syntheticEvent);
                            }}
                            className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-all ${
                                category === c.id
                                    ? 'border-brand-500 bg-brand-50 text-brand-600 shadow-sm'
                                    : 'border-ui-border bg-ui-surface2 text-ui-muted hover:border-brand-300 hover:text-brand-500'
                            }`}
                        >
                            <Icon name={c.icon as any} size={22} strokeWidth={1.8} />
                            <span className="text-[10px] font-bold leading-tight">{t(c.translationKey as keyof typeof TRANSLATIONS['fa'])}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Subcategory Pill Buttons */}
            {subCategories.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1">
                    <label className="block text-xs font-bold text-ui-muted mb-2">{t('post_lbl_subcategory')} <span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-2">
                        {subCategories.map(sub => (
                            <button
                                key={sub.id}
                                type="button"
                                onClick={() => setSubCategory(sub.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                    subCategory === sub.id
                                        ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                                        : 'bg-ui-surface2 border-ui-border text-ui-muted hover:border-brand-400 hover:text-brand-500'
                                }`}
                            >
                                {sub.name}
                            </button>
                        ))}
                    </div>
                    {subCategories.length > 0 && !subCategory && (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                            <Icon name="AlertCircle" size={12} strokeWidth={1.8} />
                            لطفاً یک زیرمجموعه انتخاب کنید
                        </p>
                    )}
                </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-ui-muted mb-1.5">{t('post_lbl_title')} <span className="text-red-500">*</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder={CATEGORY_TITLE_PLACEHOLDERS[category] || t('post_placeholder_title')} required />
            </div>

            {/* Price */}
            <div>
               <label className="block text-xs font-bold text-ui-muted mb-1.5">{category === 'services' ? t('post_lbl_salary') : t('post_lbl_price')}</label>
               <div className="relative">
                   <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full p-3 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none pl-12" placeholder="0" required />
                   <span className="absolute left-3 top-3.5 text-sm text-ui-muted font-bold">AFN</span>
               </div>
            </div>

            {/* Negotiable Toggle */}
            <div className="flex items-center justify-between bg-ui-surface2 p-3 rounded-xl border border-ui-border">
              <label className="text-sm font-bold text-ui-text flex items-center gap-2 cursor-pointer">
                <Icon name="BadgePercent" size={18} strokeWidth={1.8} className="text-brand-400" />
                {t('negotiable_label')}
              </label>
              <button
                type="button"
                onClick={() => setIsNegotiable(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isNegotiable ? 'bg-brand-500' : 'bg-ui-border'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isNegotiable ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
        </div>

        {/* Condition & Delivery */}
        <div className="bg-ui-surface p-5 rounded-2xl border border-ui-border shadow-sm space-y-5">
            <h3 className="font-bold text-ui-text border-b border-ui-border pb-2 flex items-center gap-2">
                <Icon name="Tag" size={18} strokeWidth={1.8} className="text-brand-500" />
                وضعیت و ارسال
            </h3>

            {/* Condition */}
            {category !== 'services' && (
              <div>
                <label className="block text-xs font-bold text-ui-muted mb-2">{t('condition_label')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['new', 'used', 'damaged'] as ProductCondition[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCondition(c)}
                      className={`py-2.5 text-sm font-bold rounded-xl border transition-all ${
                        condition === c
                          ? 'bg-brand-900/40 border-brand-600 text-brand-300'
                          : 'bg-ui-surface2 border-ui-border text-ui-muted hover:border-brand-700'
                      }`}
                    >
                      {t(`condition_${c}` as any)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery */}
            <div className="flex items-center justify-between bg-ui-surface2 p-3 rounded-xl border border-ui-border">
              <label className="text-sm font-bold text-ui-text flex items-center gap-2 cursor-pointer">
                <Icon name="Truck" size={18} strokeWidth={1.8} className="text-brand-400" />
                {t('delivery_label')}
              </label>
              <button
                type="button"
                onClick={() => setDeliveryAvailable(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${deliveryAvailable ? 'bg-brand-500' : 'bg-ui-border'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${deliveryAvailable ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
        </div>

        {/* Dynamic Attributes (Based on Category Config) */}
        {activeCategory?.filterConfig && activeCategory.filterConfig.length > 0 && (
            <div className="bg-ui-surface p-5 rounded-2xl border border-ui-border shadow-sm space-y-5 animate-in fade-in">
                <h3 className="font-bold text-ui-text border-b border-ui-border pb-2 flex items-center gap-2">
                    <Icon name="Info" size={18} strokeWidth={1.8} className="text-brand-500" />
                    مشخصات {t(activeCategory.translationKey as any)}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {activeCategory.filterConfig.map((field) => (
                        <div key={field.key}>
                            <label className="block text-xs font-bold text-ui-muted mb-1.5">{field.label}</label>
                            
                            {/* Select Input */}
                            {field.type === 'select' && (
                                <div className="relative">
                                    <select
                                        value={dynamicValues[field.key] || ''}
                                        onChange={(e) => handleDynamicChange(field.key, e.target.value)}
                                        className="w-full p-3 border border-ui-border rounded-xl bg-ui-surface outline-none appearance-none focus:ring-2 focus:ring-brand-500"
                                    >
                                        <option value="">انتخاب کنید...</option>
                                        {field.options?.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-3.5 text-ui-muted pointer-events-none" />
                                </div>
                            )}

                            {/* Range/Number Input */}
                            {(field.type === 'range' || field.type === 'text') && (
                                <div className="relative">
                                    <input
                                        type={field.type === 'range' ? 'number' : 'text'}
                                        value={dynamicValues[field.key] || ''}
                                        onChange={(e) => handleDynamicChange(field.key, e.target.value)}
                                        className="w-full p-3 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder={field.type === 'range' ? `مثلا: ${field.min || 0}` : 'وارد کنید...'}
                                    />
                                    {field.unit && (
                                        <span className="absolute left-3 top-3.5 text-xs text-ui-muted">{field.unit}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Location Section */}
        <div className="bg-ui-surface p-5 rounded-2xl border border-ui-border shadow-sm space-y-5">
            <h3 className="font-bold text-ui-text flex items-center gap-2 border-b border-ui-border pb-2">
                <Icon name="MapPin" size={20} strokeWidth={1.8} className="text-brand-600" />
                موقعیت مکانی
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                     <label className="block text-xs font-bold text-ui-muted mb-1.5">{t('filter_province')}</label>
                     <div className="relative">
                        <select value={province} onChange={handleProvinceChange} className="w-full p-3 border border-ui-border rounded-xl bg-ui-surface outline-none appearance-none focus:ring-2 focus:ring-brand-500" required>
                            <option value="" disabled>انتخاب کنید...</option>
                            {PROVINCES.filter(p => p.id !== 'all').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                        <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-3.5 text-ui-muted pointer-events-none" />
                     </div>
                </div>
                {availableDistricts.length > 0 && (
                    <div className="animate-in fade-in">
                        <label className="block text-xs font-bold text-ui-muted mb-1.5">ناحیه / ولسوالی</label>
                        <div className="relative">
                            <select value={district} onChange={handleDistrictChange} className="w-full p-3 border border-ui-border rounded-xl bg-ui-surface outline-none appearance-none focus:ring-2 focus:ring-brand-500">
                                <option value="">انتخاب کنید (اختیاری)</option>
                                {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-3.5 text-ui-muted pointer-events-none" />
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-bold text-ui-muted mb-2">موقعیت دقیق روی نقشه (برای مسیریابی بهتر)</label>
                <LocationPicker 
                    initialLat={mapCenter?.lat || 34.5553} 
                    initialLng={mapCenter?.lng || 69.2075} 
                    onLocationSelect={(lat, lng) => setCoords({lat, lng})}
                />
                {coords && (
                    <div className="mt-2 text-xs text-green-600 flex items-center gap-1 bg-green-50 p-2 rounded-lg w-fit">
                        <Icon name="CheckCircle" size={12} strokeWidth={1.8} />
                        موقعیت دقیق پین شد
                    </div>
                )}
            </div>
        </div>

        {/* Description Section */}
        <div className="bg-ui-surface p-5 rounded-2xl border border-ui-border shadow-sm">
          <div className="flex justify-between items-center mb-3">
             <label className="block text-sm font-bold text-ui-muted">{t('post_lbl_desc')}</label>
             <div className="flex gap-2">
                 <button 
                    type="button" 
                    onClick={startListening} 
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${isListening ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-ui-surface2 text-ui-muted hover:bg-ui-surface2'}`}
                 >
                    {isListening ? <Icon name="StopCircle" size={12} strokeWidth={1.8} /> : <Icon name="Mic" size={12} strokeWidth={1.8} />}
                    {isListening ? 'در حال ضبط...' : 'تایپ صوتی'}
                 </button>
                 <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="flex items-center gap-1.5 text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full hover:bg-brand-100 disabled:opacity-50 transition-colors">
                    {isGenerating ? <Icon name="Loader2" size={12} strokeWidth={1.8} className="animate-spin" /> : <Icon name="Sparkles" size={12} strokeWidth={1.8} />}
                    {t('post_btn_ai')}
                 </button>
             </div>
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full p-3 border border-ui-border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none leading-7" placeholder={t('post_placeholder_desc')} />
        </div>

        <button type="submit" disabled={isSubmitting || uploadingImages.length > 0} className="w-full py-4 bg-brand-600 text-white font-bold rounded-xl text-lg hover:bg-brand-700 shadow-lg shadow-brand-200 disabled:opacity-70 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]">
            {isSubmitting ? <Icon name="Loader2" size={24} strokeWidth={1.8} className="animate-spin" /> : (existingAd ? t('post_btn_update') : t('post_btn_submit'))}
        </button>
      </form>
    </div>
  );
};

export default PostAd;
