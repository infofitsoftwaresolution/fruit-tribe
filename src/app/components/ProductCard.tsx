import { memo, useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, MapPin, Leaf, CalendarDays, Tag, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { cn, formatInr } from '@/lib/utils';
import { parseVariantPackDescriptor } from '@/lib/variantPackLabel';
import { productHasBulkPricing, getRetailUnitReference, getBestEligibleBulkTier, formatPerUnitPackDiscountSuffix } from '@/lib/pricing';
import { variantPacksAvailable } from '@/lib/inventoryPool';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { PRODUCT_PLACEHOLDER_IMAGE } from '@/lib/productPlaceholder';

const PLACEHOLDER_IMAGE = PRODUCT_PLACEHOLDER_IMAGE;
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
        return !label.includes('(archived)');
      })
      .map((v: any) => {
        const parsed = parseVariantPackDescriptor(String(v.name || ''), unitLabel);
        const total = Number(v.price || retailRef);
        const discountSuffix = formatPerUnitPackDiscountSuffix(retailRef, parsed.packQty, total);
        const poolKg = Math.max(0, Number(product?.availableStock ?? product?.stock ?? stock ?? 0));
        const availableStock = variantPacksAvailable(poolKg, parsed.packQty);
        const variantId = String((v as any).id || '');
        const sku = String(v.sku || '');
        return {
          id: variantId,
          ...parsed,
          key: `variant:${variantId || sku}`,
          label: `${parsed.label} pack · ${formatInr(total)}${discountSuffix}`,
          price: total,
          stock: Number(v.stock ?? 0),
          availableStock,
          inStock: availableStock > 0,
          sku,
          name: parsed.label,
          isBulkVariant: Boolean((v as any).isBulkVariant),
        };
      });
    rows.sort((a, b) =>
      a.packQty !== b.packQty ? a.packQty - b.packQty : String(a.sku).localeCompare(String(b.sku)),
    );
    return rows;
  }, [product?.variants, retailRef, unitLabel]);
  const inStockVariantOptions = useMemo(
    () => variantOptions.filter((v) => v.inStock),
    [variantOptions],
  );
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
  const sortedPackSelectOptions = useMemo((): Array<{ value: string; label: string; sortQty: number; disabled?: boolean }> => {
    if (bulkDealMode) {
      if (dealVariantOptions.length > 0) {
        return dealVariantOptions.map((v) => ({
          value: v.key,
          label: v.label,
          sortQty: v.packQty,
        }));
      }
      if (hasLegacyBulkPack) {
        const bulkTotal = Number(bulkPriceVal);
        const bq = Number(bulkQty) || 0;
        const bulkSuffix = formatPerUnitPackDiscountSuffix(retailRef, bq, bulkTotal);
        return [
          {
            value: 'bulk',
            label: `${bulkQty} ${unitLabel} pack · ${formatInr(bulkTotal)} total${bulkSuffix}`,
            sortQty: bq,
          },
        ];
      }
    }
    const rows: Array<{ value: string; label: string; sortQty: number; disabled?: boolean }> = [];
    if (hasLegacyBulkPack) {
      const bulkTotal = Number(bulkPriceVal);
      const bq = Number(bulkQty) || 0;
      const bulkSuffix = formatPerUnitPackDiscountSuffix(retailRef, bq, bulkTotal);
      rows.push({
        value: 'bulk',
        label: `${bulkQty} ${unitLabel} pack · ${formatInr(bulkTotal)} total${bulkSuffix}`,
        sortQty: bq,
      });
    }
    for (const v of variantOptions) {
      const suffix = v.inStock ? '' : ' · Out of stock';
      rows.push({ value: v.key, label: `${v.label}${suffix}`, sortQty: v.packQty, disabled: !v.inStock });
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
    variantOptions,
  ]);

  const [packKind, setPackKind] = useState<string>(() =>
    bulkDealMode
      ? (defaultBulkVariantKey || (hasLegacyBulkPack ? 'bulk' : 'retail'))
      : (inStockVariantOptions[0]?.key || variantOptions[0]?.key || 'retail')
  );
  useEffect(() => {
    if (!bulkDealMode) return;
    setPackKind(defaultBulkVariantKey || (hasLegacyBulkPack ? 'bulk' : 'retail'));
  }, [bulkDealMode, hasLegacyBulkPack, defaultBulkVariantKey]);
  useEffect(() => {
    if (packKind.startsWith('variant:') && !variantOptions.some((v) => v.key === packKind)) {
      setPackKind(
        bulkDealMode && hasLegacyBulkPack
          ? 'bulk'
          : (inStockVariantOptions[0]?.key || variantOptions[0]?.key || 'retail'),
      );
    }
  }, [packKind, variantOptions, inStockVariantOptions, bulkDealMode, hasLegacyBulkPack]);
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
  const selectedVariantForCart = selectedVariant || null;
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
    if (!chosenVariant) {
      toast.error('Please select the correct pack.');
      return;
    }
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
                __selectedVariantName: '',
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
        {/* Delivery Starts June 12 Notice */}
        <div className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50/70 border border-amber-100 px-1.5 py-0.5 rounded-md self-start mt-0.5 select-none">
          <CalendarDays className="h-2.5 w-2.5 text-amber-600 shrink-0" />
          <span>Delivery starts from 12 June</span>
        </div>
        {!isOutOfStock && (hasBulk || variantOptions.length > 0) ? (
          <div className="relative self-start mt-0.5 max-w-full">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-[11px] font-semibold hover:bg-slate-100 transition-all select-none">
              <span className="truncate max-w-[85px]">{selectedPackLabel.split(' · ')[0]}</span>
              <ChevronDown className="h-3 w-3.5 text-slate-500 shrink-0" />
            </div>
            <select
              value={bulkDealMode ? 'bulk' : packKind}
              disabled={bulkDealMode}
              onChange={(e) => {
                setPackKind(e.target.value);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {sortedPackSelectOptions.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-xs text-slate-400">{product?.unit ? `Per ${product.unit}` : 'Per kg'}</p>
        )}
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
      <Link to={`/product/${id}`} className="relative aspect-[5/3] overflow-hidden bg-slate-50 block shrink-0">
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
      <div className="p-4 flex flex-col flex-1 gap-2.5">

        {/* Product name */}
        <Link to={`/product/${id}`} className="flex-1 flex flex-col items-start">
          <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2 mb-0.5 text-left">
            {name}
          </h3>
          {cleanDescription && (
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-1 text-left">
              {cleanDescription}
            </p>
          )}
          {/* Delivery Starts June 12 Notice */}
          <div className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50/70 border border-amber-100 px-2 py-0.5 rounded-md self-start mt-1 select-none">
            <CalendarDays className="h-3 w-3 text-amber-600 shrink-0" />
            <span>Delivery starts from 12 June</span>
          </div>
        </Link>

        {/* Pack selector if bulk */}
        {!isOutOfStock && (hasBulk || variantOptions.length > 0) && (
          <div>
            <div ref={packSelectRef} className="relative">
              <button
                type="button"
                onClick={() => { if (!bulkDealMode) setIsPackSelectOpen((prev) => !prev); }}
                className={cn(
                  "w-full h-10 pl-3 pr-9 text-left text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl bg-slate-50 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all",
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
                    const disabled = Boolean((opt as { disabled?: boolean }).disabled);
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          setPackKind(opt.value);
                          setIsPackSelectOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-[11px] transition-colors duration-150",
                          disabled
                            ? "text-slate-400 cursor-not-allowed"
                            : active
                              ? "bg-slate-100 text-slate-900 font-semibold cursor-default"
                              : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:font-semibold cursor-pointer",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quantity selector (retail) */}
        {!isOutOfStock && (!hasBulk || packKind !== 'bulk') && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">Quantity</span>
            <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1">
              <button type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-7 w-7 rounded-full text-slate-600 text-lg font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center">
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
                className="h-7 w-7 rounded-full text-slate-600 text-lg font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center">
                +
              </button>
            </div>
          </div>
        )}

        {/* Offer hint */}
        {liveOfferHint && !isOutOfStock && (
          <div className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg">
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

        {/* Price + Add to cart */}
        <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                'text-xl font-bold transition-colors',
                isOutOfStock ? 'text-slate-300' : 'text-slate-900'
              )}>
                {formatInr(displayUnitPrice)}
              </span>
              {hasBulk && packKind === 'bulk' && retailRef > displayUnitPrice && (
                <span className="text-xs text-slate-400 line-through">{formatInr(retailRef)}</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedVariant
                ? `${selectedVariant.name}`
                : hasLegacyBulkPack && packKind === 'bulk' && bulkQty
                  ? `for ${bulkQty} ${unitLabel}`
                  : `Inclusive of all taxes`}
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
                'flex items-center gap-1.5 h-10 px-4 rounded-full text-xs font-semibold transition-colors shrink-0',
                isOutOfStock
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-slate-800 shadow-sm'
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {isOutOfStock ? 'Sold out' : 'Add to Cart'}
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
      className="relative bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-md hover:shadow-2xl transition-all duration-300 group flex flex-col h-full"
    >
      {MobileCard}
      {DesktopCard}
    </motion.div>
  );
});

ProductCard.displayName = 'ProductCard';
