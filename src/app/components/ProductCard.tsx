import { memo, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, Star, ShieldCheck, Zap, ArrowRight, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { cn, formatInr } from '@/lib/utils';
import { productHasBulkPricing, getRetailUnitReference } from '@/lib/pricing';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800';

function ProductImage({ src, alt, isOutOfStock }: { src: string; alt: string; isOutOfStock: boolean }) {
  const [effectiveSrc, setEffectiveSrc] = useState(() => (src && src.trim()) ? src : PLACEHOLDER_IMAGE);
  useEffect(() => {
    setEffectiveSrc((src && src.trim()) ? src : PLACEHOLDER_IMAGE);
  }, [src]);
  const handleError = () => {
    setEffectiveSrc(PLACEHOLDER_IMAGE);
  };
  return (
    <motion.img
      src={effectiveSrc}
      alt={alt}
      onError={handleError}
      loading="lazy"
      className={cn(
        'w-full h-full object-cover transition-all duration-[2s] group-hover:scale-110',
        isOutOfStock ? 'grayscale opacity-40' : ''
      )}
      whileHover={{ rotate: 1 }}
    />
  );
}

interface ProductCardProps {
  id: string | number;
  name: string;
  price: number;
  stock: number;
  image: string;
  description?: string;
  badge?: string;
  isOrganic?: boolean;
  isSeasonal?: boolean;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  onAddToCart: (payload: any, quantity?: number) => void;
  /** When provided, onAddToCart will be called with this product (for API-driven cart) */
  product?: import('@/lib/api').Product;
  /** When true, enforce bulk quantity semantics (used in bulk deals grid) */
  bulkDealMode?: boolean;
  /** Optional storefront offer copy shown on card */
  liveOfferHint?: string;
}

export const ProductCard = memo(({ id, name, price, stock, image, description, badge, isOrganic, isSeasonal, bulkDiscountQty, bulkDiscountPrice, onAddToCart, product, bulkDealMode, liveOfferHint }: ProductCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const productForBulk = useMemo(
    () => ({
      price: product?.price ?? price,
      bulkDiscountQty: bulkDiscountQty ?? product?.bulkDiscountQty,
      bulkDiscountPrice: bulkDiscountPrice ?? product?.bulkDiscountPrice,
      availableStock: product?.availableStock ?? stock,
      stock,
      variants: product?.variants,
    }),
    [
      price,
      stock,
      bulkDiscountQty,
      bulkDiscountPrice,
      product?.price,
      product?.availableStock,
      product?.bulkDiscountQty,
      product?.bulkDiscountPrice,
      product?.variants,
    ]
  );
  const hasBulk = productHasBulkPricing(productForBulk);
  const retailRef = useMemo(() => getRetailUnitReference(productForBulk), [productForBulk]);
  const bulkQty = productForBulk.bulkDiscountQty;
  const bulkPriceVal = productForBulk.bulkDiscountPrice;
  const [packKind, setPackKind] = useState<'retail' | 'bulk'>(() =>
    bulkDealMode && hasBulk ? 'bulk' : 'retail'
  );
  useEffect(() => {
    if (bulkDealMode && hasBulk) setPackKind('bulk');
  }, [bulkDealMode, hasBulk]);

  const unitLabel = product?.unit ? product.unit : 'kg';
  const effectiveQty =
    hasBulk && packKind === 'bulk' && bulkQty && bulkQty > 0 ? bulkQty : 1;
  const bulkPackTotal =
    hasBulk && bulkPriceVal != null ? Number(bulkPriceVal) : null;
  const displayUnitPrice =
    hasBulk && packKind === 'bulk' && bulkPackTotal != null
      ? bulkPackTotal
      : retailRef;
  const bulkDerivedUnitPrice =
    bulkPackTotal != null && bulkQty && bulkQty > 0
      ? bulkPackTotal / bulkQty
      : null;

  const { user } = useAuth();
  const { theme, cartItems, handleUpdateQuantity } = useStore();
  const navigate = useNavigate();

  const handleAction = (callback: () => void) => {
    if (!user) {
      toast.info('Saved in cart', {
        description: 'Your cart is saved on this device. Sign in at checkout to place the order.',
        action: {
          label: 'Sign in',
          onClick: () => navigate('/login'),
        },
      });
    }
    callback();
  };

  const avail = product?.availableStock ?? stock;
  const isOutOfStock = avail <= 0;
  const lowStock = !isOutOfStock && avail <= (product?.lowStockThreshold ?? 10);
  const isOrganicProduct = Boolean(product?.isOrganic ?? isOrganic);
  const cartQty = cartItems.find((item) => String(item.id) === String(id))?.quantity ?? 0;

  return (
    <motion.div
      whileHover={{ y: -12 }}
      className="relative bg-white rounded-2xl sm:rounded-[3rem] overflow-hidden border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] hover:shadow-[0_40px_100px_rgba(16,185,129,0.1)] transition-all duration-700 group flex flex-col h-full"
    >
      {/* Mobile-first compact card (Zepto-like) */}
      <div className="sm:hidden flex flex-col h-full">
        <Link to={`/product/${id}`} className="relative h-32 overflow-hidden bg-slate-50 block">
          <ProductImage src={image} alt={name} isOutOfStock={isOutOfStock} />
          {badge && !isOutOfStock && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-wide">
              {badge}
            </div>
          )}
          {cartQty > 0 && !isOutOfStock ? (
            <div className="absolute bottom-2 right-2 h-9 px-1.5 rounded-xl bg-white border border-slate-200 shadow-lg flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (cartQty <= 1) {
                    handleUpdateQuantity(id, -1);
                    return;
                  }
                  handleUpdateQuantity(id, -1);
                }}
                className="h-7 w-7 rounded-lg border border-slate-200 text-slate-700 flex items-center justify-center"
              >
                -
              </button>
              <span className="min-w-[1.25rem] text-center text-[11px] font-black text-slate-900">{cartQty}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (cartQty >= avail) {
                    toast.error(`Only ${avail} units available`);
                    return;
                  }
                  handleUpdateQuantity(id, 1);
                }}
                className="h-7 w-7 rounded-lg border border-slate-200 text-slate-700 flex items-center justify-center"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isOutOfStock) return;
                const payload = product ?? id;
                const safeQty = hasBulk ? effectiveQty : Math.max(1, quantity);
                if (safeQty > avail) {
                  toast.error(`Only ${avail} units available`);
                  return;
                }
                handleAction(() => onAddToCart(payload as any, safeQty));
              }}
              disabled={isOutOfStock}
              className={cn(
                "absolute bottom-2 right-2 min-h-[36px] px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 shadow-lg",
                isOutOfStock
                  ? "bg-slate-100 text-slate-400 border-slate-200"
                  : "bg-white text-pink-600 border-pink-300"
              )}
            >
              {isOutOfStock ? 'Sold out' : 'Add'}
            </button>
          )}
        </Link>

        <div className="p-2.5 flex-1 flex flex-col gap-1.5">
          {hasBulk ? (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Select pack</label>
              <select
                value={bulkDealMode ? 'bulk' : packKind}
                onChange={(e) => {
                  e.preventDefault();
                  if (bulkDealMode) return;
                  setPackKind(e.target.value as 'retail' | 'bulk');
                }}
                disabled={!!bulkDealMode}
                className="w-full text-[11px] font-bold text-slate-900 border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              >
                {!bulkDealMode && <option value="retail">1 {unitLabel} · {formatInr(retailRef)} each</option>}
                {bulkQty != null && bulkPriceVal != null && (
                  <option value="bulk">
                    {bulkQty} {unitLabel} pack · {formatInr(Number(bulkPriceVal))} total
                  </option>
                )}
              </select>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-emerald-700 leading-none">{formatInr(displayUnitPrice)}</span>
                {hasBulk && packKind === 'bulk' && retailRef > displayUnitPrice && (
                  <span className="text-xs line-through text-slate-400 leading-none">{formatInr(retailRef)}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-emerald-700 leading-none">{formatInr(retailRef)}</span>
            </div>
          )}
          {liveOfferHint && !isOutOfStock && (
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wide line-clamp-1">
              {liveOfferHint}
            </p>
          )}
          <h3 className="text-sm font-bold text-slate-900 leading-tight line-clamp-2">{name}</h3>
          <p className="text-[11px] text-slate-500 line-clamp-1">{product?.unit ? `Per ${product.unit}` : 'Per kg'}</p>
          {isOrganicProduct && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">
              Organic
            </span>
          )}
          {hasBulk && (
            <Link
              to={`/contact?subject=${encodeURIComponent(`Bulk order: ${name}`)}`}
              className="text-[10px] font-black text-emerald-600 uppercase tracking-wide"
              onClick={(e) => e.stopPropagation()}
            >
              Need more than this pack? Contact us
            </Link>
          )}
        </div>
      </div>

      {/* Desktop premium card */}
      <div className="hidden sm:flex sm:flex-col sm:h-full">
      {/* High-Fidelity Badge System */}
      <AnimatePresence>
        {isOutOfStock && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-red-600 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl"
          >
            <div className="h-2 w-2 rounded-full bg-white" />
            Out of stock
          </motion.div>
        )}
        {lowStock && !isOutOfStock && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-orange-500 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl"
          >
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
            Low stock: {avail} left
          </motion.div>
        )}
        {badge && !isOutOfStock && !lowStock && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-slate-900 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {badge}
          </motion.div>
        )}
        {isSeasonal && !badge && !isOutOfStock && !lowStock && (
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
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-30 space-y-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
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
      <Link to={`/product/${id}`} className="relative h-52 sm:h-80 overflow-hidden bg-slate-50 block shrink-0">
        <ProductImage src={image} alt={name} isOutOfStock={isOutOfStock} />

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
      <div className="p-4 sm:p-8 flex flex-col flex-1 relative">
        {/* Rating Topology */}
        <div className="flex items-center gap-1.5 mb-4 shrink-0">
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
        {isOrganicProduct && (
          <div className="mb-4 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">
              Organic
            </span>
          </div>
        )}

        {/* Stock & ETA */}
        {(() => {
          const avail = product?.availableStock ?? stock;
          const lowStock = avail <= (product?.lowStockThreshold ?? 10) && avail > 0;
          return (
            <div className="flex flex-col gap-1 mb-2">
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                <span className={cn(lowStock ? "text-orange-500" : "")}>
                  {isOutOfStock ? 'Out of stock' : avail <= 10 ? `Only ${avail} units left` : `${avail} units in stock`}
                </span>
                <span className="text-emerald-500">Delivery: 1–2 days</span>
              </div>
              {product?.reservedStock ? (
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">
                  {product.reservedStock} units reserved by others
                </span>
              ) : null}
              {liveOfferHint && !isOutOfStock ? (
                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">
                  Live offer: {liveOfferHint}
                </span>
              ) : null}
            </div>
          );
        })()}

        {/* Pack / quantity */}
        {!isOutOfStock && hasBulk ? (
          <div className="mb-4 space-y-2">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Select pack</span>
            <select
              value={bulkDealMode ? 'bulk' : packKind}
              onChange={(e) => {
                if (bulkDealMode) return;
                setPackKind(e.target.value as 'retail' | 'bulk');
              }}
              disabled={!!bulkDealMode}
              className="w-full text-[11px] font-black text-slate-900 border border-slate-200 rounded-xl px-3 py-2 bg-white"
            >
              {!bulkDealMode && <option value="retail">1 {unitLabel} · {formatInr(retailRef)} each</option>}
              {bulkQty != null && bulkPriceVal != null && (
                <option value="bulk">
                  {bulkQty} {unitLabel} pack · {formatInr(Number(bulkPriceVal))} total
                </option>
              )}
            </select>
            <Link
              to={`/contact?subject=${encodeURIComponent(`Bulk order: ${name}`)}`}
              className="inline-block text-[9px] font-black text-emerald-600 uppercase tracking-wider hover:underline"
            >
              Need more than this pack? Contact us
            </Link>
          </div>
        ) : !isOutOfStock ? (
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
              Quantity
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setQuantity((q) => Math.max(1, q - 1));
                }}
                className="h-7 w-7 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 text-xs font-black hover:bg-slate-50"
              >
                -
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={quantity}
                onClick={(e) => e.preventDefault()}
                onChange={(e) => {
                  e.preventDefault();
                  const val = e.target.value;
                  if (val === '') {
                    setQuantity(1);
                    return;
                  }
                  const num = parseInt(val, 10);
                  if (!Number.isNaN(num)) {
                    const maxAllowed = product?.availableStock ?? stock;
                    const bounded = Math.max(1, Math.min(maxAllowed || num, num));
                    if (maxAllowed && num > maxAllowed) {
                      toast.error(`Only ${maxAllowed} units available`);
                    }
                    setQuantity(bounded);
                  }
                }}
                onBlur={(e) => {
                  e.preventDefault();
                  if (!Number.isFinite(quantity) || quantity < 1) setQuantity(1);
                }}
                className="w-14 h-7 text-center text-[11px] font-black text-slate-800 border border-slate-200 rounded-lg bg-white"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setQuantity((q) => {
                    const next = q + 1;
                    const maxAllowed = product?.availableStock ?? stock;
                    if (maxAllowed && next > maxAllowed) {
                      toast.error(`Only ${maxAllowed} units available`);
                      return maxAllowed;
                    }
                    return next;
                  });
                }}
                className="h-7 w-7 rounded-xl border border-slate-900 bg-slate-900 text-white flex items-center justify-center text-xs font-black hover:bg-emerald-500 hover:border-emerald-500"
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex-1 space-y-3">
          <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-tight group-hover:text-emerald-600 transition-colors">
            {name}
          </h3>

          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed line-clamp-2 min-h-[2.5rem]">
            {description || 'Fresh and quality assured.'}
          </p>
        </div>

        {/* Transaction Rail */}
        <div className="flex items-center justify-between gap-4 sm:gap-6 mt-5 sm:mt-8 pt-5 sm:pt-8 border-t border-slate-50">
          <div className="shrink-0 space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mr-1">INR</span>
              <span className={cn(
                "text-2xl sm:text-3xl font-black tracking-tighter transition-colors",
                isOutOfStock ? "text-slate-300" : "text-slate-900 group-hover:text-emerald-500"
              )}>
                {formatInr(displayUnitPrice)}
              </span>
              {hasBulk && packKind === 'bulk' && retailRef > displayUnitPrice && (
                <span className="text-sm font-bold text-slate-400 line-through">{formatInr(retailRef)}</span>
              )}
            </div>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wider italic">
              {hasBulk && packKind === 'bulk' && bulkQty ? `for ${bulkQty} ${unitLabel} pack` : `per ${unitLabel}`}
            </p>
            {hasBulk && bulkQty && bulkPriceVal != null && (
              <div className="mt-2 py-1 px-3 bg-emerald-50 rounded-lg inline-block border border-emerald-100/50">
                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider whitespace-nowrap">
                  {packKind === 'bulk'
                    ? (bulkDerivedUnitPrice != null
                        ? `Bulk pack selected · ${formatInr(bulkDerivedUnitPrice)}/${unitLabel}`
                        : 'Bulk pack selected')
                    : `Bulk available: ${formatInr(Number(bulkPriceVal))} for ${bulkQty} ${unitLabel} pack`}
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
              if (isOutOfStock) return;
              const payload = product ?? id;
              const finalQty = hasBulk ? effectiveQty : Math.max(1, quantity);
              const maxAllowed = product?.availableStock ?? stock;
              if (finalQty > maxAllowed) {
                toast.error(`Only ${maxAllowed} units available`);
                return;
              }
              handleAction(() => onAddToCart(payload as any, finalQty));
            }}
            className={cn(
              "h-12 sm:h-16 px-4 sm:px-8 flex items-center gap-2 sm:gap-4 transition-all duration-500 shadow-2xl rounded-2xl sm:rounded-[1.75rem]",
              isOutOfStock
                ? "bg-slate-50 text-slate-200 cursor-not-allowed shadow-none"
                : "bg-slate-900 text-white hover:bg-emerald-500"
            )}
          >
            <div className="h-7 w-7 sm:h-8 sm:w-8 bg-white/10 rounded-xl flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              {isOutOfStock ? 'Out of stock' : 'Add to cart'}
            </span>
          </motion.button>
        </div>
      </div>
      </div>
    </motion.div>
  );
});
ProductCard.displayName = 'ProductCard';
