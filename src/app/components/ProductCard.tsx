import { memo, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, Star, ShieldCheck, Zap, ArrowRight, Activity, LeafyGreen, MapPin, Clock, CalendarDays } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { cn, formatInr, prefersReducedMotion } from '@/lib/utils';
import { productHasBulkPricing, getRetailUnitReference } from '@/lib/pricing';
import { formatDistanceToNow, parseISO } from 'date-fns';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800';

function ProductImage({ src, alt, isOutOfStock }: { src: string; alt: string; isOutOfStock: boolean }) {
  const [effectiveSrc, setEffectiveSrc] = useState(() => (src && src.trim()) ? src : PLACEHOLDER_IMAGE);
  const reduceMotion = prefersReducedMotion();
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
        'w-full h-full object-cover transition-all duration-700',
        reduceMotion ? '' : 'group-hover:scale-110',
        isOutOfStock ? 'grayscale opacity-40' : ''
      )}
      whileHover={reduceMotion ? undefined : { rotate: 1 }}
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
  const reduceMotion = prefersReducedMotion();

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

  const ZeptoCard = (
    <div className="flex flex-col h-full">
      <Link to={`/product/${id}`} className="relative h-36 sm:h-44 overflow-hidden bg-slate-50 block">
        <ProductImage src={image} alt={name} isOutOfStock={isOutOfStock} />
        {lowStock && !isOutOfStock && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-orange-500 text-white text-[10px] font-bold">
            Only {avail} left
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
            <span className="px-3 py-1 rounded-md bg-white text-slate-700 text-xs font-semibold">Out of stock</span>
          </div>
        )}
      </Link>

      <div className="p-3 flex-1 flex flex-col gap-2">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 line-clamp-2">{name}</h3>
        <p className="text-xs text-slate-500">{product?.unit ? `1 ${product.unit}` : '1 kg'}</p>

        {hasBulk ? (
          <select
            value={bulkDealMode ? 'bulk' : packKind}
            onChange={(e) => { if (!bulkDealMode) setPackKind(e.target.value as 'retail' | 'bulk'); }}
            disabled={!!bulkDealMode}
            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
          >
            {!bulkDealMode && <option value="retail">Regular • {formatInr(retailRef)}</option>}
            {bulkQty != null && bulkPriceVal != null && (
              <option value="bulk">Bulk ({bulkQty} {unitLabel}) • {formatInr(Number(bulkPriceVal))}</option>
            )}
          </select>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <div className="text-base sm:text-lg font-bold text-slate-900">{formatInr(displayUnitPrice)}</div>
            {hasBulk && packKind === 'bulk' && retailRef > displayUnitPrice && (
              <div className="text-xs text-slate-400 line-through">{formatInr(retailRef)}</div>
            )}
          </div>

          {cartQty > 0 && !isOutOfStock ? (
            <div className="h-9 px-1.5 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleUpdateQuantity(id, -1)}
                className="h-7 w-7 rounded-md border border-emerald-200 bg-white text-emerald-700 font-bold"
              >
                -
              </button>
              <span className="min-w-[1.25rem] text-center text-sm font-semibold text-emerald-800">{cartQty}</span>
              <button
                type="button"
                onClick={() => {
                  if (cartQty >= avail) {
                    toast.error(`Only ${avail} units available`);
                    return;
                  }
                  handleUpdateQuantity(id, 1);
                }}
                className="h-7 w-7 rounded-md border border-emerald-600 bg-emerald-600 text-white font-bold"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                if (isOutOfStock) return;
                const payload = product ?? id;
                const finalQty = hasBulk ? effectiveQty : Math.max(1, quantity);
                if (finalQty > avail) {
                  toast.error(`Only ${avail} units available`);
                  return;
                }
                handleAction(() => onAddToCart(payload as any, finalQty));
              }}
              className={cn(
                "h-9 px-4 rounded-lg text-xs font-semibold border transition-colors",
                isOutOfStock
                  ? "bg-slate-100 text-slate-400 border-slate-200"
                  : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              )}
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -8 }}
      className="relative bg-white rounded-2xl sm:rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_24px_80px_rgba(16,185,129,0.10)] transition-all duration-500 group flex flex-col h-full"
    >
      {ZeptoCard}
    </motion.div>
  );
});

ProductCard.displayName = 'ProductCard';
