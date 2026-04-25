import { useNavigate } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { Hero } from '@/app/components/Hero';
import { FeaturedProducts } from '@/app/components/FeaturedProducts';
import { HowItWorks } from '@/app/components/HowItWorks';
import { Testimonials } from '@/app/components/Testimonials';
import { FreshnessPromise } from '@/app/components/FreshnessPromise';
import { useProducts } from '@/app/hooks/useProducts';
import { motion } from 'framer-motion';
import { ArrowRight, Leaf, Zap, ShieldCheck, Truck } from 'lucide-react';

interface HomePageProps {
  onAddToCart: (product: any) => void;
}

export function HomePage({ onAddToCart }: HomePageProps) {
  const navigate = useNavigate();
  const { theme } = useStore();
  const { products } = useProducts({ limit: 100 });

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ).slice(0, 8);

  return (
    <div className="bg-white">
      {/* Hero */}
      <Hero />

      {/* Category Strip */}
      {categories.length > 0 && (
        <section className="py-10 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
                  Shop by category
                </p>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Browse our range
                </h2>
              </div>
              <button
                onClick={() => navigate('/products')}
                className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-emerald-600 transition-colors"
              >
                All products
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {categories.map((cat) => (
                <motion.button
                  key={cat}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/products?categoryName=${encodeURIComponent(cat)}`)}
                  className="px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all"
                >
                  {cat}
                </motion.button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      {theme.showFeaturedProducts !== false && (
        <FeaturedProducts onAddToCart={onAddToCart} />
      )}

      {/* Trust Band */}
      <section className="py-12 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Truck,       title: 'Fast delivery',  desc: 'Delivered fresh to your door, quickly.' },
              { icon: Leaf,        title: 'Farm-fresh',     desc: 'Picked close to delivery, never old stock.' },
              { icon: ShieldCheck, title: 'Quality checked',desc: 'Every item meets our freshness standards.' },
              { icon: Zap,         title: 'Easy ordering',  desc: 'Browse, add to cart, and checkout in minutes.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      {theme.showHowItWorks !== false && <HowItWorks />}

      {/* Testimonials */}
      {theme.showTestimonials !== false && <Testimonials />}

      {/* Freshness Promise + Stats + Delivery areas (replaces newsletter) */}
      <FreshnessPromise />
    </div>
  );
}
