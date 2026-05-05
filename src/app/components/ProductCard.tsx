import { memo, useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, MapPin, Leaf, CalendarDays, Tag, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { cn, formatInr } from '@/lib/utils';
import { parseVariantPackDescriptor } from '@/lib/variantPackLabel';
import { productHasBulkPricing, getRetailUnitReference, getBestEligibleBulkTier } from '@/lib/pricing';
import { formatDistanceToNow, parseISO } from 'date-fns';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800';
const PDP_META_PREFIX = '[PDP_META]';
const PDP_META_LEGACY_PREFIX = '[PDP_META';

function sanitizeCardDescription(value?: string): string {
  if (!value) return '';
  if (!value.startsWith(PDP_META_LEGACY_PREFIX)) return value;
  try {
    const payload = value.startsWith(PDP_META_PREFIX)
      ? value.slice(PDP_META_PREFIX.length)
      : value.slice(PDP_META_LEGACY_PREFIX.length);
    const parsed = JSON.parse(payload) as { details?: string };
    return (parsed.details || '').trim();
  } catch {
    return '';
  }
}

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
  const [quantity, setQuantity] = useState(1);
  const [isPackSelectOpen, setIsPackSelectOpen] = useState(false);
  const packSelectRef = useRef<HTMLDivElement | null>(null);

  const effectiveFarmName       = farmName       ?? (product as any)?.farmName       ?? product?.vendor ?? null;
  const effectiveFarmState      = farmState      ?? (product as any)?.farmState      ?? null;
  const effectiveFreshnessScore = freshnessScore ?? (product as any)?.freshnessScore ?? null;
  const effectiveRipenessStage  = ripenessStage  ?? (product as any)?.ripenessStage  ?? null;
  const effectiveHarvestDate    = harvestDate    ?? product?.harvestDate              ?? null;

  const productForBulk = useMemo(() => ({
    price: product?.price ?? price,
    bulkDiscountQty: bulkDiscountQty ?? product?.bulkDiscountQty,
    bulkDiscountPrice: bulkDiscountPrice ?? product?.bulkDiscountPrice,
    bulkDiscountTiers: (product as any)?.bulkDiscountTiers,
    availableStock: product?.availableStock ?? stock,
    stock,
    variants: product?.variants,
  }), [price, stock, bulkDiscountQty, bulkDiscountPrice, product?.price, product?.availableStock,
       product?.bulkDiscountQty, product?.bulkDiscountPrice, (product as any)?.bulkDiscountTiers, product?.variants]);

  const hasBulk      = productHasBulkPricing(productForBulk);
  const retailRef    = useMemo(() => getRetailUnitReference(productForBulk), [productForBulk]);
  const bulkQty      = productForBulk.bulkDiscountQty;
  const bulkPriceVal = productForBulk.bulkDiscountPrice;
  const unitLabel    = product?.unit ? product.unit : 'kg';

  const variantOptions = useMemo(() => {
    const rows = (product?.variants || [])
      .filter((v: any) => {
        const label = String(v?.name || '').trim().toLowerCase();
        const avail = Number(v?.availableStock ?? v?.stock ?? 0);
        return label !== 'default' && !label.includes('(archived)') && avail > 0;
      })
      .map((v: any) => {
        const parsed = parseVariantPackDescriptor(String(v.name || ''), unitLabel);
        return {
          id: String((v as any).id || ''),
          ...parsed,
          key: `variant:${v.sku}`,
          label: `${parsed.label} pack · ${formatInr(Number(v.price || retailRef))}`,
          price: Number(v.price || retailRef),
          stock: Number(v.stock ?? 0),
          availableStock: Number(v.availableStock ?? v.stock ?? 0),
          sku: String(v.sku || ''),
          name: parsed.label,
          isBulkVariant: Boolean((v as any).isBulkVariant),
        };
      });
    rows.sort((a, b) =>
      a.packQty !== b.packQty ? a.packQty - b.packQty : String(a.sku).localeCompare(String(b.sku)),
    );
    return rows;
  }, [product?.variants, retailRef, unitLabel]);
  const normalVariantOptions = useMemo(
    () => variantOptions.filter((v) => !v.isBulkVariant),
    [variantOptions],
  );
  const bulkVariantOptions = useMemo(
    () => variantOptions.filter((v) => v.isBulkVariant),
    [variantOptions],
  );
  const discountedVariantOptions = useMemo(
    () =>
      variantOptions.filter((v) => {
        const qty = Number(v.packQty || 0);
        const total = Number(v.price || 0);
        if (!(qty > 1) || !(total > 0) || !(retailRef > 0)) return false;
        return (total / qty) < retailRef;
      }),
    [variantOptions, retailRef],
  );
  const dealVariantOptions = useMemo(
    () => (bulkVariantOptions.length > 0 ? bulkVariantOptions : discountedVariantOptions),
    [bulkVariantOptions, discountedVariantOptions],
  );
  const hasLegacyBulkPack = useMemo(() => {
    const q = Number(bulkQty);
    const p = Number(bulkPriceVal);
    const hasRealVariants = variantOptions.length > 0;
    return Number.isFinite(q) && q > 0 && Number.isFinite(p) && p > 0 && !hasRealVariants;
  }, [bulkQty, bulkPriceVal, variantOptions.length]);
  const defaultBulkVariantKey = useMemo(() => {
    if (!dealVariantOptions.length) return null;
    const best = [...dealVariantOptions]
      .sort((a, b) => {
        const discountA = retailRef > 0 ? ((retailRef - Number(a.price) / Number(a.packQty || 1)) / retailRef) : 0;
        const discountB = retailRef > 0 ? ((retailRef - Number(b.price) / Number(b.packQty || 1)) / retailRef) : 0;
        if (discountA !== discountB) return discountB - discountA;
        return Number(b.packQty || 0) - Number(a.packQty || 0);
      })
      .at(0) || null;
    return best?.key || null;
  }, [dealVariantOptions, retailRef]);

  /** Single sorted list: retail (1 unit), bulk slab, and variants — all ordered by pack weight. */
  const sortedPackSelectOptions = useMemo(() => {
    if (bulkDealMode) {
      if (dealVariantOptions.length > 0) {
        return dealVariantOptions.map((v) => ({
          value: v.key,
          label: v.label,
          sortQty: v.packQty,
        }));
      }
      if (hasLegacyBulkPack) {
        return [
          {
            value: 'bulk',
            label: `${bulkQty} ${unitLabel} pack · ${formatInr(Number(bulkPriceVal))} total`,
            sortQty: Number(bulkQty) || 0,
          },
        ];
      }
    }
    const rows: Array<{ value: string; label: string; sortQty: number }> = [];
    rows.push({
      value: 'retail',
      label: `1 ${unitLabel} · ${formatInr(retailRef)}`,
      sortQty: 1,
    });
    if (hasLegacyBulkPack) {
      rows.push({
        value: 'bulk',
        label: `${bulkQty} ${unitLabel} pack · ${formatInr(Number(bulkPriceVal))} total`,
        sortQty: Number(bulkQty) || 0,
      });
    }
    for (const v of normalVariantOptions) {
      rows.push({ value: v.key, label: v.label, sortQty: v.packQty });
    }
    rows.sort((a, b) =>
      a.sortQty !== b.sortQty ? a.sortQty - b.sortQty : a.value.localeCompare(b.value),
    );
    return rows;
  }, [
    bulkDealMode,
    dealVariantOptions,
    hasBulk,
    hasLegacyBulkPack,
    bulkQty,
    bulkPriceVal,
    unitLabel,
    retailRef,
    normalVariantOptions,
  ]);

  const [packKind, setPackKind] = useState<string>(() =>
    bulkDealMode
      ? (defaultBulkVariantKey || (hasLegacyBulkPack ? 'bulk' : 'retail'))
      : 'retail'
  );
  useEffect(() => {
    if (!bulkDealMode) return;
    setPackKind(defaultBulkVariantKey || (hasLegacyBulkPack ? 'bulk' : 'retail'));
  }, [bulkDealMode, hasLegacyBulkPack, defaultBulkVariantKey]);
  useEffect(() => {
    if (packKind.startsWith('variant:') && !variantOptions.some((v) => v.key === packKind)) {
      setPackKind(bulkDealMode && hasLegacyBulkPack ? 'bulk' : 'retail');
    }
  }, [packKind, variantOptions, bulkDealMode, hasLegacyBulkPack]);
    useEffect(() => {
    const onDocPointerDown = (ev: MouseEvent) => {
      if (!packSelectRef.current) return;
      if (!packSelectRef.current.contains(ev.target as Node)) {
        setIsPackSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, []);

  const selectedVariant   = packKind.startsWith('variant:')
    ? variantOptions.find((v) => v.key === packKind) || null
    : null;
  const retailVariantForCart = useMemo(() => {
    if (packKind !== 'retail') return null;
    const all = (variantOptions || []).filter((v: any) => !Boolean(v?.isBulkVariant));
    if (!all.length) return null;
    const oneUnitLike = all.filter((v: any) => {
      const q = Number(v?.packQty || 0);
      return Number.isFinite(q) && Math.abs(q - 1) < 1e-6;
    });
    if (!oneUnitLike.length) return null;
    const best = [...oneUnitLike].sort((a: any, b: any) => {
      const da = Math.abs(Number(a?.price || 0) - Number(retailRef || 0));
      const db = Math.abs(Number(b?.price || 0) - Number(retailRef || 0));
      if (da !== db) return da - db;
      return Number(a?.availableStock || 0) - Number(b?.availableStock || 0);
    })[0];
    return best || null;
  }, [packKind, variantOptions, retailRef]);
  const selectedVariantForCart = selectedVariant || retailVariantForCart || null;
  const effectiveQty      = hasLegacyBulkPack && packKind === 'bulk' && bulkQty && bulkQty > 0
    ? bulkQty
    : Math.max(1, quantity);
  const bulkPackTotal     = hasLegacyBulkPack && bulkPriceVal != null ? Number(bulkPriceVal) : null;
  const displayUnitPrice  = selectedVariant
    ? selectedVariant.price
    : hasLegacyBulkPack && packKind === 'bulk' && bulkPackTotal != null
      ? bulkPackTotal
      : retailRef;
  const bulkDerivedUnit   = bulkPackTotal != null && bulkQty && bulkQty > 0 ? bulkPackTotal / bulkQty : null;
  const bulkSavingPct     = bulkDerivedUnit != null && retailRef > 0
    ? Math.round(((retailRef - bulkDerivedUnit) / retailRef) * 100) : 0;
  const recommendedTier = useMemo(() => {
    const tiers = ((productForBulk as any)?.bulkDiscountTiers || []) as Array<{ qty: number; totalPrice: number; unitPrice?: number }>;
    if (!tiers.length) return getBestEligibleBulkTier(productForBulk as any, Number(bulkQty || 0));
    const normalized = tiers
      .map((t) => {
        const qty = Number(t.qty);
        const unit = Number(t.unitPrice ?? (Number(t.totalPrice) / qty));
        if (!(qty > 1) || !(unit > 0) || !(retailRef > 0)) return null;
        const discountPct = ((retailRef - unit) / retailRef) * 100;
        return { ...t, qty, unitPrice: unit, discountPct };
      })
      .filter((t): t is { qty: number; totalPrice: number; unitPrice: number; discountPct: number } => Boolean(t))
      .filter((t) => t.discountPct > 0)
      .sort((a, b) => b.discountPct - a.discountPct || b.qty - a.qty);
    return normalized[0] || null;
  }, [productForBulk, bulkQty, retailRef]);
  const recommendedSavingPct = useMemo(() => {
    if (!recommendedTier || !(retailRef > 0)) return 0;
    const unit = Number(recommendedTier.unitPrice ?? (Number(recommendedTier.totalPrice) / Number(recommendedTier.qty)));
    if (!Number.isFinite(unit) || unit <= 0) return 0;
    return Math.max(0, Math.round(((retailRef - unit) / retailRef) * 100));
  }, [recommendedTier, retailRef]);

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

  const avail        = selectedVariant?.availableStock ?? product?.availableStock ?? stock;
  const isOutOfStock = avail <= 0;
  const lowStock     = !isOutOfStock && avail <= (product?.lowStockThreshold ?? 10);
  const isOrganicProduct = Boolean(product?.isOrganic ?? isOrganic);
  const selectedVariantSku = String((selectedVariantForCart as any)?.sku || '').trim();
  const selectedVariantId = String((selectedVariantForCart as any)?.id || '').trim();
  const lineKey = `${String(id)}::${selectedVariantSku || selectedVariantId}`;
  const cartQty = cartItems
    .filter(
      (item) =>
        String(item.id) === String(id) &&
        (selectedVariantId
          ? String((item as any).selectedVariantId || '') === String(selectedVariantId)
          : String((item as any).selectedVariantSku || '') === String(selectedVariantSku || ''))
    )
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const cleanDescription = useMemo(() => sanitizeCardDescription(description), [description]);
  const selectedPackLabel = useMemo(() => {
    const effective = bulkDealMode ? 'bulk' : packKind;
    return (
      sortedPackSelectOptions.find((opt) => opt.value === effective)?.label ||
      variantOptions.find((opt) => opt.key === effective)?.label ||
      sortedPackSelectOptions[0]?.label ||
      ''
    );
  }, [bulkDealMode, packKind, sortedPackSelectOptions, variantOptions]);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([20, 30, 20]);
    const chosenVariant = selectedVariantForCart || null;
    const chosenPack = chosenVariant
      ? parseVariantPackDescriptor(String(chosenVariant?.name || ''), unitLabel)
      : null;
    const payload = product
      ? {
          ...product,
          ...(chosenVariant
            ? {
                price: Number((chosenVariant as any).price ?? displayUnitPrice),
                sku: String((chosenVariant as any).sku || product?.sku || ''),
                stock: Number((chosenVariant as any).stock ?? product?.stock ?? stock),
                availableStock: Number((chosenVariant as any).availableStock ?? (chosenVariant as any).stock ?? product?.availableStock ?? stock),
                __selectedVariantId: (chosenVariant as any).id ? String((chosenVariant as any).id) : undefined,
                __selectedVariantSku: String((chosenVariant as any).sku || ''),
                __selectedVariantName: String((chosenVariant as any).name || chosenPack?.label || ''),
                __selectedVariantPackQty: Number(chosenPack?.packQty || 1),
                __selectedVariantPackUnit: String(chosenPack?.packUnit || unitLabel),
              }
            : {
                __selectedVariantName: `1 ${unitLabel}`,
                __selectedVariantPackQty: 1,
                __selectedVariantPackUnit: String(unitLabel || 'kg'),
              }),
        }
      : id;
    const finalQty = effectiveQty;
    const maxAllowed = selectedVariant?.availableStock ?? product?.availableStock ?? stock;
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
                <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={(e) => { e.preventDefault(); handleUpdateQuantity(lineKey, -1); }}
                  className="h-6 w-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-semibold">−</motion.button>
                <span className="min-w-[1.25rem] text-center text-[11px] font-bold text-slate-900">{cartQty}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); if (cartQty >= avail) { toast.error(`Only ${avail} units available`); return; } handleUpdateQuantity(lineKey, 1); }}
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

        {/* Freshness indicator */}
        {effectiveFreshnessScore != null && !isOutOfStock && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg">
            <FreshnessBar score={effectiveFreshnessScore} />
            <span className="text-[10px] text-white font-medium">{effectiveFreshnessScore}/5</span>
          </div>
        )}
      </Link>

      {/* Info panel */}
      <div className="p-3 flex flex-col flex-1">

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[18px]">
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
          {effectiveHarvestDate && <HarvestAge harvestDate={effectiveHarvestDate} />}
        </div>

        {/* Product name */}
        <Link to={`/product/${id}`} className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2 mb-0.5">
            {name}
          </h3>
          {cleanDescription && (
            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-1">
              {cleanDescription}
            </p>
          )}
        </Link>

        {/* Farm source */}
        {effectiveFarmName && (
          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-400">
            <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
            <span className="truncate">{effectiveFarmName}{effectiveFarmState ? `, ${effectiveFarmState}` : ''}</span>
          </div>
        )}

        {/* Pack selector if bulk */}
        {!isOutOfStock && (hasBulk || variantOptions.length > 0) && (
          <div className="mt-2">
            <div ref={packSelectRef} className="relative">
              <button
                type="button"
                onClick={() => { if (!bulkDealMode) setIsPackSelectOpen((prev) => !prev); }}
                className={cn(
                  "w-full h-9 pl-3 pr-9 text-left text-[11px] font-semibold text-slate-800 border border-slate-200 rounded-xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all",
                  bulkDealMode && "cursor-not-allowed opacity-90"
                )}
              >
                <span className="line-clamp-1">{selectedPackLabel}</span>
                <ChevronDown
                  className={cn(
                    'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 transition-transform',
                    isPackSelectOpen && 'rotate-180'
                  )}
                />
              </button>
              {!bulkDealMode && isPackSelectOpen && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  {sortedPackSelectOptions.map((opt) => {
                    const active = (bulkDealMode ? 'bulk' : packKind) === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => {
                          setPackKind(opt.value);
                          setIsPackSelectOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-[11px] transition-colors duration-150 cursor-pointer",
                          active
                            ? "bg-slate-100 text-slate-900 font-semibold cursor-default"
                            : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:font-semibold"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {bulkVariantOptions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bulkVariantOptions.map((opt) => {
                  const active = packKind === opt.key;
                  return (
                    <button
                      type="button"
                      key={opt.key}
                      onClick={() => setPackKind(opt.key)}
                      className={cn(
                        'px-2.5 h-7 rounded-lg border text-[10px] font-semibold transition-colors',
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
                      )}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quantity selector (retail) */}
        {!isOutOfStock && (!hasBulk || packKind !== 'bulk') && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-slate-400 font-medium">Qty</span>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-6 w-6 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center">
                −
              </button>
              <span className="w-5 text-center text-sm font-semibold text-slate-900">{quantity}</span>
              <button type="button"
                onClick={() => setQuantity((q) => {
                  const next = q + 1;
                  const max = product?.availableStock ?? stock;
                  if (max && next > max) { toast.error(`Only ${max} units available`); return max; }
                  return next;
                })}
                className="h-6 w-6 rounded-lg border border-slate-200 bg-slate-900 text-white text-sm font-semibold hover:bg-emerald-600 hover:border-emerald-600 transition-colors flex items-center justify-center">
                +
              </button>
            </div>
          </div>
        )}

        {/* Offer hint */}
        {liveOfferHint && !isOutOfStock && (
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg">
            <Tag className="h-3 w-3 text-emerald-600 shrink-0" />
            <span className="text-[10px] font-medium text-emerald-700 line-clamp-1">{liveOfferHint}</span>
          </div>
        )}
        {recommendedTier && recommendedSavingPct > 0 && !isOutOfStock && (
          <div className="mt-2 px-2 py-1 rounded-lg bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-semibold text-emerald-700">
              {`${Number(recommendedTier.qty)} ${unitLabel} pack has ${recommendedSavingPct}% discount`}
            </span>
          </div>
        )}

        {/* Bulk quantity help */}
        <Link
          to={`/contact?topic=bulk-order&product=${encodeURIComponent(name)}`}
          className="mt-3 inline-flex items-center text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          Need more quantity? Contact us
        </Link>

        {/* Price + Add to cart */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                'text-base font-bold transition-colors',
                isOutOfStock ? 'text-slate-300' : 'text-slate-900'
              )}>
                {formatInr(displayUnitPrice)}
              </span>
              {hasBulk && packKind === 'bulk' && retailRef > displayUnitPrice && (
                <span className="text-xs text-slate-400 line-through">{formatInr(retailRef)}</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0">
              {selectedVariant
                ? `${selectedVariant.name}`
                : hasLegacyBulkPack && packKind === 'bulk' && bulkQty
                  ? `for ${bulkQty} ${unitLabel}`
                  : `per ${unitLabel}`}
            </p>
          </div>

          {/* Stock count in cart or add button */}
          {cartQty > 0 && !isOutOfStock ? (
            <div className="flex items-center gap-1 h-8 px-1 rounded-lg border border-slate-200 bg-white shadow-sm">
              <motion.button whileTap={{ scale: 0.85 }} type="button"
                onClick={() => handleUpdateQuantity(lineKey, -1)}
                className="h-6 w-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold">−</motion.button>
              <span className="min-w-[1.25rem] text-center text-sm font-bold text-slate-900">{cartQty}</span>
              <motion.button whileTap={{ scale: 0.85 }} type="button"
                onClick={() => { if (cartQty >= avail) { toast.error(`Only ${avail} units available`); return; } handleUpdateQuantity(lineKey, 1); }}
                className="h-6 w-6 rounded-md bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">+</motion.button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: isOutOfStock ? 1 : 0.95 }}
              disabled={isOutOfStock}
              onClick={handleAddToCart}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors shrink-0',
                isOutOfStock
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
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
