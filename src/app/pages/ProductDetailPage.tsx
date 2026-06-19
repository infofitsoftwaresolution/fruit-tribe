import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Share2, Minus, Plus, ChevronRight, ChevronDown, ShieldCheck, Truck, Star, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

import { parseVariantPackDescriptor } from '@/lib/variantPackLabel';
import { variantPacksAvailable } from '@/lib/inventoryPool';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { useProduct } from '@/app/hooks/useProducts';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';
import { AIRecommendations } from '@/app/components/AIRecommendations';
import { cn, formatInr } from '@/lib/utils';
import { productHasBulkPricing, getRetailUnitReference, getEffectiveUnitPrice, formatPerUnitPackDiscountSuffix, isProductInStock } from '@/lib/pricing';
import type { Product } from '@/lib/api';
import { PRODUCT_PLACEHOLDER_IMAGE } from '@/lib/productPlaceholder';
import { resolveProductDeliveryTag } from '@/lib/productDeliveryTag';
import { NotFoundPage } from './NotFoundPage';

interface ProductDetailPageProps {
  onAddToCart: (product: Product, quantity?: number) => void;
}

type InfoTab = 'details' | 'storage' | 'origin' | 'faq';
const PDP_META_PREFIX = '[PDP_META]';
const REVIEWS_STORAGE_KEY = 'ft_product_reviews_v1';

type ProductReview = {
  id: string;
  productId: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
};

function getStoredReviews(productId: string): ProductReview[] {
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProductReview[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => String(r.productId) === String(productId))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  } catch {
    return [];
  }
}

function addStoredReview(review: ProductReview) {
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ProductReview[]) : [];
    const next = Array.isArray(parsed) ? [review, ...parsed] : [review];
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // noop: avoid blocking UI on storage errors
  }
}

function parseProductDescription(raw?: string | null): {
  details: string;
  storageInfo: string;
  originStory: string;
  faqInfo: string;
} {
  if (!raw) {
    return { details: '', storageInfo: '', originStory: '', faqInfo: '' };
  }
  if (!raw.startsWith(PDP_META_PREFIX)) {
    return { details: raw, storageInfo: '', originStory: '', faqInfo: '' };
  }
  try {
    const parsed = JSON.parse(raw.slice(PDP_META_PREFIX.length)) as {
      details?: string;
      storageInfo?: string;
      originStory?: string;
      faqInfo?: string;
    };
    return {
      details: parsed.details || '',
      storageInfo: parsed.storageInfo || '',
      originStory: parsed.originStory || '',
      faqInfo: parsed.faqInfo || '',
    };
  } catch {
    return { details: raw, storageInfo: '', originStory: '', faqInfo: '' };
  }
}

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preferences } = useStore();
  const { product: apiProduct, loading, error } = useProduct(id || null);

  const [quantity, setQuantity] = useState(1);
  const [packKind, setPackKind] = useState<'retail' | 'bulk'>('retail');
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [pincode, setPincode] = useState('');
  const [pinDeliveryCheck, setPinDeliveryCheck] = useState<'idle' | 'ok' | 'fail' | 'no_list'>('idle');
  const { pincodes: serviceablePincodes, isPincodeServiceable } = useServiceableAreas();
  const [tab, setTab] = useState<InfoTab>('details');
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const handleAction = (callback: () => void) => {
    if (!user) {
      toast.info('Cart saved on this device', {
        description: 'Sign in at checkout to place your order.',
        action: { label: 'Sign in', onClick: () => navigate('/login') },
      });
    }
    callback();
  };

  const sortedSelectableVariants = useMemo((): Array<NonNullable<Product['variants']>[number] & { inStock: boolean }> => {
    if (!apiProduct) return [];
    const unit = apiProduct.unit || 'kg';
    const poolKg = Math.max(0, Number(apiProduct.availableStock ?? apiProduct.stock ?? 0));
    return (apiProduct.variants || [])
      .filter((v) => {
        const label = String(v.name || '').trim().toLowerCase();
        return !label.includes('(archived)');
      })
      .map((v) => {
        const packKg = parseVariantPackDescriptor(String(v.name || ''), unit).packQty;
        return {
          ...v,
          inStock: variantPacksAvailable(poolKg, packKg) > 0,
        };
      })
      .sort((a, b) => {
        const wa = parseVariantPackDescriptor(String(a.name || ''), unit).packQty;
        const wb = parseVariantPackDescriptor(String(b.name || ''), unit).packQty;
        if (wa !== wb) return wa - wb;
        return String(a.sku).localeCompare(String(b.sku));
      });
  }, [apiProduct]);
  const firstInStockVariantSku = useMemo(
    () => sortedSelectableVariants.find((v) => v.inStock)?.sku ?? null,
    [sortedSelectableVariants],
  );

  const product = useMemo(() => {
    if (!apiProduct) return null;

    const variantData = activeVariant && apiProduct.variants
      ? apiProduct.variants.find((v) => v.sku === activeVariant)
      : null;

    const sellPrice = variantData ? variantData.price : getRetailUnitReference(apiProduct);

    const descriptionMeta = parseProductDescription(apiProduct.description || '');
    return {
      ...apiProduct,
      sellPrice,
      stock: variantData ? variantData.stock : apiProduct.stock,
      availableStock: variantData ? variantData.availableStock : apiProduct.availableStock,
      sku: variantData ? variantData.sku : apiProduct.sku,
      fullDescription: descriptionMeta.details || 'No description available for this product yet.',
      storageInfo: descriptionMeta.storageInfo,
      originStory: descriptionMeta.originStory,
      faqInfo: descriptionMeta.faqInfo,
      highlights: [
        apiProduct.isOrganic ? 'Certified organic produce' : null,
        apiProduct.origin ? `Sourced from ${apiProduct.origin}` : null,
        apiProduct.isSeasonal ? 'Peak seasonal freshness' : null,
        apiProduct.allowCashOnDelivery !== false ? 'Cash on delivery available' : null,
      ].filter(Boolean) as string[],
    };
  }, [apiProduct, activeVariant]);

  const images = useMemo(() => {
    if (!product) return [PRODUCT_PLACEHOLDER_IMAGE];
    const list = [product.image, ...(product.images || [])]
      .map((img) => String(img || '').trim())
      .filter(Boolean);
    const unique = Array.from(new Set(list));
    return unique.length > 0 ? unique : [PRODUCT_PLACEHOLDER_IMAGE];
  }, [product?.image, product?.images]);

  useEffect(() => {
    if (!product) return;
    const gallery = (product.images || []).map((img) => String(img || '').trim()).filter(Boolean);
    const primary = String(product.image || '').trim();
    const next = primary || gallery[0] || PRODUCT_PLACEHOLDER_IMAGE;
    setActiveImage(next);
  }, [product?.image, product?.images, id]);

  useEffect(() => {
    setPackKind('retail');
    setQuantity(1);
    setActiveVariant(null);
  }, [id]);
  useEffect(() => {
    const current = String(activeVariant || '');
    const allSkus = sortedSelectableVariants.map((v: any) => String(v?.sku || '')).filter(Boolean);
    if (!allSkus.length) return;
    if (current && allSkus.includes(current)) return;
    const preferred = firstInStockVariantSku || sortedSelectableVariants[0]?.sku || null;
    if (preferred) setActiveVariant(String(preferred));
  }, [activeVariant, firstInStockVariantSku, sortedSelectableVariants]);

  useEffect(() => {
    if (!id) return;
    setReviews(getStoredReviews(id));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf8f2] pt-16">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 animate-pulse">
          <section className="p-6 sm:p-10">
            <div className="aspect-square rounded-3xl bg-slate-200" />
            <div className="mt-4 flex gap-2">
              <div className="h-16 w-16 rounded-xl bg-slate-200" />
              <div className="h-16 w-16 rounded-xl bg-slate-200" />
              <div className="h-16 w-16 rounded-xl bg-slate-200" />
            </div>
          </section>
          <section className="p-6 sm:p-10 space-y-4">
            <div className="h-6 w-24 rounded bg-slate-200" />
            <div className="h-10 w-3/4 rounded bg-slate-200" />
            <div className="h-5 w-1/2 rounded bg-slate-200" />
            <div className="h-20 w-full rounded-2xl bg-slate-200" />
            <div className="h-12 w-full rounded-xl bg-slate-200" />
          </section>
        </div>
      </div>
    );
  }
  if (error || !product || !apiProduct) {
    return <NotFoundPage />;
  }

  const deliveryTagText = resolveProductDeliveryTag(apiProduct, preferences.productDeliveryTag);
  const isOutOfStock = !isProductInStock(apiProduct);

  const hasBulk = productHasBulkPricing(apiProduct);
  const bulkQty = product.bulkDiscountQty;
  const bulkPriceVal = product.bulkDiscountPrice;
  const hasLegacyBulkPack = (() => {
    const q = Number(bulkQty);
    const p = Number(bulkPriceVal);
    const hasRealVariants = Number((apiProduct.variants || []).length) > 0;
    return Number.isFinite(q) && q > 0 && Number.isFinite(p) && p > 0 && !hasRealVariants;
  })();
  const activeVariantData =
    activeVariant && apiProduct.variants
      ? apiProduct.variants.find((v) => v.sku === activeVariant)
      : null;
  const activeVariantPackQty = activeVariantData
    ? parseVariantPackDescriptor(String(activeVariantData.name || ''), String(product.unit || 'kg')).packQty
    : 1;
  const selectedPackQty = Math.max(1, Number.isFinite(activeVariantPackQty) ? activeVariantPackQty : 1);
  const effectiveQty = hasLegacyBulkPack && packKind === 'bulk' && bulkQty && bulkQty > 0 ? bulkQty : quantity;
  const totalTierQty = hasLegacyBulkPack && packKind === 'bulk'
    ? Math.max(1, Number(bulkQty || 1))
    : Math.max(1, quantity * selectedPackQty);
  const tierUnitPrice = getEffectiveUnitPrice(
    {
      price: getRetailUnitReference(apiProduct),
      bulkDiscountQty: product.bulkDiscountQty,
      bulkDiscountPrice: product.bulkDiscountPrice,
      bulkDiscountTiers: (apiProduct as any).bulkDiscountTiers || (product as any).bulkDiscountTiers || [],
      variants: apiProduct.variants,
    },
    totalTierQty,
  );
  const currentPrice = hasLegacyBulkPack && packKind === 'bulk' && bulkPriceVal != null ? Number(bulkPriceVal) : Number(product.sellPrice);
  const displayTotalPrice = hasLegacyBulkPack && packKind === 'bulk'
    ? Math.max(0, Number(bulkPriceVal ?? currentPrice))
    : tierUnitPrice * totalTierQty;
  /** Hero price block always shows catalog base rate per unit (e.g. ₹/kg), not selected pack total. */
  const baseUnitPrice = getRetailUnitReference(apiProduct);
  const tiers = ((apiProduct as any)?.bulkDiscountTiers || (product as any)?.bulkDiscountTiers || []) as Array<{ qty: number; totalPrice: number; unitPrice?: number }>;
  const retailForRecommendation = baseUnitPrice;
  const recommendedTier = [...tiers]
    .map((t) => {
      const qty = Number(t.qty);
      const unit = Number(t.unitPrice ?? (Number(t.totalPrice) / qty));
      if (!(qty > 1) || !(unit > 0) || !(retailForRecommendation > 0)) return null;
      const discountPct = ((retailForRecommendation - unit) / retailForRecommendation) * 100;
      return { ...t, qty, unitPrice: unit, discountPct };
    })
    .filter((t): t is { qty: number; totalPrice: number; unitPrice: number; discountPct: number } => Boolean(t))
    .filter((t) => t.discountPct > 0)
    .sort((a, b) => b.discountPct - a.discountPct || b.qty - a.qty)
    .at(0) || null;
  const recommendedSavingPct = (() => {
    if (!recommendedTier) return 0;
    const unit = Number(recommendedTier.unitPrice ?? (Number(recommendedTier.totalPrice) / Number(recommendedTier.qty)));
    if (!(retailForRecommendation > 0) || !Number.isFinite(unit) || unit <= 0) return 0;
    return Math.max(0, Math.round(((retailForRecommendation - unit) / retailForRecommendation) * 100));
  })();
  const variantChoiceLabel = (variant: { name?: string; price?: number }) => {
    const parsed = parseVariantPackDescriptor(String(variant.name || ''), String(product.unit || 'kg'));
    const total = Number(variant.price);
    const suffix = formatPerUnitPackDiscountSuffix(retailForRecommendation, parsed.packQty, total);
    return `${parsed.label} pack · ${formatInr(total)}${suffix}`;
  };
  const reviewAverage = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const handleAddToCart = () => {
    if (product.stock <= 0) {
      toast.error('This item is out of stock');
      return;
    }
    const safeQty = Math.max(1, Math.min(effectiveQty, product.stock));
    const selectedVariant =
      (activeVariant
        ? apiProduct.variants?.find((variant) => String(variant.sku) === String(activeVariant))
        : null) || null;
    if (!selectedVariant) {
      toast.error('Please select the correct pack.');
      return;
    }
    const packInfo = selectedVariant
      ? parseVariantPackDescriptor(String(selectedVariant.name || ''), String(apiProduct.unit || 'kg'))
      : null;
    handleAction(() =>
      onAddToCart(
        {
          ...apiProduct,
          stock: product.stock,
          availableStock: product.availableStock,
          sku: product.sku,
          price: hasLegacyBulkPack && packKind === 'bulk' ? Number(product.sellPrice) : Number(tierUnitPrice),
          ...(selectedVariant
            ? {
                __selectedVariantSku: selectedVariant.sku,
                __selectedVariantId: selectedVariant.id ? String(selectedVariant.id) : undefined,
                __selectedVariantName: packInfo?.label || selectedVariant.name,
                __selectedVariantPackQty: packInfo?.packQty,
                __selectedVariantPackUnit: packInfo?.packUnit,
              }
            : {}),
        } as any,
        safeQty
      )
    );
    toast.success(`${product.name} added to cart`);
  };

  const handleSubmitReview = () => {
    if (!id) return;
    const comment = reviewComment.trim();
    if (comment.length < 6) {
      toast.error('Please write a slightly longer review.');
      return;
    }
    const review: ProductReview = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: id,
      author: user?.name || user?.email?.split('@')[0] || 'Customer',
      rating: reviewRating,
      comment,
      createdAt: new Date().toISOString(),
    };
    addStoredReview(review);
    const next = [review, ...reviews];
    setReviews(next);
    setReviewComment('');
    setReviewRating(5);
    toast.success('Review added. Thank you for your feedback!');
  };

  const handleShareProduct = async () => {
    if (!id || !product) return;
    const url = `${window.location.origin}/#/product/${id}`;
    const shareData = {
      title: `${product.name} | The Fruit Tribe`,
      text: `Check out ${product.name} on The Fruit Tribe.`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Product link copied');
      }
    } catch {
      // User-cancelled share should be silent; clipboard fallback for unsupported/error cases.
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Product link copied');
      } catch {
        toast.error('Could not share this product right now.');
      }
    }
  };

  const tabContent = {
    details: (
      <div className="space-y-4">
        <p className="text-sm text-slate-700 leading-relaxed">{product.fullDescription}</p>
        {product.highlights.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-3">
            {product.highlights.map((h, i) => (
              <li key={i} className="p-3 bg-white rounded-xl border border-slate-200 text-sm text-slate-700">{h}</li>
            ))}
          </ul>
        )}
      </div>
    ),
    storage: (
      <div className="text-sm text-slate-700 leading-relaxed">
        {product.storageInfo
          ? product.storageInfo
          : product.expiryDate
          ? `Best before ${new Date(product.expiryDate).toLocaleDateString('en-IN')}. Store in a cool and dry place; refrigerate once ripe/cut.`
          : 'Storage guidance is currently unavailable for this product.'}
      </div>
    ),
    origin: (
      <div className="text-sm text-slate-700 leading-relaxed">
        {product.originStory
          ? product.originStory
          : product.origin
            ? `This product is sourced from ${product.origin}.`
            : 'Origin information is currently unavailable.'}
      </div>
    ),
    faq: (
      <div className="space-y-3 text-sm text-slate-700">
        {product.faqInfo ? (
          <p className="whitespace-pre-line">{product.faqInfo}</p>
        ) : (
          <>
            <p><span className="font-semibold">Q:</span> Is this item fresh?</p>
            <p><span className="font-semibold">A:</span> Yes, availability and freshness are controlled from live catalog inventory.</p>
            <p><span className="font-semibold">Q:</span> Can I order in bulk?</p>
            <p><span className="font-semibold">A:</span> {hasBulk ? 'Yes, bulk pack options are available for this item.' : 'Bulk pricing is currently not configured for this item.'}</p>
          </>
        )}
      </div>
    ),
  } as const;

  return (
    <div className="min-h-screen bg-[#fdf8f2] pt-16">
      <div className="bg-[#f5ede0] border-y border-black/5 px-4 sm:px-8 py-2.5 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Link to="/" className="text-emerald-700 hover:underline">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/products" className="text-emerald-700 hover:underline">Fruits</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="truncate">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 bg-[#fdf8f2]">
        <section className="relative bg-emerald-50/70 border-b lg:border-b-0 lg:border-r border-black/5 p-4 sm:p-6 lg:p-10">
          <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(251,146,60,0.12),transparent_45%)]" />
          <div className="relative">
            <div className="rounded-3xl overflow-hidden bg-white border border-black/5 shadow-sm aspect-square">
              <img
                src={activeImage || PRODUCT_PLACEHOLDER_IMAGE}
                alt={product.name}
                onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER_IMAGE; }}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="absolute right-4 bottom-4 flex gap-2">
              <button className="h-11 w-11 rounded-xl bg-white/90 border border-black/10 flex items-center justify-center text-slate-600" onClick={handleShareProduct}>
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
            {images.map((img, idx) => (
              <button key={idx} onClick={() => setActiveImage(img)} className={cn('h-16 w-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer', activeImage === img ? 'border-emerald-600' : 'border-transparent')}>
                <img
                  src={(img || '').trim() || PRODUCT_PLACEHOLDER_IMAGE}
                  alt={`${product.name}-${idx}`}
                  onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER_IMAGE; }}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>

        <section className="p-4 sm:p-6 lg:p-10 bg-[#fdf8f2] space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {product.isSeasonal && <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold uppercase">Peak season</span>}
            {product.isOrganic && <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold uppercase">Organic</span>}
            <span className="px-3 py-1 rounded-full bg-emerald-900 text-emerald-100 text-[11px] font-semibold uppercase">Tribe Pick</span>
            {!isOutOfStock && (
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                {deliveryTagText}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold leading-tight text-emerald-900">{product.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{product.category} {product.origin ? `• ${product.origin}` : ''}</p>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-end gap-4">
            <div>
              <p className="text-4xl font-serif font-bold text-emerald-900">{formatInr(baseUnitPrice)}</p>
              <p className="text-xs text-slate-500">per {product.unit || 'kg'}</p>
              {recommendedTier && recommendedSavingPct > 0 && (
                <p className="text-xs font-semibold text-emerald-700 mt-1">
                  {`${Number(recommendedTier.qty)} ${product.unit || 'kg'} pack has ${recommendedSavingPct}% discount`}
                </p>
              )}
            </div>
            {product.discountPrice && (
              <div className="ml-auto text-right">
                <p className="text-sm text-slate-400 line-through">{formatInr(product.discountPrice)}</p>
                <span className="inline-flex px-2.5 py-1 rounded-full bg-orange-500 text-white text-xs font-semibold">Save</span>
              </div>
            )}
          </div>

          {sortedSelectableVariants.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Select option</p>
              
              {/* Responsive pill buttons wrapping cleanly on all viewport sizes */}
              <div className="flex flex-wrap gap-2 items-center">
                {sortedSelectableVariants.map((variant) => (
                  <button
                    key={variant.sku}
                    type="button"
                    disabled={!variant.inStock}
                    onClick={() => variant.inStock && setActiveVariant(variant.sku)}
                    className={cn(
                      'px-3 sm:px-4 h-9 sm:h-10 rounded-xl border text-xs sm:text-sm transition-colors cursor-pointer',
                      !variant.inStock && 'opacity-50 cursor-not-allowed',
                      activeVariant === variant.sku
                        ? 'bg-emerald-900 text-white border-emerald-900 shadow-sm'
                        : variant.isBulkVariant
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/50'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {variantChoiceLabel(variant)}
                    {!variant.inStock ? ' · OOS' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasLegacyBulkPack && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Select box size</p>
              <div className="flex flex-wrap gap-2">
                <button className={cn('px-4 h-10 rounded-xl border text-sm', packKind === 'retail' ? 'bg-emerald-900 text-white border-emerald-900' : 'bg-white border-slate-200 text-slate-700')} onClick={() => setPackKind('retail')}>
                  1 {product.unit || 'unit'}
                </button>
                <button className={cn('px-4 h-10 rounded-xl border text-sm', packKind === 'bulk' ? 'bg-emerald-900 text-white border-emerald-900' : 'bg-white border-slate-200 text-slate-700')} onClick={() => setPackKind('bulk')}>
                  {bulkQty || 1} {product.unit || 'units'} (bulk)
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Quantity</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white">
                <button className="h-10 w-10 flex items-center justify-center text-emerald-900 hover:bg-emerald-50" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus className="w-4 h-4" /></button>
                <span className="w-10 text-center text-sm font-semibold">{effectiveQty}</span>
                <button className="h-10 w-10 flex items-center justify-center text-emerald-900 hover:bg-emerald-50" onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} disabled={hasLegacyBulkPack && packKind === 'bulk'}><Plus className="w-4 h-4" /></button>
              </div>
              <span className="text-xs text-slate-500">Stock: {product.stock}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={handleAddToCart} disabled={product.stock <= 0} className={cn('h-12 rounded-xl font-semibold', product.stock <= 0 ? 'bg-slate-200 text-slate-500' : 'bg-emerald-900 text-white hover:bg-emerald-800')}>
              {product.stock <= 0 ? 'Out of stock' : `Add to cart • ${formatInr(displayTotalPrice)}`}
            </button>
            <button onClick={() => { handleAddToCart(); navigate('/cart'); }} disabled={product.stock <= 0} className="h-12 rounded-xl font-semibold bg-white border border-emerald-200 text-emerald-900 hover:bg-emerald-50">
              Buy now
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Check delivery availability</p>
            <div className="flex gap-2">
              <input
                value={pincode}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPincode(next);
                  if (serviceablePincodes.length === 0) {
                    setPinDeliveryCheck('idle');
                    return;
                  }
                  if (next.length < 6) {
                    setPinDeliveryCheck('idle');
                    return;
                  }
                  setPinDeliveryCheck(isPincodeServiceable(next) ? 'ok' : 'fail');
                }}
                placeholder="Enter pincode"
                className="flex-1 h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
              />
              <button
                type="button"
                className="h-10 px-4 rounded-xl bg-emerald-900 text-white text-sm font-semibold shrink-0"
                onClick={() => {
                  const d = pincode.replace(/\D/g, '');
                  if (d.length !== 6) {
                    toast.error('Enter a 6-digit PIN code.');
                    setPinDeliveryCheck('idle');
                    return;
                  }
                  if (serviceablePincodes.length === 0) {
                    setPinDeliveryCheck('no_list');
                    return;
                  }
                  setPinDeliveryCheck(isPincodeServiceable(d) ? 'ok' : 'fail');
                }}
              >
                Check
              </button>
            </div>
            {pinDeliveryCheck === 'ok' && (
              <p className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 inline-flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 shrink-0" /> Deliverable to this PIN. Free delivery may apply above the store threshold.
              </p>
            )}
            {pinDeliveryCheck === 'fail' && (
              <p className="mt-2 text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                Not deliverable — this PIN is not in our current service list.
              </p>
            )}
            {pinDeliveryCheck === 'no_list' && (
              <p className="mt-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                Delivery area is confirmed at checkout. Add serviceable PINs in admin settings to check availability here.
              </p>
            )}
            {pinDeliveryCheck === 'idle' && (
              <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 inline-flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Free delivery above configured threshold
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-800">Farm to doorstep</p>
              <p className="text-[11px] text-slate-500 mt-1">Sourced directly from partner farms.</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-800">Freshness guarantee</p>
              <p className="text-[11px] text-slate-500 mt-1">Quality checked before dispatch.</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-800">Naturally ripened</p>
              <p className="text-[11px] text-slate-500 mt-1">No artificial ripening claims shown.</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-800">Verified seller</p>
              <p className="text-[11px] text-slate-500 mt-1">Seller verification from admin platform.</p>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white border-t border-black/5 mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto border-b border-slate-200 no-scrollbar">
            {[
              ['details', 'Product Details'],
              ['storage', 'Storage & Usage'],
              ['origin', 'Origin Story'],
              ['faq', 'FAQ'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as InfoTab)}
                className={cn(
                  'h-12 px-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                  tab === key ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="py-6">{tabContent[tab]}</div>
        </div>
      </section>

      <section className="bg-[#f5ede0] border-t border-black/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-serif font-bold text-emerald-900">More from the Tribe</h2>
            <Link to="/products" className="text-sm font-semibold text-emerald-700 hover:underline">View all</Link>
          </div>
          <AIRecommendations currentProductId={(id || '') as any} limit={4} />
        </div>
      </section>

      <section className="bg-white border-t border-black/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-emerald-900">Customer reviews</h2>
              <p className="text-sm text-slate-500 mt-1">Real feedback from buyers of this product.</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-slate-900">{reviewAverage}</p>
              <p className="text-xs text-slate-500">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No reviews yet. Be the first to review this product.
                </div>
              ) : (
                reviews.slice(0, 8).map((review) => (
                  <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{review.author}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 mt-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={cn(
                            'w-4 h-4',
                            i <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200',
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-slate-700 mt-2 leading-relaxed">{review.comment}</p>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Write a review</h3>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReviewRating(i)}
                    className="p-0.5"
                  >
                    <Star className={cn('w-5 h-5', i <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share taste, freshness, quality, and delivery experience..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={handleSubmitReview}
                className="w-full h-10 rounded-xl bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800"
              >
                Submit review
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
