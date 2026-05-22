import { useState, useEffect, useCallback } from 'react';
import {
    CreditCard, Zap, Globe, Cpu, Activity,
    Lock, HardDrive, Fingerprint, Eye, EyeOff, Save,
    Hexagon, BellRing, Terminal, Command, MapPin, Plus, Trash2,
    Search, Loader2, CheckCircle2, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { getServiceableAreas, updateServiceableAreas, getStoreSettings, updateStoreSettings, getEffectiveApiBase } from '@/lib/api';
import { getUserErrorMessage } from '@/lib/userError';

/**
 * Fetch all 6-digit pincodes for an area name using the free postalpincode.in API.
 * Supports city, district, or state-level lookups.
 */
async function fetchPincodesForArea(areaName: string): Promise<string[]> {
    const name = areaName.trim();
    if (!name) return [];
    const url = `https://api.postalpincode.in/postoffice/${encodeURIComponent(name)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Pincode API returned ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const pincodes = new Set<string>();
    for (const block of data) {
        if (block?.Status !== 'Success' || !Array.isArray(block?.PostOffice)) continue;
        for (const po of block.PostOffice) {
            const pin = String(po?.Pincode ?? '').replace(/\D/g, '');
            if (pin.length === 6) pincodes.add(pin);
        }
    }
    return Array.from(pincodes);
}

async function saveRazorpayToBackend(razorpayKeyId: string, razorpayKeySecret: string): Promise<{ ok: boolean; message?: string }> {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (!token) return { ok: false, message: 'Not logged in. Log in as admin to sync credentials to backend.' };
    try {
        const res = await fetch(`${getEffectiveApiBase()}/settings/payment`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                razorpayKeyId: razorpayKeyId.trim() || undefined,
                razorpayKeySecret: razorpayKeySecret.trim() || undefined,
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            return { ok: false, message: res.status === 401 || res.status === 403 ? 'Admin access required.' : text || res.statusText };
        }
        return { ok: true };
    } catch (e: any) {
        return { ok: false, message: getUserErrorMessage(e, 'Backend unreachable.') };
    }
}

export function AdminSettingsPage() {
    const { preferences, updatePreferences } = useStore();
    const [razorpayKeyId, setRazorpayKeyId] = useState(preferences.razorpayKeyId ?? '');
    const [razorpayKeySecret, setRazorpayKeySecret] = useState(preferences.razorpayKeySecret ?? '');
    const [showSecret, setShowSecret] = useState(false);
    const [saving, setSaving] = useState(false);
    const [serviceableCities, setServiceableCities] = useState<string[]>([]);
    const [serviceablePincodes, setServiceablePincodes] = useState<string[]>([]);
    const [newCity, setNewCity] = useState('');
    const [newPincode, setNewPincode] = useState('');
    const [citiesLoading, setCitiesLoading] = useState(true);
    const [citiesSaving, setCitiesSaving] = useState(false);
    // Auto-fetch pincodes state
    const [autoFetchQuery, setAutoFetchQuery] = useState('');
    const [autoFetchType, setAutoFetchType] = useState<'city' | 'district' | 'state'>('city');
    const [autoFetching, setAutoFetching] = useState(false);
    const [autoFetchPreview, setAutoFetchPreview] = useState<string[]>([]);
    const [autoFetchDone, setAutoFetchDone] = useState(false);
    const [deliveryCharge, setDeliveryCharge] = useState<string>(String(preferences.deliveryCharge ?? 0));
    const [deliveryFeeMode, setDeliveryFeeMode] = useState<'SLAB' | 'PER_KM'>(preferences.deliveryFeeMode === 'PER_KM' ? 'PER_KM' : 'SLAB');
    const [deliveryPerKmRate, setDeliveryPerKmRate] = useState<string>(String(preferences.deliveryPerKmRate ?? 10));
    const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<string>(String(preferences.freeDeliveryThreshold ?? 0));
    const [freeDeliveryWithinKm, setFreeDeliveryWithinKm] = useState<string>(String(preferences.freeDeliveryWithinKm ?? 0));
    const [platformFee, setPlatformFee] = useState<string>(String(preferences.platformFee ?? 0));
    const [deliveryFeeRules, setDeliveryFeeRules] = useState<Array<{ upToKm: string; fee: string }>>(
        (preferences.deliveryFeeRules && preferences.deliveryFeeRules.length
            ? preferences.deliveryFeeRules
            : [
                  { upToKm: 3, fee: 20 },
                  { upToKm: 8, fee: 40 },
                  { upToKm: 15, fee: 60 },
                  { upToKm: 9999, fee: 90 },
              ]
        ).map((r) => ({ upToKm: String(r.upToKm), fee: String(r.fee) }))
    );
    const [deliverySaving, setDeliverySaving] = useState(false);
    const [deliverySlots, setDeliverySlots] = useState<string[]>(preferences.deliverySlots ?? []);
    const [newSlot, setNewSlot] = useState('');

    useEffect(() => {
        let cancelled = false;
        getServiceableAreas()
            .then((r) => {
                if (!cancelled) {
                    setServiceableCities(r.cities || []);
                    setServiceablePincodes(r.pincodes || []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setServiceableCities(['Bangalore']);
                    setServiceablePincodes([]);
                }
            })
            .finally(() => { if (!cancelled) setCitiesLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        setDeliveryCharge(String(preferences.deliveryCharge ?? 0));
    }, [preferences.deliveryCharge]);

    useEffect(() => {
        setDeliveryFeeMode(preferences.deliveryFeeMode === 'PER_KM' ? 'PER_KM' : 'SLAB');
    }, [preferences.deliveryFeeMode]);

    useEffect(() => {
        setDeliveryPerKmRate(String(preferences.deliveryPerKmRate ?? 10));
    }, [preferences.deliveryPerKmRate]);

    useEffect(() => {
        setFreeDeliveryThreshold(String(preferences.freeDeliveryThreshold ?? 0));
    }, [preferences.freeDeliveryThreshold]);

    useEffect(() => {
        setFreeDeliveryWithinKm(String(preferences.freeDeliveryWithinKm ?? 0));
    }, [preferences.freeDeliveryWithinKm]);

    useEffect(() => {
        setPlatformFee(String(preferences.platformFee ?? 0));
    }, [preferences.platformFee]);

    useEffect(() => {
        if (preferences.deliveryFeeRules && preferences.deliveryFeeRules.length) {
            setDeliveryFeeRules(
                preferences.deliveryFeeRules.map((r) => ({ upToKm: String(r.upToKm), fee: String(r.fee) }))
            );
        }
    }, [preferences.deliveryFeeRules]);

    useEffect(() => {
        setDeliverySlots(preferences.deliverySlots ?? []);
    }, [preferences.deliverySlots]);

    const handleSaveDeliveryCharge = async () => {
        const num = parseFloat(deliveryCharge);
        if (!Number.isFinite(num) || num < 0) {
            toast.error('Enter a valid amount (0 or more)');
            return;
        }
        const previousDeliveryPrefs = {
            deliveryCharge: preferences.deliveryCharge,
            deliveryFeeRules: preferences.deliveryFeeRules,
            deliveryFeeMode: preferences.deliveryFeeMode,
            deliveryPerKmRate: preferences.deliveryPerKmRate,
            freeDeliveryThreshold: preferences.freeDeliveryThreshold,
            freeDeliveryWithinKm: preferences.freeDeliveryWithinKm,
            platformFee: preferences.platformFee,
            deliverySlots: preferences.deliverySlots,
        };
        setDeliverySaving(true);
        try {
            const normalizedRules = deliveryFeeRules
                .map((r) => ({ upToKm: Number(r.upToKm), fee: Number(r.fee) }))
                .filter((r) => Number.isFinite(r.upToKm) && r.upToKm > 0 && Number.isFinite(r.fee) && r.fee >= 0)
                .sort((a, b) => a.upToKm - b.upToKm);
            if (deliveryFeeMode === 'SLAB' && !normalizedRules.length) {
                toast.error('Add at least one valid distance rule');
                setDeliverySaving(false);
                return;
            }
            const perKmRateNum = Number(deliveryPerKmRate);
            if (deliveryFeeMode === 'PER_KM' && (!Number.isFinite(perKmRateNum) || perKmRateNum <= 0)) {
                toast.error('Enter a valid per-km rate (greater than 0)');
                setDeliverySaving(false);
                return;
            }
            const thresholdNum = parseFloat(freeDeliveryThreshold);
            const withinKmNum = parseFloat(freeDeliveryWithinKm);
            const platformFeeNum = parseFloat(platformFee);
            const optimisticDeliveryPrefs = {
                deliveryCharge: num,
                deliveryFeeRules: normalizedRules,
                deliveryFeeMode,
                deliveryPerKmRate: Number.isFinite(perKmRateNum) && perKmRateNum >= 0 ? perKmRateNum : 0,
                freeDeliveryThreshold: Number.isFinite(thresholdNum) && thresholdNum >= 0 ? thresholdNum : 0,
                freeDeliveryWithinKm: Number.isFinite(withinKmNum) && withinKmNum >= 0 ? withinKmNum : 0,
                platformFee: Number.isFinite(platformFeeNum) && platformFeeNum >= 0 ? platformFeeNum : 0,
            };
            // Automatically add any pending newSlot if user forgot to click Add
            let finalSlots = [...deliverySlots];
            const pendingSlot = newSlot.trim();
            if (pendingSlot && !finalSlots.includes(pendingSlot)) {
                finalSlots.push(pendingSlot);
                setDeliverySlots(finalSlots);
                setNewSlot('');
            }
            updatePreferences({
                ...optimisticDeliveryPrefs,
                deliverySlots: finalSlots,
            });

            await updateStoreSettings({
                deliveryCharge: num,
                deliveryFeeRules: normalizedRules,
                deliveryFeeMode,
                deliveryPerKmRate: Number.isFinite(perKmRateNum) && perKmRateNum >= 0 ? perKmRateNum : 0,
                freeDeliveryThreshold: Number.isFinite(thresholdNum) && thresholdNum >= 0 ? thresholdNum : 0,
                freeDeliveryWithinKm: Number.isFinite(withinKmNum) && withinKmNum >= 0 ? withinKmNum : 0,
                platformFee: Number.isFinite(platformFeeNum) && platformFeeNum >= 0 ? platformFeeNum : 0,
                preferences: {
                    ...preferences,
                    platformFee: Number.isFinite(platformFeeNum) && platformFeeNum >= 0 ? platformFeeNum : 0,
                    deliverySlots: finalSlots,
                }
            });
            toast.success('Delivery options saved successfully!');
        } catch (e: any) {
            updatePreferences({
                deliveryCharge: previousDeliveryPrefs.deliveryCharge,
                deliveryFeeRules: previousDeliveryPrefs.deliveryFeeRules,
                deliveryFeeMode: previousDeliveryPrefs.deliveryFeeMode,
                deliveryPerKmRate: previousDeliveryPrefs.deliveryPerKmRate,
                freeDeliveryThreshold: previousDeliveryPrefs.freeDeliveryThreshold,
                freeDeliveryWithinKm: previousDeliveryPrefs.freeDeliveryWithinKm,
                platformFee: previousDeliveryPrefs.platformFee,
                deliverySlots: previousDeliveryPrefs.deliverySlots,
            });
            toast.error(getUserErrorMessage(e, 'Failed to save'));
        } finally {
            setDeliverySaving(false);
        }
    };

    const handleAddSlot = () => {
        const slot = newSlot.trim();
        if (!slot) return;
        if (deliverySlots.some(s => s === slot)) {
            toast.error('Slot already exists');
            return;
        }
        setDeliverySlots([...deliverySlots, slot]);
        setNewSlot('');
    };

    const handleRemoveSlot = (index: number) => {
        setDeliverySlots(deliverySlots.filter((_, i) => i !== index));
    };

    const handleAddCity = () => {
        const city = newCity.trim();
        if (!city) return;
        if (serviceableCities.some(c => c.toLowerCase() === city.toLowerCase())) {
            toast.error('City already in list');
            return;
        }
        setServiceableCities([...serviceableCities, city]);
        setNewCity('');
        // Silently auto-fetch pincodes for this city in the background
        fetchPincodesForArea(city)
            .then((pins) => {
                if (pins.length === 0) return;
                setServiceablePincodes((prev) => {
                    const merged = [...new Set([...prev, ...pins])];
                    if (merged.length > prev.length) {
                        toast.success(`Auto-added ${merged.length - prev.length} PIN codes for ${city}`, {
                            description: 'Click "Save service areas" to apply.',
                            duration: 5000,
                        });
                    }
                    return merged;
                });
            })
            .catch(() => {
                // Silently fail — admin can use manual PIN entry
            });
    };

    const handleRemoveCity = (index: number) => {
        setServiceableCities(serviceableCities.filter((_, i) => i !== index));
    };

    const handleAddPincode = () => {
        const digits = newPincode.replace(/\D/g, '').slice(0, 6);
        if (digits.length !== 6) {
            toast.error('Enter a 6-digit PIN code');
            return;
        }
        if (serviceablePincodes.includes(digits)) {
            toast.error('PIN already in list');
            return;
        }
        setServiceablePincodes([...serviceablePincodes, digits]);
        setNewPincode('');
    };

    const handleRemovePincode = (index: number) => {
        setServiceablePincodes(serviceablePincodes.filter((_, i) => i !== index));
    };

    const handleSaveServiceableAreas = async () => {
        setCitiesSaving(true);
        try {
            await updateServiceableAreas({ cities: serviceableCities, pincodes: serviceablePincodes });
            toast.success(
                serviceablePincodes.length
                    ? 'Service areas updated. Checkout will require a listed city and PIN where configured.'
                    : 'Delivery cities updated. PIN list is empty — any 6-digit PIN is allowed (city rules still apply).',
            );
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to save'));
        }
        setCitiesSaving(false);
    };

    const handleAutoFetchPincodes = useCallback(async () => {
        const query = autoFetchQuery.trim();
        if (!query) {
            toast.error('Enter a city, district, or state name');
            return;
        }
        setAutoFetching(true);
        setAutoFetchPreview([]);
        setAutoFetchDone(false);
        try {
            const pins = await fetchPincodesForArea(query);
            if (pins.length === 0) {
                toast.error(`No PIN codes found for "${query}". Try a different spelling or area name.`);
                return;
            }
            const newPins = pins.filter((p) => !serviceablePincodes.includes(p));
            setAutoFetchPreview(pins);
            if (newPins.length === 0) {
                toast.success(`All ${pins.length} PIN codes for "${query}" are already in your list.`);
                setAutoFetchDone(true);
                return;
            }
            setServiceablePincodes((prev) => [...new Set([...prev, ...pins])]);
            setAutoFetchDone(true);
            toast.success(`Added ${newPins.length} new PIN codes for "${query}"`, {
                description: `${pins.length} total PINs found. Click "Save service areas" to apply.`,
                duration: 6000,
            });
        } catch (e: any) {
            toast.error('Could not reach PIN code lookup API. Check your connection and try again.');
        } finally {
            setAutoFetching(false);
        }
    }, [autoFetchQuery, serviceablePincodes]);

    const handleSaveRazorpay = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const keyId = razorpayKeyId.trim() || undefined;
        const keySecret = razorpayKeySecret.trim() || undefined;
        updatePreferences({ razorpayKeyId: keyId, razorpayKeySecret: keySecret });
        const result = await saveRazorpayToBackend(razorpayKeyId, razorpayKeySecret);
        if (result.ok) {
            toast.success('Razorpay credentials saved. All payments will go to this Razorpay account.');
        } else {
            toast.success('Razorpay credentials saved locally.', {
                description: result.message || 'Log in as admin and save again to sync to backend so payments use this account.',
            });
        }
        setSaving(false);
    };

    const hasRazorpayConfigured = !!(preferences.razorpayKeyId && preferences.razorpayKeySecret);
    const settingsGroups = [
        {
            title: 'Global Metadata',
            icon: Globe,
            description: 'Core storefront identity and territorial settings.',
            status: 'Operational',
            color: 'emerald'
        },
        {
            title: 'Settlement Gateways',
            icon: CreditCard,
            description: 'Encrypted payment rails and merchant clearing protocols.',
            status: 'Active',
            color: 'blue'
        },
        {
            title: 'Event Tracking',
            icon: BellRing,
            description: 'Notification logic for logistical and customer flux.',
            status: 'Verified',
            color: 'purple'
        },
        {
            title: 'Access Control',
            icon: Fingerprint,
            description: 'Identity and Access Management for secure operations.',
            status: 'Shielded',
            color: 'orange'
        },
        {
            title: 'Platform Tiering',
            icon: Hexagon,
            description: 'Scalability management and infrastructure allocation.',
            status: 'Premium',
            color: 'pink'
        },
        {
            title: 'API Settings',
            icon: Terminal,
            description: 'Internal and external endpoint orchestration.',
            status: 'Encrypted',
            color: 'slate'
        }
    ];

    return (
        <div className="space-y-10 pb-20">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Command className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">System Settings</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Environment Config</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Manage platform settings and integrations.</p>
                </div>
                <div className="px-6 py-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Core Synchronized</span>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Uptime Reliability', value: '99.99%', icon: Activity, color: 'emerald' },
                    { label: 'Latency', value: '24ms', icon: Cpu, color: 'blue' },
                    { label: 'Data Usage', value: '1.2TB', icon: HardDrive, color: 'purple' }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6"
                    >
                        <div className={cn("p-4 rounded-3xl", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Razorpay Payment Gateway */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)]"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-blue-50 text-blue-600">
                        <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Razorpay Payment Gateway</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Key ID (public) and Key Secret (private). You can change these anytime.
                        </p>
                    </div>
                    {hasRazorpayConfigured && (
                        <span className="ml-auto px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Configured
                        </span>
                    )}
                </div>
                <form onSubmit={handleSaveRazorpay} className="space-y-6 max-w-2xl">
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Razorpay Key ID</label>
                        <input
                            type="text"
                            value={razorpayKeyId}
                            onChange={(e) => setRazorpayKeyId(e.target.value)}
                            placeholder="e.g. rzp_live_xxxxxxxxxxxx"
                            className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Razorpay Key Secret</label>
                        <div className="relative">
                            <input
                                type={showSecret ? 'text' : 'password'}
                                value={razorpayKeySecret}
                                onChange={(e) => setRazorpayKeySecret(e.target.value)}
                                placeholder="Enter key secret"
                                className="w-full h-12 pl-4 pr-12 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium"
                            />
                            <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1" aria-label={showSecret ? 'Hide secret' : 'Show secret'}>
                                {showSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={saving} className="h-12 px-8 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-60">
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving…' : 'Save Razorpay credentials'}
                    </button>
                </form>
            </motion.div>

            {/* Delivery charge — applied to every order */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)]"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-orange-50 text-orange-600">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Delivery fee by distance</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Choose slab mode or per-km mode. Flat fee below is only fallback.
                        </p>
                    </div>
                </div>
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fee mode</label>
                        <select
                            value={deliveryFeeMode}
                            onChange={(e) => setDeliveryFeeMode(e.target.value === 'PER_KM' ? 'PER_KM' : 'SLAB')}
                            className="h-11 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold"
                        >
                            <option value="SLAB">Slab-based</option>
                            <option value="PER_KM">Per km (distance × rate)</option>
                        </select>
                    </div>
                    {deliveryFeeMode === 'PER_KM' && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate per km (₹)</label>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={deliveryPerKmRate}
                                onChange={(e) => setDeliveryPerKmRate(e.target.value)}
                                className="h-11 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold"
                                placeholder="e.g. 10"
                            />
                        </div>
                    )}
                </div>
                {deliveryFeeMode === 'SLAB' && (
                    <div className="space-y-3 mb-6">
                        {deliveryFeeRules.map((rule, index) => (
                            <div key={`rule-${index}`} className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 w-20">Up to (km)</span>
                                <input
                                    type="number"
                                    min={0.1}
                                    step={0.1}
                                    value={rule.upToKm}
                                    onChange={(e) =>
                                        setDeliveryFeeRules((prev) =>
                                            prev.map((r, i) => (i === index ? { ...r, upToKm: e.target.value } : r))
                                        )
                                    }
                                    className="h-10 w-28 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                                />
                                <span className="text-xs font-bold text-slate-500">Fee (₹)</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={rule.fee}
                                    onChange={(e) =>
                                        setDeliveryFeeRules((prev) =>
                                            prev.map((r, i) => (i === index ? { ...r, fee: e.target.value } : r))
                                        )
                                    }
                                    className="h-10 w-28 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setDeliveryFeeRules((prev) => prev.filter((_, i) => i !== index))}
                                    className="h-10 px-3 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setDeliveryFeeRules((prev) => [...prev, { upToKm: '', fee: '' }])}
                            className="h-10 px-4 rounded-xl bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add distance slab
                        </button>
                    </div>
                )}
                <div className="mb-8 p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100/50 space-y-5">
                    <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Free delivery rules</p>
                        <p className="text-xs text-slate-500 max-w-lg">
                            Set minimum order (₹) and/or max distance (km). When both are set, free delivery applies only if the order meets the amount
                            <strong> and </strong>
                            the address is within that distance. Use 0 on either field to ignore that condition.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Min order value (₹)</label>
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-600 font-bold">₹</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={freeDeliveryThreshold}
                                    onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                                    className="h-12 flex-1 px-4 rounded-xl border-2 border-emerald-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium"
                                    placeholder="e.g. 500"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400">0 = do not require a minimum order</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Within distance (km)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={freeDeliveryWithinKm}
                                    onChange={(e) => setFreeDeliveryWithinKm(e.target.value)}
                                    className="h-12 flex-1 px-4 rounded-xl border-2 border-emerald-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium"
                                    placeholder="e.g. 8"
                                />
                                <span className="text-emerald-600 font-bold text-sm">km</span>
                            </div>
                            <p className="text-[10px] text-slate-400">0 = any distance (if min order is set)</p>
                        </div>
                    </div>
                    <p className="text-xs font-semibold text-emerald-800 bg-emerald-100/60 rounded-xl px-3 py-2">
                        Example: ₹500 + 8 km → free delivery when subtotal is at least ₹500 and delivery is within 8 km of the store.
                    </p>
                </div>
                <div className="mb-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Flat fallback delivery fee</p>
                            <p className="text-xs text-slate-500 max-w-sm">
                                Used only when distance cannot be calculated. Distance slabs / per-km above usually apply instead.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-bold">₹</span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={deliveryCharge}
                                onChange={(e) => setDeliveryCharge(e.target.value)}
                                className="h-12 w-32 px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm font-medium"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>
                <div className="mb-8 p-6 bg-slate-50/80 rounded-[2rem] border border-dashed border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Platform fee (optional)</p>
                            <p className="text-xs text-slate-500 max-w-sm">
                                Extra handling fee added to every order bill — not free delivery and not the km-based delivery charge. Leave 0 to hide.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-bold">₹</span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={platformFee}
                                onChange={(e) => setPlatformFee(e.target.value)}
                                className="h-12 w-32 px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm font-medium"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={handleSaveDeliveryCharge}
                        disabled={deliverySaving}
                        className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                        <Save className="h-4 w-4" />
                        {deliverySaving ? 'Saving…' : 'Save delivery settings'}
                    </button>
                </div>
            </motion.div>

            {/* Service areas / Delivery cities - where we sell and deliver */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)]"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
                        <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Delivery cities &amp; PIN codes</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Cities gate checkout by name. Optional PIN list: when you add one or more 6-digit PINs, checkout only accepts those PINs (plus city rules).
                        </p>
                    </div>
                </div>
                {citiesLoading ? (
                    <p className="text-sm text-slate-500">Loading…</p>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-3 mb-6">
                            {serviceableCities.map((city, index) => (
                                <span
                                    key={`${city}-${index}`}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-sm font-bold"
                                >
                                    {city}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveCity(index)}
                                        className="p-0.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        aria-label={`Remove ${city}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-3 items-center">
                            <input
                                type="text"
                                value={newCity}
                                onChange={(e) => setNewCity(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCity())}
                                placeholder="e.g. Mumbai, Chennai"
                                className="h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium w-48"
                            />
                            <button
                                type="button"
                                onClick={handleAddCity}
                                className="h-12 px-4 rounded-xl bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Add city
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveServiceableAreas}
                                disabled={citiesSaving}
                                className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-60"
                            >
                                <Save className="h-4 w-4" />
                                {citiesSaving ? 'Saving…' : 'Save service areas'}
                            </button>
                        </div>

                        <div className="mt-10 pt-8 border-t border-slate-100">
                            {/* Auto-fetch pincodes by City / District / State */}
                            <div className="mb-8 p-6 rounded-[2rem] bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border border-emerald-100/80 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                                        <Search className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Auto-Fetch PIN Codes by Area</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Type a city, district, or state — all matching PIN codes are added automatically.</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3 items-center">
                                    <select
                                        value={autoFetchType}
                                        onChange={(e) => setAutoFetchType(e.target.value as 'city' | 'district' | 'state')}
                                        className="h-11 px-3 rounded-xl border border-emerald-200 bg-white text-slate-700 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                                    >
                                        <option value="city">City</option>
                                        <option value="district">District</option>
                                        <option value="state">State</option>
                                    </select>
                                    <div className="relative flex-1 min-w-[180px]">
                                        <input
                                            type="text"
                                            value={autoFetchQuery}
                                            onChange={(e) => { setAutoFetchQuery(e.target.value); setAutoFetchDone(false); setAutoFetchPreview([]); }}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void handleAutoFetchPincodes())}
                                            placeholder={autoFetchType === 'city' ? 'e.g. Bangalore' : autoFetchType === 'district' ? 'e.g. Mysore' : 'e.g. Karnataka'}
                                            className="h-11 w-full pl-4 pr-4 rounded-xl border border-emerald-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm transition-all"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void handleAutoFetchPincodes()}
                                        disabled={autoFetching}
                                        className="h-11 px-5 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {autoFetching ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Fetching…</>
                                        ) : autoFetchDone ? (
                                            <><CheckCircle2 className="h-4 w-4" /> Done</>  
                                        ) : (
                                            <><Search className="h-4 w-4" /> Fetch PINs</>
                                        )}
                                    </button>
                                </div>
                                <AnimatePresence>
                                    {autoFetchPreview.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-4 overflow-hidden"
                                        >
                                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2">
                                                {autoFetchPreview.length} PIN codes found for &quot;{autoFetchQuery}&quot;
                                            </p>
                                            <div className="max-h-28 overflow-y-auto rounded-xl bg-white/60 border border-emerald-100 p-3">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {autoFetchPreview.slice(0, 60).map((pin) => (
                                                        <span key={pin} className="inline-block font-mono text-[10px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">{pin}</span>
                                                    ))}
                                                    {autoFetchPreview.length > 60 && (
                                                        <span className="inline-block text-[10px] font-bold text-slate-400 px-2 py-1">+{autoFetchPreview.length - 60} more…</span>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Serviceable PIN codes (optional)</p>
                                    <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                                        Leave empty to allow any 6-digit PIN inside your cities. If you add PINs, checkout only accepts addresses in this list (still combined with city rules above).
                                    </p>
                                </div>
                                {serviceablePincodes.length > 0 && (
                                    <span className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                                        {serviceablePincodes.length} PIN{serviceablePincodes.length === 1 ? '' : 's'}
                                    </span>
                                )}
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 mb-4">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Saved PINs</p>
                                {serviceablePincodes.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">No PIN restrictions — any valid 6-digit PIN is allowed within your cities.</p>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto pr-1">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {serviceablePincodes.map((pin, index) => (
                                                <div
                                                    key={pin}
                                                    className="flex items-center justify-between gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 shadow-sm"
                                                >
                                                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums tracking-tight">{pin}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePincode(index)}
                                                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                                        aria-label={`Remove PIN ${pin}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-3 items-center">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={newPincode}
                                    onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPincode())}
                                    placeholder="560001"
                                    className="h-12 px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-900 font-mono text-sm w-36 shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddPincode}
                                    className="h-12 px-5 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add PIN
                                </button>
                                <p className="text-[11px] text-slate-400 w-full sm:w-auto sm:ml-2">Press Enter or Add PIN, then use &quot;Save service areas&quot; above.</p>
                            </div>
                        </div>
                    </>
                )}
            </motion.div>

            {/* Delivery Slots — time windows for deliveries */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)]"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-orange-50 text-orange-600">
                        <Clock className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Delivery Time Slots</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Available slots shown at checkout. E.g. "Today · 6pm – 8pm"
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 mb-6">
                    {deliverySlots.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No custom slots. Checkout will show default slots.</p>
                    ) : (
                        deliverySlots.map((slot, index) => (
                            <span
                                key={`${slot}-${index}`}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-black uppercase"
                            >
                                {slot}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSlot(index)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </span>
                        ))
                    )}
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    <input
                        type="text"
                        value={newSlot}
                        onChange={(e) => setNewSlot(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSlot())}
                        placeholder="e.g. Tomorrow · 8am – 11am"
                        className="h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm font-medium w-64"
                    />
                    <button
                        type="button"
                        onClick={handleAddSlot}
                        className="h-12 px-6 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add slot
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveDeliveryCharge}
                        disabled={deliverySaving}
                        className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                        <Save className="h-4 w-4" />
                        {deliverySaving ? 'Saving…' : 'Save all delivery options'}
                    </button>
                    <p className="text-[11px] text-slate-400 w-full italic">Note: "Save all delivery options" applies both Delivery Fee and Time Slots.</p>
                </div>
            </motion.div>


            {/* Settings Architecture */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {settingsGroups.map((group, i) => (
                    <motion.div
                        key={group.title ?? `settings-group-${i}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-2xl hover:shadow-slate-200/40 transition-all cursor-pointer group relative overflow-hidden"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className={cn("p-5 rounded-[1.75rem] transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm", `bg-${group.color}-50 text-${group.color}-600`)}>
                                    <group.icon className="h-7 w-7" />
                                </div>
                                <span className={cn(
                                    "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border",
                                    `bg-${group.color}-50/50 border-${group.color}-100 text-${group.color}-700`
                                )}>
                                    {group.status}
                                </span>
                            </div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2 group-hover:text-emerald-600 transition-colors">{group.title}</h3>
                            <p className="text-[11px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">{group.description}</p>

                            <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                                <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Update Settings</span>
                                <div className="h-8 w-8 bg-slate-900 rounded-full flex items-center justify-center text-white">
                                    <Zap className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                        <div className={cn("absolute -right-20 -bottom-20 w-48 h-48 blur-[60px] opacity-10 transition-all duration-1000 group-hover:opacity-20 group-hover:scale-150", `bg-${group.color}-400`)} />
                    </motion.div>
                ))}
            </div>

            {/* Compliance Warning HUD */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-900 rounded-[3rem] p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 border border-white/10 shadow-2xl shadow-slate-900/40"
            >
                <div className="flex flex-col md:flex-row md:items-center gap-8">
                    <div className="h-20 w-20 bg-emerald-500/10 rounded-[2.25rem] border border-emerald-500/20 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Simulated Shell Environment</h4>
                        <p className="text-emerald-400/60 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed max-w-md italic">
                            Most system vectors are currently in read-only mode for this demonstration protocol. Full write access requires Super-Admin clearance.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => toast.success('Authorization Requested')}
                    className="h-14 px-10 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl active:scale-95"
                >
                    Request Write Access
                </button>
            </motion.div>
        </div>
    );
}
