
import React, { useEffect, useState } from 'react';
import Icon from '../src/components/ui/Icon';
import { Product, Page } from '../types';
import { CATEGORIES } from '../constants';
import { azureService } from '../services/azureService';
import ProductCard from '../components/ProductCard';
import { useLanguage } from '../contexts/LanguageContext';
import { authService } from '../services/authService';
import OptimizedImage from '../components/OptimizedImage';

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
  onNavigate: (page: Page) => void;
  onSellerClick?: (sellerId: string, sellerName: string) => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, onBack, onNavigate, onSellerClick }) => {
  const { t } = useLanguage();
  const [relatedAds, setRelatedAds] = useState<Product[]>([]);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reportReason, setReportReason] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [isStartingChat, setIsStartingChat] = useState(false);

  // Handle image list fallback
  const images = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : [product.imageUrl];

  // Get Category Info for Breadcrumbs & Dynamic Field Labels
  const categoryInfo = CATEGORIES.find(c => c.id === product.category);
  const subCategoryInfo = categoryInfo?.subcategories?.find(s => s.id === product.subCategory);

  useEffect(() => {
    const fetchData = async () => {
        const fetchedRelated = await azureService.getRelatedProducts(product.category, product.id);
        setRelatedAds(fetchedRelated);
    };
    fetchData();
  }, [product]);

  // Helper to get label for dynamic field
  const getFieldLabel = (key: string) => {
      if (!categoryInfo?.filterConfig) return key;
      const config = categoryInfo.filterConfig.find(c => c.key === key);
      return config ? config.label : key;
  };

  const getFieldUnit = (key: string) => {
      if (!categoryInfo?.filterConfig) return '';
      const config = categoryInfo.filterConfig.find(c => c.key === key);
      return config?.unit ? ` ${config.unit}` : '';
  };

  const handleContact = () => {
    setShowSafetyModal(true);
  };

  const proceedToCall = () => {
      setShowSafetyModal(false);
      window.location.href = `tel:+93700000000`;
  };

  const handleWhatsApp = () => {
     setShowSafetyModal(false);
     const msg = `سلام، من این آگهی را در بازار افغان دیدم: ${product.title}`;
     const url = `https://wa.me/93700000000?text=${encodeURIComponent(msg)}`;
     window.open(url, '_blank');
  };

  const handleChat = async () => {
      const user = authService.getCurrentUser();
      if (!user) {
          onNavigate(Page.LOGIN);
          return;
      }
      setIsStartingChat(true);
      const conversationId = await azureService.startConversation(product.id);
      setIsStartingChat(false);
      
      if (conversationId) {
          onNavigate(Page.DASHBOARD_CHAT);
      }
  };

  const handleOpenMap = () => {
      if (product.latitude && product.longitude) {
          const url = `https://www.google.com/maps/search/?api=1&query=${product.latitude},${product.longitude}`;
          window.open(url, '_blank');
      }
  };

  const handleShare = () => {
      if (navigator.share) {
          navigator.share({
              title: product.title,
              text: `Check out this ${product.title} on Bazar Afghanistan`,
              url: window.location.href,
          }).catch(console.error);
      } else {
          // Copy to clipboard fallback
          navigator.clipboard.writeText(window.location.href);
          alert('لینک آگهی کپی شد!');
      }
  };

  const handleReportSubmit = async () => {
      if(!reportReason) return;
      await azureService.reportAd(product.id, reportReason);
      setShowReportModal(false);
  }

  const handleSendOffer = async () => {
      const user = authService.getCurrentUser();
      if (!user) {
          onNavigate(Page.LOGIN);
          return;
      }
      if (!offerPrice) return;

      const conversationId = await azureService.startConversation(product.id);
      if (conversationId) {
          const message = `${t('offer_sent_msg')} ${offerPrice} ${t('currency')}`;
          await azureService.sendMessage(conversationId, message);
          setShowOfferModal(false);
          setOfferPrice('');
          onNavigate(Page.DASHBOARD_CHAT);
      } else {
          alert('خطا در ارسال پیشنهاد.');
      }
  };

  const handleImageNav = (direction: 'next' | 'prev', e: React.MouseEvent) => {
      e.stopPropagation();
      if (direction === 'next') {
          setCurrentImageIndex((prev) => (prev + 1) % images.length);
      } else {
          setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
      }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-12">
      
      {/* Desktop Breadcrumbs & Back */}
      <div className="hidden md:flex max-w-6xl mx-auto py-4 px-4 items-center gap-2 text-sm text-gray-500">
          <button onClick={() => onNavigate(Page.HOME)} className="hover:text-brand-600 flex items-center gap-1">
              <Icon name="Home" size={18} strokeWidth={1.8} /> خانه
          </button>
          <Icon name="ChevronLeft" size={18} strokeWidth={1.8} />
          <button className="hover:text-brand-600">
              {categoryInfo ? t(categoryInfo.translationKey as any) : product.category}
          </button>
          {subCategoryInfo && (
              <>
                 <Icon name="ChevronLeft" size={18} strokeWidth={1.8} />
                 <span className="font-bold text-gray-800">{subCategoryInfo.name}</span>
              </>
          )}
      </div>

      <div className="max-w-6xl mx-auto md:flex gap-6 px-4">
        
        {/* Right Column: Images & Main Info */}
        <div className="md:w-2/3 space-y-4">
            
            {/* Image Gallery */}
            <div 
                className="bg-white rounded-none md:rounded-2xl shadow-sm border-b md:border border-gray-200 overflow-hidden relative group cursor-pointer -mx-4 md:mx-0"
                onClick={() => setShowImageModal(true)}
            >
                <div className="relative aspect-[4/3] md:aspect-video bg-gray-100">
                    <OptimizedImage 
                        src={images[0]} 
                        alt={product.title} 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Icon name="ZoomIn" size={40} strokeWidth={1.8} className="text-white drop-shadow-md" />
                    </div>
                    {/* Mobile Back & Share Overlays */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 md:hidden pointer-events-none">
                        <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="p-2 bg-black/30 backdrop-blur-md rounded-full text-white pointer-events-auto hover:bg-black/50">
                            <Icon name="ArrowRight" size={24} strokeWidth={1.8} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className="p-2 bg-black/30 backdrop-blur-md rounded-full text-white pointer-events-auto hover:bg-black/50">
                            <Icon name="Share2" size={24} strokeWidth={1.8} />
                        </button>
                    </div>
                    {images.length > 1 && (
                        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg z-10 font-bold flex items-center gap-1">
                            <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></span>
                            +{images.length - 1} تصویر دیگر
                        </div>
                    )}
                </div>
            </div>

            {/* Details Card */}
            <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-200">
                 {/* Title & Price */}
                 <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-gray-100 pb-4 mb-4">
                     <div>
                         <div className="flex items-center gap-2 mb-2">
                             {product.isPromoted && <span className="bg-yellow-400 text-yellow-900 text-[10px] px-2 py-0.5 rounded font-bold">ویژه</span>}
                             <span className="text-gray-500 text-xs">{product.postedDate}</span>
                         </div>
                         <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight mb-2">{product.title}</h1>
                         <div className="flex flex-wrap items-center text-gray-500 text-sm gap-2">
                            <Icon name="MapPin" size={18} strokeWidth={1.8} className="text-brand-600" />
                            {product.location}
                            
                            {/* Map Action Button */}
                            {product.latitude && product.longitude && (
                                <button 
                                    onClick={handleOpenMap}
                                    className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors mr-2"
                                >
                                    <Icon name="Navigation" size={12} strokeWidth={1.8} />
                                    مسیریابی روی نقشه
                                </button>
                            )}
                         </div>
                     </div>
                     <div className="text-2xl font-bold text-brand-600 bg-brand-50 px-4 py-2 rounded-xl border border-brand-100">
                         {product.price.toLocaleString()} {t('currency')}
                     </div>
                 </div>

                 {/* Dynamic Attributes - IMPROVED DISPLAY */}
                 {product.dynamicFields && Object.keys(product.dynamicFields).length > 0 && (
                     <>
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                            <Icon name="Info" size={18} strokeWidth={1.8} className="text-gray-400" />
                            مشخصات {categoryInfo ? t(categoryInfo.translationKey as any) : ''}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {Object.entries(product.dynamicFields).map(([key, value]) => (
                                <div key={key} className="flex flex-col bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-500 mb-1">{getFieldLabel(key)}</span> 
                                    <span className="font-bold text-gray-800 text-sm">
                                        {value} 
                                        {getFieldUnit(key)}
                                    </span>
                                </div>
                            ))}
                        </div>
                     </>
                 )}

                 {/* Description */}
                 <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-lg">
                        <Icon name="Tag" size={20} strokeWidth={1.8} className="text-gray-400" />
                        {t('post_lbl_desc')}
                    </h3>
                    <p className="text-gray-700 leading-8 whitespace-pre-line text-justify text-sm md:text-base">
                        {product.description}
                    </p>
                 </div>

                 {/* Report Button */}
                 <button 
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center gap-2 text-gray-400 text-xs hover:text-red-500 transition-colors mt-4"
                 >
                    <Icon name="Flag" size={18} strokeWidth={1.8} />
                    گزارش مشکل در آگهی
                </button>
            </div>
        </div>

        {/* Left Column: Sidebar (Seller & Actions) */}
        <div className="md:w-1/3 space-y-4">
            
            {/* Enhanced Seller Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-400 text-xs uppercase mb-4">اطلاعات فروشنده</h3>
                <div 
                    className="flex items-center gap-4 mb-6 cursor-pointer group"
                    onClick={() => onSellerClick && onSellerClick(product.userId, product.sellerName)}
                >
                    <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-brand-100 to-gray-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-xl border-2 border-white shadow-md group-hover:scale-105 transition-transform">
                            {product.sellerName.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1 border-2 border-white" title="هویت تایید شده">
                            <Icon name="ShieldCheck" size={12} strokeWidth={1.8} />
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 text-lg group-hover:text-brand-600 transition-colors">{product.sellerName}</h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <Icon name="Clock" size={12} strokeWidth={1.8} />
                            <span>عضویت: ۲ سال پیش</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-600 mt-1 font-medium">
                            <Icon name="CheckCircle" size={12} strokeWidth={1.8} />
                            <span>پاسخگویی سریع</span>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                     <button 
                        onClick={() => onSellerClick && onSellerClick(product.userId, product.sellerName)}
                        className="col-span-2 border border-brand-200 text-brand-700 font-bold py-2.5 rounded-xl hover:bg-brand-50 transition-colors text-sm"
                     >
                        مشاهده پروفایل و آگهی‌ها
                     </button>
                </div>
                
                {/* Safety Tips Mini */}
                <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-xs text-yellow-800 leading-5 flex gap-2">
                    <Icon name="AlertTriangle" size={20} strokeWidth={1.8} className="shrink-0" />
                    <p>هرگز پیش از دریافت کالا، پولی واریز نکنید. خرید حضوری امن‌ترین راه است.</p>
                </div>
            </div>
            
            {/* Desktop Sticky Actions (Hidden on Mobile) */}
            <div className="hidden md:block bg-white p-5 rounded-2xl shadow-sm border border-gray-200 sticky top-24">
                <div className="text-center mb-4">
                     <span className="text-gray-500 text-sm">قیمت کل</span>
                     <div className="text-3xl font-bold text-gray-900 mt-1">{product.price.toLocaleString()} {t('currency')}</div>
                </div>
                <div className="space-y-3">
                    <button 
                        onClick={handleContact}
                        className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 flex items-center justify-center gap-2"
                    >
                        <Icon name="Phone" size={20} strokeWidth={1.8} className="text-white" />
                        {t('call_btn')}
                    </button>
                    <button 
                        onClick={handleChat}
                        disabled={isStartingChat}
                        className="w-full bg-white border-2 border-brand-600 text-brand-600 py-3.5 rounded-xl font-bold hover:bg-brand-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isStartingChat ? <Icon name="Loader2" size={20} strokeWidth={1.8} className="animate-spin text-brand-600"/> : <Icon name="MessageCircle" size={20} strokeWidth={1.8} className="text-brand-600" />}
                        {t('chat_btn')}
                    </button>
                    <button 
                         onClick={() => setShowOfferModal(true)}
                         className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <Icon name="Tag" size={20} strokeWidth={1.8} />
                        پیشنهاد قیمت
                    </button>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center gap-6">
                    <button onClick={handleShare} className="flex flex-col items-center gap-1 text-gray-500 hover:text-brand-600 text-xs transition-colors">
                        <div className="p-2 bg-gray-50 rounded-full"><Icon name="Share2" size={20} strokeWidth={1.8}/></div>
                        اشتراک
                    </button>
                    <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-500 text-xs transition-colors">
                         {/* Favorite logic here if needed */}
                         <div className="p-2 bg-gray-50 rounded-full"><div className="w-5 h-5 border-2 border-current rounded-full"></div></div> 
                        ذخیره
                    </button>
                </div>
            </div>

        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 md:hidden z-40 flex items-center gap-3 pb-safe">
           <div className="flex-1">
               <button 
                   onClick={handleChat}
                   disabled={isStartingChat}
                   className="w-full flex flex-col items-center justify-center bg-brand-600 text-white rounded-xl py-2 disabled:opacity-70"
               >
                   {isStartingChat ? <Icon name="Loader2" size={24} strokeWidth={1.8} className="animate-spin mb-0.5 text-white" /> : <Icon name="MessageCircle" size={24} strokeWidth={1.8} className="mb-0.5 text-white" />}
                   <span className="text-[10px] font-bold">چت</span>
               </button>
           </div>
           <div className="flex-1">
               <button 
                   onClick={handleContact}
                   className="w-full flex flex-col items-center justify-center bg-green-600 text-white rounded-xl py-2"
               >
                   <Icon name="Phone" size={24} strokeWidth={1.8} className="mb-0.5 text-white" />
                   <span className="text-[10px] font-bold">تماس</span>
               </button>
           </div>
           <div className="flex-1">
               <button 
                   onClick={() => setShowOfferModal(true)}
                   className="w-full flex flex-col items-center justify-center bg-gray-100 text-gray-800 rounded-xl py-2"
               >
                   <Icon name="Tag" size={24} strokeWidth={1.8} className="mb-0.5" />
                   <span className="text-[10px] font-bold">پیشنهاد</span>
               </button>
           </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-gray-800">{t('report_btn')}</h3>
                     <button onClick={() => setShowReportModal(false)}><Icon name="X" size={20} strokeWidth={1.8} className="text-gray-500"/></button>
                 </div>
                 <div className="space-y-2 mb-4">
                     {['کلاهبرداری و دروغ', 'کالای ممنوعه', 'قیمت نامعقول', 'محتوای نامناسب', 'دیگر'].map(r => (
                         <label key={r} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
                             <input type="radio" name="reason" value={r} onChange={(e) => setReportReason(e.target.value)} className="text-brand-600 focus:ring-brand-500" />
                             <span className="text-sm text-gray-700">{r}</span>
                         </label>
                     ))}
                 </div>
                 <button onClick={handleReportSubmit} disabled={!reportReason} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 disabled:opacity-50">ثبت گزارش</button>
              </div>
          </div>
      )}

      {/* Safety Modal */}
      {showSafetyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 text-yellow-600 mb-3">
                      <Icon name="AlertTriangle" size={24} strokeWidth={1.8} />
                      <h3 className="font-bold text-lg">{t('safety_tips')}</h3>
                  </div>
                  <ul className="text-sm text-gray-700 space-y-2 mb-6 list-disc list-inside">
                      <li>از پرداخت بیعانه (پیش‌پرداخت) جداً خودداری کنید.</li>
                      <li>معامله را در مکان‌های عمومی و امن انجام دهید.</li>
                      <li>از صحت کالا و مدارک اطمینان حاصل کنید.</li>
                  </ul>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleWhatsApp} className="flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600">
                         واتساپ
                      </button>
                      <button onClick={proceedToCall} className="flex items-center justify-center gap-2 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300">
                         تماس تلفنی
                      </button>
                  </div>
                  <button onClick={() => setShowSafetyModal(false)} className="w-full mt-3 text-gray-400 text-sm py-2">
                      {t('cancel')}
                  </button>
              </div>
          </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800">{t('offer_modal_title')}</h3>
                      <button onClick={() => setShowOfferModal(false)}><Icon name="X" size={20} strokeWidth={1.8} className="text-gray-500"/></button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{t('offer_modal_desc')}</p>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('offer_input_label')}</label>
                  <input 
                      type="number" 
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none mb-6 text-center text-lg font-bold"
                      placeholder={product.price.toString()}
                      autoFocus
                  />
                  <button 
                      onClick={handleSendOffer}
                      disabled={!offerPrice}
                      className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 disabled:opacity-50"
                  >
                      {t('offer_send_btn')}
                  </button>
              </div>
          </div>
      )}

      {/* Image Lightbox Modal */}
      {showImageModal && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col justify-center items-center animate-in fade-in duration-300">
              <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 z-10">
                  <Icon name="X" size={24} strokeWidth={1.8} />
              </button>
              <div className="relative w-full h-full flex items-center justify-center">
                  <OptimizedImage 
                      src={images[currentImageIndex]} 
                      alt={`Image ${currentImageIndex}`} 
                      className="max-w-full max-h-full object-contain"
                  />
                  {images.length > 1 && (
                      <>
                          <button onClick={(e) => handleImageNav('next', e)} className="absolute left-4 p-3 bg-white/20 text-white rounded-full hover:bg-white/30 backdrop-blur-md">
                              <Icon name="ChevronLeft" size={32} strokeWidth={1.8} />
                          </button>
                          <button onClick={(e) => handleImageNav('prev', e)} className="absolute right-4 p-3 bg-white/20 text-white rounded-full hover:bg-white/30 backdrop-blur-md">
                              <Icon name="ChevronRight" size={32} strokeWidth={1.8} />
                          </button>
                      </>
                  )}
              </div>
              <div className="absolute bottom-8 flex gap-2 overflow-x-auto px-4 max-w-full no-scrollbar">
                  {images.map((img, i) => (
                      <button 
                        key={i} 
                        onClick={() => setCurrentImageIndex(i)}
                        className={`w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 ${currentImageIndex === i ? 'border-brand-500' : 'border-transparent opacity-60'}`}
                      >
                          <OptimizedImage src={img} alt="thumb" className="w-full h-full object-cover" />
                      </button>
                  ))}
              </div>
          </div>
      )}

      {/* Related Products Section */}
      {relatedAds.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 mt-12 mb-8">
              <h3 className="font-bold text-xl text-gray-800 mb-6 pr-1 border-r-4 border-brand-500">{t('related_ads')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {relatedAds.map(ad => (
                      <ProductCard key={ad.id} product={ad} onClick={() => {
                          window.scrollTo(0,0);
                          // In real app, proper routing. Here forcing reload to simulate nav.
                          setTimeout(() => window.location.reload(), 100); 
                      }} />
                  ))}
              </div>
          </div>
      )}

    </div>
  );
};

export default ProductDetail;
