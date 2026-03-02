import React, { lazy, Suspense, useMemo, useCallback, memo } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/app/context/AuthContext';
import { StoreProvider, useStore, type CartItem } from '@/app/context/StoreContext';
import { Navbar } from '@/app/components/Navbar';
import { Footer } from '@/app/components/Footer';
import { CartDrawer } from '@/app/components/CartDrawer';
import { ScrollToTop } from '@/app/components/ScrollToTop';
import { SeasonalEffects } from '@/app/components/SeasonalEffects';
import { ThemeWrapper } from '@/app/components/ThemeWrapper';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { Toaster } from 'sonner';

// Lazy-load pages for smaller initial bundle and faster first paint
const HomePage = lazy(() => import('@/app/pages/HomePage').then(m => ({ default: m.HomePage })));
const ProductsPage = lazy(() => import('@/app/pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const ProductDetailPage = lazy(() => import('@/app/pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const AboutPage = lazy(() => import('@/app/pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('@/app/pages/ContactPage').then(m => ({ default: m.ContactPage })));
const CartPage = lazy(() => import('@/app/pages/CartPage').then(m => ({ default: m.CartPage })));
const ProfilePage = lazy(() => import('@/app/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const LoginPage = lazy(() => import('@/app/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignUpPage = lazy(() => import('@/app/pages/SignUpPage').then(m => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('@/app/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const CheckoutPage = lazy(() => import('@/app/pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() => import('@/app/pages/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const NotFoundPage = lazy(() => import('@/app/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const SubscriptionPage = lazy(() => import('@/app/pages/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const MerchantOnboardingPage = lazy(() => import('@/app/pages/MerchantOnboardingPage').then(m => ({ default: m.MerchantOnboardingPage })));

const AdminLayout = lazy(() => import('@/app/layouts/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('@/app/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminProductsPage = lazy(() => import('@/app/pages/admin/AdminProductsPage').then(m => ({ default: m.AdminProductsPage })));
const AdminOrdersPage = lazy(() => import('@/app/pages/admin/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage })));
const AdminCustomersPage = lazy(() => import('@/app/pages/admin/AdminCustomersPage').then(m => ({ default: m.AdminCustomersPage })));
const AdminThemeEditor = lazy(() => import('@/app/pages/admin/store/AdminThemeEditor').then(m => ({ default: m.AdminThemeEditor })));
const AdminAnalyticsPage = lazy(() => import('@/app/pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminTaxPage = lazy(() => import('@/app/pages/admin/AdminTaxPage').then(m => ({ default: m.AdminTaxPage })));
const AdminStorePage = lazy(() => import('@/app/pages/admin/store/AdminStorePage').then(m => ({ default: m.AdminStorePage })));
const AdminPagesPage = lazy(() => import('@/app/pages/admin/store/AdminPagesPage').then(m => ({ default: m.AdminPagesPage })));
const AdminPreferencesPage = lazy(() => import('@/app/pages/admin/store/AdminPreferencesPage').then(m => ({ default: m.AdminPreferencesPage })));
const AdminSettingsPage = lazy(() => import('@/app/pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const AdminDiscountsPage = lazy(() => import('@/app/pages/admin/AdminDiscountsPage').then(m => ({ default: m.AdminDiscountsPage })));
const AdminSellersPage = lazy(() => import('@/app/pages/admin/AdminSellersPage').then(m => ({ default: m.AdminSellersPage })));
const AdminLogisticsPage = lazy(() => import('@/app/pages/admin/AdminLogisticsPage').then(m => ({ default: m.AdminLogisticsPage })));
const AdminPayoutsPage = lazy(() => import('@/app/pages/admin/AdminPayoutsPage').then(m => ({ default: m.AdminPayoutsPage })));
const SellerDashboard = lazy(() => import('@/app/pages/seller/SellerDashboard').then(m => ({ default: m.SellerDashboard })));

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
  const closeCart = useCallback(() => setIsCartOpen(false), [setIsCartOpen]);
  return (
    <div className="relative min-h-screen bg-white flex flex-col">
      <SeasonalEffects />
      <Navbar cartCount={cartCount} onCartClick={onCartClick} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={closeCart}
        items={cartItems}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
      />
    </div>
  );
});

export default function App() {
  return (
    <StoreProvider>
      <ThemeWrapper>
        <AuthProvider>
          <Router>
            <AppRoutes />
            <Toaster position="top-right" richColors closeButton />
          </Router>
        </AuthProvider>
      </ThemeWrapper>
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
          <Route path="/forgot-password" element={<MainLayout {...mainLayoutProps}><ForgotPasswordPage /></MainLayout>} />
          <Route path="/order-confirmation" element={<OrderConfirmationPage />} />

          <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'seller']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardSwitcher />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="discounts" element={<AdminDiscountsPage />} />
              <Route path="seller-dashboard" element={<SellerDashboard />} />
              <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
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
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          <Route path="/" element={<MainLayout {...mainLayoutProps}><HomePage onAddToCart={handleAddToCart} /></MainLayout>} />
          <Route path="/products" element={<MainLayout {...mainLayoutProps}><ProductsPage onAddToCart={handleAddToCart} /></MainLayout>} />
          <Route path="/product/:id" element={<MainLayout {...mainLayoutProps}><ProductDetailPage onAddToCart={handleAddToCart} /></MainLayout>} />
          <Route path="/about" element={<MainLayout {...mainLayoutProps}><AboutPage /></MainLayout>} />
          <Route path="/contact" element={<MainLayout {...mainLayoutProps}><ContactPage /></MainLayout>} />
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
