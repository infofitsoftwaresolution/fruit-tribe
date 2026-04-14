import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Menu, X, Search, User, LogIn, ChevronRight, LayoutDashboard, Globe, Zap, ArrowUpRight, Truck, LogOut } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { mergeSubscriptionPageConfig } from '@/app/config/subscriptionPageConfig';
import { cn, motionTapTransition } from '@/lib/utils';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
}

export function Navbar({ cartCount, onCartClick }: NavbarProps) {
  const { theme, preferences } = useStore();
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

  const navItems = useMemo(() => {
    const all = [
      { path: '/', label: 'Home' },
      { path: '/products', label: 'Products' },
      { path: '/subscription', label: 'Subscription' },
      { path: '/about', label: 'About' },
      { path: '/contact', label: 'Contact' },
    ];
    const subOn = mergeSubscriptionPageConfig(preferences.subscriptionPage).enabled;
    return subOn ? all : all.filter((i) => i.path !== '/subscription');
  }, [preferences.subscriptionPage]);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[100] px-2 sm:px-4 py-3 sm:py-6 md:px-10 pointer-events-none">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className={cn(
            "max-w-[1400px] mx-auto h-20 rounded-b-[2rem] border-b transition-all duration-500 pointer-events-auto",
            isScrolled
              ? "bg-white/95 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.04)] border-slate-100"
              : "bg-white border-transparent"
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
                  "font-black text-xs sm:text-lg tracking-tighter leading-none transition-colors truncate max-w-[100px] sm:max-w-[260px]",
                  "text-slate-900"
                )}>
                  {theme.storeName}
                </span>
                <span className={cn(
                  "hidden sm:block text-[11px] font-medium text-slate-500 mt-1",
                )}>
                  Fresh fruits, delivered daily.
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Ultra Clean */}
            <div className="hidden lg:flex items-center gap-10">
              {navItems.map((item, index) => (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    className={cn(
                      "relative text-sm font-semibold transition-all duration-300 group py-2",
                      location.pathname === item.path
                        ? "text-emerald-600"
                        : "text-slate-500 hover:text-emerald-600"
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

            {/* Search Bar Inline */}
            <div className="hidden xl:flex flex-1 max-w-xs mx-8 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text"
                    placeholder="Search fruits..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const q = (e.target as HTMLInputElement).value.trim();
                            if (q) navigate(`/products?q=${encodeURIComponent(q)}`);
                        }
                    }}
                />
            </div>

            {/* High-End Operations Node */}
            <div className="flex items-center gap-2 sm:gap-4">
               {/* Mobile Menu Trigger - Right Side after Icons */}
               <motion.button
                  transition={motionTapTransition}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsMenuOpen(true)}
                  className={cn(
                    'touch-manipulation lg:hidden h-11 w-11 flex items-center justify-center rounded-2xl transition-all duration-300',
                    'bg-slate-50 text-slate-900',
                  )}
                >
                  <Menu className="w-5 h-5" />
                </motion.button>

              {isAdmin && (
                <Link to="/admin" className="hidden xl:flex items-center gap-3 px-6 h-10 bg-emerald-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-[transform,opacity,background-color] duration-100 ease-out active:scale-[0.98] shadow-xl shadow-emerald-500/20">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                <motion.button
                  transition={motionTapTransition}
                  whileHover={{ scale: 1.1, rotate: 15 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAccountClick}
                  className={cn(
                    'touch-manipulation h-11 w-11 flex items-center justify-center rounded-2xl transition-all duration-300',
                    'bg-slate-50 text-slate-900 border border-slate-100',
                  )}
                >
                  {isAuthenticated ? <User className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                </motion.button>

                <motion.button
                  transition={motionTapTransition}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCartClick}
                  className={cn(
                    'touch-manipulation relative h-11 px-3 sm:px-4 flex items-center justify-center gap-2 rounded-2xl transition-all duration-300',
                    'bg-slate-900 text-white shadow-xl shadow-slate-900/10'
                  )}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="hidden sm:inline text-xs font-bold">Cart</span>
                  <AnimatePresence>
                    {cartCount > 0 && (
                      <motion.span
                        initial={{ scale: 0, x: 5, y: -5 }}
                        animate={{ scale: 1, x: 0, y: 0 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-1 -right-1 bg-white text-slate-900 text-[8px] font-extrabold rounded-lg w-5 h-5 flex items-center justify-center shadow-lg border border-slate-100"
                      >
                        {cartCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.nav>
      </div>

      {/* Global Menu Overlay - Cinematic Left Slide */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[150] flex justify-start">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[300px] sm:w-[350px] bg-white h-full shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-emerald-200">T</div>
                  <span className="text-xs font-black text-slate-900 tracking-widest uppercase">Navigation</span>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="h-10 w-10 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all flex items-center justify-center">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pt-6 px-4 space-y-2">
                {navItems.map((item, idx) => (
                  <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl transition-all font-bold min-h-[56px]",
                        location.pathname === item.path ? "bg-emerald-50 text-emerald-600" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-sm">{item.label}</span>
                    </motion.div>
                  </Link>
                ))}

                <div className="my-6 h-px bg-slate-100" />
                <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Support & Account</p>
                
                {[
                    { label: 'My Account', icon: User, path: '/profile' },
                    { label: 'Track Order', icon: Truck, path: '/orders' },
                    { label: 'Support Center', icon: Globe, path: '/contact' }
                ].map((item, idx) => (
                    <Link key={item.label} to={item.path} onClick={() => setIsMenuOpen(false)}>
                        <div className="flex items-center gap-4 p-4 rounded-2xl text-slate-600 font-bold min-h-[56px] hover:bg-slate-50">
                            <item.icon className="w-4 h-4 opacity-70" />
                            <span className="text-sm">{item.label}</span>
                        </div>
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
