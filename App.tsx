import React, { useState, Suspense, lazy, useEffect, useRef } from 'react';
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
import { USE_MOCK_DATA } from './config';
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
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
    <div className="relative">
      <div className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow-lg animate-float">
        <span className="text-white font-black text-sm tracking-tight">M4U</span>
      </div>
      <div className="absolute -inset-2 rounded-3xl border-2 border-brand-500/30 animate-ping" />
    </div>
    <span className="text-sm font-medium text-ui-muted animate-pulse">در حال بارگذاری...</span>
  </div>
);

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page | 'ADMIN_PANEL'>(Page.HOME);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<User | null>(() => {
    // In production mode, proactively clear a stored but expired token on startup
    // so the app does not initialize with a stale session and make API calls that
    // will fail with 401. Skip in mock mode to preserve ephemeral demo sessions.
    if (!USE_MOCK_DATA) {
      const token = authService.getToken();
      if (token && authService.isTokenExpired()) {
        authService.onAuthInvalid('token_expired_on_startup');
        return null;
      }
    }
    return authService.getCurrentUser();
  });
  const [pendingPage, setPendingPage] = useState<Page | null>(null);
  const [currentSeller, setCurrentSeller] = useState<{ id: string; name: string } | null>(null);
  const [currentLocationName, setCurrentLocationName] = useState<string>('کل افغانستان');

  // Ref so the auth-change handler (registered once on mount) can read the current page
  // without a stale closure.
  const currentPageRef = useRef<Page | 'ADMIN_PANEL'>(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Navigation history stack for back-button support across all pages.
  const pageHistoryRef = useRef<(Page | 'ADMIN_PANEL')[]>([]);

  const pushHistory = () => {
    pageHistoryRef.current = [...pageHistoryRef.current, currentPageRef.current];
  };

  const goBack = () => {
    const history = pageHistoryRef.current;
    if (history.length > 0) {
      const prevPage = history[history.length - 1];
      pageHistoryRef.current = history.slice(0, -1);
      setCurrentPage(prevPage);
      window.scrollTo(0, 0);
    } else {
      setCurrentPage(Page.HOME);
      window.scrollTo(0, 0);
    }
  };

  // Initialize error logger on app start
  useEffect(() => {
    console.log('[App] Error logger initialized, version:', errorLogger.getVersion());
  }, []);

  // Sync user state whenever auth-change fires (e.g. 401 forces logout, cross-tab, PWA reload)
  useEffect(() => {
    const handleAuthChange = () => {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        // Session expired or forced logout – remember the current dashboard page so the user
        // is sent back there after re-login (e.g. back to chat after token refresh).
        const page = currentPageRef.current;
        if (typeof page === 'string' && page.startsWith('dashboard')) {
          setPendingPage(page as Page);
        }
      }
      setUser(currentUser);
      // Protected pages (dashboard, profile, etc.) already show the Login form via the
      // renderContent guard (`if (!user) return <Login …>`), so no explicit page redirect
      // is needed here. Unconditionally redirecting to Page.LOGIN would prevent unauthenticated
      // users from browsing public pages and would also log out users on every page refresh.
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
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
      (page === Page.EDIT_AD ||
        page === Page.POST_AD ||
        (typeof page === 'string' && page.startsWith('dashboard')) ||
        page === Page.PROFILE ||
        page === Page.FAVORITES) &&
      !authService.getCurrentUser()
    ) {
      setPendingPage(page);
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

    // Push current page to history before navigating forward.
    pushHistory();

    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const handleEditAd = (product: Product) => {
    pushHistory();
    setProductToEdit(product);
    setCurrentPage(Page.EDIT_AD);
    window.scrollTo(0, 0);
  };

  const handleLoginSuccess = () => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    // Default to HOME (not DASHBOARD) so that a 401-triggered logout doesn't
    // send the user straight back to a protected page that will fail again.
    const destination = pendingPage || Page.HOME;
    setPendingPage(null);
    navigateTo(destination);
  };

  const handleLogout = () => {
    pageHistoryRef.current = [];
    authService.logout();
    setUser(null);
    setCurrentPage(Page.HOME);
    window.scrollTo(0, 0);
  };

  const handleProductClick = (product: Product) => {
    pushHistory();
    setSelectedProduct(product);
    setCurrentPage(Page.DETAIL);
    window.scrollTo(0, 0);
  };

  const handleBackFromDetail = () => {
    setSelectedProduct(null);
    goBack();
  };

  const handleSellerClick = (sellerId: string, sellerName: string) => {
    pushHistory();
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
    if (currentPage === Page.TERMS) return <Terms onNavigate={navigateTo} />;
    if (currentPage === Page.PRIVACY) return <PrivacyPolicy onNavigate={navigateTo} />;
    if (currentPage === Page.SAFETY) return <SafetyTips onNavigate={navigateTo} />;
    if (currentPage === Page.CONTACT_US) return <ContactUs onNavigate={navigateTo} />;
    if (currentPage === Page.NOT_FOUND) return <NotFound onNavigate={navigateTo} />;

    if (typeof currentPage === 'string' && currentPage.startsWith('dashboard')) {
      if (!user || authService.isTokenExpired()) return <Login onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />;

      let DashboardContent;
      switch (currentPage) {
        case Page.DASHBOARD:
          DashboardContent = <Overview onNavigate={navigateTo} onLogout={handleLogout} />;
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
            <DashboardLayout activePage={currentPage as Page} onNavigate={navigateTo} onBack={goBack} onLogout={handleLogout} user={user}>
              <Favorites onProductClick={handleProductClick} onBack={goBack} />
            </DashboardLayout>
          );
        default:
          DashboardContent = <Overview onNavigate={navigateTo} onLogout={handleLogout} />;
      }

      return (
        <DashboardLayout activePage={currentPage as Page} onNavigate={navigateTo} onBack={goBack} onLogout={handleLogout} user={user}>
          {DashboardContent}
        </DashboardLayout>
      );
    }

    switch (currentPage) {
      case Page.HOME:
        return <Home onProductClick={handleProductClick} searchQuery={searchQuery} onNavigate={navigateTo as any} onLocationChange={setCurrentLocationName} />;
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
          <Home onProductClick={handleProductClick} searchQuery={searchQuery} onNavigate={navigateTo as any} onLocationChange={setCurrentLocationName} />
        );
      case Page.POST_AD:
        return user ? (
          <PostAd onNavigate={navigateTo} />
        ) : (
          <Login onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />
        );
      case Page.EDIT_AD:
        return user && productToEdit ? (
          <PostAd onNavigate={navigateTo} existingAd={productToEdit} />
        ) : (
          <NotFound onNavigate={navigateTo} />
        );
      case Page.PROFILE:
        return user ? (
          <DashboardLayout activePage={Page.DASHBOARD} onNavigate={navigateTo} onBack={goBack} onLogout={handleLogout} user={user}>
            <Profile user={user} onNavigate={navigateTo} />
          </DashboardLayout>
        ) : (
          <Login onNavigate={navigateTo} onLoginSuccess={handleLoginSuccess} />
        );
      case Page.FAVORITES:
        return <Favorites onProductClick={handleProductClick} onBack={goBack} />;
      case Page.SELLER_PROFILE:
        return currentSeller ? (
          <SellerProfile
            sellerId={currentSeller.id}
            sellerName={currentSeller.name}
            onBack={goBack}
            onNavigate={navigateTo}
            onProductClick={handleProductClick}
          />
        ) : (
          <Home onProductClick={handleProductClick} searchQuery={searchQuery} onNavigate={navigateTo as any} onLocationChange={setCurrentLocationName} />
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
          <div className="glass border-b border-ui-border">
            <Header
              onSearch={setSearchQuery}
              onNavigate={navigateTo as any}
              user={user}
              currentLocationName={currentLocationName}
              onRequestLocation={() => {
                if (currentPage !== Page.HOME) navigateTo(Page.HOME);
              }}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="w-full flex-1">
        <Suspense fallback={<PageLoader />}>{renderContent()}</Suspense>
      </main>

      {/* Footer */}
      {showFooter && (
        <div className="border-t border-ui-border bg-ui-surface">
          <Footer onNavigate={navigateTo} />
        </div>
      )}

      {/* BottomNav */}
      {!isDashboard && !isDetail && currentPage !== Page.FAVORITES && !isFullScreenPage && (
        <div className="sticky bottom-0 z-40 border-t border-ui-border glass">
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
