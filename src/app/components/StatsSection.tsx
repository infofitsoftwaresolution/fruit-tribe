import { motion } from 'framer-motion';
import { Users, Award, TrendingUp, Globe, Activity, ShieldCheck, Zap, Microscope } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { useProducts } from '@/app/hooks/useProducts';
import { cn } from '@/lib/utils';

export function StatsSection() {
  const { theme, isEditing, updateTheme } = useStore();
  const { products } = useProducts({ limit: 100 });

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const stats = [
    {
      icon: Activity,
      value: '99.9%',
      label: 'Freshness',
      sub: 'Quality maintained',
      color: 'emerald',
    },
    {
      icon: Microscope,
      value: `${products.length}+`,
      label: 'Varieties',
      sub: 'To choose from',
      color: 'amber',
    },
    {
      icon: Zap,
      value: '2Hr',
      label: 'Avg dispatch',
      sub: 'Quick shipping',
      color: 'blue',
    },
    {
      icon: ShieldCheck,
      value: 'Grade A',
      label: 'Quality',
      sub: 'Our standard',
      color: 'purple',
    },
  ];

  return (
    <section className="relative py-32 bg-slate-900 overflow-hidden">
      {/* Cinematic Grid Noise */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-16 mb-24">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="h-[1px] w-12 bg-emerald-500" />
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Our stats</span>
            </div>

            <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none mb-6">
              <span
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={handleTextChange('statsSectionTitle')}
                className="outline-none"
              >
                {theme.statsSectionTitle || 'By the numbers'}
              </span>
            </h2>
            <p
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleTextChange('statsSectionSubtitle')}
              className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed italic max-w-lg outline-none"
            >
              {theme.statsSectionSubtitle || 'Quality and speed we are proud of.'}
            </p>
          </motion.div>

          {/* Status */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 px-8 py-4 rounded-3xl flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
            <span className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.3em]">All systems running</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/5 hover:border-emerald-500/30 hover:bg-white/10 transition-all duration-500 overflow-hidden"
            >
              {/* Dynamic Glow Artifact */}
              <div className={cn(
                "absolute -top-10 -right-10 w-32 h-32 blur-[60px] opacity-10 group-hover:opacity-30 transition-all duration-700",
                `bg-${stat.color}-500`
              )} />

              <div className="flex items-center justify-between mb-10">
                <div className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110",
                  `bg-${stat.color}-500/10 text-${stat.color}-400`
                )}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Stat {index + 1}</span>
              </div>

              <div className="space-y-2">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className="text-5xl font-black text-white tracking-tighter"
                >
                  {stat.value}
                </motion.div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">{stat.label}</p>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest italic">{stat.sub}</p>
                </div>
              </div>

              {/* Technical Indicator */}
              <div className="mt-10 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 2, delay: index * 0.1 + 0.5 }}
                  className={cn("h-full", `bg-${stat.color}-500`)}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
