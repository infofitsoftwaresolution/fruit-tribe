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
        <div className="space-y-6 pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Command className="w-4 h-4 text-emerald-600" />
                        <span className="admin-section-label">System Configuration</span>
                    </div>
                    <h1 className="admin-page-title">Settings</h1>
                    <p className="admin-page-subtitle">Manage store identity, payment gateways, delivery options, and serviceable regions.</p>
                </div>
                <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700">All Systems Operational</span>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'System Uptime', value: '99.99%', icon: Activity },
                    { label: 'API Latency', value: '24ms', icon: Cpu },
                    { label: 'Data Storage', value: '1.2TB', icon: HardDrive }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={stat.label}
                        className="admin-stat-card flex items-center gap-4"
                    >
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-slate-50 text-slate-600">
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="admin-stat-value">{stat.value}</p>
                            <p className="admin-stat-label">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Razorpay Payment Gateway */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="admin-card p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                        <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="admin-section-heading">Razorpay Payment Gateway</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Configure active transaction credentials. Key ID (public) and Key Secret (private) can be updated anytime.
                        </p>
                    </div>
                    {hasRazorpayConfigured && (
                        <span className="ml-auto admin-badge-emerald">
                            Configured
                        </span>
                    )}
                </div>
                <form onSubmit={handleSaveRazorpay} className="space-y-4 max-w-xl">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Razorpay Key ID</label>
                        <input
                            type="text"
                            value={razorpayKeyId}
                            onChange={(e) => setRazorpayKeyId(e.target.value)}
                            placeholder="e.g. rzp_live_xxxxxxxxxxxx"
                            className="admin-input"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Razorpay Key Secret</label>
                        <div className="relative">
                            <input
                                type={showSecret ? 'text' : 'password'}
                                value={razorpayKeySecret}
                                onChange={(e) => setRazorpayKeySecret(e.target.value)}
                                placeholder="Enter key secret"
                                className="admin-input pr-10"
                            />
                            <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1" aria-label={showSecret ? 'Hide secret' : 'Show secret'}>
                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="pt-2">
                        <button type="submit" disabled={saving} className="admin-btn-primary">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {saving ? 'Saving…' : 'Save Razorpay Credentials'}
                        </button>
                    </div>
                </form>
            </motion.div>

            {/* Delivery Charge Settings */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="admin-card p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
                        <Zap className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="admin-section-heading">Delivery Fee Structure</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Set up dynamic delivery rules by distance (via Google Maps routing) or flat-rate fallbacks.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Calculation Method</label>
                        <select
                            value={deliveryFeeMode}
                            onChange={(e) => setDeliveryFeeMode(e.target.value === 'PER_KM' ? 'PER_KM' : 'SLAB')}
                            className="admin-select w-full"
                        >
                            <option value="SLAB">Distance-based Slabs</option>
                            <option value="PER_KM">Flat Rate Per Kilometer</option>
                        </select>
                    </div>
                    {deliveryFeeMode === 'PER_KM' && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Rate per Kilometer (₹)</label>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={deliveryPerKmRate}
                                onChange={(e) => setDeliveryPerKmRate(e.target.value)}
                                className="admin-input"
                                placeholder="e.g. 10"
                            />
                        </div>
                    )}
                </div>

                {deliveryFeeMode === 'SLAB' && (
                    <div className="space-y-3 mb-6">
                        <label className="text-xs font-semibold text-slate-700 block">Distance Slabs &amp; Fees</label>
                        <div className="space-y-2">
                            {deliveryFeeRules.map((rule, index) => (
                                <div key={`rule-${index}`} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-w-xl">
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-slate-500">Up to</span>
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
                                            className="admin-input h-8 w-20 px-2"
                                        />
                                        <span className="text-xs text-slate-500">km</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-slate-500">Fee (₹)</span>
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
                                            className="admin-input h-8 w-20 px-2"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDeliveryFeeRules((prev) => prev.filter((_, i) => i !== index))}
                                        className="h-8 w-8 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setDeliveryFeeRules((prev) => [...prev, { upToKm: '', fee: '' }])}
                            className="admin-btn-secondary h-8 px-3 text-xs"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Distance Slab
                        </button>
                    </div>
                )}

                {/* Free delivery rules banner */}
                <div className="mb-6 p-5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-4">
                    <div>
                        <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Free Delivery Incentives</h4>
                        <p className="text-xs text-emerald-700/80 mt-1">
                            Offer free shipping to incentivize larger checkouts. Set thresholds below. If both criteria are set, the order must meet BOTH to qualify. Enter 0 to disable a condition.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-emerald-800">Minimum Order Subtotal (₹)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600">₹</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={freeDeliveryThreshold}
                                    onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                                    className="admin-input pl-7 border-emerald-200 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    placeholder="e.g. 500"
                                />
                            </div>
                            <p className="text-[10px] text-emerald-600/70">0 = no minimum order threshold</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-emerald-800">Maximum Delivery Distance (km)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={freeDeliveryWithinKm}
                                    onChange={(e) => setFreeDeliveryWithinKm(e.target.value)}
                                    className="admin-input pr-10 border-emerald-200 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    placeholder="e.g. 8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600">km</span>
                            </div>
                            <p className="text-[10px] text-emerald-600/70">0 = eligible for any distance</p>
                        </div>
                    </div>
                    <div className="text-xs font-medium text-emerald-800 bg-white border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Example: ₹500 + 8 km means free shipping applies only for orders &ge; ₹500 that reside within 8 km.</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold text-slate-700">Flat Fallback Delivery Fee</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Applied if Google Maps routing distance is unavailable.</p>
                        </div>
                        <div className="relative shrink-0 w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">₹</span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={deliveryCharge}
                                onChange={(e) => setDeliveryCharge(e.target.value)}
                                className="admin-input pl-7"
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold text-slate-700">Platform Handling Fee</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Optional flat surcharge added to every transaction. Leave 0 to hide.</p>
                        </div>
                        <div className="relative shrink-0 w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">₹</span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={platformFee}
                                onChange={(e) => setPlatformFee(e.target.value)}
                                className="admin-input pl-7"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end border-t border-slate-100 pt-4">
                    <button
                        type="button"
                        onClick={handleSaveDeliveryCharge}
                        disabled={deliverySaving}
                        className="admin-btn-primary"
                    >
                        {deliverySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {deliverySaving ? 'Saving…' : 'Save Delivery Settings'}
                    </button>
                </div>
            </motion.div>

            {/* Service Areas (Cities & Pincodes) */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="admin-card p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="admin-section-heading">Service Areas</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Manage authorized checkout delivery locations. Pincodes limit shipping options within active cities.
                        </p>
                    </div>
                </div>

                {citiesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        Loading service regions...
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Cities Group */}
                        <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-2">Serviceable Cities</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {serviceableCities.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No cities listed. Add at least one city.</p>
                                ) : (
                                    serviceableCities.map((city, index) => (
                                        <span
                                            key={`${city}-${index}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700"
                                        >
                                            {city}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCity(index)}
                                                className="p-0.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                aria-label={`Remove ${city}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))
                                )}
                            </div>
                            <div className="flex gap-2 max-w-md">
                                <input
                                    type="text"
                                    value={newCity}
                                    onChange={(e) => setNewCity(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCity())}
                                    placeholder="e.g. Bangalore, Patna"
                                    className="admin-input flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddCity}
                                    className="admin-btn-secondary h-9 px-3 shrink-0"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add City
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveServiceableAreas}
                                    disabled={citiesSaving}
                                    className="admin-btn-primary h-9 px-4 shrink-0"
                                >
                                    {citiesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Areas
                                </button>
                            </div>
                        </div>

                        {/* Pincode Lookup and list */}
                        <div className="border-t border-slate-100 pt-6">
                            <div className="mb-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <Search className="h-5 w-5 text-emerald-600" />
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-800">Auto-Fetch Pincodes by Territory</h4>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Quickly import all pincodes within a city, district, or state via postal lookup.</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <select
                                        value={autoFetchType}
                                        onChange={(e) => setAutoFetchType(e.target.value as 'city' | 'district' | 'state')}
                                        className="admin-select text-xs h-9"
                                    >
                                        <option value="city">City</option>
                                        <option value="district">District</option>
                                        <option value="state">State</option>
                                    </select>
                                    <div className="relative flex-1 min-w-[200px]">
                                        <input
                                            type="text"
                                            value={autoFetchQuery}
                                            onChange={(e) => { setAutoFetchQuery(e.target.value); setAutoFetchPreview([]); setAutoFetchDone(false); }}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void handleAutoFetchPincodes())}
                                            placeholder={autoFetchType === 'city' ? 'e.g. Patna' : autoFetchType === 'district' ? 'e.g. Muzaffarpur' : 'e.g. Bihar'}
                                            className="admin-input h-9"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void handleAutoFetchPincodes()}
                                        disabled={autoFetching}
                                        className="admin-btn-primary h-9 text-xs"
                                    >
                                        {autoFetching ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Fetching…</>
                                        ) : autoFetchDone ? (
                                            <><CheckCircle2 className="h-4 w-4" /> Done</>  
                                        ) : (
                                            <><Search className="h-3.5 w-3.5" /> Fetch PINs</>
                                        )}
                                    </button>
                                </div>
                                <AnimatePresence>
                                    {autoFetchPreview.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-3 overflow-hidden"
                                        >
                                            <p className="text-[10px] font-semibold text-emerald-700 mb-1.5">
                                                {autoFetchPreview.length} PIN codes retrieved for &quot;{autoFetchQuery}&quot;
                                            </p>
                                            <div className="max-h-24 overflow-y-auto rounded-lg bg-white border border-emerald-100 p-2 custom-scrollbar">
                                                <div className="flex flex-wrap gap-1">
                                                    {autoFetchPreview.slice(0, 50).map((pin) => (
                                                        <span key={pin} className="inline-block font-mono text-[9px] font-semibold text-emerald-900 bg-emerald-50/50 border border-emerald-100 px-1.5 py-0.5 rounded">{pin}</span>
                                                    ))}
                                                    {autoFetchPreview.length > 50 && (
                                                        <span className="inline-block text-[9px] font-medium text-slate-400 px-1.5 py-0.5">+{autoFetchPreview.length - 50} more…</span>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                <div>
                                    <p className="text-xs font-semibold text-slate-700">Specific Delivery Pincodes</p>
                                    <p className="text-[11px] text-slate-400">Leave blank to enable all pincodes in selected cities. If configured, checkout is restricted to these areas only.</p>
                                </div>
                                {serviceablePincodes.length > 0 && (
                                    <span className="admin-badge-slate text-[10px] font-semibold">
                                        {serviceablePincodes.length} Pincodes Active
                                    </span>
                                )}
                            </div>

                            <div className="border border-slate-100 bg-slate-50 p-3 rounded-lg mb-3">
                                {serviceablePincodes.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No pincode restrictions — all locations within authorized cities can check out.</p>
                                ) : (
                                    <div className="max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                            {serviceablePincodes.map((pin, index) => (
                                                <div
                                                    key={pin}
                                                    className="flex items-center justify-between gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1 shadow-sm"
                                                >
                                                    <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">{pin}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePincode(index)}
                                                        className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                                                        aria-label={`Remove PIN ${pin}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 max-w-sm">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={newPincode}
                                    onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPincode())}
                                    placeholder="560001"
                                    className="admin-input w-28"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddPincode}
                                    className="admin-btn-secondary h-9 text-xs"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Pincode
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Delivery Time Slots */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="admin-card p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="admin-section-heading">Delivery Time Slots</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Configure scheduled delivery slots displayed to buyers during checkout.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    {deliverySlots.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No custom delivery slots configured. Default schedule will be used.</p>
                    ) : (
                        deliverySlots.map((slot, index) => (
                            <span
                                key={`${slot}-${index}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700"
                            >
                                {slot}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSlot(index)}
                                    className="p-0.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </span>
                        ))
                    )}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <input
                        type="text"
                        value={newSlot}
                        onChange={(e) => setNewSlot(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSlot())}
                        placeholder="e.g. Tomorrow · 8am – 11am"
                        className="admin-input w-64"
                    />
                    <button
                        type="button"
                        onClick={handleAddSlot}
                        className="admin-btn-secondary h-9 text-xs"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Slot
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveDeliveryCharge}
                        disabled={deliverySaving}
                        className="admin-btn-primary h-9 text-xs"
                    >
                        {deliverySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {deliverySaving ? 'Saving…' : 'Save Delivery Schedule'}
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">Note: Time slots and delivery fees are persisted together using "Save Delivery Schedule".</p>
            </motion.div>

            {/* Settings Architecture */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {settingsGroups.map((group, i) => (
                    <motion.div
                        key={group.title ?? `settings-group-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="admin-card p-5 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn("p-2 rounded-lg bg-slate-50 text-slate-600 transition-all duration-300 group-hover:bg-emerald-50 group-hover:text-emerald-600")}>
                                    <group.icon className="h-5 w-5" />
                                </div>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                    group.color === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                    group.color === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                    group.color === 'purple' ? 'bg-purple-50 border-purple-100 text-purple-700' :
                                    group.color === 'orange' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                    group.color === 'pink' ? 'bg-pink-50 border-pink-100 text-pink-700' :
                                    'bg-slate-100 border-slate-200 text-slate-700'
                                )}>
                                    {group.status}
                                </span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">{group.title}</h3>
                            <p className="text-xs text-slate-400 leading-normal">{group.description}</p>
                        </div>

                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <span className="text-[10px] font-semibold text-slate-900">Manage Parameters</span>
                            <Zap className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Security Clearance Callout */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="admin-card p-6 bg-slate-900 border-none text-white flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 shrink-0">
                        <Lock className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-white">Simulated Sandbox Environment</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-md">
                            Hardware sync controls are running in a protected sandbox. Some underlying physical resources may require super-admin credentials to update.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => toast.success('Authorization requested successfully!')}
                    className="admin-btn h-10 px-5 bg-white text-slate-900 hover:bg-emerald-400 hover:text-slate-950 shadow-sm shrink-0"
                >
                    Request Credentials
                </button>
            </motion.div>
        </div>
    );
}
