import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, getRoundedClass } from '@/lib/utils';
import { toast } from 'sonner';

interface CartItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string | number, change: number) => void;
  onRemoveItem: (id: string | number) => void;
}

import { useStore } from '@/app/context/StoreContext';

// Threshold is now dynamic from preferences.freeDeliveryThreshold
// const FREE_SHIPPING_THRESHOLD = 500;

export function CartDrawer({ isOpen, onClose, items, onUpdateQuantity, onRemoveItem }: CartDrawerProps) {
  const { products, taxRates, theme, preferences } = useStore();
  const navigate = useNavigate();
  const subtotal = items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
  const deliveryCharge = Number(preferences.deliveryCharge) ?? 49;
  const threshold = Number(preferences.freeDeliveryThreshold) || 0;
  const shipping = (threshold > 0 && subtotal >= threshold) ? 0 : deliveryCharge;

  // Dynamic Tax Calculation based on Category
  const calculatedTax = items.reduce((totalTax: number, item: CartItem) => {
    const product = products.find(p => p.id === item.id);
    const category = product?.category || 'Fruits';
    const rate = taxRates[category] || 0;
    return totalTax + (item.price * item.quantity * (rate / 100));
  }, 0);

  const total = subtotal + shipping + calculatedTax;

  const handleViewCart = () => {
    onClose();
    navigate('/cart');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[140]"
          />

          {/* Drawer / Sheet */}
          <motion.div
            initial={{ y: '100%', x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: '100%', x: 0 }}
            variants={{
              mobile: { y: '100%', x: 0 },
              desktop: { x: '100%', y: 0 }
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed bg-white shadow-2xl z-[150] flex flex-col focus:outline-none",
              "bottom-0 left-0 right-0 h-[92dvh] rounded-t-[2.5rem]", // Mobile default (Sheet)
              "md:top-0 md:right-0 md:left-auto md:h-full md:w-full md:max-w-md md:rounded-l-[2rem] md:rounded-tr-none" // Desktop (Drawer)
            )}
          >
            {/* Mobile Sheet Handle */}
            <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-600 to-amber-600 rounded-full flex items-center justify-center shadow-md">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Shopping Cart</h2>
                  <p className="text-sm text-gray-600">{items.length} items</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </motion.button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar min-h-0">
              {items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center mb-4">
                    <ShoppingBag className="w-12 h-12 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Your cart is empty</h3>
                  <p className="text-gray-600 mb-6">Add some delicious fruits!</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onClose();
                      navigate('/products');
                    }}
                    className={cn(
                      "px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold shadow-lg",
                      getRoundedClass(theme.buttonStyle)
                    )}
                  >
                    Start Shopping
                  </motion.button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-gradient-to-r from-gray-50 to-orange-50/30 rounded-2xl p-3 sm:p-4 flex gap-3 sm:gap-4 shadow-md"
                    >
                      {/* Image */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 mb-1 truncate">{item.name}</h3>
                        <p className="text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
                          ₹{item.price.toFixed(2)}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <motion.button
                               whileHover={{ scale: 1.1 }}
                               whileTap={{ scale: 0.9 }}
                               onClick={() => {
                                 if (item.quantity <= 1) {
                                   onRemoveItem(item.id);
                                 } else {
                                   onUpdateQuantity(item.id, -1);
                                 }
                               }}
                               className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all border border-gray-200"
                             >
                               <Minus className="w-4 h-4 text-gray-600" />
                             </motion.button>
                            <input
                               type="text"
                               inputMode="numeric"
                               value={item.quantity}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 if (val === '') {
                                   onUpdateQuantity(item.id, -item.quantity);
                                   return;
                                 }
                                  const num = parseInt(val);
                                  if (!isNaN(num)) {
                                    const product = products.find(p => p.id === item.id);
                                    const maxStock = product?.availableStock ?? product?.stock ?? 999;
                                    const target = Math.min(maxStock, Math.max(0, num));
                                    onUpdateQuantity(item.id, target - item.quantity);
                                  }
                               }}
                               onBlur={() => {
                                 if (item.quantity < 1) {
                                   onUpdateQuantity(item.id, 1 - item.quantity);
                                 }
                               }}
                               className="w-10 text-center font-semibold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 text-base"
                             />
                             <motion.button
                               whileHover={{ scale: 1.1 }}
                               whileTap={{ scale: 0.9 }}
                               onClick={() => {
                                 const product = products.find(p => p.id === item.id);
                                 const maxAvailable = product?.availableStock ?? product?.stock ?? 0;
                                 if (!product || item.quantity < maxAvailable) {
                                   onUpdateQuantity(item.id, 1);
                                 } else {
                                   toast.error(`Only ${maxAvailable} units available`);
                                 }
                               }}
                               className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all border border-gray-200"
                             >
                               <Plus className="w-4 h-4 text-gray-600" />
                             </motion.button>
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onRemoveItem(item.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-gray-200 p-3 sm:p-6 bg-gradient-to-r from-orange-50 to-amber-50 shrink-0 mt-auto">
                {/* Summary */}
                <div className="space-y-1.5 sm:space-y-3 mb-3 sm:mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold text-gray-800">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping:</span>
                    <span className="font-semibold text-gray-800">
                      {shipping === 0 ? (
                        <span className="text-green-600">FREE</span>
                      ) : (
                        `₹${shipping.toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-semibold text-gray-800">₹{calculatedTax.toFixed(2)}</span>
                  </div>
                  {threshold > 0 && subtotal > 0 && subtotal < threshold && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg"
                    >
                      Add ₹{(threshold - subtotal).toFixed(2)} more for free shipping!
                    </motion.p>
                  )}
                  <div className="border-t border-gray-300 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">Total:</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                        ₹{total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 sm:gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className={cn(
                      "flex-1 min-h-[44px] py-2 bg-white border border-gray-200 text-gray-700 text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-all",
                      getRoundedClass(theme.buttonStyle)
                    )}
                  >
                    Close
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleViewCart}
                    className={cn(
                      "flex-[2] min-h-[44px] py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs sm:text-sm font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-1 sm:gap-2",
                      getRoundedClass(theme.buttonStyle)
                    )}
                  >
                    View Cart
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
