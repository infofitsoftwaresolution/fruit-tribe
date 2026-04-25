import { useState, useMemo, useEffect, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
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
import { ServiceablePincodesHint } from '@/app/components/ServiceablePincodesHint';

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

  if (!cfg.enabled) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Active Subscription Banner ── */}
        {subscription && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-emerald-600 rounded-2xl p-6 text-white"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">Active member</span>
                  <span className="text-xs text-emerald-200">Since {new Date().getFullYear()}</span>
                </div>
                <h2 className="text-xl font-bold">{subscription.planName} plan</h2>
                <p className="text-sm text-emerald-100 mt-0.5">
                  Next delivery: <span className="font-semibold text-white">{subscription.nextDelivery}</span>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (subscription?.planName) {
                      const plan = plans.find(p => p.name === subscription.planName);
                      if (plan) { setSelectedPlan(plan.id); setIsCustomizing(true); }
                    }
                  }}
                  className="h-9 px-4 bg-white text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-50 transition-colors"
                >
                  Modify box
                </button>
                <button
                  onClick={() => {
                    if (!subscription) return;
                    setSubscription({ ...subscription, status: subscription.status === 'Paused' ? 'Active' : 'Paused' });
                    toast.info(subscription.status === 'Paused' ? 'Subscription resumed.' : 'Subscription paused.');
                  }}
                  className="h-9 px-4 bg-emerald-700/50 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 transition-colors"
                >
                  {subscription?.status === 'Paused' ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 mb-4">
            <Star className="w-3.5 h-3.5 fill-emerald-500" />
            <span className="text-xs font-semibold">{cfg.badgeLabel}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            {cfg.heroPrefix}{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              {cfg.heroGradientText}
            </span>
          </h1>
          <p className="text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
            {cfg.heroSubtitle}
          </p>
        </motion.div>

        {/* ── Plans Grid ── */}
        <div className={cn(
          'grid gap-6 mb-16',
          plans.length <= 1 && 'max-w-sm mx-auto',
          plans.length === 2 && 'sm:grid-cols-2',
          plans.length >= 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        )}>
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={cn(
                'relative bg-white rounded-2xl p-7 border transition-all',
                plan.popular
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-600 text-white rounded-full text-xs font-semibold shadow-sm">
                  Most popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-bold text-slate-900">Rs. {plan.price}</span>
                  <span className="text-sm text-slate-400 ml-1">/ {periodDisplaySuffix(plan.period)}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-7">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                    </div>
                    <span className="text-sm text-slate-600 leading-tight">{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectPlan(plan.id)}
                className={cn(
                  'w-full h-11 rounded-xl text-sm font-semibold transition-colors',
                  plan.popular
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                )}
              >
                Choose {plan.name}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* ── Benefits ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid sm:grid-cols-3 gap-5"
        >
          {cfg.benefits.map((benefit, idx) => {
            const Icon = BENEFIT_ICONS[benefit.icon] ?? Gift;
            const colorMap: Record<string, string> = {
              emerald: 'bg-emerald-50 text-emerald-600',
              blue: 'bg-blue-50 text-blue-600',
              purple: 'bg-purple-50 text-purple-600',
            };
            return (
              <div key={`${benefit.title}-${idx}`} className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-emerald-200 hover:shadow-sm transition-all">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', colorMap[benefit.color] ?? 'bg-slate-50 text-slate-500')}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{benefit.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{benefit.desc}</p>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* ── Customization Modal ── */}
      <AnimatePresence>
        {isCustomizing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
              onClick={() => setIsCustomizing(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative bg-white rounded-2xl p-6 md:p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left: fruit picker */}
                <div>
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">{cfg.customizeEyebrow}</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{cfg.customizeTitle}</h2>
                    <p className="text-sm text-slate-500 mt-1">{cfg.customizeSubtitle}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                    {fruits.map(fruit => (
                      <button
                        key={fruit.name}
                        type="button"
                        onClick={() => toggleFruit(fruit.name)}
                        className={cn(
                          'p-3 rounded-xl border-2 text-left transition-all h-20 flex flex-col justify-between',
                          customBox.includes(fruit.name)
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                            customBox.includes(fruit.name) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                          )}>
                            {fruit.category}
                          </span>
                          {customBox.includes(fruit.name) && <Heart className="w-3 h-3 text-emerald-500 fill-emerald-500" />}
                        </div>
                        <p className={cn('text-sm font-semibold', customBox.includes(fruit.name) ? 'text-emerald-800' : 'text-slate-700')}>
                          {fruit.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: options + address */}
                <div className="flex flex-col gap-5">
                  {/* Freshness score */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500">Freshness score</span>
                      <div className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-600">Certified Fresh</span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold text-slate-900">{freshnessScore}%</span>
                      <span className="text-xs text-slate-400">avg. box quality</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${freshnessScore}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Delivery day */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Delivery day</p>
                    <div className="flex flex-wrap gap-2">
                      {days.map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setDeliveryDay(day)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                            deliveryDay === day
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          )}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Delivery address
                    </p>
                    {user && savedAddresses.length > 0 && (
                      <select
                        value={selectedSavedAddressId}
                        onChange={(e) => handleSavedAddressPick(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">New address</option>
                        {savedAddresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {(a.label ? `${a.label} · ` : '') + a.name} — {a.city}
                            {a.isDefault ? ' (Default)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'firstName', placeholder: 'First name' },
                        { name: 'lastName', placeholder: 'Last name' },
                      ].map(f => (
                        <input key={f.name} name={f.name}
                          value={addressForm[f.name as keyof typeof addressForm]}
                          onChange={addressFieldChange} placeholder={f.placeholder}
                          className="h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                      ))}
                    </div>
                    {[
                      { name: 'email', type: 'email', placeholder: 'Email' },
                      { name: 'phone', type: 'text', placeholder: 'Phone' },
                      { name: 'address', type: 'text', placeholder: 'Street, building, landmark' },
                    ].map(f => (
                      <input key={f.name} name={f.name} type={f.type}
                        value={addressForm[f.name as keyof typeof addressForm]}
                        onChange={addressFieldChange} placeholder={f.placeholder}
                        className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'city', placeholder: 'City' },
                        { name: 'state', placeholder: 'State' },
                      ].map(f => (
                        <input key={f.name} name={f.name}
                          value={addressForm[f.name as keyof typeof addressForm]}
                          onChange={addressFieldChange} placeholder={f.placeholder}
                          className="h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                      ))}
                    </div>
                    <input name="zipCode" value={addressForm.zipCode}
                      onChange={addressFieldChange} placeholder="PIN code"
                      className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    {serviceablePincodes.length > 0 && (
                      <ServiceablePincodesHint pincodes={serviceablePincodes} variant="compact" />
                    )}
                    {user && !selectedSavedAddressId && (
                      <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600">
                        <input type="checkbox" checked={saveNewAddressToAccount}
                          onChange={(e) => setSaveNewAddressToAccount(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300" />
                        <span>Save address to my account</span>
                      </label>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSubscribe}
                    disabled={customBox.length === 0 || submitting}
                    className="w-full h-11 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 mt-auto"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                    ) : (
                      'Pay & confirm subscription'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
