import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    Search, Filter, MoreHorizontal, Mail, User,
    ShoppingBag, Calendar, TrendingUp, ChevronRight,
    Star, Shield, ExternalLink, MapPin, Phone, Clock,
    Download, Layout, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, getRoundedClass } from '@/lib/utils';
import { toast } from 'sonner';

export function AdminCustomersPage() {
    const { theme } = useStore();
    const { user } = useAuth();
    const { customers, orders, isInitialLoading: loading } = useAdminData();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

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
        return base.filter((c) => {
            if (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) return true;
            if (c.phone && c.phone.toLowerCase().includes(q)) return true;
            if (qDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(qDigits)) return true;
            return false;
        });
    }, [customers, searchQuery]);

    const stats = useMemo(() => {
        const total = filteredCustomers.length;
        const vip = filteredCustomers.filter(c => c.status === 'VIP').length;
        const active = filteredCustomers.filter(c => c.status === 'Active').length;
        const verified = filteredCustomers.filter(c => c.verificationStatus === 'Verified').length;
        return {
            total,
            vip,
            active,
            growth: `${verified}/${total} verified`,
        };
    }, [filteredCustomers]);

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

    return (
        <div className="space-y-8 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <User className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Customer Management</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Customers</h1>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportCustomersCsv}
                        className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Customers', value: stats.total, icon: User, color: 'emerald' },
                    { label: 'VIP Customers', value: stats.vip, icon: Star, color: 'purple' },
                    { label: 'Active Customers', value: stats.active, icon: TrendingUp, color: 'blue' },
                    { label: 'Verified Ratio', value: stats.growth, icon: Clock, color: 'orange' }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-3 rounded-2xl transition-all", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative group min-w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Orders</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Spent</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Profile</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={7} className="px-8 py-16 text-center text-slate-400 text-sm">Loading customers...</td></tr>
                            ) : (
                            <AnimatePresence mode='popLayout'>
                                {filteredCustomers.map((customer, idx) => (
                                    <motion.tr
                                        key={customer.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                        onClick={() => handleViewDetails(customer)}
                                    >
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-sm text-slate-600 border border-white shadow-sm ring-2 ring-transparent group-hover:ring-emerald-500/20 group-hover:bg-white transition-all">
                                                    {customer.name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{customer.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Joined {customer.joined}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold text-slate-500">{customer.email}</span>
                                                <span className={cn(
                                                    "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit",
                                                    customer.verificationStatus === 'Verified'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                )}>
                                                    {customer.verificationStatus === 'Verified' ? 'Verified' : 'Unverified'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-bold text-slate-600">{customer.phone || '—'}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="text-sm font-black text-slate-900">{customer.orders} Orders</span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-slate-900 tracking-tight">₹{customer.spent.toLocaleString()}</span>
                                                <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">High Value</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center">
                                                <span className={cn(
                                                    "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                                                    customer.status === 'VIP' ? 'bg-purple-50 text-purple-700 border-purple-100 shadow-purple-900/5' :
                                                        customer.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-900/5' :
                                                            'bg-slate-50 text-slate-400 border-slate-100'
                                                )}>
                                                    {customer.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center">
                                                <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-emerald-600 hover:shadow-lg transition-all">
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

            {/* Side Sheet for Customer Profile */}
            {selectedCustomer && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={() => setSelectedCustomer(null)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full"
                        >
                            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-[2rem] bg-slate-900 text-white flex items-center justify-center text-2xl font-black shadow-2xl shadow-slate-900/20">
                                        {selectedCustomer.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">{selectedCustomer.name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                                selectedCustomer.status === 'VIP' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                                            )}>
                                                {selectedCustomer.status}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                                                <Clock className="w-3 h-3" />
                                                Customer since {selectedCustomer.joined}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedCustomer(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                                    <X className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 space-y-12">
                                {/* Insights Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Lifetime Spend</p>
                                        <p className="text-2xl font-black text-slate-900 tracking-tight">₹{selectedCustomer.spent.toLocaleString()}</p>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Order Count</p>
                                        <p className="text-2xl font-black text-slate-900 tracking-tight">{selectedCustomer.orders} Orders</p>
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        Contact Details
                                    </h3>
                                    <div className="space-y-4 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-50">
                                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-50 rounded-lg">
                                                    <Mail className="w-4 h-4 text-emerald-600" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{selectedCustomer.email}</span>
                                            </div>
                                            <button className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline decoration-emerald-500">Copy</button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 rounded-lg">
                                                    <Phone className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{selectedCustomer.phone || '—'}</span>
                                            </div>
                                            {selectedCustomer.phone ? (
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-black rounded-md uppercase border border-emerald-100">On file</span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black rounded-md uppercase">None</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Activity */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <ShoppingBag className="w-4 h-4" />
                                            Order History
                                        </h3>
                                        <button className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">View All</button>
                                    </div>
                                    <div className="space-y-3">
                                        {orders.filter(o => o.user?.id === selectedCustomer.id).slice(0, 3).map(order => (
                                            <div key={order.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/20 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                                                        <ShoppingBag className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900 tracking-tight">Order #{order.orderNumber || order.id}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-slate-900">₹{Number(order.payableAmount ?? order.totalAmount ?? 0).toLocaleString()}</p>
                                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{order.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 flex gap-4 mt-auto">
                                <button
                                    onClick={() => toast.success(`Newsletter invite sent to ${selectedCustomer.name}`)}
                                    className="flex-1 h-14 bg-white border border-slate-200 text-slate-900 rounded-2xl hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                                >
                                    Send Update
                                </button>
                                <button
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
