import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Search, User, LogIn, ChevronRight, LayoutDashboard, Globe, Zap, ArrowUpRight, Truck, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { cn, motionTapTransition } from '@/lib/utils';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
}

export function Navbar({ cartCount, onCartClick }: NavbarProps) {
  const { theme } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  const isAdmin = user && ['admin', 'seller'].includes(user.role);
  const isDeliveryPartner = user?.role === 'delivery_partner';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleAccountClick = () => {
    if (isAuthenticated) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/products', label: 'Products' },
    { path: '/subscription', label: 'Subscription' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[100] px-2 sm:px-4 py-3 sm:py-6 md:px-10 pointer-events-none">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className={cn(
            "max-w-[1400px] mx-auto h-16 sm:h-20 rounded-2xl sm:rounded-[2.5rem] border border-white/20 transition-all duration-700 pointer-events-auto overflow-hidden",
            isScrolled
              ? "bg-slate-900/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.1)]"
              : "bg-white/10 backdrop-blur-xl border-white/10"
          )}
        >
          <div className="h-full px-3 sm:px-8 flex items-center justify-between gap-2">
            {/* Logo / Brand */}
            <Link to="/" className="flex items-center gap-4 group">
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt="The Fruit Tribe" className="h-10 w-auto md:h-12 object-contain" />
              ) : (
                <div className={cn(
                  "h-10 w-10 md:h-12 md:w-12 rounded-2xl flex items-center justify-center font-black text-white shadow-2xl transition-all duration-500 rotate-3 group-hover:rotate-0 group-hover:scale-110",
                  isScrolled ? "bg-emerald-500" : "bg-slate-900"
                )}>
                  {theme.storeName.charAt(0)}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className={cn(
                  "font-black text-sm sm:text-lg tracking-tight uppercase sm:uppercase leading-none transition-colors truncate max-w-[120px] sm:max-w-[260px]",
                  isScrolled ? "text-white" : "text-slate-900"
                )}>
                  {theme.storeName}
                </span>
                <span className={cn(
                  "hidden sm:block text-[8px] font-black uppercase tracking-[0.3em] mt-1 transition-colors",
                  isScrolled ? "text-emerald-400" : "text-emerald-600"
                )}>
                  Fresh fruits delivered
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Ultra Clean */}
            <div className="hidden lg:flex items-center gap-10">
              {navItems.map((item, index) => (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    className={cn(
                      "relative text-[10px] font-black uppercase sm:uppercase tracking-[0.08em] sm:tracking-[0.2em] transition-all duration-500 group py-2",
                      location.pathname === item.path
                        ? (isScrolled ? "text-emerald-400" : "text-emerald-600")
                        : (isScrolled ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-black")
                    )}
                    whileHover={{ y: -1 }}
                  >
                    {item.label}
                    <motion.span
                      layoutId="nav-line"
                      className={cn(
                        "absolute -bottom-1 left-0 h-[3px] bg-emerald-500 rounded-full transition-all duration-500",
                        location.pathname === item.path ? "w-full" : "w-0 group-hover:w-full opacity-40"
                      )}
                    />
                  </motion.div>
                </Link>
              ))}
            </div>

            {/* High-End Operations Node */}
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link to="/admin" className="hidden xl:flex items-center gap-3 px-6 h-10 bg-emerald-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-[transform,opacity,background-color] duration-100 ease-out active:scale-[0.98] shadow-xl shadow-emerald-500/20">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}
              {isDeliveryPartner && (
                <Link to="/delivery" className="hidden xl:flex items-center gap-3 px-6 h-10 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-[transform,opacity,background-color] duration-100 ease-out active:scale-[0.98] shadow-xl shadow-slate-900/20">
                  <Truck className="w-3.5 h-3.5" />
                  Delivery
                </Link>
              )}

              <div className="flex items-center gap-1.5 sm:gap-2">
                {isAuthenticated && (
                  <motion.button
                    type="button"
                    title="Log out"
                    aria-label="Log out"
                    transition={motionTapTransition}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                    className={cn(
                      'touch-manipulation hidden sm:inline-flex h-10 md:h-12 min-w-[2.5rem] md:min-w-[7.5rem] px-2 md:px-4 items-center justify-center gap-2 rounded-xl sm:rounded-2xl transition-[transform,opacity] duration-100 ease-out font-black text-[8px] md:text-[9px] uppercase tracking-[0.14em] md:tracking-widest shadow-lg',
                      'bg-slate-900 text-white hover:bg-slate-800 border border-slate-800',
                    )}
                  >
                    <LogOut className="w-4 h-4 md:w-5 md:h-5 shrink-0" aria-hidden />
                    <span className="hidden md:inline">Log out</span>
                  </motion.button>
                )}
                <motion.button
                  transition={motionTapTransition}
                  whileHover={{ scale: 1.1, rotate: 15 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAccountClick}
                  className={cn(
                    'touch-manipulation h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl sm:rounded-2xl transition-[transform,opacity] duration-100 ease-out',
                    isScrolled ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-900/5 text-slate-900 hover:bg-slate-900 hover:text-white',
                  )}
                >
                  {isAuthenticated ? <User className="w-4 h-4 md:w-5 md:h-5" /> : <LogIn className="w-4 h-4 md:w-5 md:h-5" />}
                </motion.button>

                <motion.button
                  transition={motionTapTransition}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCartClick}
                  className={cn(
                    'touch-manipulation relative h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl sm:rounded-2xl transition-[transform,opacity] duration-100 ease-out shadow-2xl',
                    isScrolled ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white',
                  )}
                >
                  <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                  <AnimatePresence>
                    {cartCount > 0 && (
                      <motion.span
                        initial={{ scale: 0, x: 5, y: -5 }}
                        animate={{ scale: 1, x: 0, y: 0 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-1 -right-1 bg-white text-slate-900 text-[8px] font-black rounded-lg w-5 h-5 flex items-center justify-center shadow-inner border border-slate-100"
                      >
                        {cartCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                <motion.button
                  transition={motionTapTransition}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsMenuOpen(true)}
                  className={cn(
                    'touch-manipulation lg:hidden h-10 w-10 flex items-center justify-center rounded-xl sm:rounded-2xl transition-[transform,opacity] duration-100 ease-out',
                    isScrolled ? 'bg-white/5 text-white' : 'bg-slate-900/5 text-slate-900',
                  )}
                >
                  <Menu className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.nav>
      </div>

      {/* Global Menu Overlay - Cinematic */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[150] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xl"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-5 sm:p-10 flex items-center justify-between bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black italic">T</div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Menu</span>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="h-12 w-12 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-red-500 hover:shadow-xl transition-all flex items-center justify-center">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-12 space-y-4 sm:space-y-8">
                {navItems.map((item, idx) => (
                  <Link key={item.path} to={item.path}>
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={cn(
                        "flex items-center justify-between group py-6 border-b border-slate-50",
                        location.pathname === item.path ? "text-emerald-600" : "text-slate-400"
                      )}
                    >
                      <div className="space-y-1">
                        <span className="text-2xl sm:text-3xl font-black tracking-tight sm:tracking-tighter leading-none">{item.label}</span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.path === '/' ? 'Home' : item.label}</p>
                      </div>
                      <ArrowUpRight className="h-10 w-10 opacity-10 group-hover:opacity-100 group-hover:translate-x-2 group-hover:-translate-y-2 transition-all" />
                    </motion.div>
                  </Link>
                ))}
              </div>

              <div className="p-5 sm:p-12 bg-slate-50 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  {isAuthenticated && (
                    <button
                      type="button"
                      title="Log out"
                      aria-label="Log out"
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                        navigate('/');
                      }}
                      className="col-span-2 h-14 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all"
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      Log out
                    </button>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="col-span-2 h-16 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/20 active:scale-95 transition-all"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Zap className="h-4 w-4 text-emerald-400" />
                      Admin dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleAccountClick}
                    className="h-16 bg-white border border-slate-200 text-slate-900 rounded-[2rem] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest hover:shadow-lg transition-all"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    className="h-16 bg-white border border-slate-200 text-slate-900 rounded-[2rem] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest hover:shadow-lg transition-all"
                  >
                    <Globe className="h-4 w-4" />
                    En-US
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
