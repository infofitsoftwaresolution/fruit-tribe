import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from '@/app/components/ProductCard';
import { Search, Filter, Grid, List, Activity, Sparkles, Zap, Package, Compass } from 'lucide-react';
import { useProducts } from '@/app/hooks/useProducts';
import { getCategories, type Category } from '@/lib/api';
import type { Product } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProductsPageProps {
  onAddToCart: (product: Product) => void;
}

export function ProductsPage({ onAddToCart }: ProductsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const { products: storeProducts, loading, error } = useProducts({
    limit: 50,
    search: searchQuery || undefined,
    categoryId: selectedCategoryId || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return storeProducts;
    const q = searchQuery.trim().toLowerCase();
    // Ensure search is strictly by product name on the client so we don't show unrelated items
    return storeProducts.filter((p) => p.name?.toLowerCase().includes(q));
  }, [storeProducts, searchQuery]);

  const categoryOptions = useMemo(() => {
    const list = [{ id: '', name: 'All' }, ...categories.map((c) => ({ id: c.id, name: c.name }))];
    return list;
  }, [categories]);

  return (
    <div className="pt-32 pb-32 min-h-screen bg-white">
      {/* Background Manifest Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-0 right-0 h-[800px] w-[800px] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 h-[800px] w-[800px] bg-slate-900/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Cinematic Header Orchestration */}
        <div className="mb-24 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="h-[1px] w-12 bg-emerald-500" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">Product catalog</span>
              </div>

              <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                Catalog <br />
                <span className="text-emerald-500">Products</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed max-w-xl">
                Real-time synchronization with primary orchards. Extracting maximum bioavailability benchmarks for premium distribution.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-6 p-8 bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden relative group"
            >
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-14 w-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl relative z-10">
                <Activity className="h-6 w-6" />
              </div>
              <div className="relative z-10 text-right">
                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Live Sync Status</p>
                <p className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{filteredProducts.length} products</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">In stock</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Tactical Search & Filter HUD */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-20 space-y-8"
        >
          {/* Search Bar Interface */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none">
              <Search className="w-6 h-6 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-24 pl-20 pr-10 bg-white border border-slate-100 rounded-[2rem] text-xl font-black uppercase tracking-tight placeholder:text-slate-200 outline-none focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all shadow-[0_20px_60px_rgba(0,0,0,0.03)]"
            />
            <div className="absolute inset-y-0 right-8 flex items-center">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <Compass className="h-3 w-3 text-slate-400" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Category filter</span>
              </div>
            </div>
          </div>

          {/* Filter Rail & View Toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 -mx-6 px-6 md:p-0">
              <div className="h-10 w-10 flex items-center justify-center bg-slate-900 rounded-xl text-white mr-2 shrink-0">
                <Filter className="h-4 w-4" />
              </div>
              {categoryOptions.map((cat) => (
                <button
                  key={cat.id || 'all'}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    "px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border-2",
                    selectedCategoryId === cat.id
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-xl shadow-emerald-500/20"
                      : "bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600 shadow-sm"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 bg-white rounded-2xl p-2 border border-slate-100 shadow-sm shrink-0 self-end md:self-auto">
              {[
                { mode: 'grid', icon: Grid },
                { mode: 'list', icon: List }
              ].map(({ mode, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={cn(
                    "h-12 w-12 flex items-center justify-center rounded-xl transition-all",
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
            <div className="py-40 text-center text-slate-500 font-bold uppercase tracking-widest">Loading products…</div>
          )}
          {error && (
            <div className="py-40 text-center text-red-500 font-bold uppercase tracking-widest">{error}</div>
          )}
          {!loading && !error && filteredProducts.length > 0 ? (
            <motion.div
              layout
              className={cn(
                "grid gap-10",
                viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
              )}
            >
              {filteredProducts.map((product, index) => (
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
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-40 text-center space-y-8"
            >
              <div className="h-24 w-24 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex items-center justify-center mx-auto">
                <Package className="h-10 w-10 text-slate-200" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                  No products found
                </h3>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest italic">
                  {searchQuery.trim()
                    ? `No products found for “${searchQuery.trim()}”.`
                    : 'No products match the current filters.'}
                </p>
              </div>
              <button
                onClick={() => { setSelectedCategoryId(''); setSearchQuery(''); }}
                className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-3xl"
              >
                Clear search and filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
