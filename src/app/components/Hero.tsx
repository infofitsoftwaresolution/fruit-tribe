import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Sparkles, Leaf, TrendingUp, Zap, ShieldCheck, Globe, PlayCircle, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';
import { useRef, useState } from 'react';

export function Hero() {
  const navigate = useNavigate();
  const { theme, isEditing, updateTheme } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  return (
    <div ref={containerRef} className="relative min-h-[100vh] flex items-center justify-center overflow-x-hidden bg-white">
      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#ecfdf5_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,#fef3c7_0%,transparent_50%)] opacity-40" />

        {/* Animated Grid Artifact */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Main Content Manifold */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 pt-32 pb-20 w-full">
        <div className="grid lg:grid-cols-12 gap-16 items-center">

          {/* Left Column: Symbolic & Textual Signals */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-3 px-5 py-2.5 bg-slate-900 rounded-full shadow-2xl transition-all hover:scale-105 group cursor-default"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-5 w-5 rounded-full border-2 border-slate-900 bg-emerald-500 flex items-center justify-center">
                    <Leaf className="w-2.5 h-2.5 text-white" />
                  </div>
                ))}
              </div>
              <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                Fresh from the farm
              </span>
            </motion.div>

            <div className="space-y-6">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.9] uppercase"
              >
                <span className="block italic font-serif text-emerald-600 lowercase tracking-tight mb-2">The</span>
                {theme.heroTitle}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-lg md:text-xl text-slate-500 font-bold max-w-xl mx-auto lg:mx-0 leading-relaxed"
              >
                {theme.heroSubtitle}
              </motion.p>

              {/* Location + trust strip */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25 }}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500"
              >
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <MapPin className="w-3 h-3" />
                  Delivering in Bengaluru
                </div>
                <span className="hidden md:inline text-slate-300">•</span>
                <span>Farm fresh • Same-day delivery • Secure payments</span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col gap-4 justify-center lg:justify-start max-w-xl"
            >
              {/* Search bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-300" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = query.trim();
                      if (trimmed) {
                        navigate(`/products?q=${encodeURIComponent(trimmed)}`);
                      } else {
                        navigate('/products');
                      }
                    }
                  }}
                  placeholder="Search fresh fruits..."
                  className="w-full h-14 pl-12 pr-4 rounded-[1.75rem] border border-slate-200 bg-white/80 text-xs md:text-sm font-black uppercase tracking-[0.25em] text-slate-900 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
              <button
                onClick={() => navigate('/products')}
                className="h-20 px-12 bg-slate-900 text-white rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-emerald-600 transition-all shadow-2xl shadow-slate-900/20 active:scale-95 group"
              >
                Shop now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/about')}
                className="h-20 px-12 bg-white border-2 border-slate-100 text-slate-900 rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:border-emerald-600 transition-all active:scale-95 group"
              >
                Heritage Manual
                <PlayCircle className="w-5 h-5 text-emerald-500" />
              </button>
              </div>
            </motion.div>

            {/* Signal Telemetry Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-3 gap-8 pt-10 border-t border-slate-50 max-w-lg mx-auto lg:mx-0"
            >
              {[
                { label: 'Varieties', value: '100+', sub: 'Active SKUs' },
                { label: 'Global Reach', value: '50K+', sub: 'Nodes Active' },
                { label: 'High Yield', value: '4.9★', sub: 'Satisfaction' },
              ].map((stat, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <div className="h-0.5 w-8 bg-emerald-500/20 rounded-full" />
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Column: High-Value Visual Asset */}
          <div className="lg:col-span-5 relative">
            <motion.div
              style={{ y: y1 }}
              initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative aspect-[4/5] rounded-[4rem] bg-slate-100 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.1)] border-[12px] border-white group"
            >
              <img
                src={theme.heroImage}
                alt="Fresh produce"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

              {/* Cinematic Overlay Artifacts */}
              <div className="absolute top-10 right-10 flex gap-2">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Asset #884</span>
                </div>
              </div>

              <div className="absolute bottom-10 left-10 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Purity Verified</p>
                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest">Global Standard 01</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Abstract Botanic Artifacts */}
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-10 -right-10 h-40 w-40 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none"
            />
            <motion.div
              animate={{ y: [0, 30, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-20 -left-20 h-64 w-64 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Scroll Down Signal */}
      <motion.div
        style={{ opacity }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
      >
        <div className="h-12 w-[2px] bg-gradient-to-b from-slate-200 via-emerald-500 to-transparent relative overflow-hidden">
          <motion.div
            animate={{ y: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute top-0 left-0 w-full h-1/2 bg-white/40"
          />
        </div>
        <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Vertical Flow</span>
      </motion.div>
    </div>
  );
}