import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus, Search, Trash2, Edit2, Tag, Calendar,
    Percent, IndianRupee, X, Ticket, TrendingUp,
    Zap, Clock, ShieldCheck, Download, MoreVertical,
    Activity, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Coupon {
    id: string;
    code: string;
    type: 'Percentage' | 'Fixed Amount';
    value: number;
    minSpend: number;
    expiryDate: string;
    status: 'Active' | 'Expired' | 'Disabled';
    usageCount: number;
}

const INITIAL_COUPONS: Coupon[] = [
    { id: '1', code: 'FRUIT20', type: 'Percentage', value: 20, minSpend: 500, expiryDate: '2026-12-31', status: 'Active', usageCount: 145 },
    { id: '2', code: 'FRESH50', type: 'Fixed Amount', value: 50, minSpend: 300, expiryDate: '2026-06-30', status: 'Active', usageCount: 89 },
    { id: '3', code: 'WELCOME10', type: 'Percentage', value: 10, minSpend: 0, expiryDate: '2026-03-15', status: 'Expired', usageCount: 230 },
];

export function AdminDiscountsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
    const [formData, setFormData] = useState<Partial<Coupon>>({
        code: '',
        type: 'Percentage',
        value: 0,
        minSpend: 0,
        expiryDate: '',
        status: 'Active'
    });

    const filteredCoupons = useMemo(() => {
        return coupons.filter(c => c.code.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [coupons, searchQuery]);

    const stats = useMemo(() => ({
        active: coupons.filter(c => c.status === 'Active').length,
        usages: coupons.reduce((sum, c) => sum + c.usageCount, 0),
        impact: coupons.reduce((sum, c) => sum + (c.usageCount * (c.type === 'Fixed Amount' ? c.value : 100)), 0)
    }), [coupons]);

    const handleOpenAdd = () => {
        setEditingCoupon(null);
        setFormData({ code: '', type: 'Percentage', value: 0, minSpend: 0, expiryDate: '', status: 'Active' });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (coupon: Coupon) => {
        setEditingCoupon(coupon);
        setFormData(coupon);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string, code: string) => {
        toast(`Archive coupon ${code}?`, {
            description: "Marketing telemetry for this node will be preserved.",
            action: {
                label: "Archive",
                onClick: () => {
                    setCoupons(coupons.map(c => c.id === id ? { ...c, status: 'Disabled' as any } : c));
                    toast.success('Campaign archived successfully');
                }
            },
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCoupon) {
            setCoupons(coupons.map(c => c.id === editingCoupon.id ? { ...c, ...formData } as Coupon : c));
            toast.success('Campaign parameters updated');
        } else {
            const newCoupon: Coupon = {
                id: Math.random().toString(36).substr(2, 9),
                ...formData as Omit<Coupon, 'id' | 'usageCount'>,
                usageCount: 0
            };
            setCoupons([newCoupon, ...coupons]);
            toast.success('New promotion strategy initiated');
        }
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Growth Engine</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Campaign Matrix</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Strategic promotion management and incentive engineering.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:shadow-xl transition-all flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={handleOpenAdd}
                        className="h-12 px-8 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Initiate Campaign
                    </button>
                </div>
            </div>

            {/* Strategy Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Active Initiatives', value: stats.active, icon: Zap, color: 'emerald', trend: '+2 this week' },
                    { label: 'Network Penetration', value: stats.usages.toLocaleString(), icon: TrendingUp, color: 'blue', trend: '12% conversion' },
                    { label: 'Economic Impact', value: `₹${(stats.impact / 1000).toFixed(1)}K`, icon: Activity, color: 'purple', trend: 'Investment' }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:ring-2 ring-transparent hover:ring-emerald-500/10 transition-all cursor-default"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div className={cn("p-4 rounded-[1.5rem] border", `bg-${stat.color}-50 text-${stat.color}-600 border-${stat.color}-100`)}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.trend}</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{stat.value}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Campaign Discovery Interface */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Locate Campaign by Code ID..."
                            className="w-full h-14 pl-14 pr-6 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Promotion Identity</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Yield Value</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Floor Limit</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiration</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence mode='popLayout'>
                                {filteredCoupons.map((coupon, idx) => (
                                    <motion.tr
                                        key={coupon.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-6">
                                                <div className="h-16 w-16 rounded-[2rem] bg-slate-900 flex items-center justify-center shadow-xl shadow-slate-900/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                                    <Ticket className="w-8 h-8 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-black text-slate-900 tracking-tight group-hover:text-emerald-600 transition-colors">{coupon.code}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                                                        <Zap className="h-2.5 w-2.5 text-emerald-500" />
                                                        {coupon.type} Logic
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <span className="text-lg font-black text-slate-900 tracking-tighter">
                                                {coupon.type === 'Percentage' ? `${coupon.value}%` : `₹${coupon.value}`}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <span className="text-sm font-black text-slate-400 uppercase tracking-tight">₹{coupon.minSpend}</span>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-2 text-xs font-black text-slate-600">
                                                <Clock className="w-3.5 h-3.5 text-slate-300" />
                                                {coupon.expiryDate}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-center">
                                            <span className={cn(
                                                "px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all",
                                                coupon.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                                                    coupon.status === 'Expired' ? 'bg-red-50 text-red-700' :
                                                        'bg-slate-100 text-slate-400'
                                            )}>
                                                {coupon.status}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <button
                                                    onClick={() => handleOpenEdit(coupon)}
                                                    className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 hover:shadow-xl transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(coupon.id, coupon.code)}
                                                    className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-red-500 hover:shadow-xl transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* Campaign Config Side-Sheet (Add/Edit Modal) */}
            {isModalOpen && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Sheet Header */}
                            <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                            <Ticket className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                                            {editingCoupon ? 'Modify Sequence' : 'Initialize Campaign'}
                                        </h2>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Growth Vector Calibration Protocol</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-300 hover:text-red-500 transition-all">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                                <div className="p-10 space-y-10 overflow-y-auto">
                                    {/* Campaign ID */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unique Promotion Identity (CODE)</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.code}
                                            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                            className="w-full h-16 px-8 bg-slate-50 border border-slate-100 rounded-3xl text-xl font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-sm"
                                            placeholder="e.g. ALPHA_V2"
                                        />
                                    </div>

                                    {/* Value Matrix */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yield Logic</label>
                                            <select
                                                value={formData.type}
                                                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                                className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black text-slate-700 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all appearance-none uppercase tracking-tight"
                                            >
                                                <option value="Percentage">Percentage Drop</option>
                                                <option value="Fixed Amount">Fixed Subtraction</option>
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Magnitude</label>
                                            <div className="relative">
                                                <input
                                                    required
                                                    type="number"
                                                    value={formData.value}
                                                    onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                                                    className="w-full h-16 pl-8 pr-12 bg-slate-50 border border-slate-100 rounded-3xl text-lg font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-sm"
                                                />
                                                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-400">
                                                    {formData.type === 'Percentage' ? '%' : '₹'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Operational Limits */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Basket Floor (INR)</label>
                                            <input
                                                type="number"
                                                value={formData.minSpend}
                                                onChange={e => setFormData({ ...formData, minSpend: parseFloat(e.target.value) })}
                                                className="w-full h-16 px-8 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-sm"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Depletion Date</label>
                                            <input
                                                required
                                                type="date"
                                                value={formData.expiryDate}
                                                onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                                                className="w-full h-16 px-8 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Deployment Status */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Live Deployment Protocol</p>
                                        <div className="flex gap-4">
                                            {['Active', 'Disabled'].map((status) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, status: status as any })}
                                                    className={cn(
                                                        "flex-1 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                                        formData.status === status
                                                            ? (status === 'Active' ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-500/10" : "bg-slate-900 border-slate-900 text-white shadow-xl")
                                                            : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                                                    )}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10 bg-slate-50 border-t border-slate-100">
                                    <button
                                        type="submit"
                                        className="w-full h-16 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/20 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        <Zap className="w-5 h-5 text-emerald-400" />
                                        {editingCoupon ? 'Commit Parameters' : 'Authorize Deployment'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
