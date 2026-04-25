import { Home, Search, Grid3X3, ShoppingCart, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  cartCount: number;
  onCartClick: () => void;
}

export function MobileBottomNav({ cartCount, onCartClick }: MobileBottomNavProps) {
  const displayCartBadge = cartCount > 99 ? '99+' : String(cartCount);
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { key: 'home', label: 'Home', icon: Home, path: '/' },
    { key: 'search', label: 'Search', icon: Search, path: '/products' },
    { key: 'categories', label: 'Browse', icon: Grid3X3, path: '/products' },
    { key: 'cart', label: 'Cart', icon: ShoppingCart, path: '/cart', isCart: true },
    { key: 'account', label: 'Account', icon: User, path: '/profile' },
  ] as const;

  const handleClick = (item: (typeof items)[number]) => {
    if (item.isCart) {
      onCartClick();
      return;
    }
    navigate(item.path);
  };

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[135] md:hidden">
      <div className="mx-auto max-w-[480px] px-3 pb-4">
        <div className="rounded-3xl bg-slate-950/95 border border-slate-800/80 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-stretch justify-between px-2">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.isCart ? location.pathname === '/cart' : isActivePath(item.path);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleClick(item)}
                  className={cn(
                    'relative flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[9px] font-black uppercase tracking-[0.16em] transition-colors',
                    isActive ? 'text-emerald-400' : 'text-slate-400'
                  )}
                >
                  <div
                    className={cn(
                      'mb-0.5 flex h-8 w-8 items-center justify-center rounded-2xl border text-[0px] transition-all',
                      isActive
                        ? 'border-emerald-400/70 bg-emerald-500/10 text-emerald-400'
                        : 'border-slate-700 bg-slate-900 text-slate-300'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{item.label}</span>
                  {item.isCart && cartCount > 0 && (
                    <span
                      aria-label={`${cartCount} item${cartCount === 1 ? '' : 's'} in cart`}
                      className="absolute top-1 right-3 inline-flex h-4 min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white shadow-lg border border-slate-950"
                    >
                      {displayCartBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

