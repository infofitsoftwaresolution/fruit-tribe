import React, { lazy, Suspense, useMemo, useCallback, memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/app/context/AuthContext';
import { StoreProvider, useStore, type CartItem } from '@/app/context/StoreContext';
import { CartPricingSync } from '@/app/components/CartPricingSync';
import { Navbar } from '@/app/components/Navbar';
import { MobileBottomNav } from '@/app/components/MobileBottomNav';
import { Footer } from '@/app/components/Footer';
import { CartDrawer } from '@/app/components/CartDrawer';
import { ScrollToTop } from '@/app/components/ScrollToTop';
import { SeasonalEffects } from '@/app/components/SeasonalEffects';
import { ThemeWrapper } from '@/app/components/ThemeWrapper';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { Toaster } from 'sonner';
import { BottomCartBar } from '@/app/components/BottomCartBar';
import { DeliveryProvider } from '@/app/context/DeliveryContext';
import { useLocation } from 'react-router-dom';

// Lazy-load pages for smaller initial bundle and faster first paint
const HomePage = lazy(() => import('@/app/pages/HomePage').then(m => ({ default: m.HomePage })));
const ProductsPage = lazy(() => import('@/app/pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const ProductDetailPage = lazy(() => import('@/app/pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const AboutPage = lazy(() => import('@/app/pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('@/app/pages/ContactPage').then(m => ({ default: m.ContactPage })));
const PrivacyPage = lazy(() => import('@/app/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('@/app/pages/TermsPage').then(m => ({ default: m.TermsPage })));
const CookiesPage = lazy(() => import('@/app/pages/CookiesPage').then(m => ({ default: m.CookiesPage })));
const CartPage = lazy(() => import('@/app/pages/CartPage').then(m => ({ default: m.CartPage })));
const ProfilePage = lazy(() => import('@/app/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const LoginPage = lazy(() => import('@/app/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignUpPage = lazy(() => import('@/app/pages/SignUpPage').then(m => ({ default: m.SignUpPage })));
const VerifyEmailPage = lazy(() => import('@/app/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('@/app/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ChangePasswordPage = lazy(() => import('@/app/pages/ChangePasswordPage').then(m => ({ default: m.ChangePasswordPage })));
const CheckoutPage = lazy(() => import('@/app/pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() => import('@/app/pages/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const NotFoundPage = lazy(() => import('@/app/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const SubscriptionPage = lazy(() => import('@/app/pages/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const MerchantOnboardingPage = lazy(() => import('@/app/pages/MerchantOnboardingPage').then(m => ({ default: m.MerchantOnboardingPage })));

const AdminLayout = lazy(() => import('@/app/layouts/AdminLayout').then(m => ({ default: m.AdminLayout })));
const DeliveryLayout = lazy(() => import('@/app/layouts/DeliveryLayout').then(m => ({ default: m.DeliveryLayout })));
const AdminDashboard = lazy(() => import('@/app/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminProductsPage = lazy(() => import('@/app/pages/admin/AdminProductsPage').then(m => ({ default: m.AdminProductsPage })));
const AdminOrdersPage = lazy(() => import('@/app/pages/admin/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage })));
const AdminCustomersPage = lazy(() => import('@/app/pages/admin/AdminCustomersPage').then(m => ({ default: m.AdminCustomersPage })));
const AdminThemeEditor = lazy(() => import('@/app/pages/admin/store/AdminThemeEditor').then(m => ({ default: m.AdminThemeEditor })));
const AdminAnalyticsPage = lazy(() => import('@/app/pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminTaxPage = lazy(() => import('@/app/pages/admin/AdminTaxPage').then(m => ({ default: m.AdminTaxPage })));
const AdminSubscriptionPage = lazy(() => import('@/app/pages/admin/AdminSubscriptionPage').then(m => ({ default: m.AdminSubscriptionPage })));
const AdminStorePage = lazy(() => import('@/app/pages/admin/store/AdminStorePage').then(m => ({ default: m.AdminStorePage })));
const AdminPagesPage = lazy(() => import('@/app/pages/admin/store/AdminPagesPage').then(m => ({ default: m.AdminPagesPage })));
const AdminPreferencesPage = lazy(() => import('@/app/pages/admin/store/AdminPreferencesPage').then(m => ({ default: m.AdminPreferencesPage })));
const AdminSettingsPage = lazy(() => import('@/app/pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const AdminDiscountsPage = lazy(() => import('@/app/pages/admin/AdminDiscountsPage').then(m => ({ default: m.AdminDiscountsPage })));
const AdminSellersPage = lazy(() => import('@/app/pages/admin/AdminSellersPage').then(m => ({ default: m.AdminSellersPage })));
const AdminLogisticsPage = lazy(() => import('@/app/pages/admin/AdminLogisticsPage').then(m => ({ default: m.AdminLogisticsPage })));
const AdminPayoutsPage = lazy(() => import('@/app/pages/admin/AdminPayoutsPage').then(m => ({ default: m.AdminPayoutsPage })));
const SellerDashboard = lazy(() => import('@/app/pages/seller/SellerDashboard').then(m => ({ default: m.SellerDashboard })));
const DeliveryDashboard = lazy(() => import('@/app/pages/delivery/DeliveryDashboard').then(m => ({ default: m.DeliveryDashboard })));
const DeliveryAssignmentsPage = lazy(() => import('@/app/pages/delivery/DeliveryAssignmentsPage').then(m => ({ default: m.DeliveryAssignmentsPage })));
const DeliveryAssignmentDetailPage = lazy(() => import('@/app/pages/delivery/DeliveryAssignmentDetailPage').then(m => ({ default: m.DeliveryAssignmentDetailPage })));
const DeliveryEarningsPage = lazy(() => import('@/app/pages/delivery/DeliveryEarningsPage').then(m => ({ default: m.DeliveryEarningsPage })));

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-slate-50">
      <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );
}

function AdminDashboardSwitcher() {
  const { user } = useAuth();
  if (user?.role === 'seller') {
    return <SellerDashboard />;
  }
  return <AdminDashboard />;
}

interface MainLayoutProps {
  children: React.ReactNode;
  cartCount: number;
  onCartClick: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string | number, quantity: number) => void;
  onRemoveItem: (id: string | number) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const MainLayout = memo(function MainLayout({
  children,
  cartCount,
  onCartClick,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  isCartOpen,
  setIsCartOpen
}: MainLayoutProps) {
  const location = useLocation();
  const closeCart = useCallback(() => setIsCartOpen(false), [setIsCartOpen]);
  const [showLocationPrompt, setShowLocationPrompt] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('locationPromptSeen') !== 'true';
  });

  const handleDismissLocation = useCallback(() => {
    setShowLocationPrompt(false);
    try {
      localStorage.setItem('locationPromptSeen', 'true');
    } catch {
      // ignore storage issues
    }
  }, []);

  const handleEnableLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      handleDismissLocation();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        handleDismissLocation();
      },
      () => {
        handleDismissLocation();
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  }, [handleDismissLocation]);

  const shouldShowBottomCartBar = cartItems.length > 0 && !['/cart', '/checkout'].includes(location.pathname);

  return (
    <div className="relative min-h-screen bg-white flex flex-col">
      <SeasonalEffects />
      <Navbar cartCount={cartCount} onCartClick={onCartClick} />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      {!shouldShowBottomCartBar && <MobileBottomNav cartCount={cartCount} onCartClick={onCartClick} />}
      <BottomCartBar />
      <Footer />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={closeCart}
        items={cartItems}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
      />
      <AnimatePresence>
        {showLocationPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full sm:max-w-md mx-4 mb-6 sm:mb-0 rounded-3xl bg-white shadow-2xl border border-slate-100 p-6 space-y-4"
            >
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">
                Delivery area check
              </p>
              <h2 className="mt-2 text-lg font-black text-slate-900 tracking-tight">
                We currently deliver in Bengaluru only
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Enable location so we can confirm if your address is within our Bengaluru service area and show accurate delivery info.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleEnableLocation}
                className="flex-1 h-10 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.25em]"
              >
                Enable location
              </button>
              <button
                onClick={handleDismissLocation}
                className="flex-1 h-10 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-[0.25em]"
              >
                Not now
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              We only use your location to check if we can deliver to you in Bengaluru.
            </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default function App() {
  return (
    <StoreProvider>
      <CartPricingSync />
      <DeliveryProvider>
        <ThemeWrapper>
          <AuthProvider>
            <Router>
              <AppRoutes />
              <Toaster position="top-right" richColors closeButton />
            </Router>
          </AuthProvider>
        </ThemeWrapper>
      </DeliveryProvider>
    </StoreProvider>
  );
}

function AppRoutes() {
  const {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    handleAddToCart,
    handleUpdateQuantity,
    handleRemoveItem
  } = useStore();

  const cartCount = useMemo(
    () => cartItems.reduce((sum: number, item: CartItem) => sum + item.quantity, 0),
    [cartItems]
  );

  const onCartClick = useCallback(() => setIsCartOpen(true), [setIsCartOpen]);

  const mainLayoutProps = useMemo(
    () => ({
      cartCount,
      onCartClick,
      cartItems,
      onUpdateQuantity: handleUpdateQuantity,
      onRemoveItem: handleRemoveItem,
      isCartOpen,
      setIsCartOpen
    }),
    [cartCount, onCartClick, cartItems, handleUpdateQuantity, handleRemoveItem, isCartOpen, setIsCartOpen]
  );

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<MainLayout {...mainLayoutProps}><LoginPage /></MainLayout>} />
          <Route path="/signup" element={<MainLayout {...mainLayoutProps}><SignUpPage /></MainLayout>} />
          <Route path="/verify-email" element={<MainLayout {...mainLayoutProps}><VerifyEmailPage /></MainLayout>} />
          <Route path="/forgot-password" element={<MainLayout {...mainLayoutProps}><ForgotPasswordPage /></MainLayout>} />
          <Route path="/change-password" element={<MainLayout {...mainLayoutProps}><ChangePasswordPage /></MainLayout>} />
          <Route path="/order-confirmation" element={<OrderConfirmationPage />} />

          <Route element={<ProtectedRoute allowedRoles={['admin', 'seller']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardSwitcher />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="discounts" element={<AdminDiscountsPage />} />
              <Route path="seller-dashboard" element={<SellerDashboard />} />
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="customers" element={<AdminCustomersPage />} />
                <Route path="sellers" element={<AdminSellersPage />} />
                <Route path="logistics" element={<AdminLogisticsPage />} />
                <Route path="payouts" element={<AdminPayoutsPage />} />
                <Route path="store" element={<AdminStorePage />} />
                <Route path="themes" element={<AdminThemeEditor />} />
                <Route path="pages" element={<AdminPagesPage />} />
                <Route path="preferences" element={<AdminPreferencesPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="taxes" element={<AdminTaxPage />} />
                <Route path="subscription" element={<AdminSubscriptionPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['delivery_partner']} />}>
            <Route path="/delivery" element={<DeliveryLayout />}>
              <Route index element={<DeliveryDashboard />} />
              <Route path="assignments" element={<DeliveryAssignmentsPage />} />
              <Route path="assignments/:id" element={<DeliveryAssignmentDetailPage />} />
              <Route path="earnings" element={<DeliveryEarningsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<MainLayout {...mainLayoutProps}><HomePage onAddToCart={handleAddToCart} /></MainLayout>} />
          <Route path="/products" element={<MainLayout {...mainLayoutProps}><ProductsPage onAddToCart={handleAddToCart} /></MainLayout>} />
          <Route path="/product/:id" element={<MainLayout {...mainLayoutProps}><ProductDetailPage onAddToCart={handleAddToCart} /></MainLayout>} />
          <Route path="/about" element={<MainLayout {...mainLayoutProps}><AboutPage /></MainLayout>} />
          <Route path="/contact" element={<MainLayout {...mainLayoutProps}><ContactPage /></MainLayout>} />
          <Route path="/privacy" element={<MainLayout {...mainLayoutProps}><PrivacyPage /></MainLayout>} />
          <Route path="/terms" element={<MainLayout {...mainLayoutProps}><TermsPage /></MainLayout>} />
          <Route path="/cookies" element={<MainLayout {...mainLayoutProps}><CookiesPage /></MainLayout>} />
          <Route path="/cart" element={<MainLayout {...mainLayoutProps}><CartPage items={cartItems} onUpdateQuantity={handleUpdateQuantity} onRemoveItem={handleRemoveItem} /></MainLayout>} />
          <Route path="/checkout" element={<MainLayout {...mainLayoutProps}><CheckoutPage items={cartItems} /></MainLayout>} />
          <Route path="/profile" element={<MainLayout {...mainLayoutProps}><ProfilePage /></MainLayout>} />
          <Route path="/subscription" element={<MainLayout {...mainLayoutProps}><SubscriptionPage /></MainLayout>} />
          <Route path="/onboarding" element={<MainLayout {...mainLayoutProps}><MerchantOnboardingPage /></MainLayout>} />

          <Route path="*" element={<MainLayout {...mainLayoutProps}><NotFoundPage /></MainLayout>} />
        </Routes>
      </Suspense>
    </>
  );
}
