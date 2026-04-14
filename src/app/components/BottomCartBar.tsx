import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { cn, getRoundedClass } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

export function BottomCartBar() {
  const { cartItems, setIsCartOpen, theme } = useStore();
  const location = useLocation();
  
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Don't show if cart is empty or we are on cart/checkout pages
  if (totalItems === 0 || ['/cart', '/checkout'].includes(location.pathname)) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="fixed bottom-[88px] left-0 right-0 z-[130] px-4 pointer-events-none md:hidden"
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCartOpen(true)}
            className={cn(
              "w-full h-14 bg-emerald-600 text-white shadow-[0_8px_30px_rgb(16,185,129,0.3)] flex items-center justify-between px-5",
              getRoundedClass(theme.buttonStyle || 'Pill')
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start leading-none gap-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
                <span className="text-lg font-black tracking-tight">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-100">View Cart</span>
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <ChevronRight className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
