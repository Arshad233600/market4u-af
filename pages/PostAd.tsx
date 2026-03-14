
import React, { useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { CATEGORIES, PROVINCES, DISTRICTS, DISTRICT_LOCATIONS } from '../constants';
import { generateAdDescription } from '../services/geminiService';
import { azureService } from '../services/azureService';
import { AuthError, ApiError } from '../services/apiClient';
import { authService } from '../services/authService';
import { Page, Product, ProductCondition } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { TRANSLATIONS } from '../translations';
import LocationPicker from '../components/LocationPicker';
import { toastService } from '../services/toastService';

/**
 * Map an API error message (English or Persian) to a user-friendly Persian string.
 * Categories: validation (400), rate-limit (429), service-unavailable (503),
 *             server/db (500), network, generic.
 */
function resolveAdPostError(apiMsg?: string): string {
  if (!apiMsg) return 'خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید.';
  // Already a Persian message from the backend (e.g. rate-limit, 503) — show it directly.
  if (/[\u0600-\u06FF]/.test(apiMsg)) return apiMsg;
  // Network / offline
  if (/Failed to fetch|NetworkError|Network request failed/i.test(apiMsg))
    return 'خطای اتصال به سرور. لطفاً اینترنت خود را بررسی کنید.';
  // Validation / missing fields
  if (/Missing required|required fields|Invalid.*body/i.test(apiMsg))
    return 'اطلاعات ناقص است. لطفاً عنوان و قیمت را وارد کنید.';
  // Rate-limit (English fallback)
  if (/API Error: 429/i.test(apiMsg))
    return 'لطفاً کمی صبر کنید و دوباره تلاش کنید.';
  // Other client errors (4xx)
  if (/API Error: 4/i.test(apiMsg))
    return 'اطلاعات نادرست است. لطفاً بررسی کنید.';
  // Server / database errors (5xx)
  if (/Database error|API Error: 5|constraint|SQL/i.test(apiMsg))
    return 'خطای سرور. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.';
  return 'خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید.';
}

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

  // Inline field validation errors
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; price?: string; province?: string }>({});

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
      if (fieldErrors.title) setFieldErrors(prev => ({ ...prev, title: undefined }));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPrice(e.target.value);
      if (fieldErrors.price) setFieldErrors(prev => ({ ...prev, price: undefined }));
  };
  
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
      if (fieldErrors.province) setFieldErrors(prev => ({ ...prev, province: undefined }));
      
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
      // Pre-upload auth check: block upload if no valid token is available.
      if (!authService.getToken()) {
          toastService.error('لطفاً ابتدا وارد شوید تا بتوانید عکس آپلود کنید.');
          authService.onAuthInvalid('no_token_pre_upload');
          // Navigate to POST_AD so the App.tsx auth guard sets pendingPage=POST_AD
          // and redirects to LOGIN; after login the user returns to this page.
          onNavigate(Page.POST_AD);
          return;
      }
      // Block upload when token has expired client-side.
      // Attempt a silent refresh first — the server may still accept the token
      // within its refresh grace window. Only clear the session if the refresh fails.
      if (authService.isTokenExpired()) {
          const refreshed = await authService.refreshToken();
          if (!refreshed) {
              toastService.error('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
              authService.onAuthInvalid('token_expired_pre_upload');
              onNavigate(Page.POST_AD);
              return;
          }
      }

      const files: File[] = Array.from(e.target.files);
      const remainingSlots = 4 - images.length;
      const filesToUpload = files.slice(0, remainingSlots);

      if (filesToUpload.length === 0) {
          toastService.error('حداکثر ۴ عکس می‌توانید انتخاب کنید.');
          return;
      }

      setUploadingImages(prev => [...prev, ...new Array(filesToUpload.length).fill(true)]);

      try {
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
      } catch (err) {
          setUploadingImages(prev => prev.slice(0, prev.length - filesToUpload.length));
          if (err instanceof AuthError) {
              const reason = err.reason ?? 'upload_auth_error';
              if (reason === 'storage_blocked') {
                  toastService.error('مرورگر شما دسترسی به حافظه را مسدود کرده. لطفاً کوکی‌ها را فعال کنید و دوباره تلاش کنید.');
              } else if (reason === 'invalid_token') {
                  // apiClient already attempted a silent refresh before throwing.
                  // Do NOT logout immediately — show an error so the user can
                  // choose to re-authenticate rather than being silently logged out.
                  toastService.error('خطای احراز هویت. لطفاً دوباره وارد شوید.');
                  onNavigate(Page.POST_AD);
              } else {
                  authService.onAuthInvalid(reason);
                  toastService.error('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
                  // Navigate to POST_AD so the App.tsx auth guard sets pendingPage=POST_AD
                  // and redirects to LOGIN; after login the user returns to this page.
                  onNavigate(Page.POST_AD);
              }
          } else if (err instanceof ApiError && err.status === 503) {
              // Server configuration error — distinguish between "not configured" and "unavailable".
              // STORAGE_NOT_CONFIGURED: AZURE_STORAGE_CONNECTION_STRING is missing in Azure settings.
              // STORAGE_UNAVAILABLE: connection string is set but the storage service is unreachable.
              // In both cases retrying will not help — instruct the user to contact support.
              if (err.category === 'STORAGE_UNAVAILABLE') {
                  toastService.error('سرویس ذخیره‌سازی تصویر در دسترس نیست. لطفاً دقایقی دیگر دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.');
              } else {
                  toastService.error('آپلود تصویر پیکربندی نشده است. لطفاً با پشتیبانی تماس بگیرید.');
              }
          } else {
              toastService.error('خطا در آپلود عکس. لطفاً دوباره تلاش کنید.');
          }
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

      // Inline field validation: highlight missing required fields instead of alert().
      const errors: { title?: string; price?: string; province?: string } = {};
      if (!province) errors.province = 'لطفاً ولایت را انتخاب کنید';
      if (!title.trim()) errors.title = 'لطفاً عنوان آگهی را وارد کنید';
      if (!price || isNaN(Number(price)) || Number(price) <= 0) errors.price = 'لطفاً یک قیمت معتبر (عدد مثبت) وارد کنید';
      if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          return;
      }
      setFieldErrors({});

      // Upfront token check: block submission if no token is available.
      if (!authService.getToken()) {
          toastService.error('لطفاً ابتدا وارد شوید تا بتوانید آگهی ثبت کنید.');
          authService.onAuthInvalid('no_token_pre_submit');
          onNavigate(Page.POST_AD);
          return;
      }
      // Block submission when token has expired client-side.
      // Attempt a silent refresh first — the server may still accept the token
      // within its refresh grace window. Only clear the session if the refresh fails.
      if (authService.isTokenExpired()) {
          const refreshed = await authService.refreshToken();
          if (!refreshed) {
              toastService.error('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
              authService.onAuthInvalid('token_expired_pre_submit');
              onNavigate(Page.POST_AD);
              return;
          }
      }

      setIsSubmitting(true);
      const fullLocation = district ? `${province} - ${district}` : province;

      const adData = {
          title, category, subCategory, price, location: fullLocation,
          latitude: coords?.lat, longitude: coords?.lng,
          description, imageUrls: images, dynamicFields: dynamicValues,
          condition, isNegotiable, deliveryAvailable
      };

      try {
          // Monthly ad limit: regular (non-admin) users may post at most 5 ads per calendar month.
          if (!existingAd) {
              const currentUser = authService.getCurrentUser();
              if (currentUser && currentUser.role !== 'ADMIN') {
                  const myAds = await azureService.getMyAds();
                  const now = new Date();
                  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                  const monthlyAds = myAds.filter((ad) => new Date(ad.postedDate) >= startOfMonth);
                  if (monthlyAds.length >= 5) {
                      toastService.warning('شما به حداکثر ۵ آگهی در ماه رسیده‌اید.');
                      return;
                  }
              }
          }

          let success = false;
          if (existingAd) {
              success = await azureService.updateAd(existingAd.id, adData);
              if (success) toastService.success('آگهی با موفقیت ویرایش شد.');
          } else {
              success = await azureService.postAd(adData);
              if (success) toastService.success('آگهی با موفقیت ثبت شد.');
          }

          if (success) {
              onNavigate(authService.getCurrentUser() ? Page.DASHBOARD_ADS : Page.HOME);
          } else {
              // success===false without a thrown error only occurs in the mock
              // implementation (e.g. updateAd when the ad is not found locally).
              // No specific API message is available here, so use the generic fallback.
              toastService.error(resolveAdPostError());
          }
      } catch (err) {
          // AuthError: the server rejected the token (missing, expired, or invalid).
          if (err instanceof AuthError) {
              const reason = err.reason ?? 'auth_error_post_ad';
              // 'storage_blocked' means the browser's privacy settings (e.g. Safari ITP /
              // private browsing) prevented reading the token from storage.  The user IS
              // authenticated — the session data just cannot be retrieved right now.
              // Do NOT clear the session; show a storage-specific message instead.
              if (reason === 'storage_blocked') {
                  toastService.error('مرورگر شما دسترسی به حافظه را مسدود کرده. لطفاً کوکی‌ها را فعال کنید و دوباره تلاش کنید.');
                  onNavigate(Page.POST_AD);
              } else if (reason === 'invalid_token') {
                  // apiClient already attempted a silent refresh before throwing.
                  // Do NOT logout immediately — show an error so the user can
                  // choose to re-authenticate rather than being silently logged out.
                  toastService.error('خطای احراز هویت. لطفاً دوباره وارد شوید.');
                  onNavigate(Page.POST_AD);
              } else {
                  // Clear the session for all other auth failures (expired, missing, etc.).
                  authService.onAuthInvalid(reason);
                  toastService.error('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
                  onNavigate(Page.POST_AD);
              }
          } else if (err instanceof ApiError) {
              const cat = err.category?.toUpperCase();
              const reqId = err.requestId ?? null;
              if (!reqId) {
                  console.warn('[PostAd] error response missing requestId — full error:', err);
              }
              if (cat === 'VALIDATION' || cat === 'RATE_LIMIT') {
                  // Show the user-friendly message from the API directly for both
                  // validation errors (400) and rate-limit responses (429).
                  toastService.error(resolveAdPostError(err.message));
              } else if (cat === 'DB_UNAVAILABLE' || cat === 'STORAGE_ERROR') {
                  toastService.error('سرویس موقتاً در دسترس نیست. لطفاً دقایقی دیگر دوباره تلاش کنید.');
              } else if (err.status === 503) {
                  // Server configuration error (e.g. AUTH_SECRET not set in Azure).
                  // Not a user error — show a server-side error message.
                  toastService.error('خطای پیکربندی سرور. لطفاً با پشتیبانی تماس بگیرید.');
              } else {
                  // UNEXPECTED or unknown: show full requestId and instruct contact support
                  const msg = 'خطای سرور. برای پیگیری با پشتیبانی تماس بگیرید.';
                  if (reqId) {
                      toastService.errorWithId(msg, reqId);
                  } else {
                      toastService.error(`${msg} [ID: missing]`);
                  }
              }
          } else {
              toastService.error(resolveAdPostError(err instanceof Error ? err.message : undefined));
          }
      } finally {
          setIsSubmitting(false);
      }
  }

  // Helper to handle dynamic input changes
  const handleDynamicChange = (key: string, value: string | number) => {
      setDynamicValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 pt-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate(existingAd ? Page.DASHBOARD_ADS : Page.HOME)}
          className="p-2 rounded-xl bg-ui-surface2 text-ui-muted hover:text-ui-text hover:bg-ui-surface3 border border-ui-border transition-colors"
          aria-label="بازگشت"
        >
          <Icon name="ArrowRight" size={20} strokeWidth={2} />
        </button>
        <h2 className="text-2xl font-bold text-ui-text flex items-center gap-2">
            {existingAd ? t('post_title_edit') : t('post_title')}
        </h2>
      </div>
      
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Images Section */}
        <div className="bg-ui-surface p-5 rounded-2xl border border-ui-border shadow-sm">
            <label className="block text-sm font-bold text-ui-muted mb-3">{t('post_lbl_images')} (حداکثر ۴ عکس)</label>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                <div className={`relative flex-shrink-0 w-24 h-24 rounded-xl flex flex-col items-center justify-center text-white transition-transform shadow-sm ${images.length >= 4 || uploadingImages.length > 0 ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-brand-600 cursor-pointer hover:scale-105 active:scale-95'}`}>
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handleImageUpload} 
                      accept="image/*" 
                      multiple
                      disabled={uploadingImages.length > 0 || images.length >= 4}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Category */}
                <div>
                    <label className="block text-xs font-bold text-ui-muted mb-1.5">{t('post_lbl_category')}</label>
                    <div className="relative">
                        <select value={category} onChange={handleCategoryChange} className="w-full p-3 border border-ui-border rounded-xl bg-ui-surface outline-none appearance-none focus:ring-2 focus:ring-brand-500">
                            {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{t(c.translationKey as keyof typeof TRANSLATIONS['fa'])}</option>)}
                        </select>
                        <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-3.5 text-ui-muted pointer-events-none" />
                    </div>
                </div>

                {/* Subcategory */}
                {subCategories.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-1">
                        <label className="block text-xs font-bold text-ui-muted mb-1.5">{t('post_lbl_subcategory')}</label>
                        <div className="relative">
                            <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} className="w-full p-3 border border-ui-border rounded-xl bg-ui-surface outline-none appearance-none focus:ring-2 focus:ring-brand-500" required>
                                <option value="" disabled>انتخاب کنید...</option>
                                {subCategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                            </select>
                            <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-3.5 text-ui-muted pointer-events-none" />
                        </div>
                    </div>
                )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-ui-muted mb-1.5">{t('post_lbl_title')}</label>
              <input type="text" value={title} onChange={handleTitleChange} className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none ${fieldErrors.title ? 'border-red-500 ring-1 ring-red-400' : 'border-ui-border'}`} placeholder={t('post_placeholder_title')} required />
              {fieldErrors.title && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{fieldErrors.title}</p>}
            </div>

            {/* Price */}
            <div>
               <label className="block text-xs font-bold text-ui-muted mb-1.5">{category === 'jobs' ? t('post_lbl_salary') : t('post_lbl_price')}</label>
               <div className="relative">
                   <input type="number" value={price} onChange={handlePriceChange} className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none pl-12 ${fieldErrors.price ? 'border-red-500 ring-1 ring-red-400' : 'border-ui-border'}`} placeholder="0" required />
                   <span className="absolute left-3 top-3.5 text-sm text-ui-muted font-bold">AFN</span>
               </div>
               {fieldErrors.price && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{fieldErrors.price}</p>}
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
            {category !== 'jobs' && category !== 'services' && (
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
                        <select value={province} onChange={handleProvinceChange} className={`w-full p-3 border rounded-xl bg-ui-surface outline-none appearance-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.province ? 'border-red-500 ring-1 ring-red-400' : 'border-ui-border'}`} required>
                            <option value="" disabled>انتخاب کنید...</option>
                            {PROVINCES.filter(p => p.id !== 'all').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                        <Icon name="ChevronDown" size={18} strokeWidth={1.8} className="absolute left-3 top-3.5 text-ui-muted pointer-events-none" />
                     </div>
                     {fieldErrors.province && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{fieldErrors.province}</p>}
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
