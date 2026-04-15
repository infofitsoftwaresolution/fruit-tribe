import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from '@/app/components/ProductCard';
import { Search, Filter, Grid, List, Activity, Sparkles, Zap, Package, Compass } from 'lucide-react';
import { useProducts } from '@/app/hooks/useProducts';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCategories, getAvailableOffers, type Category, type AvailableOffer } from '@/lib/api';
import type { Product } from '@/lib/api';
import { cn } from '@/lib/utils';
import { productHasBulkPricing } from '@/lib/pricing';

interface ProductsPageProps {
  onAddToCart: (product: Product) => void;
}

export function ProductsPage({ onAddToCart }: ProductsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
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

  // Initialize search and category from URL query (?q=apple&categoryName=Fruits)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') ?? '';
    setSearchQuery(q);
    const catName = params.get('categoryName');
    setInitialCategoryName(catName);
    if (!catName) {
      setSelectedCategoryId('');
    }
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
    if (top.discountType === 'PERCENTAGE') {
      return `${top.discountValue}% OFF with ${top.code}`;
    }
    return `₹${top.discountValue} OFF with ${top.code}`;
  };

  // Map initialCategoryName from URL to actual category id once categories load
  useEffect(() => {
    if (!initialCategoryName || !categories.length) return;
    const match = categories.find((c) => c.name === initialCategoryName);
    if (match) {
      setSelectedCategoryId(match.id);
    }
  }, [initialCategoryName, categories]);

  const { products: storeProducts, loading, error } = useProducts({
    limit: 50,
    search: searchQuery || undefined,
    categoryId: selectedCategoryId || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const filteredProducts = useMemo(() => {
    let next = storeProducts;

    // Keep category filtering on client as a reliable fallback (backend already filters too).
    if (selectedCategoryId) {
      const selectedCategory = categories.find((c) => String(c.id) === String(selectedCategoryId));
      const selectedCategoryName = selectedCategory?.name?.trim().toLowerCase();
      if (selectedCategoryName) {
        next = next.filter((p) => (p.category || '').trim().toLowerCase() === selectedCategoryName);
      }
    }

    if (!searchQuery.trim()) return next;
    const q = searchQuery.trim().toLowerCase();
    // Ensure search is strictly by product name on the client so we don't show unrelated items
    return next.filter((p) => p.name?.toLowerCase().includes(q));
  }, [storeProducts, searchQuery, selectedCategoryId, categories]);

  const displayedProducts = useMemo(() => {
    let next = [...filteredProducts];

    if (availabilityFilter === 'in_stock') {
      next = next.filter((p) => (p.availableStock ?? p.stock ?? 0) > 0);
    } else if (availabilityFilter === 'out_of_stock') {
      next = next.filter((p) => (p.availableStock ?? p.stock ?? 0) <= 0);
    }

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

    if (showOffersOnly) {
      next = next.filter((p) => Boolean(getOfferHintForProduct(p)));
    }
    if (showSeasonalOnly) {
      next = next.filter((p) => Boolean(p.isSeasonal));
    }
    if (showCodOnly) {
      next = next.filter((p) => p.allowCashOnDelivery !== false);
    }

    if (productTab === 'bulk') {
      next = next.filter((p) => productHasBulkPricing(p));
    } else if (productTab === 'seasonal') {
      next = next.filter((p) => Boolean(p.isSeasonal));
    }

    next.sort((a, b) => {
      const stockA = a.availableStock ?? a.stock ?? 0;
      const stockB = b.availableStock ?? b.stock ?? 0;
      
      if (sortOption === 'price_low') return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (sortOption === 'price_high') return Number(b.price ?? 0) - Number(a.price ?? 0);
      if (sortOption === 'name_az') return (a.name || '').localeCompare(b.name || '');
      if (sortOption === 'stock_high') return stockB - stockA;
      
      // Default / relevance sorting: prioritize high stock & high freshness
      if (sortOption === 'relevance' || sortOption === 'newest') {
        if (stockA > 10 && stockB <= 10) return -1;
        if (stockB > 10 && stockA <= 10) return 1;
        
        const freshA = (a as any).freshnessScore ?? 5;
        const freshB = (b as any).freshnessScore ?? 5;
        if (freshA !== freshB) return freshB - freshA;
      }
      return 0;
    });

    return next;
  }, [
    filteredProducts,
    availabilityFilter,
    priceFilter,
    showOffersOnly,
    showSeasonalOnly,
    showCodOnly,
    productTab,
    sortOption,
  ]);

  const categoryOptions = useMemo(() => {
    const list = [{ id: '', name: 'All' }, ...categories.map((c) => ({ id: c.id, name: c.name }))];
    return list;
  }, [categories]);

  return (
    <div className="pt-24 sm:pt-32 pb-16 sm:pb-32 min-h-screen bg-white">
      {/* Background Manifest Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-0 right-0 h-[800px] w-[800px] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 h-[800px] w-[800px] bg-slate-900/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-3 sm:px-6 md:px-12">
        {/* Cinematic Header Orchestration */}
        <div className="mb-12 sm:mb-24 space-y-6 sm:space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="h-[1px] w-12 bg-emerald-500" />
                <span className="text-[10px] font-black text-emerald-600 uppercase sm:uppercase tracking-[0.18em] sm:tracking-[0.4em]">Product catalog</span>
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-slate-900 tracking-tight sm:tracking-tighter leading-none">
                Catalog <br />
                <span className="text-emerald-500">Products</span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-slate-500 font-medium tracking-normal sm:tracking-tight leading-relaxed max-w-xl">
                Browse fresh fruits and vegetables sourced daily from trusted farms.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-4 sm:gap-6 p-4 sm:p-8 bg-slate-900 rounded-3xl sm:rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden relative group"
            >
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-14 w-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl relative z-10">
                <Activity className="h-6 w-6" />
              </div>
              <div className="relative z-10 text-right">
                <p className="text-[10px] font-semibold text-emerald-500 tracking-wide mb-1">Available products</p>
                <p className="text-xl sm:text-2xl font-black text-white tracking-tight sm:tracking-tighter leading-none">{displayedProducts.length} products</p>
                <p className="text-[11px] font-medium text-slate-300 mt-1">Currently in stock</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Tactical Search & Filter HUD */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10 sm:mb-20 space-y-6 sm:space-y-8"
        >
          {/* Search Bar Interface */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 sm:left-8 flex items-center pointer-events-none">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                const params = new URLSearchParams(location.search);
                if (value) {
                  params.set('q', value);
                } else {
                  params.delete('q');
                }
                navigate({ pathname: '/products', search: params.toString() }, { replace: true });
              }}
              className="w-full h-14 sm:h-24 pl-12 sm:pl-20 pr-4 sm:pr-10 bg-white border border-slate-100 rounded-2xl sm:rounded-[2rem] text-sm sm:text-xl font-black tracking-normal sm:tracking-tight placeholder:text-slate-200 outline-none focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all shadow-[0_20px_60px_rgba(0,0,0,0.03)]"
            />
            <div className="absolute inset-y-0 right-4 sm:right-8 flex items-center">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <Compass className="h-3 w-3 text-slate-400" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Category filter</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'bulk', label: 'Bulk' },
              { key: 'seasonal', label: 'Seasons' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setProductTab(tab.key as 'all' | 'bulk' | 'seasonal')}
                className={cn(
                  "h-10 px-5 rounded-xl border text-sm font-semibold transition-colors",
                  productTab === tab.key
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick sort and advanced filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
              className="h-12 px-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="newest">Sort: Newest arrivals</option>
              <option value="price_low">Sort: Price low to high</option>
              <option value="price_high">Sort: Price high to low</option>
              <option value="name_az">Sort: Name A to Z</option>
              <option value="stock_high">Sort: Stock high to low</option>
            </select>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as typeof availabilityFilter)}
              className="h-12 px-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
            >
              <option value="all">Availability: All</option>
              <option value="in_stock">Availability: In stock</option>
              <option value="out_of_stock">Availability: Out of stock</option>
            </select>
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as typeof priceFilter)}
              className="h-12 px-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
            >
              <option value="all">Price: All</option>
              <option value="under_100">Price: Under Rs 100</option>
              <option value="100_250">Price: Rs 100 to Rs 250</option>
              <option value="250_500">Price: Rs 250 to Rs 500</option>
              <option value="500_plus">Price: Above Rs 500</option>
            </select>
            <button
              onClick={() => {
                setSortOption('relevance');
                setAvailabilityFilter('all');
                setPriceFilter('all');
                setShowOffersOnly(false);
                setShowSeasonalOnly(false);
                setShowCodOnly(false);
                setProductTab('all');
              }}
              className="h-12 px-4 bg-slate-900 text-white rounded-2xl text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              Reset all filters
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'offers', label: 'Offers', active: showOffersOnly, onClick: () => setShowOffersOnly((v) => !v) },
              { key: 'seasonal', label: 'Seasonal', active: showSeasonalOnly, onClick: () => setShowSeasonalOnly((v) => !v) },
              { key: 'cod', label: 'Cash on delivery', active: showCodOnly, onClick: () => setShowCodOnly((v) => !v) },
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={chip.onClick}
                className={cn(
                  "h-10 px-4 rounded-xl border text-sm font-medium transition-colors",
                  chip.active
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Filter Rail & View Toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            {/* Sticky Horizontal Categories */}
            <div className="sticky top-[88px] sm:top-24 z-40 bg-white/90 backdrop-blur-xl py-4 -mx-3 sm:-mx-6 px-3 sm:px-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)] flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar border-y border-slate-100/50">
              <div className="h-10 w-10 flex items-center justify-center bg-slate-900 rounded-xl text-white mr-2 shrink-0">
                <Filter className="h-4 w-4" />
              </div>
              {categoryOptions.map((cat) => (
                <button
                  key={cat.id || 'all'}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    "min-h-[44px] px-5 sm:px-8 py-3 rounded-2xl text-[10px] font-black uppercase sm:uppercase tracking-[0.08em] sm:tracking-[0.2em] transition-all whitespace-nowrap border-2 shrink-0",
                    selectedCategoryId === cat.id
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-xl shadow-emerald-500/20"
                      : "bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600 shadow-sm"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-2xl p-2 border border-slate-100 shadow-sm shrink-0 self-end md:self-auto">
              {[
                { mode: 'grid', icon: Grid },
                { mode: 'list', icon: List }
              ].map(({ mode, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={cn(
                    "h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center rounded-xl transition-all",
                    viewMode === mode
                      ? "bg-slate-900 text-white shadow-inner"
                      : "text-slate-400 hover:bg-slate-50"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Results Manifest Grid */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              layout
              key="loading-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "grid gap-3 sm:gap-6 lg:gap-8 pt-8",
                viewMode === 'grid' ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1"
              )}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-[2rem] p-4 border border-slate-100/50 shadow-sm animate-pulse space-y-4">
                  <div className="aspect-square bg-slate-100 rounded-3xl w-full" />
                  <div className="space-y-3 px-2">
                    <div className="h-3 bg-emerald-100 rounded w-1/4" />
                    <div className="h-5 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                  </div>
                  <div className="pt-6 px-2 flex items-end justify-between">
                    <div className="h-6 bg-slate-200 rounded-md w-1/3" />
                    <div className="h-10 w-10 bg-slate-100 rounded-[1rem]" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}
          {error && (
            <motion.div key="error-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-40 text-center text-red-500 font-bold uppercase tracking-widest">{error}</motion.div>
          )}
          {!loading && !error && displayedProducts.length > 0 ? (
            <motion.div
              layout
              key="products-grid"
              className={cn(
                "grid gap-3 sm:gap-6 lg:gap-8",
                viewMode === 'grid' ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1"
              )}
            >
              {displayedProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
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
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-40 text-center space-y-8"
            >
              <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex items-center justify-center mx-auto">
                <Package className="h-10 w-10 text-slate-200" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight sm:tracking-tighter">
                  No products found
                </h3>
                <p className="text-slate-400 text-sm font-bold tracking-[0.03em] sm:tracking-widest italic">
                  {searchQuery.trim()
                    ? `No products found for "${searchQuery.trim()}".`
                    : 'No products match the selected filters.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedCategoryId('');
                  setSearchQuery('');
                  setSortOption('relevance');
                  setAvailabilityFilter('all');
                  setPriceFilter('all');
                  setShowOffersOnly(false);
                  setShowSeasonalOnly(false);
                  setShowCodOnly(false);
                  setProductTab('all');
                }}
                className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase sm:uppercase tracking-[0.08em] sm:tracking-widest hover:bg-emerald-500 transition-all shadow-3xl"
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
