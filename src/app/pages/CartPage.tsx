import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { cn, getRoundedClass } from '@/lib/utils';
import { estimateCartLineTotalsWithTierDiscount } from '@/lib/pricing';

import { useStore, type CartItem } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';

interface CartPageProps {
  items: CartItem[];
  onUpdateQuantity: (id: string | number, change: number) => void;
  onRemoveItem: (id: string | number) => void;
}


// Threshold is now dynamic from preferences.freeDeliveryThreshold
// const FREE_SHIPPING_THRESHOLD = 500;

export function CartPage({ items, onUpdateQuantity, onRemoveItem }: CartPageProps) {
  const { products, taxRates, theme, preferences } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pricingEstimate = estimateCartLineTotalsWithTierDiscount(items as any, products as any);
  const subtotal = pricingEstimate.subtotal;
  const threshold = Number(preferences.freeDeliveryThreshold) || 0;
  // Cart summary shows provisional shipping only; final shipping is calculated at checkout.
  const shipping = 0;

  // Dynamic Tax Calculation based on Category
  const calculatedTax = items.reduce((totalTax: number, item: CartItem) => {
    const matchedProduct = products.find((p) =>
      String(p.id) === String(item.productId ?? item.id)
    );
    const category = String(matchedProduct?.category || '').trim();
    const rate = category ? Number(taxRates[category] ?? taxRates[category.toLowerCase()] ?? taxRates[category.toUpperCase()] ?? 0) : 0;
    const lineKey = `${String(item.id)}::${String(item.selectedVariantSku || item.selectedVariantId || '')}`;
    const lineAmount = Number(pricingEstimate.lineTotals[lineKey] ?? (item.price * item.quantity));
    return totalTax + (lineAmount * (rate / 100));
  }, 0);

  const total = subtotal + shipping + calculatedTax;

  // Important: keep hooks before any conditional returns to avoid React hook order errors.
  const groupedItems = useMemo(() => {
    return items.reduce((acc: Record<string, CartItem[]>, item: CartItem) => {
      const vendor = item.vendor || 'The Fruit Tribe';
      if (!acc[vendor]) acc[vendor] = [];
      acc[vendor].push(item);
      return acc;
    }, {});
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="pt-20 pb-16 min-h-screen bg-gradient-to-b from-white to-orange-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-16 h-16 text-orange-400" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Your cart is empty</h1>
          <p className="text-gray-600 mb-8">Looks like you haven't added anything to your cart yet.</p>
          <Link to="/products">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto",
                getRoundedClass(theme.buttonStyle)
              )}
            >
              Start Shopping
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-16 min-h-screen bg-gradient-to-b from-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">
          <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Shopping Cart
          </span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items grouped by Merchant */}
          <div className="lg:col-span-2 space-y-12 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-2">
            {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([vendor, vendorItems], vIdx) => (
              <div key={vendor} className="space-y-6">
                <div className="flex items-center gap-3 pb-2 border-b border-orange-100">
                  <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center text-[10px] font-black text-emerald-400">
                    {vendor.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">{vendor} Cluster</h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">In stock</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {vendorItems.map((item: CartItem, index: number) => (
                    (() => {
                      const lineKey = `${String(item.id)}::${String(item.selectedVariantSku || item.selectedVariantId || '')}`;
                      const lineTotal = Number(
                        pricingEstimate.lineTotals[lineKey] ?? (Number(item.price || 0) * Number(item.quantity || 0)),
                      );
                      return (
                    <motion.div
                      key={`${item.id}-${item.selectedVariantSku || 'default'}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (vIdx * 0.1) + (index * 0.05) }}
                      className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col sm:flex-row gap-4 sm:gap-6 border border-slate-50"
                    >
                      {/* Image */}
                      <div className="w-full sm:w-32 h-48 sm:h-32 rounded-xl overflow-hidden flex-shrink-0 relative group">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-xl font-bold text-gray-800 truncate pr-4">{item.name}</h3>
                            {item.selectedVariantName && (
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                                Pack: {item.selectedVariantName}
                              </p>
                            )}
                            {item.selectedVariantPackQty && item.selectedVariantPackQty > 1 && (
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                                1 pack = {item.selectedVariantPackQty} {item.selectedVariantPackUnit || 'kg'}
                              </p>
                            )}
                            {item.vendor && <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Assigned Vendor: {item.vendor}</span>}
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onRemoveItem(lineKey)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </motion.button>
                        </div>

                        <p className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-1">
                          ₹{item.price.toFixed(2)}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 mb-4">
                          per unit · Line total ₹{lineTotal.toFixed(2)}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-4 mt-auto">
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-xl">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                if (item.quantity <= 1) {
                                  onRemoveItem(lineKey);
                                } else {
                                  onUpdateQuantity(lineKey, -1);
                                }
                              }}
                              className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all border border-gray-100"
                            >
                              <Minus className="w-5 h-5 text-gray-600" />
                            </motion.button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  onUpdateQuantity(lineKey, -item.quantity); // Temporary state effectively 0
                                  return;
                                }
                                const num = parseInt(val);
                                if (!isNaN(num)) {
                                  // Find product to check stock
                                  const product = products.find(p => p.id === item.id);
                                  const maxStock = product?.availableStock ?? product?.stock ?? 999;
                                  const target = Math.min(maxStock, Math.max(0, num));
                                  onUpdateQuantity(lineKey, target - item.quantity);
                                }
                              }}
                              onBlur={() => {
                                if (item.quantity < 1) {
                                  onUpdateQuantity(lineKey, 1 - item.quantity);
                                }
                              }}
                              className="w-10 text-center text-lg font-bold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0"
                            />
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                const product = products.find(p => p.id === item.id);
                                const avail = product?.availableStock ?? product?.stock ?? 0;
                                if (!product || item.quantity < avail) {
                                  onUpdateQuantity(lineKey, 1);
                                } else {
                                  toast.error(`Only ${avail} units available`);
                                }
                              }}
                              className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all border border-gray-100"
                            >
                              <Plus className="w-5 h-5 text-gray-600" />
                            </motion.button>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Subtotal</p>
                            <p className="text-xl font-black text-gray-900">
                              ₹{lineTotal.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                      );
                    })()
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-6 shadow-lg sticky top-24"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span className="font-semibold">₹{calculatedTax.toFixed(2)}</span>
                </div>
                {threshold > 0 && subtotal > 0 && subtotal < threshold && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg"
                  >
                    Add ₹{(threshold - subtotal).toFixed(2)} more for free shipping!
                  </motion.p>
                )}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-800">Total</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (!user) {
                    toast.info('Please sign in to continue checkout.');
                    navigate('/login', { state: { from: '/cart' } });
                    return;
                  }
                  navigate('/checkout');
                }}
                className={cn(
                  "w-full py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mb-4",
                  getRoundedClass(theme.buttonStyle)
                )}
              >
                Proceed to Checkout
                <ArrowRight className="w-5 h-5" />
              </motion.button>

              <Link to="/products">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full py-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all",
                    getRoundedClass(theme.buttonStyle)
                  )}
                >
                  Continue Shopping
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
