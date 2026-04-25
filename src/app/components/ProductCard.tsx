import { memo, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, MapPin, Leaf, CalendarDays, Tag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { cn, formatInr } from '@/lib/utils';
import { productHasBulkPricing, getRetailUnitReference } from '@/lib/pricing';
import { formatDistanceToNow, parseISO } from 'date-fns';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800';

/* ── Image component ── */
function ProductImage({ src, alt, isOutOfStock }: { src: string; alt: string; isOutOfStock: boolean }) {
  const [effectiveSrc, setEffectiveSrc] = useState(() => (src && src.trim()) ? src : PLACEHOLDER_IMAGE);
  useEffect(() => { setEffectiveSrc((src && src.trim()) ? src : PLACEHOLDER_IMAGE); }, [src]);
  return (
    <img
      src={effectiveSrc}
      alt={alt}
      onError={() => setEffectiveSrc(PLACEHOLDER_IMAGE)}
      loading="lazy"
      className={cn(
        'w-full h-full object-cover transition-transform duration-700 group-hover:scale-105',
        isOutOfStock && 'grayscale opacity-50'
      )}
    />
  );
}

/* ── Freshness dots ── */
function FreshnessBar({ score }: { score: number }) {
  const clamped = Math.max(1, Math.min(5, Math.round(score)));
  const color = clamped >= 4 ? 'bg-emerald-500' : clamped === 3 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={cn('h-1.5 w-1.5 rounded-full', i <= clamped ? color : 'bg-slate-200')} />
      ))}
    </div>
  );
}

/* ── Harvest age ── */
function HarvestAge({ harvestDate }: { harvestDate: string }) {
  try {
    const parsed = parseISO(harvestDate);
    const distText = formatDistanceToNow(parsed, { addSuffix: false });
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
        <CalendarDays className="h-3 w-3" />
        Picked {distText} ago
      </span>
    );
  } catch { return null; }
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
  product?: import('@/lib/api').Product;
  bulkDealMode?: boolean;
  liveOfferHint?: string;
  farmName?: string;
  farmState?: string;
  freshnessScore?: number;
  ripenessStage?: string;
  harvestDate?: string;
}

export const ProductCard = memo(({
  id, name, price, stock, image, description, badge, isOrganic, isSeasonal,
  bulkDiscountQty, bulkDiscountPrice, onAddToCart, product, bulkDealMode, liveOfferHint,
  farmName, farmState, freshnessScore, ripenessStage, harvestDate,
}: ProductCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const effectiveFarmName       = farmName       ?? (product as any)?.farmName       ?? product?.vendor ?? null;
  const effectiveFarmState      = farmState      ?? (product as any)?.farmState      ?? null;
  const effectiveFreshnessScore = freshnessScore ?? (product as any)?.freshnessScore ?? null;
  const effectiveRipenessStage  = ripenessStage  ?? (product as any)?.ripenessStage  ?? null;
  const effectiveHarvestDate    = harvestDate    ?? product?.harvestDate              ?? null;

  const productForBulk = useMemo(() => ({
    price: product?.price ?? price,
    bulkDiscountQty: bulkDiscountQty ?? product?.bulkDiscountQty,
    bulkDiscountPrice: bulkDiscountPrice ?? product?.bulkDiscountPrice,
    availableStock: product?.availableStock ?? stock,
    stock,
    variants: product?.variants,
  }), [price, stock, bulkDiscountQty, bulkDiscountPrice, product?.price, product?.availableStock,
       product?.bulkDiscountQty, product?.bulkDiscountPrice, product?.variants]);

  const hasBulk      = productHasBulkPricing(productForBulk);
  const retailRef    = useMemo(() => getRetailUnitReference(productForBulk), [productForBulk]);
  const bulkQty      = productForBulk.bulkDiscountQty;
  const bulkPriceVal = productForBulk.bulkDiscountPrice;

  const [packKind, setPackKind] = useState<'retail' | 'bulk'>(() =>
    bulkDealMode && hasBulk ? 'bulk' : 'retail'
  );
  useEffect(() => { if (bulkDealMode && hasBulk) setPackKind('bulk'); }, [bulkDealMode, hasBulk]);

  const unitLabel         = product?.unit ? product.unit : 'kg';
  const effectiveQty      = hasBulk && packKind === 'bulk' && bulkQty && bulkQty > 0 ? bulkQty : 1;
  const bulkPackTotal     = hasBulk && bulkPriceVal != null ? Number(bulkPriceVal) : null;
  const displayUnitPrice  = hasBulk && packKind === 'bulk' && bulkPackTotal != null ? bulkPackTotal : retailRef;
  const bulkDerivedUnit   = bulkPackTotal != null && bulkQty && bulkQty > 0 ? bulkPackTotal / bulkQty : null;
  const bulkSavingPct     = bulkDerivedUnit != null && retailRef > 0
    ? Math.round(((retailRef - bulkDerivedUnit) / retailRef) * 100) : 0;

  const { user } = useAuth();
  const { cartItems, handleUpdateQuantity } = useStore();
  const navigate = useNavigate();

  const handleAction = (callback: () => void) => {
    if (!user) {
      toast.info('Cart saved on this device', {
        description: 'Sign in at checkout to complete your order.',
        action: { label: 'Sign in', onClick: () => navigate('/login') },
      });
    }
    callback();
  };

  const avail        = product?.availableStock ?? stock;
  const isOutOfStock = avail <= 0;
  const lowStock     = !isOutOfStock && avail <= (product?.lowStockThreshold ?? 10);
  const isOrganicProduct = Boolean(product?.isOrganic ?? isOrganic);
  const cartQty      = cartItems.find((item) => String(item.id) === String(id))?.quantity ?? 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([20, 30, 20]);
    const payload = product ?? id;
    const finalQty = hasBulk ? effectiveQty : Math.max(1, quantity);
    const maxAllowed = product?.availableStock ?? stock;
    if (finalQty > maxAllowed) { toast.error(`Only ${maxAllowed} units available`); return; }
    handleAction(() => onAddToCart(payload as any, finalQty));
  };

  /* ──────────────────────── MOBILE CARD (< sm) ──────────────────────── */
  const MobileCard = (
    <div className="sm:hidden flex flex-col h-full">
      <Link to={`/product/${id}`} className="relative aspect-square overflow-hidden bg-slate-50 block">
        <ProductImage src={image} alt={name} isOutOfStock={isOutOfStock} />

        {/* Badges */}
        {lowStock && !isOutOfStock && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse inline-block" />
            {avail} left
          </div>
        )}
        {badge && !isOutOfStock && !lowStock && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-semibold">{badge}</div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
            <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">Sold out</span>
          </div>
        )}

        {/* Quick add / qty */}
        {!isOutOfStock && (
          <div className="absolute bottom-2 right-2">
            {cartQty > 0 ? (
              <div className="h-8 px-1.5 rounded-xl bg-white border border-slate-200 shadow-md flex items-center gap-1">
                <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={(e) => { e.preventDefault(); handleUpdateQuantity(id, -1); }}
                  className="h-6 w-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-semibold">−</motion.button>
                <span className="min-w-[1.25rem] text-center text-[11px] font-bold text-slate-900">{cartQty}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); if (cartQty >= avail) { toast.error(`Only ${avail} units available`); return; } handleUpdateQuantity(id, 1); }}
                  className="h-6 w-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-sm font-semibold">+</button>
              </div>
            ) : (
              <button type="button" onClick={(e) => { e.preventDefault(); handleAddToCart(); }}
                className="h-8 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors">
                Add
              </button>
            )}
          </div>
        )}
      </Link>

      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-slate-900">{formatInr(displayUnitPrice)}</span>
          {liveOfferHint && !isOutOfStock && (
            <span className="text-[10px] font-semibold text-emerald-600 truncate ml-2">{liveOfferHint}</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{name}</h3>
        <p className="text-xs text-slate-400">{product?.unit ? `Per ${product.unit}` : 'Per kg'}</p>
        {effectiveFarmName && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{effectiveFarmName}{effectiveFarmState ? `, ${effectiveFarmState}` : ''}</span>
          </div>
        )}
      </div>
    </div>
  );

  /* ──────────────────────── DESKTOP CARD (≥ sm) ──────────────────────── */
  const DesktopCard = (
    <div className="hidden sm:flex sm:flex-col sm:h-full">
      {/* Image */}
      <Link to={`/product/${id}`} className="relative aspect-square overflow-hidden bg-slate-50 block shrink-0">
        <ProductImage src={image} alt={name} isOutOfStock={isOutOfStock} />

        {/* Gradient for bottom overlap */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Status badges */}
        <AnimatePresence>
          {isOutOfStock ? (
            <motion.div key="oos" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute top-3 left-3 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-semibold rounded-lg">
              Sold out
            </motion.div>
          ) : lowStock ? (
            <motion.div key="low" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-orange-500 text-white text-[10px] font-semibold rounded-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Only {avail} left
            </motion.div>
          ) : badge ? (
            <motion.div key="badge" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute top-3 left-3 px-2.5 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded-lg">
              {badge}
            </motion.div>
          ) : isSeasonal ? (
            <motion.div key="seasonal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-semibold rounded-lg">
              <Leaf className="h-3 w-3" /> Seasonal
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Bulk saving badge */}
        {hasBulk && bulkSavingPct > 0 && !isOutOfStock && (
          <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg">
            {bulkSavingPct}% off bulk
          </div>
        )}

        {/* Wishlist button */}
        <button
          onClick={() => handleAction(() => setIsLiked(!isLiked))}
          className={cn(
            'absolute bottom-3 right-3 h-8 w-8 rounded-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md',
            isLiked ? 'bg-red-500 text-white' : 'bg-white text-slate-400 hover:text-red-500'
          )}
        >
          <Heart className={cn('w-4 h-4', isLiked && 'fill-white')} />
        </button>

        {/* Freshness indicator */}
        {effectiveFreshnessScore != null && !isOutOfStock && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg">
            <FreshnessBar score={effectiveFreshnessScore} />
            <span className="text-[10px] text-white font-medium">{effectiveFreshnessScore}/5</span>
          </div>
        )}
      </Link>

      {/* Info panel */}
      <div className="p-4 flex flex-col flex-1">

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-2.5 min-h-[20px]">
          {effectiveHarvestDate && <HarvestAge harvestDate={effectiveHarvestDate} />}
          {effectiveRipenessStage && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              {effectiveRipenessStage}
            </span>
          )}
          {isOrganicProduct && (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
              Organic
            </span>
          )}
        </div>

        {/* Product name */}
        <Link to={`/product/${id}`} className="flex-1">
          <h3 className="text-base font-semibold text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2 mb-1">
            {name}
          </h3>
          {description && (
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </Link>

        {/* Farm source */}
        {effectiveFarmName && (
          <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
            <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
            <span className="truncate">{effectiveFarmName}{effectiveFarmState ? `, ${effectiveFarmState}` : ''}</span>
          </div>
        )}

        {/* Pack selector if bulk */}
        {!isOutOfStock && hasBulk && (
          <div className="mt-3">
            <select
              value={bulkDealMode ? 'bulk' : packKind}
              onChange={(e) => { if (bulkDealMode) return; setPackKind(e.target.value as 'retail' | 'bulk'); }}
              disabled={!!bulkDealMode}
              className="w-full h-9 px-3 text-xs text-slate-900 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              {!bulkDealMode && <option value="retail">1 {unitLabel} · {formatInr(retailRef)}</option>}
              {bulkQty != null && bulkPriceVal != null && (
                <option value="bulk">{bulkQty} {unitLabel} pack · {formatInr(Number(bulkPriceVal))} total</option>
              )}
            </select>
          </div>
        )}

        {/* Quantity selector (retail) */}
        {!isOutOfStock && !hasBulk && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-400 font-medium">Qty</span>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-7 w-7 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center">
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold text-slate-900">{quantity}</span>
              <button type="button"
                onClick={() => setQuantity((q) => {
                  const next = q + 1;
                  const max = product?.availableStock ?? stock;
                  if (max && next > max) { toast.error(`Only ${max} units available`); return max; }
                  return next;
                })}
                className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-900 text-white text-sm font-semibold hover:bg-emerald-600 hover:border-emerald-600 transition-colors flex items-center justify-center">
                +
              </button>
            </div>
          </div>
        )}

        {/* Offer hint */}
        {liveOfferHint && !isOutOfStock && (
          <div className="flex items-center gap-1.5 mt-2.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
            <Tag className="h-3 w-3 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-medium text-emerald-700">{liveOfferHint}</span>
          </div>
        )}

        {/* Price + Add to cart */}
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                'text-lg font-bold transition-colors',
                isOutOfStock ? 'text-slate-300' : 'text-slate-900'
              )}>
                {formatInr(displayUnitPrice)}
              </span>
              {hasBulk && packKind === 'bulk' && retailRef > displayUnitPrice && (
                <span className="text-xs text-slate-400 line-through">{formatInr(retailRef)}</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {hasBulk && packKind === 'bulk' && bulkQty ? `for ${bulkQty} ${unitLabel}` : `per ${unitLabel}`}
            </p>
          </div>

          {/* Stock count in cart or add button */}
          {cartQty > 0 && !isOutOfStock ? (
            <div className="flex items-center gap-1 h-9 px-1.5 rounded-xl border border-slate-200 bg-white shadow-sm">
              <motion.button whileTap={{ scale: 0.85 }} type="button"
                onClick={() => handleUpdateQuantity(id, -1)}
                className="h-7 w-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold">−</motion.button>
              <span className="min-w-[1.5rem] text-center text-sm font-bold text-slate-900">{cartQty}</span>
              <motion.button whileTap={{ scale: 0.85 }} type="button"
                onClick={() => { if (cartQty >= avail) { toast.error(`Only ${avail} units available`); return; } handleUpdateQuantity(id, 1); }}
                className="h-7 w-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">+</motion.button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: isOutOfStock ? 1 : 0.95 }}
              disabled={isOutOfStock}
              onClick={handleAddToCart}
              className={cn(
                'flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-colors shrink-0',
                isOutOfStock
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
              )}
            >
              <ShoppingCart className="h-4 w-4" />
              {isOutOfStock ? 'Sold out' : 'Add'}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300 group flex flex-col h-full"
    >
      {MobileCard}
      {DesktopCard}
    </motion.div>
  );
});

ProductCard.displayName = 'ProductCard';
