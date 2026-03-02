import { useState, useEffect } from 'react';
import {
    CreditCard, Zap, Globe, Cpu, Activity,
    Lock, HardDrive, Fingerprint, Eye, EyeOff, Save,
    Hexagon, BellRing, Terminal, Command, MapPin, Plus, Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import { toast } from 'sonner';
import { getServiceableAreas, updateServiceableAreas, getStoreSettings, updateStoreSettings, getEffectiveApiBase } from '@/lib/api';

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
        return { ok: false, message: e?.message || 'Backend unreachable.' };
    }
}

export function AdminSettingsPage() {
    const { preferences, updatePreferences } = useStore();
    const [razorpayKeyId, setRazorpayKeyId] = useState(preferences.razorpayKeyId ?? '');
    const [razorpayKeySecret, setRazorpayKeySecret] = useState(preferences.razorpayKeySecret ?? '');
    const [showSecret, setShowSecret] = useState(false);
    const [saving, setSaving] = useState(false);
    const [serviceableCities, setServiceableCities] = useState<string[]>([]);
    const [newCity, setNewCity] = useState('');
    const [citiesLoading, setCitiesLoading] = useState(true);
    const [citiesSaving, setCitiesSaving] = useState(false);
    const [deliveryCharge, setDeliveryCharge] = useState<string>(String(preferences.deliveryCharge ?? 0));
    const [deliverySaving, setDeliverySaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getServiceableAreas()
            .then((r) => { if (!cancelled) setServiceableCities(r.cities || []); })
            .catch(() => { if (!cancelled) setServiceableCities(['Bangalore']); })
            .finally(() => { if (!cancelled) setCitiesLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        setDeliveryCharge(String(preferences.deliveryCharge ?? 0));
    }, [preferences.deliveryCharge]);

    const handleSaveDeliveryCharge = async () => {
        const num = parseFloat(deliveryCharge);
        if (!Number.isFinite(num) || num < 0) {
            toast.error('Enter a valid amount (0 or more)');
            return;
        }
        setDeliverySaving(true);
        try {
            await updateStoreSettings({ deliveryCharge: num });
            updatePreferences({ deliveryCharge: num });
            toast.success('Delivery charge updated. It will apply to new orders.');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        } finally {
            setDeliverySaving(false);
        }
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
    };

    const handleRemoveCity = (index: number) => {
        setServiceableCities(serviceableCities.filter((_, i) => i !== index));
    };

    const handleSaveServiceableAreas = async () => {
        setCitiesSaving(true);
        try {
            await updateServiceableAreas(serviceableCities);
            toast.success('Delivery cities updated. Products are now sold only in these areas.');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        }
        setCitiesSaving(false);
    };

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
            title: 'Event Telemetry',
            icon: BellRing,
            description: 'Notification logic for logistical and customer flux.',
            status: 'Verified',
            color: 'purple'
        },
        {
            title: 'IAM Protocols',
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
            title: 'API Flux Nexus',
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
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">System Configuration Suite</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Environment Config</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Strategic calibration and infrastructure maintenance protocols.</p>
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
                    { label: 'Latency Node', value: '24ms', icon: Cpu, color: 'blue' },
                    { label: 'Data Throughput', value: '1.2TB', icon: HardDrive, color: 'purple' }
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
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Delivery charge</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Flat delivery fee in ₹ (INR) added to every order. Set 0 for free delivery.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold">₹</span>
                        <input
                            type="number"
                            min={0}
                            step={1}
                            value={deliveryCharge}
                            onChange={(e) => setDeliveryCharge(e.target.value)}
                            className="h-12 w-32 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm font-medium"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSaveDeliveryCharge}
                        disabled={deliverySaving}
                        className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                        <Save className="h-4 w-4" />
                        {deliverySaving ? 'Saving…' : 'Save delivery charge'}
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
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Delivery cities (Service areas)</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            We only sell and deliver in these cities. Add or remove to control where your products are available.
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
                                {citiesSaving ? 'Saving…' : 'Save delivery cities'}
                            </button>
                        </div>
                    </>
                )}
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
                                <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Adjust Protocol</span>
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
