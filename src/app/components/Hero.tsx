import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, MapPin, Clock, Leaf, ShieldCheck,
  ChevronDown, Star, Zap, Truck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { useDeliverySlot } from '@/app/context/DeliveryContext';
import { PincodeSheet } from '@/app/components/PincodeSheet';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useProducts } from '@/app/hooks/useProducts';

/* Social proof avatar placeholders */
const AVATAR_PLACEHOLDERS = [
  { label: 'KP', bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { label: 'AP', bgClass: 'bg-sky-100 text-sky-700 border-sky-200' },
  { label: 'SS', bgClass: 'bg-violet-100 text-violet-700 border-violet-200' },
];

export function Hero() {
  const navigate = useNavigate();
  const { theme, orders } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pincodeSheetOpen, setPincodeSheetOpen] = useState(false);

  const { pincode, slot, isLoading: slotLoading, isServiceable } = useDeliverySlot();
  const { products, loading: productsLoading } = useProducts({ limit: 100 });
  const isLoading = slotLoading || productsLoading;

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 200], [1, 0]);

  const hasValidPincode = pincode && isServiceable === true && slot;

  const handlePrimaryAction = () => {
    if (!hasValidPincode) setPincodeSheetOpen(true);
    else navigate('/products');
  };

  const urgencyColor =
    !slot                           ? 'bg-emerald-600'
    : slot.cutoffSecondsLeft < 1800 ? 'bg-red-500'
    : slot.cutoffSecondsLeft < 3600 ? 'bg-amber-500'
    : 'bg-emerald-600';

  const stats = [
    { value: products.length > 0 ? `${products.length}+` : '50+', label: 'Varieties' },
    { value: '4.9★', label: 'Rating' },
  ];

  return (
    <>
      {/* ─── Hero: strict one-screen height ─── */}
      <div
        ref={containerRef}
        className="relative min-h-[100svh] lg:h-[100svh] flex items-center overflow-hidden bg-white pt-16 pb-12 sm:pt-20 sm:pb-16 lg:pt-20 lg:pb-0"
      >
        {/* Background */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Soft emerald gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_75%_30%,#d1fae5_0%,transparent_60%)]" />
          {/* Subtle dot grid */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center h-full">

            {/* ─── Left column ─── */}
            <div className="space-y-5 text-center lg:text-left">


              {/* 1. Delivery status pill */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="flex justify-center lg:justify-start"
              >
                {isLoading ? (
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium text-slate-500">Checking delivery…</span>
                  </div>
                ) : hasValidPincode ? (
                  <div className="inline-flex items-center gap-2 flex-wrap justify-center lg:justify-start">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-full text-xs font-semibold shadow-sm">
                      <Zap className="h-3 w-3 fill-white" />
                      {slot.etaLabel}
                    </span>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 text-white rounded-full text-xs font-semibold',
                      urgencyColor,
                      urgencyColor === 'bg-red-500' && 'animate-pulse',
                    )}>
                      <Clock className="h-3 w-3" />
                      {slot.cutoffDisplay} left
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setPincodeSheetOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-medium hover:bg-emerald-600 transition-colors group"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {isServiceable === false
                      ? 'Not serviceable — try another pincode'
                      : 'Enter pincode to check delivery'}
                    <ChevronDown className="h-3 w-3 group-hover:rotate-180 transition-transform" />
                  </button>
                )}
              </motion.div>

              {/* 2. Headline */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1 }}
              >
                <h1 className="text-[2.6rem] sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.08]">
                  {theme.heroTitle || 'Fresh from the farm'}
                  <br />
                  <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                    straight to you.
                  </span>
                </h1>
                <p className="mt-3 text-sm sm:text-base text-slate-500 max-w-md mx-auto lg:mx-0 leading-relaxed">
                  {hasValidPincode
                    ? `Serving pincode ${pincode} — order before the cutoff above and your fruits leave the farm today.`
                    : theme.heroSubtitle || 'Hand-picked, quality-checked fruits delivered at peak freshness. Enter your pincode to see your delivery slot.'}
                </p>
              </motion.div>

              {/* 3. CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-wrap gap-3 justify-center lg:justify-start"
              >
                <button
                  id="hero-primary-cta"
                  onClick={handlePrimaryAction}
                  className={cn(
                    'inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-[0.98] group',
                    hasValidPincode
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/25'
                      : 'bg-slate-900 text-white hover:bg-emerald-600 shadow-slate-900/10'
                  )}
                >
                  {hasValidPincode ? 'Shop fresh fruits' : 'Check delivery'}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {hasValidPincode ? (
                  <button
                    onClick={() => setPincodeSheetOpen(true)}
                    className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98]"
                  >
                    <MapPin className="h-4 w-4 text-emerald-500" />
                    {pincode}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/products')}
                    className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
                  >
                    Browse products
                  </button>
                )}
              </motion.div>

              {/* 4. Social proof + stats — single compact row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="pt-4 border-t border-slate-100 space-y-3"
              >
                {/* Avatars + rating */}
                <div className="flex items-center justify-center lg:justify-start gap-4">
                  <div className="flex items-center">
                    {AVATAR_PLACEHOLDERS.map((avatar, i) => (
                      <div
                        key={avatar.label}
                        aria-hidden="true"
                        className={cn(
                          'w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold shadow-sm',
                          avatar.bgClass,
                        )}
                        style={{ marginLeft: i > 0 ? '-8px' : 0 }}
                      >
                        {avatar.label}
                      </div>
                    ))}
                    <div
                      className="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center text-white text-[9px] font-bold shadow-sm"
                      style={{ marginLeft: '-8px' }}
                    >
                      +{Math.max(300, orders.length)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">4.9</span>
                    <span className="text-xs text-slate-400">· Trusted by 300+ customers</span>
                  </div>
                </div>

                {/* Quick features */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2">
                  {[
                    { icon: Leaf,       text: 'Farm-direct produce' },
                    { icon: Truck,      text: 'Same-day delivery' },
                    { icon: ShieldCheck,text: 'Freshness guarantee' },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs text-slate-500 font-medium">{text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* 5. Stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="flex items-center justify-center lg:justify-start gap-8"
              >
                {stats.map((s, i) => (
                  <div key={i}>
                    <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* ─── Right column: image ─── */}
            <div className="relative hidden lg:block">
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="relative rounded-3xl bg-slate-100 overflow-hidden shadow-2xl group"
                style={{ height: 'calc(100svh - 120px)', maxHeight: '580px' }}
              >
                <img
                  src={theme.heroImage || '/images/hero.jpeg'}
                  alt="Fresh farm fruits"
                  className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-[3000ms]"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />

                {/* Bottom overlay cards */}
                <div className="absolute bottom-4 left-4 right-4 space-y-2">
                  {!hasValidPincode && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPincodeSheetOpen(true)}
                      className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white/15 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-white/25 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                        <span className="text-xs font-medium">Check your delivery slot</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                    </motion.button>
                  )}

                  {/* Farm badge */}
                  <div className="flex items-center gap-3 px-3.5 py-2.5 bg-black/45 backdrop-blur-md rounded-xl border border-white/10">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                      <Leaf className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white leading-tight">
                        The Fruit Tribe Farm, Bihar
                      </p>

                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating badges */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 }}
                className="absolute -right-3 top-[20%] bg-white rounded-2xl shadow-lg border border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5"
              >
                <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Quality assured</p>
                  <p className="text-[10px] text-slate-400">Every order checked</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 }}
                className="absolute -left-3 bottom-[28%] bg-white rounded-2xl shadow-lg border border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5"
              >
                <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">4.9 / 5 rating</p>
                  <p className="text-[10px] text-slate-400">300+ happy customers</p>
                </div>
              </motion.div>

              {/* Glow effects */}
              <div className="absolute -top-6 -right-6 w-40 h-40 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-emerald-300/15 rounded-full blur-3xl pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Scroll cue — fades on scroll */}
        <motion.div
          style={{ opacity: heroOpacity }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        >
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown className="h-4 w-4 text-slate-300" />
          </motion.div>
        </motion.div>
      </div>

      <PincodeSheet
        isOpen={pincodeSheetOpen}
        onClose={() => setPincodeSheetOpen(false)}
        onConfirmed={() => setPincodeSheetOpen(false)}
      />
    </>
  );
}