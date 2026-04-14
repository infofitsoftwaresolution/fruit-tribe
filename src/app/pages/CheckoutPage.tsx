import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, User, Mail, Phone, Zap, Activity, Navigation, Globe, ShieldCheck, Loader2, CreditCard, Banknote, Minus, Plus, Trash2, ChevronRight, Info, FileText } from 'lucide-react';
import { useStore, type CartItem } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';
import { useProducts } from '@/app/hooks/useProducts';
import { SwipeToPay } from '@/app/components/SwipeToPay';
import {
  createOrder,
  createRazorpayOrder,
  validateCoupon,
  verifyPayment,
  getOrders,
  getWarehouses,
  getAvailableOffers,
  getUserAddresses,
  createUserAddress,
  type AvailableOffer,
} from '@/lib/api';
import {
  savedAddressToCheckoutForm,
  checkoutFormToCreateAddressBody,
  type SavedDeliveryAddress,
} from '@/lib/deliveryAddressUtils';
import { cn, getRoundedClass, motionTapTransition } from '@/lib/utils';
import { ensureRazorpayScript } from '@/lib/razorpayLoader';
import { computeDeliveryFeeByDistanceKm } from '@/lib/deliveryFeeUtils';
import { toast } from 'sonner';
import { buildOpenStreetMapEmbedSrc, OpenStreetMapEmbed } from '@/app/components/OpenStreetMapEmbed';
import { ServiceablePincodesHint } from '@/app/components/ServiceablePincodesHint';

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
  const { products: storeProducts, taxRates, theme, preferences, clearCart, handleUpdateQuantity, handleRemoveItem } = useStore();
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

  useEffect(() => {
    if (paymentMethod !== 'online') return;
    void ensureRazorpayScript();
  }, [paymentMethod]);
  const { user } = useAuth();
  const { cities: serviceableCities, pincodes: serviceablePincodes, isCityServiceable, isPincodeServiceable } =
    useServiceableAreas();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountType: string; discountValue: number; maxDiscount?: number | null; minOrderValue?: number | null } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [availableOffers, setAvailableOffers] = useState<AvailableOffer[]>([]);
  const [deliverySlot, setDeliverySlot] = useState<string>('');
  const [formData, setFormData] = useState({
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

  const [deliveryStats, setDeliveryStats] = useState({
    distanceKm: 4.8,
    onTimeRate: 94,
    estimatedMins: 45,
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const checkoutMapEmbedSrc = useMemo(
    () => (mapCenter ? buildOpenStreetMapEmbedSrc([{ lat: mapCenter.lat, lng: mapCenter.lng }]) : null),
    [mapCenter]
  );
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Array<{ latitude: number | string; longitude: number | string }>>([]);
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Hydrate last-used address from this device
    try {
      const saved = localStorage.getItem('saved_checkout_address');
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({
          ...prev,
          ...parsed,
          state: parsed.state ?? prev.state ?? 'Karnataka',
        }));
        setSelectedSavedAddressId('');
      }
    } catch {
      // ignore
    }
  }, []);

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
        setFormData((prev) => ({
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
    getWarehouses(true).then((list) => {
      setWarehouses(list.map((w) => ({ latitude: Number(w.latitude), longitude: Number(w.longitude) })));
    }).catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    const cartProductIds = items.map((i) => String(i.id));
    const cartCategoryNames = items
      .map((item) => products.find((p) => String(p.id) === String(item.id))?.category)
      .filter((name): name is string => !!name);
    getAvailableOffers({ cartProductIds, cartCategoryNames }).then(setAvailableOffers).catch(() => setAvailableOffers([]));
  }, [items, products]);

  const updateDeliveryFromCoordinates = (lat: number, lng: number) => {
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
  };

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
          updateDeliveryFromCoordinates(lat, lng);
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

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Location not supported on this device', {
        description: 'Please enter your address manually.',
      });
      return;
    }
    setGeocodeLoading(true);
    const PERMISSION_DENIED = 1;
    const POSITION_UNAVAILABLE = 2;
    const TIMEOUT = 3;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          updateDeliveryFromCoordinates(latitude, longitude);
          toast.success('Location detected', {
            description: 'Distance and delivery time updated from your location.',
            icon: <MapPin className="w-4 h-4 text-emerald-500" />,
          });
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
              { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheFruitTribe-Checkout/1.0' } }
            );
            const data = await res.json();
            const city =
              data?.address?.city ||
              data?.address?.town ||
              data?.address?.village ||
              data?.address?.state_district ||
              formData.city;
            const postcode = data?.address?.postcode || formData.zipCode;
            const road = data?.address?.road || '';
            const houseNumber = data?.address?.house_number || '';
            const displayAddress = data?.display_name || formData.address;
            setFormData((prev) => ({
              ...prev,
              address: displayAddress || `${houseNumber} ${road}`.trim() || prev.address,
              city,
              zipCode: postcode || prev.zipCode,
            }));
          } catch {
            // ignore reverse geocode failure; we already updated map + stats
          }
        } finally {
          setGeocodeLoading(false);
        }
      },
      (error) => {
        setGeocodeLoading(false);
        const code = error?.code ?? 0;
        if (code === PERMISSION_DENIED) {
          toast.error('Location permission denied', {
            description: 'Allow location in browser settings or enter your address manually below.',
          });
        } else if (code === TIMEOUT) {
          toast.error('Location request timed out', {
            description: 'Your device took too long to get a fix. Try again or enter your address manually.',
          });
        } else if (code === POSITION_UNAVAILABLE) {
          toast.error('Location unavailable', {
            description: 'Your device could not determine position. Enter your address manually below.',
          });
        } else {
          toast.error('Could not detect your current location', {
            description: 'Try again or enter your address manually below.',
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  // Hyperlocal Logic (Mocked) - now driven by address
  const deliveryDistance = deliveryStats.distanceKm;
  const deliveryEfficiency = deliveryStats.onTimeRate;
  const etaMin = Math.max(20, Math.round(deliveryStats.estimatedMins * 0.8));
  const etaMax = Math.max(etaMin + 10, Math.round(deliveryStats.estimatedMins * 1.2));
  const etaLabel = `${etaMin}-${etaMax} mins`;

  const groupedItems = useMemo(() => {
    return items.reduce((acc: Record<string, CartItem[]>, item: CartItem) => {
      const vendor = item.vendor || 'The Fruit Tribe';
      if (!acc[vendor]) acc[vendor] = [];
      acc[vendor].push(item);
      return acc;
    }, {});
  }, [items]);

  const subtotalOnly = useMemo(() => {
    return items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
  }, [items]);

  const shippingFeeForDistance = useMemo(() => {
    const fallbackDeliveryCharge = Number(preferences.deliveryCharge) || 0;
    const rules = preferences.deliveryFeeRules || [];
    const mode = preferences.deliveryFeeMode || 'SLAB';
    const perKmRate = Number(preferences.deliveryPerKmRate) || 0;
    return computeDeliveryFeeByDistanceKm(
      deliveryDistance,
      rules,
      fallbackDeliveryCharge,
      mode,
      perKmRate,
      subtotalOnly,
      Number(preferences.freeDeliveryThreshold) || 0,
    );
  }, [
    deliveryDistance,
    subtotalOnly,
    preferences.deliveryCharge,
    preferences.deliveryFeeRules,
    preferences.deliveryFeeMode,
    preferences.deliveryPerKmRate,
    preferences.freeDeliveryThreshold,
  ]);

  const vendorSummaries = useMemo(() => {
    const entries = Object.entries(groupedItems);
    return entries.map(([vendor, vendorItems], i) => {
      const vSubtotal = vendorItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const vTax = vendorItems.reduce((totalTax, item) => {
        const product = products.find((p: any) => p.id === item.id);
        const rate = taxRates[product?.category || 'Fruits'] || 0;
        return totalTax + (item.price * item.quantity * (rate / 100));
      }, 0);
      const shipping = i === 0 ? shippingFeeForDistance : 0;
      return {
        vendor,
        items: vendorItems,
        subtotal: vSubtotal,
        shipping,
        tax: vTax,
        total: vSubtotal + vTax + shipping,
      };
    });
  }, [groupedItems, products, taxRates, shippingFeeForDistance]);

  const totalTax = useMemo(() => {
    return vendorSummaries.reduce((sum: number, s: any) => sum + s.tax, 0);
  }, [vendorSummaries]);

  const totalShipping = useMemo(() => {
    return vendorSummaries.reduce((sum: number, s: any) => sum + s.shipping, 0);
  }, [vendorSummaries]);
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

  const platformFee = Number(preferences.platformFee) || 0;
  const grandTotal = Math.max(0, vendorSummaries.reduce((sum, s) => sum + s.total, 0) + platformFee - discountAmount);

  const [orderPlacedOptimistically, setOrderPlacedOptimistically] = useState(false);
  const [optimisticOrderId, setOptimisticOrderId] = useState<string | null>(null);
  const [optimisticOrderNumber, setOptimisticOrderNumber] = useState<string | null>(null);

  const applyPromoCode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      toast.error('Enter a promo code');
      return;
    }
    setApplyingPromo(true);
    try {
      const cartProductIds = items.map((i) => String(i.id));
      const cartCategoryNames = items
        .map((item) => products.find((p) => String(p.id) === String(item.id))?.category)
        .filter((name): name is string => !!name);
      const result = await validateCoupon(code, { cartProductIds, cartCategoryNames });
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

  const handleApplyPromo = async () => {
    await applyPromoCode(promoCode);
  };

  const handleRemovePromo = () => {
    setAppliedCoupon(null);
    setPromoCode('');
    toast.success('Promo code removed');
  };

  const isOfferEligible = (offer: AvailableOffer, subtotal: number) => {
    if (offer.minOrderValue != null && subtotal < offer.minOrderValue) return false;
    if (offer.usageLeft != null && offer.usageLeft <= 0) return false;
    return true;
  };

  const handleSavedAddressPick = (id: string) => {
    if (!id) {
      setSelectedSavedAddressId('');
      setSaveNewAddressToAccount(false);
      return;
    }
    const row = savedAddresses.find((a) => a.id === id);
    if (!row || !user) return;
    setFormData((prev) => ({
      ...prev,
      ...savedAddressToCheckoutForm(row, user.email || prev.email || ''),
    }));
    setSelectedSavedAddressId(id);
    setSaveNewAddressToAccount(false);
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
    if (serviceablePincodes.length > 0) {
      const pinDigits = formData.zipCode.replace(/\D/g, '');
      if (!isPincodeServiceable(formData.zipCode)) {
        toast.error('We don\'t deliver to this PIN code yet.', {
          description:
            pinDigits.length === 6
              ? `We currently serve ${serviceablePincodes.length} PIN code${serviceablePincodes.length === 1 ? '' : 's'}. Open the list below the ZIP field to see them.`
              : 'Enter a valid 6-digit PIN code for delivery.',
        });
        return;
      }
    }
    if (!deliverySlot) {
      toast.error('Please choose a delivery slot', {
        description: 'Select a convenient time window for your delivery.',
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
      const requestedQty = Number(item.quantity) || 1;
      const variants = Array.isArray((product as any).variants) ? (product as any).variants : [];
      let pickedVariant = variants[0];
      if (variants.length > 0) {
        // Prefer a variant matching cart unit price and enough available quantity.
        const priceMatched = variants.find((v: any) =>
          Number(v.price) === Number(item.price) &&
          Number(v.availableStock ?? v.availableQuantity ?? v.stock ?? 0) >= requestedQty,
        );
        const firstAvailable = variants.find((v: any) =>
          Number(v.availableStock ?? v.availableQuantity ?? v.stock ?? 0) >= requestedQty,
        );
        pickedVariant = priceMatched || firstAvailable || variants[0];
      }
      const variantId = pickedVariant?.id != null ? String(pickedVariant.id) : '';
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
        quantity: requestedQty,
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
      state: formData.state?.trim() || 'Karnataka',
    };

      // --- Truly Optimistic UI Start ---
      setSubmitting(false); 
      setOrderPlacedOptimistically(true); 
      // Initially, we don't have orderId/orderNumber, but the overlay will show "Placing..."
      
      try {
          const created = await createOrder({
            items: orderItems,
            shippingAddress,
            billingAddress: shippingAddress,
            couponCode: appliedCoupon?.code || undefined,
            deliverySlot: deliverySlot || undefined,
            distanceKm: deliveryStats.distanceKm,
            paymentMethod: paymentMethod,
            savedAddressId: selectedSavedAddressId || undefined,
          });
          const orderId = created.id as string;
          const orderNumber = (created.orderNumber as string) || orderId;
          const payableAmount = Number((created as any).payableAmount ?? grandTotal);
          const amountInPaise = Math.round(payableAmount * 100);

          setOptimisticOrderId(orderId);
          setOptimisticOrderNumber(orderNumber);
          clearCart(); 

          if (paymentMethod === 'cod') {
            toast.success('Order placed. Pay when you receive.', {
              description: `Order #${orderNumber} — Cash on Delivery`,
              icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
            });
            return;
          }
          
          // For online... continue with Razorpay in background of overlay

      try {
        const [{ razorpayOrderId, keyId }] = await Promise.all([
          createRazorpayOrder(orderId, amountInPaise, 'INR'),
          ensureRazorpayScript(),
        ]);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSelectedSavedAddressId('');
    setFormData({ ...formData, [name]: value });
  };

  // Redirect to cart when empty unless an order was just placed successfully
  useEffect(() => {
    if (items.length === 0 && !orderPlacedOptimistically) {
      navigate('/cart');
    }
  }, [items.length, navigate, orderPlacedOptimistically]);

  if (items.length === 0 && !orderPlacedOptimistically) {
    return null;
  }

  return (
    <div className="pt-24 sm:pt-28 pb-12 sm:pb-16 min-h-screen bg-slate-50 selection:bg-orange-500 selection:text-white overflow-x-hidden">
      {orderPlacedOptimistically && optimisticOrderId && (
        <CheckoutSuccessOverlay
          orderId={optimisticOrderId}
          orderNumber={optimisticOrderNumber || optimisticOrderId}
          subtotal={grandTotal}
          onDismiss={() => {
            setOrderPlacedOptimistically(false);
            navigate('/orders');
          }}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Delivery info */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-12 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6"
        >
          <div className="bg-white p-4 sm:p-6 rounded-3xl sm:rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center gap-4 sm:gap-6 min-h-[88px]">
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery area</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">{deliveryDistance} km</p>
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-3xl sm:rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center gap-4 sm:gap-6 min-h-[88px]">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">On-time rate</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">{deliveryEfficiency}%</p>
            </div>
          </div>
          <div className="bg-slate-900 p-4 sm:p-6 rounded-3xl sm:rounded-[2.5rem] text-white shadow-2xl flex items-center gap-4 sm:gap-6 relative overflow-hidden group min-h-[88px]">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <Globe className="w-20 h-20" />
            </div>
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Est. delivery</p>
              <p className="text-xl sm:text-2xl font-black text-white tracking-tighter">{etaLabel}</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                Based on {deliveryDistance} km from nearest warehouse
              </p>
            </div>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-12 gap-6 sm:gap-10 min-w-0">
            {/* Left Column - Forms */}
            <div className="lg:col-span-8 space-y-10 min-w-0">
              {/* Shipping Information */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full max-w-full bg-white rounded-2xl sm:rounded-[3.5rem] p-4 sm:p-10 border border-slate-100 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase">Delivery address</h2>
                </div>

                {user && savedAddresses.length > 0 && (
                  <div className="space-y-2 mb-8">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">
                      Use a saved address
                    </label>
                    <select
                      value={selectedSavedAddressId}
                      onChange={(e) => handleSavedAddressPick(e.target.value)}
                      className="w-full px-4 sm:px-6 py-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold min-h-[44px] max-w-full text-ellipsis overflow-hidden"
                    >
                      <option value="">Enter a new address below</option>
                      {savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {(a.label ? `${a.label} · ` : '') + a.name} — {a.city}, {a.pincode}
                          {a.isDefault ? ' (Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                    className="w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400 min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">
                      Last Name<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400 min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Phone number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400 min-h-[44px]"
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
                      className="w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400 min-h-[44px]"
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
                        "w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 bg-slate-50 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400 min-h-[44px]",
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">State / UT</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Karnataka"
                      className="w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400 min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">ZIP / Postal code</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      required
                      placeholder="e.g. 560001"
                      inputMode="numeric"
                      maxLength={8}
                      className={cn(
                        'w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 bg-slate-50 focus:bg-white transition-all text-slate-900 font-bold placeholder:text-slate-400 min-h-[44px]',
                        serviceablePincodes.length > 0 &&
                          formData.zipCode.replace(/\D/g, '').length >= 6 &&
                          !isPincodeServiceable(formData.zipCode)
                          ? 'border-amber-400 focus:border-amber-500'
                          : 'border-slate-200 focus:border-orange-500'
                      )}
                    />
                    {serviceablePincodes.length > 0 && (
                      <div className="pl-2 pr-1">
                        <ServiceablePincodesHint pincodes={serviceablePincodes} variant="compact" />
                      </div>
                    )}
                    {serviceablePincodes.length > 0 &&
                      formData.zipCode.replace(/\D/g, '').length >= 6 &&
                      !isPincodeServiceable(formData.zipCode) && (
                        <p className="text-xs text-amber-600 pl-4 font-bold">This PIN is not in our service area.</p>
                      )}
                  </div>
                </div>

                {user && !selectedSavedAddressId && (
                  <div className="mt-6 flex items-start gap-3 pl-1">
                    <input
                      type="checkbox"
                      id="saveAddressToAccount"
                      checked={saveNewAddressToAccount}
                      onChange={(e) => setSaveNewAddressToAccount(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <label htmlFor="saveAddressToAccount" className="text-sm font-bold text-slate-600 leading-snug cursor-pointer">
                      Save this delivery address to my account for next time (checkout and subscription).
                    </label>
                  </div>
                )}

                {/* Map & delivery slot */}
                <div className="mt-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Delivery location</p>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="self-start sm:self-auto px-4 py-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2 hover:bg-emerald-100 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Use my current location
                    </button>
                  </div>
                  {geocodeLoading && (
                    <div className="h-48 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                      <span className="text-sm font-medium text-slate-500">Detecting location…</span>
                    </div>
                  )}
                  {!geocodeLoading && checkoutMapEmbedSrc && (
                    <div className="rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner">
                      <OpenStreetMapEmbed
                        title="Delivery area map"
                        src={checkoutMapEmbedSrc}
                        className="w-full h-56 sm:h-64 border-0"
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

                  {/* Delivery slot selection */}
                  <div className="pt-4 border-t border-slate-100 mt-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-4">
                      Choose delivery slot
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        `Today · in ${etaLabel}`,
                        'Today · 6pm – 8pm',
                        'Tomorrow · 8am – 10am',
                      ].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setDeliverySlot(slot)}
                        className={cn(
                            "px-4 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] text-left transition-all min-h-[44px]",
                            deliverySlot === slot
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-500 hover:bg-white"
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                    {!deliverySlot && (
                      <p className="mt-2 text-[10px] font-bold text-slate-400 pl-4">
                        We recommend choosing a slot so our delivery partners can plan better.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-4 min-w-0">
              <div className="lg:sticky lg:top-28 space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full max-w-full bg-white rounded-2xl sm:rounded-[3.5rem] p-4 md:p-10 border border-slate-100 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16" />

                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-6 sm:mb-8 uppercase tracking-tight">Order summary</h2>

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
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.quantity <= 1) {
                                        handleRemoveItem(item.id);
                                      } else {
                                        handleUpdateQuantity(item.id, -1);
                                      }
                                    }}
                                    className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '') {
                                        handleUpdateQuantity(item.id, -item.quantity);
                                        return;
                                      }
                                      const num = parseInt(val, 10);
                                      if (!Number.isNaN(num)) {
                                        const product = products.find((p: any) => String(p.id) === String(item.id));
                                        const maxStock = Number((product as any)?.availableStock ?? (product as any)?.stock ?? 999);
                                        const target = Math.min(maxStock, Math.max(0, num));
                                        handleUpdateQuantity(item.id, target - item.quantity);
                                      }
                                    }}
                                    onBlur={() => {
                                      if (item.quantity < 1) handleUpdateQuantity(item.id, 1 - item.quantity);
                                    }}
                                    className="w-10 h-7 rounded-lg border border-slate-200 text-center text-xs font-black text-slate-800"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const product = products.find((p: any) => String(p.id) === String(item.id));
                                      const avail = Number((product as any)?.availableStock ?? (product as any)?.stock ?? 0);
                                      if (!product || item.quantity < avail) {
                                        handleUpdateQuantity(item.id, 1);
                                      } else {
                                        toast.error(`Only ${avail} units available`);
                                      }
                                    }}
                                    className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="ml-1 h-7 w-7 rounded-lg border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs font-black text-slate-900">₹{item.price * item.quantity}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-6 border-t-2 border-dotted border-slate-100">
                    <details className="group marker:content-['']">
                      <summary className="flex items-center justify-between cursor-pointer list-none bg-slate-50 p-4 rounded-2xl border border-slate-100/60 hover:bg-slate-100 transition-colors">
                         <div className="flex items-center gap-3">
                           <FileText className="w-4 h-4 text-slate-400" />
                           <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">View bill details</span>
                         </div>
                         <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="pt-6 px-2 space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>Base Subtotal</span>
                          <span className="text-slate-900">₹{vendorSummaries.reduce((sum, s) => sum + s.subtotal, 0)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>Shipping ({deliveryDistance} km)</span>
                          <span className="text-emerald-500">
                            {shippingFeeForDistance === 0 ? 'Free' : `₹${shippingFeeForDistance}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>Tax</span>
                          <span className="text-slate-900">₹{vendorSummaries.reduce((sum: number, s: any) => sum + s.tax, 0).toFixed(2)}</span>
                        </div>
                        {platformFee > 0 && (
                          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span>Platform Fee</span>
                            <span className="text-slate-900">₹{platformFee}</span>
                          </div>
                        )}
                      </div>
                    </details>


                    {(() => {
                        const threshold = Number(preferences.freeDeliveryThreshold) || 0;
                        if (threshold > 0 && subtotalOnly > 0 && subtotalOnly < threshold) {
                            return (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-emerald-50 border border-emerald-100/50 p-4 rounded-2xl flex items-center justify-between gap-4"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1 truncate">Free Delivery Unlock</p>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate">Add ₹{(threshold - subtotalOnly).toFixed(2)} more to pay ₹0 delivery</p>
                                    </div>
                                    <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                                        <Truck className="w-4 h-4" />
                                    </div>
                                </motion.div>
                            );
                        }
                        return null;
                    })()}

                    {/* Promo code */}
                    <div className="pt-4 space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Promo code</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          placeholder="e.g. SAVE10"
                          className="flex-1 w-full min-w-0 h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium uppercase min-h-[44px]"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={applyingPromo || !promoCode.trim() || !!appliedCoupon}
                          className={cn(
                            "h-12 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:cursor-not-allowed",
                            appliedCoupon
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-900 text-white hover:bg-black disabled:opacity-50"
                          )}
                        >
                          {applyingPromo ? '…' : appliedCoupon ? 'Applied' : 'Apply'}
                        </button>
                      </div>
                      {appliedCoupon && (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5" />
                            {appliedCoupon.code} applied — ₹{discountAmount.toFixed(2)} off
                          </p>
                          <button
                            type="button"
                            onClick={handleRemovePromo}
                            className="h-7 px-2.5 rounded-lg border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-wider hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Live offers list */}
                    {availableOffers.length > 0 && (
                      <div className="pt-4 space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Available offers
                        </p>
                        <div className="flex overflow-x-auto gap-3 pb-4 pt-1 snap-x snap-mandatory flex-nowrap custom-scrollbar">
                          {availableOffers.map((offer) => {
                            const eligible = isOfferEligible(offer, subtotalOnly);
                            const isApplied = appliedCoupon?.code?.toUpperCase() === offer.code.toUpperCase();
                            const offerText = offer.discountType === 'PERCENTAGE'
                              ? `${offer.discountValue}% OFF${offer.maxDiscount != null ? ` up to ₹${offer.maxDiscount}` : ''}`
                              : `₹${offer.discountValue} OFF`;
                            return (
                              <div key={offer.code} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 shrink-0 w-[280px] snap-center flex flex-col justify-between">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-wider">{offer.code}</p>
                                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{offerText}</p>
                                    {offer.minOrderValue != null ? (
                                      <p className="text-[10px] text-slate-500 font-semibold">
                                        Min order: ₹{offer.minOrderValue}
                                      </p>
                                    ) : null}
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {offer.scopeType === 'ALL' ? (
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">All products</span>
                                      ) : null}
                                      {offer.scopeType === 'CATEGORY' ? (
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                          Category offer
                                        </span>
                                      ) : null}
                                      {offer.scopeType === 'PRODUCT' ? (
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                          Product offer
                                        </span>
                                      ) : null}
                                      {offer.expiryDate ? (
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                          Expires: {new Date(offer.expiryDate).toLocaleDateString()}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPromoCode(offer.code);
                                      void applyPromoCode(offer.code);
                                    }}
                                    disabled={isApplied || !eligible || applyingPromo}
                                    className={cn(
                                      "h-9 sm:h-10 shrink-0 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed min-h-[44px]",
                                      isApplied
                                        ? "bg-emerald-600 text-white"
                                        : "bg-slate-900 text-white disabled:opacity-40"
                                    )}
                                  >
                                    {isApplied ? 'Applied' : 'Apply'}
                                  </button>
                                </div>
                                {!eligible && offer.minOrderValue != null && subtotalOnly < offer.minOrderValue ? (
                                  <p className="mt-1 text-[10px] font-semibold text-amber-600">
                                    Add ₹{(offer.minOrderValue - subtotalOnly).toFixed(2)} more to unlock this offer.
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

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
                          <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-none">₹{grandTotal.toFixed(2)}</p>
                          <p className="text-[8px] font-black text-orange-500 uppercase mt-1">Split across sellers</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment method */}
                    <div className="pt-6 mt-6 border-t border-slate-100 space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Payment method</p>
                      <div className={cn('grid gap-4', codAllowedForCart ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('online')}
                          className={cn(
                            'p-3 sm:p-4 rounded-2xl border-2 flex items-center gap-3 transition-all text-left',
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
                              'p-3 sm:p-4 rounded-2xl border-2 flex items-center gap-3 transition-all text-left',
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
                          <div className="p-3 sm:p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 flex items-center gap-3 text-left opacity-80">
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

                  <button type="submit" ref={submitRef} className="hidden" aria-hidden="true" />
                  
                  <div className="mt-8 sm:mt-10">
                      <SwipeToPay 
                        onSuccess={() => submitRef.current?.click()} 
                        submitting={submitting} 
                        themeStyle={theme.buttonStyle} 
                      />
                  </div>
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

function CheckoutSuccessOverlay({ orderId, orderNumber, subtotal, onDismiss }: { orderId: string | null, orderNumber: string | null, subtotal: number, onDismiss: () => void }) {
  const navigate = useNavigate();
  const isProcessing = !orderId;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl overflow-hidden relative"
      >
         {/* Success Background Animation Pattern */}
        <div className={cn("absolute top-0 left-0 w-full h-32 -mt-16 rounded-full blur-3xl opacity-20 transition-colors duration-500", isProcessing ? "bg-orange-500" : "bg-emerald-500")} />

        <div className="relative z-10 w-full">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 relative">
                <div className={cn("absolute inset-0 rounded-full transition-colors duration-500", isProcessing ? "bg-orange-100" : "bg-emerald-100")} />
                <motion.div
                key={isProcessing ? 'processing' : 'success'}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className={cn("w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl", isProcessing ? "bg-orange-500 shadow-orange-200" : "bg-emerald-500 shadow-emerald-200")}
                >
                {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <ShieldCheck className="w-10 h-10" />}
                </motion.div>
                
                {!isProcessing && [...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-emerald-400"
                        initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0, 1.5, 0],
                            x: Math.cos(i * 60 * Math.PI / 180) * 80,
                            y: Math.sin(i * 60 * Math.PI / 180) * 80,
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                    />
                ))}
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight uppercase">
                {isProcessing ? 'Placing Order...' : 'Order Placed!'}
            </h2>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mb-8">
                {isProcessing ? 'Verifying items & delivery' : `Order #${orderNumber}`}
            </p>

            <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Payable</span>
                    <span className="text-xl font-black text-slate-900 tracking-tight">₹{subtotal.toFixed(2)}</span>
                </div>
                {!isProcessing && (
                    <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                            <Truck className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">Estimated ETA</p>
                            <p className="text-xs font-bold text-slate-700">35 – 45 Minutes</p>
                        </div>
                    </div>
                )}
                {isProcessing && (
                    <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 animate-pulse">
                            <Activity className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Assigning Partner</p>
                            <p className="text-xs font-bold text-slate-400 italic">Please wait...</p>
                        </div>
                    </div>
                )}
            </div>

            {!isProcessing && (
                <div className="space-y-3">
                    <button
                        onClick={() => navigate('/orders')}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200"
                    >
                        Track order details
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-4 bg-white text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-200"
                    >
                        Keep shopping
                    </button>
                </div>
            )}
        </div>
      </motion.div>
    </motion.div>
  );
}
