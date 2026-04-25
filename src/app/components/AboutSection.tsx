import { motion } from 'framer-motion';
import { Leaf, Award, Truck, Heart, Shield, Users, Zap, ShieldCheck, Microscope, Globe } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { useProducts } from '@/app/hooks/useProducts';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';
import { cn } from '@/lib/utils';

export function AboutSection() {
  const { theme, isEditing, updateTheme } = useStore();
  const { meta: productMeta } = useProducts({ limit: 1, showOutOfSeason: true });
  const { cities: serviceableCities } = useServiceableAreas();

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-100 text-slate-700',
    pink: 'bg-pink-50 text-pink-600',
  };

  const features = [
    {
      icon: Microscope,
      title: theme.aboutFeature1Title || 'Precision Organic',
      description: theme.aboutFeature1Desc || 'Grown without synthetic chemicals for natural goodness.',
      fieldTitle: 'aboutFeature1Title',
      fieldDesc: 'aboutFeature1Desc',
      color: 'emerald'
    },
    {
      icon: Award,
      title: theme.aboutFeature2Title || 'Premium grade',
      description: theme.aboutFeature2Desc || 'Sourced from trusted growers for the best taste and nutrition.',
      fieldTitle: 'aboutFeature2Title',
      fieldDesc: 'aboutFeature2Desc',
      color: 'amber'
    },
    {
      icon: Zap,
      title: theme.aboutFeature3Title || 'Fast delivery',
      description: theme.aboutFeature3Desc || 'Quick shipping so your fruit arrives fresh.',
      fieldTitle: 'aboutFeature3Title',
      fieldDesc: 'aboutFeature3Desc',
      color: 'blue'
    },
    {
      icon: ShieldCheck,
      title: theme.aboutFeature4Title || 'Quality verified',
      description: theme.aboutFeature4Desc || 'Every item is checked against our freshness standards.',
      fieldTitle: 'aboutFeature4Title',
      fieldDesc: 'aboutFeature4Desc',
      color: 'purple'
    },
    {
      icon: Globe,
      title: theme.aboutFeature5Title || 'Traceable origin',
      description: theme.aboutFeature5Desc || 'We tell you where your fruit comes from.',
      fieldTitle: 'aboutFeature5Title',
      fieldDesc: 'aboutFeature5Desc',
      color: 'slate'
    },
    {
      icon: Users,
      title: theme.aboutFeature6Title || 'Trusted by many',
      description: theme.aboutFeature6Desc || 'Join our growing tribe of happy customers who choose us for fresh fruit.',
      fieldTitle: 'aboutFeature6Title',
      fieldDesc: 'aboutFeature6Desc',
      color: 'pink'
    },
  ];

  const productCount = productMeta?.total ?? 0;
  const cityCount = serviceableCities.length;
  const byTheNumbers = [
    {
      value: productCount > 0 ? `${productCount}+` : '—',
      label: 'Product varieties',
      sub: 'Live in catalog',
    },
    {
      value: cityCount > 0 ? `${cityCount}` : '—',
      label: 'Service cities',
      sub: 'Currently active',
    },
    {
      value: '99%',
      label: 'Customer satisfaction',
      sub: 'Rated',
    },
    {
      value: 'Mon-Sat',
      label: 'Support window',
      sub: '9AM - 6PM IST',
    },
  ];

  return (
    <section className="relative py-32 overflow-hidden bg-slate-50">
      {/* Background Architectural Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-white" />
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Section Header Orchestration */}
        <div className="grid lg:grid-cols-2 gap-20 items-end mb-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-[1px] w-12 bg-emerald-500" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">About us</span>
            </div>

            <h2 className="text-[9vw] sm:text-5xl md:text-8xl font-black text-slate-900 tracking-tight sm:tracking-tighter uppercase leading-tight mb-8 break-words hyphens-auto">
              <span
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={handleTextChange('aboutSectionTitle')}
                className="outline-none block w-full"
              >
                {theme.aboutSectionTitle || 'Our Story'}
              </span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="pb-4"
          >
            <p
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleTextChange('aboutSectionSubtitle')}
              className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed outline-none border-l-4 border-slate-900 pl-8"
            >
              {theme.aboutSectionSubtitle || "We bring you the freshest fruit from trusted farms, with a focus on quality and care."}
            </p>
          </motion.div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-2xl hover:shadow-emerald-900/10 hover:border-emerald-100 transition-all duration-500"
            >
              <div className="flex items-start justify-between mb-10">
                <div className={cn(
                  "h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110",
                  colorClasses[feature.color] || 'bg-slate-100 text-slate-700'
                )}>
                  <feature.icon className="h-8 w-8" strokeWidth={2} />
                </div>
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">Feature {index + 1}</span>
              </div>

              <div className="space-y-4">
                <h3
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  onBlur={handleTextChange((feature as any).fieldTitle)}
                  className="text-xl font-black text-slate-900 uppercase tracking-tight outline-none"
                >
                  {feature.title}
                </h3>
                <p
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  onBlur={handleTextChange((feature as any).fieldDesc)}
                  className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed italic outline-none"
                >
                  {feature.description}
                </p>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500">
                <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Verified</span>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Global Performance Manifold */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-32 p-16 bg-slate-900 rounded-[4rem] relative overflow-hidden flex flex-col items-center justify-center text-center space-y-16"
        >
          {/* Background Technical Noise - Visible on Tablet/Desktop only */}
          <div className="hidden md:block absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          <div className="space-y-4">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.5em]">By the numbers</span>
            <h3 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter">How we're doing</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 w-full max-w-5xl">
            {byTheNumbers.map((stat, index) => (
              <div key={index} className="space-y-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-4xl md:text-5xl font-black text-white tracking-tighter"
                >
                  {stat.value}
                </motion.div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">{stat.label}</p>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
