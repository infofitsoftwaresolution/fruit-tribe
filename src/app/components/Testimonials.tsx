import { motion } from 'framer-motion';
import { Star, Quote, ShieldCheck, Zap, Activity, Users } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function Testimonials() {
  const { theme, isEditing, updateTheme } = useStore();
  const [activeIndex, setActiveIndex] = useState(0);

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Regular customer',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      rating: 5,
      text: 'The quality and freshness at The Fruit Tribe are outstanding. A must for our family.',
    },
    {
      name: 'Michael Chen',
      role: 'Subscriber',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      rating: 5,
      text: 'Delivery is fast and fruit stays fresh. Really happy with the service.',
    },
    {
      name: 'Emily Rodriguez',
      role: 'Customer',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      rating: 5,
      text: 'Subscription makes it easy to keep healthy fruit in the house. No more last-minute runs.',
    },
    {
      name: 'David Kim',
      role: 'Food lover',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      rating: 5,
      text: 'The variety is amazing. I find fruits here I can’t get at the regular store.',
    },
  ];

  return (
    <section className="relative py-32 bg-slate-50 overflow-hidden">
      {/* Background Architectural Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-100" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Section header */}
        <div className="max-w-3xl mb-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-[1px] w-12 bg-emerald-500" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">What customers say</span>
          </div>

          <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-8">
            <span
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleTextChange('testimonialsTitle')}
              className="outline-none"
            >
              {theme.testimonialsTitle || 'Reviews'}
            </span>
          </h2>

          <p
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={handleTextChange('testimonialsSubtitle')}
            className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed outline-none"
          >
            {theme.testimonialsSubtitle || "Real feedback from people who shop with us."}
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-24">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="group relative bg-white rounded-[3rem] p-12 border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-3xl hover:border-emerald-500 transition-all duration-700"
            >
              <div className="absolute top-12 right-12 text-slate-100 group-hover:text-emerald-500/10 transition-colors">
                <Quote className="h-16 w-16" />
              </div>

              <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-emerald-500 text-emerald-500" />
                  ))}
                </div>

                <p className="text-lg md:text-xl text-slate-900 font-bold uppercase tracking-tight italic leading-relaxed">
                  "{testimonial.text}"
                </p>

                <div className="flex items-center gap-6 pt-8 border-t border-slate-50">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-16 w-16 rounded-2xl object-cover shadow-xl border-4 border-slate-50"
                  />
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{testimonial.name}</h4>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mt-1">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Community strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-12 bg-slate-900 rounded-[3.5rem] flex flex-col md:flex-row items-center justify-between gap-10 border border-white/5 shadow-3xl overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />

          <div className="flex items-center gap-8 relative z-10">
            <div className="flex -space-x-4">
              {testimonials.map((t, i) => (
                <img
                  key={i}
                  src={t.image}
                  className="h-12 w-12 rounded-full border-4 border-slate-900 object-cover shadow-2xl"
                  alt={`Customer ${i}`}
                />
              ))}
              <div className="h-12 w-12 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-2xl">
                +50K
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-black text-white uppercase tracking-tighter">Happy customers</h4>
              <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest italic">Join thousands who get fresh fruit delivered.</p>
            </div>
          </div>

          <div className="flex items-center gap-6 relative z-10">
            <div className="text-right">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Status</p>
              <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Always delivering</p>
            </div>
            <div className="h-12 w-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-3xl">
              <Activity className="h-6 w-6" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
