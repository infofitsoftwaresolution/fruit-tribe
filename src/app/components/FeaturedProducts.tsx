import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ProductCard } from '@/app/components/ProductCard';
import { Sparkles, ArrowRight, Zap, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { useProducts } from '@/app/hooks/useProducts';
import type { Product } from '@/lib/api';
import { cn } from '@/lib/utils';
import { productHasBulkPricing } from '@/lib/pricing';

interface FeaturedProductsProps {
    onAddToCart: (product: Product, quantity?: number) => void;
}

export function FeaturedProducts({ onAddToCart }: FeaturedProductsProps) {
    const { theme, isEditing, updateTheme } = useStore();
    const { products, loading, error } = useProducts({ limit: 6 });
    const [productTab, setProductTab] = useState<'all' | 'bulk' | 'seasonal'>('all');

    const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
        if (!isEditing) return;
        const newText = e.currentTarget.innerText;
        updateTheme({ [field]: newText });
    };

    const featuredProducts = useMemo(() => {
        let next = products.filter(p => p.status === 'Active' && p.availableStock > 0);
        if (productTab === 'bulk') {
            next = next.filter((p) => productHasBulkPricing(p));
        } else if (productTab === 'seasonal') {
            next = next.filter((p) => Boolean(p.isSeasonal));
        }
        return next.slice(0, 6);
    }, [products, productTab]);

    return (
        <section className="relative py-32 overflow-hidden bg-white">
            {/* Background Manifold */}
            <div className="absolute inset-0 z-0 opacity-40">
                <div className="absolute top-0 right-0 h-[600px] w-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 h-[600px] w-[600px] bg-amber-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
                {/* Cinematic Header Orchestration */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="max-w-2xl space-y-6"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-[1px] w-12 bg-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">Featured</span>
                        </div>

                        <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                            <span
                                contentEditable={isEditing}
                                suppressContentEditableWarning
                                onBlur={handleTextChange('featuredProductsTitle')}
                                className="outline-none"
                            >
                                {theme.featuredProductsTitle || 'Popular picks'}
                            </span>
                        </h2>

                        <p
                            contentEditable={isEditing}
                            suppressContentEditableWarning
                            onBlur={handleTextChange('featuredProductsSubtitle')}
                            className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic outline-none"
                        >
                            {theme.featuredProductsSubtitle || 'Handpicked favorites our customers love.'}
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <Link to="/products" className="group flex items-center gap-6">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">View all products</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Full catalog</span>
                            </div>
                            <div className="h-16 w-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white transition-all group-hover:bg-emerald-500 group-hover:rotate-12 group-hover:scale-110 shadow-2xl">
                                <ArrowRight className="h-6 w-6" />
                            </div>
                        </Link>
                    </motion.div>
                </div>

                {/* High-Performance Products Grid */}
                <div className="mb-8 flex flex-wrap items-center gap-2">
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {loading && (
                        <div className="col-span-full py-20 text-center text-slate-500 font-bold uppercase tracking-widest">Loading products…</div>
                    )}
                    {error && (
                        <div className="col-span-full py-20 text-center text-red-500 font-bold uppercase tracking-widest">{error}</div>
                    )}
                    {!loading && !error && featuredProducts.map((product, index) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: index * 0.12 }}
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
                                onAddToCart={(payload: any, qty?: number) => onAddToCart(payload, qty)}
                                product={product}
                                bulkDealMode={productTab === 'bulk'}
                                harvestDate={product.harvestDate}
                                farmName={product.farmName}
                                farmState={product.farmState}
                                freshnessScore={product.freshnessScore}
                                ripenessStage={product.ripenessStage}
                            />
                        </motion.div>
                    ))}
                </div>

                {/* Tactical Interaction HUD */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mt-32 p-10 bg-slate-900 rounded-[3.5rem] flex flex-col md:flex-row items-center justify-between gap-10 border border-white/10 shadow-3xl"
                >
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 bg-emerald-500/10 rounded-[2.5rem] border border-emerald-500/20 flex items-center justify-center">
                            <Zap className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div>
                            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-1">Fast delivery</h4>
                            <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest leading-relaxed italic max-w-sm">We ship quickly so your fruit stays fresh.</p>
                        </div>
                    </div>
                    <Link
                        to="/about"
                        className="h-16 px-12 bg-white text-slate-900 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl active:scale-95 inline-flex items-center justify-center"
                    >
                        Learn more
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
