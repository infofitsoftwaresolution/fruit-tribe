import { motion } from 'framer-motion';
import { Leaf, Award, Truck, Heart, Users, Target, Globe, Activity, Shield, Zap, ArrowRight, ChevronRight, Binary, Cpu, Scale } from 'lucide-react';
import { AboutSection } from '@/app/components/AboutSection';
import { StatsSection } from '@/app/components/StatsSection';
import { Testimonials } from '@/app/components/Testimonials';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function AboutPage() {
  const { theme } = useStore();
  const storyImage = theme.aboutPageImage || "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

  const values = [
    {
      icon: Scale,
      title: 'Equitable Sourcing',
      handle: 'VALUE 01',
      desc: 'We work directly with farmers so they earn more and you get fresher produce.',
      color: 'emerald'
    },
    {
      icon: Shield,
      title: 'Quality Integrity',
      handle: 'VALUE 02',
      desc: 'Every product is quality-checked before delivery.',
      color: 'blue'
    },
    {
      icon: Binary,
      title: 'Sustainable Delivery',
      handle: 'VALUE 03',
      desc: 'We use efficient delivery routes to reduce waste and emissions.',
      color: 'amber'
    },
    {
      icon: Cpu,
      title: 'Smart Ag-Tech',
      handle: 'VALUE 04',
      desc: 'We use data to improve freshness and reduce waste.',
      color: 'purple'
    }
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Cinematic Hero Projection */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-blue-500/5 blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-5 h-5 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">About us</span>
            </div>
            <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter uppercase leading-[0.85] mb-8">
              Our <span className="text-emerald-500 italic">Story.</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-500 font-medium leading-relaxed max-w-2xl italic">
              {theme.aboutHeroSubtitle || "We connect you with the freshest fruit from farm to table. Quality and freshness you can trust."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Strategic Narrative - Split Layout */}
      <section className="py-24 border-t border-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-5 space-y-10"
          >
            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Our story</h2>
              <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                {theme.aboutStoryTitle || 'How We Started'}
              </h3>
            </div>

            <div className="space-y-6 text-slate-500 text-lg leading-relaxed font-medium">
              <p>
                Founded in 2020, The Fruit Tribe started with one goal: make farm-fresh fruit easy to buy at home.
              </p>
              <p>
                What started as a local fruit stand has grown into a trusted source for fresh produce. We work directly with growers to bring you the best quality.
              </p>
            </div>

            <div className="pt-6 flex flex-wrap gap-4">
              <div className="px-6 py-4 bg-slate-900 text-white rounded-2xl flex items-center gap-4 shadow-xl shadow-slate-900/20">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Service Active</span>
              </div>
              <div className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                <span className="text-slate-900">Uptime:</span> 99.98%
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="lg:col-span-7 relative"
          >
            <div className="aspect-[16/10] rounded-[3.5rem] overflow-hidden shadow-3xl relative group">
              <img
                src={storyImage}
                alt="Fresh Yield Preview"
                className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />

              {/* Traceability details */}
              <div className="absolute bottom-10 left-10 p-6 bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-2xl">
                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">Source Tracking</p>
                <p className="text-sm font-black text-white uppercase tracking-tight">Farm-to-door verified</p>
              </div>
            </div>

            <div className="absolute -right-10 -bottom-10 h-64 w-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          </motion.div>
        </div>
      </section>

      {/* Our core values */}
      <section className="py-24 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-5 h-5 text-emerald-400" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Why choose us</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Our Values.</h2>
            </div>
            <p className="text-slate-500 text-lg font-medium max-w-sm italic">
              These are the standards we follow every day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((protocol, idx) => (
              <motion.div
                key={protocol.handle}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
                className="bg-white/[0.03] backdrop-blur-md p-10 rounded-[3rem] border border-white/5 hover:bg-white/5 hover:border-emerald-500/20 transition-all group h-full flex flex-col"
              >
                <div className={cn(
                  "h-16 w-16 rounded-2xl flex items-center justify-center mb-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-2xl",
                  protocol.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    protocol.color === 'blue' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      protocol.color === 'amber' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                )}>
                  <protocol.icon className="w-8 h-8" />
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">{protocol.handle}</p>
                <h4 className="text-2xl font-black text-white uppercase tracking-tighter mb-4 group-hover:text-emerald-400 transition-colors">{protocol.title}</h4>
                <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight mt-auto">
                  {protocol.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About sections */}
      <div className="bg-white">
        <AboutSection />
        <div className="bg-slate-50">
          <StatsSection />
        </div>
        <Testimonials />
      </div>

      {/* Call to action */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="space-y-10"
          >
            <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">Ready to order <span className="text-emerald-500">fresh fruit?</span></h2>
            <div className="flex justify-center gap-6">
              <button onClick={() => window.location.href = '/#/products'} className="h-16 px-10 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl shadow-slate-900/20 flex items-center gap-4 group active:scale-95">
                Start Shopping
                <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
              </button>
              <button onClick={() => window.location.href = '/#/login'} className="h-16 px-10 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all flex items-center gap-4 active:scale-95">
                Sign in
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
