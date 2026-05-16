import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Zap } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { useProducts } from '@/app/hooks/useProducts';
import { ProductCard } from '@/app/components/ProductCard';

export function SeasonalHighlights() {
  const { theme, isEditing, updateTheme, products: storeProducts, handleAddToCart } = useStore();
  const { products: apiProducts, loading: productsLoading } = useProducts({ limit: 100, showOutOfSeason: true });
  const products =
    apiProducts.length > 0 ? apiProducts : productsLoading ? [] : storeProducts;
  const seasonalProducts = products.filter((p: any) => {
    // Industrial filtering: must be seasonal AND active AND in stock
    if (!p.isSeasonal || p.status !== 'Active' || p.availableStock <= 0) return false;

    // Optional: Temporal validation if dates are provided
    if (p.seasonalStart || p.seasonalEnd) {
      const now = new Date();
      if (p.seasonalStart && new Date(p.seasonalStart) > now) return false;
      if (p.seasonalEnd && new Date(p.seasonalEnd) < now) return false;
    }

    return true;
  });

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  return (
    <section className="relative py-32 bg-slate-50 overflow-hidden">
      {/* Background Architectural Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 h-[600px] w-[600px] bg-slate-900/[0.02] rotate-12 blur-3xl pointer-events-none" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Section Header Orchestration */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 mb-24">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-[1px] w-12 bg-emerald-500" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">Seasonal</span>
            </div>

            <h2 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              <span
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={handleTextChange('seasonalHighlightsTitle')}
                className="outline-none"
              >
                {theme.seasonalHighlightsTitle || 'In season now'}
              </span>
            </h2>

            <p
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleTextChange('seasonalHighlightsSubtitle')}
              className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed outline-none"
            >
              {theme.seasonalHighlightsSubtitle || 'We follow the seasons to bring you the best-tasting fruit.'}
            </p>
          </motion.div>

          <div className="flex items-center gap-2 px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Zap className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Live</span>
          </div>
        </div>

        <div className="mb-8 space-y-1">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">In season now</h3>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Fresh products available this season</p>
        </div>

        {/* Seasonal products grid */}
        <div className="space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {seasonalProducts.slice(0, 9).map((product: any, index: number) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
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
                  onAddToCart={(payload: any, qty?: number) => handleAddToCart(payload, qty)}
                  product={product}
                />
              </motion.div>
            ))}
            {seasonalProducts.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/50">
                <Leaf className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No seasonal products right now.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
