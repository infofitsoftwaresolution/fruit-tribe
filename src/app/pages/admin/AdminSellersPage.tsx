import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Store, CheckCircle2, AlertCircle, Clock, Search,
    Filter, MoreHorizontal, ExternalLink, ShieldCheck,
    MapPin, Calendar, FileText, TrendingUp, Users,
    Package, ArrowUpRight, Ban, CheckCircle, XCircle,
    Smartphone, Zap, Briefcase, Binary,
    Activity, X, Mail, Star, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import {
    approveSeller as approveSellerApi,
    suspendSeller as suspendSellerApi,
    reactivateSeller as reactivateSellerApi,
} from '@/lib/api';
import { useAdminData } from '@/app/context/AdminDataContext';
import { getUserErrorMessage } from '@/lib/userError';

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
    gstNumber?: string;
    panNumber?: string;
}

function mapApiSellerToSeller(api: any): Seller {
    const name = [api.user?.firstName, api.user?.lastName].filter(Boolean).join(' ') || api.user?.email || '—';
    const kyc = (api.kycStatus || 'pending').toUpperCase();
    const st = (api.status || '').toUpperCase();
    const mappedStatus =
        st === 'APPROVED' ? 'ACTIVE' :
            st === 'PENDING' ? 'PENDING' :
                st === 'SUSPENDED' ? 'SUSPENDED' :
                    st === 'REJECTED' ? 'REJECTED' : 'SUSPENDED';
    return {
        id: api.id,
        storeName: api.storeName || '—',
        ownerName: name,
        email: api.user?.email || '—',
        status: mappedStatus as Seller['status'],
        kycStatus: kyc === 'VERIFIED' ? 'VERIFIED' : kyc === 'REJECTED' ? 'REJECTED' : kyc === 'NOT_SUBMITTED' ? 'NOT_SUBMITTED' : 'PENDING',
        joinedAt: api.createdAt ? new Date(api.createdAt).toISOString().slice(0, 10) : '—',
        orders: 0,
        revenue: 0,
        commissionRate: Number(api.commissionRate) || 0,
        location: (api.address && typeof api.address === 'object' && (api.address.city || api.address.state)) ? [api.address.city, api.address.state].filter(Boolean).join(', ') : '—',
        rating: Number(api.rating) || 0,
        gstNumber: api.gstNumber ?? undefined,
    };
}

export function AdminSellersPage() {
    const { theme } = useStore();
    const { sellers: rawSellers, isInitialLoading: loading, refreshSellers } = useAdminData();
    /** Local-only decline (no reject API yet) — same behaviour as before shared admin data. */
    const [rejectedIds, setRejectedIds] = useState<Set<string>>(() => new Set());
    const sellers = useMemo(() => {
        return (rawSellers || []).map(mapApiSellerToSeller).map((s) =>
            rejectedIds.has(s.id) ? { ...s, status: 'REJECTED' as const } : s,
        );
    }, [rawSellers, rejectedIds]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
    const [activeTab, setActiveTab] = useState('All');
    const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED'>('all');
    const [kycFilter, setKycFilter] = useState<'all' | 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NOT_SUBMITTED'>('all');

    const handleApprove = async (id: string) => {
        try {
            await approveSellerApi(id);
            await refreshSellers();
            toast.success('Merchant partnership activated successfully!');
            setSelectedSeller(null);
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to approve'));
        }
    };

    const handleReject = (id: string) => {
        setRejectedIds((prev) => new Set(prev).add(id));
        toast.success('Merchant application has been declined');
        setSelectedSeller(null);
    };

    const filteredSellers = useMemo(() => {
        return sellers.filter(s => {
            const matchesSearch = s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            const tabOk =
                activeTab === 'Pending'
                    ? s.status === 'PENDING'
                    : activeTab === 'Verified'
                        ? s.kycStatus === 'VERIFIED'
                        : activeTab === 'Suspended'
                            ? s.status === 'SUSPENDED'
                            : true;
            const statusOk = statusFilter === 'all' || s.status === statusFilter;
            const kycOk = kycFilter === 'all' || s.kycStatus === kycFilter;
            return tabOk && statusOk && kycOk;
        });
    }, [sellers, searchQuery, activeTab, statusFilter, kycFilter]);


    const stats = [
        { label: 'Total Partnerships', value: sellers.length, icon: Users, color: 'emerald' },
        { label: 'Pending Audit', value: sellers.filter(s => s.status === 'PENDING').length, icon: Clock, color: 'orange' },
        { label: 'Merchant Growth', value: '+18%', icon: TrendingUp, color: 'purple' },
        { label: 'Net Transacted', value: '₹' + (sellers.reduce((a, b) => a + b.revenue, 0) / 100000).toFixed(1) + 'L', icon: Zap, color: 'blue' }
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="admin-page-title">Sellers</h1>
                    <p className="admin-page-subtitle">Manage vendor partnerships and approvals</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        className="admin-stat-card"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={cn(
                                "h-9 w-9 rounded-lg flex items-center justify-center",
                                stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                                stat.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                                stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                                'bg-purple-50 text-purple-600'
                            )}>
                                <stat.icon className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="admin-stat-value">{stat.value}</p>
                        <p className="admin-stat-label">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Sellers table */}
            <div className="admin-card">
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-lg border border-slate-100">
                        {['All', 'Pending', 'Verified', 'Suspended'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150",
                                    activeTab === tab
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by store name or owner…"
                                className="admin-input pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED')}
                            className="admin-select"
                        >
                            <option value="all">All Status</option>
                            <option value="ACTIVE">Active</option>
                            <option value="PENDING">Pending</option>
                            <option value="SUSPENDED">Suspended</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                        <select
                            value={kycFilter}
                            onChange={(e) => setKycFilter(e.target.value as 'all' | 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NOT_SUBMITTED')}
                            className="admin-select"
                        >
                            <option value="all">All KYC</option>
                            <option value="VERIFIED">Verified</option>
                            <option value="PENDING">Pending</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="NOT_SUBMITTED">Not Submitted</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="admin-th">Seller / Store</th>
                                <th className="admin-th">Status / KYC</th>
                                <th className="admin-th">Revenue</th>
                                <th className="admin-th text-center">Commission</th>
                                <th className="admin-th text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <AdminTableSkeletonRows rows={10} cols={5} />
                            ) : (
                                <AnimatePresence mode='popLayout'>
                                    {filteredSellers.map((seller, idx) => (
                                        <motion.tr
                                            key={seller.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            transition={{ duration: 0.5, delay: idx * 0.03 }}
                                            className="group hover:bg-slate-50/80 transition-all cursor-pointer"
                                            onClick={() => setSelectedSeller(seller)}
                                        >
                                            <td className="admin-td">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                                                        {seller.storeName.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">{seller.storeName}</span>
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <MapPin className="h-3 w-3 text-slate-400" />
                                                            {seller.location}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="admin-td">
                                                <div className="flex flex-col gap-1">
                                                    <span className={cn(
                                                        seller.status === 'ACTIVE' ? 'admin-badge-emerald' :
                                                        seller.status === 'PENDING' ? 'admin-badge-amber' :
                                                        'admin-badge-red'
                                                    )}>
                                                        {seller.status}
                                                    </span>
                                                    <span className="text-xs text-slate-400">KYC: {seller.kycStatus}</span>
                                                </div>
                                            </td>
                                            <td className="admin-td">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-slate-900">₹{(seller.revenue / 1000).toFixed(1)}K</span>
                                                    <span className="text-xs text-slate-400">{seller.orders} orders</span>
                                                </div>
                                            </td>
                                            <td className="admin-td text-center">
                                                <span className="text-xs font-semibold text-slate-700">{seller.commissionRate}%</span>
                                            </td>
                                            <td className="admin-td text-right">
                                                <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                    <button 
                                                        title="Contact Info"
                                                        className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
                                                    >
                                                        <Smartphone className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        title="Open Store"
                                                        className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-all"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Merchant Intensive View: Detail Overlay */}
            {selectedSeller && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[150] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
                            onClick={() => setSelectedSeller(null)}
                        />
                        <motion.div
                            initial={{ x: '100%', skewX: 2 }}
                            animate={{ x: 0, skewX: 0 }}
                            exit={{ x: '100%', skewX: 2 }}
                            transition={{ type: 'spring', damping: 35, stiffness: 250 }}
                            className="relative h-full w-full max-w-2xl bg-white shadow-[-40px_0_100px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden"
                        >
                            {/* Sheet Header */}
                            <div className="p-12 border-b border-slate-100 bg-white relative overflow-hidden flex-shrink-0">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-bl-[10rem] -mr-32 -mt-32 pointer-events-none" />
                                <div className="relative z-10 flex items-center justify-between mb-12">
                                    <div className="flex items-center gap-4">
                                        <div className="h-2 w-12 bg-emerald-500 rounded-full" />
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Merchant Analysis</span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedSeller(null)}
                                        className="h-14 w-14 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-2xl transition-all duration-500 flex items-center justify-center group"
                                    >
                                        <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
                                    </button>
                                </div>
                                
                                <div className="relative z-10 flex items-end justify-between">
                                    <div className="flex items-center gap-8">
                                        <div className="h-28 w-28 rounded-[3rem] bg-slate-900 text-white flex items-center justify-center text-4xl font-black shadow-[0_30px_60px_rgba(0,0,0,0.2)] border-4 border-white font-heading">
                                            {selectedSeller.storeName.charAt(0)}
                                        </div>
                                        <div>
                                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-heading leading-tight">{selectedSeller.storeName}</h2>
                                            <div className="flex items-center gap-4 mt-3">
                                                <span className={cn(
                                                    "px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border transition-all duration-700",
                                                    selectedSeller.status === 'ACTIVE' 
                                                        ? 'bg-emerald-500 text-white border-emerald-400' 
                                                        : selectedSeller.status === 'PENDING'
                                                            ? 'bg-orange-500 text-white border-orange-400'
                                                            : 'bg-red-500 text-white border-red-400'
                                                )}>
                                                    {selectedSeller.status} NODE
                                                </span>
                                                <span className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                                                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                                    {selectedSeller.location}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 space-y-16 custom-scrollbar">
                                {/* Insights Snapshot: Telemetry Matrix */}
                                <div className="grid grid-cols-3 gap-6">
                                    {[
                                        { label: 'Merchant Yield', value: '₹' + (selectedSeller.revenue / 1000).toFixed(1) + 'K', icon: TrendingUp, color: 'emerald' },
                                        { label: 'Network Load', value: selectedSeller.orders, icon: Package, color: 'blue' },
                                        { label: 'Node Quality', value: selectedSeller.rating || '4.8', icon: Star, color: 'orange' }
                                    ].map((stat, i) => (
                                        <div key={i} className="text-center p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-50 group hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500">
                                            <stat.icon className={cn("w-6 h-6 mx-auto mb-4 transition-transform group-hover:scale-110", `text-${stat.color}-500`)} />
                                            <p className="text-2xl font-black text-slate-900 tracking-tighter font-heading mb-1">{stat.value}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Identity & Compliance Audit Trail */}
                                <div className="space-y-10">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
                                            Compliance Audit Trail
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Protocol Secured</span>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {[
                                            { label: 'Trade Identifier (GST/TIN)', status: 'VERIFIED', id: selectedSeller.gstNumber || '27AAAAA0000A1Z5' },
                                            { label: 'Safety Registry (FSSAI)', status: 'VERIFIED', id: 'FSSAI-8829-X' },
                                            { label: 'Merchant Identification', status: selectedSeller.kycStatus, id: selectedSeller.panNumber || 'ABCDE1234F' }
                                        ].map((doc, i) => (
                                            <div key={i} className="group flex items-center justify-between p-8 bg-white border border-slate-100 rounded-[2.5rem] hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-700">
                                                <div className="flex items-center gap-6">
                                                    <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-slate-900 group-hover:border-slate-900 transition-all duration-700">
                                                        <FileText className="h-7 w-7 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">{doc.label}</p>
                                                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{doc.id}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={cn(
                                                        "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm border",
                                                        doc.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        doc.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-orange-50 text-orange-700 border-orange-100'
                                                    )}>
                                                        {doc.status}
                                                    </span>
                                                    <button className="block mt-3 text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline ml-auto">View Vault</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Network Parameters */}
                                <div className="space-y-10">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                        <div className="h-1.5 w-8 bg-blue-500 rounded-full" />
                                        Network Parameters
                                    </h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 group hover:bg-white transition-all duration-500">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Merchant Principal</p>
                                            <p className="text-xl font-black text-slate-900 uppercase tracking-tight font-heading">{selectedSeller.ownerName}</p>
                                            <div className="flex items-center gap-2 mt-4">
                                                <Mail className="w-3 h-3 text-blue-500" />
                                                <span className="text-[10px] font-bold text-slate-500 lowercase">{selectedSeller.email}</span>
                                            </div>
                                        </div>
                                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 group hover:bg-white transition-all duration-500">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Registry Date</p>
                                            <p className="text-xl font-black text-slate-900 uppercase tracking-tight font-heading">{selectedSeller.joinedAt}</p>
                                            <div className="flex items-center gap-2 mt-4">
                                                <Calendar className="w-3 h-3 text-emerald-500" />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">System Initialized</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Economic Protocol */}
                                <div className="p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden group">
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Economic Protocol</p>
                                            <div className="flex items-end gap-4">
                                                <span className="text-7xl font-black text-emerald-400 tracking-tighter font-heading leading-none">{selectedSeller.commissionRate}%</span>
                                                <div className="mb-2">
                                                    <p className="text-[11px] font-black text-white uppercase tracking-widest">Commission Fee</p>
                                                    <p className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest">Platform Tax Applied</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-20 w-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center border border-emerald-500/20">
                                            <Zap className="h-10 w-10 text-emerald-400 animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
                                </div>
                            </div>

                            {/* Operational Decision Hub */}
                            <div className="p-12 bg-white/80 backdrop-blur-3xl border-t border-slate-100 flex gap-6 flex-shrink-0">
                                {selectedSeller.status === 'PENDING' ? (
                                    <>
                                        <button
                                            onClick={() => handleApprove(selectedSeller.id)}
                                            className="flex-[2] h-18 bg-emerald-600 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:bg-emerald-500 hover:-translate-y-1 transition-all duration-500 active:scale-95 flex items-center justify-center gap-3"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            Authorize Merchant
                                        </button>
                                        <button
                                            onClick={() => handleReject(selectedSeller.id)}
                                            className="flex-1 h-18 bg-white border border-slate-200 text-slate-400 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:text-red-500 hover:border-red-500 transition-all duration-500 active:scale-95"
                                        >
                                            Decline
                                        </button>
                                    </>
                                ) : selectedSeller.status === 'SUSPENDED' ? (
                                    <button
                                        onClick={async () => {
                                            try {
                                                await reactivateSellerApi(selectedSeller.id);
                                                await refreshSellers();
                                                toast.success('Node reactivated successfully.');
                                                setSelectedSeller(null);
                                            } catch (e: any) {
                                                toast.error(getUserErrorMessage(e, 'Protocol restoration failed'));
                                            }
                                        }}
                                        className="w-full h-18 bg-emerald-600 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-4 active:scale-95 shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:bg-emerald-500 transition-all duration-500"
                                    >
                                        <Zap className="h-5 w-5" />
                                        Restore Operational Link
                                    </button>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            if (selectedSeller.status === 'ACTIVE') {
                                                try {
                                                    await suspendSellerApi(selectedSeller.id);
                                                    await refreshSellers();
                                                    toast.success('Node suspended.');
                                                    setSelectedSeller(null);
                                                } catch (e: any) {
                                                    toast.error(getUserErrorMessage(e, 'Suspension protocol failed'));
                                                }
                                            }
                                        } }
                                        className="w-full h-18 bg-slate-900 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-4 active:scale-95 hover:bg-red-600 transition-all duration-700"
                                    >
                                        <Ban className="h-5 w-5 text-red-400" />
                                        {selectedSeller.status === 'ACTIVE' ? 'Suspend Merchant Node' : 'Blacklist Entity'}
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

function AdminTableSkeletonRows({ rows, cols }: { rows: number, cols: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                    {Array.from({ length: cols }).map((_, j) => (
                        <td key={j} className="px-12 py-10">
                            <div className="h-4 bg-slate-100 rounded-full w-full opacity-50" />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

function StarIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
}
