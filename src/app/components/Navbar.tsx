import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Menu, X, Search, User, LogIn,
  LayoutDashboard, Zap, LogOut, Truck, Phone, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { mergeSubscriptionPageConfig } from '@/app/config/subscriptionPageConfig';
import { cn } from '@/lib/utils';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
}

export function Navbar({ cartCount, onCartClick }: NavbarProps) {
  const { theme, preferences } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  const isAdmin = user && ['admin', 'seller'].includes(user.role);
  const fromDelivery = new URLSearchParams(location.search).get('from') === 'delivery';
  const showReturnToDelivery = fromDelivery;
  const isDeliveryMode = fromDelivery;
  const isDeliveryUser = user?.role === 'delivery_partner' || fromDelivery;

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Lock body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const handleAccountClick = () => {
    navigate(isAuthenticated ? '/profile' : '/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/products?q=${encodeURIComponent(q)}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navItems = useMemo(() => {
    const all = [
      { path: '/', label: 'Home' },
      { path: '/products', label: 'Products' },
      { path: '/gallery', label: 'Gallery' },
      { path: '/subscription', label: 'Subscription' },
      { path: '/about', label: 'About' },
      { path: '/contact', label: 'Contact' },
    ];
    const subOn = mergeSubscriptionPageConfig(preferences.subscriptionPage).enabled;
    return subOn ? all : all.filter((i) => i.path !== '/subscription');
  }, [preferences.subscriptionPage]);

  const mobileMenuItems = useMemo(() => {
    if (isDeliveryUser) {
      return [
        { path: '/delivery', label: 'Delivery dashboard' },
        { path: '/delivery/assignments', label: 'Assignments' },
        { path: '/?from=delivery', label: 'View store' },
      ];
    }
    return navItems;
  }, [isDeliveryUser, navItems]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      {/* ── Main Navbar ── */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-[100] transition-all duration-300',
          isScrolled
            ? 'bg-white/98 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.06)]'
            : 'bg-white'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 shrink-0 group">
              {theme.logoUrl ? (
                <img
                  src={theme.logoUrl}
                  alt={theme.storeName}
                  className="h-9 w-auto object-contain"
                />
              ) : (
                <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-base shadow-sm group-hover:bg-emerald-700 transition-colors">
                  {theme.storeName.charAt(0)}
                </div>
              )}
              <div className="flex flex-col leading-none">
                <span className="font-bold text-slate-900 text-base leading-tight">
                  {theme.storeName}
                </span>
                <span className="text-[11px] text-slate-400 font-normal hidden sm:block mt-0.5">
                  Fresh fruits, delivered daily
                </span>
              </div>
            </Link>

            {/* Desktop nav links — centered */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {showReturnToDelivery && (
                <button
                  type="button"
                  onClick={() => navigate('/delivery')}
                  className="inline-flex items-center gap-1.5 h-9 px-4 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to dashboard
                </button>
              )}
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'relative px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.path)
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  {item.label}
                  {isActive(item.path) && (
                    <motion.span
                      layoutId="nav-active-dot"
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500"
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2 ml-auto lg:ml-0">

              {/* Desktop search toggle */}
              <button
                aria-label="Search"
                onClick={() => setSearchOpen((v) => !v)}
                className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center transition-colors',
                  searchOpen
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Admin link — desktop */}
              {isAdmin && !isDeliveryMode && (
                <Link
                  to="/admin"
                  className="hidden lg:flex items-center gap-1.5 h-9 px-4 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}

              {/* Account — desktop */}
              <button
                onClick={handleAccountClick}
                aria-label={isAuthenticated ? 'My account' : 'Sign in'}
                className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                {isAuthenticated ? (
                  <User className="w-4 h-4" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span className="hidden xl:inline">
                  {isAuthenticated ? (user?.name?.split(' ')[0] || 'Account') : 'Sign in'}
                </span>
              </button>

              {/* Cart button */}
              <button
                onClick={onCartClick}
                aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}
                className="relative flex items-center gap-2 h-9 px-4 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Cart</span>
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key="badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-white text-emerald-700 text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border border-emerald-100"
                    >
                      {cartCount > 9 ? '9+' : cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Mobile hamburger */}
              <button
                aria-label="Open menu"
                onClick={() => setIsMenuOpen(true)}
                className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Inline search bar — slides down */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-slate-100"
              >
                <form onSubmit={handleSearch} className="py-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for fruits, categories…"
                      className="w-full h-11 pl-11 pr-28 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button
                        type="submit"
                        className="h-7 px-3 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                      >
                        Search
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchOpen(false)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── Mobile Drawer (slides from right) ── */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[200] lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="absolute right-0 top-0 bottom-0 w-[300px] bg-white shadow-2xl flex flex-col"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {theme.logoUrl ? (
                    <img src={theme.logoUrl} alt={theme.storeName} className="h-8 w-auto object-contain" />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                      {theme.storeName.charAt(0)}
                    </div>
                  )}
                  <span className="font-semibold text-slate-900 text-sm">{theme.storeName}</span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile search */}
              <div className="px-4 pt-4 pb-2">
                <form onSubmit={(e) => { e.preventDefault(); const q = searchQuery.trim(); if (q) { navigate(`/products?q=${encodeURIComponent(q)}`); setIsMenuOpen(false); setSearchQuery(''); } }}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search fruits…"
                      className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </form>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-3 py-2">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Menu
                </p>
                {mobileMenuItems.map((item, idx) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={cn(
                        'flex items-center justify-between px-3 py-3 rounded-xl mb-0.5 text-sm font-medium transition-colors',
                        isActive(item.path)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {item.label}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </motion.div>
                  </Link>
                ))}

                <div className="my-3 h-px bg-slate-100" />

                <p className="px-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Account
                </p>

                <Link to={isDeliveryUser ? '/delivery' : '/profile'} onClick={() => setIsMenuOpen(false)}>
                  <div className="flex items-center justify-between px-3 py-3 rounded-xl mb-0.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      {isDeliveryUser ? <LayoutDashboard className="w-4 h-4 text-slate-400" /> : <User className="w-4 h-4 text-slate-400" />}
                      {isDeliveryUser ? 'Delivery dashboard' : (isAuthenticated ? (user?.name?.split(' ')[0] || 'My account') : 'Sign in / Register')}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </Link>

                <Link to={isDeliveryUser ? '/delivery/assignments' : '/profile#order-history'} onClick={() => setIsMenuOpen(false)}>
                  <div className="flex items-center justify-between px-3 py-3 rounded-xl mb-0.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Truck className="w-4 h-4 text-slate-400" />
                      {isDeliveryUser ? 'My assignments' : 'Track my order'}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </Link>

                <Link to="/contact" onClick={() => setIsMenuOpen(false)}>
                  <div className="flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-slate-400" />
                      Help & support
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </Link>
              </nav>

              {/* Panel footer */}
              <div className="px-4 py-4 border-t border-slate-100 space-y-2">
                {isAdmin && !isDeliveryUser && (
                  <Link
                    to="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full h-10 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    Admin dashboard
                  </Link>
                )}

                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); setIsMenuOpen(false); navigate('/'); }}
                    className="flex items-center justify-center gap-2 w-full h-10 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full h-10 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign in
                  </Link>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
