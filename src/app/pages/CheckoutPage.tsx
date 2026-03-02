import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, User, Mail, Phone, Zap, Activity, Navigation, Globe, ShieldCheck, Loader2, CreditCard, Banknote } from 'lucide-react';
import { useStore, type CartItem } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';
import { useProducts } from '@/app/hooks/useProducts';
import { createOrder, createRazorpayOrder, validateCoupon, verifyPayment, getOrders, getWarehouses } from '@/lib/api';
import { cn, getRoundedClass } from '@/lib/utils';
import { toast } from 'sonner';

interface CheckoutPageProps {
  items: CartItem[];
}

const DEFAULT_WAREHOUSE_LAT = 22.5726;
const DEFAULT_WAREHOUSE_LNG = 88.3639;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function CheckoutPage({ items }: CheckoutPageProps) {
  const { products: storeProducts, taxRates, theme, preferences, clearCart } = useStore();
  const { products: productsFromApi } = useProducts({ limit: 500 });
  const products = productsFromApi.length > 0 ? productsFromApi : storeProducts;
  const codAllowedForCart = useMemo(() => {
    return items.every((item) => {
      const p = products.find((pr) => String(pr.id) === String(item.id));
      return (p as any)?.allowCashOnDelivery !== false;
    });
  }, [items, products]);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  useEffect(() => {
    if (!codAllowedForCart && paymentMethod === 'cod') setPaymentMethod('online');
  }, [codAllowedForCart, paymentMethod]);
  const { user } = useAuth();
  const { cities: serviceableCities, isCityServiceable } = useServiceableAreas();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountType: string; discountValue: number; maxDiscount?: number | null; minOrderValue?: number | null } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: '',
    zipCode: '',
  });

  const [deliveryStats, setDeliveryStats] = useState({
    distanceKm: 4.8,
    onTimeRate: 94,
    estimatedMins: 45,
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Array<{ latitude: number | string; longitude: number | string }>>([]);
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getWarehouses(true).then((list) => {
      setWarehouses(list.map((w) => ({ latitude: Number(w.latitude), longitude: Number(w.longitude) })));
    }).catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    const query = [formData.address, formData.city, formData.zipCode].filter(Boolean).join(', ');
    if (!query.trim()) {
      setMapCenter(null);
      setDeliveryStats({ distanceKm: 4.8, onTimeRate: 94, estimatedMins: 45 });
      return;
    }
    if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
    geocodeTimeoutRef.current = setTimeout(async () => {
      setGeocodeLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheFruitTribe-Checkout/1.0' } }
        );
        const data = await res.json();
        if (data && data[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setMapCenter({ lat, lng });
          const whList = warehouses.length > 0 ? warehouses : [{ latitude: DEFAULT_WAREHOUSE_LAT, longitude: DEFAULT_WAREHOUSE_LNG }];
          let minDistance = Infinity;
          for (const wh of whList) {
            const d = haversineKm(Number(wh.latitude), Number(wh.longitude), lat, lng);
            if (d < minDistance) minDistance = d;
          }
          const distanceKm = Math.round((minDistance === Infinity ? 4.8 : minDistance) * 10) / 10;
          const onTimeRate = Math.min(99, Math.max(85, 95 - Math.floor(distanceKm / 2)));
          const estimatedMins = Math.min(90, Math.max(25, 30 + Math.round(distanceKm * 4)));
          setDeliveryStats({ distanceKm, onTimeRate, estimatedMins });
        } else {
          setMapCenter(null);
        }
      } catch {
        setMapCenter(null);
      } finally {
        setGeocodeLoading(false);
      }
    }, 600);
    return () => {
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
    };
  }, [formData.address, formData.city, formData.zipCode, warehouses]);

  // Hyperlocal Logic (Mocked) - now driven by address
  const deliveryDistance = deliveryStats.distanceKm;
  const deliveryEfficiency = deliveryStats.onTimeRate;

  const groupedItems = useMemo(() => {
    return items.reduce((acc: Record<string, CartItem[]>, item: CartItem) => {
      const vendor = item.vendor || 'The Fruit Tribe';
      if (!acc[vendor]) acc[vendor] = [];
      acc[vendor].push(item);
      return acc;
    }, {});
  }, [items]);

  const vendorSummaries = useMemo(() => {
    const deliveryChargeTotal = Number(preferences.deliveryCharge) || 0;
    const entries = Object.entries(groupedItems);
    return entries.map(([vendor, vendorItems], i) => {
      const vSubtotal = vendorItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const vTax = vendorItems.reduce((totalTax, item) => {
        const product = products.find((p: any) => p.id === item.id);
        const rate = taxRates[product?.category || 'Fruits'] || 0;
        return totalTax + (item.price * item.quantity * (rate / 100));
      }, 0);
      const shipping = i === 0 ? deliveryChargeTotal : 0;
      return {
        vendor,
        items: vendorItems,
        subtotal: vSubtotal,
        shipping,
        tax: vTax,
        total: vSubtotal + vTax + shipping,
      };
    });
  }, [groupedItems, products, taxRates, preferences.deliveryCharge]);

  const subtotalOnly = vendorSummaries.reduce((sum, s) => sum + s.subtotal, 0);
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.minOrderValue != null && subtotalOnly < appliedCoupon.minOrderValue) return 0;
    if (appliedCoupon.discountType === 'PERCENTAGE') {
      let d = (subtotalOnly * appliedCoupon.discountValue) / 100;
      if (appliedCoupon.maxDiscount != null) d = Math.min(d, appliedCoupon.maxDiscount);
      return d;
    }
    return appliedCoupon.discountValue;
  }, [appliedCoupon, subtotalOnly]);

  const grandTotal = Math.max(0, vendorSummaries.reduce((sum, s) => sum + s.total, 0) - discountAmount);

  const handleApplyPromo = async () => {
    const code = promoCode.trim();
    if (!code) {
      toast.error('Enter a promo code');
      return;
    }
    setApplyingPromo(true);
    try {
      const result = await validateCoupon(code);
      if (result.valid && result.discountType != null && result.discountValue != null) {
        setAppliedCoupon({
          code,
          discountType: result.discountType,
          discountValue: result.discountValue,
          maxDiscount: result.maxDiscount ?? undefined,
          minOrderValue: result.minOrderValue ?? undefined,
        });
        toast.success('Promo code applied');
      } else {
        toast.error(result.message || 'Invalid promo code');
        setAppliedCoupon(null);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not validate promo code');
      setAppliedCoupon(null);
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to place an order', { description: 'Your order will be saved to your account.' });
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    if (serviceableCities.length > 0 && formData.city?.trim() && !isCityServiceable(formData.city)) {
      toast.error('We don\'t deliver to this city yet.', {
        description: `We currently deliver only to: ${serviceableCities.join(', ')}. Please use an address in one of these cities.`,
      });
      return;
    }

    const orderItems: Array<{ productId: string; variantId: string; sellerId: string; quantity: number; pricePerUnit: number }> = [];
    const uuidLike = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s).trim());
    for (const item of items) {
      const product = products.find((p: any) => p.id === item.id || String(p.id) === String(item.id));
      if (!product) {
        toast.error(`Product "${item.name}" is no longer available. Please update your cart.`);
        return;
      }
      const variantId = (product as any).variants?.[0]?.id != null ? String((product as any).variants[0].id) : '';
      const sellerId = (product as any).sellerId != null ? String((product as any).sellerId) : '';
      if (!variantId || !sellerId) {
        toast.error(`Unable to place order: missing details for "${item.name}". Please refresh and try again.`);
        return;
      }
      const productId = String(product.id);
      if (!uuidLike(productId) || !uuidLike(variantId) || !uuidLike(sellerId)) {
        toast.error('Product data is still loading or invalid. Please refresh the page and try again.');
        return;
      }
      orderItems.push({
        productId,
        variantId,
        sellerId,
        quantity: Number(item.quantity) || 1,
        pricePerUnit: Number(item.price) ?? 0,
      });
    }

    const shippingAddress = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      zipCode: formData.zipCode,
      state: formData.zipCode ? 'State' : '',
    };

    setSubmitting(true);
    try {
      const created = await createOrder({
        items: orderItems,
        shippingAddress,
        billingAddress: shippingAddress,
        couponCode: appliedCoupon?.code || undefined,
      });
      const orderId = created.id as string;
      const orderNumber = (created.orderNumber as string) || orderId;
      const payableAmount = Number((created as any).payableAmount ?? grandTotal);
      const amountInPaise = Math.round(payableAmount * 100);

      if (paymentMethod === 'cod') {
        clearCart();
        toast.success('Order placed. Pay when you receive.', {
          description: `Order #${orderNumber} — Cash on Delivery`,
          icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
        });
        navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
        setSubmitting(false);
        return;
      }

      try {
        const { razorpayOrderId, keyId } = await createRazorpayOrder(orderId, amountInPaise, 'INR');
        await loadRazorpayScript();
        const Razorpay = (window as any).Razorpay;
        if (!Razorpay) {
          toast.success('Order placed. Payment gateway could not be loaded; pay from My Orders.', {
            description: `Order #${orderNumber}`,
            icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
          });
          clearCart();
          navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
          return;
        }
        const rzp = new Razorpay({
          key: keyId,
          order_id: razorpayOrderId,
          currency: 'INR',
          name: 'The Fruit Tribe',
          description: `Order ${orderNumber}`,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await verifyPayment(orderId, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              clearCart();
              toast.success('Order placed and payment successful.', {
                description: `Order #${orderNumber}`,
                icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
              });
              navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
            } catch (err: any) {
              toast.error(err?.message || 'Payment verification failed. Order is placed; contact support with your order number.');
              navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
            }
          },
          modal: {
            ondismiss: () => {
              // Fallback: Razorpay SDK may log "Refused to get unsafe header x-rtb-fingerprint-id" and
              // in some environments the success handler might not run. Check backend for payment status.
              const PAYMENT_POLL_DELAY_MS = 2500;
              setTimeout(async () => {
                try {
                  const orders = await getOrders();
                  const order = orders.find((o: { id: string; paymentStatus?: string }) => String(o.id) === String(orderId));
                  if (order?.paymentStatus === 'PAID') {
                    clearCart();
                    toast.success('Order placed and payment successful.', {
                      description: `Order #${orderNumber}`,
                      icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
                    });
                    navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
                    return;
                  }
                } catch {
                  /* ignore */
                }
                toast.info('Payment cancelled. Order placed; you can pay from My Orders.', {
                  description: `Order #${orderNumber}`,
                });
                navigate('/profile', { state: { highlightOrders: true } });
              }, PAYMENT_POLL_DELAY_MS);
            },
          },
        });
        rzp.open();
      } catch (razorpayErr: any) {
        const msg = razorpayErr?.message || '';
        if (msg.includes('Razorpay is not configured') || msg.includes('not configured')) {
          toast.success('Order placed. Razorpay is not set up; pay later from My Orders.', {
            description: `Order #${orderNumber}`,
            icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
          });
          clearCart();
        } else {
          toast.warning('Order placed. Payment step failed: ' + (msg || 'Unknown error'), {
            description: `Order #${orderNumber}. You can pay from My Orders.`,
          });
        }
        navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  function loadRazorpayScript(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      // Do not set crossOrigin: Razorpay's script reads response headers that browsers forbid to JS
      // (e.g. x-rtb-fingerprint-id), causing "Refused to get unsafe header". Loading without
      // crossOrigin can reduce CORS-related behavior that triggers that path.
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.body.appendChild(script);
    });
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Redirect to cart when empty (avoid setState during render)
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items.length, navigate]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="pt-28 pb-16 min-h-screen bg-slate-50 selection:bg-orange-500 selection:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Delivery info */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center gap-6">
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery area</p>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{deliveryDistance} km</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center gap-6">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">On-time rate</p>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{deliveryEfficiency}%</p>
            </div>
          </div>
          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-2xl flex items-center gap-6 relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <Globe className="w-20 h-20" />
            </div>
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Est. delivery</p>
              <p className="text-2xl font-black text-white tracking-tighter">~{deliveryStats.estimatedMins} Mins</p>
            </div>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-12 gap-10">
            {/* Left Column - Forms */}
            <div className="lg:col-span-8 space-y-10">
              {/* Shipping Information */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Delivery address</h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Street address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      required
                      placeholder="Street address"
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Bangalore"
                      className={cn(
                        "w-full px-6 py-4 rounded-2xl border-2 bg-slate-50 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400",
                        formData.city?.trim() && serviceableCities.length > 0 && !isCityServiceable(formData.city)
                          ? "border-amber-400 focus:border-amber-500"
                          : "border-slate-200 focus:border-orange-500"
                      )}
                    />
                    {serviceableCities.length > 0 && (
                      <p className="text-[10px] font-bold text-slate-500 pl-4 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-emerald-500" />
                        We currently deliver to: {serviceableCities.join(', ')}
                      </p>
                    )}
                    {formData.city?.trim() && serviceableCities.length > 0 && !isCityServiceable(formData.city) && (
                      <p className="text-xs text-amber-600 pl-4 font-bold">This city is not in our delivery area yet.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">ZIP / Postal code</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      required
                      placeholder="e.g. 700001"
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Map: shown when address is geocoded */}
                <div className="mt-8">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4 mb-3">Delivery location</p>
                  {geocodeLoading && (
                    <div className="h-48 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                      <span className="text-sm font-medium text-slate-500">Detecting location…</span>
                    </div>
                  )}
                  {!geocodeLoading && mapCenter && (
                    <div className="rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner">
                      <iframe
                        title="Delivery area map"
                        src={`https://www.openstreetmap.org/export/embed.html?center=${mapCenter.lat},${mapCenter.lng}&zoom=14&marker=${mapCenter.lat},${mapCenter.lng}`}
                        className="w-full h-56 sm:h-64 border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-2 pl-1">
                        Pin shows your delivery address. Delivery area, on-time rate and ETA above update from this address.
                      </p>
                    </div>
                  )}
                  {!geocodeLoading && !mapCenter && (formData.address || formData.city || formData.zipCode) && (
                    <div className="h-32 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center">
                      <span className="text-sm text-slate-500">Enter street, city and PIN for map and delivery estimate</span>
                    </div>
                  )}
                  {!mapCenter && !formData.address && !formData.city && !formData.zipCode && (
                    <div className="h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center">
                      <span className="text-sm text-slate-400">Map will appear when you enter your address</span>
                    </div>
                  )}
                </div>
              </motion.div>

            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-4">
              <div className="sticky top-28 space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16" />

                  <h2 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tight">Order summary</h2>

                  <div className="space-y-8 mb-10 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {vendorSummaries.map((summary) => (
                      <div key={summary.vendor} className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                          <div className="px-2 py-0.5 bg-slate-900 text-emerald-400 text-[8px] font-black rounded uppercase">
                            {summary.vendor}
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order summary</span>
                        </div>
                        <div className="space-y-3">
                          {summary.items.map((item: CartItem) => (
                            <div key={item.id} className="flex gap-4">
                              <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden shrink-0 border border-slate-100 p-1">
                                <img src={item.image} className="w-full h-full object-cover rounded-lg" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">{item.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{item.quantity} UNITS @ ₹{item.price}</p>
                              </div>
                              <p className="text-xs font-black text-slate-900">₹{item.price * item.quantity}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-8 border-t-2 border-dotted border-slate-100">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Base Subtotal</span>
                      <span className="text-slate-900">₹{vendorSummaries.reduce((sum, s) => sum + s.subtotal, 0)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Shipping</span>
                      <span className="text-emerald-500">
                        {vendorSummaries.reduce((sum, s) => sum + s.shipping, 0) === 0 ? 'Free' : `₹${vendorSummaries.reduce((sum, s) => sum + s.shipping, 0)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Tax</span>
                      <span className="text-slate-900">₹{vendorSummaries.reduce((sum, s) => sum + s.tax, 0).toFixed(2)}</span>
                    </div>

                    {/* Promo code */}
                    <div className="pt-4 space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Promo code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          placeholder="e.g. SAVE10"
                          className="flex-1 h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium uppercase"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={applyingPromo || !promoCode.trim()}
                          className="h-12 px-5 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {applyingPromo ? '…' : 'Apply'}
                        </button>
                      </div>
                      {appliedCoupon && (
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          {appliedCoupon.code} applied — ₹{discountAmount.toFixed(2)} off
                        </p>
                      )}
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        <span>Discount</span>
                        <span>-₹{discountAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="pt-6 mt-6 border-t border-slate-100">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Total</span>
                        <div className="text-right">
                          <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">₹{grandTotal.toFixed(2)}</p>
                          <p className="text-[8px] font-black text-orange-500 uppercase mt-1">Split across sellers</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment method */}
                    <div className="pt-6 mt-6 border-t border-slate-100 space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Payment method</p>
                      <div className={cn('grid gap-4', codAllowedForCart ? 'grid-cols-2' : 'grid-cols-1')}>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('online')}
                          className={cn(
                            'p-4 rounded-2xl border-2 flex items-center gap-3 transition-all text-left',
                            paymentMethod === 'online'
                              ? 'border-emerald-500 bg-emerald-50 text-slate-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          )}
                        >
                          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-black text-sm uppercase tracking-tight">Pay online</p>
                            <p className="text-[10px] text-slate-500">Card, UPI, Net banking</p>
                          </div>
                        </button>
                        {codAllowedForCart ? (
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('cod')}
                            className={cn(
                              'p-4 rounded-2xl border-2 flex items-center gap-3 transition-all text-left',
                              paymentMethod === 'cod'
                                ? 'border-emerald-500 bg-emerald-50 text-slate-900'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            )}
                          >
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                              <Banknote className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-black text-sm uppercase tracking-tight">Cash on delivery</p>
                              <p className="text-[10px] text-slate-500">Pay when you receive</p>
                            </div>
                          </button>
                        ) : (
                          <div className="p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 flex items-center gap-3 text-left opacity-80">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center">
                              <Banknote className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-black text-sm uppercase tracking-tight text-slate-400">Cash on delivery</p>
                              <p className="text-[10px] text-slate-400">Not available — some items in your cart do not allow COD</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileHover={{ scale: submitting ? 1 : 1.02 }}
                    whileTap={{ scale: submitting ? 1 : 0.98 }}
                    className={cn(
                      "w-full py-6 mt-10 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.3em] shadow-3xl hover:bg-black transition-all flex items-center justify-center gap-2",
                      submitting && "opacity-70 cursor-wait",
                      getRoundedClass(theme.buttonStyle)
                    )}
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    {submitting ? 'Placing order…' : 'Place order'}
                  </motion.button>
                </motion.div>

                <div className="p-6 bg-orange-50 rounded-[2rem] border border-orange-100 flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-orange-50 bg-slate-200 overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?img=${i + 10}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest leading-tight">
                    3 customers in your area just received their orders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
