import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from '@/app/components/ProductCard';
import { Search, SlidersHorizontal, Grid3X3, List, Package, X, ChevronDown } from 'lucide-react';
import { useProducts } from '@/app/hooks/useProducts';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getCategories, getAvailableOffers, type Category, type AvailableOffer } from '@/lib/api';
import type { Product } from '@/lib/api';
import { cn } from '@/lib/utils';
import { productHasBulkPricing } from '@/lib/pricing';
import { useStore } from '@/app/context/StoreContext';
import { PRODUCT_PLACEHOLDER_IMAGE } from '@/lib/productPlaceholder';

interface ProductsPageProps {
  onAddToCart: (product: Product) => void;
}

export function ProductsPage({ onAddToCart }: ProductsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartItems, handleUpdateQuantity } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<AvailableOffer[]>([]);
  const [initialCategoryName, setInitialCategoryName] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<'relevance' | 'newest' | 'price_low' | 'price_high' | 'name_az' | 'stock_high'>('relevance');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under_100' | '100_250' | '250_500' | '500_plus'>('all');
  const [showOffersOnly, setShowOffersOnly] = useState(false);
  const [showSeasonalOnly, setShowSeasonalOnly] = useState(false);
  const [showCodOnly, setShowCodOnly] = useState(false);
  const [productTab, setProductTab] = useState<'all' | 'bulk' | 'seasonal'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') ?? '';
    setSearchQuery(q);
    const catName = params.get('categoryName');
    setInitialCategoryName(catName);
    if (!catName) setSelectedCategoryId('');
  }, [location.search]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    getAvailableOffers().then(setOffers).catch(() => setOffers([]));
  }, []);

  const getOfferHintForProduct = (product: Product) => {
    const matched = offers.filter((offer) => {
      if (offer.scopeType === 'ALL') return true;
      if (offer.scopeType === 'PRODUCT') return offer.productIds.includes(String(product.id));
      const category = (product.category || '').trim().toLowerCase();
      return offer.categoryNames.includes(category);
    });
    const top = matched[0];
    if (!top) return '';
    if (top.discountType === 'PERCENTAGE') return `${top.discountValue}% off with ${top.code}`;
    return `₹${top.discountValue} off with ${top.code}`;
  };

  useEffect(() => {
    if (!initialCategoryName || !categories.length) return;
    const match = categories.find((c) => c.name === initialCategoryName);
    if (match) setSelectedCategoryId(match.id);
  }, [initialCategoryName, categories]);

  const { products: storeProducts, loading, error } = useProducts({
    limit: 50,
    search: searchQuery || undefined,
    categoryId: selectedCategoryId || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    showOutOfSeason: true,
  });
  const { products: allCatalogProducts } = useProducts({
    limit: 200,
    showOutOfSeason: true,
  });

  const filteredProducts = useMemo(() => {
    const now = Date.now();
    let next = storeProducts.filter((p) => {
      if (!p.expiryDate) return true;
      const t = new Date(p.expiryDate).getTime();
      return !Number.isFinite(t) || t >= now;
    });
    if (selectedCategoryId) {
      const selectedCategory = categories.find((c) => String(c.id) === String(selectedCategoryId));
      const selectedCategoryName = selectedCategory?.name?.trim().toLowerCase();
      if (selectedCategoryName) {
        next = next.filter((p) => (p.category || '').trim().toLowerCase() === selectedCategoryName);
      }
    }
    if (!searchQuery.trim()) return next;
    const q = searchQuery.trim().toLowerCase();
    return next.filter((p) => p.name?.toLowerCase().includes(q));
  }, [storeProducts, searchQuery, selectedCategoryId, categories]);

  const displayedProducts = useMemo(() => {
    let next = [...filteredProducts];
    if (availabilityFilter === 'in_stock') next = next.filter((p) => (p.availableStock ?? p.stock ?? 0) > 0);
    else if (availabilityFilter === 'out_of_stock') next = next.filter((p) => (p.availableStock ?? p.stock ?? 0) <= 0);
    if (priceFilter !== 'all') {
      next = next.filter((p) => {
        const price = Number(p.price ?? 0);
        if (priceFilter === 'under_100') return price < 100;
        if (priceFilter === '100_250') return price >= 100 && price <= 250;
        if (priceFilter === '250_500') return price > 250 && price <= 500;
        if (priceFilter === '500_plus') return price > 500;
        return true;
      });
    }
    if (showOffersOnly) next = next.filter((p) => Boolean(getOfferHintForProduct(p)));
    if (showSeasonalOnly) next = next.filter((p) => Boolean(p.isSeasonal));
    if (showCodOnly) next = next.filter((p) => p.allowCashOnDelivery !== false);
    if (productTab === 'bulk') next = next.filter((p) => productHasBulkPricing(p));
    else if (productTab === 'seasonal') next = next.filter((p) => Boolean(p.isSeasonal));
    next.sort((a, b) => {
      const stockA = a.availableStock ?? a.stock ?? 0;
      const stockB = b.availableStock ?? b.stock ?? 0;
      if (sortOption === 'price_low') return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (sortOption === 'price_high') return Number(b.price ?? 0) - Number(a.price ?? 0);
      if (sortOption === 'name_az') return (a.name || '').localeCompare(b.name || '');
      if (sortOption === 'stock_high') return stockB - stockA;
      if (stockA > 10 && stockB <= 10) return -1;
      if (stockB > 10 && stockA <= 10) return 1;
      const freshA = (a as any).freshnessScore ?? 5;
      const freshB = (b as any).freshnessScore ?? 5;
      if (freshA !== freshB) return freshB - freshA;
      return 0;
    });
    return next;
  }, [filteredProducts, availabilityFilter, priceFilter, showOffersOnly, showSeasonalOnly, showCodOnly, productTab, sortOption]);

  const categoryOptions = useMemo(() => {
    const liveCategoryNames = new Set(
      allCatalogProducts
        .map((p) => (p.category || '').trim().toLowerCase())
        .filter(Boolean),
    );
    const liveCategories = categories.filter((c) => liveCategoryNames.has((c.name || '').trim().toLowerCase()));
    const usableCategories = liveCategories.length > 0 ? liveCategories : categories;
    return [
      { id: '', name: 'All products' },
      ...usableCategories.map((c) => ({ id: c.id, name: c.name })),
    ];
  }, [categories, allCatalogProducts]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    const stillExists = categoryOptions.some((c) => String(c.id) === String(selectedCategoryId));
    if (!stillExists) setSelectedCategoryId('');
  }, [selectedCategoryId, categoryOptions]);

  const hasActiveFilters =
    sortOption !== 'relevance' || availabilityFilter !== 'all' || priceFilter !== 'all' ||
    showOffersOnly || showSeasonalOnly || showCodOnly || productTab !== 'all';

  const clearFilters = () => {
    setSortOption('relevance');
    setAvailabilityFilter('all');
    setPriceFilter('all');
    setShowOffersOnly(false);
    setShowSeasonalOnly(false);
    setShowCodOnly(false);
    setProductTab('all');
    setSelectedCategoryId('');
    setSearchQuery('');
    navigate({ pathname: '/products', search: '' }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Page Header ── */}
        <div className="pt-8 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
              Our catalogue
            </p>
            <div className="flex items-end justify-between gap-4">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                Fresh fruits & produce
              </h1>
              {!loading && (
                <span className="text-sm text-slate-400 shrink-0 mb-1">
                  {displayedProducts.length} {displayedProducts.length === 1 ? 'product' : 'products'}
                </span>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Search + Filter Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 overflow-hidden"
        >
          {/* Top row: search + actions */}
          <div className="flex items-center gap-0 divide-x divide-slate-100">
            {/* Search */}
            <div className="flex-1 flex items-center gap-3 px-4 py-3">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search fruits, vegetables…"
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  const params = new URLSearchParams(location.search);
                  if (value) params.set('q', value);
                  else params.delete('q');
                  navigate({ pathname: '/products', search: params.toString() }, { replace: true });
                }}
                className="w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); navigate('/products', { replace: true }); }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors shrink-0',
                showFilters ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showFilters && 'rotate-180')} />
            </button>

            {/* Sort */}
            <div className="relative shrink-0">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                className="appearance-none h-full px-4 py-3 text-sm font-semibold text-slate-700 bg-transparent border-0 outline-none cursor-pointer pr-8 hover:bg-slate-50 transition-colors"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="price_low">Price: Low to high</option>
                <option value="price_high">Price: High to low</option>
                <option value="name_az">Name: A to Z</option>
                <option value="stock_high">Stock: High to low</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* View toggle */}
            <div className="flex items-center divide-x divide-slate-100 shrink-0">
              {([['grid', Grid3X3], ['list', List]] as const).map(([mode, Icon]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'h-full px-3 py-3 transition-colors',
                    viewMode === mode ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Expandable filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <select
                      value={availabilityFilter}
                      onChange={(e) => setAvailabilityFilter(e.target.value as typeof availabilityFilter)}
                      className="h-10 w-full px-3 pr-9 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white shadow-sm outline-none appearance-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    >
                      <option value="all">Availability: All</option>
                      <option value="in_stock">In stock only</option>
                      <option value="out_of_stock">Out of stock</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>

                  <div className="relative">
                    <select
                      value={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.value as typeof priceFilter)}
                      className="h-10 w-full px-3 pr-9 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white shadow-sm outline-none appearance-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    >
                      <option value="all">Price: All</option>
                      <option value="under_100">Under ₹100</option>
                      <option value="100_250">₹100 – ₹250</option>
                      <option value="250_500">₹250 – ₹500</option>
                      <option value="500_plus">Above ₹500</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>

                  {/* Toggle chips */}
                  <div className="flex flex-wrap gap-2 sm:col-span-2 items-center">
                    {[
                      { key: 'offers', label: '🏷 With offers', active: showOffersOnly, onClick: () => setShowOffersOnly((v) => !v) },
                      { key: 'seasonal', label: '🌿 Seasonal', active: showSeasonalOnly, onClick: () => setShowSeasonalOnly((v) => !v) },
                      { key: 'cod', label: '💵 Cash on delivery', active: showCodOnly, onClick: () => setShowCodOnly((v) => !v) },
                    ].map((chip) => (
                      <button
                        key={chip.key}
                        onClick={chip.onClick}
                        className={cn(
                          'h-9 px-4 rounded-xl border text-xs font-medium transition-colors',
                          chip.active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="h-9 px-4 rounded-xl border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Category tabs — horizontal scroll strip ── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 mb-2">
          {categoryOptions.map((cat) => (
            <button
              key={cat.id || 'all'}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={cn(
                'shrink-0 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap border transition-all',
                selectedCategoryId === cat.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800'
              )}
            >
              {cat.name}
            </button>
          ))}

          <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />

          {/* Pack type tabs */}
          {[
            { key: 'all', label: 'All' },
            { key: 'bulk', label: '📦 Bulk deals' },
            { key: 'seasonal', label: '🌿 Seasonal' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setProductTab(tab.key as 'all' | 'bulk' | 'seasonal')}
              className={cn(
                'shrink-0 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap border transition-all',
                productTab === tab.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Product Grid ── */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'grid gap-4',
                viewMode === 'grid'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                  : 'grid-cols-1'
              )}
            >
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 animate-pulse overflow-hidden">
                  <div className="aspect-square bg-slate-100" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-2/3" />
                    <div className="pt-2 flex items-center justify-between">
                      <div className="h-6 bg-slate-200 rounded w-1/4" />
                      <div className="h-9 w-24 bg-slate-100 rounded-xl" />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="py-20 text-center">
              <p className="text-sm text-red-500 font-medium">{error}</p>
            </motion.div>
          )}

          {!loading && !error && displayedProducts.length > 0 && (
            <motion.div
              key={`products-${viewMode}`}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={cn(
                'grid gap-4',
                viewMode === 'grid'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                  : 'grid-cols-1'
              )}
            >
              {displayedProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
                >
                  {viewMode === 'list' ? (
                    <div className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-200 hover:shadow-sm transition-all p-3 sm:p-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <Link to={`/product/${product.id}`} className="block shrink-0">
                          <img
                            src={(product.image || '').trim() || PRODUCT_PLACEHOLDER_IMAGE}
                            alt={product.name}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = PRODUCT_PLACEHOLDER_IMAGE;
                            }}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover bg-slate-100"
                          />
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link
                                to={`/product/${product.id}`}
                                className="text-sm sm:text-base font-semibold text-slate-900 hover:text-emerald-700 line-clamp-2"
                              >
                                {product.name}
                              </Link>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {(product.category || 'Fresh produce')} · {product.unit || 'kg'}
                              </p>
                            </div>

                            {(product.availableStock ?? product.stock ?? 0) > 0 ? (
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                In stock
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
                                Sold out
                              </span>
                            )}
                          </div>

                          <div className="flex items-end justify-between mt-3 gap-2">
                            <div>
                              <p className="text-lg font-bold text-slate-900">₹{Number(product.price || 0)}</p>
                              <p className="text-[11px] text-slate-500">per {product.unit || 'kg'}</p>
                            </div>

                            {(() => {
                              const available = product.availableStock ?? product.stock ?? 0;
                              const cartQty = cartItems.find((item) => String(item.id) === String(product.id))?.quantity ?? 0;

                              if (cartQty > 0 && available > 0) {
                                return (
                                  <div className="flex items-center gap-1 h-9 px-1 rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      type="button"
                                      onClick={() => handleUpdateQuantity(product.id, -1)}
                                      className="h-7 w-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-base font-bold"
                                    >
                                      −
                                    </motion.button>
                                    <span className="min-w-[1.5rem] text-center text-sm font-bold text-slate-900">{cartQty}</span>
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      type="button"
                                      onClick={() => {
                                        if (cartQty >= available) return;
                                        handleUpdateQuantity(product.id, 1);
                                      }}
                                      className="h-7 w-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-base font-bold"
                                    >
                                      +
                                    </motion.button>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  disabled={available <= 0}
                                  onClick={() => onAddToCart(product)}
                                  className={cn(
                                    'h-9 px-4 rounded-xl text-xs font-semibold transition-colors',
                                    available <= 0
                                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  )}
                                >
                                  Add
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ProductCard
                      id={product.id}
                      name={product.name}
                      price={product.price}
                      stock={product.stock}
                      image={product.image}
                      description={product.description}
                      badge={product.badge}
                      isSeasonal={product.isSeasonal}
                      bulkDiscountQty={product.bulkDiscountQty}
                      bulkDiscountPrice={product.bulkDiscountPrice}
                      onAddToCart={onAddToCart}
                      product={product}
                      liveOfferHint={getOfferHintForProduct(product)}
                      harvestDate={product.harvestDate}
                      farmName={product.farmName}
                      farmState={product.farmState}
                      freshnessScore={product.freshnessScore}
                      ripenessStage={product.ripenessStage}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}

          {!loading && !error && displayedProducts.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-24 flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center">
                <Package className="w-7 h-7 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No products found</h3>
              <p className="text-sm text-slate-400 text-center max-w-xs">
                {searchQuery.trim()
                  ? `No results for "${searchQuery.trim()}". Try a different search.`
                  : 'No products match the current filters.'}
              </p>
              <button
                onClick={clearFilters}
                className="mt-2 h-10 px-6 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                Clear all filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
