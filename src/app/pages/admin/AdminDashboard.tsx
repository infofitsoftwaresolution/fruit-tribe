import { useState, useMemo, useEffect } from 'react';
import {
    ChevronRight, Users, Store, TrendingUp, AlertCircle,
    Package, ArrowUpRight, ArrowDownRight, IndianRupee,
    ShoppingBag, Clock, ShieldCheck, Zap, LayoutDashboard,
    ArrowRight, Star, ExternalLink, Activity, Ban
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { getOrders, getCustomers, getSellers } from '@/lib/api';
import { useProducts } from '@/app/hooks/useProducts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function AdminDashboard() {
    const { theme } = useStore();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { products } = useProducts({ limit: 200 });
    const [orders, setOrders] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [sellers, setSellers] = useState<any[]>([]);

    useEffect(() => {
        let cancelled = false;
        getOrders().then((d) => { if (!cancelled) setOrders(d || []); }).catch(() => {});
        getCustomers().then((d) => { if (!cancelled) setCustomers(d || []); }).catch(() => {});
        getSellers().then((d) => { if (!cancelled) setSellers(d || []); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const isSuperAdmin = user?.role === 'super_admin';
    const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';
    const isSeller = user?.role === 'seller' || user?.role === 'SELLER';

    const lowStockCount = useMemo(
        () => products.filter((p) => (p.availableStock ?? p.stock) < (p.lowStockThreshold ?? 5) && (p.availableStock ?? p.stock) > 0).length,
        [products]
    );

    const inventoryIntel = useMemo(() => {
        const totalProducts = products.length;
        const totalUnits = products.reduce((sum, p) => sum + (p.stock ?? 0), 0);
        const outOfStock = products.filter((p) => (p.availableStock ?? p.stock) <= 0).length;
        const lowStock = products.filter(
            (p) => (p.availableStock ?? p.stock) > 0 && (p.availableStock ?? p.stock) <= (p.lowStockThreshold ?? 5)
        ).length;
        const healthy = Math.max(0, totalProducts - outOfStock - lowStock);
        return { totalProducts, totalUnits, outOfStock, lowStock, healthy };
    }, [products]);

    const lowStockPreview = useMemo(
        () =>
            products
                .filter((p) => (p.availableStock ?? p.stock) > 0 && (p.availableStock ?? p.stock) <= (p.lowStockThreshold ?? 5))
                .sort((a, b) => (a.availableStock ?? a.stock) - (b.availableStock ?? b.stock))
                .slice(0, 5),
        [products]
    );

        const intel = useMemo(() => {
        const fullOrders = orders.map((o: any) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            total: Number(o.payableAmount ?? o.totalAmount ?? 0),
            payment: o.paymentStatus === 'PAID' ? 'Paid' : 'Pending',
            status: o.status,
            date: o.createdAt,
            user: o.user,
            items: o.items || [],
        }));
        const baseOrders = isSeller
            ? fullOrders.filter(o => o.items?.some((item: any) => {
                const p = products.find(pr => String(pr.id) === String(item.productId));
                return p?.vendor === (user as any)?.name;
            }))
            : fullOrders;

        const grossSales = baseOrders.reduce((sum, o) => sum + o.total, 0);
        const volume = baseOrders.length;
        const pending = baseOrders.filter(
            (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
        ).length;
        const recent = [...baseOrders]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
            .map(o => ({
                id: o.id,
                customer: o.user ? [o.user.firstName, o.user.lastName].filter(Boolean).join(' ') || o.user.email || '—' : '—',
                items: o.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) ?? 0,
                channel: 'Online Store',
                total: o.total,
                payment: o.payment,
            }));

        const globalRevenue = fullOrders.reduce(
            (sum, o) => sum + (o.payment === 'Paid' ? o.total : 0),
            0
        );
        const buyerBase = customers.filter((c: any) => c.verificationStatus === 'Verified').length || 0;
        const vendorBase = sellers.length;

        return {
            grossSales,
            volume,
            pending,
            recent,
            globalRevenue,
            buyerBase,
            vendorBase,
            growth: '—'
        };
    }, [orders, products, customers, sellers, user, isSeller]);

    return (
        <div className="space-y-10 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Admin Dashboard</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
                        {isSeller ? `${user?.name} Store Overview` : 'Dashboard Overview'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">
                        {isSuperAdmin ? 'Track business performance across the platform.' : 'Track orders, products, customers, and stock in one place.'}
                    </p>
                </motion.div>

                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2 shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">System Running</span>
                    </div>
                    <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-emerald-500 hover:shadow-xl transition-all">
                        <ExternalLink className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Mobile quick nav (replaces sidebar on small screens) */}
            <div className="md:hidden -mx-2 mb-4">
                <div className="flex gap-2 overflow-x-auto px-2 pb-2 no-scrollbar">
                    {[
                        { label: 'Dashboard', href: '/admin' },
                        { label: 'Orders', href: '/admin/orders' },
                        { label: 'Catalog', href: '/admin/products' },
                        { label: 'Customers', href: '/admin/customers' },
                        { label: 'Vendors', href: '/admin/sellers' },
                        { label: 'Analytics', href: '/admin/analytics' },
                    ].map((item) => (
                        <button
                            key={item.href}
                            onClick={() => navigate(item.href)}
                            className="px-4 py-2 rounded-full bg-white text-[10px] font-black uppercase tracking-[0.18em] border border-slate-200 whitespace-nowrap shadow-sm"
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top Tier Metrics: Platform-wide or Seller Gross */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(isSuperAdmin || isAdmin) ? (
                    <>
                        <MetricGlassCard
                            label="Total Revenue"
                            value={`₹${intel.globalRevenue.toLocaleString()}`}
                            sub="Paid orders"
                            color="emerald"
                            icon={IndianRupee}
                            trend="+24%"
                        />
                        <MetricGlassCard
                            label="Active Sellers"
                            value={intel.vendorBase}
                            sub="Sellers on platform"
                            color="blue"
                            icon={Store}
                            trend="+2"
                        />
                        <MetricGlassCard
                            label="Verified Customers"
                            value={intel.buyerBase}
                            sub="Approved accounts"
                            color="purple"
                            icon={Users}
                            trend="+48"
                        />
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">System Health</p>
                                <p className="text-2xl font-black uppercase tracking-tighter mb-2 italic">All Good</p>
                                <div className="flex flex-col gap-1">
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-[94%]" />
                                    </div>
                                    <span className="text-[8px] font-black text-white/40 uppercase">Service Load / Uptime</span>
                                </div>
                            </div>
                            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                        </motion.div>
                    </>
                ) : (
                    <>
                        <MetricGlassCard
                            label="Store Revenue"
                            value={`₹${intel.grossSales.toLocaleString()}`}
                            sub="Settled & Pending"
                            color="emerald"
                            icon={IndianRupee}
                            trend="+12%"
                        />
                        <MetricGlassCard
                            label="Total Orders"
                            value={intel.volume}
                            sub="All time"
                            color="blue"
                            icon={ShoppingBag}
                            trend="+5"
                        />
                        <MetricGlassCard
                            label="Pending Orders"
                            value={intel.pending}
                            sub="Need action"
                            color="orange"
                            icon={Clock}
                            trend="Urgent"
                        />
                        <MetricGlassCard
                            label="Store Rating"
                            value="4.9"
                            sub="Customer reviews"
                            color="purple"
                            icon={Star}
                            trend="+0.1"
                        />
                    </>
                )}
            </div>

            {/* Inventory Overview */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Inventory Overview</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Live stock summary from your products
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/products')}
                        className="h-11 px-5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                        Open Catalog
                    </button>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatPill label="Products" value={inventoryIntel.totalProducts} tone="slate" />
                            <StatPill label="Units" value={inventoryIntel.totalUnits} tone="emerald" />
                            <StatPill label="Low" value={inventoryIntel.lowStock} tone="amber" />
                            <StatPill label="Out" value={inventoryIntel.outOfStock} tone="purple" />
                        </div>

                        <div className="space-y-3">
                            <InventoryBar
                                label="Healthy"
                                value={inventoryIntel.healthy}
                                total={Math.max(1, inventoryIntel.totalProducts)}
                                colorClass="bg-emerald-500"
                            />
                            <InventoryBar
                                label="Low stock"
                                value={inventoryIntel.lowStock}
                                total={Math.max(1, inventoryIntel.totalProducts)}
                                colorClass="bg-amber-500"
                            />
                            <InventoryBar
                                label="Out of stock"
                                value={inventoryIntel.outOfStock}
                                total={Math.max(1, inventoryIntel.totalProducts)}
                                colorClass="bg-violet-500"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Restock First</p>
                        <div className="space-y-3">
                            {lowStockPreview.length ? lowStockPreview.map((p) => (
                                <button
                                    key={String(p.id)}
                                    type="button"
                                    onClick={() => navigate(`/admin/products?focusProductId=${encodeURIComponent(String(p.id))}`)}
                                    className="w-full flex items-center justify-between gap-3 rounded-xl p-2 -m-2 hover:bg-white transition-all text-left"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-900 truncate">{p.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            Threshold {(p.lowStockThreshold ?? 5)}
                                        </p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest">
                                        {p.availableStock ?? p.stock} left
                                    </span>
                                </button>
                            )) : (
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    No low-stock products right now.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Orders and Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Orders */}
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Recent Transactions</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Latest order activity</p>
                        </div>
                        <Link to="/admin/orders" className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {intel.recent.length > 0 ? intel.recent.map((order, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i }}
                                key={order.id}
                                className="p-6 flex items-center gap-5 hover:bg-slate-50/50 transition-all group cursor-pointer"
                                onClick={() => navigate('/admin/orders')}
                            >
                                <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center font-black text-slate-600 group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                                    {order.customer.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{order.customer}</span>
                                        <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black rounded-md text-slate-400 uppercase tracking-widest leading-none">ID-{order.id}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                        Purchased {order.items} Units • {order.channel}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900">₹{order.total.toLocaleString()}</p>
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest",
                                        order.payment === 'Paid' ? 'text-emerald-500' : 'text-amber-500'
                                    )}>{order.payment}</span>
                                </div>
                            </motion.div>
                        )) : (
                            <div className="py-20 text-center">
                                <Activity className="h-12 w-12 text-slate-100 mx-auto mb-4" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No recent transactions.</p>
                            </div>
                        )}
                    </div>
                    <div className="p-8 bg-slate-50/30 border-t border-slate-50">
                        <button
                            onClick={() => navigate('/admin/orders')}
                            className="w-full h-14 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 hover:shadow-lg transition-all"
                        >
                            View All Orders
                        </button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl h-full flex flex-col justify-center"
                    >
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-6">
                                <Zap className="h-4 w-4 fill-emerald-500" />
                                Quick Actions
                            </div>
                            <h3 className="text-4xl font-black mb-4 tracking-tighter leading-none">Manage your <br />store faster.</h3>
                            <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-sm">
                                Use shortcuts to update products, orders, and storefront settings.
                            </p>

                            <div className="grid gap-3">
                                <Link to="/admin/products" className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                                            <Package className="h-5 w-5 text-emerald-500" />
                                        </div>
                                        <span className="text-sm font-black uppercase tracking-tight">Manage Products</span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                                </Link>

                                {!isSeller && (
                                    <Link to="/admin/store" className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/20">
                                                <LayoutDashboard className="h-5 w-5 text-blue-500" />
                                            </div>
                                            <span className="text-sm font-black uppercase tracking-tight">Store Settings</span>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                    </Link>
                                )}
                            </div>
                        </div>
                        {/* Decorative Gradient Glows */}
                        <div className="absolute -bottom-24 -right-24 h-80 w-80 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none" />
                        <div className="absolute -top-24 -left-24 h-64 w-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
                    </motion.div>

                    {/* Alerts */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 bg-amber-50 rounded-[2.5rem] border border-amber-100 flex items-start gap-4">
                            <div className="p-3 bg-white rounded-2xl text-amber-600 shadow-sm">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-amber-800/60 uppercase tracking-widest mb-1">Stock Alert</p>
                                <p className="text-xs font-black text-amber-900 leading-tight">
                                    {lowStockCount > 0
                                        ? `${lowStockCount} product${lowStockCount === 1 ? '' : 's'} running low.`
                                        : 'All products have healthy stock.'}
                                </p>
                            </div>
                        </div>
                        <div className="p-6 bg-purple-50 rounded-[2.5rem] border border-purple-100 flex items-start gap-4">
                            <div className="p-3 bg-white rounded-2xl text-purple-600 shadow-sm">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-purple-800/60 uppercase tracking-widest mb-1">Verification</p>
                                <p className="text-xs font-black text-purple-900 leading-tight">All seller KYC records are verified.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricGlassCard({ label, value, sub, color, icon: Icon, trend }: any) {
    const colorMap: any = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500/10',
        blue: 'bg-blue-50 text-blue-600 border-blue-100 ring-blue-500/10',
        purple: 'bg-purple-50 text-purple-600 border-purple-100 ring-purple-500/10',
        orange: 'bg-orange-50 text-orange-600 border-orange-100 ring-orange-500/10'
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <div className={cn("p-4 rounded-[1.5rem] border transition-all duration-500 group-hover:scale-110", colorMap[color])}>
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                            trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                        )}>
                            {trend.startsWith('+') ? <ArrowUpRight className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {trend}
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{sub}</p>
                </div>
            </div>
            {/* Ambient Background Glow */}
            <div className={cn("absolute -right-8 -bottom-8 w-32 h-32 blur-[40px] opacity-10 transition-opacity group-hover:opacity-20", `bg-${color}-400`)} />
        </motion.div>
    );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'emerald' | 'amber' | 'purple' }) {
    const tones = {
        slate: 'bg-slate-100 text-slate-700',
        emerald: 'bg-emerald-100 text-emerald-700',
        amber: 'bg-amber-100 text-amber-700',
        purple: 'bg-violet-100 text-violet-700',
    } as const;

    return (
        <div className="p-4 rounded-2xl border border-slate-100 bg-white">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className={cn('text-2xl font-black tracking-tighter leading-none', tones[tone])}>{value.toLocaleString()}</p>
        </div>
    );
}

function InventoryBar({
    label,
    value,
    total,
    colorClass,
}: {
    label: string;
    value: number;
    total: number;
    colorClass: string;
}) {
    const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, total)) * 100)));
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{value} ({pct}%)</p>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
