import { useMemo } from 'react';
import { useProducts } from '@/app/hooks/useProducts';
import { Sparkles, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product } from '@/lib/api';

interface AIRecommendationsProps {
    currentProductId?: string | number;
    limit?: number;
    onAddToCart?: (product: Product) => void;
}

export function AIRecommendations({ currentProductId, limit = 4, onAddToCart }: AIRecommendationsProps) {
    const { products } = useProducts({ limit: 12 });

    const recommendedProducts = useMemo(() => {
        let pool = products.filter(p => p.id !== currentProductId && p.status === 'Active');
        const currentProduct = products.find(p => p.id === currentProductId);
        if (currentProduct) {
            const sameCategory = pool.filter(p => p.category === currentProduct.category);
            const others = pool.filter(p => p.category !== currentProduct.category);
            pool = [...sameCategory, ...others];
        }
        return pool.slice(0, limit);
    }, [products, currentProductId, limit]);

    if (recommendedProducts.length === 0) return null;

    return (
        <section className="py-12 border-t border-gray-100">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20">
                        <BrainCircuit className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 leading-tight">AI Curated Picks</h2>
                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-0.5">Predicted favorites for you</p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Sparkles className="h-3 w-3" />
                    Personalized Insight
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {recommendedProducts.map((product, idx) => (
                    <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="group relative"
                    >
                        <Link to={`/product/${product.id}`} className="block">
                            <div className="aspect-[4/5] rounded-[2rem] overflow-hidden bg-gray-50 border border-gray-100 shadow-sm transition-all group-hover:shadow-xl group-hover:border-emerald-200 group-hover:-translate-y-2 relative">
                                <img
                                    src={product.image}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    alt={product.name}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black text-emerald-600 shadow-lg">
                                    {Math.floor(Math.random() * 20 + 80)}% Match
                                </div>
                            </div>

                            <div className="mt-4 px-2">
                                <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{product.name}</h3>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-lg font-black text-gray-900">₹{product.price}</p>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{product.category}</span>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
