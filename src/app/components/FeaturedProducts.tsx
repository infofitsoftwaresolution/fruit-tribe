import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ProductCard } from '@/app/components/ProductCard';
import { ArrowRight, Leaf } from 'lucide-react';
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
    const { theme } = useStore();
    const { products, loading, error } = useProducts({ limit: 100, showOutOfSeason: true });
    const [productTab, setProductTab] = useState<'all' | 'bulk' | 'seasonal'>('all');

    const featuredProducts = useMemo(() => {
        const now = Date.now();
        let next = products.filter((p) => {
            if (!(p.status === 'Active' && p.availableStock > 0)) return false;
            if (!p.expiryDate) return true;
            const t = new Date(p.expiryDate).getTime();
            return !Number.isFinite(t) || t >= now;
        });
        if (productTab === 'bulk') {
            next = next.filter((p) => productHasBulkPricing(p));
        } else if (productTab === 'seasonal') {
            next = next.filter((p) => Boolean(p.isSeasonal));
        }
        return next.slice(0, 8);
    }, [products, productTab]);

    return (
        <section className="py-12 md:py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Section header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
                    <div>
                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                            Featured
                        </p>
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                            {theme.featuredProductsTitle || 'Popular picks'}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {theme.featuredProductsSubtitle || 'Handpicked favorites our customers love.'}
                        </p>
                    </div>

                    <Link
                        to="/products"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-emerald-600 transition-colors shrink-0 group"
                    >
                        View all products
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-2 mb-8">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'bulk', label: 'Bulk deals' },
                        { key: 'seasonal', label: 'Seasonal' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setProductTab(tab.key as 'all' | 'bulk' | 'seasonal')}
                            className={cn(
                                'h-9 px-4 rounded-full text-sm font-medium transition-all border',
                                productTab === tab.key
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Products grid */}
                {loading && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="aspect-[3/4] rounded-3xl bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                )}

                {error && (
                    <div className="py-12 text-center">
                        <p className="text-sm text-slate-400 font-medium">{error}</p>
                    </div>
                )}

                {!loading && !error && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                        {featuredProducts.length === 0 ? (
                            <div className="col-span-full py-12 text-center">
                                <Leaf className="w-8 h-8 text-emerald-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-400 font-medium">
                                    No products in this category yet.
                                </p>
                            </div>
                        ) : (
                            featuredProducts.map((product, index) => (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, y: 24 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.4, delay: index * 0.06 }}
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
                            ))
                        )}
                    </div>
                )}

                {/* Bottom CTA */}
                {!loading && featuredProducts.length > 0 && (
                    <div className="mt-12 text-center">
                        <Link
                            to="/products"
                            className="inline-flex items-center gap-2 h-11 px-8 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
                        >
                            Browse all products
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
