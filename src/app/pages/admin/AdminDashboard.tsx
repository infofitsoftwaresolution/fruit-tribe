import { useMemo, useState, useEffect } from 'react';
import {
    ChevronRight, Users, Store, TrendingUp, AlertCircle,
    Package, ArrowUpRight, ArrowDownRight, IndianRupee,
    ShoppingBag, Clock, ShieldCheck, Zap, LayoutDashboard,
    ArrowRight, Star, ExternalLink, Activity, Ban, Search,
    ShoppingCart
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AdminStatsSkeleton } from '@/app/components/admin/AdminTableSkeleton';
import { toast } from 'sonner';

function getLiveAvailableUnits(product: any): number {
    const productLevelAvailable = Number(product?.availableStock ?? product?.stock ?? 0);
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (variants.length > 0) {
        const variantTotal = variants.reduce(
            (sum: number, v: any) => sum + Number(v?.availableStock ?? v?.stock ?? 0),
            0
        );
        // Prefer a conservative inventory number when top-level and variant stock drift.
        if (Number.isFinite(productLevelAvailable) && productLevelAvailable >= 0) {
            return Math.min(productLevelAvailable, variantTotal);
        }
        return variantTotal;
    }
    return productLevelAvailable;
}

function getLiveStockUnits(product: any): number {
    const productLevelStock = Number(product?.stock ?? 0);
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (variants.length > 0) {
        const variantStockTotal = variants.reduce(
            (sum: number, v: any) => sum + Number(v?.stock ?? 0),
            0
        );
        if (Number.isFinite(productLevelStock) && productLevelStock >= 0) {
            return Math.min(productLevelStock, variantStockTotal);
        }
        return variantStockTotal;
    }
    return productLevelStock;
}

export function AdminDashboard() {
    const { theme } = useStore();
    const { user } = useAuth();
    const navigate = useNavigate();
    const {
        orders,
        customers,
        sellers,
        products,
        isInitialLoading: adminBootLoading,
        refreshOrders,
        refreshProducts,
    } = useAdminData();

    const isAdmin = user?.role === 'admin';
    const isSeller = user?.role === 'seller';
    const [inventorySearch, setInventorySearch] = useState('');
    const [inventoryVendorFilter, setInventoryVendorFilter] = useState('all');
    const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'low' | 'out' | 'healthy'>('all');
    const [orderSearch, setOrderSearch] = useState('');
    const [orderPaymentFilter, setOrderPaymentFilter] = useState<'all' | 'Paid' | 'Pending'>('all');
    const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'DELIVERED' | 'CANCELLED'>('all');
    const [orderWindow, setOrderWindow] = useState<'all' | 'today' | '7d' | '30d'>('7d');

    const lowStockCount = useMemo(
        () => products.filter((p) => {
            const available = getLiveAvailableUnits(p);
            return available < (p.lowStockThreshold ?? 5) && available > 0;
        }).length,
        [products]
    );

    const inventoryIntel = useMemo(() => {
        const totalProducts = products.length;
        const totalUnits = products.reduce((sum, p) => sum + getLiveStockUnits(p), 0);
        const outOfStock = products.filter((p) => getLiveAvailableUnits(p) <= 0).length;
        const lowStock = products.filter(
            (p) => getLiveAvailableUnits(p) > 0 && getLiveAvailableUnits(p) <= (p.lowStockThreshold ?? 5)
        ).length;
        const healthy = Math.max(0, totalProducts - outOfStock - lowStock);
        return { totalProducts, totalUnits, outOfStock, lowStock, healthy };
    }, [products]);

    const inventoryVendors = useMemo(
        () =>
            Array.from(
                new Set(
                    products
                        .map((p) => String(p.vendor || '').trim())
                        .filter(Boolean)
                )
            ).sort((a, b) => a.localeCompare(b)),
        [products]
    );

    const inventoryPreview = useMemo(() => {
        const query = inventorySearch.trim().toLowerCase();
        return products
            .filter((p) => {
                const available = getLiveAvailableUnits(p);
                const threshold = p.lowStockThreshold ?? 5;
                const isLow = available > 0 && available <= threshold;
                const isOut = available <= 0;
                const isHealthy = available > threshold;
                const stockOk =
                    inventoryStockFilter === 'all'
                        ? true
                        : inventoryStockFilter === 'low'
                          ? isLow
                          : inventoryStockFilter === 'out'
                            ? isOut
                            : isHealthy;
                const vendorOk =
                    inventoryVendorFilter === 'all' ||
                    String(p.vendor || '').trim().toLowerCase() === String(inventoryVendorFilter || '').trim().toLowerCase();
                const searchOk =
                    query.length === 0 ||
                    String(p.name ?? '').toLowerCase().includes(query) ||
                    String(p.sku ?? '').toLowerCase().includes(query) ||
                    String(p.vendor ?? '').toLowerCase().includes(query);
                return stockOk && vendorOk && searchOk;
            })
            .sort((a, b) => getLiveAvailableUnits(a) - getLiveAvailableUnits(b))
            .slice(0, 8);
    }, [products, inventorySearch, inventoryVendorFilter, inventoryStockFilter]);

        const intel = useMemo(() => {
        const fullOrders = orders.map((o: any) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            total: Number(o.payableAmount ?? o.totalAmount ?? 0),
            payment: o.paymentStatus === 'PAID' ? 'Paid' : 'Pending',
            paymentStatus: String(o.paymentStatus ?? '').toUpperCase(),
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
            .map(o => ({
                id: o.id,
                orderNumber: o.orderNumber,
                customer: o.user ? [o.user.firstName, o.user.lastName].filter(Boolean).join(' ') || o.user.email || '—' : '—',
                items: o.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) ?? 0,
                channel: 'Online Store',
                total: o.total,
                payment: o.payment,
                status: o.status,
                date: o.date,
            }));

        const globalRevenue = fullOrders.reduce(
            (sum, o) => {
                const isPaid = o.paymentStatus === 'PAID';
                const isRefunded = o.paymentStatus === 'REFUNDED';
                return sum + (isPaid && !isRefunded ? o.total : 0);
            },
            0
        );
        const paidOrders = fullOrders.filter((o) => o.paymentStatus === 'PAID').length;
        const buyerBase = customers.filter((c: any) => c.verificationStatus === 'Verified').length || 0;
        const vendorBase = sellers.length;

        return {
            grossSales,
            volume,
            pending,
            recent,
            globalRevenue,
            paidOrders,
            buyerBase,
            vendorBase,
            growth: '—'
        };
    }, [orders, products, customers, sellers, user, isSeller]);

    const filteredRecentOrders = useMemo(() => {
        const query = orderSearch.trim().toLowerCase();
        const now = Date.now();
        return intel.recent
            .filter((o: any) => {
                const paymentOk = orderPaymentFilter === 'all' || o.payment === orderPaymentFilter;
                const statusOk =
                    orderStatusFilter === 'all'
                        ? true
                        : orderStatusFilter === 'active'
                          ? o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
                          : o.status === orderStatusFilter;
                const timeOk =
                    orderWindow === 'all'
                        ? true
                        : (() => {
                              const ts = new Date(o.date).getTime();
                              if (Number.isNaN(ts)) return false;
                              if (orderWindow === 'today') {
                                  const d = new Date();
                                  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                                  return ts >= start;
                              }
                              const diff = now - ts;
                              const max = orderWindow === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
                              return diff <= max;
                          })();
                const searchOk =
                    query.length === 0 ||
                    String(o.customer).toLowerCase().includes(query) ||
                    String(o.id).toLowerCase().includes(query) ||
                    String(o.orderNumber ?? '').toLowerCase().includes(query);
                return paymentOk && statusOk && timeOk && searchOk;
            })
            .slice(0, 8);
    }, [intel.recent, orderSearch, orderPaymentFilter, orderStatusFilter, orderWindow]);

    // Keep dashboard KPIs fresh so stock/revenue counters reflect new sales quickly.
    useEffect(() => {
        const refresh = () => {
            void Promise.allSettled([refreshOrders(), refreshProducts()]);
        };
        refresh();
        const id = window.setInterval(refresh, 10000);
        return () => window.clearInterval(id);
    }, [refreshOrders, refreshProducts]);

    return (
        <div className="space-y-12 pb-20 font-sans relative">
            {/* Header with improved typography and layout */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-emerald-600" />
                        </div>
                        <span className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.25em] opacity-80">Command Hub</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter font-heading">
                        {isSeller ? `${user?.name} Console` : 'Platform Pulse'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-3 max-w-xl leading-relaxed font-medium">
                        {isAdmin ? 'Real-time performance analytics and operational control for your orchard ecosystem.' : 'Track your store metrics, inventory health, and customer interactions.'}
                    </p>
                </motion.div>

                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-3 px-5 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">System Healthy</span>
                    </div>
                    <button
                        type="button"
                        title="Open storefront"
                        onClick={() => {
                            const base = window.location.href.split('#')[0];
                            window.open(`${base}#/`, '_blank', 'noopener,noreferrer');
                        }}
                        className="h-11 px-5 bg-slate-900 border border-slate-800 rounded-xl text-white hover:bg-emerald-600 hover:border-emerald-500 hover:shadow-lg transition-all duration-500 flex items-center gap-2 group"
                    >
                        <span className="text-[9px] font-black uppercase tracking-widest">Visit Store</span>
                        <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Mobile quick nav refinement */}
            <div className="md:hidden -mx-4">
                <div className="flex gap-3 overflow-x-auto px-4 pb-4 no-scrollbar">
                    {[
                        { label: 'Overview', href: '/admin' },
                        { label: 'Orders', href: '/admin/orders' },
                        { label: 'Products', href: '/admin/products' },
                        { label: 'Analytics', href: '/admin/analytics' },
                    ].map((item) => (
                        <button
                            key={item.href}
                            onClick={() => navigate(item.href)}
                            className="px-6 py-3 rounded-2xl bg-white text-[10px] font-black uppercase tracking-widest border border-slate-100 whitespace-nowrap shadow-sm active:scale-95 transition-all"
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top Tier Metrics: Platform-wide or Seller Gross */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {adminBootLoading ? (
                    <div className="lg:col-span-4">
                        <AdminStatsSkeleton cards={4} />
                    </div>
                ) : isAdmin ? (
                    <>
                        <MetricGlassCard
                            label="Collected Revenue"
                            value={`₹${intel.globalRevenue.toLocaleString()}`}
                            sub="Paid orders total"
                            color="emerald"
                            icon={IndianRupee}
                            trend={`${intel.paidOrders} paid`}
                        />
                        <MetricGlassCard
                            label="Active Merchants"
                            value={intel.vendorBase}
                            sub="Verified vendors"
                            color="blue"
                            icon={Store}
                        />
                        <MetricGlassCard
                            label="Total Customers"
                            value={intel.buyerBase}
                            sub="Verified users"
                            color="purple"
                            icon={Users}
                        />
                        <motion.div
                            whileHover={{ y: -4, scale: 1.01 }}
                            className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between shadow-xl relative overflow-hidden border border-white/5 group"
                        >
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                                        <Zap className="w-6 h-6 text-emerald-400 fill-emerald-400/20" />
                                    </div>
                                    <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                                        Optimal
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1 italic">Engine Health</p>
                                    <p className="text-2xl font-black tracking-tighter mb-3 uppercase italic group-hover:text-emerald-400 transition-colors">98.4% Uptime</p>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: '98%' }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Decorative Background Elements */}
                            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-700" />
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
                            trend="+12.4%"
                        />
                        <MetricGlassCard
                            label="Total Orders"
                            value={intel.volume}
                            sub="Cumulative sales"
                            color="blue"
                            icon={ShoppingBag}
                            trend="+15"
                        />
                        <MetricGlassCard
                            label="Pending Action"
                            value={intel.pending}
                            sub="Orders to ship"
                            color="orange"
                            icon={Clock}
                            trend="High Priority"
                        />
                        <MetricGlassCard
                            label="Merchant Rating"
                            value="4.95"
                            sub="From 240 reviews"
                            color="purple"
                            icon={Star}
                            trend="+0.05"
                        />
                    </>
                )}
            </div>

            {/* Inventory Pulse */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-premium overflow-hidden group">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight font-heading">Inventory Hub</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 opacity-80">
                            Live supply chain and stock metrics
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/products')}
                        className="h-11 px-6 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-900 uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-xl transition-all duration-500 flex items-center gap-2"
                    >
                        <span>Full Catalog</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="xl:col-span-2 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatPill label="Product Lines" value={inventoryIntel.totalProducts} tone="slate" icon={Package} />
                            <StatPill label="Total Units" value={inventoryIntel.totalUnits} tone="emerald" icon={Zap} />
                            <StatPill label="Low Supply" value={inventoryIntel.lowStock} tone="amber" icon={AlertCircle} />
                            <StatPill label="Sold Out" value={inventoryIntel.outOfStock} tone="purple" icon={Ban} />
                        </div>

                        <div className="space-y-6 pt-4">
                            <InventoryBar
                                label="Healthy Stock Levels"
                                value={inventoryIntel.healthy}
                                total={Math.max(1, inventoryIntel.totalProducts)}
                                colorClass="bg-emerald-500"
                            />
                            <InventoryBar
                                label="Reorder Threshold Warning"
                                value={inventoryIntel.lowStock}
                                total={Math.max(1, inventoryIntel.totalProducts)}
                                colorClass="bg-amber-500"
                            />
                            <InventoryBar
                                label="Immediate Restock Required"
                                value={inventoryIntel.outOfStock}
                                total={Math.max(1, inventoryIntel.totalProducts)}
                                colorClass="bg-red-500"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-6 relative overflow-hidden shadow-inner">
                        <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                        
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 opacity-40" />
                            Fast Filters
                        </p>
                        
                        <div className="space-y-3 mb-6">
                            <div className="relative">
                                <input
                                    value={inventorySearch}
                                    onChange={(e) => setInventorySearch(e.target.value)}
                                    placeholder="SKU, Name, or Vendor..."
                                    className="w-full h-10 pl-4 pr-4 rounded-xl border border-slate-200 bg-white text-[10px] font-bold text-slate-900 placeholder:text-slate-400 placeholder:uppercase placeholder:tracking-widest focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={inventoryStockFilter}
                                    onChange={(e) => setInventoryStockFilter(e.target.value as 'all' | 'low' | 'out' | 'healthy')}
                                    className="h-10 px-2 rounded-xl border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-600 focus:outline-none"
                                >
                                    <option value="all">Any Stock</option>
                                    <option value="low">Critical</option>
                                    <option value="out">Depleted</option>
                                    <option value="healthy">Stable</option>
                                </select>
                                <select
                                    value={inventoryVendorFilter}
                                    onChange={(e) => setInventoryVendorFilter(e.target.value)}
                                    className="h-10 px-2 rounded-xl border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-600 focus:outline-none"
                                >
                                    <option value="all">All Vendors</option>
                                    {inventoryVendors.map((vendor) => (
                                        <option key={vendor} value={vendor}>{vendor}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                            {inventoryPreview.length ? inventoryPreview.map((p, i) => (
                                <motion.button
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    key={String(p.id)}
                                    type="button"
                                    onClick={() => navigate(`/admin/products?focusProductId=${encodeURIComponent(String(p.id))}`)}
                                    className="w-full flex items-center justify-between gap-3 rounded-xl p-3 bg-white border border-slate-100 hover:border-emerald-500/50 hover:shadow-lg transition-all duration-300 text-left group"
                                >
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight group-hover:text-emerald-600 transition-colors">{p.name}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                            Limit: {(p.lowStockThreshold ?? 5)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn(
                                            "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                            getLiveAvailableUnits(p) <= (p.lowStockThreshold ?? 5) ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        )}>
                                            {getLiveAvailableUnits(p)} Units
                                        </span>
                                    </div>
                                </motion.button>
                            )) : (
                                <div className="py-10 text-center">
                                    <Activity className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching assets.</p>
                                    {inventoryStockFilter !== 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => setInventoryStockFilter('all')}
                                            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all"
                                        >
                                            Show Any Stock
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Orders and Command Center */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Recent Orders Refined */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-premium overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight font-heading">Transactions</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 opacity-80">Latest order activity pipeline</p>
                        </div>
                        <Link to="/admin/orders" className="h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all duration-500 shadow-sm">
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    
                    <div className="p-5 md:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                            <input
                                value={orderSearch}
                                onChange={(e) => setOrderSearch(e.target.value)}
                                placeholder="Customer / Order ID..."
                                className="w-full h-10 px-4 rounded-xl border border-slate-200 bg-white text-[10px] font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                            />
                            <div className="flex gap-2">
                                <select
                                    value={orderWindow}
                                    onChange={(e) => setOrderWindow(e.target.value as 'all' | 'today' | '7d' | '30d')}
                                    className="flex-1 h-10 px-2 rounded-xl border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-600 focus:outline-none"
                                >
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="7d">Last Week</option>
                                </select>
                                <select
                                    value={orderStatusFilter}
                                    onChange={(e) => setOrderStatusFilter(e.target.value as 'all' | 'active' | 'DELIVERED' | 'CANCELLED')}
                                    className="flex-1 h-10 px-2 rounded-xl border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-600 focus:outline-none"
                                >
                                    <option value="all">Status</option>
                                    <option value="active">Active</option>
                                    <option value="DELIVERED">Delivered</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {filteredRecentOrders.length > 0 ? filteredRecentOrders.map((order: any, i: number) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 * i }}
                                    key={order.id}
                                    className="p-4 flex items-center gap-4 border border-slate-50 hover:border-emerald-500/30 rounded-2xl hover:bg-slate-50/50 transition-all group cursor-pointer"
                                    onClick={() => navigate('/admin/orders')}
                                >
                                    <div className="h-11 w-11 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center font-black text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all duration-700 text-base">
                                        {order.customer.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{order.customer}</span>
                                            <span className="px-2.5 py-1 bg-slate-100 text-[9px] font-black rounded-lg text-slate-500 uppercase tracking-widest">
                                                {order.orderNumber ? `#${order.orderNumber}` : `ID-${order.id.slice(0,6)}`}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                                            {order.items} Items <span className="h-0.5 w-0.5 rounded-full bg-slate-200" /> {new Date(order.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[14px] font-black text-slate-900">₹{order.total.toLocaleString()}</p>
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                            order.payment === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                        )}>
                                            <div className={cn("h-1.5 w-1.5 rounded-full", order.payment === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500')} />
                                            {order.payment}
                                        </div>
                                    </div>
                                </motion.div>
                            )) : (
                                <div className="py-20 text-center bg-slate-50/30 rounded-[2.5rem] border border-dashed border-slate-200">
                                    <ShoppingCart className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No transactions found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Command Center with Gradient Design */}
                <div className="space-y-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl h-full flex flex-col justify-center min-h-[400px]"
                    >
                        {/* Animated Gradient Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 opacity-90" />
                        <div className="absolute -top-40 -right-40 h-96 w-96 bg-emerald-500/20 rounded-full blur-[120px] animate-pulse" />
                        <div className="absolute -bottom-40 -left-40 h-96 w-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />

                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] mb-6 shadow-lg shadow-emerald-500/5">
                                <Zap className="h-3.5 w-3.5 fill-emerald-500 animate-bounce" />
                                Rapid Access
                            </div>
                            <h3 className="text-3xl font-black mb-4 tracking-tighter leading-none font-heading italic uppercase">Streamline your <br /><span className="text-emerald-400">operations.</span></h3>
                            <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-xs font-medium opacity-80">
                                High-frequency controls to manage your digital inventory and customer logistics with surgical precision.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={() => navigate('/admin/products')} className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-emerald-500/30 transition-all group backdrop-blur-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10">
                                            <Package className="h-5 w-5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Inventory</span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-500 group-hover:translate-x-1.5 transition-all duration-500" />
                                </button>

                                {!isSeller && (
                                    <button onClick={() => navigate('/admin/store')} className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all group backdrop-blur-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10">
                                                <LayoutDashboard className="h-5 w-5" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Storefront</span>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1.5 transition-all duration-500" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Notification Nodes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <motion.div whileHover={{ y: -4 }} className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-4 shadow-sm hover:shadow-lg transition-all duration-500">
                            <div className="p-3 bg-white rounded-xl text-amber-600 shadow-md shadow-amber-900/5">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-amber-800/50 uppercase tracking-widest mb-1.5 italic">Supply Warning</p>
                                <p className="text-[13px] font-black text-amber-900 leading-tight">
                                    {lowStockCount > 0
                                        ? `${lowStockCount} SKU${lowStockCount === 1 ? '' : 's'} flagged for restock.`
                                        : 'Orchard supplies are fully optimal.'}
                                </p>
                            </div>
                        </motion.div>
                        <motion.div whileHover={{ y: -4 }} className="p-6 bg-purple-50 rounded-3xl border border-purple-100 flex items-start gap-4 shadow-sm hover:shadow-lg transition-all duration-500">
                            <div className="p-3 bg-white rounded-xl text-purple-600 shadow-md shadow-purple-900/5">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-purple-800/50 uppercase tracking-widest mb-1.5 italic">Integrity Check</p>
                                <p className="text-[13px] font-black text-purple-900 leading-tight">Platform security protocols are verified.</p>
                            </div>
                        </motion.div>
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
            whileHover={{ y: -6, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500"
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className={cn("p-4 rounded-xl border transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 shadow-lg", colorMap[color])}>
                        <Icon className="w-5 h-5" />
                    </div>
                    {trend && (
                        <div className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 border",
                            trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                        )}>
                            {trend.startsWith('+') ? <ArrowUpRight className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {trend}
                        </div>
                    )}
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 italic opacity-80">{label}</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1.5 leading-none font-heading">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-60">{sub}</p>
                </div>
            </div>
            
            {/* Background Ambient Glow */}
            <div className={cn(
                "absolute -right-12 -bottom-12 w-32 h-32 blur-[50px] opacity-10 transition-all duration-700 group-hover:opacity-30 group-hover:scale-150",
                `bg-${color}-500`
            )} />
        </motion.div>
    );
}

function StatPill({ label, value, tone, icon: Icon }: { label: string; value: number; tone: 'slate' | 'emerald' | 'amber' | 'purple'; icon: any }) {
    const tones = {
        slate: 'bg-slate-50 text-slate-900 border-slate-100',
        emerald: 'bg-emerald-50 text-emerald-900 border-emerald-100',
        amber: 'bg-amber-50 text-amber-900 border-amber-100',
        purple: 'bg-violet-50 text-violet-900 border-violet-100',
    } as const;

    const iconColors = {
        slate: 'text-slate-400',
        emerald: 'text-emerald-500',
        amber: 'text-amber-500',
        purple: 'text-violet-500',
    } as const;

    return (
        <motion.div 
            whileHover={{ y: -4 }}
            className={cn("p-5 rounded-2xl border relative overflow-hidden group transition-all duration-500", tones[tone])}
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] opacity-50">{label}</p>
                    <Icon className={cn("w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity", iconColors[tone])} />
                </div>
                <p className="text-2xl font-black tracking-tighter leading-none font-heading">{value.toLocaleString()}</p>
            </div>
            <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div>
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
    const itemLabel = value === 1 ? 'product' : 'products';
    return (
        <div className="group">
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Real-time</span>
                </div>
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                    {value} {itemLabel} <span className="text-slate-300 ml-1">/ {pct}%</span>
                </p>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-50 shadow-inner">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn('h-full rounded-full shadow-sm', colorClass)} 
                />
            </div>
        </div>
    );
}
