import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'framer-motion';
import { Navigate, useNavigate } from 'react-router-dom';
import { Truck, MapPin, Zap, Activity, ShieldCheck, Loader2, CreditCard, Banknote, Minus, Plus, FileText, ShoppingBag, Tag, ChevronDown, Home, Building2, Navigation, Clock, ChevronLeft, Percent, ChevronRight, Calendar, Heart, Edit, Trash2 } from 'lucide-react';
import { useStore, type CartItem } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
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
  updateUserAddress,
  deleteUserAddress,
  setDefaultUserAddress,
  getEffectiveApiBase,
  invalidateProductsListCache,
  invalidateOrdersCache,
  getImageDisplayUrl,
  getAvailableOffers,
} from '@/lib/api';
import { savedAddressToCheckoutForm, type SavedDeliveryAddress } from '@/lib/deliveryAddressUtils';
import { cn, getRoundedClass, motionTapTransition } from '@/lib/utils';
import { ensureRazorpayScript } from '@/lib/razorpayLoader';
import { computeDeliveryFeeByDistanceKm, qualifiesForFreeDelivery, explainFreeDeliveryEligibility } from '@/lib/deliveryFeeUtils';
import { estimateCartLineTotalsWithTierDiscount } from '@/lib/pricing';
import { getUserErrorMessage } from '@/lib/userError';
import { PRODUCT_PLACEHOLDER_IMAGE } from '@/lib/productPlaceholder';
import { toast } from 'sonner';

interface CheckoutPageProps {
  items: CartItem[];
}

/** Dispatch default when API returns no warehouse rows — must be Bengaluru (was Kolkata by mistake). */
const DEFAULT_WAREHOUSE_LAT = 12.9784;
const DEFAULT_WAREHOUSE_LNG = 77.5946;
/** Street phrase geocode debounce; PIN path runs immediately + sync estimate below. */
const GEOCODE_DEBOUNCE_MS = 50;

/** Straight-line km between two lat/lng points (fallback when Mapbox driving distance is unavailable). */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Single service area — store delivers only within Bengaluru Urban / Karnataka. */
const DELIVERY_CITY_FIXED = 'Bengaluru';
const DELIVERY_STATE_FIXED = 'Karnataka';

/**
 * Offline / throttled fallback & instant preview. Prefer PIN-specific centroids (OSM postal areas),
 * not MG Road — using the city centre made HSR (~560102) look ~20km from a south-side warehouse.
 */
const BENGALURU_PIN_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  /** Central Bengaluru postal area — not HSR; avoids generic 560xxx centroid when geocode fails. */
  '560002': { lat: 12.963522, lng: 77.578832 },
  '560102': { lat: 12.9143784, lng: 77.6432565 },
  '560034': { lat: 12.9352, lng: 77.6245 },
  '560038': { lat: 12.9784, lng: 77.6408 },
  '560066': { lat: 12.9698, lng: 77.75 },
  '560011': { lat: 12.925, lng: 77.5938 },
  '560078': { lat: 12.9077, lng: 77.585 },
  '560100': { lat: 12.8456, lng: 77.6603 },
  '560037': { lat: 12.9592, lng: 77.6974 },
  '560010': { lat: 12.9915, lng: 77.5544 },
  '560001': { lat: 12.9762, lng: 77.6033 },
  '560064': { lat: 13.1007, lng: 77.5963 },
};

/** Street text names another metro while checkout city is fixed Bengaluru — avoid geocoding to wrong city. */
function detectConflictingCityInAddress(flatHouse: string, address: string, serviceCity: string): string | null {
  const blob = `${flatHouse} ${address}`.toLowerCase();
  const otherCities: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(kolkata|calcutta)\b/, label: 'Kolkata' },
    { pattern: /\b(mumbai|bombay)\b/, label: 'Mumbai' },
    { pattern: /\b(delhi|new delhi|noida|gurgaon|gurugram)\b/, label: 'Delhi NCR' },
    { pattern: /\b(chennai|madras)\b/, label: 'Chennai' },
    { pattern: /\b(hyderabad)\b/, label: 'Hyderabad' },
    { pattern: /\b(pune)\b/, label: 'Pune' },
  ];
  for (const { pattern, label } of otherCities) {
    if (pattern.test(blob) && !citiesRoughlyMatch(serviceCity, label)) return label;
  }
  return null;
}

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

function nominatimHitPostcode(hit: NominatimHit): string {
  return String(hit.address?.postcode || '').replace(/\D/g, '').slice(0, 6);
}

/** OSM reports a different 6-digit PIN than checkout — street text geocoded to the wrong area. */
function nominatimHitConflictsWithPin(hit: NominatimHit, pinDigits: string): boolean {
  if (pinDigits.length !== 6) return false;
  const hp = nominatimHitPostcode(hit);
  if (hp.length !== 6) return false;
  return hp !== pinDigits;
}

function scoreNominatimHit(hit: NominatimHit, city: string, hints: string[], pinDigits: string): number {
  const d = String(hit.display_name || '').toLowerCase();
  const cityTok = normalizeLocationToken(city);
  let score = 0;
  const hitPostcode = nominatimHitPostcode(hit);
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
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [deliverySlot, setDeliverySlot] = useState<string>('');
  const [showSlots, setShowSlots] = useState(false);
  const [offersDropdownOpen, setOffersDropdownOpen] = useState(false);
  const offersDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const cartProductIds = Array.from(
          new Set(items.map((i) => String((i as any).productId ?? i.id)).filter(Boolean)),
        );
        const cartCategoryNames = Array.from(
          new Set(
            items
              .map((item) => products.find((p) => String(p.id) === String((item as any).productId ?? item.id))?.category)
              .filter((name): name is string => !!name),
          ),
        );
        const offers = await getAvailableOffers({ cartProductIds, cartCategoryNames });
        setAvailableOffers(offers);
      } catch (err) {
        console.error('Failed to fetch offers:', err);
      }
    };
    void fetchOffers();
  }, [items, products]);

  useEffect(() => {
    if (!offersDropdownOpen) return;
    const onDocumentClick = (e: MouseEvent) => {
      if (!offersDropdownRef.current?.contains(e.target as Node)) {
        setOffersDropdownOpen(false);
      }
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [offersDropdownOpen]);
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
    freeDeliveryWithinKm: number;
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
          freeDeliveryWithinKm: Number((data as any)?.freeDeliveryWithinKm ?? 0) || 0,
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
    freeDeliveryWithinKm: pricingSnapshot?.freeDeliveryWithinKm ?? (Number(preferences.freeDeliveryWithinKm) || 0),
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

  // Address management UI States
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [isEditingAddressId, setIsEditingAddressId] = useState<string | null>(null);
  
  const [addressForm, setAddressForm] = useState({
    label: 'Home' as 'Home' | 'Work' | 'Other',
    name: '',
    phone: '',
    flatHouse: '',
    address: '',
    landmark: '',
    zipCode: '',
    city: DELIVERY_CITY_FIXED,
    state: DELIVERY_STATE_FIXED,
    isDefault: false
  });
  const [addressFormErrors, setAddressFormErrors] = useState<Partial<Record<keyof typeof addressForm, string>>>({});
  const [isSavingAddress, setIsSavingAddress] = useState(false);

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
  /** Street geocode pointed to a different PIN than the user entered (fee uses PIN centroid instead). */
  const [pinStreetGeocodeMismatch, setPinStreetGeocodeMismatch] = useState(false);
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

  const fetchAddressesList = useCallback(async (selectIdAfterLoad?: string) => {
    if (!user?.id) return;
    try {
      const list = await getUserAddresses();
      setSavedAddresses(list);
      if (selectIdAfterLoad) {
        const found = list.find((a) => a.id === selectIdAfterLoad);
        if (found) {
          setFormData((prev) => ({
            ...prev,
            ...savedAddressToCheckoutForm(found, user.email || prev.email || ''),
            city: DELIVERY_CITY_FIXED,
            state: DELIVERY_STATE_FIXED,
          }));
          setSelectedSavedAddressId(selectIdAfterLoad);
        }
      } else if (list.length > 0) {
        // If nothing was selected or selected was not found, check if current selection is still in the list
        const stillExists = list.some((a) => a.id === selectedSavedAddressId);
        if (!stillExists) {
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
      } else {
        setSelectedSavedAddressId('');
      }
    } catch (err) {
      console.error('Failed to reload addresses:', err);
    }
  }, [user?.id, selectedSavedAddressId, user?.email]);

  const startAddAddress = () => {
    setIsAddingNewAddress(true);
    setIsEditingAddressId(null);
    setAddressForm({
      label: 'Home',
      name: `${user?.name || ''}`.trim(),
      phone: user?.phone || '',
      flatHouse: '',
      address: '',
      landmark: '',
      zipCode: '',
      city: DELIVERY_CITY_FIXED,
      state: DELIVERY_STATE_FIXED,
      isDefault: savedAddresses.length === 0,
    });
    setAddressFormErrors({});
  };

  const startEditAddress = (addr: SavedDeliveryAddress) => {
    setIsEditingAddressId(addr.id);
    setIsAddingNewAddress(false);
    
    // addressLine1 can have multiple sections, let's keep it intact as flatHouse is usually merged
    setAddressForm({
      label: (addr.label as 'Home' | 'Work' | 'Other') || 'Home',
      name: addr.name || '',
      phone: addr.phone || '',
      flatHouse: '',
      address: addr.addressLine1 || '',
      landmark: addr.addressLine2 || '',
      zipCode: addr.pincode || '',
      city: addr.city || DELIVERY_CITY_FIXED,
      state: addr.state || DELIVERY_STATE_FIXED,
      isDefault: addr.isDefault,
    });
    setAddressFormErrors({});
  };

  const validateAddressFormField = (name: keyof typeof addressForm, value: string): string => {
    const trimmed = String(value || '').trim();
    if (['name', 'phone', 'address', 'zipCode'].includes(name) && !trimmed) {
      return 'This field is required.';
    }
    if (name === 'zipCode') {
      const d = trimmed.replace(/\D/g, '');
      if (d.length !== 6) return 'Enter a valid 6-digit PIN code.';
      if (serviceablePincodes.length > 0 && !serviceablePincodes.includes(d)) {
        return 'Not deliverable — this PIN is not in our service area.';
      }
    }
    if (name === 'phone') {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 10) return 'Enter a valid 10-digit phone number.';
    }
    return '';
  };

  const handleSaveAddressForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to save addresses.');
      return;
    }

    // Validate fields
    const nextErrors: Partial<Record<keyof typeof addressForm, string>> = {};
    (Object.keys(addressForm) as Array<keyof typeof addressForm>).forEach((key) => {
      if (['landmark', 'flatHouse', 'city', 'state', 'isDefault', 'label'].includes(key)) return;
      const msg = validateAddressFormField(key, String(addressForm[key] ?? ''));
      if (msg) nextErrors[key] = msg;
    });

    if (Object.values(nextErrors).some(Boolean)) {
      setAddressFormErrors(nextErrors);
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setIsSavingAddress(true);
    try {
      const payload = {
        label: addressForm.label,
        name: addressForm.name.trim(),
        phone: addressForm.phone.trim(),
        addressLine1: [addressForm.flatHouse, addressForm.address].filter(Boolean).join(', ') || addressForm.address.trim(),
        addressLine2: addressForm.landmark.trim() || null,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.zipCode.replace(/\D/g, '').slice(0, 6),
        isDefault: addressForm.isDefault,
      };

      let savedAddr: SavedDeliveryAddress;
      if (isEditingAddressId) {
        savedAddr = await updateUserAddress(isEditingAddressId, payload);
        toast.success('Address updated successfully');
      } else {
        savedAddr = await createUserAddress(payload);
        toast.success('Address added successfully');
      }

      await fetchAddressesList(savedAddr.id);
      setIsAddingNewAddress(false);
      setIsEditingAddressId(null);
    } catch (err: any) {
      console.error('Error saving address:', err);
      toast.error(err.message || 'Failed to save address.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    
    try {
      await deleteUserAddress(id);
      toast.success('Address deleted successfully');
      
      if (selectedSavedAddressId === id) {
        setSelectedSavedAddressId('');
        setFormData((prev) => ({
          ...prev,
          flatHouse: '',
          address: '',
          zipCode: '',
          landmark: '',
        }));
      }
      
      await fetchAddressesList();
    } catch (err: any) {
      console.error('Error deleting address:', err);
      toast.error(err.message || 'Failed to delete address.');
    }
  };

  const handleSetDefaultAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await setDefaultUserAddress(id);
      toast.success('Default address updated');
      await fetchAddressesList(selectedSavedAddressId || id);
    } catch (err: any) {
      console.error('Error setting default address:', err);
      toast.error(err.message || 'Failed to set default address.');
    }
  };

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
    let bestKm = Number.POSITIVE_INFINITY;
    for (const s of sources) {
      const d = haversineDistanceKm(s.latitude, s.longitude, lat, lng);
      if (Number.isFinite(d)) bestKm = Math.min(bestKm, d);
    }
    if (Number.isFinite(bestKm) && bestKm < Number.POSITIVE_INFINITY) {
      const distanceKm = Math.round(bestKm * 10) / 10;
      const onTimeRate = Math.min(99, Math.max(85, 95 - Math.floor(distanceKm / 2)));
      const estimatedMins = Math.min(90, Math.max(25, 30 + Math.round(distanceKm * 4)));
      const next = { distanceKm, onTimeRate, estimatedMins };
      drivingDistanceCacheRef.current.set(cacheKey, next);
      setDeliveryStats(next);
    }
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
        setPinStreetGeocodeMismatch(false);
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
      const conflictingCityInStreet = detectConflictingCityInAddress(flatNow, streetNow, DELIVERY_CITY_FIXED);
      /** e.g. "Kolkata" in street + Bengaluru PIN — use PIN centroid only so delivery fee is not cross-country. */
      const skipStreetGeocode = Boolean(conflictingCityInStreet) && pinDigits.length === 6;

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

        let resolved = false;
        if (hasStreet && !skipStreetGeocode) {
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

          const streetEligible =
            pinDigits.length === 6
              ? streetCandidates.filter((h) => !nominatimHitConflictsWithPin(h, pinDigits))
              : streetCandidates;
          const streetPick =
            streetEligible.length > 0
              ? pickBestNominatimHit(streetEligible, cityForScoring, hints, pinDigits)
              : null;

          if (streetPick) {
            if (requestSeq === geocodeRequestSeqRef.current) {
              setPinStreetGeocodeMismatch(false);
            }
            resolved = applyGeocodeHit(streetPick, 'geocode');
            if (resolved) pinProvisionalBlockRef.current = true;
          } else if (
            pinDigits.length === 6 &&
            streetCandidates.some((h) => nominatimHitConflictsWithPin(h, pinDigits)) &&
            requestSeq === geocodeRequestSeqRef.current
          ) {
            setPinStreetGeocodeMismatch(true);
          }
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
            if (requestSeq === geocodeRequestSeqRef.current) {
              setPinStreetGeocodeMismatch(false);
            }
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
    
    const formatMins = (m: number) => {
      if (m <= 60) {
        return `${m} ${m === 1 ? 'min' : 'mins'}`;
      }
      const hrs = Math.floor(m / 60);
      const rem = m % 60;
      const hrStr = hrs === 1 ? '1 hr' : `${hrs} hrs`;
      if (rem === 0) return hrStr;
      const minStr = rem === 1 ? '1 min' : `${rem} mins`;
      return `${hrStr} ${minStr}`;
    };

    if (etaMax <= 60) {
      return `${etaMin}–${etaMax} mins`;
    }
    return `${formatMins(etaMin)} – ${formatMins(etaMax)}`;
  }, [deliveryStats.estimatedMins]);

  const distanceLabel = useMemo(() => {
    if (typeof deliveryDistance === 'number' && Number.isFinite(deliveryDistance) && deliveryDistance >= 0) {
      return `${deliveryDistance.toFixed(1)} km`;
    }
    return '…';
  }, [deliveryDistance]);
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

  /** Block checkout only for clearly wrong geocodes (e.g. cross-city), not fee-tier slab limits. */
  const MAX_REASONABLE_DELIVERY_KM = 120;
  const MAX_PER_KM_PRICING_DISTANCE_KM = 50;

  const isDeliveryOutOfRange = useMemo(() => {
    return (
      typeof deliveryDistance === 'number' &&
      Number.isFinite(deliveryDistance) &&
      deliveryDistance > MAX_REASONABLE_DELIVERY_KM
    );
  }, [deliveryDistance]);

  const shippingFeeForDistance = useMemo(() => {
    if (!isAddressResolvedForPricing) return 0;
    if (isDeliveryOutOfRange) return 0;
    const fallbackDeliveryCharge = effectivePricing.deliveryCharge;
    const rules = effectivePricing.deliveryFeeRules;
    const mode = effectivePricing.deliveryFeeMode;
    const perKmRate = effectivePricing.deliveryPerKmRate;
    const rawDistance =
      typeof deliveryDistance === 'number' && Number.isFinite(deliveryDistance)
        ? deliveryDistance
        : Number.NaN;
    let distanceForPricing = rawDistance;
    if (Number.isFinite(rawDistance) && mode === 'PER_KM') {
      distanceForPricing = Math.min(rawDistance, MAX_PER_KM_PRICING_DISTANCE_KM);
    }
    return computeDeliveryFeeByDistanceKm(
      distanceForPricing,
      rules,
      fallbackDeliveryCharge,
      mode,
      perKmRate,
      subtotalOnly,
      effectivePricing.freeDeliveryThreshold,
      effectivePricing.freeDeliveryWithinKm,
    );
  }, [
    isAddressResolvedForPricing,
    isDeliveryOutOfRange,
    deliveryDistance,
    subtotalOnly,
    effectivePricing,
  ]);

  const hasFreeDeliveryApplied = useMemo(() => {
    return qualifiesForFreeDelivery(
      subtotalOnly,
      deliveryDistance,
      effectivePricing.freeDeliveryThreshold,
      effectivePricing.freeDeliveryWithinKm,
    );
  }, [subtotalOnly, deliveryDistance, effectivePricing.freeDeliveryThreshold, effectivePricing.freeDeliveryWithinKm]);

  const freeDeliveryExplanation = useMemo(() => {
    if (hasFreeDeliveryApplied || isDeliveryOutOfRange) return null;
    return explainFreeDeliveryEligibility(
      subtotalOnly,
      deliveryDistance,
      effectivePricing.freeDeliveryThreshold,
      effectivePricing.freeDeliveryWithinKm,
    ).message;
  }, [
    hasFreeDeliveryApplied,
    isDeliveryOutOfRange,
    subtotalOnly,
    deliveryDistance,
    effectivePricing.freeDeliveryThreshold,
    effectivePricing.freeDeliveryWithinKm,
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
      const cartProductIds = Array.from(
        new Set(items.map((i) => String((i as any).productId ?? i.id)).filter(Boolean)),
      );
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
          code: code.trim().toUpperCase(),
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
      ['firstName', 'address', 'city', 'state', 'zipCode', 'phone', 'email'].includes(name) &&
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
    if (name === 'email' && trimmed && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
      return 'Enter a valid email address.';
    }
    if (name === 'phone') {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 10) return 'Enter a valid 10-digit phone number.';
    }
    return '';
  }, [serviceablePincodes]);

  const effectiveCheckoutEmail = useMemo(() => {
    const fromForm = formData.email.trim();
    if (fromForm) return fromForm;
    const fromUser = user?.email?.trim() ?? '';
    if (fromUser) return fromUser;
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length >= 10) return `customer+${phoneDigits}@fruit-tribe.orders`;
    return '';
  }, [formData.email, formData.phone, user?.email]);

  const checkoutPayBlockReason = useMemo((): string | null => {
    if (!formData.firstName.trim()) return 'Enter your full name.';
    if (!formData.phone.trim()) return 'Enter your phone number.';
    if (!effectiveCheckoutEmail) return 'Enter a valid phone number for order updates.';
    if (validateField('phone', formData.phone)) return validateField('phone', formData.phone);
    if (validateField('flatHouse', formData.flatHouse)) return validateField('flatHouse', formData.flatHouse);
    if (validateField('address', formData.address)) return validateField('address', formData.address);
    if (validateField('zipCode', formData.zipCode)) return validateField('zipCode', formData.zipCode);
    if (!(typeof deliveryDistance === 'number' && Number.isFinite(deliveryDistance) && deliveryDistance >= 0)) {
      return 'Calculating delivery distance — wait a moment.';
    }
    if (isDeliveryOutOfRange) {
      return 'Address looks too far — check PIN matches your area/street.';
    }
    return null;
  }, [formData, effectiveCheckoutEmail, validateField, deliveryDistance, isDeliveryOutOfRange]);

  const isCheckoutFormReady = checkoutPayBlockReason === null;

  const addressCityConflict = useMemo(
    () => detectConflictingCityInAddress(formData.flatHouse, formData.address, DELIVERY_CITY_FIXED),
    [formData.flatHouse, formData.address],
  );

  const submitCheckout = async () => {
    const nextErrors: Partial<Record<keyof typeof formData, string>> = {};
    (Object.keys(formData) as Array<keyof typeof formData>).forEach((key) => {
      if (key === 'email') return;
      const message = validateField(key, String(formData[key] ?? ''));
      if (message) nextErrors[key] = message;
    });
    if (!effectiveCheckoutEmail) {
      nextErrors.email = 'Enter a valid phone number for order updates.';
    } else if (formData.email.trim() && validateField('email', formData.email)) {
      nextErrors.email = validateField('email', formData.email);
    }
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
        email: effectiveCheckoutEmail,
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
      invalidateProductsListCache();
      invalidateOrdersCache();

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
      pinProvisionalBlockRef.current = false;
      lastDistancePinRef.current = '';
      setPinStreetGeocodeMismatch(false);
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

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      header, nav, footer {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (items.length === 0 && !orderPlacedOptimistically && !orderJustPlacedRef.current) {
    return <Navigate to="/cart" replace />;
  }

  const couponsCard = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
        <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600 shrink-0">
          <Tag className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Coupons & Offers</h3>
          <p className="text-[10px] font-semibold text-slate-500">Apply code to save more on your order</p>
        </div>
      </div>

      {/* Manual Input Field */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Enter promo code"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
          />
          {appliedCoupon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 bg-emerald-100 text-emerald-800 rounded-full text-[8px] font-black">
              ✓
            </span>
          )}
        </div>
        {appliedCoupon && promoCode === appliedCoupon.code ? (
          <button
            type="button"
            onClick={handleRemovePromo}
            className="px-4 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors cursor-pointer"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApplyPromo}
            disabled={applyingPromo || !promoCode.trim()}
            className="px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black transition-colors disabled:opacity-40 cursor-pointer"
          >
            {applyingPromo ? 'Applying...' : 'Apply'}
          </button>
        )}
      </div>

      {/* Available Coupons List (No dropdown, no scrolling) */}
      {availableOffers.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Available Coupons</p>
          <div className="grid grid-cols-1 gap-2.5">
            {availableOffers.map((offer) => {
              const isLocked = offer.minOrderValue != null && subtotalOnly < offer.minOrderValue;
              const needed = offer.minOrderValue != null ? Math.max(0, offer.minOrderValue - subtotalOnly) : 0;
              const appliedNorm = appliedCoupon?.code?.trim().toUpperCase() ?? '';
              const offerNorm = String(offer.code ?? '').trim().toUpperCase();
              const isApplied = Boolean(appliedNorm) && appliedNorm === offerNorm;

              return (
                <div
                  key={offer.code}
                  className={cn(
                    'p-3 rounded-xl border transition-all flex items-start gap-3',
                    isApplied
                      ? 'border-emerald-500 bg-emerald-50/30 shadow-sm'
                      : isLocked
                      ? 'border-slate-100 bg-slate-50/50 opacity-75'
                      : 'border-slate-200 hover:border-pink-200 bg-white hover:bg-pink-50/10'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      isApplied
                        ? 'bg-emerald-600 text-white'
                        : isLocked
                        ? 'bg-slate-200 text-slate-400'
                        : 'bg-pink-100 text-pink-600'
                    )}
                  >
                    <Percent className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-900 text-white font-bold text-[9px] tracking-wide mb-1 select-all">
                          {offer.code}
                        </span>
                        <p className="text-xs font-extrabold text-slate-900">
                          Save {offer.discountType === 'PERCENTAGE' ? `${offer.discountValue}%` : `₹${offer.discountValue}`}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isApplied ? (
                          <button
                            type="button"
                            onClick={handleRemovePromo}
                            className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold hover:bg-red-200 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : isLocked ? (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                            Locked
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPromoCode(offer.code);
                              void applyPromoCode(offer.code);
                            }}
                            className="px-2.5 py-1 bg-pink-600 text-white rounded-lg text-[10px] font-bold hover:bg-pink-700 transition-colors shadow-sm shadow-pink-600/10 cursor-pointer"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bottom Status / Details */}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {isApplied ? (
                        <p className="text-[9px] font-bold text-emerald-700">Applied & active on this order</p>
                      ) : isLocked ? (
                        <p className="text-[9px] font-semibold text-orange-600 leading-tight">
                          Shop for ₹{needed.toFixed(2)} more to unlock
                        </p>
                      ) : (
                        <p className="text-[9px] font-semibold text-slate-500">
                          {offer.minOrderValue ? `Valid on orders above ₹${offer.minOrderValue}` : 'No minimum order required'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center text-xs font-semibold text-slate-400 py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No available offers at the moment.
        </div>
      )}
    </div>
  );

  const deliverySlotCard = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 shrink-0">
          <Clock className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Delivery Slot</h3>
          <p className="text-[10px] font-semibold text-slate-500">
            Choose your preferred delivery slot
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {deliverySlotOptions.map((slot: string) => {
          const isSelected = deliverySlot === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => setDeliverySlot(slot)}
              onDoubleClick={() => {
                if (isSelected) setDeliverySlot('');
              }}
              title={isSelected ? 'Double-click to remove this slot' : undefined}
              className={cn(
                'w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer',
                isSelected
                  ? 'bg-amber-600 border-amber-600 text-white shadow-sm shadow-amber-600/10'
                  : 'bg-white text-slate-700 border-amber-100 hover:bg-slate-50',
              )}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );

  const cartSummaryCard = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center text-pink-600">
            <ShoppingBag className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Order Items</h3>
            <p className="text-[10px] font-semibold text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''} in cart</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
        {items.map((item) => {
          const lineKey = `${String(item.id)}::${String((item as any).selectedVariantSku || (item as any).selectedVariantId || '')}`;
          return (
            <div key={item.id} className="flex gap-3.5 items-center">
              <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden shrink-0 border border-slate-100 relative group">
                <img
                  src={(item.image || '').trim() ? getImageDisplayUrl(item.image) : PRODUCT_PLACEHOLDER_IMAGE}
                  alt={item.name}
                  onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER_IMAGE; }}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                <p className="text-[10px] font-semibold text-slate-500">{item.selectedVariantName || '1 pc'}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-pink-100 rounded-xl bg-pink-50/30 text-pink-600 text-xs font-extrabold shadow-sm overflow-hidden">
                  <button type="button" onClick={() => item.quantity <= 1 ? handleRemoveItem(lineKey) : handleUpdateQuantity(lineKey, -1)} className="py-1 px-3 hover:bg-pink-100/50 transition-colors cursor-pointer">-</button>
                  <span className="px-1 text-slate-800 min-w-[1.25rem] text-center">{item.quantity}</span>
                  <button type="button" onClick={() => handleUpdateQuantity(lineKey, 1)} className="py-1 px-3 hover:bg-pink-100/50 transition-colors cursor-pointer">+</button>
                </div>
                <div className="text-right min-w-[60px]">
                  <p className="text-xs font-bold text-emerald-600 font-mono">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const desktopPayButton = (
    <button
      type="button"
      onClick={() => void submitCheckout()}
      disabled={submitting || !isCheckoutFormReady}
      className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-4 cursor-pointer"
    >
      {submitting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing…</span>
        </>
      ) : (
        <>
          <ShieldCheck className="w-4 h-4" />
          <span>{paymentMethod === 'cod' ? 'Place Order' : `Pay ₹${payableGrandTotal.toFixed(2)}`}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 selection:bg-pink-200 selection:text-pink-900 overflow-x-hidden antialiased">
      <div className="max-w-md lg:max-w-7xl mx-auto bg-white lg:bg-slate-50/30 min-h-screen flex flex-col">
        {/* Mobile Header (Hidden on desktop) */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 p-4 flex items-center gap-3.5 z-20 lg:hidden shadow-sm">
          <button type="button" onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="text-xs font-black text-slate-900 truncate uppercase tracking-wider">
                {selectedSavedAddressId ? savedAddresses.find(a => a.id === selectedSavedAddressId)?.label || 'Saved Address' : 'Deliver to'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 truncate font-semibold">
              {formData.flatHouse ? `${formData.flatHouse}, ` : ''}{formData.address || 'Select or add address'}
            </p>
          </div>
        </div>

        {/* Desktop Header (Visible only on desktop) */}
        <div className="hidden lg:flex items-center justify-between p-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-50 rounded-full border border-slate-200 transition-all active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Complete Checkout</h1>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Secure, frictionless payments in 1-click</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Distance</p>
              <p className="text-xs font-black text-slate-900 flex items-center justify-end gap-1.5 mt-0.5">
                <Navigation className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                <span className="tabular-nums font-mono">{distanceLabel}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Savings Banner */}
        {discountAmount > 0 && (
          <div className="bg-emerald-500/10 text-emerald-700 border-b border-emerald-500/10 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-1.5 lg:hidden">
            <span>Yay! You saved ₹{(discountAmount || 0).toFixed(2)} on this order</span>
            <ChevronDown className="w-3 h-3 animate-bounce mt-0.5" />
          </div>
        )}

        {/* Mobile Stats Bar (Sticky below header) */}
        <div className="bg-white border-b border-slate-100 p-3 grid grid-cols-2 gap-2.5 text-center text-xs sticky top-[61px] z-10 shadow-sm lg:hidden">
          <div className="bg-slate-50/80 p-1.5 rounded-xl border border-slate-100/50">
            <p className="text-slate-400 font-bold uppercase text-[8px] tracking-wider mb-0.5">Distance</p>
            <p className="text-slate-800 font-extrabold flex items-center justify-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-pink-500 shrink-0" />
              <span className="tabular-nums">{distanceLabel}</span>
            </p>
          </div>
          <div className="bg-slate-50/80 p-1.5 rounded-xl border border-slate-100/50">
            <p className="text-slate-400 font-bold uppercase text-[8px] tracking-wider mb-0.5">On-Time</p>
            <p className="text-emerald-600 font-extrabold flex items-center justify-center gap-1">
              <Zap className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500 shrink-0" />
              <span className="tabular-nums">{deliveryStats.onTimeRate != null ? `${deliveryStats.onTimeRate}%` : '…'}</span>
            </p>
          </div>
        </div>

        {/* Redesigned 3-Column Grid for Desktop & Natural Linear Stack for Mobile */}
        <div className="flex-1 p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-3 items-start gap-5 lg:h-[calc(100vh-76px)] lg:overflow-hidden pb-32 lg:pb-5">
          
          {/* Column 1: Delivery Address & Slot Selection */}
          <div className="lg:col-span-1 lg:h-full lg:overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {isAddingNewAddress || isEditingAddressId ? (
              /* Sleek, Premium Add/Edit Address Form Panel */
              <form onSubmit={handleSaveAddressForm} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden transition-all duration-300">
                <div className="p-5 pb-3 bg-gradient-to-r from-pink-50 to-white border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600 shrink-0">
                      <MapPin className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        {isEditingAddressId ? 'Edit Address Details' : 'Add New Address'}
                      </h3>
                      <p className="text-[9px] font-semibold text-slate-400">
                        {isEditingAddressId ? 'Update your saved address details' : 'Enter a new address for your account'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewAddress(false);
                      setIsEditingAddressId(null);
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-650 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Address Type Tabs */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Address Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Home', 'Work', 'Other'] as const).map((type) => {
                        const Icon = type === 'Home' ? Home : type === 'Work' ? Building2 : Navigation;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setAddressForm({ ...addressForm, label: type })}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer",
                              addressForm.label === type
                                ? "border-pink-500 bg-pink-50 text-pink-700 shadow-sm"
                                : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" /> {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name field */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Full Name*</label>
                    <input
                      type="text"
                      value={addressForm.name}
                      onChange={(e) => {
                        setAddressForm({ ...addressForm, name: e.target.value });
                        if (addressFormErrors.name) setAddressFormErrors({ ...addressFormErrors, name: '' });
                      }}
                      onBlur={(e) => {
                        const err = validateAddressFormField('name', e.target.value);
                        setAddressFormErrors((prev) => ({ ...prev, name: err }));
                      }}
                      required
                      placeholder="Priya Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                    />
                    {addressFormErrors.name && (
                      <p className="text-[10px] text-red-600 font-bold">{addressFormErrors.name}</p>
                    )}
                  </div>

                  {/* Phone field */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Phone Number*</label>
                    <input
                      type="tel"
                      value={addressForm.phone}
                      onChange={(e) => {
                        setAddressForm({ ...addressForm, phone: e.target.value });
                        if (addressFormErrors.phone) setAddressFormErrors({ ...addressFormErrors, phone: '' });
                      }}
                      onBlur={(e) => {
                        const err = validateAddressFormField('phone', e.target.value);
                        setAddressFormErrors((prev) => ({ ...prev, phone: err }));
                      }}
                      required
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                    />
                    {addressFormErrors.phone && (
                      <p className="text-[10px] text-red-600 font-bold">{addressFormErrors.phone}</p>
                    )}
                  </div>

                  {/* Flat / House No */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Flat / House no. (Optional)</label>
                    <input
                      type="text"
                      value={addressForm.flatHouse}
                      onChange={(e) => setAddressForm({ ...addressForm, flatHouse: e.target.value })}
                      placeholder="Flat 4B, Green Towers"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                    />
                  </div>

                  {/* Area / Street Address */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Area / Street*</label>
                    <input
                      type="text"
                      value={addressForm.address}
                      onChange={(e) => {
                        setAddressForm({ ...addressForm, address: e.target.value });
                        if (addressFormErrors.address) setAddressFormErrors({ ...addressFormErrors, address: '' });
                      }}
                      onBlur={(e) => {
                        const err = validateAddressFormField('address', e.target.value);
                        setAddressFormErrors((prev) => ({ ...prev, address: err }));
                      }}
                      required
                      placeholder="HSR Layout Sector 2"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                    />
                    {addressFormErrors.address && (
                      <p className="text-[10px] text-red-600 font-bold">{addressFormErrors.address}</p>
                    )}
                  </div>

                  {/* Landmark */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Landmark (Optional)</label>
                    <input
                      type="text"
                      value={addressForm.landmark}
                      onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                      placeholder="Near HSR Club"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                    />
                  </div>

                  {/* PIN & City */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pin code*</label>
                      <input
                        type="text"
                        value={addressForm.zipCode}
                        onChange={(e) => {
                          setAddressForm({ ...addressForm, zipCode: e.target.value });
                          if (addressFormErrors.zipCode) setAddressFormErrors({ ...addressFormErrors, zipCode: '' });
                        }}
                        onBlur={(e) => {
                          const err = validateAddressFormField('zipCode', e.target.value);
                          setAddressFormErrors((prev) => ({ ...prev, zipCode: err }));
                        }}
                        placeholder="560102"
                        maxLength={6}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                      />
                      {addressFormErrors.zipCode && (
                        <p className="text-[10px] text-red-600 font-bold">{addressFormErrors.zipCode}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">City</label>
                      <input
                        type="text"
                        value={addressForm.city}
                        readOnly
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Set as Default Address switch */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Set as default address</p>
                      <p className="text-[9px] font-semibold text-slate-400">Use this address by default next time</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addressForm.isDefault}
                        onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-pink-600"></div>
                    </label>
                  </div>

                  {/* Form Submission CTA */}
                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isSavingAddress ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Address...</span>
                      </>
                    ) : (
                      <span>Save Address</span>
                    )}
                  </button>
                </div>
              </form>
            ) : selectedSavedAddressId ? (
              /* Delivering To (Sleek Space-saving summary card) */
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center text-pink-600 shrink-0">
                      <MapPin className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Delivering To</p>
                      <h3 className="text-xs font-black text-slate-900 mt-0.5 truncate max-w-[130px]">
                        {formData.firstName ? `${formData.firstName} ${formData.lastName}` : 'Default Address'}
                      </h3>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const current = savedAddresses.find((a) => a.id === selectedSavedAddressId);
                        if (current) startEditAddress(current);
                      }}
                      className="text-[10px] font-black uppercase text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSavedAddressPick('')}
                      className="text-[10px] font-black uppercase text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100/70 px-2.5 py-1.5 rounded-xl border border-pink-100/50 transition-all active:scale-95 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 text-white font-extrabold text-[8px] tracking-wide uppercase mt-0.5 shrink-0 select-none">
                    {savedAddresses.find(a => a.id === selectedSavedAddressId)?.label || 'Saved'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                      {formData.flatHouse ? `${formData.flatHouse}, ` : ''}{formData.address}
                      {formData.landmark ? ` (Landmark: ${formData.landmark})` : ''}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{formData.phone}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Grid of Saved Addresses & Collapsible Entry Form */
              <div className="space-y-4">
                {/* Saved Addresses Panel */}
                {user?.id && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center text-pink-600 shrink-0">
                          <MapPin className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Saved Addresses</h3>
                          <p className="text-[9px] font-semibold text-slate-400">Select an address to use</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={startAddAddress}
                        className="text-[10px] font-black uppercase text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100/70 px-3 py-1.5 rounded-xl border border-pink-100/50 transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                      >
                        + Add Address
                      </button>
                    </div>

                    {savedAddresses.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2.5">
                        {savedAddresses.map((addr) => {
                          const isSelected = selectedSavedAddressId === addr.id;
                          return (
                            <div
                              key={addr.id}
                              onClick={() => handleSavedAddressPick(addr.id)}
                              className={cn(
                                "text-left p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between relative group cursor-pointer hover:border-pink-200",
                                isSelected
                                  ? "border-pink-500 bg-pink-50/10 shadow-sm"
                                  : "border-slate-100 bg-white"
                              )}
                            >
                              {addr.isDefault && (
                                <span className="absolute right-3 top-3 px-1.5 py-0.5 rounded bg-slate-900 text-white font-bold text-[8px] tracking-wide uppercase">
                                  Default
                                </span>
                              )}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[8px] uppercase">
                                    {addr.label || 'Address'}
                                  </span>
                                  <p className="text-xs font-extrabold text-slate-900 truncate max-w-[125px]">{addr.name}</p>
                                </div>
                                <p className="text-[10px] font-semibold text-slate-600 line-clamp-2 mb-2 leading-relaxed font-semibold">
                                  {addr.addressLine1}
                                  {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                                  {`, ${addr.city}, ${addr.pincode}`}
                                </p>
                              </div>
                              
                              <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-50">
                                <p className="text-[9px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">{addr.phone}</p>
                                <div className="flex items-center gap-2.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                  {!addr.isDefault && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleSetDefaultAddress(addr.id, e)}
                                      className="text-[9px] font-bold text-pink-600 hover:text-pink-700 hover:underline cursor-pointer"
                                    >
                                      Set Default
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditAddress(addr);
                                    }}
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer flex items-center gap-0.5 text-[9px] font-bold"
                                  >
                                    <Edit className="w-3 h-3" /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteAddress(addr.id, e)}
                                    className="text-red-400 hover:text-red-600 cursor-pointer flex items-center gap-0.5 text-[9px] font-bold"
                                  >
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No saved addresses</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 mb-3">Add an address to your account for faster checkout.</p>
                        <button
                          type="button"
                          onClick={startAddAddress}
                          className="bg-pink-600 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl hover:bg-pink-700 transition-colors shadow-sm cursor-pointer"
                        >
                          + Add New Address
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible custom address form details (For guests / manual inputs) */}
                {(!user?.id || savedAddresses.length === 0) && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 pb-3 border-b border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center text-pink-600 shrink-0">
                          <MapPin className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">New Address Details</h3>
                          <p className="text-[9px] font-semibold text-slate-400">Fill in your delivery address</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Address Type Selectors */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Address Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setAddressType('home')}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer",
                              addressType === 'home'
                                ? "border-pink-500 bg-pink-50 text-pink-700 shadow-sm"
                                : "border-slate-200 text-slate-650 hover:bg-slate-55"
                            )}
                          >
                            <Home className="w-3.5 h-3.5" /> Home
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddressType('work')}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer",
                              addressType === 'work'
                                ? "border-pink-500 bg-pink-50 text-pink-700 shadow-sm"
                                : "border-slate-200 text-slate-650 hover:bg-slate-55"
                            )}
                          >
                            <Building2 className="w-3.5 h-3.5" /> Work
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddressType('other')}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer",
                              addressType === 'other'
                                ? "border-pink-500 bg-pink-50 text-pink-700 shadow-sm"
                                : "border-slate-200 text-slate-650 hover:bg-slate-55"
                            )}
                          >
                            <Navigation className="w-3.5 h-3.5" /> Other
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Full name*</label>
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
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                        />
                        {(fieldErrors.firstName || fieldErrors.lastName) && (
                          <p className="text-[10px] text-red-600 font-bold">{fieldErrors.firstName || fieldErrors.lastName}</p>
                        )}
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Phone number*</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          onBlur={handleFieldBlur}
                          required
                          placeholder="+91 98765 43210"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                        />
                        {fieldErrors.phone && <p className="text-[10px] text-red-600 font-bold">{fieldErrors.phone}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Flat / House no.*</label>
                        <input
                          type="text"
                          name="flatHouse"
                          value={formData.flatHouse}
                          onChange={handleChange}
                          onBlur={handleFieldBlur}
                          required
                          placeholder="Flat 4B, Green Towers"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                        />
                        {fieldErrors.flatHouse && <p className="text-[10px] text-red-600 font-bold">{fieldErrors.flatHouse}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Area / Street*</label>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          onBlur={handleFieldBlur}
                          required
                          placeholder="HSR Layout Sector 2"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                        />
                        {fieldErrors.address && <p className="text-[10px] text-red-600 font-bold">{fieldErrors.address}</p>}
                        {addressCityConflict && (
                          <p className="text-[10px] font-semibold text-amber-700 leading-snug bg-amber-50 border border-amber-100 p-2.5 rounded-lg">
                            This street mentions {addressCityConflict} but delivery is Bengaluru-only. Use your local area name and a matching PIN (e.g. 560102 for HSR).
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pin code*</label>
                          <input
                            type="text"
                            name="zipCode"
                            value={formData.zipCode}
                            onChange={handleChange}
                            onBlur={handleFieldBlur}
                            placeholder="560102"
                            maxLength={6}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/15 transition-all text-xs font-bold placeholder:text-slate-400"
                          />
                          {fieldErrors.zipCode && <p className="text-[10px] text-red-600 font-bold">{fieldErrors.zipCode}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">City</label>
                          <input
                            type="text"
                            name="city"
                            value={formData.city}
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed text-xs font-bold"
                          />
                        </div>
                      </div>

                      {/* Save address switch */}
                      {user?.id && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Save address to account</p>
                            <p className="text-[9px] font-semibold text-slate-400">Save for faster checkout next time</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={saveNewAddressToAccount}
                              onChange={(e) => setSaveNewAddressToAccount(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-pink-600"></div>
                          </label>
                        </div>
                      )}

                      {/* Default address switch */}
                      {user?.id && saveNewAddressToAccount && (
                        <div className="pt-2 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Set as default address</p>
                            <p className="text-[9px] font-semibold text-slate-400">Use this address by default next time</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={setAsDefaultAddress}
                              onChange={(e) => setSetAsDefaultAddress(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-pink-600"></div>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Delivery Slot Selection Card */}
            {deliverySlotCard}
          </div>

          {/* Column 2: Payment Method & Coupons Selection */}
          <div className="lg:col-span-1 lg:h-full lg:overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {/* Payment Method Selector Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-50">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                  <CreditCard className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Payment Method</h3>
                  <p className="text-[9px] font-semibold text-slate-400">Choose how you want to pay</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={cn(
                    'p-3.5 rounded-xl border-2 flex items-center gap-3 transition-all text-left group cursor-pointer hover:scale-[1.01] hover:border-emerald-100',
                    paymentMethod === 'online'
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-sm'
                      : 'border-slate-100 bg-white text-slate-400 hover:bg-slate-50/20',
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0',
                      paymentMethod === 'online' ? 'bg-slate-900 text-emerald-400' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200',
                    )}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('font-black text-xs uppercase tracking-tight', paymentMethod === 'online' ? 'text-slate-900' : 'text-slate-400')}>
                      Pay Online
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">UPI, Cards, Net</p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!codAllowedForCart}
                  onClick={() => setPaymentMethod('cod')}
                  className={cn(
                    'p-3.5 rounded-xl border-2 flex items-center gap-3 transition-all text-left group cursor-pointer hover:scale-[1.01]',
                    !codAllowedForCart
                      ? 'opacity-40 cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : paymentMethod === 'cod'
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-sm'
                      : 'border-slate-100 bg-white text-slate-400 hover:border-emerald-100 hover:bg-slate-50/20',
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0',
                      !codAllowedForCart ? 'bg-slate-100 text-slate-300' : paymentMethod === 'cod' ? 'bg-slate-900 text-emerald-400' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200',
                    )}
                  >
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('font-black text-xs uppercase tracking-tight', !codAllowedForCart ? 'text-slate-300' : paymentMethod === 'cod' ? 'text-slate-900' : 'text-slate-400')}>
                      COD
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">
                      {!codAllowedForCart ? 'Unavailable' : 'Pay at Door'}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Inline Coupons Card */}
            {couponsCard}
          </div>

          {/* Column 3: Cart summary, Bill details, and Action button */}
          <div className="lg:col-span-1 lg:h-full lg:overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {/* Cart summary list */}
            {cartSummaryCard}

            {/* Billing calculations and checkout CTA */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-50">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Bill Details</h3>
                  <p className="text-[9px] font-semibold text-slate-400">Review your final order calculation</p>
                </div>
              </div>

              <div className="space-y-3 text-xs font-bold text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900 font-extrabold font-mono">₹{subtotalOnly.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Delivery charges</span>
                  <span>
                    {isDeliveryOutOfRange ? (
                      <span className="text-orange-600">Out of range</span>
                    ) : hasFreeDeliveryApplied ? (
                      <span className="text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded text-[9px] tracking-wide uppercase select-none">FREE</span>
                    ) : (
                      <span className="text-slate-900 font-extrabold font-mono">₹{shippingFeeForDistance.toFixed(2)}</span>
                    )}
                  </span>
                </div>

                {platformFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Platform fee</span>
                    <span className="text-slate-900 font-extrabold font-mono">₹{platformFee.toFixed(2)}</span>
                  </div>
                )}

                {orderTaxAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Estimated Taxes</span>
                    <span className="text-slate-900 font-extrabold font-mono">₹{orderTaxAmount.toFixed(2)}</span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-600">Coupon Discount</span>
                    <span className="text-emerald-600 font-extrabold font-mono">-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-slate-900 text-sm font-black">
                  <span>Total Payable</span>
                  <span className="text-base text-slate-900 font-black font-mono">₹{payableGrandTotal.toFixed(2)}</span>
                </div>
              </div>

              {hasFreeDeliveryApplied && (
                <div className="mt-4 p-2.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-xl flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                  <span>Yay! Free delivery applied to this order!</span>
                </div>
              )}

              {freeDeliveryExplanation && (
                <div className="mt-4 p-2.5 bg-amber-50 text-amber-800 text-[10px] font-semibold rounded-xl leading-snug border border-amber-100">
                  {freeDeliveryExplanation}
                </div>
              )}

              {addressCityConflict && (
                <p className="mt-3 text-[9px] font-semibold text-amber-700 leading-snug bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                  Street mentions {addressCityConflict} but city is fixed to Bengaluru. Update address pin to match your area.
                </p>
              )}

              {pinStreetGeocodeMismatch && (
                <p className="mt-3 text-[9px] font-semibold text-amber-700 leading-snug bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                  Your street area does not match this PIN — delivery distance uses the PIN area. Use the PIN for your locality (e.g. 560102 for HSR Layout).
                </p>
              )}

              {isDeliveryOutOfRange && (
                <p className="mt-3 text-[9px] font-semibold text-orange-600 leading-snug bg-orange-50/50 p-2 rounded-lg border border-orange-100">
                  Address is too far — please enter a Bengaluru PIN in our service zone.
                </p>
              )}

              {/* Pre-order Delivery Starts June 12 Notice */}
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-bold flex items-center gap-2 shadow-sm select-none">
                <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Pre-order today: Deliveries begin from 12 June</span>
              </div>

              {/* Desktop Pay Button */}
              <div className="hidden lg:block">
                {desktopPayButton}
                {checkoutPayBlockReason && !submitting ? (
                  <p className="mt-2 text-center text-[10px] text-slate-400 font-semibold leading-tight">{checkoutPayBlockReason}</p>
                ) : null}
              </div>
            </div>
          </div>

        </div>

        {/* Mobile Sticky Bottom Pay Bar (Hidden on desktop) */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 p-4 z-20 lg:hidden flex flex-col gap-2 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
          {/* Pre-order Delivery Starts June 12 Notice */}
          <div className="p-2 px-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-[10px] font-bold flex items-center gap-1.5 self-center select-none">
            <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Delivery starts from 12 June</span>
          </div>

          <button
            type="button"
            onClick={() => void submitCheckout()}
            disabled={submitting || !isCheckoutFormReady}
            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{paymentMethod === 'cod' ? 'Place Order' : `Pay ₹${payableGrandTotal.toFixed(2)}`}</span>
              </>
            )}
          </button>
          {checkoutPayBlockReason && !submitting ? (
            <p className="text-center text-[10px] text-slate-400 font-semibold leading-tight">{checkoutPayBlockReason}</p>
          ) : null}
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

interface CheckoutSuccessOverlayProps {
  orderId: string | null;
  orderNumber: string | null;
  subtotal: number;
  isAwaitingPayment?: boolean;
  onDismiss: () => void;
}

function CheckoutSuccessOverlay({ orderId, orderNumber, subtotal, isAwaitingPayment, onDismiss }: CheckoutSuccessOverlayProps) {
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
