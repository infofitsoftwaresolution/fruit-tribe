import { useStore } from '@/app/context/StoreContext';
import { Hero } from '@/app/components/Hero';
import { FeaturedProducts } from '@/app/components/FeaturedProducts';
import { AboutSection } from '@/app/components/AboutSection';
import { HowItWorks } from '@/app/components/HowItWorks';
import { SeasonalHighlights } from '@/app/components/SeasonalHighlights';
import { SpecialOffers } from '@/app/components/SpecialOffers';
import { Testimonials } from '@/app/components/Testimonials';
import { StatsSection } from '@/app/components/StatsSection';
import { WhyChooseUs } from '@/app/components/WhyChooseUs';
import { RecipesSection } from '@/app/components/RecipesSection';
import { NewsletterSection } from '@/app/components/NewsletterSection';
import { ParallaxBanner } from '@/app/components/ParallaxBanner';
import { useProducts } from '@/app/hooks/useProducts';
import { motion } from 'framer-motion';
import { Tag } from 'lucide-react';

interface HomePageProps {
  onAddToCart: (product: any) => void;
}

export function HomePage({ onAddToCart }: HomePageProps) {
  const { theme } = useStore();
  const { products } = useProducts({ limit: 100 });

  const categories = Array.from(new Set(products.map((p) => p.category))).slice(0, 6);

  return (
    <div>
      <Hero />

      {/* Quick categories & fresh picks */}
      {categories.length > 0 && (
        <section className="py-12 px-6 md:px-12 max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">
                Browse by category
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                Find the right fruits faster
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <motion.button
                key={cat}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  window.location.hash = `#/products?categoryName=${encodeURIComponent(cat)}`;
                }}
                className="px-5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all"
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </section>
      )}
      {theme.showFeaturedProducts !== false && <FeaturedProducts onAddToCart={onAddToCart} />}
      {theme.showSeasonalHighlights !== false && <SeasonalHighlights />}
      {theme.showSpecialOffers !== false && <SpecialOffers />}
      
      <AboutSection />
      {theme.showHowItWorks !== false && <HowItWorks />}
      
      <ParallaxBanner />
      {/* Trust strip */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { title: '5000+ orders delivered', desc: 'Happy fruit lovers across the city', icon: '😊' },
            { title: 'Farm-fresh guarantee', desc: 'Picked close to delivery, never old stock', icon: '🌱' },
            { title: 'Same / next-day delivery', desc: 'Smart routing for fresh and fast drops', icon: '⚡' },
            { title: 'Secure online payments', desc: 'Trusted gateways and encrypted checkout', icon: '🔒' },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm px-5 py-6 flex flex-col gap-2">
              <div className="text-2xl">{item.icon}</div>
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{item.title}</p>
              <p className="text-[11px] text-slate-500 font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <WhyChooseUs />
      {theme.showTestimonials !== false && <Testimonials />}
      {theme.showRecipes !== false && <RecipesSection />}
      {theme.showStats !== false && <StatsSection />}
      {theme.showNewsletter !== false && <NewsletterSection />}
    </div>
  );
}
