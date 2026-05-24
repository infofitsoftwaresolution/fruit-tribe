import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    IndianRupee, TrendingUp, Calendar, ArrowUpRight,
    ArrowDownRight, CheckCircle2, Clock, AlertCircle,
    Search, Filter, Download, MoreHorizontal, Store,
    ChevronRight, Wallet, History, ShieldCheck, CreditCard,
    FileText, X, MoreVertical, ArrowRightLeft, Shield, Zap
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

            const rawStatus = (order.status ?? '').toUpperCase();
            const isPaid = (order.paymentStatus ?? '').toUpperCase() === 'PAID';
            
            const payoutStatus: Payout['status'] =
                rawStatus === 'DELIVERED' ? 'Processed'
                : (rawStatus === 'CANCELLED' || rawStatus === 'RETURNED') ? 'Flagged'
                : isPaid ? 'Scheduled'
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
        { label: 'Platform Revenue', value: `₹${(totalRevenue / 1000).toFixed(1)}K`, sub: 'All time', icon: TrendingUp, color: 'blue', trend: 'Verified' },
        { label: 'Pending Payouts', value: `${sellers.length} Vendors`, sub: sellers.length ? 'Action required' : 'None', icon: Clock, color: 'amber', trend: 'Queued' },
        { label: 'Total Settled', value: payouts.length ? `₹${payouts.reduce((s, p) => s + (p.status === 'Processed' ? p.netAmount : 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '₹0', sub: 'Settlements', icon: Shield, color: 'purple', trend: 'Audited' }
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
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="admin-page-title">Payouts</h1>
                    <p className="admin-page-subtitle">Manage seller payouts and settlement history.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => toast.info('Generating tax report...')}
                        className="admin-btn-secondary"
                    >
                        <FileText className="w-4 h-4" />
                        Tax Report
                    </button>
                    <button
                        onClick={() => toast.info('Opening batch payout...')}
                        className="admin-btn-primary bg-emerald-600 hover:bg-emerald-700 border-none"
                    >
                        <Zap className="h-4 w-4" />
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
                        transition={{ delay: i * 0.05 }}
                        key={stat.label}
                        className="admin-stat-card flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                                    stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                                    stat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                                    'bg-purple-50 text-purple-600'
                                )}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                                    {stat.trend}
                                </span>
                            </div>
                            <p className="admin-stat-value">{stat.value}</p>
                            <p className="admin-stat-label">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Payout table */}
            <div className="admin-card">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/20">
                    <div className="flex items-center gap-1.5 p-1 bg-white rounded-lg border border-slate-200 overflow-x-auto">
                        {['All', 'Pending', 'Processed'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                                    activeTab === tab
                                        ? "bg-slate-900 text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-950 hover:bg-slate-50"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by payout ID or seller..."
                            className="admin-input pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="admin-th">Payout Ref</th>
                                <th className="admin-th">Seller</th>
                                <th className="admin-th">Gross Amount</th>
                                <th className="admin-th">Platform Fee</th>
                                <th className="admin-th text-right">Net Settlement</th>
                                <th className="admin-th text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                                        Loading payouts...
                                    </td>
                                </tr>
                            ) : null}
                            
                            {!loading && filteredPayouts.map((payout, idx) => (
                                <tr
                                    key={payout.id}
                                    className="admin-tr cursor-pointer"
                                    onClick={() => setSelectedPayout(payout)}
                                >
                                    <td className="admin-td">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900 hover:text-emerald-600 transition-colors">
                                                #{payout.id}
                                            </span>
                                            <span className="text-xs text-slate-400 mt-0.5">{payout.date}</span>
                                        </div>
                                    </td>
                                    <td className="admin-td">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-sm">
                                                {payout.vendor.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{payout.vendor}</span>
                                                <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Calendar className="h-3 w-3" />
                                                    {payout.period}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="admin-td">
                                        <span className="text-slate-400 line-through">
                                            ₹{payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="admin-td">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                            -₹{payout.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="admin-td text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-semibold text-slate-900 text-base">
                                                ₹{payout.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                                <ShieldCheck className="h-3 w-3" />
                                                Verified
                                            </span>
                                        </div>
                                    </td>
                                    <td className="admin-td text-center">
                                        <span className={cn(
                                            payout.status === 'Processed' ? 'admin-badge-emerald' :
                                            payout.status === 'Pending' ? 'admin-badge-amber' :
                                            payout.status === 'Flagged' ? 'admin-badge-red' :
                                            'admin-badge-blue'
                                        )}>
                                            {payout.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {!loading && filteredPayouts.length === 0 && (
                        <div className="py-16 text-center">
                            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-sm font-semibold text-slate-900">No Payouts Found</h3>
                            <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">No payouts match the current filter criteria.</p>
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
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setSelectedPayout(null)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Sheet Header */}
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700">
                                        <IndianRupee className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">
                                            Payout Details
                                        </h2>
                                        <p className="text-xs text-slate-500">Ref: #{selectedPayout.id}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedPayout(null)} 
                                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {/* Merchant Entity Profile */}
                                <div className="p-5 bg-slate-900 rounded-xl text-white relative overflow-hidden group">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="h-14 w-14 rounded-lg bg-white text-slate-900 flex items-center justify-center text-2xl font-semibold shadow-sm">
                                            {selectedPayout.vendor.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold leading-tight">{selectedPayout.vendor}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                <p className="text-emerald-400 text-xs">Verified Partner Farm</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60 relative z-10">
                                        <span>TXN: SEC-{selectedPayout.id}</span>
                                        <span>Method: {selectedPayout.method}</span>
                                    </div>
                                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-[40px]" />
                                </div>

                                {/* Fiscal Breakdown */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Payment Breakdown
                                    </h3>
                                    <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
                                        {[
                                            { label: 'Gross Revenue', value: selectedPayout.amount, mode: 'plus' },
                                            { label: 'Platform Commission (10%)', value: -selectedPayout.platformFee, mode: 'minus' },
                                            { label: 'Tax Compliance (GST/TDS)', value: -selectedPayout.tax, mode: 'minus' }
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3.5 px-4 bg-white hover:bg-slate-50/50 transition-colors">
                                                <span className="text-sm text-slate-500">{item.label}</span>
                                                <span className={cn("text-sm font-medium", item.mode === 'plus' ? 'text-slate-900' : 'text-red-600')}>
                                                    {item.mode === 'minus' ? '-' : ''}₹{Math.abs(item.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                        
                                        <div className="flex items-center justify-between p-4 bg-emerald-50/50 text-emerald-950">
                                            <span className="text-sm font-semibold text-emerald-900">Net Settlement Amount</span>
                                            <span className="text-xl font-bold text-emerald-900">
                                                ₹{selectedPayout.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Settlement Timeline */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Settlement Timeline
                                    </h3>
                                    <div className="relative pl-6 space-y-6">
                                        <div className="absolute left-[11px] top-2 bottom-2 w-[1.5px] bg-slate-100" />
                                        {[
                                            { status: 'Payout Processed', time: 'Oct 20 at 09:12 AM', icon: CheckCircle2, active: selectedPayout.status === 'Processed' },
                                            { status: 'Quality & Audit Passed', time: 'Oct 19 at 04:30 PM', icon: ShieldCheck, active: true },
                                            { status: 'Settlement Batch Generated', time: 'Oct 19 at 10:15 AM', icon: Zap, active: true },
                                            { status: 'Order Delivered / Initiated', time: 'Oct 15 at Midnight', icon: Clock, active: true },
                                        ].map((step, idx) => (
                                            <div key={idx} className={cn("flex flex-col relative z-10 transition-opacity duration-350", step.active ? "opacity-100" : "opacity-30")}>
                                                <div className={cn(
                                                    "absolute -left-[21px] top-0 h-[22px] w-[22px] rounded-full border-2 border-white shadow-sm flex items-center justify-center",
                                                    step.active ? "bg-slate-900 text-emerald-400" : "bg-white text-slate-300"
                                                )}>
                                                    <step.icon className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="pl-4">
                                                    <p className="text-sm font-semibold text-slate-900">{step.status}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{step.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sheet Actions */}
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                                <button 
                                    onClick={() => toast.info('Opening query details...')}
                                    className="admin-btn-icon"
                                    title="Report Issue"
                                >
                                    <AlertCircle className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                </button>
                                <button
                                    onClick={() => toast.success('Exported compliance ledger.')}
                                    className="flex-1 admin-btn-primary justify-center bg-slate-900 hover:bg-slate-850"
                                >
                                    <Download className="w-4 h-4 text-emerald-400" />
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

