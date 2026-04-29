import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    Search, Filter, MoreHorizontal, Mail, User,
    ShoppingBag, Calendar, TrendingUp, ChevronRight,
    Star, Shield, ExternalLink, MapPin, Phone, Clock,
    Download, Layout, X, Megaphone, Loader2,
    Activity, Eye, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, getRoundedClass } from '@/lib/utils';
import { toast } from 'sonner';
import { postBulkCustomerAnnouncement } from '@/lib/api';

const STOCK_CLEARANCE_PRESET = {
    title: 'Stock clearance sale',
    message:
        'Fresh fruit and produce on clearance while stocks last. Open The Fruit Tribe app or website to shop the sale before it ends. Thank you for being part of our community!',
};

export function AdminCustomersPage() {
    const navigate = useNavigate();
    const { theme } = useStore();
    const { user } = useAuth();
    const { customers, orders, isInitialLoading: loading } = useAdminData();
    const [searchQuery, setSearchQuery] = useState('');
    const [segmentFilter, setSegmentFilter] = useState<'all' | 'VIP' | 'Active' | 'Inactive'>('all');
    const [verificationFilter, setVerificationFilter] = useState<'all' | 'Verified' | 'Unverified'>('all');
    const [activityFilter, setActivityFilter] = useState<'all' | 'with_orders' | 'no_orders'>('all');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const isAdmin = user?.role === 'admin';
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkTitle, setBulkTitle] = useState(STOCK_CLEARANCE_PRESET.title);
    const [bulkMessage, setBulkMessage] = useState(STOCK_CLEARANCE_PRESET.message);
    const [bulkAudience, setBulkAudience] = useState<'all' | 'verified' | 'with_orders'>('verified');
    const [bulkSendEmail, setBulkSendEmail] = useState(false);

    const filteredCustomers = useMemo(() => {
        let base = customers.map((c: any) => ({
            id: c.id,
            name: c.name,
            firstName: c.firstName ?? '',
            lastName: c.lastName ?? '',
            email: c.email,
            phone: c.phone != null && String(c.phone).trim() !== '' ? String(c.phone) : '',
            orders: c.orderCount,
            spent: c.totalSpent,
            joined: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—',
            lastLogin: c.lastLogin ? new Date(c.lastLogin).toLocaleString() : '',
            isActive: c.isActive !== false,
            accountStatus: c.accountStatus ?? '',
            walletBalance: typeof c.walletBalance === 'number' ? c.walletBalance : Number(c.walletBalance ?? 0),
            requirePasswordChange: !!c.requirePasswordChange,
            status: (c.totalSpent >= 10000 ? 'VIP' : c.orderCount > 0 ? 'Active' : 'Inactive') as 'Active' | 'VIP' | 'Inactive',
            verificationStatus: (c.verificationStatus === 'Verified' ? 'Verified' : 'Unverified') as 'Verified' | 'Unverified',
        }));
        const trimmed = searchQuery.trim();
        if (!trimmed) return base;
        const q = trimmed.toLowerCase();
        const qDigits = q.replace(/\D/g, '');
        return base.filter((c: any) => {
            if (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) return true;
            if (c.phone && c.phone.toLowerCase().includes(q)) return true;
            if (qDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(qDigits)) return true;
            return false;
        });
    }, [customers, searchQuery]);

    const filteredCustomersByAllFilters = useMemo(() => {
        return filteredCustomers.filter((c: any) => {
            const segmentOk = segmentFilter === 'all' || c.status === segmentFilter;
            const verificationOk = verificationFilter === 'all' || c.verificationStatus === verificationFilter;
            const activityOk =
                activityFilter === 'all'
                    ? true
                    : activityFilter === 'with_orders'
                        ? c.orders > 0
                        : c.orders === 0;
            return segmentOk && verificationOk && activityOk;
        });
    }, [filteredCustomers, segmentFilter, verificationFilter, activityFilter]);

    const stats = useMemo(() => {
        const total = filteredCustomersByAllFilters.length;
        const vip = filteredCustomersByAllFilters.filter(c => c.status === 'VIP').length;
        const active = filteredCustomersByAllFilters.filter(c => c.status === 'Active').length;
        const verified = filteredCustomersByAllFilters.filter(c => c.verificationStatus === 'Verified').length;
        return {
            total,
            vip,
            active,
            growth: `${verified}/${total} verified`,
        };
    }, [filteredCustomersByAllFilters]);

    const handleSendCustomerUpdate = (customer: any) => {
        if (!customer) return;
        const customerEmail = String(customer.email || '').trim();
        if (!customerEmail) {
            toast.error('Customer email is unavailable for this profile.');
            return;
        }
        const subject = encodeURIComponent('Update from The Fruit Tribe');
        const body = encodeURIComponent(
            `Hi ${customer.name || 'Customer'},\n\nQuick update from The Fruit Tribe.\n\nRegards,\nThe Fruit Tribe Team`
        );
        window.open(`mailto:${customerEmail}?subject=${subject}&body=${body}`, '_self');
        toast.success(`Update draft opened for ${customer.name}.`);
    };

    const handleViewCustomerAnalytics = (customer: any) => {
        if (!customer) return;
        const query = String(customer.email || customer.name || '').trim();
        if (!query) {
            navigate('/admin/orders');
            return;
        }
        navigate(`/admin/orders?search=${encodeURIComponent(query)}`);
        setSelectedCustomer(null);
        toast.success('Opened order analytics for selected customer.');
    };

    const handleViewDetails = (customer: any) => {
        setSelectedCustomer(customer);
    };

    const escapeCsvValue = (value: unknown) => {
        const str = value == null ? '' : String(value);
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const handleExportCustomersCsv = () => {
        if (!customers.length) {
            toast.error('No customer data to export');
            return;
        }

        const header = [
            'Customer ID',
            'First Name',
            'Last Name',
            'Full Name',
            'Email',
            'Phone',
            'Order Count',
            'Total Spent (INR)',
            'Wallet Balance (INR)',
            'Joined At (ISO)',
            'Last Login (ISO)',
            'Email Verification',
            'Account Active',
            'Account Status',
            'Must Change Password',
            'Segment (VIP/Active/Inactive)',
        ];

        const rows = customers.map((c: any) => {
            const segment = c.totalSpent >= 10000 ? 'VIP' : c.orderCount > 0 ? 'Active' : 'Inactive';
            const joinedIso = c.createdAt ? new Date(c.createdAt).toISOString() : '';
            const lastLoginIso = c.lastLogin ? new Date(c.lastLogin).toISOString() : '';
            return [
                c.id,
                c.firstName ?? '',
                c.lastName ?? '',
                c.name,
                c.email,
                c.phone ?? '',
                c.orderCount,
                c.totalSpent,
                typeof c.walletBalance === 'number' ? c.walletBalance : Number(c.walletBalance ?? 0),
                joinedIso,
                lastLoginIso,
                c.verificationStatus === 'Verified' ? 'Verified' : 'Unverified',
                c.isActive === false ? 'No' : 'Yes',
                c.accountStatus ?? '',
                c.requirePasswordChange ? 'Yes' : 'No',
                segment,
            ];
        });

        const csvContent = [header, ...rows]
            .map((row) => row.map(escapeCsvValue).join(','))
            .join('\n');

        // UTF-8 BOM helps Excel recognize encoding for names/emails with special characters
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateTag = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.setAttribute('download', `customers-${dateTag}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Customer CSV downloaded');
    };

    const openBulkModal = () => {
        setBulkTitle(STOCK_CLEARANCE_PRESET.title);
        setBulkMessage(STOCK_CLEARANCE_PRESET.message);
        setBulkAudience('verified');
        setBulkSendEmail(false);
        setBulkOpen(true);
    };

    const handleBulkSend = async () => {
        const title = bulkTitle.trim();
        const message = bulkMessage.trim();
        if (title.length < 3) {
            toast.error('Please enter a title (at least 3 characters).');
            return;
        }
        if (message.length < 10) {
            toast.error('Please enter a longer message (at least 10 characters).');
            return;
        }
        setBulkLoading(true);
        try {
            const res = await postBulkCustomerAnnouncement({
                title,
                message,
                audience: bulkAudience,
                sendEmail: bulkSendEmail,
            });
            if (res.notificationsCreated === 0) {
                toast.info(res.message || 'No customers matched.');
            } else {
                let desc = `In-app notifications: ${res.notificationsCreated}`;
                if (bulkSendEmail) {
                    desc += `. Email sent: ${res.emailsSent ?? 0}`;
                    if ((res.emailsFailed ?? 0) > 0) desc += `, failed: ${res.emailsFailed}`;
                    if (res.emailBatchCapped) desc += ` (first ${res.emailCap ?? 200} only; run again for more if needed)`;
                }
                toast.success('Bulk message sent', { description: desc });
            }
            setBulkOpen(false);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to send bulk message');
        } finally {
            setBulkLoading(false);
        }
    };

    return (
        <div className="space-y-12 pb-20">
            {/* Ultra-Premium Header: Customer Broadcast Node */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 group cursor-default">
                        <div className="h-2 w-12 bg-blue-500 rounded-full group-hover:w-16 transition-all duration-700" />
                        <span className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em]">Customer Broadcast Node</span>
                    </div>
                    <h1 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter uppercase font-heading">
                        User <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">Base</span>
                    </h1>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mt-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        Network Density & Engagement Telemetry
                    </p>
                </div>
                <div className="flex items-center gap-4 relative z-10">
                    <button
                        type="button"
                        onClick={handleExportCustomersCsv}
                        className="h-16 px-10 rounded-[2rem] bg-white border border-slate-100 text-[11px] font-black text-slate-900 uppercase tracking-widest hover:bg-slate-50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] transition-all duration-500 flex items-center gap-3 group"
                    >
                        <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        Export Ledger
                    </button>
                    {isAdmin && (
                        <button
                            onClick={openBulkModal}
                            className="h-16 px-12 rounded-[2rem] bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all duration-700 shadow-2xl shadow-slate-900/20 active:scale-95 flex items-center gap-3 group"
                        >
                            <Megaphone className="h-5 w-5 transition-transform group-hover:rotate-12 duration-500" />
                            Broadcast Node
                        </button>
                    )}
                </div>
            </div>

            {/* Performance Matrix: High-Contrast Discovery Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Users', value: stats.total, icon: User, color: 'emerald', trend: 'Network Size', sub: 'Aggregated accounts' },
                    { label: 'VIP Assets', value: stats.vip, icon: Star, color: 'purple', trend: 'High Value', sub: 'Top tier spenders' },
                    { label: 'Active nodes', value: stats.active, icon: TrendingUp, color: 'blue', trend: 'In-Flight', sub: 'Engagement level' },
                    { label: 'Trust Ratio', value: stats.growth, icon: Shield, color: 'orange', trend: 'Verified', sub: 'KYC completion' }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: i * 0.1, ease: [0.23, 1, 0.32, 1] }}
                        key={stat.label}
                        className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:shadow-[0_30px_70px_rgba(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-700"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[4rem] group-hover:bg-blue-50 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-10">
                                <div className={cn(
                                    "h-16 w-16 rounded-[1.75rem] flex items-center justify-center transition-all duration-700 shadow-lg",
                                    stat.color === 'emerald' ? "bg-emerald-500 text-white shadow-emerald-500/20" :
                                    stat.color === 'orange' ? "bg-orange-500 text-white shadow-orange-500/20" :
                                    stat.color === 'blue' ? "bg-blue-600 text-white shadow-blue-600/20" :
                                    "bg-purple-600 text-white shadow-purple-600/20"
                                )}>
                                    <stat.icon className="w-7 h-7" />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{stat.trend}</span>
                                    <div className="flex items-center justify-end gap-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Live</span>
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 font-heading">{stat.value}</h3>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                            <p className="text-[10px] font-bold text-slate-300 italic">{stat.sub}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Fulfillment Pipeline: Interactive Data Table */}
            <div className="bg-white rounded-[4rem] border border-slate-100 shadow-[0_40px_100px_rgba(0,0,0,0.03)] overflow-hidden relative">
                <div className="p-10 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-slate-50/30">
                    <div className="flex items-center gap-3 p-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-2 px-4 border-r border-slate-100">
                            <Filter className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filters</span>
                        </div>
                        <select
                            value={segmentFilter}
                            onChange={(e) => setSegmentFilter(e.target.value as 'all' | 'VIP' | 'Active' | 'Inactive')}
                            className="bg-transparent h-10 px-4 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                        >
                            <option value="all">All Segments</option>
                            <option value="VIP">VIP Customers</option>
                            <option value="Active">Active Customers</option>
                            <option value="Inactive">Inactive Customers</option>
                        </select>
                        <div className="h-4 w-[1px] bg-slate-100" />
                        <select
                            value={verificationFilter}
                            onChange={(e) => setVerificationFilter(e.target.value as 'all' | 'Verified' | 'Unverified')}
                            className="bg-transparent h-10 px-4 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                        >
                            <option value="all">Verification Status</option>
                            <option value="Verified">Verified</option>
                            <option value="Unverified">Unverified</option>
                        </select>
                        <div className="h-4 w-[1px] bg-slate-100" />
                        <select
                            value={activityFilter}
                            onChange={(e) => setActivityFilter(e.target.value as 'all' | 'with_orders' | 'no_orders')}
                            className="bg-transparent h-10 px-4 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                        >
                            <option value="all">Activity Level</option>
                            <option value="with_orders">With Orders</option>
                            <option value="no_orders">No Orders</option>
                        </select>
                    </div>

                    <div className="relative group flex-1 max-w-2xl">
                        <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-500 transition-all duration-500 group-focus-within:scale-110" />
                        <input
                            type="text"
                            placeholder="Search by customer name, email, or phone..."
                            className="w-full h-16 pl-16 pr-8 bg-white border border-slate-100 rounded-[1.5rem] text-[13px] font-bold text-slate-900 focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-500/50 outline-none transition-all duration-500 shadow-inner"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[600px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/50">
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Customer Entity</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Digital Credentials</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Telemetry Contact</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Transaction Load</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Lifetime Valuation</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Node State</th>
                                <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Flow Console</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <AdminTableSkeletonRows rows={10} cols={7} />
                            ) : (
                                <AnimatePresence mode='popLayout'>
                                    {filteredCustomersByAllFilters.map((customer, idx) => (
                                        <motion.tr
                                            key={customer.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            transition={{ duration: 0.5, delay: idx * 0.03, ease: [0.23, 1, 0.32, 1] }}
                                            className="group hover:bg-slate-50/50 transition-all duration-500 cursor-pointer relative"
                                            onClick={() => handleViewDetails(customer)}
                                        >
                                            <td className="px-12 py-10">
                                                <div className="flex items-center gap-6">
                                                    <div className="h-14 w-14 rounded-[1.5rem] bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-2xl shadow-slate-900/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 font-heading">
                                                        {customer.name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors">{customer.name}</span>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Calendar className="w-3 h-3 text-slate-300" />
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">Node since {customer.joined}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-12 py-10">
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-[11px] font-bold text-slate-500 tracking-tight lowercase">{customer.email}</span>
                                                    <div className={cn(
                                                        "flex items-center gap-2 px-3 py-1 rounded-lg w-fit transition-all duration-500",
                                                        customer.verificationStatus === 'Verified'
                                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                    )}>
                                                        {customer.verificationStatus === 'Verified' ? <Shield className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                                                        <span className="text-[8px] font-black uppercase tracking-widest">
                                                            {customer.verificationStatus}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-12 py-10">
                                                <div className="flex items-center gap-3 text-slate-400 group-hover:text-slate-900 transition-colors">
                                                    <Phone className="w-3.5 h-3.5" />
                                                    <span className="text-[11px] font-black tracking-widest">{customer.phone || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-12 py-10 text-center">
                                                <div className="inline-flex items-center gap-3 px-6 py-2 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition-all duration-500">
                                                    <ShoppingBag className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                    <span className="text-xs font-black text-slate-900">{customer.orders} <span className="text-[9px] text-slate-400 font-black uppercase ml-1">Orders</span></span>
                                                </div>
                                            </td>
                                            <td className="px-12 py-10 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xl font-black text-slate-900 tracking-tighter leading-none font-heading">₹{customer.spent.toLocaleString()}</span>
                                                    {customer.spent >= 10000 && (
                                                        <span className="text-[8px] font-black text-purple-500 uppercase tracking-widest mt-2 flex items-center gap-1">
                                                            <Star className="h-2.5 w-2.5 fill-purple-500" />
                                                            Priority Asset
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-12 py-10">
                                                <div className="flex justify-center">
                                                    <span className={cn(
                                                        "px-5 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all duration-700 shadow-sm",
                                                        customer.status === 'VIP' ? 'bg-purple-900 text-white border-purple-800 shadow-purple-900/20' :
                                                        customer.status === 'Active' ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20' :
                                                        'bg-white text-slate-400 border-slate-100'
                                                    )}>
                                                        {customer.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-12 py-10">
                                                <div className="flex justify-center">
                                                    <button 
                                                        className="h-12 w-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-2xl transition-all duration-500 group/btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewDetails(customer);
                                                        }}
                                                    >
                                                        <Eye className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
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

            {/* Broadcast Node: Mass Telemetry Dispatch */}
            {bulkOpen && isAdmin && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 md:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/70 backdrop-blur-2xl"
                            onClick={() => !bulkLoading && setBulkOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 50, rotateX: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 50, rotateX: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative bg-white/95 backdrop-blur-3xl rounded-[4rem] shadow-[0_40px_120px_rgba(0,0,0,0.3)] w-full max-w-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="flex-shrink-0 p-12 border-b border-slate-100 bg-white/50 flex items-center justify-between">
                                <div>
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase font-heading">Broadcast <span className="text-blue-600">Node</span></h2>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                                        <Megaphone className="w-3 h-3 text-blue-500" />
                                        Mass Network Communication Protocol
                                    </p>
                                </div>
                                <button 
                                    onClick={() => !bulkLoading && setBulkOpen(false)}
                                    className="h-14 w-14 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-2xl transition-all duration-500 flex items-center justify-center group"
                                >
                                    <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBulkTitle(STOCK_CLEARANCE_PRESET.title);
                                        setBulkMessage(STOCK_CLEARANCE_PRESET.message);
                                    }}
                                    className="w-full p-6 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-between group hover:bg-blue-600 hover:border-blue-600 transition-all duration-500"
                                >
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 group-hover:text-blue-100">Quick Template</p>
                                        <p className="text-sm font-black text-slate-900 group-hover:text-white">Apply Stock Clearance Preset</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-blue-400 group-hover:text-white transition-transform group-hover:translate-x-1" />
                                </button>

                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payload Title</label>
                                        <input
                                            value={bulkTitle}
                                            onChange={(e) => setBulkTitle(e.target.value)}
                                            placeholder="System Notification Header"
                                            className="w-full h-18 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-sm font-black text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all duration-500"
                                            maxLength={200}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Communication Body</label>
                                        <textarea
                                            value={bulkMessage}
                                            onChange={(e) => setBulkMessage(e.target.value)}
                                            placeholder="Describe the transaction parameters or network updates..."
                                            rows={6}
                                            className="w-full p-8 rounded-[2rem] bg-slate-50 border border-slate-100 text-sm font-black text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all duration-500 min-h-[180px] resize-none"
                                            maxLength={5000}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Network Segment</label>
                                            <select
                                                value={bulkAudience}
                                                onChange={(e) => setBulkAudience(e.target.value as 'all' | 'verified' | 'with_orders')}
                                                className="w-full h-18 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-[11px] font-black uppercase tracking-widest text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all duration-500 appearance-none cursor-pointer"
                                            >
                                                <option value="verified">Verified Nodes Only</option>
                                                <option value="all">Global User Base</option>
                                                <option value="with_orders">Transacted Entities</option>
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transmission Mode</label>
                                            <label className="flex items-center gap-4 h-18 px-8 rounded-3xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all duration-500 group">
                                                <input
                                                    type="checkbox"
                                                    checked={bulkSendEmail}
                                                    onChange={(e) => setBulkSendEmail(e.target.checked)}
                                                    className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Email Uplink</span>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">SMTP Protocol</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex-shrink-0 p-12 bg-white border-t border-slate-100 flex gap-6">
                                <button
                                    type="button"
                                    disabled={bulkLoading}
                                    onClick={() => setBulkOpen(false)}
                                    className="flex-1 h-18 bg-white border border-slate-200 text-slate-400 rounded-3xl hover:bg-slate-50 hover:text-slate-900 font-black text-[11px] uppercase tracking-widest transition-all duration-500 disabled:opacity-50"
                                >
                                    Abort
                                </button>
                                <button
                                    type="button"
                                    disabled={bulkLoading}
                                    onClick={handleBulkSend}
                                    className="flex-[2.5] h-18 bg-slate-900 text-white rounded-3xl hover:bg-blue-600 font-black text-[11px] uppercase tracking-widest transition-all duration-700 shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-4 group disabled:opacity-60"
                                >
                                    {bulkLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-blue-400" />}
                                    Execute Broadcast
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {/* Side Sheet: Customer Payload Analysis */}
            {selectedCustomer && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[140] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
                            onClick={() => setSelectedCustomer(null)}
                        />
                        <motion.div
                            initial={{ x: '100%', skewX: 5 }}
                            animate={{ x: 0, skewX: 0 }}
                            exit={{ x: '100%', skewX: 5 }}
                            transition={{ type: 'spring', damping: 35, stiffness: 250 }}
                            className="relative w-full max-w-2xl bg-white shadow-[-40px_0_100px_rgba(0,0,0,0.1)] flex flex-col h-full overflow-hidden"
                        >
                            {/* Sheet Header */}
                            <div className="p-12 border-b border-slate-100 bg-white relative overflow-hidden flex-shrink-0">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-bl-[10rem] -mr-32 -mt-32 pointer-events-none" />
                                <div className="relative z-10 flex items-center justify-between mb-12">
                                    <div className="flex items-center gap-4">
                                        <div className="h-2 w-12 bg-blue-500 rounded-full" />
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Payload Analysis</span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedCustomer(null)}
                                        className="h-14 w-14 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-2xl transition-all duration-500 flex items-center justify-center group"
                                    >
                                        <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
                                    </button>
                                </div>
                                
                                <div className="relative z-10 flex items-end justify-between">
                                    <div className="flex items-center gap-8">
                                        <div className="h-28 w-28 rounded-[3rem] bg-slate-900 text-white flex items-center justify-center text-4xl font-black shadow-[0_30px_60px_rgba(0,0,0,0.2)] border-4 border-white font-heading">
                                            {selectedCustomer.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase font-heading leading-tight">{selectedCustomer.name}</h2>
                                            <div className="flex items-center gap-4 mt-3">
                                                <span className={cn(
                                                    "px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border",
                                                    selectedCustomer.status === 'VIP' 
                                                        ? 'bg-purple-900 text-white border-purple-800' 
                                                        : 'bg-emerald-500 text-white border-emerald-400'
                                                )}>
                                                    {selectedCustomer.status} NODE
                                                </span>
                                                <span className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                                                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                                                    INITIATED {selectedCustomer.joined}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sheet Content */}
                            <div className="flex-1 overflow-y-auto p-12 space-y-16 custom-scrollbar">
                                {/* Telemetry Matrix */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Aggregate Valuation</p>
                                            <p className="text-4xl font-black text-blue-400 tracking-tighter font-heading leading-none">₹{selectedCustomer.spent.toLocaleString()}</p>
                                            <div className="mt-8 flex items-center gap-2">
                                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">High Yield Asset</span>
                                            </div>
                                        </div>
                                        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-1000" />
                                    </div>
                                    <div className="p-10 rounded-[3rem] bg-white border border-slate-100 shadow-sm relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Transaction Load</p>
                                            <p className="text-4xl font-black text-slate-900 tracking-tighter font-heading leading-none">{selectedCustomer.orders}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-8">Completed Cycles</p>
                                        </div>
                                        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-slate-50 rounded-full blur-3xl group-hover:bg-blue-50 transition-all duration-1000" />
                                    </div>
                                </div>

                                {/* Identity Parameters */}
                                <div className="space-y-8">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                        <div className="h-1.5 w-8 bg-blue-500 rounded-full" />
                                        Identity Parameters
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="group flex items-center justify-between p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500">
                                            <div className="flex items-center gap-6">
                                                <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                                                    <Mail className="w-6 h-6 text-blue-600" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Electronic Mail</span>
                                                    <span className="text-sm font-black text-slate-900 lowercase tracking-tight">{selectedCustomer.email}</span>
                                                </div>
                                            </div>
                                            <button className="h-10 px-6 rounded-xl bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all">Copy</button>
                                        </div>
                                        <div className="group flex items-center justify-between p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500">
                                            <div className="flex items-center gap-6">
                                                <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                                                    <Phone className="w-6 h-6 text-emerald-600" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Telemetry Contact</span>
                                                    <span className="text-sm font-black text-slate-900 tracking-widest">{selectedCustomer.phone || 'NO DATA'}</span>
                                                </div>
                                            </div>
                                            {selectedCustomer.phone ? (
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded-lg uppercase border border-emerald-100 tracking-widest">Active Link</span>
                                            ) : (
                                                <span className="px-3 py-1 bg-slate-100 text-slate-400 text-[8px] font-black rounded-lg uppercase tracking-widest">No Link</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Historical Ledger */}
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <div className="h-1.5 w-8 bg-orange-500 rounded-full" />
                                            Historical Ledger
                                        </h3>
                                        <button
                                            onClick={() => handleViewCustomerAnalytics(selectedCustomer)}
                                            className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                        >
                                            Full Analysis
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {orders.filter(o => o.user?.id === selectedCustomer.id).slice(0, 4).map((order, i) => (
                                            <div 
                                                key={order.id} 
                                                className="group flex items-center justify-between p-8 bg-white border border-slate-100 rounded-[2.5rem] hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-700"
                                            >
                                                <div className="flex items-center gap-6">
                                                    <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-slate-900 group-hover:border-slate-900 transition-all duration-700">
                                                        <ShoppingBag className="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Sequence #{order.orderNumber || order.id.slice(-6)}</p>
                                                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Transacted {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'UNKNOWN'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-black text-slate-900 tracking-tighter font-heading">₹{Number(order.payableAmount ?? order.totalAmount ?? 0).toLocaleString()}</p>
                                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{order.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 flex gap-4 mt-auto">
                                <button
                                    onClick={() => handleSendCustomerUpdate(selectedCustomer)}
                                    className="flex-1 h-14 bg-white border border-slate-200 text-slate-900 rounded-2xl hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                                >
                                    Send Update
                                </button>
                                <button
                                    onClick={() => handleViewCustomerAnalytics(selectedCustomer)}
                                    className="flex-1 h-14 bg-slate-900 text-white rounded-2xl hover:bg-black text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10"
                                >
                                    View Analytics
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
