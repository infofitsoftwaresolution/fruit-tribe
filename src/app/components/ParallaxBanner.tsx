import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Sparkles, Zap, ShieldCheck, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function ParallaxBanner() {
  const { theme, isEditing, updateTheme } = useStore();

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ['-20%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.6, 1, 0.6]);
  const bgImage = theme.parallaxBannerImage || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1920';

  return (
    <div ref={containerRef} className="relative" style={{ position: 'relative' }}>
      <section className="relative h-[600px] sm:h-[900px] overflow-hidden">
        {/* Parallax Background */}
        <motion.div
          data-theme-field="parallaxBannerImage"
          style={{ y, backgroundImage: `url(${bgImage})` }}
          className={`absolute inset-0 bg-cover bg-center transition-all ${isEditing ? 'cursor-pointer hover:ring-4 hover:ring-green-500 hover:ring-inset' : ''}`}
        >
          {/* Cinematic Global Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-slate-950" />
          <div className="absolute inset-0 bg-black/60" />
        </motion.div>

        {/* Technical HUD Overlay Elements */}
        <div className="absolute inset-0 z-10 pointer-events-none hidden lg:block">
          <div className="absolute top-20 right-20 flex gap-4">
            <div className="px-6 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-3">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Verified</span>
            </div>
          </div>

          <div className="absolute bottom-20 left-20">
            <div className="px-6 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Quality assured</span>
            </div>
          </div>
        </div>

        {/* High-Fidelity Content Hub */}
        <motion.div
          style={{ opacity }}
          className="relative z-20 h-full flex items-center justify-center px-6"
        >
          <div className="max-w-5xl w-full text-center space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-10"
            >
              <div className="inline-flex items-center gap-4 px-6 py-2 bg-emerald-500/5 backdrop-blur-md border border-emerald-500/20 rounded-full">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em]">Our promise</span>
              </div>

              <h2 className="text-5xl sm:text-7xl md:text-9xl font-black text-white tracking-tighter uppercase leading-[0.8]">
                <span
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  onBlur={handleTextChange('parallaxTitle')}
                  className="outline-none"
                >
                  {theme.parallaxTitle || 'Fresh'}
                </span>
                <br />
                <span className="italic font-serif text-emerald-400 lowercase tracking-tight">from farm to you</span>
              </h2>

              <p
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={handleTextChange('parallaxSubtitle')}
                className="text-lg md:text-2xl text-slate-300 font-bold uppercase tracking-tight italic max-w-2xl mx-auto leading-relaxed outline-none"
              >
                {theme.parallaxSubtitle || 'Quality fruit, delivered with care.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center items-center pt-6 sm:pt-8">
                <motion.button
                  whileHover={{ scale: 1.05, x: 5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/products')}
                  className="w-full sm:w-auto h-16 sm:h-20 px-10 sm:px-16 bg-white text-slate-900 rounded-[2rem] sm:rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-emerald-400 transition-all shadow-3xl active:scale-95 group"
                >
                  Shop now
                  <Zap className="h-5 w-5 text-emerald-500 group-hover:scale-125 transition-transform" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/about')}
                  className="w-full sm:w-auto h-16 sm:h-20 px-10 sm:px-16 bg-white/5 backdrop-blur-md text-white border-2 border-white/20 rounded-[2rem] sm:rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] hover:bg-white/10 transition-all"
                >
                  About us
                </motion.button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
