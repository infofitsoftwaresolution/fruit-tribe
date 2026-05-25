import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { cn, getRoundedClass } from '@/lib/utils';
import { estimateCartLineTotalsWithTierDiscount } from '@/lib/pricing';
import { formatFreeDeliveryHint } from '@/lib/deliveryFeeUtils';
import { PRODUCT_PLACEHOLDER_IMAGE } from '@/lib/productPlaceholder';

import { useStore, type CartItem } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';

interface CartPageProps {
  items: CartItem[];
  onUpdateQuantity: (id: string | number, change: number) => void;
  onRemoveItem: (id: string | number) => void;
}

export function CartPage({ items, onUpdateQuantity, onRemoveItem }: CartPageProps) {
  const { products, taxRates, theme, preferences } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pricingEstimate = estimateCartLineTotalsWithTierDiscount(items as any, products as any);
  const subtotal = pricingEstimate.subtotal;
  const threshold = Number(preferences.freeDeliveryThreshold) || 0;
  const freeWithinKm = Number(preferences.freeDeliveryWithinKm) || 0;
  const freeDeliveryHint = formatFreeDeliveryHint(threshold, freeWithinKm);
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
      <div className="pt-24 pb-16 min-h-screen bg-slate-50/50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full bg-white border border-zinc-200/50 p-8 sm:p-10 rounded-3xl shadow-sm"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <ShoppingBag className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Your cart is empty</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Looks like you haven't added anything to your cart yet. Explore our fresh collection and find something delightful.
          </p>
          <Link to="/products">
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-bold shadow-sm shadow-orange-500/10 hover:shadow-lg hover:shadow-orange-500/20 transition-all flex items-center justify-center gap-2",
                getRoundedClass(theme.buttonStyle)
              )}
            >
              Start Shopping
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Shopping Cart
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Review your items and proceed to secure checkout.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-4 py-2 rounded-xl border border-zinc-200/50 shadow-sm w-fit">
            <span className="font-bold text-slate-900">{items.length}</span> {items.length === 1 ? 'item' : 'items'} in your cart
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Cart Items list grouped by Merchant */}
          <div className="lg:col-span-2 space-y-8">
            {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([vendor, vendorItems], vIdx) => (
              <div key={vendor} className="bg-white rounded-2xl border border-zinc-200/50 shadow-sm overflow-hidden">
                {/* Merchant Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-zinc-50/70 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 bg-slate-900 rounded-lg flex items-center justify-center text-[10px] font-black text-emerald-400 shadow-sm">
                      {vendor.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">{vendor}</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Verified Partner Merchant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">In Stock</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="divide-y divide-zinc-100">
                  {vendorItems.map((item: CartItem, index: number) => {
                    const lineKey = `${String(item.id)}::${String(item.selectedVariantSku || item.selectedVariantId || '')}`;
                    const lineTotal = Number(
                      pricingEstimate.lineTotals[lineKey] ?? (Number(item.price || 0) * Number(item.quantity || 0)),
                    );

                    return (
                      <motion.div
                        key={lineKey}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (vIdx * 0.08) + (index * 0.04) }}
                        className="p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center hover:bg-zinc-50/20 transition-colors duration-150"
                      >
                        {/* Image Thumbnail */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-zinc-200/60 overflow-hidden flex-shrink-0 relative group bg-zinc-50">
                          <img
                            src={(item.image || '').trim() || PRODUCT_PLACEHOLDER_IMAGE}
                            alt={item.name}
                            onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER_IMAGE; }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>

                        {/* Middle details column */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate leading-snug hover:text-orange-600 transition-colors">
                                {item.name}
                              </h3>
                              
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 items-center">
                                {item.selectedVariantName && (
                                  <span className="text-[10px] font-extrabold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                    Pack: {item.selectedVariantName}
                                  </span>
                                )}
                                {item.selectedVariantPackQty && item.selectedVariantPackQty > 1 && (
                                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                    1 pack = {item.selectedVariantPackQty} {item.selectedVariantPackUnit || 'kg'}
                                  </span>
                                )}
                                {item.vendor && (
                                  <span className="text-[9px] font-black text-emerald-600/80 uppercase tracking-widest">
                                    {item.vendor}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Controls Column (desktop horizontal, mobile wrapped) */}
                        <div className="w-full sm:w-auto flex flex-row items-center justify-between sm:justify-end gap-4 sm:gap-8 mt-4 sm:mt-0 pt-3 sm:pt-0 border-t border-zinc-100 sm:border-t-0 flex-shrink-0">
                          {/* Unit pricing */}
                          <div className="hidden sm:block text-right">
                            <p className="text-sm font-semibold text-slate-900">₹{item.price.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Per Unit</p>
                          </div>

                          {/* Refined Quantity Widget */}
                          <div className="flex items-center gap-1 bg-zinc-100/80 p-0.5 rounded-lg border border-zinc-200/40">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                if (item.quantity <= 1) {
                                  onRemoveItem(lineKey);
                                } else {
                                  onUpdateQuantity(lineKey, -1);
                                }
                              }}
                              className="w-7 h-7 bg-white rounded-md flex items-center justify-center shadow-sm hover:bg-zinc-50 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5 text-zinc-600" />
                            </motion.button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  onUpdateQuantity(lineKey, -item.quantity);
                                  return;
                                }
                                const num = parseInt(val);
                                if (!isNaN(num)) {
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
                              className="w-8 text-center text-sm font-bold text-zinc-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                            />
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const product = products.find(p => p.id === item.id);
                                const avail = product?.availableStock ?? product?.stock ?? 0;
                                if (!product || item.quantity < avail) {
                                  onUpdateQuantity(lineKey, 1);
                                } else {
                                  toast.error(`Only ${avail} units available`);
                                }
                              }}
                              className="w-7 h-7 bg-white rounded-md flex items-center justify-center shadow-sm hover:bg-zinc-50 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5 text-zinc-600" />
                            </motion.button>
                          </div>

                          {/* Line total */}
                          <div className="text-right min-w-[70px]">
                            <p className="text-sm font-black text-slate-900">₹{lineTotal.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider sm:hidden">Total</p>
                          </div>

                          {/* Deletion Icon */}
                          <motion.button
                            whileHover={{ scale: 1.1, rotate: 3 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onRemoveItem(lineKey)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Sticky Order Summary Invoice panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-zinc-200/50 shadow-sm p-6 sticky top-28"
            >
              <h2 className="text-xl font-bold text-slate-900 mb-5 pb-3 border-b border-zinc-100 flex items-center gap-2">
                Order Summary
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Provisional Taxes</span>
                  <span className="font-bold text-slate-800">₹{calculatedTax.toFixed(2)}</span>
                </div>
                {shipping > 0 ? (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Shipping</span>
                    <span className="font-bold text-slate-800">₹{shipping.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Provisional Shipping</span>
                    <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded tracking-wide uppercase">FREE</span>
                  </div>
                )}

                {/* Free Shipping Dynamic Progress Tracker */}
                {threshold > 0 && subtotal > 0 && (
                  <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3.5 space-y-2 mt-2">
                    {subtotal >= threshold ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Congrats! You've unlocked free delivery.
                        </div>
                        <div className="h-1.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600 font-medium">
                          Add <span className="font-bold text-orange-600">₹{(threshold - subtotal).toFixed(2)}</span> more to unlock <span className="font-bold text-emerald-600">Free Delivery</span>!
                        </p>
                        <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (subtotal / threshold) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    )}
                    {freeDeliveryHint && (
                      <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">{freeDeliveryHint}</p>
                    )}
                  </div>
                )}

                <div className="border-t border-zinc-100 pt-4 mt-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-base font-bold text-slate-800">Total Amount</span>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Calculated with delivery address at next step</p>
                    </div>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
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
                    "w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold shadow-sm shadow-orange-500/10 hover:shadow-lg hover:shadow-orange-500/25 transition-all flex items-center justify-center gap-2",
                    getRoundedClass(theme.buttonStyle)
                  )}
                >
                  Proceed to Checkout
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <Link to="/products" className="block">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full py-3 bg-white border border-zinc-200 text-slate-700 font-bold hover:bg-zinc-50 transition-all",
                      getRoundedClass(theme.buttonStyle)
                    )}
                  >
                    Continue Shopping
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
