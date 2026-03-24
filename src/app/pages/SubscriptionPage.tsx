import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Gift, Truck, Star, Calendar, Zap, Heart, ShieldCheck, Leaf } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { cn, getRoundedClass } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';

export function SubscriptionPage() {
  const { theme, setSubscription, subscription } = useStore();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customBox, setCustomBox] = useState<string[]>([]);
  const [deliveryDay, setDeliveryDay] = useState<string>('Monday');

  const fruits = [
    { name: 'Alphonso Mango', category: 'Premium', score: 98 },
    { name: 'Organic Strawberries', category: 'Berries', score: 95 },
    { name: 'Wild Blueberries', category: 'Berries', score: 92 },
    { name: 'Nagpur Oranges', category: 'Citrus', score: 94 },
    { name: 'Kashmiri Apples', category: 'Core', score: 90 },
    { name: 'Organic Watermelon', category: 'Hydration', score: 88 },
    { name: 'Golden Kiwi', category: 'Exotic', score: 96 },
    { name: 'Maui Pineapple', category: 'Tropical', score: 93 },
    { name: 'Emerald Grapes', category: 'Vines', score: 89 },
    { name: 'Ruby Pomegranate', category: 'Superfood', score: 97 }
  ];

  const days = ['Monday', 'Wednesday', 'Friday', 'Saturday'];

  const freshnessScore = useMemo(() => {
    if (customBox.length === 0) return 0;
    const total = customBox.reduce((acc, name) => {
      const fruit = fruits.find(f => f.name === name);
      return acc + (fruit?.score || 0);
    }, 0);
    return Math.round(total / customBox.length);
  }, [customBox]);

  const handleSelectPlan = (id: string) => {
    if (!user) {
      toast.info('Please sign in to start a subscription.', {
        description: 'You need an account so we can manage your deliveries.',
      });
      window.location.hash = `#/login?next=/subscription`;
      return;
    }
    setSelectedPlan(id);
    setIsCustomizing(true);
  };

  const toggleFruit = (fruit: string) => {
    setCustomBox(prev =>
      prev.includes(fruit) ? prev.filter(f => f !== fruit) : [...prev, fruit]
    );
  };

  const handleSubscribe = () => {
    if (!user) {
      toast.info('Please sign in to confirm your subscription.', {
        description: 'Log in and try again.',
      });
      window.location.hash = `#/login?next=/subscription`;
      return;
    }
    if (!selectedPlan) return;

    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan) return;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7);

    setSubscription({
      id: `SUB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      planName: plan.name,
      price: plan.price,
      frequency: plan.id === 'Weekly Box' ? 'Weekly' : 'Monthly',
      items: customBox,
      nextDelivery: nextDate.toISOString().split('T')[0],
      status: 'Active',
      customizations: [deliveryDay]
    });

    toast.success(`Welcome to the Tribe!`, {
      description: `Scheduled for next ${deliveryDay}. Freshness Score: ${freshnessScore}%`,
      icon: <Sparkles className="w-4 h-4 text-emerald-500" />
    });
    setIsCustomizing(false);
  };

  const plans = [
    {
      id: 'Weekly Box',
      name: 'Weekly Box',
      price: 499,
      period: 'per week',
      description: 'Perfect for individuals or small families',
      features: [
        '3-4kg of fresh fruits',
        'Weekly delivery',
        'Free shipping',
        'Customizable selection',
        'Mix of seasonal fruits',
      ],
      popular: false,
    },
    {
      id: 'Premium Tribe',
      name: 'Premium Tribe',
      price: 1499,
      period: 'per month',
      description: 'Great for regular fruit lovers',
      features: [
        '10-12kg of fresh fruits',
        'Choose delivery days',
        'Free priority shipping',
        'Cancel anytime',
        'Premium exotic selection',
        'Recipe cards included',
      ],
      popular: true,
    },
    {
      id: 'Family Feast',
      name: 'Family Feast',
      price: 2499,
      period: 'per month',
      description: 'Best value for large families',
      features: [
        '20-25kg of fresh fruits',
        'Bi-weekly delivery',
        'Free priority shipping',
        'Full custom control',
        'Premium & exotic fruits',
        'Dedicated account manager',
      ],
      popular: false,
    },
  ];

  return (
    <div className="pt-28 pb-16 min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Active Subscription HUD */}
        {subscription && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-16 p-8 bg-emerald-600 rounded-[3rem] text-white shadow-3xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Leaf className="w-64 h-64" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="px-3 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest">Active Member</div>
                  <span className="text-emerald-200 text-xs font-bold uppercase tracking-widest">Since {new Date().getFullYear()}</span>
                </div>
                <h2 className="text-4xl font-black tracking-tighter mb-2">The {subscription.planName}</h2>
                <p className="text-emerald-100 font-medium">Next Delivery: <span className="font-black underline decoration-2 underline-offset-4">{subscription.nextDelivery}</span></p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    // Re-open customization modal with current plan
                    if (subscription?.planName) {
                      const plan = plans.find(p => p.name === subscription.planName);
                      if (plan) {
                        setSelectedPlan(plan.id);
                        setIsCustomizing(true);
                      }
                    }
                  }}
                  className="px-6 py-3 bg-white text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-50 transition-all"
                >
                  Modify Box
                </button>
                <button
                  onClick={() => {
                    if (!subscription) return;
                    setSubscription({ ...subscription, status: subscription.status === 'Paused' ? 'Active' : 'Paused' });
                    toast.info(
                      subscription.status === 'Paused'
                        ? 'Subscription resumed.'
                        : 'Subscription paused. You can resume anytime from this page.'
                    );
                  }}
                  className="px-6 py-3 bg-emerald-700/50 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-800 transition-all"
                >
                  {subscription?.status === 'Paused' ? 'Resume Plan' : 'Pause Plan'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-full mb-6 border border-emerald-100">
            <Star className="w-4 h-4 fill-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-widest">Member Plans</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter text-slate-900 leading-[0.9]">
            Join the <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent italic">Fruit Tribe</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
            Get hand-picked fruits delivered to your home on your schedule.
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className={cn(
                "relative bg-white rounded-[3.5rem] p-12 shadow-3xl hover:shadow-4xl transition-all border border-slate-100",
                plan.popular && "ring-4 ring-emerald-500 scale-105 z-10"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-8 py-2 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/30">
                  Tribe Favorite
                </div>
              )}

              <div className="mb-10">
                <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-6">
                  <span className="text-2xl font-black text-slate-400">₹</span>
                  <span className="text-7xl font-black text-slate-900 tracking-tighter">
                    {plan.price}
                  </span>
                  <span className="text-slate-400 font-bold text-sm uppercase ml-2 tracking-widest">/{plan.period.split(' ')[1]}</span>
                </div>
              </div>

              <ul className="space-y-5 mb-12">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-4">
                    <div className="p-1.5 bg-emerald-50 rounded-xl shrink-0">
                      <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    </div>
                    <span className="text-slate-600 font-bold text-sm leading-tight">{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectPlan(plan.id)}
                className={cn(
                  "w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all",
                  plan.popular
                    ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-600/20 hover:bg-emerald-700'
                    : 'bg-slate-900 text-white hover:bg-black',
                  getRoundedClass(theme.buttonStyle)
                )}
              >
                Choose {plan.name}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Customization Modal */}
        <AnimatePresence>
          {isCustomizing && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
                onClick={() => setIsCustomizing(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 100 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 100 }}
                className="relative bg-white rounded-[4rem] p-10 md:p-14 max-w-4xl w-full shadow-6xl overflow-hidden border border-white/20"
              >
                <div className="grid md:grid-cols-2 gap-12">
                  <div>
                    <div className="mb-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-5 h-5 text-emerald-500 fill-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Customize</span>
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Customize Your Box</h2>
                      <p className="text-slate-500 mt-2 font-medium">
                        Select varieties to cycle in your weekly drop. Delivery days are scheduled for <span className="font-semibold underline">next week</span>, not the current week.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                      {fruits.map(fruit => (
                        <div
                          key={fruit.name}
                          onClick={() => toggleFruit(fruit.name)}
                          className={cn(
                            "p-5 rounded-3xl border-2 transition-all cursor-pointer group flex flex-col justify-between h-32",
                            customBox.includes(fruit.name)
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-50 hover:border-slate-200 bg-slate-50/50"
                          )}
                        >
                          <div className="flex justify-between items-start">
                            <span className={cn(
                              "text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest",
                              customBox.includes(fruit.name) ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                            )}>
                              {fruit.category}
                            </span>
                            {customBox.includes(fruit.name) && <Heart className="w-3 h-3 text-emerald-500 fill-emerald-500" />}
                          </div>
                          <p className={cn(
                            "text-[10px] font-black uppercase tracking-widest leading-tight",
                            customBox.includes(fruit.name) ? "text-emerald-900" : "text-slate-500"
                          )}>{fruit.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex-1">
                      <div className="bg-slate-50 rounded-3xl p-8 mb-8 border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quality Score</span>
                          <div className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-600">Certified Fresh</span>
                          </div>
                        </div>
                        <div className="flex items-end gap-4 mb-4">
                          <span className="text-6xl font-black text-slate-900 tracking-tighter leading-none">{freshnessScore}%</span>
                          <div className="flex flex-col mb-1">
                            <span className="text-[8px] font-black uppercase text-emerald-600">Freshness</span>
                            <span className="text-[8px] font-black uppercase text-slate-400">Score</span>
                          </div>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${freshnessScore}%` }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 mb-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Delivery</p>
                        <div className="flex gap-2">
                          {days.map(day => (
                            <button
                              key={day}
                              onClick={() => setDeliveryDay(day)}
                              className={cn(
                                "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all transition-all",
                                deliveryDay === day
                                  ? "bg-slate-900 text-white shadow-xl"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                              )}
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSubscribe}
                      disabled={customBox.length === 0}
                      className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-700 disabled:opacity-20 disabled:cursor-not-allowed shadow-3xl shadow-emerald-600/20"
                    >
                      Confirm Subscription
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Benefits Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-12"
        >
          {[
            {
              icon: Gift,
              title: 'Better Prices',
              desc: 'Save more with recurring deliveries and plan pricing.',
              color: 'emerald'
            },
            {
              icon: Truck,
              title: 'Farm to Home',
              desc: 'Fresh fruits delivered quickly from trusted sources.',
              color: 'blue'
            },
            {
              icon: Calendar,
              title: 'Flexible Schedule',
              desc: 'Pause, resume, or update deliveries anytime.',
              color: 'purple'
            }
          ].map((benefit, idx) => (
            <div key={idx} className="p-10 bg-white rounded-[3rem] border border-slate-100 hover:border-emerald-100 transition-all group">
              <div className={cn(
                "w-16 h-16 rounded-3xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110",
                benefit.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                  benefit.color === 'blue' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
              )}>
                <benefit.icon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black mb-4 text-slate-900 uppercase tracking-tight">{benefit.title}</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">{benefit.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
