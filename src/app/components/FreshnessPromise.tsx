import { motion } from 'framer-motion';
import { ArrowRight, Leaf, Truck, MapPin, Clock, Users, ShieldCheck, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { useMemo, useState } from 'react';
import { useProducts } from '@/app/hooks/useProducts';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';

const PDP_META_PREFIX = '[PDP_META]';
const PDP_META_LEGACY_PREFIX = '[PDP_META';

function extractProductDetails(description?: string): string {
  if (!description) return '';
  if (!description.startsWith(PDP_META_LEGACY_PREFIX)) return description;
  try {
    const payload = description.startsWith(PDP_META_PREFIX)
      ? description.slice(PDP_META_PREFIX.length)
      : description.slice(PDP_META_LEGACY_PREFIX.length);
    const parsed = JSON.parse(payload) as { details?: string };
    return (parsed.details || '').trim();
  } catch {
    return '';
  }
}

const DELIVERY_AREAS = [
  'Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout',
  'Jayanagar', 'BTM Layout', 'Electronic City', 'Marathahalli',
];

export function FreshnessPromise() {
  const { customers, orders } = useStore();
  const { products } = useProducts({ limit: 200, showOutOfSeason: true, includeInactive: true });
  const { cities: serviceableCities } = useServiceableAreas();
  const [showAllAreas, setShowAllAreas] = useState(false);
  const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
  const areas = serviceableCities.length > 0 ? serviceableCities : DELIVERY_AREAS;
  const visibleAreas = showAllAreas ? areas : areas.slice(0, 8);
  const remainingAreaCount = Math.max(0, areas.length - visibleAreas.length);

  const stats = useMemo(() => {
    const farmPartners = new Set(
      products
        .map((p) => (p.vendor || '').trim())
        .filter(Boolean),
    ).size;
    const mangoVarietyNames = new Set(
      products
        .filter((p) => {
          const name = (p.name || '').toLowerCase();
          const category = (p.category || '').toLowerCase();
          const details = extractProductDetails(p.description).toLowerCase();
          return (
            name.includes('mango')
            || category.includes('mango')
            || details.includes('mango')
            || details.includes('variety:')
          );
        })
        .map((p) => {
          const details = extractProductDetails(p.description);
          const varietyMatch = details.match(/variety\s*:\s*([^\n,.;]+)/i);
          const varietyName = (varietyMatch?.[1] || p.name || '').trim().toLowerCase();
          return varietyName;
        })
        .filter(Boolean),
    );
    const orderCustomers = new Set(
      orders
        .map((o) => (o.customer || '').trim())
        .filter(Boolean),
    ).size;
    const happyCustomers = Math.max(customers.length, orderCustomers);
    const verifiedOrders = orders.length;
    const varietyCount = mangoVarietyNames.size > 0 ? mangoVarietyNames.size : products.length;
    const varietiesDisplay = `${varietyCount}+`;
    const happyCustomersDisplay = `${Math.max(happyCustomers, 300)}+`;

    return {
      farmPartners,
      varieties: varietyCount,
      happyCustomers,
      verifiedOrders,
      band: [
        { value: varietiesDisplay, label: 'Varieties', icon: Leaf },
        { value: '6h', label: 'Farm to door', icon: Clock },
        { value: happyCustomersDisplay, label: 'Happy customers', icon: Users },
        { value: verifiedOrders > 0 ? '4.9★' : '—', label: 'Average rating', icon: Star },
      ],
    };
  }, [products, customers.length, orders, compact]);

  return (
    <section className="bg-white">

      {/* ── Stats Band ── */}
      <div className="bg-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-white/10">
            {stats.band.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col items-center lg:items-start gap-2 px-0 lg:px-10 text-center lg:text-left first:lg:pl-0 last:lg:pr-0"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <stat.icon className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Our Promise CTA ── */}
      <div className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden aspect-[4/3] bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900&q=80"
                  alt="Fresh fruits from the farm"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/40 via-transparent to-transparent" />

                {/* Overlay card */}
                <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                    <Leaf className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Straight from the farm</p>
                    <p className="text-xs text-slate-500 mt-0.5">No middlemen. No warehouses. Just fresh.</p>
                  </div>
                </div>
              </div>

              {/* Floating stat card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="absolute -top-4 -right-4 hidden sm:flex items-center gap-3 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3"
              >
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{stats.verifiedOrders > 0 ? '4.9 / 5' : '—'}</p>
                  <p className="text-[11px] text-slate-400">{compact.format(stats.verifiedOrders)} verified orders</p>
                </div>
              </motion.div>
            </motion.div>

            {/* Right: copy */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                  Our promise
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                  We don't sell old fruit.<br />
                  <span className="text-emerald-600">We deliver today's harvest.</span>
                </h2>
                <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-lg">
                  Every fruit on The Fruit Tribe is sourced directly from partner farms across Karnataka and delivered 
                  within hours — not days. No cold storage, no middlemen, no compromises.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: MapPin, title: 'Sourced locally', desc: 'Partner farms within 100km of Bengaluru.' },
                  { icon: ShieldCheck, title: 'Quality guaranteed', desc: 'Every box inspected before it leaves the farm.' },
                  { icon: Truck, title: 'Same-day delivery', desc: 'Order by the cutoff, receive it today.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 h-11 px-6 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm group"
                >
                  Shop fresh now
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Our story
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Delivery locations strip ── */}
      <div className="border-t border-slate-100 py-8 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-700">Delivering in Bengaluru:</span>
            </div>
            {visibleAreas.map((area) => (
              <span key={area} className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">
                {area}
              </span>
            ))}
            {areas.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllAreas((prev) => !prev)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors ml-1"
              >
                {showAllAreas ? 'Show less' : `+ ${remainingAreaCount} more areas`}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
