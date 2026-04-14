import { motion } from 'framer-motion';
import { Mail, Gift, Sparkles, ArrowRight, Zap, Target, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function NewsletterSection() {
  const { theme, isEditing, updateTheme } = useStore();
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState('');

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pattern.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setIsSubscribed(true);
    setTimeout(() => {
      setIsSubscribed(false);
      setEmail('');
    }, 3000);
  };

  return (
    <section className="relative py-32 overflow-hidden bg-slate-900">
      {/* Background Architectural Manifold */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1)_0%,transparent_70%)] opacity-40" />
        {/* Hidden on mobile to reduce visual noise */}
        <div className="hidden md:block absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Signal Connection Information */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-12"
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-[1px] w-12 bg-emerald-500" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Newsletter</span>
              </div>

              <h2 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase leading-none">
                <span
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  onBlur={handleTextChange('newsletterTitle')}
                  className="outline-none"
                >
                  {theme.newsletterTitle || 'Stay updated'}
                </span>
              </h2>

              <p
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={handleTextChange('newsletterSubtitle')}
                className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed outline-none border-l-4 border-emerald-500 pl-8"
              >
                {theme.newsletterSubtitle || "Subscribe for 20% off your first order and our best tips on fresh fruit."}
              </p>
            </div>

            {/* Benefits */}
            <div className="flex flex-col gap-6">
              {[
                { icon: ShieldCheck, title: 'Seasonal updates', desc: 'News on new arrivals and seasonal picks.' },
                { icon: Zap, title: 'Exclusive offers', desc: 'Special deals for subscribers.' },
                { icon: Target, title: 'Tips & recipes', desc: 'Ideas to get the most from your fruit.' },
              ].map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-6 group"
                >
                  <div className="h-12 w-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-xl">
                    <benefit.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{benefit.title}</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{benefit.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Acquisition Interface */}
          <div className="relative">
            {!isSubscribed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-12 space-y-10 shadow-3xl"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Subscribe</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Enter your email below</p>
                  {error && (
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{error}</p>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="relative group">
                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full h-20 pl-16 pr-8 bg-slate-950 border border-white/5 rounded-[1.75rem] text-[10px] font-black uppercase tracking-widest text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="w-full h-20 bg-emerald-500 text-slate-950 rounded-[1.75rem] text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-white transition-all shadow-2xl active:scale-95 group"
                  >
                    Subscribe
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
                  </motion.button>
                </form>

                <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">We respect your privacy</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Ready</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-emerald-500 rounded-[3.5rem] p-16 text-center space-y-8 shadow-[0_40px_100px_rgba(16,185,129,0.2)]"
              >
                <div className="h-24 w-24 bg-white/20 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
                  <Sparkles className="h-12 w-12 text-white animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-slate-950 uppercase tracking-tighter">You're in!</h3>
                  <p className="text-[11px] font-black text-slate-950/60 uppercase tracking-widest italic">Thanks for subscribing. Check your inbox for offers.</p>
                </div>
              </motion.div>
            )}

            {/* Abstract Visual Elements */}
            <div className="absolute -top-10 -right-10 h-64 w-64 bg-emerald-500/10 blur-[100px] pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}
