import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Share2, Minus, Plus, ChevronRight, ShieldCheck, Truck, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { useProduct } from '@/app/hooks/useProducts';
import { AIRecommendations } from '@/app/components/AIRecommendations';
import { cn, formatInr } from '@/lib/utils';
import { productHasBulkPricing, getRetailUnitReference } from '@/lib/pricing';
import type { Product } from '@/lib/api';
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
  const { product: apiProduct, loading, error } = useProduct(id || null);

  const [quantity, setQuantity] = useState(1);
  const [packKind, setPackKind] = useState<'retail' | 'bulk'>('retail');
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [pincode, setPincode] = useState('');
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

  useEffect(() => {
    if (product && !activeImage) {
      setActiveImage(product.image || product.images?.[0] || null);
    }
  }, [product, activeImage]);

  useEffect(() => {
    setPackKind('retail');
    setQuantity(1);
    setActiveVariant(null);
  }, [id]);

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

  const hasBulk = productHasBulkPricing(apiProduct);
  const bulkQty = product.bulkDiscountQty;
  const bulkPriceVal = product.bulkDiscountPrice;
  const effectiveQty = hasBulk && packKind === 'bulk' && bulkQty && bulkQty > 0 ? bulkQty : quantity;
  const currentPrice = hasBulk && packKind === 'bulk' && bulkPriceVal != null ? Number(bulkPriceVal) : Number(product.sellPrice);
  const images = [product.image, ...(product.images || [])].filter(Boolean) as string[];
  const reviewAverage = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const handleAddToCart = () => {
    if (product.stock <= 0) {
      toast.error('This item is out of stock');
      return;
    }
    const safeQty = Math.max(1, Math.min(effectiveQty, product.stock));
    handleAction(() => onAddToCart({ ...apiProduct, stock: product.stock, availableStock: product.availableStock }, safeQty));
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

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2">
        <section className="relative bg-emerald-50/70 border-r border-black/5 p-6 sm:p-10">
          <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(251,146,60,0.12),transparent_45%)]" />
          <div className="relative">
            <div className="rounded-3xl overflow-hidden bg-white border border-black/5 shadow-sm aspect-square">
              <img src={activeImage || ''} alt={product.name} className="w-full h-full object-cover" />
            </div>

            <div className="absolute right-4 bottom-4 flex gap-2">
              <button className="h-11 w-11 rounded-xl bg-white/90 border border-black/10 flex items-center justify-center text-slate-600" onClick={() => setIsLiked((v) => !v)}>
                <Heart className={cn('w-5 h-5', isLiked && 'fill-red-500 text-red-500')} />
              </button>
              <button className="h-11 w-11 rounded-xl bg-white/90 border border-black/10 flex items-center justify-center text-slate-600">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto">
            {images.map((img, idx) => (
              <button key={idx} onClick={() => setActiveImage(img)} className={cn('h-16 w-16 rounded-xl overflow-hidden border-2 shrink-0', activeImage === img ? 'border-emerald-600' : 'border-transparent')}>
                <img src={img} alt={`${product.name}-${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-10 bg-[#fdf8f2] space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {product.isSeasonal && <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold uppercase">Peak season</span>}
            {product.isOrganic && <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold uppercase">Organic</span>}
            <span className="px-3 py-1 rounded-full bg-emerald-900 text-emerald-100 text-[11px] font-semibold uppercase">Tribe Pick</span>
          </div>

          <div>
            <h1 className="text-4xl sm:text-5xl font-serif font-bold leading-tight text-emerald-900">{product.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{product.category} {product.origin ? `• ${product.origin}` : ''}</p>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-end gap-4">
            <div>
              <p className="text-4xl font-serif font-bold text-emerald-900">{formatInr(currentPrice)}</p>
              <p className="text-xs text-slate-500">per {hasBulk && packKind === 'bulk' ? `${bulkQty || 1} ${product.unit || 'unit'} pack` : `${product.unit || 'unit'}`}</p>
            </div>
            {product.discountPrice && (
              <div className="ml-auto text-right">
                <p className="text-sm text-slate-400 line-through">{formatInr(product.discountPrice)}</p>
                <span className="inline-flex px-2.5 py-1 rounded-full bg-orange-500 text-white text-xs font-semibold">Save</span>
              </div>
            )}
          </div>

          {product.variants && product.variants.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Select option</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveVariant(null)} className={cn('px-4 h-10 rounded-xl border text-sm', activeVariant === null ? 'bg-emerald-900 text-white border-emerald-900' : 'bg-white border-slate-200 text-slate-700')}>Default</button>
                {product.variants.filter((v: any) => String(v.name || '').trim().toLowerCase() !== 'default').map((variant: any) => (
                  <button key={variant.sku} onClick={() => setActiveVariant(variant.sku)} className={cn('px-4 h-10 rounded-xl border text-sm', activeVariant === variant.sku ? 'bg-emerald-900 text-white border-emerald-900' : 'bg-white border-slate-200 text-slate-700')}>
                    {variant.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasBulk && (
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
                <button className="h-10 w-10 flex items-center justify-center text-emerald-900 hover:bg-emerald-50" onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} disabled={hasBulk && packKind === 'bulk'}><Plus className="w-4 h-4" /></button>
              </div>
              <span className="text-xs text-slate-500">Stock: {product.stock}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={handleAddToCart} disabled={product.stock <= 0} className={cn('h-12 rounded-xl font-semibold', product.stock <= 0 ? 'bg-slate-200 text-slate-500' : 'bg-emerald-900 text-white hover:bg-emerald-800')}>
              {product.stock <= 0 ? 'Out of stock' : `Add to cart • ${formatInr(currentPrice)}`}
            </button>
            <button onClick={() => { handleAddToCart(); navigate('/cart'); }} disabled={product.stock <= 0} className="h-12 rounded-xl font-semibold bg-white border border-emerald-200 text-emerald-900 hover:bg-emerald-50">
              Buy now
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Check delivery availability</p>
            <div className="flex gap-2">
              <input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter pincode" className="flex-1 h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white" />
              <button className="h-10 px-4 rounded-xl bg-emerald-900 text-white text-sm font-semibold">Check</button>
            </div>
            <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 inline-flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" /> Free delivery above configured threshold
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
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
          <div className="flex gap-2 sm:gap-4 overflow-x-auto border-b border-slate-200">
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
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-emerald-900">Customer reviews</h2>
              <p className="text-sm text-slate-500 mt-1">Real feedback from buyers of this product.</p>
            </div>
            <div className="text-right">
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
