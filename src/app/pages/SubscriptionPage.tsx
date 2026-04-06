import { useState, useMemo, useEffect, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Gift, Truck, Star, Calendar, Zap, Heart, ShieldCheck, Leaf, Loader2, MapPin, type LucideIcon } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { cn, getRoundedClass } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { mergeSubscriptionPageConfig } from '@/app/config/subscriptionPageConfig';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';
import {
  createSubscriptionOrder,
  createRazorpayOrder,
  verifyPayment,
  getOrders,
  getUserAddresses,
  createUserAddress,
} from '@/lib/api';
import {
  savedAddressToCheckoutForm,
  checkoutFormToCreateAddressBody,
  type SavedDeliveryAddress,
} from '@/lib/deliveryAddressUtils';
import { ensureRazorpayScript } from '@/lib/razorpayLoader';

const BENEFIT_ICONS: Record<string, LucideIcon> = {
  gift: Gift,
  truck: Truck,
  calendar: Calendar,
};

export function SubscriptionPage() {
  const { theme, setSubscription, subscription, preferences } = useStore();
  const { user } = useAuth();
  const { cities: serviceableCities, pincodes: serviceablePincodes, isCityServiceable, isPincodeServiceable } =
    useServiceableAreas();
  const cfg = useMemo(
    () => mergeSubscriptionPageConfig(preferences.subscriptionPage),
    [preferences.subscriptionPage],
  );
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customBox, setCustomBox] = useState<string[]>([]);
  const [deliveryDay, setDeliveryDay] = useState<string>(() => cfg.deliveryDays[0] ?? 'Monday');
  const [submitting, setSubmitting] = useState(false);
  const [addressForm, setAddressForm] = useState({
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: '',
    state: 'Karnataka',
    zipCode: '',
  });
  const [savedAddresses, setSavedAddresses] = useState<SavedDeliveryAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [saveNewAddressToAccount, setSaveNewAddressToAccount] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved_checkout_address');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        setAddressForm((prev) => ({ ...prev, ...parsed, state: parsed.state ?? prev.state ?? 'Karnataka' }));
        setSelectedSavedAddressId('');
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void ensureRazorpayScript();
  }, []);

  useEffect(() => {
    if (!user) return;
    setAddressForm((prev) => ({
      ...prev,
      firstName: prev.firstName || user.name?.split(' ')[0] || '',
      lastName: prev.lastName || user.name?.split(' ').slice(1).join(' ') || '',
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone || '',
      address: prev.address || user.address || '',
    }));
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await getUserAddresses();
        if (cancelled) return;
        setSavedAddresses(list);
        let skipAutoFill = false;
        try {
          skipAutoFill = !!localStorage.getItem('saved_checkout_address');
        } catch {
          /* ignore */
        }
        if (skipAutoFill || list.length === 0) return;
        const preferred = list.find((a) => a.isDefault) || list[0];
        if (!preferred) return;
        setAddressForm((prev) => ({
          ...prev,
          ...savedAddressToCheckoutForm(preferred, user.email || prev.email || ''),
        }));
        setSelectedSavedAddressId(preferred.id);
      } catch {
        if (!cancelled) setSavedAddresses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  useEffect(() => {
    const first = cfg.deliveryDays[0] ?? 'Monday';
    setDeliveryDay((d) => (cfg.deliveryDays.includes(d) ? d : first));
  }, [cfg.deliveryDays]);

  const plans = cfg.plans;
  const fruits = cfg.fruits;
  const days = cfg.deliveryDays;

  const freshnessScore = useMemo(() => {
    if (customBox.length === 0) return 0;
    const total = customBox.reduce((acc, name) => {
      const fruit = fruits.find(f => f.name === name);
      return acc + (fruit?.score || 0);
    }, 0);
    return Math.round(total / customBox.length);
  }, [customBox, fruits]);

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

  const addressFieldChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSelectedSavedAddressId('');
    setAddressForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSavedAddressPick = (id: string) => {
    if (!id) {
      setSelectedSavedAddressId('');
      setSaveNewAddressToAccount(false);
      return;
    }
    const row = savedAddresses.find((a) => a.id === id);
    if (!row || !user) return;
    setAddressForm((prev) => ({
      ...prev,
      ...savedAddressToCheckoutForm(row, user.email || prev.email || ''),
    }));
    setSelectedSavedAddressId(id);
    setSaveNewAddressToAccount(false);
  };

  const persistLocalSubscription = (
    plan: (typeof plans)[0],
    orderId: string,
    orderNumber: string,
    snapshot: typeof addressForm,
    savedCount: number,
    saveNew: boolean,
    usedSavedId: string,
  ) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7);
    setSubscription({
      id: `SUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      planName: plan.name,
      price: plan.price,
      frequency: plan.frequency,
      items: [...customBox],
      nextDelivery: nextDate.toISOString().split('T')[0],
      status: 'Active',
      customizations: [deliveryDay],
      orderId,
      orderNumber,
    });
    toast.success(`Welcome to the Tribe!`, {
      description: `Order ${orderNumber} · ${deliveryDay}. Freshness: ${freshnessScore}%`,
      icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
    });
    setIsCustomizing(false);
    try {
      localStorage.setItem('saved_checkout_address', JSON.stringify(snapshot));
    } catch {
      /* ignore */
    }
    if (user && saveNew && !usedSavedId) {
      void (async () => {
        try {
          await createUserAddress(
            checkoutFormToCreateAddressBody(
              {
                firstName: snapshot.firstName,
                lastName: snapshot.lastName,
                email: snapshot.email,
                phone: snapshot.phone,
                address: snapshot.address,
                city: snapshot.city,
                state: snapshot.state || 'Karnataka',
                zipCode: snapshot.zipCode,
              },
              { isDefault: savedCount === 0 },
            ),
          );
          toast.success('Address saved to your account');
        } catch {
          /* optional */
        }
      })();
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast.info('Please sign in to confirm your subscription.', {
        description: 'Log in and try again.',
      });
      window.location.hash = `#/login?next=/subscription`;
      return;
    }
    if (!selectedPlan) return;

    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan) return;

    if (customBox.length === 0) {
      toast.error('Pick at least one fruit for your box.');
      return;
    }

    const { firstName, lastName, email, phone, address, city, state, zipCode } = addressForm;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !address.trim() || !city.trim() || !zipCode.trim()) {
      toast.error('Please fill in your full delivery address.');
      return;
    }

    if (serviceableCities.length > 0 && !isCityServiceable(city)) {
      toast.error(`We do not deliver to "${city.trim()}".`);
      return;
    }
    if (serviceablePincodes.length > 0 && !isPincodeServiceable(zipCode)) {
      toast.error('This PIN code is not in our delivery area.');
      return;
    }

    const shippingAddress = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      zipCode: zipCode.trim().replace(/\D/g, '').slice(0, 6),
      state: (state || 'Karnataka').trim(),
    };

    setSubmitting(true);
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID ? `sub-${crypto.randomUUID()}` : `sub-${Date.now()}`;
    const addressSnapshot = { ...addressForm };

    try {
      const created = await createSubscriptionOrder({
        planId: plan.id,
        planName: plan.name,
        price: plan.price,
        frequency: plan.frequency,
        fruitSelection: customBox,
        deliveryDay,
        shippingAddress,
        idempotencyKey,
        savedAddressId: selectedSavedAddressId || undefined,
      });
      const orderId = String(created.id);
      const orderNumber = String(created.orderNumber || orderId);
      const payableAmount = Number((created as { payableAmount?: number }).payableAmount ?? plan.price);
      const amountInPaise = Math.round(payableAmount * 100);

      const openRazorpay = async () => {
        const [{ razorpayOrderId, keyId }] = await Promise.all([
          createRazorpayOrder(orderId, amountInPaise, 'INR'),
          ensureRazorpayScript(),
        ]);
        const Razorpay = (window as unknown as { Razorpay?: new (opts: object) => { open: () => void } }).Razorpay;
        if (!Razorpay) {
          toast.error('Payment could not be loaded. Your subscription is not active until payment succeeds.', {
            description: `Order ${orderNumber} — try again or pay from My Orders.`,
          });
          setIsCustomizing(false);
          return;
        }
        const rzp = new Razorpay({
          key: keyId,
          order_id: razorpayOrderId,
          currency: 'INR',
          name: 'The Fruit Tribe',
          description: `Subscription — ${plan.name}`,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await verifyPayment(orderId, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              persistLocalSubscription(
                plan,
                orderId,
                orderNumber,
                addressSnapshot,
                savedAddresses.length,
                saveNewAddressToAccount,
                selectedSavedAddressId,
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Verification failed';
              toast.error(msg + ' If money was debited, contact support with your order number.');
            }
          },
          modal: {
            ondismiss: () => {
              const delay = 2500;
              setTimeout(async () => {
                try {
                  const orders = await getOrders();
                  const o = orders.find(
                    (row: { id: string; paymentStatus?: string }) => String(row.id) === orderId,
                  );
                  if (o?.paymentStatus === 'PAID') {
                    persistLocalSubscription(
                      plan,
                      orderId,
                      orderNumber,
                      addressSnapshot,
                      savedAddresses.length,
                      saveNewAddressToAccount,
                      selectedSavedAddressId,
                    );
                    return;
                  }
                } catch {
                  /* ignore */
                }
                toast.info('Payment was not completed. Your subscription starts only after you pay.', {
                  description: `Order ${orderNumber}`,
                });
              }, delay);
            },
          },
        });
        rzp.open();
      };

      try {
        await openRazorpay();
      } catch (razorpayErr: unknown) {
        const msg = razorpayErr instanceof Error ? razorpayErr.message : '';
        if (msg.includes('Razorpay is not configured') || msg.includes('not configured')) {
          toast.error('Online payment is not set up yet. Your subscription was not activated.', {
            description: 'Ask the store to configure Razorpay, then try again.',
          });
        } else {
          toast.error(msg || 'Could not start payment. Try again from this page or pay from My Orders.', {
            description: `Order ${orderNumber}`,
          });
        }
        setIsCustomizing(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start subscription.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const periodDisplaySuffix = (period: string) =>
    period.includes(' ') ? period.split(' ').slice(1).join(' ') : period;

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
            <span className="text-[10px] font-black uppercase tracking-widest">{cfg.badgeLabel}</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter text-slate-900 leading-[0.9]">
            {cfg.heroPrefix} <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent italic">{cfg.heroGradientText}</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
            {cfg.heroSubtitle}
          </p>
        </motion.div>

        {/* Plans */}
        <div
          className={cn(
            'grid gap-8 mb-24',
            plans.length <= 1 && 'md:grid-cols-1 max-w-lg mx-auto',
            plans.length === 2 && 'md:grid-cols-2',
            plans.length >= 3 && 'md:grid-cols-2 lg:grid-cols-3',
          )}
        >
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
                  <span className="text-slate-400 font-bold text-sm uppercase ml-2 tracking-widest">/{periodDisplaySuffix(plan.period)}</span>
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
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{cfg.customizeEyebrow}</span>
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{cfg.customizeTitle}</h2>
                      <p className="text-slate-500 mt-2 font-medium">
                        {cfg.customizeSubtitle}
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

                      <div className="space-y-4 mb-8">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Delivery day</p>
                        <div className="flex flex-wrap gap-2">
                          {days.map(day => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setDeliveryDay(day)}
                              className={cn(
                                "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
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

                      <div className="space-y-3 mb-8">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5" />
                          Delivery address
                        </p>
                        {user && savedAddresses.length > 0 && (
                          <select
                            value={selectedSavedAddressId}
                            onChange={(e) => handleSavedAddressPick(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          >
                            <option value="">Enter a new address below</option>
                            {savedAddresses.map((a) => (
                              <option key={a.id} value={a.id}>
                                {(a.label ? `${a.label} · ` : '') + a.name} — {a.city}
                                {a.isDefault ? ' (Default)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            name="firstName"
                            value={addressForm.firstName}
                            onChange={addressFieldChange}
                            placeholder="First name"
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                          <input
                            name="lastName"
                            value={addressForm.lastName}
                            onChange={addressFieldChange}
                            placeholder="Last name"
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                        <input
                          name="email"
                          type="email"
                          value={addressForm.email}
                          onChange={addressFieldChange}
                          placeholder="Email"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <input
                          name="phone"
                          value={addressForm.phone}
                          onChange={addressFieldChange}
                          placeholder="Phone"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <input
                          name="address"
                          value={addressForm.address}
                          onChange={addressFieldChange}
                          placeholder="Street, building, landmark"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            name="city"
                            value={addressForm.city}
                            onChange={addressFieldChange}
                            placeholder="City"
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                          <input
                            name="state"
                            value={addressForm.state}
                            onChange={addressFieldChange}
                            placeholder="State"
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                        <input
                          name="zipCode"
                          value={addressForm.zipCode}
                          onChange={addressFieldChange}
                          placeholder="PIN code"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        {user && !selectedSavedAddressId && (
                          <label className="flex items-start gap-2 cursor-pointer text-[11px] font-bold text-slate-600">
                            <input
                              type="checkbox"
                              checked={saveNewAddressToAccount}
                              onChange={(e) => setSaveNewAddressToAccount(e.target.checked)}
                              className="mt-0.5 rounded border-slate-300"
                            />
                            <span>Save this address to my account for checkout and next subscription.</span>
                          </label>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSubscribe}
                      disabled={customBox.length === 0 || submitting}
                      className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-3xl shadow-emerald-600/20 inline-flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          Processing…
                        </>
                      ) : (
                        <>Pay &amp; confirm subscription</>
                      )}
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
          {cfg.benefits.map((benefit, idx) => {
            const Icon = BENEFIT_ICONS[benefit.icon] ?? Gift;
            return (
            <div key={`${benefit.title}-${idx}`} className="p-10 bg-white rounded-[3rem] border border-slate-100 hover:border-emerald-100 transition-all group">
              <div className={cn(
                "w-16 h-16 rounded-3xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110",
                benefit.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                  benefit.color === 'blue' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
              )}>
                <Icon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black mb-4 text-slate-900 uppercase tracking-tight">{benefit.title}</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">{benefit.desc}</p>
            </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
