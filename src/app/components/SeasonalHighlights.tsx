import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Snowflake, Flower2, Leaf, Calendar, Zap, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { useProducts } from '@/app/hooks/useProducts';
import { ProductCard } from '@/app/components/ProductCard';
import { cn } from '@/lib/utils';

export function SeasonalHighlights() {
  const { theme, isEditing, updateTheme, products: storeProducts } = useStore();
  const { products: apiProducts } = useProducts({ limit: 100, showOutOfSeason: true });
  const products = apiProducts.length > 0 ? apiProducts : storeProducts;
  const seasonalProducts = products.filter((p: { isSeasonal?: boolean }) => !!p.isSeasonal);

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const currentSeasonType = theme.seasonal?.type || 'Summer';

  const seasons = [
    {
      name: 'Spring',
      icon: Flower2,
      label: 'Spring harvest',
      color: 'emerald',
      fruits: ['Strawberries', 'Cherries', 'Apricots'],
      description: 'Fresh berries and early stone fruit.',
    },
    {
      name: 'Summer',
      icon: Sun,
      label: 'Peak season',
      color: 'amber',
      fruits: ['Watermelon', 'Peaches', 'Mangoes'],
      description: 'Tropical and stone fruit at their best.',
    },
    {
      name: 'Autumn',
      icon: Leaf,
      label: 'Harvest time',
      color: 'blue',
      fruits: ['Apples', 'Pears', 'Grapes'],
      description: 'Apples, pears and vine fruits.',
    },
    {
      name: 'Winter',
      icon: Snowflake,
      label: 'Citrus & exotic',
      color: 'purple',
      fruits: ['Oranges', 'Kiwi', 'Dragon Fruit'],
      description: 'Citrus and exotic fruits.',
    },
  ];

  const activeSeason = seasons.find(s => s.name === currentSeasonType) || seasons[1];

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

          {/* Current season */}
          <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-white/10 flex items-center gap-8 shadow-3xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-16 w-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl relative z-10">
              <activeSeason.icon className="h-8 w-8" />
            </div>
            <div className="relative z-10">
              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Current season</p>
              <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{activeSeason.name}</h4>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">{activeSeason.label}</p>
            </div>
          </div>
        </div>

        {/* Temporal Grid Registry */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {seasons.map((season, index) => {
            const isActive = season.name === currentSeasonType;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className={cn(
                  "relative bg-white rounded-[2.5rem] p-8 border transition-all duration-500 flex flex-col h-full",
                  isActive
                    ? "border-emerald-500 shadow-2xl ring-4 ring-emerald-500/5 bg-emerald-50/20"
                    : "border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:border-slate-200"
                )}
              >
                <div className="flex items-center justify-between mb-10">
                  <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center shadow-xl transition-all group-hover:rotate-12",
                    `bg-${season.color}-500 text-white`
                  )}>
                    <season.icon className="h-6 w-6" />
                  </div>
                  {isActive && <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                </div>

                <div className="space-y-2 mb-8">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{season.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed italic">{season.description}</p>
                </div>

                <div className="space-y-2 mt-auto">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] block mb-4">In season</span>
                  {season.fruits.map((fruit, i) => (
                    <div key={i} className="flex items-center justify-between group cursor-default">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight group-hover:text-slate-900 transition-colors">{fruit}</span>
                      <div className={cn("h-1 w-1 rounded-full", `bg-${season.color}-500/40`)} />
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Live Seasonal Harvest Registry */}
        <div className="mt-32 space-y-12">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">In season now</h3>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Fruits available this season</p>
            </div>
            <div className="h-px flex-1 bg-slate-100 mx-10 hidden md:block" />
            <div className="flex items-center gap-2 px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <Zap className="h-4 w-4 text-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Live</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {seasonalProducts.slice(0, 6).map((product: any, index: number) => (
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
                  onAddToCart={() => { }}
                />
              </motion.div>
            ))}
            {seasonalProducts.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/50">
                <Calendar className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No seasonal products right now.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
