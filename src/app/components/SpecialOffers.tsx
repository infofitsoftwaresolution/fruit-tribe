import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import { Tag, Clock, TrendingUp, Gift, Zap, ShieldCheck, ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { useProducts } from '@/app/hooks/useProducts';
import { ProductCard } from '@/app/components/ProductCard';
import { cn } from '@/lib/utils';
import { mergeSubscriptionPageConfig } from '@/app/config/subscriptionPageConfig';
import { productHasBulkPricing } from '@/lib/pricing';
import { getAvailableOffers, type AvailableOffer } from '@/lib/api';

export function SpecialOffers() {
  const { theme, isEditing, updateTheme, products: storeProducts, handleAddToCart, preferences } = useStore();
  const subscriptionPageEnabled = mergeSubscriptionPageConfig(preferences.subscriptionPage).enabled;
  const { products: apiProducts, loading: productsLoading } = useProducts({ limit: 100 });
  const products =
    apiProducts.length > 0 ? apiProducts : productsLoading ? [] : storeProducts;
  const bulkProducts = products.filter(
    (p: any) => p.status === 'Active' && productHasBulkPricing(p),
  );
  const navigate = useNavigate();

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const [activeOffers, setActiveOffers] = useState<AvailableOffer[] | null>(null);

  useEffect(() => {
    getAvailableOffers().then(setActiveOffers).catch(() => setActiveOffers([]));
  }, []);

  const offers = activeOffers === null ? [] : activeOffers.map((offer, i) => {
    const isPercentage = offer.discountType === 'PERCENTAGE';
    const title = isPercentage ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`;
    const subtitle = `Use Code: ${offer.code}`;
    let description = `Enjoy ${title} on your order.`;
    if (offer.scopeType === 'CATEGORY' && offer.categoryNames.length > 0) {
      description = `Valid on ${offer.categoryNames.join(', ')}.`;
    } else if (offer.scopeType === 'ALL') {
      description = `Available across our entire fruit catalog.`;
    }

    if (offer.minOrderValue) {
      description += ` Min order: ₹${offer.minOrderValue}.`;
    }

    const colors = ['emerald', 'amber', 'blue', 'orange', 'purple', 'rose'];
    const icons = [TrendingUp, Clock, Gift, Zap, Tag];
    
    return {
      icon: icons[i % icons.length],
      title,
      subtitle,
      description,
      color: colors[i % colors.length],
      titleField: '',
      subtitleField: '',
      descriptionField: '',
    };
  });

  return (
    <section className="relative py-32 bg-white overflow-hidden">
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
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">Special deals</span>
            </div>

            <h2 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              <span
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={handleTextChange('specialOffersTitle')}
                className="outline-none"
              >
                {theme.specialOffersTitle || 'Offers'}
              </span>
            </h2>

            <p
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleTextChange('specialOffersSubtitle')}
              className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed outline-none"
            >
              {theme.specialOffersSubtitle || "Save more with our seasonal and bulk deals."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-4 px-6 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
              <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Deals active</span>
            </div>
          </motion.div>
        </div>

        {/* Tactical Rewards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {activeOffers === null ? (
            <div className="col-span-full py-12 text-center">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
            </div>
          ) : offers.length > 0 ? (
            offers.map((offer, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                onClick={() => navigate('/products')}
                className="group relative bg-slate-900 rounded-[3rem] p-12 overflow-hidden cursor-pointer shadow-2xl transition-all duration-500"
              >
                <div className={cn(
                  "absolute -top-10 -right-10 h-40 w-40 blur-[80px] opacity-20 group-hover:opacity-40 transition-all duration-700",
                  `bg-${offer.color}-500`
                )} />

                <div className="relative z-10 space-y-10">
                  <div className={cn(
                    "h-16 w-16 rounded-2xl flex items-center justify-center shadow-xl transition-all group-hover:rotate-12 group-hover:scale-110",
                    `bg-${offer.color}-500 text-white`
                  )}>
                    <offer.icon className="h-8 w-8" />
                  </div>

                  <div className="space-y-4">
                    <h3 className={cn("text-4xl font-black tracking-tighter uppercase leading-none", `text-${offer.color}-400`)}>
                      {offer.title}
                    </h3>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">
                      {offer.subtitle}
                    </h4>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed italic">
                      {offer.description}
                    </p>
                  </div>

                  <div className="pt-8 border-t border-white/5 flex items-center justify-between group-hover:text-white transition-colors">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-300">Shop eligible items</span>
                    <ArrowRight className="h-4 w-4 text-slate-600 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-slate-50">
              <Tag className="h-10 w-10 text-slate-300 mx-auto mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No active promo codes right now</p>
            </div>
          )}
        </div>

        {/* Global Node Subscription HUD — hidden when admin disables subscription storefront */}
        {subscriptionPageEnabled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-20 p-16 bg-emerald-500 rounded-[4rem] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12 group"
        >
          {/* Background Distortion Artifacts */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          <div className="relative z-10 text-center md:text-left space-y-4">
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.5em]">Newsletter</span>
            <h3 className="text-4xl md:text-6xl font-black text-slate-950 uppercase tracking-tighter leading-none">
              Stay in the loop
            </h3>
            <p className="text-lg md:text-xl text-slate-900/60 font-bold uppercase tracking-tight italic">
              Subscribe for 15% off your first order and weekly tips.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/subscription')}
            className="h-20 px-16 bg-slate-950 text-white rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-white hover:text-slate-950 transition-all shadow-3xl group"
          >
            Subscribe
            <Zap className="h-5 w-5 text-emerald-500 group-hover:scale-125 transition-transform" />
          </motion.button>
        </motion.div>
        )}

        {/* Bulk Acquisition Signals */}
        <div className="mt-40 space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Bulk deals</h3>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Save more when you buy in larger quantities</p>
            </div>
            <div className="flex items-center gap-2 px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest leading-none">Discounts available</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {bulkProducts.slice(0, 8).map((product: any, index: number) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
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
                  onAddToCart={(payload: any, qty?: number) => {
                    const p =
                      typeof payload === 'object'
                        ? payload
                        : products.find((pr: any) => String(pr.id) === String(payload));
                    if (!p) return;
                    // Pass the bulk quantity through — ProductCard already computed it as bulkDiscountQty
                    handleAddToCart(p, qty);
                  }}
                  product={product}
                  bulkDealMode
                />
              </motion.div>
            ))}
            {bulkProducts.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50">
                <Tag className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No bulk deals available right now.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}