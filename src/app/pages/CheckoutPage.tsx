import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'framer-motion';
import { Navigate, useNavigate } from 'react-router-dom';
import { Truck, MapPin, Zap, Activity, ShieldCheck, Loader2, CreditCard, Banknote, Minus, Plus, FileText, ShoppingBag, Tag, ChevronDown, Home, Building2, Navigation, Clock } from 'lucide-react';
import { useStore, type CartItem } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { SwipeToPay } from '@/app/components/SwipeToPay';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';
import { useProducts } from '@/app/hooks/useProducts';
import {
  createOrder,
  createRazorpayOrder,
  simulateOrderPricing,
  validateCoupon,
  verifyPayment,
  getOrders,
  getWarehouses,
  getDrivingDistanceKm,
  getStoreSettings,
  getUserAddresses,
  createUserAddress,
  getEffectiveApiBase,
  getImageDisplayUrl,
} from '@/lib/api';
import { savedAddressToCheckoutForm, type SavedDeliveryAddress } from '@/lib/deliveryAddressUtils';
import { cn, getRoundedClass, motionTapTransition } from '@/lib/utils';
import { ensureRazorpayScript } from '@/lib/razorpayLoader';
import { computeDeliveryFeeByDistanceKm } from '@/lib/deliveryFeeUtils';
import { estimateCartLineTotalsWithTierDiscount } from '@/lib/pricing';
import { getUserErrorMessage } from '@/lib/userError';
import { toast } from 'sonner';

interface CheckoutPageProps {
  items: CartItem[];
}

/** Dispatch default when API returns no warehouse rows — must be Bengaluru (was Kolkata by mistake). */
const DEFAULT_WAREHOUSE_LAT = 12.9784;
const DEFAULT_WAREHOUSE_LNG = 77.5946;
/** Street phrase geocode debounce; PIN path runs immediately + sync estimate below. */
const GEOCODE_DEBOUNCE_MS = 50;

/** Single service area — store delivers only within Bengaluru Urban / Karnataka. */
const DELIVERY_CITY_FIXED = 'Bengaluru';
const DELIVERY_STATE_FIXED = 'Karnataka';

/**
 * Offline / throttled fallback & instant preview. Prefer PIN-specific centroids (OSM postal areas),
 * not MG Road — using the city centre made HSR (~560102) look ~20km from a south-side warehouse.
 */
const BENGALURU_PIN_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  '560102': { lat: 12.9143784, lng: 77.6432565 },
  '560034': { lat: 12.9352, lng: 77.6245 },
  '560038': { lat: 12.9784, lng: 77.6408 },
  '560066': { lat: 12.9698, lng: 77.75 },
  '560011': { lat: 12.925, lng: 77.5938 },
  '560078': { lat: 12.9077, lng: 77.585 },
  '560100': { lat: 12.8456, lng: 77.6603 },
  '560037': { lat: 12.9592, lng: 77.6974 },
  '560010': { lat: 12.9915, lng: 77.5544 },
  '560064': { lat: 13.1007, lng: 77.5963 },
};

function approximateLatLngForBengaluruServicePin(pin: string): { lat: number; lng: number } | null {
  const d = pin.replace(/\D/g, '');
  if (d.length !== 6) return null;
  const p3 = d.slice(0, 3);
  if (!['560', '561', '562', '563'].includes(p3)) return null;
  if (BENGALURU_PIN_FALLBACK_COORDS[d]) return BENGALURU_PIN_FALLBACK_COORDS[d];
  return { lat: 12.9352, lng: 77.6245 };
}

function normalizeCityName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeLocationToken(input: string): string {
  return normalizeCityName(input)
    .replace(/[.,/\\()-]/g, ' ')
    .replace(/\b(city|district|urban|rural|metropolitan|metro|division|zone)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function citiesRoughlyMatch(a: string, b: string): boolean {
  const x = normalizeLocationToken(a);
  const y = normalizeLocationToken(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const aliases: Record<string, string[]> = {
    bangalore: ['bengaluru', 'banglore', 'bengalooru', 'bengalore'],
    bengaluru: ['bangalore', 'banglore', 'bengalooru', 'bengalore'],
    banglore: ['bangalore', 'bengaluru'],
    'bangalore urban': ['bangalore', 'bengaluru', 'bengaluru urban'],
    'bengaluru urban': ['bangalore', 'bengaluru', 'bangalore urban'],
    kolkata: ['calcutta'],
    calcutta: ['kolkata'],
    mumbai: ['bombay'],
    bombay: ['mumbai'],
  };
  return (aliases[x] || []).includes(y) || (aliases[y] || []).includes(x);
}

/** Tokens from flat + street used to pick the best Nominatim hit (e.g. HSR, layout, sector). */
function tokenizeLocationHints(flatHouse: string, address: string): string[] {
  const STOP = new Set([
    'the', 'a', 'an', 'and', 'or', 'near', 'opp', 'floor', 'flat', 'no', 'building', 'name', 'house',
  ]);
  const blob = `${flatHouse} ${address}`;
  const raw = blob.toLowerCase();
  const words = raw
    .split(/[\s,./]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
  const firstSeg = address.split(',')[0]?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
  const extra: string[] = [];
  if (firstSeg.length >= 4) extra.push(firstSeg);
  const sectorAnywhere = blob.match(/\b(sector|sec)\s*\d+\b/gi);
  if (sectorAnywhere) {
    for (const m of sectorAnywhere) {
      extra.push(m.toLowerCase().replace(/\s+/g, ' '));
    }
  }
  const m = firstSeg.match(/\b(sector|sec)\s*\d+\b/i);
  if (m) extra.push(m[0].toLowerCase().replace(/\s+/g, ' '));
  return Array.from(new Set([...extra, ...words]));
}

type NominatimHit = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: Record<string, string>;
};

function scoreNominatimHit(hit: NominatimHit, city: string, hints: string[], pinDigits: string): number {
  const d = String(hit.display_name || '').toLowerCase();
  const cityTok = normalizeLocationToken(city);
  let score = 0;
  const hitPostcode = String(hit.address?.postcode || '').replace(/\D/g, '');
  if (pinDigits.length === 6 && hitPostcode === pinDigits) {
    score += 100;
  }
  if (
    cityTok &&
    (d.includes(cityTok) ||
      d.includes('bengaluru') ||
      d.includes('bangalore') ||
      d.includes('banglore'))
  ) {
    score += 4;
  }
  for (const h of hints) {
    if (h.length >= 3 && d.includes(h)) score += 3;
    if (h.length === 2 && d.includes(h)) score += 1;
  }
  return score;
}

function dedupeNominatimHits(hits: NominatimHit[]): NominatimHit[] {
  const seen = new Set<string>();
  const out: NominatimHit[] = [];
  for (const h of hits) {
    const lat = parseFloat(h.lat);
    const lng = parseFloat(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

async function fetchNominatimIndia(q: string): Promise<NominatimHit[]> {
  try {
    if (!q.trim()) return [];
    const base = getEffectiveApiBase();
    const url = `${base}/geocode/search?${new URLSearchParams({ q: q.trim() })}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** PIN centroid via backend structured search — use when street-level `q` returns nothing. */
async function fetchNominatimIndiaByPostalCode(pin6: string): Promise<NominatimHit[]> {
  try {
    if (!/^\d{6}$/.test(pin6)) return [];
    const base = getEffectiveApiBase();
    const url = `${base}/geocode/search?${new URLSearchParams({ postalcode: pin6, limit: '12' })}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

type NominatimReverseJson = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

function strAddr(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  return String(v).trim();
}

/** Normalize common Nominatim city/county labels for Indian metros (checkout form). */
function normalizeCityFromReverse(name: string): string {
  const t = normalizeCityName(name);
  if (
    t === 'bengaluru urban' ||
    t === 'bangalore urban' ||
    t === 'bbmp' ||
    (t.includes('bengaluru') && t.includes('urban')) ||
    (t.includes('bangalore') && t.includes('urban'))
  ) {
    return 'Bengaluru';
  }
  if (t === 'bengaluru' || t === 'bangalore' || t === 'banglore') return 'Bengaluru';
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Nominatim reverse (esp. India) often omits `city` and uses suburb/neighbourhood/county.
 * Never use raw display_name as the street field — it repeats city/state/country.
 */
function parseNominatimReverseForCheckout(data: NominatimReverseJson): {
  flatHouse: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
} {
  const a = data.address || {};
  const house = strAddr(a.house_number) || strAddr((a as { house?: string }).house);
  const road = strAddr(a.road);
  const neighbourhood = strAddr(a.neighbourhood);
  const suburb = strAddr(a.suburb);
  const quarter = strAddr(a.quarter);
  const cityDistrict = strAddr(a.city_district);

  const rawCity =
    strAddr(a.city) ||
    strAddr(a.town) ||
    strAddr(a.municipality) ||
    strAddr(a.village) ||
    strAddr(a.county) ||
    cityDistrict ||
    strAddr(a.state_district);

  const city = rawCity ? normalizeCityFromReverse(rawCity) : '';
  const state = strAddr(a.state);
  const postcode = strAddr(a.postcode).replace(/\D/g, '');
  const zipCode = postcode.length >= 6 ? postcode.slice(0, 6) : postcode;

  const areaParts: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !areaParts.some((x) => x.toLowerCase() === t.toLowerCase())) areaParts.push(t);
  };
  if (road) push(road);
  if (neighbourhood) push(neighbourhood);
  if (suburb) push(suburb);
  if (quarter) push(quarter);
  if (cityDistrict && cityDistrict !== rawCity) push(cityDistrict);

  let address = areaParts.join(', ');
  if (!address && data.display_name) {
    address = trimDisplayNameToLocalLine(String(data.display_name), city, state);
  }

  return {
    flatHouse: house,
    address,
    city,
    state,
    zipCode,
  };
}

/** Drop country / state / city / PIN from display_name; keep road + locality segment. */
function trimDisplayNameToLocalLine(displayName: string, city: string, state: string): string {
  const parts = displayName.split(',').map((p) => p.trim()).filter(Boolean);
  const lc = city ? normalizeCityName(city) : '';
  const ls = state ? normalizeCityName(state) : '';
  const out: string[] = [];
  for (const p of parts) {
    const pl = normalizeCityName(p);
    if (pl.includes('india')) break;
    if (lc && (pl === lc || pl.includes(lc) || lc.includes(pl))) break;
    if (ls && (pl === ls || pl.includes(ls))) break;
    if (/^\d{6}$/.test(p.replace(/\s/g, ''))) break;
    out.push(p);
    if (out.length >= 6) break;
  }
  return out.join(', ') || displayName;
}

/**
 * Forward-geocode hits: merge city/state from the search result.
 * Do **not** set zipCode here — search results often attach a broad/wrong `postcode` (e.g. area default),
 * which used to skip reverse geocode and left the PIN wrong for a known street. PIN comes from reverse at lat/lng.
 */
function extractFormSyncFromNominatimForwardHit(hit: NominatimHit): {
  city?: string;
  state?: string;
} {
  const a = hit.address || {};

  const rawCity =
    strAddr(a.city) ||
    strAddr(a.town) ||
    strAddr(a.municipality) ||
    strAddr(a.village) ||
    strAddr(a.county) ||
    strAddr(a.city_district) ||
    strAddr(a.state_district);

  const city = rawCity ? normalizeCityFromReverse(rawCity) : '';
  const state = strAddr(a.state);

  return {
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
  };
}

function pickBestNominatimHit(hits: NominatimHit[], city: string, hints: string[], pinDigits: string): NominatimHit | null {
  if (!hits.length) return null;
  let best: NominatimHit | null = null;
  let bestScore = -1;
  for (const h of hits) {
    const s = scoreNominatimHit(h, city, hints, pinDigits);
    if (s > bestScore) {
      bestScore = s;
      best = h;
    }
  }
  return best;
}

/** OSM search prefers "Bengaluru" for Bangalore localities (e.g. HSR Layout). */
function cityLabelForNominatim(city: string): string {
  const t = normalizeCityName(city);
  if (!t) return city.trim();
  if (
    t === 'bangalore' ||
    t === 'bengaluru' ||
    t === 'banglore' ||
    t === 'bengalore' ||
    t === 'bangalore urban' ||
    t === 'bengaluru urban'
  ) {
    return 'Bengaluru';
  }
  return city.trim();
}

/** Users often paste "… Bangalore 560205" in the street field only — still need PIN for geocode fallbacks. */
function extractIndiaPinDigitsFromText(...chunks: string[]): string {
  const blob = chunks.filter(Boolean).join(' ');
  const m = blob.match(/\b(\d{6})\b/);
  return m ? m[1] : '';
}

/** When city box is empty but address mentions Bangalore / Bengaluru. */
function inferCityFromAddressBlob(flatHouse: string, address: string): string {
  const blob = `${flatHouse} ${address}`.toLowerCase();
  if (/\b(bangalore|bengaluru|bengalore|banglore)\b/.test(blob)) return 'Bengaluru';
  return '';
}

/** Rough metro hint from 6-digit PIN so Nominatim gets a city anchor when the city field is blank. */
function inferCityHintFromIndianPin(pinDigits: string): string {
  if (pinDigits.length !== 6) return '';
  const p3 = pinDigits.slice(0, 3);
  if (['560', '561', '562', '563'].includes(p3)) return 'Bengaluru';
  if (['400', '401', '402', '403', '404', '405'].includes(p3)) return 'Mumbai';
  if (['110', '111', '112', '113', '114', '115', '116', '117', '118'].includes(p3)) return 'New Delhi';
  if (['600', '601', '602', '603'].includes(p3)) return 'Chennai';
  if (['500', '501', '502'].includes(p3)) return 'Hyderabad';
  if (['380', '381', '382', '383', '384', '385', '387', '388', '389'].includes(p3)) return 'Ahmedabad';
  if (['700', '701', '711', '712', '713', '721', '722', '731', '734', '735', '736', '737'].includes(p3)) return 'Kolkata';
  return '';
}

/** Extra queries when primary/secondary miss noisy locality strings (comma-heavy, "sector 6", etc.). */
function buildSupplementalGeocodeQueries(street: string, city: string, state: string, pinDigits: string): string[] {
  const c = cityLabelForNominatim(city);
  const st = state?.trim() || '';
  const head = street.split(',')[0]?.trim() || street.trim();
  const compact = head.replace(/\s+/g, ' ').trim();
  const out: string[] = [];

  // PIN first: OSM often resolves rural/outskirts addresses when phrase queries fail; must run before slice(limit).
  if (pinDigits.length === 6) {
    out.push(`${pinDigits}, India`);
    out.push([c, pinDigits, 'India'].filter(Boolean).join(', '));
    out.push([head, c, pinDigits, 'India'].filter(Boolean).join(', '));
  }
  if (compact) {
    out.push([compact, c, st, 'India'].filter(Boolean).join(', '));
    out.push([compact, c, 'India'].filter(Boolean).join(', '));
  }
  if (/hsr/i.test(street) || /hsr/i.test(compact)) {
    out.push([`HSR Layout`, c, st || 'Karnataka', 'India'].filter(Boolean).join(', '));
    out.push([`HSR Layout Sector`, c, 'India'].filter(Boolean).join(', '));
  }
  if (/jigani/i.test(street) || /jigani/i.test(compact)) {
    out.push([`Jigani`, c || 'Bengaluru', st || 'Karnataka', 'India'].filter(Boolean).join(', '));
    out.push([`Jigani Industrial Area`, c || 'Bengaluru', 'India'].filter(Boolean).join(', '));
  }
  if (/gidenhalli/i.test(street)) {
    out.push([`Gidenhalli`, c || 'Bengaluru', st || 'Karnataka', 'India'].filter(Boolean).join(', '));
  }
  out.push([c, st, 'India'].filter(Boolean).join(', '));
  return Array.from(new Set(out.filter(Boolean)));
}

export function CheckoutPage({ items }: CheckoutPageProps) {
  const { products: storeProducts, taxRates, preferences, clearCart, handleUpdateQuantity, handleRemoveItem } = useStore();
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
  const {
    cities: serviceableCities,
    pincodes: serviceablePincodes,
    isCityServiceable,
    isPincodeServiceable,
  } = useServiceableAreas();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountType: string; discountValue: number; maxDiscount?: number | null; minOrderValue?: number | null } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [deliverySlot, setDeliverySlot] = useState<string>('');
  const [formData, setFormData] = useState({
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    phone: user?.phone || '',
    flatHouse: '',
    address: user?.address || '',
    city: DELIVERY_CITY_FIXED,
    state: DELIVERY_STATE_FIXED,
    zipCode: '',
    landmark: '',
    deliveryInstructions: '',
  });
  const [fullNameInput, setFullNameInput] = useState(() => `${user?.name || ''}`.trim());
  /** Always latest form values for debounced geocode (avoids stale closure inside setTimeout). */
  const checkoutFormRef = useRef(formData);
  checkoutFormRef.current = formData;
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});
  const [pricingSnapshot, setPricingSnapshot] = useState<{
    deliveryCharge: number;
    deliveryFeeRules: Array<{ upToKm: number; fee: number }>;
    deliveryFeeMode: 'SLAB' | 'PER_KM';
    deliveryPerKmRate: number;
    freeDeliveryThreshold: number;
    platformFee: number;
    taxRates: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pullPricing = async () => {
      try {
        const data = await getStoreSettings();
        if (cancelled) return;
        const rawTaxRates = (data?.preferences as any)?.taxRates;
        const normalizedTaxRates: Record<string, number> = {};
        if (rawTaxRates && typeof rawTaxRates === 'object') {
          for (const [k, v] of Object.entries(rawTaxRates as Record<string, unknown>)) {
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0) continue;
            normalizedTaxRates[String(k)] = n;
          }
        }
        setPricingSnapshot({
          deliveryCharge: Number(data?.deliveryCharge ?? 0) || 0,
          deliveryFeeRules: Array.isArray(data?.deliveryFeeRules) ? data.deliveryFeeRules : [],
          deliveryFeeMode: String((data as any)?.deliveryFeeMode).toUpperCase() === 'PER_KM' ? 'PER_KM' : 'SLAB',
          deliveryPerKmRate: Number((data as any)?.deliveryPerKmRate ?? 0) || 0,
          freeDeliveryThreshold: Number((data as any)?.freeDeliveryThreshold ?? 0) || 0,
          platformFee: Number((data as any)?.platformFee ?? 0) || 0,
          taxRates: normalizedTaxRates,
        });
      } catch {
        // Keep in-memory settings when live pull fails.
      }
    };
    void pullPricing();
    const onFocus = () => { void pullPricing(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const effectivePricing = useMemo(() => ({
    deliveryCharge: pricingSnapshot?.deliveryCharge ?? (Number(preferences.deliveryCharge) || 0),
    deliveryFeeRules: pricingSnapshot?.deliveryFeeRules ?? (preferences.deliveryFeeRules || []),
    deliveryFeeMode: pricingSnapshot?.deliveryFeeMode ?? (preferences.deliveryFeeMode || 'SLAB'),
    deliveryPerKmRate: pricingSnapshot?.deliveryPerKmRate ?? (Number(preferences.deliveryPerKmRate) || 0),
    freeDeliveryThreshold: pricingSnapshot?.freeDeliveryThreshold ?? (Number(preferences.freeDeliveryThreshold) || 0),
    platformFee: pricingSnapshot?.platformFee ?? (Number(preferences.platformFee) || 0),
    taxRates:
      pricingSnapshot?.taxRates && Object.keys(pricingSnapshot.taxRates).length > 0
        ? pricingSnapshot.taxRates
        : taxRates,
  }), [pricingSnapshot, preferences, taxRates]);
  useEffect(() => {
    const canonical = `${formData.firstName} ${formData.lastName}`.replace(/\s+/g, ' ').trim();
    setFullNameInput((prev) => {
      const prevCanonical = String(prev || '').replace(/\s+/g, ' ').trim();
      if (prevCanonical === canonical) return prev;
      return canonical;
    });
  }, [formData.firstName, formData.lastName]);

  const [savedAddresses, setSavedAddresses] = useState<SavedDeliveryAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [saveNewAddressToAccount, setSaveNewAddressToAccount] = useState(false);
  const [addressType, setAddressType] = useState<'home' | 'work' | 'other'>('home');
  const [setAsDefaultAddress, setSetAsDefaultAddress] = useState(false);

  const [deliveryStats, setDeliveryStats] = useState<{
    distanceKm: number | null;
    onTimeRate: number | null;
    estimatedMins: number | null;
  }>({
    distanceKm: null,
    onTimeRate: null,
    estimatedMins: null,
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMeta, setLocationMeta] = useState<{
    source: 'geocode' | 'postcode_area' | 'city_area' | null;
    accuracyMeters: number | null;
  }>({
    source: null,
    accuracyMeters: null,
  });
  const isAddressResolvedForPricing = true;

  /** Prefer zip field; else first 6-digit PIN pasted in flat/street (e.g. "… Bangalore 560205"). */
  const effectivePinDigits = useMemo(() => {
    const z = formData.zipCode.replace(/\D/g, '');
    if (z.length === 6) return z;
    return extractIndiaPinDigitsFromText(formData.flatHouse, formData.address, formData.zipCode);
  }, [formData.zipCode, formData.flatHouse, formData.address]);

  /**
   * City-centroid / street geocode: only need serviceable city (when admin lists cities).
   * Postcode-centroid: also need a serviceable 6-digit PIN when admin lists pincodes — do not block city fallback while PIN is still empty.
   */
  const cityTrimForService = useMemo(
    () =>
      formData.city.trim() ||
      inferCityFromAddressBlob(formData.flatHouse, formData.address) ||
      inferCityHintFromIndianPin(effectivePinDigits),
    [formData.city, formData.flatHouse, formData.address, effectivePinDigits],
  );

  const canFallbackCityArea = useMemo(() => {
    if (serviceableCities.length > 0) {
      if (!cityTrimForService || !isCityServiceable(cityTrimForService)) return false;
    }
    return true;
  }, [cityTrimForService, serviceableCities.length, isCityServiceable]);

  const canFallbackCityAreaRef = useRef(canFallbackCityArea);
  canFallbackCityAreaRef.current = canFallbackCityArea;

  const [warehouses, setWarehouses] = useState<Array<{ latitude: number | string; longitude: number | string }>>([]);
  const warehousesRef = useRef(warehouses);
  warehousesRef.current = warehouses;
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRequestSeqRef = useRef(0);
  /** Street/city hit applied — block late PIN provisional `.then` from overwriting. */
  const pinProvisionalBlockRef = useRef(false);
  /** Flat + street + city (no PIN): when this changes, clear the pin until the new address resolves — avoids showing the previous street's location. */
  const lastSuccessfulGeocodeShapeKeyRef = useRef<string>('');
  /** Clears stale km when the resolved 6-digit PIN changes while waiting for live postal geocode. */
  const lastDistancePinRef = useRef<string>('');
  /** Cancels in-flight Mapbox driving-distance when coordinates or warehouses change again. */
  const drivingDistanceSeqRef = useRef(0);
  /** Session cache to avoid repeat Mapbox calls for same source/destination pair. */
  const drivingDistanceCacheRef = useRef(
    new Map<string, { distanceKm: number; onTimeRate: number; estimatedMins: number }>(),
  );

  useEffect(() => {
    // Hydrate last-used address from this device (only if not logged in or as initial fallback)
    try {
      const saved = localStorage.getItem('saved_checkout_address');
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({
          ...prev,
          ...parsed,
          city: DELIVERY_CITY_FIXED,
          state: DELIVERY_STATE_FIXED,
        }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(
          'saved_checkout_address',
          JSON.stringify({
            flatHouse: formData.flatHouse,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            landmark: formData.landmark,
            deliveryInstructions: formData.deliveryInstructions,
          }),
        );
      } catch {
        /* ignore quota / private mode */
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [
    formData.flatHouse,
    formData.address,
    formData.city,
    formData.state,
    formData.zipCode,
    formData.landmark,
    formData.deliveryInstructions,
  ]);

  // Fetch and auto-fill saved addresses from account
  useEffect(() => {
    if (!user?.id) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    const fetchAddresses = async () => {
      try {
        const list = await getUserAddresses();
        if (cancelled) return;
        setSavedAddresses(list);
        
        if (list.length > 0) {
          // If we have saved addresses, prioritize the default one for auto-fill 
          // (if no local override was set in the very current session)
          const preferred = list.find((a) => a.isDefault) || list[0];
          if (preferred) {
             setFormData((prev) => ({
              ...prev,
              ...savedAddressToCheckoutForm(preferred, user.email || prev.email || ''),
              city: DELIVERY_CITY_FIXED,
              state: DELIVERY_STATE_FIXED,
            }));
            setSelectedSavedAddressId(preferred.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch addresses:', err);
        if (!cancelled) setSavedAddresses([]);
      }
    };
    fetchAddresses();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  useEffect(() => {
    getWarehouses(true).then((list) => {
      setWarehouses(list.map((w) => ({ latitude: Number(w.latitude), longitude: Number(w.longitude) })));
    }).catch(() => setWarehouses([]));
  }, []);

  /** Driving distance only (Mapbox via backend). Keep last good km while refreshing to avoid flicker. */
  const applyDrivingDistanceForCoords = useCallback(async (lat: number, lng: number) => {
    const seq = ++drivingDistanceSeqRef.current;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const whList =
      warehousesRef.current.length > 0 ? warehousesRef.current : [{ latitude: DEFAULT_WAREHOUSE_LAT, longitude: DEFAULT_WAREHOUSE_LNG }];
    const sources = whList
      .map((w) => ({ latitude: Number(w.latitude), longitude: Number(w.longitude) }))
      .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
    if (sources.length === 0) return;
    const roundedDest = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const roundedSources = sources
      .map((s) => `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`)
      .sort()
      .join('|');
    const cacheKey = `${roundedDest}__${roundedSources}`;
    const cached = drivingDistanceCacheRef.current.get(cacheKey);
    if (cached) {
      if (seq !== drivingDistanceSeqRef.current) return;
      setDeliveryStats(cached);
      return;
    }

    try {
      const { distanceKm: roadKm } = await getDrivingDistanceKm(sources, { latitude: lat, longitude: lng });
      if (seq !== drivingDistanceSeqRef.current) return;
      if (roadKm != null && Number.isFinite(roadKm)) {
        const distanceKm = Math.round(roadKm * 10) / 10;
        const onTimeRate = Math.min(99, Math.max(85, 95 - Math.floor(distanceKm / 2)));
        const estimatedMins = Math.min(90, Math.max(25, 30 + Math.round(distanceKm * 4)));
        const next = { distanceKm, onTimeRate, estimatedMins };
        drivingDistanceCacheRef.current.set(cacheKey, next);
        setDeliveryStats(next);
        return;
      }
    } catch {
      /* Mapbox / network error */
    }
    if (seq !== drivingDistanceSeqRef.current) return;
    // Keep previous distance on transient API failure; explicit field resets handle true invalid/empty states.
  }, []);

  /** Map pin + meta only — driving km comes from `mapCenter` + Mapbox Matrix effect. */
  const updateDeliveryFromCoordinates = useCallback(
    (
      lat: number,
      lng: number,
      opts?: {
        source?: 'geocode' | 'postcode_area' | 'city_area';
        accuracyMeters?: number | null;
      },
    ) => {
      setMapCenter((prev) => {
        if (prev && Math.abs(prev.lat - lat) < 1e-6 && Math.abs(prev.lng - lng) < 1e-6) {
          return prev;
        }
        return { lat, lng };
      });
      setLocationMeta((prev) => {
        const next = {
          source: opts?.source ?? null,
          accuracyMeters: opts?.accuracyMeters ?? null,
        };
        if (prev.source === next.source && prev.accuracyMeters === next.accuracyMeters) {
          return prev;
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const flat = formData.flatHouse.trim();
    const street = formData.address.trim();
    const inferredCity = inferCityFromAddressBlob(flat, street);
    const zipField = formData.zipCode.replace(/\D/g, '');
    const pinFromBlob = extractIndiaPinDigitsFromText(flat, street, formData.zipCode);
    const pinDigitsEarly = zipField.length === 6 ? zipField : pinFromBlob;
    const inferredPinCity = inferCityHintFromIndianPin(pinDigitsEarly);
    const city = formData.city.trim() || inferredCity || inferredPinCity;
    const isAddressCompleteForGeocode =
      street.length >= 5 &&
      city.length >= 2 &&
      pinDigitsEarly.length === 6;
    const query = [flat, street, city, formData.zipCode].filter(Boolean).join(', ');
    if (!isAddressCompleteForGeocode) {
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      geocodeRequestSeqRef.current += 1;
      pinProvisionalBlockRef.current = false;
      if (!query.trim()) {
        setMapCenter(null);
        setLocationMeta({ source: null, accuracyMeters: null });
        setDeliveryStats({ distanceKm: null, onTimeRate: null, estimatedMins: null });
      }
      return;
    }
    if (!query.trim()) {
      setMapCenter(null);
      setLocationMeta({ source: null, accuracyMeters: null });
      setDeliveryStats({ distanceKm: null, onTimeRate: null, estimatedMins: null });
      return;
    }
    if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
    const requestSeq = ++geocodeRequestSeqRef.current;
    pinProvisionalBlockRef.current = false;

    /** PIN fetch starts immediately (no debounce) so km / ETA appear as soon as the API answers. */
    const flatImm = formData.flatHouse.trim();
    const streetImm = formData.address.trim();
    const zipImm = formData.zipCode.replace(/\D/g, '');
    const pinImm =
      zipImm.length === 6 ? zipImm : extractIndiaPinDigitsFromText(flatImm, streetImm, formData.zipCode);
    if (pinImm.length === 6) {
      if (pinImm !== lastDistancePinRef.current) {
        lastDistancePinRef.current = pinImm;
        setDeliveryStats({ distanceKm: null, onTimeRate: null, estimatedMins: null });
      }
    } else {
      lastDistancePinRef.current = '';
      setDeliveryStats({ distanceKm: null, onTimeRate: null, estimatedMins: null });
    }
    const cityImm =
      formData.city.trim() ||
      inferCityFromAddressBlob(flatImm, streetImm) ||
      inferCityHintFromIndianPin(pinImm) ||
      DELIVERY_CITY_FIXED;
    const cityForScoringImm = (cityLabelForNominatim(cityImm).trim() || cityImm.trim()).trim();
    const hintsImm = tokenizeLocationHints(formData.flatHouse, formData.address);

    /**
     * Do **not** apply `approximateLatLngForBengaluruServicePin` here — it made many PINs share one
     * generic centroid (~16.9 km) before Nominatim returned. Distance/ETA should reflect live
     * `/geocode/search?postalcode=` (and street/city picks below); approximate fallback runs only
     * when those responses have no usable hit.
     */

    let pinFetchShared: Promise<NominatimHit[]> | null = null;
    if (pinImm.length === 6) {
      pinFetchShared = fetchNominatimIndiaByPostalCode(pinImm);
      void pinFetchShared.then((raw) => {
        /** Do not use `requestSeq` here: every keystroke bumps it while the user edits street,
         *  so slow PIN responses were discarded and distance stayed "—". Apply when this response
         *  still matches the **current** 6-digit PIN in the form. */
        const fd = checkoutFormRef.current;
        const zLive = fd.zipCode.replace(/\D/g, '');
        const pinLive =
          zLive.length === 6 ? zLive : extractIndiaPinDigitsFromText(fd.flatHouse, fd.address, fd.zipCode);
        if (pinLive !== pinImm) return;
        if (pinProvisionalBlockRef.current) return;
        const pinHits = dedupeNominatimHits(raw);
        /**
         * If postalcode search returns nothing, do **not** apply the generic Bengaluru centroid here.
         * That raced ahead of the debounced street/city pipeline (~50ms) and pinned many users to ~16.9 km
         * even when "HSR layout" + full address would geocode correctly moments later.
         * Approximate fallback runs only after street + PIN-area + city attempts in the debounced block.
         */
        if (pinHits.length === 0) return;
        const pinPick =
          pickBestNominatimHit(pinHits, cityForScoringImm, hintsImm, pinImm) ?? pinHits[0];
        const lat = parseFloat(pinPick.lat);
        const lng = parseFloat(pinPick.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        updateDeliveryFromCoordinates(lat, lng, { source: 'postcode_area' });
        const flatR = fd.flatHouse.trim();
        const streetR = fd.address.trim();
        const pinR =
          fd.zipCode.replace(/\D/g, '').length === 6
            ? fd.zipCode.replace(/\D/g, '')
            : extractIndiaPinDigitsFromText(flatR, streetR, fd.zipCode);
        const cityR =
          fd.city.trim() ||
          inferCityFromAddressBlob(flatR, streetR) ||
          inferCityHintFromIndianPin(pinR) ||
          DELIVERY_CITY_FIXED;
        lastSuccessfulGeocodeShapeKeyRef.current = `${flatR}\u001f${streetR}\u001f${cityR}`;
      });
    }

    geocodeTimeoutRef.current = setTimeout(async () => {
      if (requestSeq !== geocodeRequestSeqRef.current) return;
      const fd = checkoutFormRef.current;
      const flatNow = fd.flatHouse.trim();
      const streetNow = fd.address.trim();
      const inferredCityNow = inferCityFromAddressBlob(flatNow, streetNow);
      const zipFieldNow = fd.zipCode.replace(/\D/g, '');
      const pinFromBlobNow = extractIndiaPinDigitsFromText(flatNow, streetNow, fd.zipCode);
      const pinDigits = zipFieldNow.length === 6 ? zipFieldNow : pinFromBlobNow;
      const cityNow =
        fd.city.trim() || inferredCityNow || inferCityHintFromIndianPin(pinDigits);
      const geocodeShapeKey = `${flatNow}\u001f${streetNow}\u001f${cityNow}`;
      /** Avoid sending default Karnataka with unrelated street text before user sets city/PIN (biases Nominatim). */
      const cityForSearch = cityLabelForNominatim(cityNow).trim();
      /** Must match query normalization so scoring ranks the same city string Nominatim returns (e.g. "banglore" → Bengaluru). */
      const cityForScoring = (cityForSearch || cityNow.trim()).trim();
      const hasAnchorForState = Boolean(cityForSearch) || pinDigits.length === 6;
      const supplementalState = hasAnchorForState ? (fd.state?.trim() || '') : '';

      const hints = tokenizeLocationHints(fd.flatHouse, fd.address);
      /** Single line for forward search: users split "HSR" vs "Layout" across flat vs street. */
      const streetLine = [flatNow, streetNow].filter((s) => s.trim().length > 0).join(', ').trim();
      const hasStreet = streetLine.length >= 2;

      const applyGeocodeHit = (hit: NominatimHit, source: 'geocode' | 'postcode_area' | 'city_area'): boolean => {
        const lat = parseFloat(hit.lat);
        const lng = parseFloat(hit.lon);
        if (requestSeq !== geocodeRequestSeqRef.current) return false;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

        const syncFormFromHit = () => {
          const patch = extractFormSyncFromNominatimForwardHit(hit);
          if (Object.keys(patch).length > 0) {
            setFormData((prev) => {
              const next = {
                ...prev,
                ...patch,
                city: DELIVERY_CITY_FIXED,
                state: DELIVERY_STATE_FIXED,
              };
              if (
                next.flatHouse === prev.flatHouse &&
                next.address === prev.address &&
                next.landmark === prev.landmark &&
                next.city === prev.city &&
                next.state === prev.state &&
                next.zipCode === prev.zipCode
              ) {
                return prev;
              }
              return next;
            });
          }
          void (async () => {
            try {
              const res = await fetch(
                `${getEffectiveApiBase()}/geocode/reverse?${new URLSearchParams({
                  lat: String(lat),
                  lon: String(lng),
                })}`,
              );
              if (!res.ok) return;
              const data = (await res.json()) as NominatimReverseJson;
              if (requestSeq !== geocodeRequestSeqRef.current) return;
              const parsed = parseNominatimReverseForCheckout(data);
              setFormData((prev) => {
                const next = {
                  ...prev,
                  ...(parsed.zipCode.length === 6 ? { zipCode: parsed.zipCode } : {}),
                  city: DELIVERY_CITY_FIXED,
                  state: DELIVERY_STATE_FIXED,
                };
                if (
                  next.zipCode === prev.zipCode &&
                  next.city === prev.city &&
                  next.state === prev.state
                ) {
                  return prev;
                }
                return next;
              });
            } catch {
              /* ignore */
            }
          })();
        };

        updateDeliveryFromCoordinates(lat, lng, { source });
        lastSuccessfulGeocodeShapeKeyRef.current = geocodeShapeKey;
        if (source === 'geocode' && hasStreet) {
          syncFormFromHit();
        }
        return true;
      };

      const applyPinAreaFallback = async (): Promise<boolean> => {
        if (pinDigits.length !== 6) return false;
        const pinHits = dedupeNominatimHits(await fetchNominatimIndiaByPostalCode(pinDigits));
        if (requestSeq !== geocodeRequestSeqRef.current) return false;
        const pinPick =
          pinHits.length > 0
            ? pickBestNominatimHit(pinHits, cityForScoring, hints, pinDigits) ?? pinHits[0]
            : null;
        if (pinPick) {
          return applyGeocodeHit(pinPick, 'postcode_area');
        }
        return false;
      };

      try {
        // Reuse the PIN request started before debounce when the 6-digit PIN is unchanged.
        const pinAreaFetchPromise =
          pinDigits.length === 6
            ? pinDigits === pinImm && pinFetchShared
              ? pinFetchShared
              : fetchNominatimIndiaByPostalCode(pinDigits)
            : Promise.resolve<NominatimHit[]>([]);

        // Primary: full street + optional city + PIN — no state (default Karnataka poisons e.g. Delhi text).
        const primaryParts = hasStreet
          ? [streetLine, cityForSearch, ...(pinDigits.length === 6 ? [pinDigits] : []), 'India']
          : [cityForSearch, ...(pinDigits.length === 6 ? [pinDigits] : []), 'India'];
        const primaryQuery = primaryParts.filter(Boolean).join(', ');
        const secondaryQuery =
          hasStreet && pinDigits.length === 6
            ? [streetLine, cityForSearch, pinDigits, 'India'].filter(Boolean).join(', ')
            : [cityForSearch, pinDigits, 'India'].filter(Boolean).join(', ');

        const primaryFetchPromise = fetchNominatimIndia(primaryQuery);
        let streetCandidates = dedupeNominatimHits(await primaryFetchPromise);
        if (requestSeq !== geocodeRequestSeqRef.current) return;

        if (streetCandidates.length === 0 && secondaryQuery && secondaryQuery !== primaryQuery) {
          streetCandidates = dedupeNominatimHits(await fetchNominatimIndia(secondaryQuery));
          if (requestSeq !== geocodeRequestSeqRef.current) return;
        }

        if (streetCandidates.length === 0) {
          const extras = buildSupplementalGeocodeQueries(
            streetLine,
            cityForScoring,
            supplementalState,
            pinDigits,
          ).slice(0, 6);
          if (extras.length > 0) {
            const batches = await Promise.all(extras.map((q) => fetchNominatimIndia(q)));
            if (requestSeq !== geocodeRequestSeqRef.current) return;
            streetCandidates = dedupeNominatimHits(batches.flat());
          }
        }

        const streetPick =
          streetCandidates.length > 0
            ? pickBestNominatimHit(streetCandidates, cityForScoring, hints, pinDigits)
            : null;

        let resolved = false;
        if (streetPick) {
          resolved = applyGeocodeHit(streetPick, 'geocode');
          if (resolved) pinProvisionalBlockRef.current = true;
        }

        /** Street / phrase search failed or did not apply — use PIN centroid (structured `postalcode=` on backend). */
        if (!resolved && pinDigits.length === 6) {
          const pinAreaHits = dedupeNominatimHits(await pinAreaFetchPromise);
          if (requestSeq !== geocodeRequestSeqRef.current) return;
          const pinPick =
            pinAreaHits.length > 0
              ? pickBestNominatimHit(pinAreaHits, cityForScoring, hints, pinDigits) ?? pinAreaHits[0]
              : null;
          if (pinPick) {
            resolved = applyGeocodeHit(pinPick, 'postcode_area');
            if (resolved) pinProvisionalBlockRef.current = true;
          }
        }

        if (!resolved && canFallbackCityAreaRef.current && cityForSearch) {
          const cityHits = await fetchNominatimIndia(
            [cityForSearch, supplementalState, 'India'].filter(Boolean).join(', '),
          );
          if (requestSeq !== geocodeRequestSeqRef.current) return;
          const cityPick = pickBestNominatimHit(dedupeNominatimHits(cityHits), cityForScoring, hints, pinDigits);
          if (cityPick) {
            resolved = applyGeocodeHit(cityPick, 'city_area');
            if (resolved) pinProvisionalBlockRef.current = true;
          }
        }

        if (!resolved && requestSeq === geocodeRequestSeqRef.current) {
          const fbPin = approximateLatLngForBengaluruServicePin(pinDigits);
          if (pinDigits.length === 6 && fbPin) {
            updateDeliveryFromCoordinates(fbPin.lat, fbPin.lng, { source: 'postcode_area' });
            lastSuccessfulGeocodeShapeKeyRef.current = geocodeShapeKey;
          } else if (geocodeShapeKey !== lastSuccessfulGeocodeShapeKeyRef.current) {
            if (pinDigits.length === 6) return;
            setMapCenter(null);
            setLocationMeta({ source: null, accuracyMeters: null });
            setDeliveryStats({ distanceKm: null, onTimeRate: null, estimatedMins: null });
          }
        }
      } catch {
        if (requestSeq !== geocodeRequestSeqRef.current) return;
        void (async () => {
          const ok = await applyPinAreaFallback();
          if (ok || requestSeq !== geocodeRequestSeqRef.current) return;
          const pinDigitsErr = (() => {
            const z = checkoutFormRef.current.zipCode.replace(/\D/g, '');
            if (z.length === 6) return z;
            return extractIndiaPinDigitsFromText(
              checkoutFormRef.current.flatHouse,
              checkoutFormRef.current.address,
              checkoutFormRef.current.zipCode,
            );
          })();
          const fb = approximateLatLngForBengaluruServicePin(pinDigitsErr);
          if (pinDigitsErr.length === 6 && fb) {
            updateDeliveryFromCoordinates(fb.lat, fb.lng, { source: 'postcode_area' });
            return;
          }
          if (geocodeShapeKey && geocodeShapeKey !== lastSuccessfulGeocodeShapeKeyRef.current) {
            if (pinDigitsErr.length === 6) return;
            setMapCenter(null);
            setLocationMeta({ source: null, accuracyMeters: null });
            setDeliveryStats({ distanceKm: null, onTimeRate: null, estimatedMins: null });
          }
        })();
      }
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
    };
  }, [
    formData.flatHouse,
    formData.address,
    formData.city,
    formData.zipCode,
    formData.state,
    serviceableCities,
    isCityServiceable,
  ]);

  /** When map center or warehouses change, recompute driving km (warehouses → drop-off via Mapbox) only. */
  useEffect(() => {
    if (!mapCenter) return;
    void applyDrivingDistanceForCoords(mapCenter.lat, mapCenter.lng);
  }, [warehouses, mapCenter, applyDrivingDistanceForCoords]);

  // Hyperlocal Logic (Mocked) - now driven by address
  const deliveryDistance = deliveryStats.distanceKm;
  const etaLabel = useMemo(() => {
    if (deliveryStats.estimatedMins == null) return '';
    const etaMin = Math.max(20, Math.round(deliveryStats.estimatedMins * 0.8));
    const etaMax = Math.max(etaMin + 10, Math.round(deliveryStats.estimatedMins * 1.2));
    return `${etaMin}-${etaMax} mins`;
  }, [deliveryStats.estimatedMins]);
  const configuredDeliverySlots = Array.isArray(preferences.deliverySlots) ? preferences.deliverySlots : [];
  const hasConfiguredDeliverySlots = configuredDeliverySlots.length > 0;
  const deliverySlotsConfigKey = useMemo(
    () => JSON.stringify(Array.isArray(preferences.deliverySlots) ? preferences.deliverySlots : []),
    [preferences.deliverySlots],
  );
  const deliverySlotOptions = hasConfiguredDeliverySlots
    ? configuredDeliverySlots
    : [`Today · in ${etaLabel}`, 'Today · 6pm – 8pm', 'Tomorrow · 8am – 10am'];

  useEffect(() => {
    if (deliverySlot) return;
    if (!hasConfiguredDeliverySlots) return;
    if (configuredDeliverySlots.length !== 1) return;
    setDeliverySlot(configuredDeliverySlots[0]);
  }, [deliverySlot, hasConfiguredDeliverySlots, deliverySlotsConfigKey, configuredDeliverySlots]);

  const groupedItems = useMemo(() => {
    return items.reduce((acc: Record<string, CartItem[]>, item: CartItem) => {
      const vendor = item.vendor || 'The Fruit Tribe';
      if (!acc[vendor]) acc[vendor] = [];
      acc[vendor].push(item);
      return acc;
    }, {});
  }, [items]);

  const cartPricingEstimate = useMemo(() => {
    return estimateCartLineTotalsWithTierDiscount(items as any, products as any);
  }, [items, products]);

  const subtotalOnly = useMemo(() => {
    return cartPricingEstimate.subtotal;
  }, [cartPricingEstimate]);

  const shippingFeeForDistance = useMemo(() => {
    if (!isAddressResolvedForPricing) return 0;
    const fallbackDeliveryCharge = effectivePricing.deliveryCharge;
    const rules = effectivePricing.deliveryFeeRules;
    const mode = effectivePricing.deliveryFeeMode;
    const perKmRate = effectivePricing.deliveryPerKmRate;
    const distanceForPricing =
      typeof deliveryDistance === 'number' && Number.isFinite(deliveryDistance)
        ? deliveryDistance
        : Number.NaN;
    return computeDeliveryFeeByDistanceKm(
      distanceForPricing,
      rules,
      fallbackDeliveryCharge,
      mode,
      perKmRate,
      subtotalOnly,
      effectivePricing.freeDeliveryThreshold,
    );
  }, [
    isAddressResolvedForPricing,
    deliveryDistance,
    subtotalOnly,
    effectivePricing,
  ]);

  const vendorSummaries = useMemo(() => {
    const entries = Object.entries(groupedItems);
    return entries.map(([vendor, vendorItems], i) => {
      const vSubtotal = vendorItems.reduce((sum, i) => {
        const lineKey = `${String(i.id)}::${String((i as any).selectedVariantSku || (i as any).selectedVariantId || '')}`;
        const lineAmount = Number(cartPricingEstimate.lineTotals[lineKey] ?? (i.price * i.quantity));
        return sum + lineAmount;
      }, 0);
      const vTax = vendorItems.reduce((totalTax, item) => {
        const product = products.find((p: any) =>
          String(p.id) === String((item as any).productId ?? item.id)
        );
        const category = String(product?.category || '').trim();
        const rate = category
          ? Number(
            effectivePricing.taxRates[category] ??
            effectivePricing.taxRates[category.toLowerCase()] ??
            effectivePricing.taxRates[category.toUpperCase()] ??
            0,
          )
          : 0;
        const lineKey = `${String(item.id)}::${String((item as any).selectedVariantSku || (item as any).selectedVariantId || '')}`;
        const lineAmount = Number(cartPricingEstimate.lineTotals[lineKey] ?? (item.price * item.quantity));
        return totalTax + (lineAmount * (rate / 100));
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
  }, [groupedItems, products, effectivePricing, shippingFeeForDistance, cartPricingEstimate]);

  const totalShipping = useMemo(() => {
    return vendorSummaries.reduce((sum: number, s: any) => sum + s.shipping, 0);
  }, [vendorSummaries]);

  const platformFee = effectivePricing.platformFee;
  const orderTaxAmount = useMemo(() => {
    return items.reduce((totalTax, item) => {
      const product = products.find((p: any) =>
        String(p.id) === String((item as any).productId ?? item.id)
      );
      const category = String(product?.category || '').trim();
      const rate = category
        ? Number(
          effectivePricing.taxRates[category] ??
          effectivePricing.taxRates[category.toLowerCase()] ??
          effectivePricing.taxRates[category.toUpperCase()] ??
          0,
        )
        : 0;
      const lineKey = `${String(item.id)}::${String((item as any).selectedVariantSku || (item as any).selectedVariantId || '')}`;
      const lineAmount = Number(cartPricingEstimate.lineTotals[lineKey] ?? (item.price * item.quantity));
      return totalTax + (lineAmount * (rate / 100));
    }, 0);
  }, [items, products, effectivePricing, cartPricingEstimate]);
  const baseBillBeforeDiscount = useMemo(() => {
    return subtotalOnly + orderTaxAmount + totalShipping + platformFee;
  }, [subtotalOnly, orderTaxAmount, totalShipping, platformFee]);

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

  const grandTotal = Math.max(0, baseBillBeforeDiscount - discountAmount);
  const [persistedGrandTotal, setPersistedGrandTotal] = useState<number | null>(null);
  const payableGrandTotal = persistedGrandTotal ?? grandTotal;

  /** Set synchronously before clearCart so empty-cart redirect cannot beat React state batching. */
  const orderJustPlacedRef = useRef(false);
  const [orderPlacedOptimistically, setOrderPlacedOptimistically] = useState(false);
  const [paymentAwaiting, setPaymentAwaiting] = useState(false);
  const [optimisticOrderId, setOptimisticOrderId] = useState<string | null>(null);
  const [optimisticOrderNumber, setOptimisticOrderNumber] = useState<string | null>(null);
  const [optimisticAmount, setOptimisticAmount] = useState(0);
  useEffect(() => {
    if (!orderPlacedOptimistically) {
      setPersistedGrandTotal(null);
    }
  }, [grandTotal, orderPlacedOptimistically]);

  const applyPromoCode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      toast.error('Enter a promo code');
      return;
    }
    if (appliedCoupon?.code?.toUpperCase() === code.toUpperCase()) {
      toast.info(`${code.toUpperCase()} is already applied`);
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
        if (result.minOrderValue != null && subtotalOnly < result.minOrderValue) {
          const needed = Math.max(0, result.minOrderValue - subtotalOnly);
          setAppliedCoupon(null);
          toast.error(`Add ₹${needed.toFixed(2)} more to use ${code}`);
          return;
        }
        setAppliedCoupon({
          code,
          discountType: result.discountType,
          discountValue: result.discountValue,
          maxDiscount: result.maxDiscount ?? undefined,
          minOrderValue: result.minOrderValue ?? undefined,
        });
        toast.success(`Promo code ${code.toUpperCase()} applied`);
      } else {
        toast.error(result.message || 'Invalid promo code');
        setAppliedCoupon(null);
      }
    } catch (e: any) {
      toast.error(getUserErrorMessage(e, 'Could not validate promo code'));
      setAppliedCoupon(null);
    } finally {
      setApplyingPromo(false);
    }
  };

  useEffect(() => {
    if (!appliedCoupon) return;
    if (appliedCoupon.minOrderValue != null && subtotalOnly < appliedCoupon.minOrderValue) {
      setAppliedCoupon(null);
      toast.info('Coupon removed because cart value dropped below minimum order.');
    }
  }, [appliedCoupon, subtotalOnly]);

  const handleApplyPromo = async () => {
    await applyPromoCode(promoCode);
  };

  const handleRemovePromo = () => {
    setAppliedCoupon(null);
    setPromoCode('');
    toast.success('Promo code removed');
  };

  const handleSavedAddressPick = (id: string) => {
    if (!id) {
      setSelectedSavedAddressId('');
      setSaveNewAddressToAccount(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        flatHouse: '',
        address: '',
        city: DELIVERY_CITY_FIXED,
        state: DELIVERY_STATE_FIXED,
        zipCode: '',
        landmark: '',
        deliveryInstructions: '',
      });
      setFullNameInput('');
      setFieldErrors({});
      setAddressType('home');
      setSetAsDefaultAddress(false);
      setDeliverySlot('');
      setMapCenter(null);
      setLocationMeta({ source: null, accuracyMeters: null });
      setDeliveryStats({ distanceKm: null, onTimeRate: null, estimatedMins: null });
      geocodeRequestSeqRef.current += 1;
      lastDistancePinRef.current = '';
      lastSuccessfulGeocodeShapeKeyRef.current = '';
      pinProvisionalBlockRef.current = false;
      return;
    }
    const row = savedAddresses.find((a) => a.id === id);
    if (!row || !user) return;
    setFormData((prev) => ({
      ...prev,
      ...savedAddressToCheckoutForm(row, user.email || prev.email || ''),
      city: DELIVERY_CITY_FIXED,
      state: DELIVERY_STATE_FIXED,
    }));
    setSelectedSavedAddressId(id);
    setSaveNewAddressToAccount(false);
  };

  const validateField = useCallback((name: keyof typeof formData, value: string): string => {
    const trimmed = String(value || '').trim();
    if (
      ['firstName', 'flatHouse', 'address', 'city', 'state', 'zipCode', 'phone', 'email'].includes(name) &&
      !trimmed
    ) {
      return 'This field is required.';
    }
    if (name === 'zipCode') {
      const d = trimmed.replace(/\D/g, '');
      if (d.length !== 6) return 'Enter a valid 6-digit PIN code.';
      if (serviceablePincodes.length > 0 && !serviceablePincodes.includes(d)) {
        return 'Not deliverable — this PIN is not in our service area.';
      }
    }
    if (name === 'email' && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Enter a valid email address.';
    }
    if (name === 'phone') {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 10) return 'Enter a valid 10-digit phone number.';
    }
    return '';
  }, [serviceablePincodes]);

  const submitCheckout = async () => {
    const nextErrors: Partial<Record<keyof typeof formData, string>> = {};
    (Object.keys(formData) as Array<keyof typeof formData>).forEach((key) => {
      const message = validateField(key, String(formData[key] ?? ''));
      if (message) nextErrors[key] = message;
    });
    if (Object.values(nextErrors).some(Boolean)) {
      setFieldErrors(nextErrors);
      toast.error('Please fix the highlighted fields before placing the order.');
      return;
    }

    let deferSubmittingResetInFinally = false;

    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 20));

    try {
      if (!user) {
        toast.error('Please log in to place an order', { description: 'Your order will be saved to your account.' });
        navigate('/login', { state: { from: '/checkout' } });
        return;
      }
      if (!(typeof deliveryDistance === 'number' && Number.isFinite(deliveryDistance) && deliveryDistance >= 0)) {
        toast.error('Calculating delivery amount. Please wait a moment and try again.');
        return;
      }

      const orderItems: Array<{ productId: string; variantId: string; quantity: number }> = [];
      const uuidLike = (s: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s).trim());
      for (const item of items) {
        const product = products.find((p: any) => p.id === item.id || String(p.id) === String(item.id));
        if (!product) {
          toast.error(`Product "${item.name}" is no longer available. Please update your cart.`);
          return;
        }
        const requestedQty = Number(item.quantity) || 1;
        const variants = Array.isArray((product as any).variants) ? (product as any).variants : [];
        if (variants.length === 0) {
          toast.error(`No variants available for "${item.name}".`);
          return;
        }
        const selectedVariantIdRaw = String((item as any).selectedVariantId || '').trim();
        if (!selectedVariantIdRaw) {
          toast.error(`Cart data is outdated for "${item.name}". Please clear cart and add again.`);
          return;
        }
        const pickedVariant = variants.find((v: any) => String(v.id || '') === selectedVariantIdRaw);
        if (!pickedVariant) {
          toast.error(`Selected pack for "${item.name}" is no longer available. Please clear cart and add again.`);
          return;
        }
        const available = Number((pickedVariant as any).availableStock ?? (pickedVariant as any).availableQuantity ?? (pickedVariant as any).stock ?? 0);
        if (available < requestedQty) {
          toast.error(`Only ${available} units available for selected pack in "${item.name}".`);
          return;
        }
        const variantId = pickedVariant?.id != null ? String(pickedVariant.id) : '';
        if (!variantId) {
          toast.error(`Unable to place order: missing details for "${item.name}". Please refresh and try again.`);
          return;
        }
        const productId = String(product.id);
        if (!uuidLike(productId) || !uuidLike(variantId)) {
          toast.error('Product data is still loading or invalid. Please refresh the page and try again.');
          return;
        }
        orderItems.push({
          productId,
          variantId,
          quantity: requestedQty,
        });
      }

      const shippingAddress = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: [formData.flatHouse, formData.address, formData.landmark].filter(Boolean).join(', '),
        city: formData.city,
        zipCode: formData.zipCode,
        state: formData.state?.trim() || 'Karnataka',
        latitude: mapCenter?.lat ?? null,
        longitude: mapCenter?.lng ?? null,
        locationSource: locationMeta.source,
        locationAccuracyMeters: locationMeta.accuracyMeters,
        deliveryInstructions: formData.deliveryInstructions || null,
      };

      let checkoutPayableAmount = Math.max(0, Math.round(grandTotal * 100) / 100);
      try {
        const simulated = await simulateOrderPricing({
          items: orderItems,
          couponCode: appliedCoupon?.code || undefined,
          distanceKm: deliveryDistance ?? undefined,
          shippingAddress,
        });
        const simulatedPayable = Number((simulated as any)?.payableAmount);
        if (Number.isFinite(simulatedPayable) && simulatedPayable >= 0) {
          checkoutPayableAmount = Math.round(simulatedPayable * 100) / 100;
        }
      } catch (simErr: any) {
        toast.error(getUserErrorMessage(simErr, 'Unable to verify final price. Please review cart and try again.'));
        return;
      }
      setOptimisticAmount(checkoutPayableAmount);
      setPersistedGrandTotal(null);
      const created = await createOrder({
        items: orderItems,
        shippingAddress,
        billingAddress: shippingAddress,
        couponCode: appliedCoupon?.code || undefined,
        deliverySlot: deliverySlot || undefined,
        distanceKm: deliveryDistance,
        paymentMethod: paymentMethod,
        savedAddressId: selectedSavedAddressId || undefined,
      });

      if (saveNewAddressToAccount && user) {
        try {
          await createUserAddress({
            label: addressType === 'home' ? 'Home' : addressType === 'work' ? 'Work' : 'Other',
            name: `${formData.firstName} ${formData.lastName}`.trim(),
            phone: formData.phone.trim(),
            addressLine1: [formData.flatHouse, formData.address].filter(Boolean).join(', ') || formData.address.trim(),
            addressLine2: formData.landmark?.trim() || null,
            city: formData.city.trim(),
            state: (formData.state || 'Karnataka').trim(),
            pincode: formData.zipCode.replace(/\D/g, '').slice(0, 6),
            isDefault: setAsDefaultAddress,
          });
          toast.success('Address saved to your account');
        } catch (addrErr: unknown) {
          const msg = getUserErrorMessage(addrErr, 'Could not save address');
          toast.error('Order placed, but saving this address failed', { description: msg });
        }
      }

      const orderId = created.id as string;
      const orderNumber = (created.orderNumber as string) || orderId;
      const serverPayable = Number((created as any).payableAmount);
      const payableAmount =
        Number.isFinite(serverPayable) && serverPayable > 0
          ? Math.round(serverPayable * 100) / 100
          : checkoutPayableAmount;
      const amountInPaise = Math.round(payableAmount * 100);
      setPersistedGrandTotal(payableAmount);
      if (Number.isFinite(serverPayable) && Math.abs(serverPayable - checkoutPayableAmount) >= 0.5) {
        toast.info(`Payment amount confirmed: ₹${payableAmount.toFixed(2)}`, {
          description: 'Your payable amount has been synced with the latest checkout total.',
        });
      }

      setOptimisticOrderId(orderId);
      setOptimisticOrderNumber(orderNumber);
      setOptimisticAmount(payableAmount);

      orderJustPlacedRef.current = true;
      flushSync(() => {
        setOrderPlacedOptimistically(true);
      });

      clearCart();

      if (paymentMethod === 'cod') {
        toast.success('Order placed. Pay when you receive.', {
          description: `Order #${orderNumber} — Cash on Delivery`,
          icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
        });
        return;
      }

      deferSubmittingResetInFinally = true;
      setPaymentAwaiting(true);
      setSubmitting(false);

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
              setPaymentAwaiting(false);
              toast.success('Order placed and payment successful.', {
                description: `Order #${orderNumber}`,
                icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
              });
              navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
            } catch (err: unknown) {
              setPaymentAwaiting(false);
              toast.error(
                getUserErrorMessage(err, 'Payment verification failed. Order is placed; contact support with your order number.'),
              );
              navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
            }
          },
          modal: {
            ondismiss: () => {
              setPaymentAwaiting(false);
              clearCart();
              orderJustPlacedRef.current = false;
              setOrderPlacedOptimistically(false);
              navigate('/cart', { replace: true });

              const PAYMENT_POLL_DELAY_MS = 2500;
              setTimeout(async () => {
                try {
                  const orders = await getOrders();
                  const order = orders.find((o: { id: string; paymentStatus?: string }) => String(o.id) === String(orderId));
                  if (order?.paymentStatus === 'PAID') {
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
                toast.info('Payment step not completed.', {
                  description: `Order #${orderNumber} is still pending. Your cart is empty for this order — pay anytime from My Orders.`,
                });
              }, PAYMENT_POLL_DELAY_MS);
            },
          },
        });
        rzp.open();
      } catch (razorpayErr: unknown) {
        const msg = getUserErrorMessage(razorpayErr, '');
        if (msg.includes('Razorpay is not configured') || msg.includes('not configured')) {
          toast.success('Order placed. Razorpay is not set up; pay later from My Orders.', {
            description: `Order #${orderNumber}`,
            icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
          });
        } else {
          toast.warning('Order placed. Payment step failed: ' + (msg || 'Unknown error'), {
            description: `Order #${orderNumber}. You can pay from My Orders.`,
          });
        }
        navigate('/order-confirmation', { state: { orderId, orderNumber, allOrders: [orderId] } });
      }
    } catch (err: unknown) {
      toast.error(getUserErrorMessage(err, 'Failed to place order. Please try again.'));
    } finally {
      if (!deferSubmittingResetInFinally) {
        setSubmitting(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitCheckout();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'city' || name === 'state') return;
    setSelectedSavedAddressId('');
    setFormData({ ...formData, [name]: value });

    if (name === 'zipCode') {
      const d = value.replace(/\D/g, '');
      const zipMsg =
        serviceablePincodes.length > 0 && d.length === 6 && !serviceablePincodes.includes(d)
          ? 'Not deliverable — this PIN is not in our service area.'
          : '';
      setFieldErrors((prev) => ({ ...prev, zipCode: zipMsg }));
      return;
    }

    if (fieldErrors[name as keyof typeof formData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFullNameChange = (value: string) => {
    setFullNameInput(value);
    const parts = value
      .replace(/^\s+/, '')
      .split(/\s+/)
      .filter(Boolean);
    setSelectedSavedAddressId('');
    setFormData((prev) => ({
      ...prev,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' '),
    }));
    if (fieldErrors.firstName || fieldErrors.lastName) {
      setFieldErrors((prev) => ({ ...prev, firstName: '', lastName: '' }));
    }
  };

  const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const key = name as keyof typeof formData;
    const message = validateField(key, value);
    setFieldErrors((prev) => ({ ...prev, [key]: message }));
  };

  const isCheckoutFormReady = useMemo(() => {
    const requiredKeys: Array<keyof typeof formData> = [
      'firstName',
      'email',
      'phone',
      'flatHouse',
      'address',
      'city',
      'state',
      'zipCode',
    ];

    const hasMissingRequired = requiredKeys.some((key) => {
      const raw = String(formData[key] ?? '').trim();
      return !raw;
    });
    if (hasMissingRequired) return false;

    const hasValidationError = requiredKeys.some((key) => Boolean(validateField(key, String(formData[key] ?? ''))));
    if (hasValidationError) return false;

    if (!(typeof deliveryDistance === 'number' && Number.isFinite(deliveryDistance) && deliveryDistance >= 0)) {
      return false;
    }

    return true;
  }, [formData, validateField, deliveryDistance]);

  if (items.length === 0 && !orderPlacedOptimistically && !orderJustPlacedRef.current) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 selection:bg-emerald-200 selection:text-emerald-950 overflow-x-hidden lg:min-h-0 lg:h-[100dvh] lg:flex lg:flex-col lg:overflow-hidden">
      <div className="pt-20 flex-1 flex flex-col min-h-0 lg:overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col min-h-0 lg:overflow-hidden pb-3">
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 lg:overflow-hidden">
          {/* Top Bar */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm flex justify-between items-center mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distance</p>
                <p className="text-sm font-bold text-slate-900">{deliveryDistance != null ? `${deliveryDistance} km` : '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">On-Time</p>
                <p className="text-sm font-bold text-slate-900">{deliveryStats.onTimeRate != null ? `${deliveryStats.onTimeRate}%` : '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ETA</p>
                <p className="text-sm font-bold text-slate-900">{etaLabel || '—'}</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-stretch gap-4 lg:gap-5 min-h-0 flex-1 lg:overflow-hidden">
            {/* Left Column - Forms */}
            <div className="w-full min-h-0 flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden order-2 lg:order-1">
              {/* Shipping Information */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full max-w-full bg-white rounded-xl lg:rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col min-h-0 lg:max-h-none lg:flex-1 lg:h-full overflow-hidden lg:overflow-y-auto overscroll-contain custom-scrollbar"
              >
                <div className="flex justify-between items-start mb-3 flex-shrink-0">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-200">
                        <MapPin className="w-[18px] h-[18px] text-white" />
                      </div>
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-wide uppercase">Delivery details</h2>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-11 -mt-0.5">
                      Delivery area: <span className="font-semibold text-emerald-600">{DELIVERY_CITY_FIXED}, {DELIVERY_STATE_FIXED}</span> only.
                    </p>
                  </div>

                  {user && savedAddresses.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block text-right">Saved addresses</label>
                      <select
                        value={selectedSavedAddressId}
                        onChange={(e) => handleSavedAddressPick(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-xs font-semibold text-slate-800 shadow-sm"
                      >
                        <option value="">+ Enter a new address</option>
                        {savedAddresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {(a.label ? `${a.label} • ` : '') + a.name} — {a.city}, {a.pincode}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Address type</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { key: 'home' as const, label: 'Home', Icon: Home },
                        { key: 'work' as const, label: 'Work', Icon: Building2 },
                        { key: 'other' as const, label: 'Other', Icon: MapPin },
                      ].map((type) => (
                        <button
                          key={type.key}
                          type="button"
                          onClick={() => setAddressType(type.key)}
                          className={cn(
                            'rounded-lg border-2 px-1.5 py-1.5 sm:py-2 flex flex-col items-center justify-center gap-0.5 transition-all text-[9px] sm:text-[10px] font-bold uppercase tracking-wide',
                            addressType === type.key
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/30'
                          )}
                        >
                          <type.Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 opacity-90" aria-hidden />
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="grid md:grid-cols-2 gap-1.5 sm:gap-2">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          Full name<span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          value={fullNameInput}
                          onChange={(e) => handleFullNameChange(e.target.value)}
                          onBlur={() => {
                            const firstError = validateField('firstName', formData.firstName);
                            const lastError = validateField('lastName', formData.lastName);
                            setFieldErrors((prev) => ({ ...prev, firstName: firstError, lastName: lastError }));
                          }}
                          required
                          placeholder="Priya Sharma"
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition-all text-xs sm:text-sm font-bold placeholder:text-slate-400"
                        />
                        {(fieldErrors.firstName || fieldErrors.lastName) && (
                          <p className="text-[10px] text-red-600 pl-2 font-bold">{fieldErrors.firstName || fieldErrors.lastName}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          Phone number<span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          onBlur={handleFieldBlur}
                          required
                          placeholder="+91 98765 43210"
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition-all text-xs sm:text-sm font-bold placeholder:text-slate-400"
                        />
                        {fieldErrors.phone && <p className="text-[10px] text-red-600 pl-2 font-bold">{fieldErrors.phone}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          Flat / House no. &amp; Building name<span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          name="flatHouse"
                          value={formData.flatHouse}
                          onChange={handleChange}
                          onBlur={handleFieldBlur}
                          required
                          placeholder="Flat 4B, Green Towers"
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition-all text-xs sm:text-sm font-bold placeholder:text-slate-400"
                        />
                        {fieldErrors.flatHouse && <p className="text-[10px] text-red-600 pl-2 font-bold">{fieldErrors.flatHouse}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          Area / Street / Locality<span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          onBlur={handleFieldBlur}
                          required
                          placeholder="HSR Layout Sector 2"
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition-all text-xs sm:text-sm font-bold placeholder:text-slate-400"
                        />
                        {fieldErrors.address && <p className="text-[10px] text-red-600 pl-2 font-bold">{fieldErrors.address}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          Landmark (optional)
                        </label>
                        <input
                          type="text"
                          name="landmark"
                          value={formData.landmark}
                          onChange={handleChange}
                          placeholder="Near Forum Mall"
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition-all text-xs sm:text-sm font-bold placeholder:text-slate-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          City<span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          readOnly
                          aria-readonly="true"
                          title="Delivery is only available in Bengaluru"
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-slate-100 bg-slate-100 text-slate-700 cursor-not-allowed text-xs sm:text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          Pin code
                        </label>
                        <input
                          type="text"
                          name="zipCode"
                          value={formData.zipCode}
                          onChange={handleChange}
                          onBlur={handleFieldBlur}
                          placeholder="560102"
                          inputMode="numeric"
                          maxLength={8}
                          className={cn(
                            'w-full px-3 py-1.5 rounded-lg border-2 bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition-all text-xs sm:text-sm font-bold placeholder:text-slate-400',
                            fieldErrors.zipCode ? 'border-red-300 focus:border-red-400' : 'border-slate-100',
                          )}
                        />
                        {fieldErrors.zipCode && <p className="text-[10px] text-red-600 pl-2 font-bold">{fieldErrors.zipCode}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          State<span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <select
                          name="state"
                          value={formData.state}
                          disabled
                          aria-readonly="true"
                          title="Delivery is only in Karnataka"
                          className="w-full px-3 py-1.5 rounded-lg border-2 border-slate-100 bg-slate-50 text-slate-700 cursor-not-allowed text-xs sm:text-sm font-bold appearance-none"
                        >
                          <option value={DELIVERY_STATE_FIXED}>{DELIVERY_STATE_FIXED}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 flex items-center gap-2 text-[11px] font-medium text-emerald-700">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    Your address is safe and secure with us.
                  </p>

                  <details className="group checkout-extras mt-2 border-t border-slate-100 pt-2 marker:content-['']">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Additional details</span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 sm:space-y-3 pt-2 pb-1">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          Delivery instructions (optional)
                        </label>
                        <input
                          type="text"
                          name="deliveryInstructions"
                          value={formData.deliveryInstructions}
                          onChange={handleChange}
                          placeholder="Leave at the door, ring twice…"
                          className="w-full px-3 py-2 rounded-lg border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition-all text-xs sm:text-sm font-bold placeholder:text-slate-400"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                          Email<span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          onBlur={handleFieldBlur}
                          required
                          placeholder="you@email.com"
                          className="w-full px-3 py-2 rounded-lg border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition-all text-xs sm:text-sm font-bold placeholder:text-slate-400"
                        />
                        {fieldErrors.email && <p className="text-[10px] text-red-600 pl-2 font-bold">{fieldErrors.email}</p>}
                      </div>
                      <div className="space-y-2 pt-1">
                        <label htmlFor="setDefaultAddress" className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            id="setDefaultAddress"
                            checked={setAsDefaultAddress}
                            onChange={(e) => setSetAsDefaultAddress(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-[11px] font-bold text-slate-700 leading-snug">
                            Set as default address for checkout
                          </span>
                        </label>
                        {user && !selectedSavedAddressId && (
                          <label htmlFor="saveAddressToAccount" className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              id="saveAddressToAccount"
                              checked={saveNewAddressToAccount}
                              onChange={(e) => setSaveNewAddressToAccount(e.target.checked)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-[11px] font-bold text-slate-600 leading-snug">
                              Save this address to my account
                            </span>
                          </label>
                        )}
                      </div>
                      <div className="space-y-1.5 pt-1 border-t border-slate-100">
                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider pl-0.5">
                          Delivery slot <span className="font-normal normal-case text-slate-400">(optional)</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          {deliverySlotOptions.length === 0 ? (
                            <p className="text-[10px] text-slate-400 font-bold col-span-full py-1">No slots for today.</p>
                          ) : (
                            deliverySlotOptions.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setDeliverySlot(slot)}
                                className={cn(
                                  'px-3 py-2 rounded-lg border text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-left transition-all',
                                  deliverySlot === slot
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40',
                                )}
                              >
                                {slot}
                              </button>
                            ))
                          )}
                        </div>
                        {!deliverySlot && hasConfiguredDeliverySlots && (
                          <p className="text-[10px] font-semibold text-slate-400">
                            You can pick a preferred window — orders still go through if you skip this.
                          </p>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              </motion.div>

            </div>

            {/* Right Column - Order Summary — flex + internal scroll on desktop so CTA stays visible */}
            <div className="w-full min-h-0 flex flex-col lg:flex-1 lg:min-h-0 order-1 lg:order-2">
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full max-w-full bg-white rounded-xl lg:rounded-2xl p-2 sm:p-3 border border-slate-200/80 shadow-sm relative flex flex-col min-h-0 max-h-[calc(100dvh-12rem)] lg:max-h-none lg:flex-1 lg:h-full overflow-hidden"
                >
                  <div className="shrink-0 flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-200">
                      <ShoppingBag className="w-[18px] h-[18px] text-white" />
                    </div>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">Order summary</h2>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar space-y-3 pr-0.5 pb-1">
                  <div className="space-y-2 sm:space-y-3">
                    {vendorSummaries.map((summary) => (
                      <div key={summary.vendor} className="space-y-4">
                        {vendorSummaries.length > 1 ? (
                          <div className="flex items-center gap-2 mb-1">
                            <div className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[9px] font-bold rounded-md border border-emerald-100 uppercase tracking-wide">
                              {summary.vendor}
                            </div>
                          </div>
                        ) : null}
                        <div className="space-y-3">
                          {summary.items.map((item: CartItem) => (
                            <div key={`${item.id}-${item.selectedVariantSku || item.selectedVariantId || 'default'}`} className="flex items-center gap-3 sm:gap-4">
                              {(() => {
                                const lineKey = `${String(item.id)}::${String(item.selectedVariantSku || item.selectedVariantId || '')}`;
                                return (
                                  <>
                              {/* Product Image */}
                              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-200/80 shadow-inner">
                                <img
                                  src={getImageDisplayUrl(item.image || '')}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight mb-0.5">{item.name}</p>
                                {item.selectedVariantName && (
                                  <p className="text-[11px] text-slate-500">
                                    Pack: <span className="font-medium text-slate-700">{item.selectedVariantName}</span>
                                  </p>
                                )}
                              </div>

                              {/* Quantity Controls & Subtotal */}
                              <div className="flex items-center gap-3">
                                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => item.quantity <= 1 ? handleRemoveItem(lineKey) : handleUpdateQuantity(lineKey, -1)}
                                    className="h-7 w-7 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-md transition-colors"
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="min-w-[1.75rem] text-center text-xs font-semibold text-slate-900 tabular-nums">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const product = products.find((p: any) => String(p.id) === String(item.id));
                                      const avail = Number((product as any)?.availableStock ?? (product as any)?.stock ?? 0);
                                      if (!product || item.quantity < avail) handleUpdateQuantity(lineKey, 1);
                                      else toast.error(`Max stock: ${avail}`);
                                    }}
                                    className="h-7 w-7 flex items-center justify-center text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 rounded-md transition-colors"
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums shrink-0 min-w-[3rem] text-right">
                                  ₹{
                                    Number(
                                      cartPricingEstimate.lineTotals[
                                        `${String(item.id)}::${String((item as any).selectedVariantSku || (item as any).selectedVariantId || '')}`
                                      ] ?? (item.price * item.quantity),
                                    ).toFixed(2)
                                  }
                                </p>
                              </div>
                                  </>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price snapshot — compact for viewport fit */}
                  <div className="space-y-1.5 rounded-lg border border-slate-200/90 bg-slate-50/60 p-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-900 tabular-nums">₹{subtotalOnly.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Delivery charges</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {isAddressResolvedForPricing ? `₹${typeof shippingFeeForDistance === 'number' ? shippingFeeForDistance.toFixed(2) : String(shippingFeeForDistance ?? 0)}` : '—'}
                      </span>
                    </div>
                    {discountAmount > 0 ? (
                      <div className="flex justify-between text-xs text-emerald-700">
                        <span>Discount{appliedCoupon?.code ? ` (${appliedCoupon.code})` : ''}</span>
                        <span className="font-semibold tabular-nums">-₹{discountAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="rounded-md bg-slate-100/90 border border-slate-200/60 px-3 py-2 flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-700">Total amount</span>
                      <span className="text-base font-bold text-emerald-600 tabular-nums">₹{payableGrandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <details className="group marker:content-['']">
                      <summary className="flex items-center justify-between cursor-pointer list-none bg-white p-2.5 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 transition-colors shadow-sm">
                         <div className="flex items-center gap-2.5">
                           <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                             <FileText className="w-4 h-4 text-emerald-600" />
                           </div>
                           <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">Bill details</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 group-open:hidden tabular-nums">₹{payableGrandTotal.toFixed(2)}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:-rotate-180" />
                         </div>
                      </summary>
                      <div className="pt-5 px-1 space-y-3.5 animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>Items Total</span>
                          <span className="text-slate-900 font-black">₹{vendorSummaries.reduce((sum, s) => sum + s.subtotal, 0)}</span>
                        </div>
                        {isAddressResolvedForPricing && (
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>Delivery Fee ({deliveryDistance == null ? '—' : `${deliveryDistance} km`})</span>
                            {shippingFeeForDistance === 0 ? (
                              <span className="text-slate-900 font-black">₹0</span>
                            ) : (
                              <span className="text-slate-900 font-black">₹{shippingFeeForDistance}</span>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>Tax</span>
                          <span className="text-slate-900 font-black">₹{orderTaxAmount.toFixed(2)}</span>
                        </div>
                        {platformFee > 0 && (
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>Platform Fee</span>
                            <span className="text-slate-900 font-black">₹{platformFee}</span>
                          </div>
                        )}
                      </div>
                    </details>

                    {subtotalOnly < effectivePricing.freeDeliveryThreshold && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-emerald-600" />
                          <div>
                            <p className="text-[10px] font-bold text-emerald-800 uppercase">Free Delivery Unlock</p>
                            <p className="text-[9px] text-emerald-600">Add ₹{(effectivePricing.freeDeliveryThreshold - subtotalOnly).toFixed(2)} more to pay ₹0 delivery</p>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-emerald-600 -rotate-90" />
                      </div>
                    )}

                    {/* Promo code — collapsible like reference */}
                    <details className="group promo-details marker:content-['']">
                      <summary className="flex items-center justify-between cursor-pointer list-none bg-white p-2.5 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/20 transition-colors shadow-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                            <Tag className="w-4 h-4 text-emerald-600" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">Promo code</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:-rotate-180" />
                      </summary>
                      <div className="pt-4 space-y-3 px-0.5">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!applyingPromo && promoCode.trim()) void handleApplyPromo();
                              }
                            }}
                            placeholder="Enter code"
                            className="flex-1 w-full min-w-0 h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm font-semibold uppercase min-h-[44px]"
                          />
                          <button
                            type="button"
                            onClick={handleApplyPromo}
                            disabled={applyingPromo || !promoCode.trim()}
                            className={cn(
                              'h-11 shrink-0 px-5 rounded-xl font-bold text-[11px] uppercase tracking-wide transition-all disabled:cursor-not-allowed',
                              appliedCoupon
                                ? 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50',
                            )}
                          >
                            {applyingPromo ? '…' : appliedCoupon ? 'Replace' : 'Apply'}
                          </button>
                        </div>

                        {/* Available Offers */}
                        <div className="space-y-2 pt-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide pl-0.5">Available Offers</p>
                          <div className="border border-dashed border-emerald-300 rounded-lg p-2.5 bg-emerald-50/50 flex justify-between items-center transition-colors hover:bg-emerald-50">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">FRUIT10</span>
                                <span className="text-[10px] font-semibold text-emerald-600">Save 10%</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">Get 10% off on all fruits. Valid on orders above ₹200.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setPromoCode('FRUIT10'); void applyPromoCode('FRUIT10'); }}
                              className="text-[10px] font-bold text-emerald-600 uppercase hover:text-emerald-700 px-2 py-1 rounded border border-emerald-300 bg-white hover:bg-emerald-50 transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                          <div className="border border-dashed border-slate-200 rounded-lg p-2.5 bg-white flex justify-between items-center transition-colors hover:bg-slate-50">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">WELCOME50</span>
                                <span className="text-[10px] font-semibold text-slate-600">Flat ₹50 Off</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">Flat ₹50 off on your first order.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setPromoCode('WELCOME50'); void applyPromoCode('WELCOME50'); }}
                              className="text-[10px] font-bold text-emerald-600 uppercase hover:text-emerald-700 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        </div>

                        {appliedCoupon ? (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                            <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5" />
                              {appliedCoupon.code} — ₹{discountAmount.toFixed(2)} off
                            </p>
                            <button
                              type="button"
                              onClick={handleRemovePromo}
                              className="h-8 px-3 rounded-lg border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase hover:bg-white transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </details>

                    {/* Payment method */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Payment method</p>
                      <div className={cn('grid gap-2', codAllowedForCart ? 'grid-cols-2' : 'grid-cols-1')}>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('online')}
                          className={cn(
                            'p-2.5 rounded-lg border-2 flex items-center gap-2 transition-all text-left group',
                            paymentMethod === 'online'
                              ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-400 hover:border-emerald-200'
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            paymentMethod === 'online' ? "bg-slate-900 text-emerald-400" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                          )}>
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <p className={cn("font-black text-[10px] uppercase tracking-tight", paymentMethod === 'online' ? "text-slate-900" : "text-slate-400")}>Pay online</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">UPI, Card, Net</p>
                          </div>
                        </button>
                        {codAllowedForCart ? (
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('cod')}
                            className={cn(
                              'p-2.5 rounded-lg border-2 flex items-center gap-2 transition-all text-left group',
                              paymentMethod === 'cod'
                                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-400 hover:border-emerald-200'
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                              paymentMethod === 'cod' ? "bg-slate-900 text-emerald-400" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                            )}>
                              <Banknote className="w-4 h-4" />
                            </div>
                            <div>
                              <p className={cn("font-black text-[10px] uppercase tracking-tight", paymentMethod === 'cod' ? "text-slate-900" : "text-slate-400")}>Cash on delivery</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">Pay at door</p>
                            </div>
                          </button>
                        ) : (
                          <div className="p-3 rounded-xl border-2 border-slate-50 bg-slate-50/50 flex items-center gap-2.5 text-left opacity-60">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-400 flex items-center justify-center">
                              <Banknote className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-black text-[10px] uppercase tracking-tight text-slate-400">COD unavailable</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">Cart restrictions</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>

                  <div className="shrink-0 border-t border-slate-100 bg-white pt-2 mt-1">
                    <SwipeToPay
                      onSuccess={() => void submitCheckout()}
                      submitting={submitting}
                      disabled={!isCheckoutFormReady}
                      disabledLabel="Complete address & delivery fee"
                      className="h-12 sm:h-14 rounded-lg"
                      themeStyle="square"
                    />
                    {!isCheckoutFormReady && !submitting ? (
                      <p className="mt-1.5 text-center text-[10px] text-slate-500 leading-tight">Complete address &amp; delivery fee to pay.</p>
                    ) : null}
                  </div>
                </motion.div>
            </div>
          </div>
        </form>


        </div>
      </div>

      {orderPlacedOptimistically && (
        <CheckoutSuccessOverlay 
          orderId={optimisticOrderId} 
          orderNumber={optimisticOrderNumber} 
          subtotal={payableGrandTotal}
          isAwaitingPayment={paymentAwaiting}
          onDismiss={() => {
            orderJustPlacedRef.current = false;
            setOrderPlacedOptimistically(false);
          }} 
        />
      )}
    </div>
  );
}

function CheckoutSuccessOverlay({ orderId, orderNumber, subtotal, isAwaitingPayment, onDismiss }: { 
  orderId: string | null, 
  orderNumber: string | null, 
  subtotal: number, 
  isAwaitingPayment?: boolean,
  onDismiss: () => void 
}) {
  const navigate = useNavigate();
  const isProcessing = !orderId;
  const showPaymentPending = isAwaitingPayment && orderId;

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
        <div className={cn(
          "absolute top-0 left-0 w-full h-32 -mt-16 rounded-full blur-3xl opacity-20 transition-colors duration-500", 
          isProcessing || showPaymentPending ? "bg-orange-500" : "bg-emerald-500"
        )} />

        <div className="relative z-10 w-full">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 relative">
                <div className={cn(
                  "absolute inset-0 rounded-full transition-colors duration-500", 
                  isProcessing || showPaymentPending ? "bg-orange-100" : "bg-emerald-100"
                )} />
                <motion.div
                key={isProcessing || showPaymentPending ? 'processing' : 'success'}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl", 
                  isProcessing || showPaymentPending ? "bg-orange-500 shadow-orange-200" : "bg-emerald-500 shadow-emerald-200"
                )}
                >
                {isProcessing || showPaymentPending ? <Loader2 className="w-8 h-8 animate-spin" /> : <ShieldCheck className="w-10 h-10" />}
                </motion.div>
                
                {(!isProcessing && !showPaymentPending) && [...Array(12)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1.5 h-1.5 rounded-full bg-emerald-500"
                        initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0.5],
                            x: Math.cos(i * 30 * Math.PI / 180) * (60 + Math.random() * 40),
                            y: Math.sin(i * 30 * Math.PI / 180) * (60 + Math.random() * 40),
                        }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 + (i * 0.02) }}
                    />
                ))}
            </div>

            <h2 className="text-[28px] leading-tight font-black text-slate-900 mb-2 tracking-tight uppercase">
                {isProcessing ? 'Placing Order...' : showPaymentPending ? 'Awaiting Payment' : 'Order Placed!'}
            </h2>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mb-8">
                {isProcessing ? 'Verifying items & delivery' : `Order #${orderNumber}`}
            </p>

            <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Payable</span>
                    <span className="text-xl font-black text-slate-900 tracking-tight">₹{subtotal.toFixed(2)}</span>
                </div>
                {(!isProcessing && !showPaymentPending) && (
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
                {(isProcessing || showPaymentPending) && (
                    <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 animate-pulse">
                            <Activity className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                {isProcessing ? 'Assigning Partner' : 'Waiting for payment'}
                            </p>
                            <p className="text-xs font-bold text-slate-400 italic">Please wait...</p>
                        </div>
                    </div>
                )}
            </div>

            {(!isProcessing && !showPaymentPending) && (
                <div className="space-y-3">
                    <button
                        onClick={() => navigate('/profile')}
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
