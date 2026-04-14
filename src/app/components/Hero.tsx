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
      {/* Cinematic Background Layer - Simplified for Mobile */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#ecfdf5_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,#fef3c7_0%,transparent_50%)] opacity-40 md:opacity-100" />

        {/* Animated Grid Artifact - Hidden on Mobile */}
        <div className="hidden md:block absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Main Content Manifold */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-3 sm:px-6 md:px-12 pt-36 sm:pt-32 pb-14 sm:pb-20 w-full">
        <div className="grid lg:grid-cols-12 gap-8 sm:gap-16 items-center">

          {/* Left Column: Symbolic & Textual Signals */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 shadow-sm transition-all hover:scale-105 group cursor-default"
            >
              <Leaf className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                Fresh from Trusted Farms
              </span>
            </motion.div>

            <div className="space-y-6">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-4xl sm:text-6xl md:text-8xl font-black text-slate-900 tracking-tight sm:tracking-tighter leading-[1.0]"
              >
                Premium <span className="text-emerald-600">Fresh Fruits</span> Delivered in 24 Hours
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-base sm:text-lg md:text-xl text-slate-500 font-bold max-w-xl mx-auto lg:mx-0 leading-relaxed tracking-normal"
              >
                Handpicked seasonal produce delivered fresh within 24 hours — guaranteed.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="space-y-10"
            >
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => navigate('/products')}
                  className="w-full sm:w-auto px-10 h-16 sm:h-20 bg-emerald-600 text-white rounded-[2rem] text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 group"
                >
                  Order Fresh Fruits Now
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </button>

                <button
                  onClick={() => navigate('/products')}
                  className="w-full sm:w-auto px-10 h-16 sm:h-20 bg-white border-2 border-slate-100 text-slate-900 rounded-[2rem] text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:border-emerald-600 transition-all active:scale-95 group"
                >
                  Browse Collections
                </button>
              </div>

              {/* Trust Signals Row - Stacked on Mobile */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 sm:gap-10 pt-4 border-t border-slate-100/50 sm:border-t-0">
                <div className="flex items-center gap-2">
                    <span className="text-amber-400">⭐⭐⭐⭐⭐</span>
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">4.8 (2k+ Orders)</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <Zap className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Delivered in 24 Hours</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">100% Fresh Guarantee</span>
                </div>
              </div>
            </motion.div>

            {/* Signal Telemetry Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-3 gap-3 sm:gap-8 pt-8 sm:pt-10 border-t border-slate-50 max-w-lg mx-auto lg:mx-0"
            >
              {[
                { label: 'Varieties', value: '100+', sub: 'Active SKUs' },
                { label: 'Local Trust', value: '300+', sub: 'Members Active' },
                { label: 'High Yield', value: '4.9★', sub: 'Satisfaction' },
              ].map((stat, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-lg sm:text-2xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
                  <p className="text-[8px] sm:text-[9px] font-black text-slate-400 tracking-[0.04em] sm:tracking-widest">{stat.label}</p>
                  <div className="h-0.5 w-8 bg-emerald-500/20 rounded-full" />
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Column: High-Value Visual Asset */}
          <div className="lg:col-span-5 relative">
            <motion.div
              style={{ y: y1 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative aspect-[4/5] rounded-[3rem] sm:rounded-[4rem] bg-slate-100 overflow-hidden shadow-2xl border-8 border-white group"
            >
              <img
                src="/images/hero.png"
                alt="Premium fresh fruits"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

              {/* Cinematic Overlay Artifacts */}
              <div className="absolute top-10 right-10 hidden lg:flex gap-2">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Asset #884</span>
                </div>
              </div>

              <div className="absolute bottom-10 left-10 hidden lg:block space-y-2">
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