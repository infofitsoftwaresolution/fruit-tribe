import { motion } from 'framer-motion';
import { MousePointerClick, ShieldCheck, Truck, Apple } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function HowItWorks() {
  const { theme } = useStore();

  const steps = [
    {
      icon: MousePointerClick,
      title: 'Choose products',
      description: 'Browse our range of fresh fruits and add what you need to your cart.',
      number: '01',
      color: 'bg-emerald-500',
    },
    {
      icon: ShieldCheck,
      title: 'Quality checked',
      description: 'Every item is inspected for freshness and quality before packing.',
      number: '02',
      color: 'bg-blue-500',
    },
    {
      icon: Truck,
      title: 'Fast delivery',
      description: 'We deliver to your door quickly so your fruit arrives fresh.',
      number: '03',
      color: 'bg-violet-500',
    },
    {
      icon: Apple,
      title: 'Enjoy freshness',
      description: 'Unpack and enjoy fresh, nutritious fruit at home or at work.',
      number: '04',
      color: 'bg-amber-500',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            {theme.howItWorksTitle || 'Simple steps to fresh fruit'}
          </h2>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            {theme.howItWorksSubtitle || 'From our farm to your table in a few easy steps.'}
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="relative group"
            >
              <div className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all duration-300 h-full">
                {/* Step number watermark */}
                <span className="absolute top-4 right-5 text-6xl font-black text-slate-900/[0.04] select-none pointer-events-none">
                  {step.number}
                </span>

                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-5 text-white shadow-sm', step.color)}>
                  <step.icon className="w-5 h-5" />
                </div>

                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {step.description}
                </p>

                {/* Connector line (desktop) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-11 left-full w-6 h-px bg-slate-200 z-10" />
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Simple CTA */}
        <div className="mt-12 flex items-center gap-4">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 h-11 px-6 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            Start shopping
          </Link>
          <Link
            to="/about"
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Learn about us →
          </Link>
        </div>
      </div>
    </section>
  );
}
