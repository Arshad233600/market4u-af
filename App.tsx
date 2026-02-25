import React, { useState, Suspense, lazy, useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';
import InstallPrompt from './components/InstallPrompt';
import UpdateBanner from './components/UpdateBanner';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import ToastContainer from './components/ToastContainer';
import OfflineBanner from './components/OfflineBanner';
import { Page, Product, User } from './types';
import { authService } from './services/authService';
import { LanguageProvider } from './contexts/LanguageContext';
import { errorLogger } from './utils/errorLogger';
import { azureService } from './services/azureService';
import { toastService } from './services/toastService';

// Lazy Load Pages
const PostAd = lazy(() => import('./pages/PostAd'));
const DashboardLayout = lazy(() => import('./pages/DashboardLayout'));
const Overview = lazy(() => import('./pages/Dashboard/Overview'));
const MyAds = lazy(() => import('./pages/Dashboard/MyAds'));
const WalletPage = lazy(() => import('./pages/Dashboard/Wallet'));
const Messages = lazy(() => import('./pages/Dashboard/Messages'));
const Settings = lazy(() => import('./pages/Dashboard/Settings'));
const Favorites = lazy(() => import('./pages/Favorites'));
const SellerProfile = lazy(() => import('./pages/SellerProfile'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const AdminPanel = lazy(() => import('./pages/Admin/AdminPanel'));
const AboutUs = lazy(() => import('./pages/Static/AboutUs'));
const Terms = lazy(() => import('./pages/Static/Terms'));
const PrivacyPolicy = lazy(() => import('./pages/Static/PrivacyPolicy'));
const SafetyTips = lazy(() => import('./pages/Static/SafetyTips'));
const ContactUs = lazy(() => import('./pages/Static/ContactUs'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Profile = lazy(() => import('./pages/Profile'));

// Full Screen Loader for Suspense fallback
const PageLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-ui-muted">
    <div className="relative mb-4">
      <div className="w-16 h-16 border-4 border-brand-200/30 border-t-brand-500 rounded-full animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-brand-300">
        M4U
      </div>
    </div>
    <span className="text-sm font-medium animate-pulse">در حال بارگذاری...</span>
  </div>
);

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page | 'ADMIN_PANEL'>(Page.HOME);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [currentSeller, setCurrentSeller] = useState<{ id: string; name: string } | null>(null);

  // Initialize error logger on app start
  useEffect(() => {
    console.log('[App] Error logger initialized, version:', errorLogger.getVersion());
  }, []);

  // Deep-link: navigate to product when ?product=<id> is present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');
    if (productId) {
      // Clean the query param from the URL so it doesn't persist on remount
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      azureService.getProductById(productId).then((product) => {
        if (product) {
          setSelectedProduct(product);
          setCurrentPage(Page.DETAIL);
        } else {
          toastService.error('آگهی مورد نظر یافت نشد یا حذف شده است.');
        }
      }).catch(() => {
        toastService.error('خطا در بارگذاری آگهی. لطفاً دوباره تلاش کنید.');
      });
    }
  }, []);

  const navigateTo = (page: Page | 'ADMIN_PANEL') => {
    if (
      (page === Page.POST_AD ||
        page === Page.EDIT_AD ||
        (typeof page === 'string' && page.startsWith('dashboard')) ||
        page === Page.PROFILE ||
        page === Page.FAVORITES) &&
      !authService.getCurrentUser()
    ) {
      setCurrentPage(Page.LOGIN);
      return;
    }

    // Admin Guard
    if (page === 'ADMIN_PANEL') {
      if (user?.role !== 'ADMIN') {
        toastService.error('شما اجازه دسترسی به این بخش را ندارید.');
        return;
      }
    }

    if (page === Page.POST_AD) setProductToEdit(null);
    if (page !== Page.EDIT_AD && currentPage === Page.EDIT_AD) setProductToEdit(null);

    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const handleEditAd = (product: Product) => {
    setProductToEdit(product);
    setCurrentPage(Page.EDIT_AD);
    window.scrollTo(0, 0);
  };

  const handleLoginSuccess = () => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    navigateTo(Page.DASHBOARD);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    navigateTo(Page.HOME);
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setCurrentPage(Page.DETAIL);
    window.scrollTo(0, 0);
  };

  const handleBackFromDetail = () => {
    setSelectedProduct(null);
    setCurrentPage(Page.HOME);
  };

  const handleSellerClick = (sellerId: string, sellerName: string) => {
    setCurrentSeller({ id: sellerId, name: sellerName });
    setCurrentPage(Page.SELLER_PROFILE);
    window.scrollTo(0, 0);
  };

  const renderContent = () => {
    if (currentPage === 'ADMIN_PANEL') return <AdminPanel onNavigate={navigateTo as any} />;

    if (currentPage === Page.LOGIN) return <Login onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />;
    if (currentPage === Page.REGISTER) return <Register onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />;

    // Static Pages
    if (currentPage === Page.ABOUT_US) return <AboutUs onNavigate={navigateTo} />;
    if (currentPage === Page.TERMS) return <Terms />;
    if (currentPage === Page.PRIVACY) return <PrivacyPolicy />;
    if (currentPage === Page.SAFETY) return <SafetyTips />;
    if (currentPage === Page.CONTACT_US) return <ContactUs />;
    if (currentPage === Page.NOT_FOUND) return <NotFound onNavigate={navigateTo} />;

    if (typeof currentPage === 'string' && currentPage.startsWith('dashboard')) {
      if (!user) return <Login onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />;

      let DashboardContent;
      switch (currentPage) {
        case Page.DASHBOARD:
          DashboardContent = <Overview onNavigate={navigateTo} />;
          break;
        case Page.DASHBOARD_ADS:
          DashboardContent = <MyAds onEdit={handleEditAd} />;
          break;
        case Page.DASHBOARD_WALLET:
          DashboardContent = <WalletPage />;
          break;
        case Page.DASHBOARD_CHAT:
          DashboardContent = <Messages />;
          break;
        case Page.DASHBOARD_SETTINGS:
          DashboardContent = <Settings />;
          break;
        case Page.DASHBOARD_FAVORITES:
          return (
            <DashboardLayout activePage={currentPage as Page} onNavigate={navigateTo} onLogout={handleLogout} user={user}>
              <Favorites onProductClick={handleProductClick} onBack={() => navigateTo(Page.DASHBOARD)} />
            </DashboardLayout>
          );
        default:
          DashboardContent = <Overview onNavigate={navigateTo} />;
      }

      return (
        <DashboardLayout activePage={currentPage as Page} onNavigate={navigateTo} onLogout={handleLogout} user={user}>
          {DashboardContent}
        </DashboardLayout>
      );
    }

    switch (currentPage) {
      case Page.HOME:
        return <Home onProductClick={handleProductClick} searchQuery={searchQuery} />;
      case Page.DETAIL:
        return selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            onBack={handleBackFromDetail}
            onNavigate={navigateTo}
            onSellerClick={handleSellerClick}
            onProductClick={handleProductClick}
          />
        ) : (
          <Home onProductClick={handleProductClick} searchQuery={searchQuery} />
        );
      case Page.POST_AD:
        return user ? <PostAd onNavigate={navigateTo} /> : <Login onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />;
      case Page.EDIT_AD:
        return user && productToEdit ? (
          <PostAd onNavigate={navigateTo} existingAd={productToEdit} />
        ) : (
          <NotFound onNavigate={navigateTo} />
        );
      case Page.PROFILE:
        return user ? (
          <DashboardLayout activePage={Page.DASHBOARD} onNavigate={navigateTo} onLogout={handleLogout} user={user}>
            <Profile user={user} onNavigate={navigateTo} onLogout={handleLogout} />
          </DashboardLayout>
        ) : (
          <Login onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />
        );
      case Page.FAVORITES:
        return <Favorites onProductClick={handleProductClick} onBack={() => navigateTo(Page.PROFILE)} />;
      case Page.SELLER_PROFILE:
        return currentSeller ? (
          <SellerProfile
            sellerId={currentSeller.id}
            sellerName={currentSeller.name}
            onBack={() => navigateTo(Page.HOME)}
            onNavigate={navigateTo}
            onProductClick={handleProductClick}
          />
        ) : (
          <Home onProductClick={handleProductClick} searchQuery={searchQuery} />
        );
      default:
        return <NotFound onNavigate={navigateTo} />;
    }
  };

  const isFullScreenPage = currentPage === Page.LOGIN || currentPage === Page.REGISTER || currentPage === 'ADMIN_PANEL';
  const isDashboard = (typeof currentPage === 'string' && currentPage.startsWith('dashboard')) || currentPage === Page.PROFILE;
  const isDetail = currentPage === Page.DETAIL || currentPage === Page.SELLER_PROFILE;
  const showFooter = !isFullScreenPage && !isDashboard && !isDetail && currentPage !== Page.DASHBOARD_CHAT;

  return (
    <div className="min-h-screen bg-ui-bg text-ui-text font-sans text-right flex flex-col" dir="rtl">
      {/* Overlays / Global */}
      <ToastContainer />
      <OfflineBanner />
      <CookieBanner />
      <InstallPrompt />

      {/* Header */}
      {!isDashboard && !isDetail && currentPage !== Page.FAVORITES && !isFullScreenPage && (
        <div className="sticky top-0 z-40">
          {/* یک پوسته برای اینکه Header هم با theme همخوان شود حتی اگر خود Header هنوز کلاس‌های قدیمی دارد */}
          <div className="bg-ui-surface/90 backdrop-blur border-b border-ui-border shadow-soft">
            <Header
              onSearch={setSearchQuery}
              onNavigate={navigateTo as any}
              user={user}
              onRequestLocation={() => {
                if (currentPage !== Page.HOME) navigateTo(Page.HOME);
              }}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="w-full flex-1">
        {/* Container سراسری؛ اگر بعضی صفحات تو خودشون container دارند و بهم ریخت، این div را حذف کن */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Suspense fallback={<PageLoader />}>{renderContent()}</Suspense>
        </div>
      </main>

      {/* Footer */}
      {showFooter && (
        <div className="border-t border-ui-border bg-ui-surface">
          <Footer onNavigate={navigateTo} />
        </div>
      )}

      {/* BottomNav */}
      {!isDashboard && !isDetail && currentPage !== Page.FAVORITES && !isFullScreenPage && (
        <div className="sticky bottom-0 z-40 border-t border-ui-border bg-ui-surface/95 backdrop-blur">
          <BottomNav activePage={currentPage as Page} onNavigate={navigateTo} />
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <LanguageProvider>
        <UpdateBanner />
        <AppContent />
      </LanguageProvider>
    </HashRouter>
  );
};

export default App;
