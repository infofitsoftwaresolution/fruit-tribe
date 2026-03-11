import { useEffect, useState } from 'react';
import {
    Activity,
    ArrowRight,
    Package,
    IndianRupee,
    Truck,
    Clock,
    MapPin,
    Zap,
    ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { getEffectiveApiBase } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DeliveryDashboardData {
    partnerId: string;
    name: string;
    onlineStatus: string;
    assignedToday: number;
    deliveredToday: number;
    pendingToday: number;
    earningsToday: number;
    codCollectedToday: number;
    distanceTodayKm: number;
}

export function DeliveryDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<DeliveryDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [online, setOnline] = useState(false);

    // Background location ping when online
    useEffect(() => {
        if (!online) return;
        const interval = setInterval(async () => {
            if (!('geolocation' in navigator)) return;
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                    });
                });
                const token = localStorage.getItem('token');
                await fetch(`${getEffectiveApiBase()}/delivery/location`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: token ? `Bearer ${token}` : '',
                    },
                    body: JSON.stringify({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    }),
                });
            } catch {
                // silently ignore
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [online]);

    useEffect(() => {
        const load = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${getEffectiveApiBase()}/delivery/dashboard`, {
                    headers: { Authorization: token ? `Bearer ${token}` : '' },
                });
                if (!res.ok) throw new Error('Failed to load dashboard');
                const json = await res.json();
                setData(json);
                setOnline(json.onlineStatus === 'ONLINE');
            } catch (e: any) {
                toast.error(e?.message || 'Unable to load delivery dashboard');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (!user || user.role !== 'delivery_partner') {
        return (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-10 text-center">
                <p className="text-sm text-slate-500">You are not logged in as a delivery partner.</p>
            </div>
        );
    }

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[320px]">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-10 text-center">
                <p className="text-sm text-slate-500">No dashboard data available.</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20">
            {/* Command Center Header - match Admin */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            Delivery Console
                        </span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
                        Welcome, {data.name}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">
                        Real-time delivery metrics and assignment overview.
                    </p>
                </motion.div>

                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            'px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm border',
                            online
                                ? 'bg-emerald-50 border-emerald-100'
                                : 'bg-slate-100 border-slate-200'
                        )}
                    >
                        <div
                            className={cn(
                                'h-2 w-2 rounded-full',
                                online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            )}
                        />
                        <span
                            className={cn(
                                'text-[10px] font-black uppercase tracking-widest',
                                online ? 'text-emerald-700' : 'text-slate-600'
                            )}
                        >
                            {online ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    <button
                        disabled={toggling}
                        onClick={async () => {
                            const next = !online;
                            setToggling(true);
                            try {
                                let lat: number | undefined;
                                let lng: number | undefined;
                                if ('geolocation' in navigator) {
                                    try {
                                        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                                                enableHighAccuracy: true,
                                                timeout: 5000,
                                            });
                                        });
                                        lat = pos.coords.latitude;
                                        lng = pos.coords.longitude;
                                    } catch {
                                        // ignore
                                    }
                                }
                                const token = localStorage.getItem('token');
                                const res = await fetch(`${getEffectiveApiBase()}/delivery/status`, {
                                    method: 'PATCH',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: token ? `Bearer ${token}` : '',
                                    },
                                    body: JSON.stringify({ online: next, lat, lng }),
                                });
                                if (!res.ok) throw new Error('Failed to update status');
                                setOnline(next);
                                setData((prev) =>
                                    prev ? { ...prev, onlineStatus: next ? 'ONLINE' : 'OFFLINE' } : prev
                                );
                                toast.success(next ? 'You are now ONLINE' : 'You are now OFFLINE');
                            } catch (e: any) {
                                toast.error(e?.message || 'Unable to change status');
                            } finally {
                                setToggling(false);
                            }
                        }}
                        className={cn(
                            'h-11 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all',
                            online
                                ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                : 'bg-slate-900 text-white border-slate-900 hover:bg-emerald-500 hover:border-emerald-500'
                        )}
                    >
                        {online ? 'Go offline' : 'Go online'}
                    </button>
                </div>
            </div>

            {/* Top tier metrics - same card style as Admin (MetricGlassCard) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricGlassCard
                    label="Assigned today"
                    value={data.assignedToday}
                    sub="Total assignments"
                    color="blue"
                    icon={Package}
                />
                <MetricGlassCard
                    label="Delivered"
                    value={data.deliveredToday}
                    sub="Completed drops"
                    color="emerald"
                    icon={Truck}
                    trend="+0"
                />
                <MetricGlassCard
                    label="Pending"
                    value={data.pendingToday}
                    sub="Action required"
                    color="orange"
                    icon={Clock}
                />
                <MetricGlassCard
                    label="Earnings today"
                    value={`₹${data.earningsToday.toFixed(2)}`}
                    sub="Delivery pay"
                    color="emerald"
                    icon={IndianRupee}
                />
            </div>

            {/* Second row: COD, Distance - match admin grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div
                    whileHover={{ y: -2 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 rounded-[1.5rem] border bg-sky-50 text-sky-600 border-sky-100 transition-all duration-500 group-hover:scale-110">
                                <IndianRupee className="w-6 h-6" />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            COD collected today
                        </p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-none">
                            ₹{data.codCollectedToday.toFixed(2)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                            Cash on delivery
                        </p>
                    </div>
                </motion.div>
                <motion.div
                    whileHover={{ y: -2 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 rounded-[1.5rem] border bg-purple-50 text-purple-600 border-purple-100 transition-all duration-500 group-hover:scale-110">
                                <MapPin className="w-6 h-6" />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Distance today
                        </p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-none">
                            {data.distanceTodayKm.toFixed(1)} km
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                            Total route
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Bottom: CTA card + quick actions - match Admin right column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                                Your assignments
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Pick up and deliver orders
                            </p>
                        </div>
                        <Link
                            to="/delivery/assignments"
                            className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all"
                        >
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                        </Link>
                    </div>
                    <div className="p-8 bg-slate-50/30 border-t border-slate-50">
                        <button
                            onClick={() => navigate('/delivery/assignments')}
                            className="w-full h-14 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 hover:shadow-lg transition-all"
                        >
                            View all assignments
                        </button>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl h-full flex flex-col justify-center"
                >
                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-6">
                            <Zap className="h-4 w-4 fill-emerald-500" />
                            Quick actions
                        </div>
                        <h3 className="text-4xl font-black mb-4 tracking-tighter leading-none">
                            Stay on route.
                        </h3>
                        <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-sm">
                            Mark status updates from the assignment detail page. Use Maps to navigate and call customers when needed.
                        </p>
                        <div className="grid gap-3">
                            <Link
                                to="/delivery/assignments"
                                className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                                        <Package className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <span className="text-sm font-black uppercase tracking-tight">
                                        View assignments
                                    </span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                            </Link>
                            <Link
                                to="/delivery/earnings"
                                className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/20">
                                        <IndianRupee className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <span className="text-sm font-black uppercase tracking-tight">
                                        Earnings & COD
                                    </span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                            </Link>
                        </div>
                    </div>
                    <div className="absolute -bottom-24 -right-24 h-80 w-80 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute -top-24 -left-24 h-64 w-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
                </motion.div>
            </div>
        </div>
    );
}

function MetricGlassCard({
    label,
    value,
    sub,
    color,
    icon: Icon,
    trend,
}: {
    label: string;
    value: number | string;
    sub: string;
    color: 'emerald' | 'blue' | 'orange' | 'purple';
    icon: React.ComponentType<{ className?: string }>;
    trend?: string;
}) {
    const colorMap: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500/10',
        blue: 'bg-blue-50 text-blue-600 border-blue-100 ring-blue-500/10',
        purple: 'bg-purple-50 text-purple-600 border-purple-100 ring-purple-500/10',
        orange: 'bg-orange-50 text-orange-600 border-orange-100 ring-orange-500/10',
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <div
                        className={cn(
                            'p-4 rounded-[1.5rem] border transition-all duration-500 group-hover:scale-110',
                            colorMap[color]
                        )}
                    >
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend != null && (
                        <div
                            className={cn(
                                'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1',
                                trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                            )}
                        >
                            {trend}
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {label}
                    </p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-none">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                        {sub}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
