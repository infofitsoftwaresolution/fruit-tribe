import { memo, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, Star, ShieldCheck, Zap, ArrowRight, Activity, LeafyGreen, MapPin, Clock, CalendarDays } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { cn, formatInr } from '@/lib/utils';
import { productHasBulkPricing, getRetailUnitReference } from '@/lib/pricing';
import { formatDistanceToNow, parseISO } from 'date-fns';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800';

function ProductImage({ src, alt, isOutOfStock }: { src: string; alt: string; isOutOfStock: boolean }) {
  const [effectiveSrc, setEffectiveSrc] = useState(() => (src && src.trim()) ? src : PLACEHOLDER_IMAGE);
  useEffect(() => {
    setEffectiveSrc((src && src.trim()) ? src : PLACEHOLDER_IMAGE);
  }, [src]);
  return (
    <motion.img
      src={effectiveSrc}
      alt={alt}
      onError={() => setEffectiveSrc(PLACEHOLDER_IMAGE)}
      loading="lazy"
      className={cn(
        'w-full h-full object-cover transition-all duration-[2s] group-hover:scale-110',
        isOutOfStock ? 'grayscale opacity-40' : ''
      )}
      whileHover={{ rotate: 1 }}
    />
  );
}

// ── Freshness Score Dots (1–5) ──────────────────────────────────────────────
function FreshnessBar({ score, compact = false }: { score: number; compact?: boolean }) {
  const clamped = Math.max(1, Math.min(5, Math.round(score)));
  const color =
    clamped >= 4 ? 'bg-emerald-500' :
    clamped === 3 ? 'bg-amber-400' :
    'bg-red-400';
  return (
    <div className={cn('flex items-center gap-1', compact ? 'gap-0.5' : 'gap-1')}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
            i <= clamped ? color : 'bg-slate-100',
          )}
        />
      ))}
    </div>
  );
}

// ── Harvest Age Display ─────────────────────────────────────────────────────
function HarvestAge({ harvestDate, compact = false }: { harvestDate: string; compact?: boolean }) {
  try {
    const parsed = parseISO(harvestDate);
    const distText = formatDistanceToNow(parsed, { addSuffix: false });
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-emerald-700 font-black uppercase tracking-wider',
        compact ? 'text-[9px]' : 'text-[10px]',
      )}>
        <CalendarDays className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
        Picked {distText} ago
      </span>
    );
  } catch {
    return null;
  }
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

  // Pull freshness fields from product prop (API shape) or from explicit props
  const effectiveFarmName      = farmName      ?? (product as any)?.farmName      ?? product?.vendor ?? 'Fruit Tribe Partners';
  const effectiveFarmState     = farmState     ?? (product as any)?.farmState     ?? 'Local Region';
  const effectiveFreshnessScore= freshnessScore?? (product as any)?.freshnessScore?? 5;
  const effectiveRipenessStage = ripenessStage ?? (product as any)?.ripenessStage ?? 'Ripe & Ready';
  const effectiveHarvestDate   = harvestDate   ?? product?.harvestDate   ?? (new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Default to yesterday

  const productForBulk = useMemo(
    () => ({
      price: product?.price ?? price,
      bulkDiscountQty: bulkDiscountQty ?? product?.bulkDiscountQty,
      bulkDiscountPrice: bulkDiscountPrice ?? product?.bulkDiscountPrice,
      availableStock: product?.availableStock ?? stock,
      stock,
      variants: product?.variants,
    }),
    [price, stock, bulkDiscountQty, bulkDiscountPrice, product?.price, product?.availableStock,
     product?.bulkDiscountQty, product?.bulkDiscountPrice, product?.variants],
  );
  const hasBulk       = productHasBulkPricing(productForBulk);
  const retailRef     = useMemo(() => getRetailUnitReference(productForBulk), [productForBulk]);
  const bulkQty       = productForBulk.bulkDiscountQty;
  const bulkPriceVal  = productForBulk.bulkDiscountPrice;
  const [packKind, setPackKind] = useState<'retail' | 'bulk'>(() =>
    bulkDealMode && hasBulk ? 'bulk' : 'retail'
  );
  useEffect(() => {
    if (bulkDealMode && hasBulk) setPackKind('bulk');
  }, [bulkDealMode, hasBulk]);

  const unitLabel       = product?.unit ? product.unit : 'kg';
  const effectiveQty    = hasBulk && packKind === 'bulk' && bulkQty && bulkQty > 0 ? bulkQty : 1;
  const bulkPackTotal   = hasBulk && bulkPriceVal != null ? Number(bulkPriceVal) : null;
  const displayUnitPrice = hasBulk && packKind === 'bulk' && bulkPackTotal != null ? bulkPackTotal : retailRef;
  const bulkDerivedUnitPrice =
    bulkPackTotal != null && bulkQty && bulkQty > 0 ? bulkPackTotal / bulkQty : null;

  const { user } = useAuth();
  const { cartItems, handleUpdateQuantity } = useStore();
  const navigate = useNavigate();

  const handleAction = (callback: () => void) => {
    if (!user) {
      toast.info('Saved in cart', {
        description: 'Your cart is saved on this device. Sign in at checkout to place the order.',
        action: { label: 'Sign in', onClick: () => navigate('/login') },
      });
    }
    callback();
  };

  const avail       = product?.availableStock ?? stock;
  const isOutOfStock= avail <= 0;
  const lowStock    = !isOutOfStock && avail <= (product?.lowStockThreshold ?? 10);
  const isOrganicProduct = Boolean(product?.isOrganic ?? isOrganic);
  const cartQty     = cartItems.find((item) => String(item.id) === String(id))?.quantity ?? 0;

  // ──────────────────────────────────────────────────────────────────────────
  // MOBILE CARD (compact, Zepto-style)
  // ──────────────────────────────────────────────────────────────────────────
  const MobileCard = (
    <div className="sm:hidden flex flex-col h-full">
      <Link to={`/product/${id}`} className="relative h-32 overflow-hidden bg-slate-50 block">
        <ProductImage src={image} alt={name} isOutOfStock={isOutOfStock} />

        {/* Freshness score overlay — top-left */}
        {effectiveFreshnessScore != null && !isOutOfStock && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
            <FreshnessBar score={effectiveFreshnessScore} compact />
          </div>
        )}

        {/* Stock badge */}
        {badge && !isOutOfStock && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-wide">
            {badge}
          </div>
        )}
        {lowStock && !isOutOfStock && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[9px] font-black uppercase tracking-wide flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse inline-block" />
            {avail} left
          </div>
        )}

        {/* Add/qty controls */}
        {cartQty > 0 && !isOutOfStock ? (
          <div className="absolute bottom-2 right-2 h-9 px-1.5 rounded-xl bg-white border border-slate-200 shadow-lg flex items-center gap-1">
            <motion.button whileTap={{ scale: 0.85 }} type="button"
              onClick={(e) => { e.preventDefault(); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50); handleUpdateQuantity(id, -1); }}
              className="h-7 w-7 rounded-lg border border-slate-200 text-slate-700 flex items-center justify-center bg-slate-50 font-black">-</motion.button>
            <span className="min-w-[1.25rem] text-center text-[11px] font-black text-slate-900">{cartQty}</span>
            <motion.button whileTap={{ scale: 0.85 }} type="button"
              onClick={(e) => { e.preventDefault(); if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50); if (cartQty >= avail) { toast.error(`Only ${avail} units available`); return; } handleUpdateQuantity(id, 1); }}
              className="h-7 w-7 rounded-lg border border-emerald-500 bg-emerald-500 text-white flex items-center justify-center font-black">+</motion.button>
          </div>
        ) : (
          <motion.button whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.05 }} type="button"
            onClick={(e) => {
              e.preventDefault();
              if (isOutOfStock) return;
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([30, 50, 30]);
              const payload = product ?? id;
              const safeQty = hasBulk ? effectiveQty : Math.max(1, quantity);
              if (safeQty > avail) { toast.error(`Only ${avail} units available`); return; }
              handleAction(() => onAddToCart(payload as any, safeQty));
            }}
            disabled={isOutOfStock}
            className={cn(
              "absolute bottom-2 right-2 min-h-[36px] px-4 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 shadow-lg transition-colors",
              isOutOfStock ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
            )}>
            {isOutOfStock ? 'Sold out' : 'Add'}
          </motion.button>
        )}
      </Link>

      <div className="p-2.5 flex-1 flex flex-col gap-1.5">
        {/* Price */}
        {hasBulk ? (
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Select pack</label>
            <select value={bulkDealMode ? 'bulk' : packKind} onChange={(e) => { e.preventDefault(); if (bulkDealMode) return; setPackKind(e.target.value as 'retail' | 'bulk'); }} disabled={!!bulkDealMode}
              className="w-full text-[11px] font-bold text-slate-900 border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
              {!bulkDealMode && <option value="retail">1 {unitLabel} · {formatInr(retailRef)} each</option>}
              {bulkQty != null && bulkPriceVal != null && <option value="bulk">{bulkQty} {unitLabel} pack · {formatInr(Number(bulkPriceVal))} total</option>}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-emerald-700 leading-none">{formatInr(displayUnitPrice)}</span>
              {hasBulk && packKind === 'bulk' && retailRef > displayUnitPrice && (
                <span className="text-xs line-through text-slate-400 leading-none">{formatInr(retailRef)}</span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-lg font-black text-emerald-700 leading-none">{formatInr(retailRef)}</span>
        )}

        {liveOfferHint && !isOutOfStock && (
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wide line-clamp-1">{liveOfferHint}</p>
        )}
        <h3 className="text-sm font-bold text-slate-900 leading-tight line-clamp-2">{name}</h3>
        <p className="text-[11px] text-slate-500 line-clamp-1">{product?.unit ? `Per ${product.unit}` : 'Per kg'}</p>

        {/* Compact freshness row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {effectiveHarvestDate && <HarvestAge harvestDate={effectiveHarvestDate} compact />}
          {effectiveRipenessStage && (
            <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
              {effectiveRipenessStage}
            </span>
          )}
          {isOrganicProduct && (
            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
              Organic
            </span>
          )}
        </div>

        {/* Farm source */}
        {effectiveFarmName && (
          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{effectiveFarmName}{effectiveFarmState ? `, ${effectiveFarmState}` : ''}</span>
          </div>
        )}
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // DESKTOP CARD (premium)
  // ──────────────────────────────────────────────────────────────────────────
  const DesktopCard = (
    <div className="hidden sm:flex sm:flex-col sm:h-full">
      {/* ── Badge system ── */}
      <AnimatePresence>
        {isOutOfStock && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-red-600 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl">
            <div className="h-2 w-2 rounded-full bg-white" /> Out of stock
          </motion.div>
        )}
        {lowStock && !isOutOfStock && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-orange-500 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl">
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" /> Only {avail} left
          </motion.div>
        )}
        {badge && !isOutOfStock && !lowStock && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-slate-900 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> {badge}
          </motion.div>
        )}
        {isSeasonal && !badge && !isOutOfStock && !lowStock && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-blue-600 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-2xl">
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" /> In season until {(product as any)?.seasonalEnd ? new Date((product as any).seasonalEnd).toLocaleString('default', { month: 'long' }) : 'August'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wishlist / activity */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-30 space-y-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
        <motion.button whileHover={{ scale: 1.1, rotate: -12 }} whileTap={{ scale: 0.9 }}
          onClick={() => handleAction(() => setIsLiked(!isLiked))}
          className={cn("h-12 w-12 flex items-center justify-center rounded-2xl shadow-xl transition-all border border-white/20",
            isLiked ? "bg-red-500 text-white" : "bg-white/80 backdrop-blur-md text-slate-400 hover:text-red-500")}>
          <Heart className={cn("w-5 h-5", isLiked ? "fill-white" : "")} />
        </motion.button>
      </div>

      {/* ── Hero image ── */}
      <Link to={`/product/${id}`} className="relative h-52 sm:h-72 overflow-hidden bg-slate-50 block shrink-0">
        <ProductImage src={image} alt={name} isOutOfStock={isOutOfStock} />
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[2px]">
            <div className="bg-slate-900/90 text-white px-8 h-12 flex items-center justify-center rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] border border-white/10 shadow-3xl backdrop-blur-xl">
              Out of stock
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        {/* Freshness score — bottom-left of image */}
        {effectiveFreshnessScore != null && !isOutOfStock && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl">
            <FreshnessBar score={effectiveFreshnessScore} />
            <span className="text-[9px] font-black text-white uppercase tracking-wider">
              {effectiveFreshnessScore}/5
            </span>
          </div>
        )}
      </Link>

      {/* ── Intelligence panel ── */}
      <div className="p-4 sm:p-7 flex flex-col flex-1 relative">

        {/* Freshness Intelligence Row — NON-NEGOTIABLE */}
        <div className="mb-3 space-y-1.5">
          {/* Harvest date */}
          {effectiveHarvestDate && (
            <div className="flex items-center gap-1.5">
              <HarvestAge harvestDate={effectiveHarvestDate} />
            </div>
          )}

          {/* Farm + ripeness row */}
          <div className="flex flex-wrap items-center gap-2">
            {effectiveFarmName && (
              <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                <MapPin className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                {effectiveFarmName}{effectiveFarmState ? `, ${effectiveFarmState}` : ''}
              </div>
            )}
            {effectiveRipenessStage && (
              <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-full text-[9px] font-black text-amber-700 uppercase tracking-wider">
                {effectiveRipenessStage}
              </span>
            )}
            {isSeasonal && (
              <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-full text-[9px] font-black text-blue-700 uppercase tracking-wider">
                In season until {(product as any)?.seasonalEnd ? new Date((product as any).seasonalEnd).toLocaleString('default', { month: 'short' }) : 'Aug'}
              </span>
            )}
            {isOrganicProduct && (
              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-[9px] font-black text-emerald-700 uppercase tracking-wider">
                Organic
              </span>
            )}
          </div>
        </div>

        {/* Stock status (real numbers, no static ETA) */}
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">
          <span className={cn(lowStock ? 'text-orange-500' : '')}>
            {isOutOfStock ? 'Out of stock' : avail <= 10 ? `⚡ Only ${avail} left` : `${avail} in stock`}
          </span>
          {product?.reservedStock ? (
            <span className="text-slate-300">{product.reservedStock} reserved</span>
          ) : null}
        </div>

        {/* Pack selector */}
        {!isOutOfStock && hasBulk ? (
          <div className="mb-4 space-y-2">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Select pack</span>
            <select value={bulkDealMode ? 'bulk' : packKind} onChange={(e) => { if (bulkDealMode) return; setPackKind(e.target.value as 'retail' | 'bulk'); }}
              disabled={!!bulkDealMode}
              className="w-full text-[11px] font-black text-slate-900 border border-slate-200 rounded-xl px-3 py-2 bg-white">
              {!bulkDealMode && <option value="retail">1 {unitLabel} · {formatInr(retailRef)} each</option>}
              {bulkQty != null && bulkPriceVal != null && <option value="bulk">{bulkQty} {unitLabel} pack · {formatInr(Number(bulkPriceVal))} total</option>}
            </select>
            <Link to={`/contact?subject=${encodeURIComponent(`Bulk order: ${name}`)}`}
              className="inline-block text-[9px] font-black text-emerald-600 uppercase tracking-wider hover:underline">
              Need more? Contact us →
            </Link>
          </div>
        ) : !isOutOfStock ? (
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Quantity</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={(e) => { e.preventDefault(); setQuantity((q) => Math.max(1, q - 1)); }}
                className="h-7 w-7 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 text-xs font-black hover:bg-slate-50">-</button>
              <input type="text" inputMode="numeric" value={quantity} onClick={(e) => e.preventDefault()}
                onChange={(e) => { e.preventDefault(); const v = e.target.value; if (v === '') { setQuantity(1); return; } const n = parseInt(v, 10); if (!Number.isNaN(n)) { const max = product?.availableStock ?? stock; setQuantity(Math.max(1, Math.min(max || n, n))); } }}
                onBlur={(e) => { e.preventDefault(); if (!Number.isFinite(quantity) || quantity < 1) setQuantity(1); }}
                className="w-12 h-7 text-center text-[11px] font-black text-slate-800 border border-slate-200 rounded-lg bg-white" />
              <button type="button" onClick={(e) => { e.preventDefault(); setQuantity((q) => { const next = q + 1; const max = product?.availableStock ?? stock; if (max && next > max) { toast.error(`Only ${max} units available`); return max; } return next; }); }}
                className="h-7 w-7 rounded-xl border border-slate-900 bg-slate-900 text-white flex items-center justify-center text-xs font-black hover:bg-emerald-500 hover:border-emerald-500">+</button>
            </div>
          </div>
        ) : null}

        {/* Product name + desc */}
        <div className="flex-1 space-y-2 mb-4">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tighter uppercase leading-tight group-hover:text-emerald-600 transition-colors">
            {name}
          </h3>
          <p className="text-[11px] text-slate-400 font-bold italic leading-relaxed line-clamp-2 min-h-[2rem]">
            {description || 'Farm-fresh and quality assured.'}
          </p>
        </div>

        {/* ── Transaction rail ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-slate-50">
          <div className="shrink-0 space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">INR</span>
              <span className={cn("text-2xl sm:text-3xl font-black tracking-tighter transition-colors",
                isOutOfStock ? "text-slate-300" : "text-slate-900 group-hover:text-emerald-500")}>
                {formatInr(displayUnitPrice)}
              </span>
              {hasBulk && packKind === 'bulk' && retailRef > displayUnitPrice && (
                <span className="text-sm font-bold text-slate-400 line-through">{formatInr(retailRef)}</span>
              )}
            </div>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider italic">
              {hasBulk && packKind === 'bulk' && bulkQty ? `for ${bulkQty} ${unitLabel} pack` : `per ${unitLabel}`}
            </p>
            {hasBulk && bulkQty && bulkPriceVal != null && (
              <div className="mt-1 py-1 px-3 bg-emerald-50 rounded-lg inline-block border border-emerald-100/50">
                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider whitespace-nowrap">
                  {packKind === 'bulk'
                    ? (bulkDerivedUnitPrice != null ? `${formatInr(bulkDerivedUnitPrice)}/${unitLabel}` : 'Bulk selected')
                    : `Bulk: ${formatInr(Number(bulkPriceVal))} for ${bulkQty} ${unitLabel}`}
                </span>
              </div>
            )}
          </div>

          {/* Add to cart — optimistic, no spinner */}
          <motion.button
            whileHover={{ scale: isOutOfStock ? 1 : 1.05, x: 5 }}
            whileTap={{ scale: isOutOfStock ? 1 : 0.90 }}
            disabled={isOutOfStock}
            onClick={(e) => {
              e.preventDefault();
              if (isOutOfStock) return;
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([30, 50, 30]);
              const payload = product ?? id;
              const finalQty = hasBulk ? effectiveQty : Math.max(1, quantity);
              const maxAllowed = product?.availableStock ?? stock;
              if (finalQty > maxAllowed) { toast.error(`Only ${maxAllowed} units available`); return; }
              handleAction(() => onAddToCart(payload as any, finalQty));
            }}
            className={cn(
              "h-12 sm:h-14 px-5 sm:px-8 flex items-center gap-3 transition-all duration-300 shadow-xl rounded-2xl shrink-0",
              isOutOfStock ? "bg-slate-50 text-slate-200 cursor-not-allowed shadow-none" : "bg-slate-900 text-white hover:bg-emerald-500"
            )}>
            <div className="h-7 w-7 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
              {isOutOfStock ? 'Out of stock' : 'Add to cart'}
            </span>
          </motion.button>
        </div>

        {liveOfferHint && !isOutOfStock && (
          <div className="mt-3 py-2 px-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">🔥 {liveOfferHint}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      whileHover={{ y: -8 }}
      className="relative bg-white rounded-2xl sm:rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_24px_80px_rgba(16,185,129,0.10)] transition-all duration-500 group flex flex-col h-full"
    >
      {MobileCard}
      {DesktopCard}
    </motion.div>
  );
});

ProductCard.displayName = 'ProductCard';
