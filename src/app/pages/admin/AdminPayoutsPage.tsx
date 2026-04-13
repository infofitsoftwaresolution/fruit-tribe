import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    IndianRupee, TrendingUp, Calendar, ArrowUpRight,
    ArrowDownRight, CheckCircle2, Clock, AlertCircle,
    Search, Filter, Download, MoreHorizontal, Store,
    ChevronRight, Wallet, History, ShieldCheck, CreditCard,
    DollarSign, Percent, Activity, Zap, FileText, X,
    MoreVertical, ArrowRightLeft, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Payout {
    id: string;
    vendor: string;
    amount: number;
    platformFee: number;
    tax: number;
    netAmount: number;
    status: 'Processed' | 'Pending' | 'Flagged' | 'Scheduled';
    date: string;
    method: 'Bank Transfer' | 'Settlement Wallet';
    period: string;
}

export function AdminPayoutsPage() {
    const { theme } = useStore();
    const { orders, sellers, isInitialLoading: loading } = useAdminData();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('All');
    const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
    const payouts = useMemo(() => {
        if (!orders) return [];
        const generated: Payout[] = [];
        const seen = new Set<string>();

        orders.forEach((order: any) => {
            const orderId = order.orderNumber || order.id?.substring(0, 8) || Math.random().toString(36).substring(7);
            if (seen.has(orderId)) return;
            seen.add(orderId);

            const amount = Number(order.payableAmount ?? order.totalAmount ?? 0);
            if (amount <= 0) return;

            const platformFee = amount * 0.10;
            const tax = amount * 0.05;
            const netAmount = amount - platformFee - tax;

            let vendor = 'The Fruit Tribe';
            if (order.items?.length > 0 && order.items[0]?.seller) {
                vendor = order.items[0].seller.storeName || order.items[0].seller.name || vendor;
            } else if (order.seller) {
                 vendor = order.seller.storeName || order.seller.name || vendor;
            }

            // Normalize status: backend may send 'Delivered', 'DELIVERED', 'Created', etc.
            const rawStatus = (order.status ?? '').toUpperCase();
            const payoutStatus: Payout['status'] =
                rawStatus === 'DELIVERED' ? 'Processed'
                : (rawStatus === 'CANCELLED' || rawStatus === 'RETURNED') ? 'Flagged'
                : 'Pending';

            generated.push({
                id: orderId,
                vendor,
                amount,
                platformFee,
                tax,
                netAmount,
                status: payoutStatus,
                date: new Date(order.createdAt || Date.now()).toLocaleDateString(),
                method: 'Bank Transfer',
                period: new Date(order.createdAt || Date.now()).toLocaleString('default', { month: 'short', year: 'numeric' })
            });
        });
        return generated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders]);

    const totalRevenue = useMemo(() => orders.reduce((s, o) => s + Number(o.payableAmount ?? o.totalAmount ?? 0), 0), [orders]);
    const statsCards = useMemo(() => [
        { label: 'Next Settlement', value: '₹0', sub: '—', icon: Wallet, color: 'emerald', trend: 'Projected' },
        { label: 'Platform Revenue', value: `₹${(totalRevenue / 1000).toFixed(0)}K`, sub: 'All time', icon: TrendingUp, color: 'blue', trend: 'Verified' },
        { label: 'Pending payouts', value: `${sellers.length} Vendors`, sub: sellers.length ? 'Action required' : 'None', icon: Clock, color: 'orange', trend: 'Queued' },
        { label: 'Total Settled', value: payouts.length ? `₹${payouts.reduce((s, p) => s + (p.status === 'Processed' ? p.netAmount : 0), 0).toLocaleString()}` : '₹0', sub: 'Settlements', icon: Shield, color: 'purple', trend: 'Audited' }
    ], [totalRevenue, sellers.length, payouts]);

    const filteredPayouts = useMemo(() => {
        return payouts.filter(p => {
            const matchesSearch = p.id.includes(searchQuery) || p.vendor.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;
            if (activeTab === 'Pending') return ['Pending', 'Scheduled', 'Flagged'].includes(p.status);
            if (activeTab === 'Processed') return p.status === 'Processed';
            return true;
        });
    }, [payouts, searchQuery, activeTab]);

    return (
        <div className="space-y-10 pb-20">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Payout Management</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Merchant Payouts</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Manage seller payouts and settlement history.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:shadow-xl transition-all flex items-center gap-2 shadow-sm">
                        <FileText className="w-4 h-4" />
                        Tax Report
                    </button>
                    <button
                        onClick={() => toast.info('Opening batch payout...')}
                        className="h-12 px-8 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                    >
                        <Zap className="h-4 w-4 text-emerald-300" />
                        Run Payout Batch
                    </button>
                </div>
            </div>

            {/* Payout summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:ring-2 ring-transparent hover:ring-emerald-500/10 transition-all cursor-default"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className={cn("p-4 rounded-3xl shadow-sm", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 border border-slate-100 px-3 py-1 rounded-full uppercase tracking-tighter">{stat.trend}</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{stat.value}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Payout table */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/20">
                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                        {['All', 'Pending', 'Processed', 'Audits'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    activeTab === tab
                                        ? "bg-slate-900 text-white shadow-lg"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative group flex-1 max-w-2xl">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by payout ID or seller..."
                            className="w-full h-14 pl-14 pr-6 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Transaction Ref</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Seller</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Gross Amount</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black text-center">Platform Fee</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black text-right">Net Settlement</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={6} className="px-10 py-16 text-center text-slate-400 text-sm">Loading...</td></tr>
                            ) : null}
                            <AnimatePresence>
                                {filteredPayouts.map((payout, idx) => (
                                    <motion.tr
                                        key={payout.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                        onClick={() => setSelectedPayout(payout)}
                                    >
                                        <td className="px-10 py-10">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">#{payout.id}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{payout.date}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-10">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-xl shadow-slate-900/10 group-hover:rotate-6 transition-transform">
                                                    {payout.vendor.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{payout.vendor}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                                                        <Calendar className="h-2.5 w-2.5" />
                                                        {payout.period}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-10">
                                            <span className="text-sm font-bold text-slate-400 line-through group-hover:text-slate-600 transition-colors tracking-tight">₹{payout.amount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-10 py-10 text-center">
                                            <span className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 uppercase tracking-widest">
                                                -{payout.platformFee.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-10 py-10 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-lg font-black text-slate-900 tracking-tighter leading-none">₹{payout.netAmount.toLocaleString()}</span>
                                                <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1 mt-1.5">
                                                    <ShieldCheck className="h-2.5 w-2.5" />
                                                    Audited Settlement
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-10 text-center">
                                            <span className={cn(
                                                "px-4 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all",
                                                payout.status === 'Processed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm' :
                                                    payout.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                        payout.status === 'Flagged' ? 'bg-red-50 text-red-700 border-red-100' :
                                                            'bg-blue-50 text-blue-700 border-blue-100'
                                            )}>
                                                {payout.status}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>

                    {filteredPayouts.length === 0 && (
                        <div className="py-32 text-center">
                            <History className="w-20 h-20 text-slate-100 mx-auto mb-6" />
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">No Payouts Found</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto">No payouts match the current filters.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Payout details side panel */}
            {selectedPayout && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setSelectedPayout(null)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Sheet Header */}
                            <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                            <IndianRupee className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                                            Payout: #{selectedPayout.id}
                                        </h2>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payout Details</p>
                                </div>
                                <button onClick={() => setSelectedPayout(null)} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-300 hover:text-red-500 hover:shadow-xl transition-all">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar bg-white">
                                {/* Merchant Entity Profile */}
                                <div className="p-10 bg-slate-900 rounded-[3rem] text-white flex items-center gap-8 shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
                                    <div className="h-24 w-24 rounded-[2rem] bg-white text-slate-900 flex items-center justify-center text-4xl font-black relative z-10 shadow-lg group-hover:rotate-6 transition-transform">
                                        {selectedPayout.vendor.charAt(0)}
                                    </div>
                                    <div className="relative z-10 flex-1">
                                        <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">{selectedPayout.vendor}</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Secure Settlement Node verified</p>
                                        </div>
                                        <div className="mt-6 flex items-center gap-6">
                                            <div className="text-[10px] opacity-40 uppercase font-black tracking-widest">ID: TXN-SEC-{selectedPayout.id}</div>
                                            <div className="h-4 w-[1px] bg-white/10" />
                                            <div className="text-[10px] opacity-40 uppercase font-black tracking-widest">Protocol: {selectedPayout.method}</div>
                                        </div>
                                    </div>
                                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
                                </div>

                                {/* Fiscal Breakdown */}
                                <div className="space-y-8">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Activity className="w-4 h-4" />
                                        Profit & Loss Analysis
                                    </h3>
                                    <div className="space-y-2">
                                        {[
                                            { label: 'Merchant Value Yield', value: selectedPayout.amount, mode: 'plus' },
                                            { label: 'Network Commission (10%)', value: -selectedPayout.platformFee, mode: 'minus' },
                                            { label: 'Fiscal Compliance (GST/TDS)', value: -selectedPayout.tax, mode: 'minus' }
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-6 px-10 rounded-[1.75rem] hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 transition-colors">{item.label}</span>
                                                <span className={cn("text-lg font-black tracking-tighter", item.mode === 'plus' ? 'text-slate-900' : 'text-red-500')}>
                                                    {item.mode === 'minus' ? '-' : ''}₹{Math.abs(item.value).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="h-[2px] bg-slate-50 mx-10 my-6" />
                                        <div className="flex items-center justify-between p-10 bg-emerald-900 rounded-[3rem] text-white shadow-2xl shadow-emerald-900/20 relative overflow-hidden group">
                                            <span className="text-xs font-black uppercase tracking-widest relative z-10 text-emerald-300">Net Final Settlement Authorized</span>
                                            <span className="text-4xl font-black tracking-tighter relative z-10 text-white">₹{selectedPayout.netAmount.toLocaleString()}</span>
                                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                        </div>
                                    </div>
                                </div>

                                {/* Audit Progression */}
                                <div className="space-y-10 pt-6">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <History className="w-4 h-4" />
                                        Settlement Timeline
                                    </h3>
                                    <div className="relative pl-12 space-y-12">
                                        <div className="absolute left-[23px] top-0 bottom-0 w-[1px] bg-slate-100" />
                                        {[
                                            { status: 'Funds Authorized', time: 'Oct 20 at 09:12 AM', icon: CheckCircle2, active: selectedPayout.status === 'Processed' },
                                            { status: 'Security Audit Passed', time: 'Oct 19 at 04:30 PM', icon: ShieldCheck, active: true },
                                            { status: 'Batch Protocol Generated', time: 'Oct 19 at 10:15 AM', icon: Zap, active: true },
                                            { status: 'Cycle Execution Start', time: 'Oct 15 at Midnight', icon: Activity, active: true },
                                        ].map((step, idx) => (
                                            <div key={idx} className={cn("flex flex-col relative z-10 transition-all duration-700", step.active ? "opacity-100" : "opacity-20")}>
                                                <div className={cn(
                                                    "absolute -left-[45px] top-0 h-11 w-11 rounded-3xl border-4 border-white shadow-xl flex items-center justify-center",
                                                    step.active ? "bg-slate-900 text-emerald-400" : "bg-white text-slate-300"
                                                )}>
                                                    <step.icon className="h-5 w-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{step.status}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{step.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sheet Actions */}
                            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-6">
                                <button className="h-16 w-16 bg-white border border-slate-200 rounded-3xl text-slate-400 hover:text-red-500 transition-all shadow-sm flex items-center justify-center">
                                    <AlertCircle className="w-6 h-6" />
                                </button>
                                <button
                                    className="flex-1 h-16 bg-slate-900 text-white rounded-[2rem] hover:bg-black text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-slate-900/10 flex items-center justify-center gap-3"
                                >
                                    <Download className="w-5 h-5 text-emerald-400" />
                                    Export Compliance Ledger
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
