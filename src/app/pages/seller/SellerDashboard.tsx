import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp, Package, ShoppingBag, Zap,
    Activity, Clock, ChevronRight, ArrowUpRight,
    ArrowDownRight, IndianRupee, PieChart, Users,
    Leaf, Box, Truck, BarChart3
} from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { cn } from '@/lib/utils';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar,
    PieChart as RePieChart, Pie, Cell
} from 'recharts';

export function SellerDashboard() {
    const { products, orders } = useStore();
    const { user } = useAuth();

    // Mock seller-specific stats
    const sellerStats = useMemo(() => {
        return {
            totalRevenue: 125400,
            revenueGrowth: '+12.5%',
            totalOrders: 42,
            ordersGrowth: '+8%',
            activeProducts: products.length,
            rating: 4.8,
            payoutPending: 24500
        };
    }, [products]);

    const revenueData = [
        { name: 'Mon', revenue: 4500, orders: 12 },
        { name: 'Tue', revenue: 5200, orders: 15 },
        { name: 'Wed', revenue: 3800, orders: 10 },
        { name: 'Thu', revenue: 6100, orders: 18 },
        { name: 'Fri', revenue: 7500, orders: 22 },
        { name: 'Sat', revenue: 8200, orders: 25 },
        { name: 'Sun', revenue: 6800, orders: 20 },
    ];

    return (
        <div className="space-y-10 pb-20">
            {/* Seller HUD Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Leaf className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Seller Dashboard</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
                        {user?.name}'s Store
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic font-medium">
                        Track your store performance in real time.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="h-12 px-8 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    label="Total Revenue"
                    value={`₹${(sellerStats.totalRevenue / 1000).toFixed(1)}k`}
                    trend={sellerStats.revenueGrowth}
                    icon={IndianRupee}
                    color="emerald"
                />
                <MetricCard
                    label="Total Orders"
                    value={sellerStats.totalOrders}
                    trend={sellerStats.ordersGrowth}
                    icon={ShoppingBag}
                    color="blue"
                />
                <MetricCard
                    label="Active Products"
                    value={sellerStats.activeProducts}
                    trend="Stable"
                    icon={Box}
                    color="purple"
                />
                <MetricCard
                    label="Pending Payout"
                    value={`₹${(sellerStats.payoutPending / 1000).toFixed(1)}k`}
                    trend="Processing"
                    icon={Clock}
                    color="orange"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue chart */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                            <BarChart3 className="w-32 h-32" />
                        </div>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Revenue Trend</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Last 7 Days</p>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                Live Feed
                            </div>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', fontSize: '10px' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#10b981"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorRev)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Pending orders */}
                <div className="space-y-6">
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-3xl h-full flex flex-col">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Pending Orders</h3>
                        <div className="flex-1 space-y-6">
                            {[
                                { id: 'ORD-892', items: 4, date: '2h ago', status: 'In Queue' },
                                { id: 'ORD-895', items: 2, date: '4h ago', status: 'Packed' },
                                { id: 'ORD-901', items: 8, date: '6h ago', status: 'Created' },
                            ].map((ord) => (
                                <div key={ord.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 group hover:bg-white hover:border-emerald-200 transition-all cursor-pointer">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{ord.id}</span>
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-white px-2 py-0.5 rounded-lg border border-slate-100">{ord.date}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-slate-500">{ord.items} items</p>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-100 transition-all mt-8">
                            View Order Queue
                        </button>
                    </div>
                </div>

                {/* Inventory and freshness */}
                <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Inventory */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-3xl">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Inventory</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Stock by Product</p>
                            </div>
                            <div className="p-3 bg-slate-900 text-white rounded-2xl">
                                <Box className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            {(products.length > 0 ? products.slice(0, 4) : [
                                { id: 'm1', name: 'Alphonso Mango', category: 'Seasonal Premium' },
                                { id: 'm2', name: 'Organic Strawberry', category: 'Berries' }
                            ]).map((product) => (
                                <div key={product.id} className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 group transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-900 border border-slate-100 shadow-sm">
                                                {product.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{product.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.category}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-slate-900 leading-none">850</p>
                                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">Units In Stock</p>
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-slate-200/50 grid grid-cols-3 gap-4">
                                        <button className="flex flex-col items-center gap-1 p-3 bg-white rounded-2xl border border-slate-100 hover:border-emerald-500 transition-all">
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Adjust</span>
                                            <span className="text-[10px] font-black text-slate-900">+ Stock</span>
                                        </button>
                                        <button className="flex flex-col items-center gap-1 p-3 bg-white rounded-2xl border border-slate-100 hover:border-red-500 transition-all">
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Audit</span>
                                            <span className="text-[10px] font-black text-slate-900">- Stock</span>
                                        </button>
                                        <button className="flex flex-col items-center gap-1 p-3 bg-slate-900 rounded-2xl border border-slate-900 text-white hover:bg-black transition-all">
                                            <span className="text-[8px] font-black text-slate-400 uppercase opacity-60">Status</span>
                                            <span className="text-[10px] font-black uppercase">Inspect</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Freshness monitor */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-3xl h-fit">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Product Freshness</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Expiry and Shelf Life</p>
                            </div>
                            <div className="p-3 bg-red-500 text-white rounded-2xl shadow-xl shadow-red-500/20">
                                <Activity className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="p-8 bg-red-50 border border-red-100 rounded-[2.5rem] relative overflow-hidden group">
                                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 transition-transform duration-700">
                                    <Clock className="w-24 h-24 text-red-900" />
                                </div>
                                <h4 className="text-red-900 font-black text-sm uppercase tracking-widest mb-4">Critical Expiry Alert</h4>
                                <div className="space-y-4 relative z-10">
                                    <div className="flex items-center justify-between p-4 bg-white/60 rounded-2xl">
                                        <span className="text-xs font-bold text-slate-900">Alphonso Mango (Batch #A90)</span>
                                        <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-lg italic">Expiring 48h</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-white/60 rounded-2xl">
                                        <span className="text-xs font-bold text-slate-900">Organic Strawberries (Slot #S2)</span>
                                        <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-lg italic">Expired</span>
                                    </div>
                                </div>
                                <button className="w-full mt-6 h-12 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20">
                                    Initiate Waste Clearance
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
                                    <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">Seasonal Health</p>
                                    <p className="text-xl font-black text-emerald-900 uppercase">Peak Yield</p>
                                    <p className="text-[8px] font-bold text-emerald-600/60 mt-2 uppercase italic">85% assets in active season</p>
                                </div>
                                <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Average Shelf Life</p>
                                    <p className="text-xl font-black text-slate-900 uppercase">12.4 Days</p>
                                    <p className="text-[8px] font-bold text-slate-400/60 mt-2 uppercase italic">+1.2 Days vs Last Cycle</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, trend, icon: Icon, color }: any) {
    const colors: any = {
        emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-100',
        blue: 'bg-blue-500/10 text-blue-600 border-blue-100',
        purple: 'bg-purple-500/10 text-purple-600 border-purple-100',
        orange: 'bg-orange-500/10 text-orange-600 border-orange-100'
    };

    return (
        <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            className="bg-white rounded-3xl p-8 border border-slate-100 shadow-2xl relative overflow-hidden group"
        >
            <div className={cn("inline-flex p-3 rounded-2xl border mb-6 transition-transform group-hover:scale-110", colors[color])}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{label}</p>
            <div className="flex items-end gap-3">
                <h4 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{value}</h4>
                <div className={cn("px-2 py-0.5 rounded-lg text-[9px] font-black uppercase mb-1",
                    trend.includes('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400')}>
                    {trend}
                </div>
            </div>
        </motion.div>
    );
}
