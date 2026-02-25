
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
  onProductClick?: (product: Product) => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, onBack, onNavigate, onSellerClick, onProductClick }) => {
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
      const shareUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
      if (navigator.share) {
          navigator.share({
              title: product.title,
              text: `${product.title} - بازار افغان`,
              url: shareUrl,
          }).catch(console.error);
      } else {
          navigator.clipboard.writeText(shareUrl).then(() => {
              alert('لینک آگهی کپی شد!');
          }).catch(() => {
              alert(shareUrl);
          });
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
    <div className="min-h-screen pb-24 md:pb-12">
      
      {/* Desktop Breadcrumbs & Back */}
      <div className="hidden md:flex max-w-6xl mx-auto py-4 px-4 items-center gap-2 text-sm text-ui-muted">
          <button onClick={() => onNavigate(Page.HOME)} className="hover:text-brand-400 flex items-center gap-1">
              <Icon name="Home" size={18} strokeWidth={1.8} /> خانه
          </button>
          <Icon name="ChevronLeft" size={18} strokeWidth={1.8} />
          <button className="hover:text-brand-400">
              {categoryInfo ? t(categoryInfo.translationKey as any) : product.category}
          </button>
          {subCategoryInfo && (
              <>
                 <Icon name="ChevronLeft" size={18} strokeWidth={1.8} />
                 <span className="font-bold text-ui-text">{subCategoryInfo.name}</span>
              </>
          )}
      </div>

      <div className="max-w-6xl mx-auto md:flex gap-6 px-4">
        
        {/* Right Column: Images & Main Info */}
        <div className="md:w-2/3 space-y-4">
            
            {/* Image Gallery */}
            <div 
                className="bg-ui-surface2 rounded-none md:rounded-2xl border-b md:border border-ui-border overflow-hidden relative group cursor-pointer -mx-4 md:mx-0"
                onClick={() => setShowImageModal(true)}
            >
                <div className="relative aspect-[4/3] md:aspect-video bg-ui-surface2">
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
            <div className="bg-ui-surface p-5 md:p-8 rounded-2xl border border-ui-border">
                 {/* Title & Price */}
                 <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-ui-border pb-4 mb-4">
                     <div>
                         <div className="flex items-center gap-2 mb-2">
                             {product.isPromoted && <span className="bg-ui-warning text-black text-[10px] px-2 py-0.5 rounded font-bold">ویژه</span>}
                             <span className="text-ui-muted text-xs">{product.postedDate}</span>
                         </div>
                         <h1 className="text-xl md:text-2xl font-bold text-ui-text leading-tight mb-2">{product.title}</h1>
                         <div className="flex flex-wrap items-center text-ui-muted text-sm gap-2">
                            <Icon name="MapPin" size={18} strokeWidth={1.8} className="text-brand-400" />
                            {product.location}
                            
                            {/* Map Action Button */}
                            {product.latitude && product.longitude && (
                                <button 
                                    onClick={handleOpenMap}
                                    className="flex items-center gap-1 text-xs text-ui-info bg-ui-info/10 px-2 py-1 rounded-md hover:bg-ui-info/20 transition-colors mr-2"
                                >
                                    <Icon name="Navigation" size={12} strokeWidth={1.8} />
                                    مسیریابی روی نقشه
                                </button>
                            )}
                         </div>
                     </div>
                     <div className="text-2xl font-bold text-brand-300 bg-brand-900/40 px-4 py-2 rounded-xl border border-brand-700/40">
                         {product.price.toLocaleString()} {t('currency')}
                     </div>
                 </div>

                 {/* Dynamic Attributes */}
                 {product.dynamicFields && Object.keys(product.dynamicFields).length > 0 && (
                     <>
                        <h3 className="font-bold text-ui-muted mb-3 flex items-center gap-2 text-sm">
                            <Icon name="Info" size={18} strokeWidth={1.8} className="text-ui-muted" />
                            مشخصات {categoryInfo ? t(categoryInfo.translationKey as any) : ''}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {Object.entries(product.dynamicFields).map(([key, value]) => (
                                <div key={key} className="flex flex-col bg-ui-surface2 p-3 rounded-xl border border-ui-border">
                                    <span className="text-xs text-ui-muted mb-1">{getFieldLabel(key)}</span> 
                                    <span className="font-bold text-ui-text text-sm">
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
                    <h3 className="font-bold text-ui-text mb-3 flex items-center gap-2 text-lg">
                        <Icon name="Tag" size={20} strokeWidth={1.8} className="text-ui-muted" />
                        {t('post_lbl_desc')}
                    </h3>
                    <p className="text-ui-muted leading-8 whitespace-pre-line text-justify text-sm md:text-base">
                        {product.description}
                    </p>
                 </div>

                 {/* Report Button */}
                 <button 
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center gap-2 text-ui-muted text-xs hover:text-ui-danger transition-colors mt-4"
                 >
                    <Icon name="Flag" size={18} strokeWidth={1.8} />
                    گزارش مشکل در آگهی
                </button>
            </div>
        </div>

        {/* Left Column: Sidebar (Seller & Actions) */}
        <div className="md:w-1/3 space-y-4">
            
            {/* Enhanced Seller Card */}
            <div className="bg-ui-surface p-5 rounded-2xl border border-ui-border">
                <h3 className="font-bold text-ui-muted text-xs uppercase mb-4">اطلاعات فروشنده</h3>
                <div 
                    className="flex items-center gap-4 mb-6 cursor-pointer group"
                    onClick={() => onSellerClick && onSellerClick(product.userId, product.sellerName)}
                >
                    <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-brand-800 to-ui-surface2 rounded-full flex items-center justify-center text-brand-300 font-bold text-xl border-2 border-brand-700/40 shadow-soft group-hover:scale-105 transition-transform">
                            {product.sellerName.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-ui-success text-white rounded-full p-1 border-2 border-ui-surface" title="هویت تایید شده">
                            <Icon name="ShieldCheck" size={12} strokeWidth={1.8} />
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-ui-text text-lg group-hover:text-brand-400 transition-colors">{product.sellerName}</h4>
                        <div className="flex items-center gap-1 text-xs text-ui-muted mt-1">
                            <Icon name="Clock" size={12} strokeWidth={1.8} />
                            <span>عضویت: ۲ سال پیش</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-ui-success mt-1 font-medium">
                            <Icon name="CheckCircle" size={12} strokeWidth={1.8} />
                            <span>پاسخگویی سریع</span>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                     <button 
                        onClick={() => onSellerClick && onSellerClick(product.userId, product.sellerName)}
                        className="col-span-2 border border-brand-700/40 text-brand-400 font-bold py-2.5 rounded-xl hover:bg-brand-900/30 transition-colors text-sm"
                     >
                        مشاهده پروفایل و آگهی‌ها
                     </button>
                </div>
                
                {/* Safety Tips Mini */}
                <div className="bg-ui-warning/10 p-3 rounded-xl border border-ui-warning/20 text-xs text-ui-warning leading-5 flex gap-2">
                    <Icon name="AlertTriangle" size={20} strokeWidth={1.8} className="shrink-0" />
                    <p>هرگز پیش از دریافت کالا، پولی واریز نکنید. خرید حضوری امن‌ترین راه است.</p>
                </div>
            </div>
            
            {/* Desktop Sticky Actions */}
            <div className="hidden md:block bg-ui-surface p-5 rounded-2xl border border-ui-border sticky top-24">
                <div className="text-center mb-4">
                     <span className="text-ui-muted text-sm">قیمت کل</span>
                     <div className="text-3xl font-bold text-ui-text mt-1">{product.price.toLocaleString()} {t('currency')}</div>
                </div>
                <div className="space-y-3">
                    <button 
                        onClick={handleContact}
                        className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-500 transition-colors shadow-glow flex items-center justify-center gap-2"
                    >
                        <Icon name="Phone" size={20} strokeWidth={1.8} className="text-white" />
                        {t('call_btn')}
                    </button>
                    <button 
                        onClick={handleChat}
                        disabled={isStartingChat}
                        className="w-full bg-transparent border-2 border-brand-600 text-brand-400 py-3.5 rounded-xl font-bold hover:bg-brand-900/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isStartingChat ? <Icon name="Loader2" size={20} strokeWidth={1.8} className="animate-spin text-brand-400"/> : <Icon name="MessageCircle" size={20} strokeWidth={1.8} className="text-brand-400" />}
                        {t('chat_btn')}
                    </button>
                    <button 
                         onClick={() => setShowOfferModal(true)}
                         className="w-full bg-ui-surface2 text-ui-text py-3.5 rounded-xl font-bold hover:bg-ui-surface2/80 transition-colors flex items-center justify-center gap-2 border border-ui-border"
                    >
                        <Icon name="Tag" size={20} strokeWidth={1.8} />
                        پیشنهاد قیمت
                    </button>
                </div>
                <div className="mt-4 pt-4 border-t border-ui-border flex justify-center gap-6">
                    <button onClick={handleShare} className="flex flex-col items-center gap-1 text-ui-muted hover:text-brand-400 text-xs transition-colors">
                        <div className="p-2 bg-ui-surface2 rounded-full"><Icon name="Share2" size={20} strokeWidth={1.8}/></div>
                        اشتراک
                    </button>
                    <button className="flex flex-col items-center gap-1 text-ui-muted hover:text-ui-danger text-xs transition-colors">
                         <div className="p-2 bg-ui-surface2 rounded-full"><div className="w-5 h-5 border-2 border-current rounded-full"></div></div> 
                        ذخیره
                    </button>
                </div>
            </div>

        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-ui-surface border-t border-ui-border p-3 md:hidden z-40 flex items-center gap-3 pb-safe">
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
                   className="w-full flex flex-col items-center justify-center bg-ui-success text-white rounded-xl py-2"
               >
                   <Icon name="Phone" size={24} strokeWidth={1.8} className="mb-0.5 text-white" />
                   <span className="text-[10px] font-bold">تماس</span>
               </button>
           </div>
           <div className="flex-1">
               <button 
                   onClick={() => setShowOfferModal(true)}
                   className="w-full flex flex-col items-center justify-center bg-ui-surface2 text-ui-text rounded-xl py-2 border border-ui-border"
               >
                   <Icon name="Tag" size={24} strokeWidth={1.8} className="mb-0.5" />
                   <span className="text-[10px] font-bold">پیشنهاد</span>
               </button>
           </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
              <div className="bg-ui-surface rounded-2xl p-6 max-w-sm w-full shadow-card border border-ui-border">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-ui-text">{t('report_btn')}</h3>
                     <button onClick={() => setShowReportModal(false)}><Icon name="X" size={20} strokeWidth={1.8} className="text-ui-muted"/></button>
                 </div>
                 <div className="space-y-2 mb-4">
                     {['کلاهبرداری و دروغ', 'کالای ممنوعه', 'قیمت نامعقول', 'محتوای نامناسب', 'دیگر'].map(r => (
                         <label key={r} className="flex items-center gap-3 p-3 border border-ui-border rounded-xl cursor-pointer hover:bg-ui-surface2">
                             <input type="radio" name="reason" value={r} onChange={(e) => setReportReason(e.target.value)} className="text-brand-600 focus:ring-brand-500" />
                             <span className="text-sm text-ui-text">{r}</span>
                         </label>
                     ))}
                 </div>
                 <button onClick={handleReportSubmit} disabled={!reportReason} className="w-full bg-ui-danger text-white font-bold py-3 rounded-xl hover:bg-red-700 disabled:opacity-50">ثبت گزارش</button>
              </div>
          </div>
      )}

      {/* Safety Modal */}
      {showSafetyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="bg-ui-surface rounded-2xl p-6 max-w-sm w-full shadow-card border border-ui-border animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 text-ui-warning mb-3">
                      <Icon name="AlertTriangle" size={24} strokeWidth={1.8} />
                      <h3 className="font-bold text-lg">{t('safety_tips')}</h3>
                  </div>
                  <ul className="text-sm text-ui-muted space-y-2 mb-6 list-disc list-inside">
                      <li>از پرداخت بیعانه (پیش‌پرداخت) جداً خودداری کنید.</li>
                      <li>معامله را در مکان‌های عمومی و امن انجام دهید.</li>
                      <li>از صحت کالا و مدارک اطمینان حاصل کنید.</li>
                  </ul>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleWhatsApp} className="flex items-center justify-center gap-2 bg-ui-success text-white py-3 rounded-xl font-bold hover:opacity-90">
                         واتساپ
                      </button>
                      <button onClick={proceedToCall} className="flex items-center justify-center gap-2 bg-ui-surface2 text-ui-text py-3 rounded-xl font-bold hover:bg-ui-surface2/80 border border-ui-border">
                         تماس تلفنی
                      </button>
                  </div>
                  <button onClick={() => setShowSafetyModal(false)} className="w-full mt-3 text-ui-muted text-sm py-2">
                      {t('cancel')}
                  </button>
              </div>
          </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
              <div className="bg-ui-surface rounded-2xl p-6 max-w-sm w-full shadow-card border border-ui-border">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-ui-text">{t('offer_modal_title')}</h3>
                      <button onClick={() => setShowOfferModal(false)}><Icon name="X" size={20} strokeWidth={1.8} className="text-ui-muted"/></button>
                  </div>
                  <p className="text-sm text-ui-muted mb-4">{t('offer_modal_desc')}</p>
                  <label className="block text-sm font-medium text-ui-muted mb-2">{t('offer_input_label')}</label>
                  <input 
                      type="number" 
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      className="w-full p-3 border border-ui-border bg-ui-surface2 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none mb-6 text-center text-lg font-bold text-ui-text"
                      placeholder={product.price.toString()}
                      autoFocus
                  />
                  <button 
                      onClick={handleSendOffer}
                      disabled={!offerPrice}
                      className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-500 disabled:opacity-50"
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
              <h3 className="font-bold text-xl text-ui-text mb-6 pr-1 border-r-4 border-brand-500">{t('related_ads')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {relatedAds.map(ad => (
                      <ProductCard key={ad.id} product={ad} onClick={(p) => {
                          window.scrollTo(0, 0);
                          if (onProductClick) onProductClick(p);
                      }} />
                  ))}
              </div>
          </div>
      )}

    </div>
  );
};

export default ProductDetail;
