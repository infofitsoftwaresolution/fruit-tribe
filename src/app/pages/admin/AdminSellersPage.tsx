import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Store, CheckCircle2, AlertCircle, Clock, Search,
    Filter, MoreHorizontal, ExternalLink, ShieldCheck,
    MapPin, Calendar, FileText, TrendingUp, Users,
    Package, ArrowUpRight, Ban, CheckCircle, XCircle,
    Smartphone, Download, Zap, Briefcase, Binary
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import { getSellers, approveSeller as approveSellerApi, suspendSeller as suspendSellerApi } from '@/lib/api';

interface Seller {
    id: string;
    storeName: string;
    ownerName: string;
    email: string;
    status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED';
    kycStatus: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NOT_SUBMITTED';
    joinedAt: string;
    orders: number;
    revenue: number;
    commissionRate: number;
    location: string;
    rating: number;
}

function mapApiSellerToSeller(api: any): Seller {
    const name = [api.user?.firstName, api.user?.lastName].filter(Boolean).join(' ') || api.user?.email || '—';
    const kyc = (api.kycStatus || 'pending').toUpperCase();
    return {
        id: api.id,
        storeName: api.storeName || '—',
        ownerName: name,
        email: api.user?.email || '—',
        status: api.status === 'APPROVED' ? 'ACTIVE' : api.status === 'PENDING' ? 'PENDING' : 'SUSPENDED',
        kycStatus: kyc === 'VERIFIED' ? 'VERIFIED' : kyc === 'REJECTED' ? 'REJECTED' : kyc === 'NOT_SUBMITTED' ? 'NOT_SUBMITTED' : 'PENDING',
        joinedAt: api.createdAt ? new Date(api.createdAt).toISOString().slice(0, 10) : '—',
        orders: 0,
        revenue: 0,
        commissionRate: Number(api.commissionRate) || 0,
        location: (api.address && typeof api.address === 'object' && (api.address.city || api.address.state)) ? [api.address.city, api.address.state].filter(Boolean).join(', ') : '—',
        rating: Number(api.rating) || 0,
    };
}

export function AdminSellersPage() {
    const { theme } = useStore();
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
    const [activeTab, setActiveTab] = useState('All');

    useEffect(() => {
        let cancelled = false;
        getSellers()
            .then((data) => { if (!cancelled) setSellers((data || []).map(mapApiSellerToSeller)); })
            .catch(() => { if (!cancelled) toast.error('Failed to load sellers'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const handleApprove = async (id: string) => {
        try {
            await approveSellerApi(id);
            setSellers((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'ACTIVE' as const, kycStatus: 'VERIFIED' as const } : s)));
            toast.success('Merchant partnership activated successfully!');
            setSelectedSeller(null);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to approve');
        }
    };

    const handleReject = (id: string) => {
        setSellers(prev => prev.map(s => s.id === id ? { ...s, status: 'REJECTED' as const } : s));
        toast.error('Merchant application has been declined');
        setSelectedSeller(null);
    };

    const filteredSellers = useMemo(() => {
        return sellers.filter(s => {
            const matchesSearch = s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            if (activeTab === 'Pending') return s.status === 'PENDING';
            if (activeTab === 'Verified') return s.kycStatus === 'VERIFIED';
            return true;
        });
    }, [sellers, searchQuery, activeTab]);

    const stats = [
        { label: 'Total Partnerships', value: sellers.length, icon: Users, color: 'emerald' },
        { label: 'Pending Audit', value: sellers.filter(s => s.status === 'PENDING').length, icon: Clock, color: 'orange' },
        { label: 'Merchant Growth', value: '+18%', icon: TrendingUp, color: 'purple' },
        { label: 'Net Transacted', value: '₹' + (sellers.reduce((a, b) => a + b.revenue, 0) / 100000).toFixed(1) + 'L', icon: Zap, color: 'blue' }
    ];

    return (
        <div className="space-y-8 pb-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Global Ecosystem</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Merchant Network</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Overseeing the backbone of our farm-to-table commercial pipeline.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => toast.info('Generating audit report...')}
                        className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Network Audit
                    </button>
                    <button className="h-12 px-8 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95">
                        Onboard Merchant
                    </button>
                </div>
            </div>

            {/* Visual Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
                    >
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className={cn("p-4 rounded-3xl transition-all group-hover:scale-110", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 tracking-tight relative z-10">{stat.value}</p>
                        <div className={cn("absolute -right-8 -bottom-8 w-32 h-32 blur-[40px] opacity-10 group-hover:opacity-20 transition-all duration-700 rounded-full", `bg-${stat.color}-400`)} />
                    </motion.div>
                ))}
            </div>

            {/* Merchant Ledger Area */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/20">
                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
                        {['All', 'Pending', 'Verified', 'Suspended'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    activeTab === tab
                                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative group min-w-[340px]">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Identify merchant by store or owner..."
                            className="w-full h-14 pl-14 pr-4 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Merchant Identity</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance Status</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Yield Stats</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Rating</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Merchant Portal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={5} className="px-10 py-16 text-center text-slate-400 text-sm">Loading sellers...</td></tr>
                            ) : null}
                            <AnimatePresence mode='popLayout'>
                                {filteredSellers.map((seller, idx) => (
                                    <motion.tr
                                        key={seller.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                        onClick={() => setSelectedSeller(seller)}
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-[1.5rem] bg-slate-900 flex items-center justify-center font-black text-lg text-white shadow-xl shadow-slate-900/10 group-hover:scale-110 transition-transform duration-500">
                                                    {seller.storeName.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{seller.storeName}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                        <MapPin className="h-2.5 w-2.5" />
                                                        {seller.location}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col gap-2">
                                                <span className={cn(
                                                    "px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest w-fit shadow-sm",
                                                    seller.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        seller.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                            'bg-red-50 text-red-700 border-red-100'
                                                )}>
                                                    {seller.status}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("h-1.5 w-1.5 rounded-full", seller.kycStatus === 'VERIFIED' ? 'bg-emerald-500' : 'bg-slate-200')} />
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">KYC {seller.kycStatus}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col gap-0.5">
                                                <p className="text-lg font-black text-slate-900 tracking-tighter">₹{(seller.revenue / 1000).toFixed(1)}K</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{seller.orders} Transfers</span>
                                                    <span className="h-1 w-1 rounded-full bg-slate-200" />
                                                    <span className="text-[9px] font-black text-emerald-500">+{seller.rating || 4.2} <StarIcon className="inline h-2 w-2 fill-emerald-500" /></span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex justify-center">
                                                <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-700 group-hover:bg-white group-hover:border-emerald-200 transition-all">
                                                    {seller.commissionRate}%
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 hover:shadow-xl transition-all">
                                                    <Smartphone className="w-5 h-5" />
                                                </button>
                                                <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 hover:shadow-xl transition-all">
                                                    <ExternalLink className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Merchant Intensive View (Detail Overlay) */}
            {selectedSeller && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setSelectedSeller(null)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col"
                        >
                            {/* Profile Header Area */}
                            <div className="p-12 bg-slate-50/50 border-b border-slate-100">
                                <div className="flex items-start justify-between mb-10">
                                    <div className="flex items-center gap-6">
                                        <div className="h-24 w-24 rounded-[2.5rem] bg-slate-900 text-white flex items-center justify-center text-3xl font-black shadow-2xl shadow-slate-900/20 rotate-3 font-serif">
                                            {selectedSeller.storeName.charAt(0)}
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-black text-slate-900 leading-tight uppercase tracking-tighter">{selectedSeller.storeName}</h2>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-black uppercase tracking-widest">{selectedSeller.status}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {selectedSeller.location}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedSeller(null)} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-300 hover:text-red-500 hover:shadow-xl transition-all">
                                        <XCircle className="h-8 w-8" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm group hover:scale-[1.02] transition-transform">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Merchant Principal</p>
                                        <p className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedSeller.ownerName}</p>
                                        <p className="text-xs font-bold text-emerald-600 mt-1">{selectedSeller.email}</p>
                                    </div>
                                    <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm group hover:scale-[1.02] transition-transform">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Partnership Date</p>
                                        <p className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-emerald-500" />
                                            {selectedSeller.joinedAt}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
                                {/* Insights Snapshot */}
                                <div className="grid grid-cols-3 gap-6">
                                    {[
                                        { label: 'Merchant Lifetime Yield', value: '₹' + (selectedSeller.revenue / 1000).toFixed(1) + 'K', icon: TrendingUp },
                                        { label: 'Transfers Executed', value: selectedSeller.orders, icon: Package },
                                        { label: 'Consolidated Rating', value: selectedSeller.rating || '4.8', icon: StarIcon }
                                    ].map((stat, i) => (
                                        <div key={i} className="text-center p-6 bg-slate-50/50 rounded-3xl border border-slate-50">
                                            <stat.icon className="w-5 h-5 text-slate-400 mx-auto mb-3" />
                                            <p className="text-lg font-black text-slate-900 tracking-tighter leading-none mb-1">{stat.value}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Compliance Audit Trail */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4" />
                                            KYC Document Check
                                        </h3>
                                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Digital Vault Secure</span>
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            { label: 'Global Trade Identifier (GST/TIN)', status: 'VERIFIED', date: 'Oct 12, 2023' },
                                            { label: 'Food Safety License (FSSAI)', status: 'VERIFIED', date: 'Oct 14, 2023' },
                                            { label: 'Merchant Identification (KYC)', status: selectedSeller.kycStatus === 'REJECTED' ? 'REJECTED' : 'PENDING', date: 'Processing...' }
                                        ].map((doc, i) => (
                                            <div key={i} className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/20 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 text-slate-400 group-hover:text-emerald-500 transition-colors">
                                                        <FileText className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900 tracking-tight uppercase">{doc.label}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Audited: {doc.date}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                                        doc.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' :
                                                            doc.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                                    )}>
                                                        {doc.status}
                                                    </span>
                                                    <p className="mt-2 text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline cursor-pointer">View Vault Item</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Seller details */}
                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Binary className="w-4 h-4" />
                                        Seller Overview
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Global Trade Identifier</p>
                                            <p className="text-sm font-black text-slate-900">{selectedSeller.gstNumber || '27AAAAA0000A1Z5'}</p>
                                        </div>
                                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">PAN Registry</p>
                                            <p className="text-sm font-black text-slate-900">{selectedSeller.panNumber || 'ABCDE1234F'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment summary */}
                                <div className="p-8 bg-slate-900 rounded-[3rem] text-white relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-emerald-600 opacity-0 group-hover:opacity-10 transition-opacity duration-700" />
                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-8">
                                            <div>
                                                <h3 className="text-xl font-black uppercase tracking-tighter leading-none mb-1">Payment Summary</h3>
                                                <p className="text-emerald-400/60 text-[10px] font-black uppercase tracking-widest">Platform Commission Scale</p>
                                            </div>
                                            <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                                                <Zap className="h-6 w-6 text-emerald-400" />
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-3">
                                            <span className="text-6xl font-black tracking-tighter leading-none">{selectedSeller.commissionRate}%</span>
                                            <div className="mb-2">
                                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Gross Settlement Fee</p>
                                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest italic">Locked for current quarter</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute -right-12 -bottom-12 h-44 w-44 bg-emerald-500/20 rounded-full blur-[60px]" />
                                </div>
                            </div>

                            {/* Final Decision Hub */}
                            <div className="p-10 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 flex gap-4 mt-auto">
                                {selectedSeller.status === 'PENDING' ? (
                                    <>
                                        <button
                                            onClick={() => handleApprove(selectedSeller.id)}
                                            className="flex-1 h-16 bg-emerald-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95"
                                        >
                                            Activate Merchant
                                        </button>
                                        <button
                                            onClick={() => handleReject(selectedSeller.id)}
                                            className="flex-1 h-16 bg-white border border-red-200 text-red-600 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
                                        >
                                            Decline Partnership
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            try {
                                                await suspendSellerApi(selectedSeller.id);
                                                setSellers(prev =>
                                                    prev.map(s =>
                                                        s.id === selectedSeller.id
                                                            ? { ...s, status: 'SUSPENDED' as const }
                                                            : s
                                                    )
                                                );
                                                toast.success('Vendor suspended successfully.');
                                                setSelectedSeller(null);
                                            } catch (e: any) {
                                                toast.error(e?.message || 'Failed to suspend vendor');
                                            }
                                        }}
                                        className="w-full h-16 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95"
                                    >
                                        <Ban className="h-5 w-5 text-red-400" />
                                        Suspend Seller
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

function StarIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
}
