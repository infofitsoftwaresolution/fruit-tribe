import { motion } from 'framer-motion';
import { Truck, Leaf, Award, Clock, Shield, Heart, Zap, ShieldCheck, Microscope, Globe } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function WhyChooseUs() {
  const { theme, isEditing, updateTheme } = useStore();

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const features = [
    {
      icon: Globe,
      title: 'Wide selection',
      description: 'Fresh fruit from a network of trusted farms and growers.',
      color: 'emerald',
    },
    {
      icon: Leaf,
      title: 'Natural & pure',
      description: 'No harmful chemicals; we care about what you eat.',
      color: 'amber',
    },
    {
      icon: ShieldCheck,
      title: 'Top quality',
      description: 'We only sell produce that meets our high standards.',
      color: 'blue',
    },
    {
      icon: Zap,
      title: 'Quick delivery',
      description: 'Fast shipping so your fruit arrives fresh.',
      color: 'purple',
    },
    {
      icon: Microscope,
      title: 'Transparent',
      description: 'Clear information about origin and quality.',
      color: 'slate',
    },
    {
      icon: Heart,
      title: 'Farm to table',
      description: 'We support farmers and bring you the best they grow.',
      color: 'pink',
    },
  ];

  return (
    <section className="relative py-32 bg-white overflow-hidden">
      {/* Background Architectural Manifold */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 h-[800px] w-[800px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-[800px] w-[800px] bg-amber-500/5 rounded-full blur-[150px] pointer-events-none" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Section Header Orchestration */}
        <div className="max-w-4xl mb-24 space-y-8">
          <div className="flex items-center gap-3">
            <div className="h-[1px] w-12 bg-emerald-500" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">Why choose us</span>
          </div>

          <h2 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            <span
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleTextChange('whyChooseUsTitle')}
              className="outline-none"
            >
              {theme.whyChooseUsTitle || 'What makes us different'}
            </span>
          </h2>

          <p
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={handleTextChange('whyChooseUsSubtitle')}
            className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed outline-none border-l-4 border-slate-900 pl-8"
          >
            {theme.whyChooseUsSubtitle || "We combine quality produce with reliable delivery and honest service."}
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="group relative bg-white rounded-[3rem] p-12 border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-3xl hover:shadow-emerald-900/10 hover:border-emerald-500 transition-all duration-500 overflow-hidden flex flex-col h-full"
            >
              {/* Dynamic Glow Artifact */}
              <div className={cn(
                "absolute -top-10 -right-10 w-40 h-40 blur-3xl opacity-0 group-hover:opacity-10 transition-all duration-700",
                `bg-${feature.color}-500`
              )} />

              <div className="flex items-start justify-between mb-12">
                <div className={cn(
                  "h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 shadow-xl",
                  `bg-${feature.color}-500 text-white`
                )}>
                  <feature.icon className="h-8 w-8" />
                </div>
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Feature {index + 1}</span>
              </div>

              <div className="space-y-4 flex-1">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed italic">
                  {feature.description}
                </p>
              </div>

              <div className="mt-12 pt-10 border-t border-slate-50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-700">
                <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Quality assured</span>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
