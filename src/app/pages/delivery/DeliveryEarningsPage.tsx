import { useEffect, useState } from 'react';
import {
    IndianRupee,
    Wallet,
    TrendingUp,
    CreditCard,
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { getEffectiveApiBase } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getUserErrorMessage } from '@/lib/userError';

interface EarningsSummary {
    today: { earnings: number; deliveries: number };
    week: { earnings: number };
    month: { earnings: number };
}

interface CodSummary {
    collectedToday: number;
    submittedToday: number;
    pendingToday: number;
}

export function DeliveryEarningsPage() {
    const { user } = useAuth();
    const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
    const [cod, setCod] = useState<CodSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: token ? `Bearer ${token}` : '' };
                const [earningsRes, codRes] = await Promise.all([
                    fetch(`${getEffectiveApiBase()}/delivery/earnings/summary`, { headers }),
                    fetch(`${getEffectiveApiBase()}/delivery/cod/summary`, { headers }),
                ]);
                if (!earningsRes.ok) throw new Error('Failed to load earnings');
                if (!codRes.ok) throw new Error('Failed to load COD summary');
                setEarnings(await earningsRes.json());
                setCod(await codRes.json());
            } catch (e: any) {
                toast.error(getUserErrorMessage(e, 'Unable to load earnings data'));
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

    if (loading && !earnings) {
        return (
            <div className="flex items-center justify-center min-h-[320px]">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!earnings || !cod) {
        return (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-10 text-center">
                <p className="text-sm text-slate-500">No earnings data available yet.</p>
            </div>
        );
    }

    const colorMap: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Page header - match Admin */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        Payouts
                    </span>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
                    Earnings overview
                </h1>
                <p className="text-slate-500 text-sm mt-1 max-w-lg italic">
                    Your delivery pay and COD summary.
                </p>
            </div>

            {/* Top metrics - same card style as Admin */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                    whileHover={{ y: -5 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div
                                className={cn(
                                    'p-4 rounded-[1.5rem] border transition-all duration-500 group-hover:scale-110',
                                    colorMap.emerald
                                )}
                            >
                                <IndianRupee className="w-6 h-6" />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Today
                        </p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-none text-emerald-600">
                            ₹{earnings.today.earnings.toFixed(2)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                            {earnings.today.deliveries} deliveries
                        </p>
                    </div>
                </motion.div>
                <motion.div
                    whileHover={{ y: -5 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div
                                className={cn(
                                    'p-4 rounded-[1.5rem] border transition-all duration-500 group-hover:scale-110',
                                    colorMap.blue
                                )}
                            >
                                <TrendingUp className="w-6 h-6" />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            This week
                        </p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-none">
                            ₹{earnings.week.earnings.toFixed(2)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                            Weekly total
                        </p>
                    </div>
                </motion.div>
                <motion.div
                    whileHover={{ y: -5 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div
                                className={cn(
                                    'p-4 rounded-[1.5rem] border transition-all duration-500 group-hover:scale-110',
                                    colorMap.purple
                                )}
                            >
                                <Wallet className="w-6 h-6" />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            This month
                        </p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-none">
                            ₹{earnings.month.earnings.toFixed(2)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                            Monthly total
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* COD summary - same section card as Admin */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex items-center gap-4">
                    <div
                        className={cn(
                            'p-4 rounded-2xl border',
                            colorMap.orange
                        )}
                    >
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                            COD summary (today)
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Cash on delivery collected and submitted
                        </p>
                    </div>
                </div>
                <div className="p-8 divide-y divide-slate-50">
                    <div className="flex justify-between items-center py-4">
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-tight">Collected</span>
                        <span className="text-lg font-black text-slate-900">₹{cod.collectedToday.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-tight">Submitted</span>
                        <span className="text-lg font-black text-emerald-600">₹{cod.submittedToday.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-tight">Pending</span>
                        <span className="text-lg font-black text-amber-600">₹{cod.pendingToday.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
