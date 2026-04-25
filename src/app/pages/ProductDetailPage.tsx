import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, Star, Minus, Plus, Truck, Shield, ShieldCheck, Check, Clock, Zap, Leaf, Activity, ChevronRight, Share2, Info, TrendingUp, Calendar, Binary } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useProduct } from '@/app/hooks/useProducts';
import type { Product } from '@/lib/api';
import { toast } from 'sonner';
import { NotFoundPage } from './NotFoundPage';
import { AIRecommendations } from '@/app/components/AIRecommendations';
import { BulkInquiryForm } from '@/app/components/BulkInquiryForm';
import { cn, getRoundedClass, formatInr } from '@/lib/utils';
import { productHasBulkPricing, getRetailUnitReference } from '@/lib/pricing';

interface ProductDetailPageProps {
  onAddToCart: (product: Product, quantity?: number) => void;
}

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const { theme } = useStore();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { product: apiProduct, loading, error } = useProduct(id || null);
  const [quantity, setQuantity] = useState(1);
  const [packKind, setPackKind] = useState<'retail' | 'bulk'>('retail');
  const [isLiked, setIsLiked] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);

  const productId = id || '';

  const handleAction = (callback: () => void) => {
    if (!user) {
      toast.info('Saved in cart', {
        description: 'Your cart is saved on this device. Sign in at checkout to place the order.',
        action: {
          label: 'Sign in',
          onClick: () => navigate('/login')
        }
      });
    }
    callback();
  };

  const product = useMemo(() => {
    if (!apiProduct) return null;

    const variantData = activeVariant && apiProduct.variants
      ? apiProduct.variants.find(v => v.sku === activeVariant)
      : null;

    const sellPrice = variantData
      ? variantData.price
      : getRetailUnitReference(apiProduct);

    return {
      ...apiProduct,
      /** Base price from catalog (bulk math uses this + variants). */
      price: apiProduct.price,
      /** Unit price for the selected variant (or cheapest retail). */
      sellPrice,
      stock: variantData ? variantData.stock : apiProduct.stock,
      availableStock: variantData ? variantData.availableStock : apiProduct.availableStock,
      lowStockThreshold: apiProduct.lowStockThreshold || 10,
      sku: variantData ? variantData.sku : apiProduct.sku,
      fullDescription: apiProduct.description || `Fresh ${apiProduct.name} from our partners. Sourced with care by ${apiProduct.vendor}.`,
      origin: apiProduct.origin || 'Trusted orchard',
      highlights: [
        apiProduct.isOrganic ? 'Organic' : null,
        apiProduct.origin ? `Origin: ${apiProduct.origin}` : null,
        apiProduct.isSeasonal ? 'Seasonal produce' : null,
        apiProduct.allowCashOnDelivery !== false ? 'Cash on delivery available' : null,
        apiProduct.harvestDate ? `Harvest date: ${new Date(apiProduct.harvestDate).toLocaleDateString('en-IN')}` : null,
      ].filter(Boolean),
    };
  }, [apiProduct, activeVariant]);

  useEffect(() => {
    if (product && !activeImage) {
      setActiveImage(product.image || (product.images && product.images[0]) || null);
    }
  }, [product, activeImage]);

  useEffect(() => {
    setPackKind('retail');
    setQuantity(1);
  }, [productId]);

  if (loading) {
    return (
      <div className="pt-32 pb-32 min-h-screen flex items-center justify-center">
        <p className="text-slate-500 font-bold uppercase tracking-widest">Loading product…</p>
      </div>
    );
  }
  if (error || !product || !apiProduct) {
    return <NotFoundPage />;
  }

  const hasBulk = productHasBulkPricing(apiProduct);
  const bulkQty = product.bulkDiscountQty;
  const bulkPriceVal = product.bulkDiscountPrice;
  const bulkPackTotal =
    hasBulk && bulkPriceVal != null && Number(bulkPriceVal) > 0
      ? Number(bulkPriceVal)
      : null;
  const bulkDerivedUnitPrice =
    bulkPackTotal != null && bulkQty && bulkQty > 0
      ? bulkPackTotal / bulkQty
      : null;
  const effectiveQty =
    hasBulk && packKind === 'bulk' && bulkQty && bulkQty > 0 ? bulkQty : 1;

  const handleAddToCart = () => {
    handleAction(() => {
      const safeQty = hasBulk
        ? effectiveQty
        : Math.max(1, Math.min(quantity, product.stock || quantity));
      if (safeQty > (product.stock || 0)) {
        toast.error(`Only ${product.stock} units available`);
        return;
      }
      onAddToCart(
        {
          ...apiProduct,
          availableStock: product.availableStock,
          stock: product.stock,
        },
        safeQty,
      );
      toast.success(`${product.name} added to cart!`, {
        description: `Quantity: ${safeQty}. ${activeVariant ? 'Variant selected' : 'Standard product'}.`,
        icon: <Zap className="w-4 h-4 text-emerald-500" />
      });
    });
  };

  const images = [
    product.image,
    ...(product.images || [])
  ].filter(Boolean) as string[];

  return (
    <div className="pt-20 sm:pt-24 pb-28 sm:pb-16 min-h-screen bg-slate-50 selection:bg-emerald-500 selection:text-white">
      {/* Background Architectural Manifold */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-15">
        <div className="absolute top-0 right-0 h-[1000px] w-[1000px] bg-emerald-500/5 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 left-0 h-[1000px] w-[1000px] bg-slate-900/5 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb HUD */}
        <nav className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-semibold text-slate-500 mb-6 sm:mb-8">
          <Link to="/" className="hover:text-emerald-600 transition-colors flex items-center gap-2">
            Home <ChevronRight className="w-3 h-3" />
          </Link>
          <Link to="/products" className="hover:text-emerald-600 transition-colors flex items-center gap-2">
            Catalog <ChevronRight className="w-3 h-3" />
          </Link>
          <span className="text-slate-900 truncate">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-12 gap-6 sm:gap-10 relative">
          {/* Visual Asset Manifold */}
          <div className="lg:col-span-12 xl:col-span-7 space-y-4 xl:sticky xl:top-24 self-start">
            <div className="flex flex-col xl:flex-row gap-4">
              {/* Image Thumbnails Rail */}
              <div className="flex xl:flex-col gap-3 overflow-x-auto xl:overflow-y-auto no-scrollbar max-h-[640px] pb-3 xl:pb-0">
                {images.map((img, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveImage(img)}
                    className={cn(
                      "relative w-20 h-20 rounded-2xl overflow-hidden border transition-all p-1.5 bg-white shrink-0",
                      activeImage === img ? "border-emerald-500 shadow-xl" : "border-slate-100 hover:border-slate-300"
                    )}
                  >
                    <img src={img} className="w-full h-full object-cover rounded-2xl" />
                  </motion.button>
                ))}
              </div>

              {/* Primary Visual Feed — image fills whole card */}
              <div className="flex-1 relative aspect-square xl:aspect-auto xl:h-[640px] rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 group shadow-sm">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeImage}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.6 }}
                    src={activeImage || ''}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                </AnimatePresence>

                {/* Status Overlays */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.badge && (
                    <div className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-semibold rounded-xl border border-white/10 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-emerald-500" />
                      {product.badge}
                    </div>
                  )}
                  {product.isSeasonal && (
                    <div className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded-xl border border-white/10 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Seasonal pick
                    </div>
                  )}
                </div>

                <div className="absolute bottom-4 right-4 flex gap-2.5">
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: -12 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleAction(() => setIsLiked(!isLiked))}
                    className={cn(
                      "p-3.5 rounded-2xl shadow-lg backdrop-blur-xl border border-white/20 transition-all",
                      isLiked ? "bg-red-500 text-white" : "bg-white/80 text-slate-400 hover:text-red-500"
                    )}
                  >
                    <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 12 }}
                    className="p-3.5 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 text-slate-400 hover:text-blue-500 transition-all"
                  >
                    <Share2 className="w-6 h-6" />
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Intelligence Content */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-7">
            {/* Product header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-lg border border-emerald-100">
                    {product.category}
                  </span>
                  <div className="px-3 py-1 bg-slate-900 border border-white/10 rounded-lg text-[10px] font-semibold text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3" />
                    Verified seller
                  </div>
                  {product.isOrganic && (
                    <span className="px-3 py-1 bg-sky-50 text-sky-600 text-[10px] font-semibold rounded-lg border border-sky-100">
                      Organic
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                  <Binary className="w-4 h-4" />
                  SKU: {product.sku}
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
                {product.name}
              </h1>

              {/* Multi-Scalar Variant Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Binary className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Option</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setActiveVariant(null)}
                      className={cn(
                        "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                        activeVariant === null ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                      )}
                    >
                      Default
                    </button>
                    {product.variants
                      .filter((variant: any) => String(variant.name || '').trim().toLowerCase() !== 'default')
                      .map((variant: any) => (
                      <button
                        key={variant.sku}
                        onClick={() => setActiveVariant(variant.sku)}
                        className={cn(
                          "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                          activeVariant === variant.sku ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                        )}
                      >
                        {variant.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-6 pt-2">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Provider:</p>
                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.25em] bg-emerald-50 px-3 py-1 rounded-lg">{product.vendor}</p>
                </div>
              </div>
            </div>

            {/* Pricing and stock */}
            <div className="bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-white/10 shadow-xl space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Activity className="h-20 w-20 text-emerald-500" />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">{formatInr(product.sellPrice)}</span>
                    <span className="text-emerald-500/60 font-black uppercase text-xs tracking-[0.2em] italic">/ {product.unit || 'kg'}</span>
                  </div>
                  {product.discountPrice && (
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 line-through text-lg font-bold">{formatInr(product.discountPrice)}</span>
                      <span className="text-emerald-400 font-black text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                        Save {Math.round((1 - product.sellPrice / product.discountPrice) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Stock Status</span>
                  {(() => {
                    const avail = product.availableStock;
                    const lowStock = avail > 0 && avail <= (product.lowStockThreshold || 10);
                    const outOfStock = avail <= 0;
                    
                    return (
                      <div className={cn(
                        "flex items-center gap-3 py-2 px-5 rounded-2xl border transition-all",
                        outOfStock 
                          ? "bg-red-500/10 border-red-500/20 text-red-500" 
                          : lowStock 
                            ? "bg-orange-500/10 border-orange-500/20 text-orange-500"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                      )}>
                        <div className={cn(
                          "h-2.5 w-2.5 rounded-full", 
                          outOfStock 
                            ? "bg-red-500" 
                            : lowStock 
                              ? "bg-orange-500 animate-pulse"
                              : "bg-emerald-500 animate-pulse"
                        )}></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {outOfStock ? 'Out of stock' : lowStock ? `Low stock: ${avail} left` : `${avail} units in stock`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bulk / quantity */}
              {hasBulk && (
                <div className="relative z-10 p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Bulk Deal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Bulk Pack Price</p>
                      <p className="text-xl font-black text-emerald-400 tracking-tighter">
                        {formatInr(Number(product.bulkDiscountPrice))}
                        <span className="text-[10px]"> total</span>
                      </p>
                      {bulkDerivedUnitPrice != null && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          Effective unit: {formatInr(bulkDerivedUnitPrice)}/{product.unit || 'unit'}
                        </p>
                      )}
                    </div>
                    <div className="h-10 w-[1px] bg-white/10" />
                    <div className="space-y-1 text-right">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Threshold</p>
                      <p className="text-xl font-black text-white tracking-tighter">{product.bulkDiscountQty}+ <span className="text-[10px]">units</span></p>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative z-10 space-y-4 pt-3 border-t border-white/5">
                <Link
                  to={`/contact?topic=bulk-order&product=${encodeURIComponent(product.name)}`}
                  className="inline-flex items-center text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
                >
                  Need more quantity? Contact us
                </Link>

                {hasBulk && (
                    <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select pack</span>
                    <select
                      value={packKind}
                      onChange={(e) => setPackKind(e.target.value as 'retail' | 'bulk')}
                      disabled={product.stock <= 0}
                      className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="retail" className="text-slate-900">
                        1 {product.unit || 'unit'} · {formatInr(product.sellPrice)} each
                      </option>
                      {bulkQty != null && bulkPriceVal != null && (
                        <option value="bulk" className="text-slate-900">
                          {bulkQty} {product.unit || 'units'} pack · {formatInr(Number(bulkPriceVal))} total
                        </option>
                      )}
                    </select>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
                  {!hasBulk ? (
                  <div className={cn(
                    "flex-1 flex items-center justify-between gap-3 sm:gap-4 rounded-2xl p-2.5 h-14 bg-white/5 border border-white/10",
                    product.stock <= 0 && "opacity-30 pointer-events-none"
                  )}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-900 font-black shadow-xl"
                    >
                      <Minus className="w-3 h-3" />
                    </motion.button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={product.stock <= 0 ? 0 : quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setQuantity(0); // Temporary state for empty input
                          return;
                        }
                        const num = parseInt(val);
                        if (!isNaN(num)) {
                          setQuantity(Math.min(product.stock, Math.max(0, num)));
                        }
                      }}
                      onBlur={() => {
                        if (quantity < 1) setQuantity(1);
                      }}
                      className="w-10 text-center bg-transparent border-none text-lg font-black text-white focus:outline-none focus:ring-0"
                      disabled={product.stock <= 0}
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-900 font-black shadow-xl disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </div>
                  ) : (
                    <div className="flex-1 rounded-2xl p-3.5 bg-white/5 border border-white/10 text-center">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pack quantity</p>
                      <p className="text-2xl font-black text-white">{effectiveQty}</p>
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: product.stock <= 0 ? 1 : 1.05 }}
                    whileTap={{ scale: product.stock <= 0 ? 1 : 0.95 }}
                    onClick={product.stock <= 0 ? undefined : handleAddToCart}
                    disabled={product.stock <= 0}
                    className={cn(
                      "flex-[2] min-h-[48px] h-14 rounded-2xl font-bold text-[11px] tracking-[0.08em] shadow-xl flex items-center justify-center gap-2.5 sm:gap-3 transition-all",
                      product.stock <= 0
                        ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
                        : "bg-emerald-500 text-slate-900 hover:bg-white hover:text-slate-950"
                    )}
                  >
                    <Zap className="w-5 h-5 flex-shrink-0" />
                    {product.stock <= 0 ? 'Out of stock' : 'Add to cart'}
                  </motion.button>
                </div>
              </div>
            </div>

            {typeof product.freshnessScore === 'number' && (
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Binary className="w-4 h-4 text-emerald-600" />
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Freshness score</span>
                    </div>
                    <div className="px-2.5 py-1 bg-white rounded-lg text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                      {product.freshnessScore}/5
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-emerald-200/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, (product.freshnessScore / 5) * 100))}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                  {product.ripenessStage && (
                    <p className="mt-3 text-xs font-semibold text-emerald-800">
                      Ripeness: {product.ripenessStage}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Product details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harvest Date</span>
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                    {product.harvestDate ? new Date(product.harvestDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Live Daily'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Freshly sourced</p>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Storage</span>
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                    {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Peak Alpha'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Best before date</p>
                </div>
              </div>
            </div>

            {/* Product details */}
            <div className="space-y-6">
              <p className="text-slate-600 text-sm leading-relaxed">
                {product.fullDescription}
              </p>

              {Array.isArray(product.highlights) && product.highlights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {product.highlights.map((highlight: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl">
                      <div className="h-7 w-7 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-800">{highlight}</span>
                    </div>
                  ))}
                </div>
              )}

              {product.nutritionalInfo && (
                <div className="p-6 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Nutritional info</h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{product.nutritionalInfo}</p>
                </div>
              )}
            </div>

            
          </div>
        </div>

        {hasBulk && (
          <div className="mt-8">
            <BulkInquiryForm productName={product.name} theme={theme} className="max-w-3xl mx-auto" />
          </div>
        )}

        <div className="fixed bottom-0 inset-x-0 z-[90] md:hidden border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-500">
                {hasBulk && packKind === 'bulk' && bulkQty ? `${bulkQty} ${product.unit || 'unit'} pack` : `1 ${product.unit || 'unit'}`}
              </p>
              <p className="text-base font-bold text-slate-900 leading-tight">
                {formatInr(hasBulk && packKind === 'bulk' && bulkPriceVal != null ? Number(bulkPriceVal) : product.sellPrice)}
              </p>
            </div>
            <button
              type="button"
              onClick={product.stock <= 0 ? undefined : handleAddToCart}
              disabled={product.stock <= 0}
              className={cn(
                "ml-auto h-11 px-5 rounded-xl text-sm font-semibold transition-colors",
                product.stock <= 0
                  ? "bg-slate-100 text-slate-400"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {product.stock <= 0 ? 'Out of stock' : 'Add to cart'}
            </button>
          </div>
        </div>

        {/* Global Recommendations Feed */}
        <div className="mt-14 sm:mt-20 pt-10 sm:pt-14 border-t border-slate-100">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-20">
            <div className="space-y-4">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.5em]">Recommended For You</span>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 uppercase tracking-tighter leading-none">Related <br /> Products</h2>
            </div>
            <Link to="/products" className="group flex items-center gap-6">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">View all products</span>
              <div className="h-16 w-16 bg-slate-900 rounded-[1.75rem] flex items-center justify-center text-white group-hover:bg-emerald-500 group-hover:rotate-12 transition-all shadow-2xl">
                <ArrowRight className="h-6 w-6" />
              </div>
            </Link>
          </div>
          <AIRecommendations currentProductId={productId as any} limit={3} />
        </div>
      </div>
    </div>
  );
}

// Fixed ArrowRight missing in imports
const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);
