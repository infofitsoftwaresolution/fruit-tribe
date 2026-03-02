import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, Star, ShieldCheck, Zap, ArrowRight, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  id: string | number;
  name: string;
  price: number;
  stock: number;
  image: string;
  description?: string;
  badge?: string;
  isSeasonal?: boolean;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  onAddToCart: (id: string | number) => void;
  /** When provided, onAddToCart will be called with this product (for API-driven cart) */
  product?: import('@/lib/api').Product;
}

export const ProductCard = memo(({ id, name, price, stock, image, description, badge, isSeasonal, bulkDiscountQty, bulkDiscountPrice, onAddToCart, product }: ProductCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const { user } = useAuth();
  const { theme } = useStore();
  const navigate = useNavigate();

  const handleAction = (callback: () => void) => {
    if (!user) {
toast.error('Please sign in', {
      description: 'Sign in to add items to your cart.',
      action: {
        label: 'Sign in',
        onClick: () => navigate('/login')
      }
    });
      return;
    }
    callback();
  };

  const isOutOfStock = stock <= 0;

  return (
    <motion.div
      whileHover={{ y: -12 }}
      className="relative bg-white rounded-[3rem] overflow-hidden border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] hover:shadow-[0_40px_100px_rgba(16,185,129,0.1)] transition-all duration-700 group flex flex-col h-full"
    >
      {/* High-Fidelity Badge System */}
      <AnimatePresence>
        {badge && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-slate-900 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {badge}
          </motion.div>
        )}
        {isSeasonal && !badge && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-blue-600 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl"
          >
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
            Seasonal
          </motion.div>
        )}
      </AnimatePresence>

      {/* Acquisition Actions HUD */}
      <div className="absolute top-6 right-6 z-30 space-y-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
        <motion.button
          whileHover={{ scale: 1.1, rotate: -12 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleAction(() => setIsLiked(!isLiked))}
          className={cn(
            "h-12 w-12 flex items-center justify-center rounded-2xl shadow-xl transition-all border border-white/20",
            isLiked ? "bg-red-500 text-white" : "bg-white/80 backdrop-blur-md text-slate-400 hover:text-red-500"
          )}
        >
          <Heart className={cn("w-5 h-5", isLiked ? "fill-white" : "")} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1, rotate: 12 }}
          className="h-12 w-12 bg-white/80 backdrop-blur-md border border-white/20 text-slate-400 hover:text-emerald-500 flex items-center justify-center rounded-2xl shadow-xl transition-all"
        >
          <Activity className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Immersive Visual Asset Box */}
      <Link to={`/product/${id}`} className="relative h-80 overflow-hidden bg-slate-50 block shrink-0">
        <motion.img
          src={image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800'}
          alt={name}
          className={cn(
            "w-full h-full object-cover transition-all duration-[2s] group-hover:scale-110",
            isOutOfStock ? "grayscale opacity-40" : ""
          )}
          whileHover={{ rotate: 1 }}
        />

        {/* Global Stock Protocol Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[2px]">
            <div className="bg-slate-900/90 text-white px-8 h-12 flex items-center justify-center rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] border border-white/10 shadow-3xl backdrop-blur-xl">
              Out of stock
            </div>
          </div>
        )}

        {/* Cinematic Gradient HUD */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      </Link>

      {/* Intelligence & Telemetry Content */}
      <div className="p-8 flex flex-col flex-1 relative">
        {/* Rating Topology */}
        <div className="flex items-center gap-1.5 mb-6 shrink-0">
          <div className="flex -space-x-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-3.5 h-3.5",
                  i < 4 ? "fill-emerald-500 text-emerald-500" : "fill-slate-100 text-slate-100"
                )}
              />
            ))}
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-2">Rated 4.8</span>
        </div>

        <div className="flex-1 space-y-3">
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-tight group-hover:text-emerald-600 transition-colors">
            {name}
          </h3>

          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed line-clamp-2 min-h-[2.5rem]">
            {description || 'Fresh and quality assured.'}
          </p>
        </div>

        {/* Transaction Rail */}
        <div className="flex items-center justify-between gap-6 mt-10 pt-8 border-t border-slate-50">
          <div className="shrink-0 space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mr-1">INR</span>
              <span className={cn(
                "text-3xl font-black tracking-tighter transition-colors",
                isOutOfStock ? "text-slate-300" : "text-slate-900 group-hover:text-emerald-500"
              )}>
                {price}
              </span>
            </div>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wider italic">per kg</p>
            {bulkDiscountQty && bulkDiscountPrice && (
              <div className="mt-2 py-1 px-3 bg-emerald-50 rounded-lg inline-block border border-emerald-100/50">
                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider whitespace-nowrap">
                  Bulk: ₹{bulkDiscountPrice}/kg for {bulkDiscountQty}+ units
                </span>
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: isOutOfStock ? 1 : 1.05, x: 5 }}
            whileTap={{ scale: isOutOfStock ? 1 : 0.95 }}
            disabled={isOutOfStock}
            onClick={(e) => {
              e.preventDefault();
              const payload = product ?? id;
              !isOutOfStock && handleAction(() => onAddToCart(payload as any));
            }}
            className={cn(
              "h-16 px-8 flex items-center gap-4 transition-all duration-500 shadow-2xl",
              isOutOfStock
                ? "bg-slate-50 text-slate-200 cursor-not-allowed shadow-none"
                : "bg-slate-900 text-white hover:bg-emerald-500 rounded-[1.75rem]"
            )}
          >
            <div className="h-8 w-8 bg-white/10 rounded-xl flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              {isOutOfStock ? 'Out of stock' : 'Add to cart'}
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});
ProductCard.displayName = 'ProductCard';
