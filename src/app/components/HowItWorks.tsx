import { motion } from 'framer-motion';
import { MousePointerClick, Package, Truck, CheckCircle, Zap, ShieldCheck, ShoppingCart, Apple } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function HowItWorks() {
  const { theme, isEditing, updateTheme } = useStore();

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const steps = [
    {
      icon: MousePointerClick,
      title: 'Choose products',
      description: 'Browse our range of fresh fruits and add what you need to your cart.',
      number: '01',
      color: 'emerald',
    },
    {
      icon: ShieldCheck,
      title: 'Quality checked',
      description: 'Every item is checked for freshness and quality before packing.',
      number: '02',
      color: 'amber',
    },
    {
      icon: Truck,
      title: 'Fast delivery',
      description: 'We deliver to your door quickly so your fruit stays fresh.',
      number: '03',
      color: 'blue',
    },
    {
      icon: Apple,
      title: 'Enjoy',
      description: 'Unpack and enjoy fresh, nutritious fruit at home.',
      number: '04',
      color: 'slate',
    },
  ];

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500 text-white',
    amber: 'bg-amber-500 text-white',
    blue: 'bg-blue-500 text-white',
    slate: 'bg-slate-900 text-white',
  };

  return (
    <section className="relative py-32 overflow-hidden bg-white">
      {/* Background Architectural Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-100" />
      </div>

      <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
        {/* Section Header Orchestration */}
        <div className="max-w-3xl mb-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-[1px] w-12 bg-emerald-500" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">How it works</span>
          </div>

          <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-8">
            <span
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleTextChange('howItWorksTitle')}
              className="outline-none"
            >
              {theme.howItWorksTitle || 'Simple steps'}
            </span>
          </h2>

          <p
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={handleTextChange('howItWorksSubtitle')}
            className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed outline-none"
          >
            {theme.howItWorksSubtitle || 'From our farm to your table in a few easy steps.'}
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative group p-2"
            >
              <div className="bg-slate-50 p-10 rounded-[3rem] space-y-8 h-full border border-slate-100 group-hover:bg-white group-hover:border-emerald-500 transition-all duration-700 shadow-[0_10px_40px_rgba(0,0,0,0.02)] group-hover:shadow-[0_40px_100px_rgba(16,185,129,0.1)] relative overflow-hidden">
                {/* Number Watermark */}
                <span className="absolute -top-10 -right-4 text-[120px] font-black text-slate-900/5 select-none pointer-events-none">{step.number}</span>

                <div
                  className={cn(
                    "h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 shadow-xl",
                    colorClasses[step.color] || 'bg-slate-900 text-white'
                  )}
                >
                  <step.icon className="h-8 w-8" />
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed italic">
                    {step.description}
                  </p>
                </div>

                <div className="pt-8 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500">
                  <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Step {index + 1}</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Global Action HUD */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 flex flex-col items-center justify-center text-center p-16 bg-slate-900 rounded-[3.5rem] relative overflow-hidden space-y-12"
        >
          {/* Background Gradient Artifacts */}
          <div className="absolute top-0 right-0 h-full w-1/2 bg-emerald-500/10 blur-[100px] pointer-events-none" />

          <div className="space-y-4">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.5em]">Ready when you are</span>
            <h3 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">Start shopping</h3>
          </div>

          <Link to="/products">
            <button className="h-20 px-16 bg-white text-slate-900 rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-emerald-400 transition-all shadow-3xl active:scale-95 group">
              Browse products
              <Zap className="h-5 w-5 text-emerald-500 group-hover:scale-125 transition-transform" />
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
