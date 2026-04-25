import { motion } from 'framer-motion';
import {
  Leaf, Shield, Truck, Users, Target, Star, ArrowRight,
  MapPin, Clock, Scale, Cpu, CheckCircle2
} from 'lucide-react';
import { Testimonials } from '@/app/components/Testimonials';
import { StatsSection } from '@/app/components/StatsSection';
import { useStore } from '@/app/context/StoreContext';
import { Link } from 'react-router-dom';

const VALUES = [
  {
    icon: Scale,
    title: 'Equitable sourcing',
    desc: 'We work directly with farmers so they earn more and you get fresher produce — no middlemen.',
    color: 'emerald',
  },
  {
    icon: Shield,
    title: 'Quality integrity',
    desc: 'Every batch is quality-checked before it leaves the farm. No compromises.',
    color: 'blue',
  },
  {
    icon: Truck,
    title: 'Sustainable delivery',
    desc: 'Efficient delivery routes and minimal packaging to reduce our carbon footprint.',
    color: 'amber',
  },
  {
    icon: Cpu,
    title: 'Smart ag-tech',
    desc: 'We use real-time data to match freshness windows with delivery slots.',
    color: 'purple',
  },
];

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
};

const TEAM = [
  {
    name: 'Arjun Nair',
    role: 'Founder & CEO',
    bio: 'Ex-agritech, passionate about connecting farmers directly with consumers.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80',
  },
  {
    name: 'Priya Sharma',
    role: 'Head of Sourcing',
    bio: 'Built relationships with 50+ farm partners across Karnataka.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&q=80',
  },
  {
    name: 'Ravi Kumar',
    role: 'Operations Lead',
    bio: 'Ensures every order reaches you at peak freshness, every time.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&q=80',
  },
];

const MILESTONES = [
  { year: '2020', event: 'Founded with a single partner farm' },
  { year: '2021', event: 'Expanded to 15 Bengaluru neighbourhoods' },
  { year: '2022', event: 'Reached 1,000 active customers' },
  { year: '2023', event: '50+ farm partnerships across Karnataka' },
  { year: '2024', event: '10,000+ orders delivered, 4.9★ rating' },
];

export function AboutPage() {
  const { theme } = useStore();
  const storyImage =
    theme.aboutPageImage ||
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1080&q=80';

  return (
    <div className="bg-white min-h-screen">

      {/* ── Hero ── */}
      <section className="pt-24 pb-16 bg-gradient-to-b from-emerald-50/60 to-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">
              About us
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-tight mb-5">
              We're on a mission to bring the{' '}
              <span className="text-emerald-600">farm to your doorstep.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-2xl">
              {theme.aboutHeroSubtitle ||
                'The Fruit Tribe was born out of a simple belief — fresh fruit shouldn\'t require a trip to a crowded market. We partner directly with farms so you get better quality and farmers get a fair deal.'}
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 h-11 px-6 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors group"
              >
                Shop our product
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Get in touch
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Story + Image ── */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="rounded-3xl overflow-hidden aspect-[4/3] bg-slate-100">
                <img
                  src={storyImage}
                  alt="Farm fresh fruits"
                  className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-700"
                />
              </div>
              {/* Floating card */}
              <div className="absolute -bottom-5 -right-3 sm:-right-6 bg-white shadow-xl rounded-2xl border border-slate-100 px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Farm-to-door verified</p>
                  <p className="text-xs text-slate-400 mt-0.5">Every delivery tracked</p>
                </div>
              </div>
            </motion.div>

            {/* Story copy */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                  Our story
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-snug">
                  {theme.aboutStoryTitle || 'Started small. Still personal.'}
                </h2>
              </div>

              <div className="space-y-4 text-slate-500 text-sm leading-relaxed">
                {theme.aboutStoryText ? (
                  <div dangerouslySetInnerHTML={{ __html: theme.aboutStoryText }} />
                ) : (
                  <>
                    <p>
                      Founded in 2020, The Fruit Tribe started with one goal — make farm-fresh fruit easy to buy at home.
                      What began as a single farm partnership has grown into a network of 50+ growers across Karnataka.
                    </p>
                    <p>
                      We believe that transparency matters. You should know where your food comes from.
                      That's why every product on our platform comes with farm information and a freshness guarantee.
                    </p>
                  </>
                )}
              </div>

              {/* Mini timeline */}
              <div className="space-y-3 pt-2">
                {MILESTONES.map((m, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xs font-bold text-emerald-600 w-10 shrink-0 mt-0.5">{m.year}</span>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span className="text-sm text-slate-600">{m.event}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live badge */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Service active — Bengaluru
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-500 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  6h avg. farm to door
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="bg-slate-50 border-y border-slate-100">
        <StatsSection />
      </div>

      {/* ── Values ── */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
              What we stand for
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              Our core values
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((val, i) => (
              <motion.div
                key={val.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-emerald-200 hover:shadow-sm transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${COLOR_MAP[val.color]}`}>
                  <val.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{val.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{val.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-16 md:py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
              The people behind it
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              Meet the team
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TEAM.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-sm transition-all"
              >
                <div className="aspect-[3/2] overflow-hidden bg-slate-100">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-500"
                  />
                </div>
                <div className="p-5">
                  <p className="text-base font-semibold text-slate-900">{member.name}</p>
                  <p className="text-xs font-medium text-emerald-600 mt-0.5 mb-2">{member.role}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{member.bio}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <Testimonials />

      {/* ── CTA ── */}
      <section className="py-16 md:py-20 bg-emerald-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-5"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto">
              <Star className="w-6 h-6 text-white fill-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Ready to taste the difference?
            </h2>
            <p className="text-emerald-100 text-sm leading-relaxed max-w-lg mx-auto">
              Join thousands of happy customers who get farm-fresh fruits delivered in Bengaluru.
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 h-11 px-7 bg-white text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-50 transition-colors group"
              >
                Start shopping
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/subscription"
                className="inline-flex items-center gap-2 h-11 px-6 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 transition-colors"
              >
                View plans
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
