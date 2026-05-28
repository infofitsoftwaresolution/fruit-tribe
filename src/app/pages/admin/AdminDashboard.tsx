import { useMemo, useState, useEffect, useCallback } from 'react';
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
        // For variant-backed products, variant aggregate is the source of truth.
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
        // For variant-backed products, variant aggregate is the source of truth.
        return variantStockTotal;
    }
    return productLevelStock;
}

function parsePackQtyKg(rawValue: string | null | undefined): number {
    const raw = String(rawValue || '').trim().toLowerCase();
    if (!raw) return 1;
    const m = raw.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams)\b/);
    if (!m) return 1;
    const q = Number(m[1]);
    if (!Number.isFinite(q) || q <= 0) return 1;
    const u = String(m[2]).toLowerCase();
    return ['g', 'gm', 'grams'].includes(u) ? q / 1000 : q;
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

    // Stock counters are now maintained in kg-equivalent units at write-time.
    // Dashboard should display live variant availability directly with no legacy correction.
    const getAdjustedAvailableUnits = useCallback((product: any) => getLiveAvailableUnits(product), []);

    const inventoryIntel = useMemo(() => {
        const totalProducts = products.length;
        // Total units should represent currently sellable kg-equivalent inventory after paid orders.
        const totalUnits = products.reduce((sum, p) => sum + getAdjustedAvailableUnits(p), 0);
        const outOfStock = products.filter((p) => getAdjustedAvailableUnits(p) <= 0).length;
        const lowStock = products.filter(
            (p) => getAdjustedAvailableUnits(p) > 0 && getAdjustedAvailableUnits(p) <= (p.lowStockThreshold ?? 5)
        ).length;
        const healthy = Math.max(0, totalProducts - outOfStock - lowStock);
        return { totalProducts, totalUnits, outOfStock, lowStock, healthy };
    }, [products, getAdjustedAvailableUnits]);

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
                const available = getAdjustedAvailableUnits(p);
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
            .sort((a, b) => getAdjustedAvailableUnits(a) - getAdjustedAvailableUnits(b))
            .slice(0, 8);
    }, [products, inventorySearch, inventoryVendorFilter, inventoryStockFilter, getAdjustedAvailableUnits]);

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
        <div className="space-y-8 pb-20">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <h1 className="admin-panel-page-title">
                        {isSeller ? `${user?.name}'s Dashboard` : 'Dashboard'}
                    </h1>
                    <p className="admin-panel-page-subtitle">
                        {isAdmin ? 'Platform overview — revenue, customers, and inventory at a glance.' : 'Track your store metrics, inventory health, and customer interactions.'}
                    </p>
                </motion.div>

                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/15 text-emerald-700 text-xs rounded-xl font-bold uppercase tracking-wider">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        <span>All systems operational</span>
                    </div>
                    <button
                        type="button"
                        title="Open storefront"
                        onClick={() => {
                            const base = window.location.href.split('#')[0];
                            window.open(`${base}#/`, '_blank', 'noopener,noreferrer');
                        }}
                        className="admin-panel-btn-primary"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Visit Store</span>
                    </button>
                </div>
            </div>

            {/* Mobile quick nav */}
            <div className="md:hidden -mx-4">
                <div className="flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar">
                    {[
                        { label: 'Overview', href: '/admin' },
                        { label: 'Orders', href: '/admin/orders' },
                        { label: 'Products', href: '/admin/products' },
                        { label: 'Analytics', href: '/admin/analytics' },
                    ].map((item) => (
                        <button
                            key={item.href}
                            onClick={() => navigate(item.href)}
                            className="admin-panel-btn-secondary whitespace-nowrap text-xs"
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
                            className="bg-[#09090b] rounded-2xl p-6 text-white flex flex-col justify-between shadow-sm relative overflow-hidden border border-zinc-800/80 group"
                        >
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                                    </div>
                                    <div className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold tracking-wider uppercase border border-emerald-500/15">
                                        Optimal
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Engine Health</p>
                                    <p className="text-2xl font-bold mb-3 tracking-tight group-hover:text-emerald-400 transition-colors">98.4% Uptime</p>
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
                            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-700" />
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

            {/* Inventory */}
            <div className="admin-panel-card">
                <div className="admin-panel-card-header">
                    <div>
                        <h3 className="admin-panel-section-title">Inventory</h3>
                        <p className="text-xs text-zinc-400 mt-1 font-medium">Live stock levels and supply chain status</p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/products')}
                        className="admin-panel-btn-secondary h-8 text-[11px]"
                    >
                        <span>View Catalog</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
                    <div className="xl:col-span-2 space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
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
                                colorClass="bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                            />
                            <InventoryBar
                                label="Reorder Threshold Warning"
                                value={inventoryIntel.lowStock}
                                total={Math.max(1, inventoryIntel.totalProducts)}
                                colorClass="bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                            />
                            <InventoryBar
                                label="Immediate Restock Required"
                                value={inventoryIntel.outOfStock}
                                total={Math.max(1, inventoryIntel.totalProducts)}
                                colorClass="bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                            />
                        </div>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200/50 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                        
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 opacity-40" />
                            Fast Filters
                        </p>
                        
                        <div className="space-y-3 mb-4">
                            <div className="relative">
                                <input
                                    value={inventorySearch}
                                    onChange={(e) => setInventorySearch(e.target.value)}
                                    placeholder="Search inventory..."
                                    className="admin-panel-input h-9 pr-8"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={inventoryStockFilter}
                                    onChange={(e) => setInventoryStockFilter(e.target.value as 'all' | 'low' | 'out' | 'healthy')}
                                    className="admin-panel-select h-9 text-xs py-1"
                                >
                                    <option value="all">Any Stock</option>
                                    <option value="low">Critical</option>
                                    <option value="out">Depleted</option>
                                    <option value="healthy">Stable</option>
                                </select>
                                <select
                                    value={inventoryVendorFilter}
                                    onChange={(e) => setInventoryVendorFilter(e.target.value)}
                                    className="admin-panel-select h-9 text-xs py-1"
                                >
                                    <option value="all">All Vendors</option>
                                    {inventoryVendors.map((vendor) => (
                                        <option key={vendor} value={vendor}>{vendor}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            {inventoryPreview.length ? inventoryPreview.map((p, i) => (
                                <motion.button
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    key={String(p.id)}
                                    type="button"
                                    onClick={() => navigate(`/admin/products?focusProductId=${encodeURIComponent(String(p.id))}`)}
                                    className="w-full flex items-center justify-between gap-3 rounded-xl p-3 bg-white border border-zinc-200/40 hover:border-zinc-350 hover:shadow-sm transition-all duration-300 text-left group"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-zinc-800 truncate group-hover:text-zinc-950 transition-colors">{p.name}</p>
                                        <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                                            Limit: {(p.lowStockThreshold ?? 5)} units
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={getLiveAvailableUnits(p) <= (p.lowStockThreshold ?? 5) ? 'admin-panel-badge-red' : 'admin-panel-badge-emerald'}>
                                            {getLiveAvailableUnits(p)} Units
                                        </span>
                                    </div>
                                </motion.button>
                            )) : (
                                <div className="py-10 text-center">
                                    <Activity className="h-10 w-10 text-zinc-350 mx-auto mb-3" />
                                    <p className="text-xs text-zinc-450 font-medium">No matching assets.</p>
                                    {inventoryStockFilter !== 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => setInventoryStockFilter('all')}
                                            className="mt-3 admin-panel-btn-secondary text-xs h-8"
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

            {/* Orders + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Orders */}
                <div className="admin-panel-card">
                    <div className="admin-panel-card-header">
                        <div>
                            <h3 className="admin-panel-section-title">Recent Orders</h3>
                            <p className="text-xs text-zinc-400 mt-1 font-medium">Latest order activity</p>
                        </div>
                        <Link to="/admin/orders" className="admin-panel-btn-secondary h-8 w-8 !p-0 justify-center rounded-xl">
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    
                    <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <input
                                value={orderSearch}
                                onChange={(e) => setOrderSearch(e.target.value)}
                                placeholder="Customer / Order ID..."
                                className="admin-panel-input h-9"
                            />
                            <div className="flex gap-2">
                                <select
                                    value={orderWindow}
                                    onChange={(e) => setOrderWindow(e.target.value as 'all' | 'today' | '7d' | '30d')}
                                    className="admin-panel-select h-9 text-xs py-1 flex-1"
                                >
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="7d">Last Week</option>
                                    <option value="30d">Last 30 Days</option>
                                </select>
                                <select
                                    value={orderStatusFilter}
                                    onChange={(e) => setOrderStatusFilter(e.target.value as 'all' | 'active' | 'DELIVERED' | 'CANCELLED')}
                                    className="admin-panel-select h-9 text-xs py-1 flex-1"
                                >
                                    <option value="all">Status</option>
                                    <option value="active">Active</option>
                                    <option value="DELIVERED">Delivered</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {filteredRecentOrders.length > 0 ? filteredRecentOrders.map((order: any, i: number) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 * i }}
                                    key={order.id}
                                    className="p-3.5 flex items-center gap-4 border border-zinc-200/40 hover:border-zinc-350 rounded-xl hover:bg-zinc-50/50 transition-all duration-300 group cursor-pointer"
                                    onClick={() => navigate('/admin/orders')}
                                >
                                    <div className="h-9 w-9 rounded-xl bg-zinc-100 border border-zinc-200/40 flex items-center justify-center font-semibold text-zinc-500 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-300 text-xs">
                                        {order.customer.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-zinc-800 truncate">{order.customer}</span>
                                            <span className="text-xs text-zinc-400 font-medium">
                                                {order.orderNumber ? `#${order.orderNumber}` : `ID-${order.id.slice(0,6)}`}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5 font-medium">
                                            <span>{order.items} Items</span>
                                            <span className="h-1 w-1 rounded-full bg-zinc-300" />
                                            <span>{new Date(order.date).toLocaleDateString()}</span>
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold text-zinc-900 tracking-tight">₹{order.total.toLocaleString()}</p>
                                        <span className={cn(
                                            "mt-1",
                                            order.payment === 'Paid' ? 'admin-panel-badge-emerald' : 'admin-panel-badge-amber'
                                        )}>
                                            {order.payment}
                                        </span>
                                    </div>
                                </motion.div>
                            )) : (
                                <div className="py-16 text-center">
                                    <ShoppingCart className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                                    <p className="text-sm text-zinc-450 font-medium">No orders found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                    <div className="admin-panel-card p-6 bg-[#09090b] text-white border-zinc-800/80">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                                <Zap className="h-4 w-4 text-emerald-400" />
                            </div>
                            <h3 className="text-base font-bold text-white tracking-tight">Quick Actions</h3>
                        </div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-5">Jump to common tasks</p>

                        <div className="space-y-2">
                            <button onClick={() => navigate('/admin/products')} className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-zinc-700/50 transition-all duration-350 ease-out group">
                                <div className="flex items-center gap-3">
                                    <Package className="h-4 w-4 text-emerald-400" />
                                    <span className="text-sm font-medium text-white">Manage Inventory</span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                            </button>

                            {!isSeller && (
                                <button onClick={() => navigate('/admin/store')} className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-zinc-700/50 transition-all duration-350 ease-out group">
                                    <div className="flex items-center gap-3">
                                        <LayoutDashboard className="h-4 w-4 text-blue-400" />
                                        <span className="text-sm font-medium text-white">Curation Space</span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status alerts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3.5 p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                            <div className="p-2 bg-amber-500/10 border border-amber-500/15 rounded-xl text-amber-700 flex-shrink-0">
                                <AlertCircle className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-0.5">Stock Alert</p>
                                <p className="text-xs text-amber-900/80 font-medium leading-relaxed">
                                    {lowStockCount > 0
                                        ? `${lowStockCount} SKU${lowStockCount === 1 ? '' : 's'} need restocking.`
                                        : 'All stock levels are healthy.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3.5 p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <div className="p-2 bg-emerald-500/10 border border-emerald-500/15 rounded-xl text-emerald-700 flex-shrink-0">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-0.5">Security</p>
                                <p className="text-xs text-emerald-900/80 font-medium leading-relaxed">Platform security protocols verified.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricGlassCard({ label, value, sub, color, icon: Icon, trend }: any) {
    const iconColorMap: any = {
        emerald: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/15',
        blue: 'bg-blue-500/10 text-blue-700 border border-blue-500/15',
        purple: 'bg-purple-500/10 text-purple-700 border border-purple-500/15',
        orange: 'bg-orange-500/10 text-orange-700 border border-orange-500/15'
    };

    return (
        <div className="admin-panel-stat-card">
            <div className="flex items-start justify-between mb-4">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", iconColorMap[color])}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <span className={cn(
                        "admin-panel-badge text-[10px]",
                        trend.startsWith('+') || color === 'emerald' ? 'admin-panel-badge-emerald' : 'admin-panel-badge-amber'
                    )}>
                        {trend.startsWith('+') ? <ArrowUpRight className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        {trend}
                    </span>
                )}
            </div>
            <p className="admin-panel-stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            <p className="admin-panel-stat-label">{label}</p>
            {sub && <p className="text-xs text-zinc-400 mt-1 font-medium">{sub}</p>}
        </div>
    );
}

function StatPill({ label, value, tone, icon: Icon }: { label: string; value: number; tone: 'slate' | 'emerald' | 'amber' | 'purple'; icon: any }) {
    const tones = {
        slate: 'bg-white border-zinc-200/50',
        emerald: 'bg-emerald-500/5 border-emerald-500/10',
        amber: 'bg-amber-500/5 border-amber-500/10',
        purple: 'bg-purple-500/5 border-purple-500/10',
    } as const;

    const iconColors = {
        slate: 'text-zinc-400',
        emerald: 'text-emerald-600',
        amber: 'text-amber-600',
        purple: 'text-purple-600',
    } as const;

    const valueColors = {
        slate: 'text-zinc-900',
        emerald: 'text-emerald-950',
        amber: 'text-amber-950',
        purple: 'text-purple-950',
    } as const;

    return (
        <div className={cn("p-4 rounded-xl border transition-all duration-300 hover:shadow-sm hover:border-zinc-300", tones[tone])}>
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-zinc-500">{label}</p>
                <Icon className={cn("w-4 h-4", iconColors[tone])} />
            </div>
            <p className={cn("text-xl font-bold tracking-tight", valueColors[tone])}>{value.toLocaleString()}</p>
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
    const itemLabel = value === 1 ? 'product' : 'products';
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-zinc-600">{label}</p>
                <p className="text-xs text-zinc-500 font-medium">
                    {value} {itemLabel}
                    <span className="text-zinc-400 ml-1">({pct}%)</span>
                </p>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn('h-full rounded-full', colorClass)}
                />
            </div>
        </div>
    );
}
