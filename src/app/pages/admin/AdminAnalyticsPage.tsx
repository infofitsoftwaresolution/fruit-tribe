import { useMemo, useState, useCallback } from 'react';
import { useStore } from '@/app/context/StoreContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import {
    TrendingUp, Users, Package, AlertTriangle,
    ArrowUpRight, ArrowDownRight, IndianRupee, ShoppingBag,
    Calendar, Download, Zap, Target, Search, BarChart3, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatInrCompact } from '@/lib/utils';
import { getImageDisplayUrl } from '@/lib/api';
import { toast } from 'sonner';

export function AdminAnalyticsPage() {
    const { theme } = useStore();
    const { orders, products, isInitialLoading: ordersLoading } = useAdminData();
    const [timeRange, setTimeRange] = useState<'Last 7 Days' | 'Last 30 Days' | 'Last Year'>('Last 7 Days');
    const [orderPaymentFilter, setOrderPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('paid');
    const [commodityCategoryFilter, setCommodityCategoryFilter] = useState('all');
    const [commoditySearch, setCommoditySearch] = useState('');
    const [lowStockSearch, setLowStockSearch] = useState('');

    const stats = useMemo(() => {
        const now = new Date();
        let rangeStart: Date | null = null;
        if (timeRange === 'Last 7 Days') {
            rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeRange === 'Last 30 Days') {
            rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (timeRange === 'Last Year') {
            rangeStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        }

        const filteredOrders = orders.filter((o: any) => {
            const created = o.createdAt ? new Date(o.createdAt) : null;
            if (!created) return false;
            if (rangeStart && created < rangeStart) return false;
            const isPaid = o.paymentStatus && String(o.paymentStatus).toUpperCase() === 'PAID';
            if (orderPaymentFilter === 'paid' && !isPaid) return false;
            if (orderPaymentFilter === 'unpaid' && isPaid) return false;
            return true;
        });

        const orderTotals = filteredOrders.map((o: any) => ({
            total: Number(o.payableAmount ?? o.totalAmount ?? 0),
            items: o.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) ?? 0,
            date: o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : null,
        }));
        const totalRevenue = orderTotals.reduce((sum, o) => sum + o.total, 0);
        const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
        const totalItemsSold = orderTotals.reduce((sum, o) => sum + o.items, 0);
        const lowStockCount = products.filter(p => p.stock < 10 && p.stock >= 0).length;

        const revenueByDay: Record<string, { revenue: number; orders: number }> = {};
        orderTotals.forEach((o) => {
            if (!o.date) return;
            if (!revenueByDay[o.date]) revenueByDay[o.date] = { revenue: 0, orders: 0 };
            revenueByDay[o.date].revenue += o.total;
            revenueByDay[o.date].orders += 1;
        });
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const revenueData = Object.entries(revenueByDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-7)
            .map(([dateStr, d]) => ({
                name: days[new Date(dateStr).getDay()] || dateStr.slice(5),
                revenue: d.revenue,
                orders: d.orders,
                cost: 0,
            }));
        if (revenueData.length === 0) {
            days.forEach((d) => revenueData.push({ name: d, revenue: 0, orders: 0, cost: 0 }));
        }

        const catMap: Record<string, number> = {};
        products.forEach(p => {
            catMap[p.category] = (catMap[p.category] || 0) + 1;
        });
        const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

        const productSales: Record<string, { quantity: number; revenue: number }> = {};
        filteredOrders.forEach((o: any) => {
            o.items?.forEach((item: any) => {
                const id = item.productId;
                if (!id) return;
                const key = String(id);
                if (!productSales[key]) productSales[key] = { quantity: 0, revenue: 0 };
                const qty = item.quantity || 0;
                const price = Number(item.pricePerUnit ?? 0);
                productSales[key].quantity += qty;
                productSales[key].revenue += qty * price;
            });
        });
        const bestSellers = Object.entries(productSales)
            .map(([id, d]) => {
                const p = products.find(pr => String(pr.id) === id);
                return p ? { ...p, sales: d.quantity, revenue: d.revenue } : null;
            })
            .filter(Boolean)
            .sort((a: any, b: any) => (b?.revenue ?? 0) - (a?.revenue ?? 0))
            .slice(0, 5);
        if (bestSellers.length === 0) {
            products.slice(0, 5).forEach(p => (bestSellers as any).push({ ...p, sales: 0, revenue: 0 }));
        }

        return {
            totalRevenue,
            avgOrderValue,
            totalItemsSold,
            lowStockCount,
            revenueData,
            categoryData,
            bestSellers,
            paidOrderCountInRange: filteredOrders.length,
        };
    }, [orders, products, timeRange, orderPaymentFilter]);

    const commodityCategoryOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    (stats.bestSellers as any[])
                        .map((p) => String(p?.category ?? '').trim())
                        .filter(Boolean)
                )
            ).sort((a, b) => a.localeCompare(b)),
        [stats.bestSellers]
    );

    const filteredBestSellers = useMemo(() => {
        const query = commoditySearch.trim().toLowerCase();
        return (stats.bestSellers as any[])
            .filter((p) => {
                const categoryOk = commodityCategoryFilter === 'all' || p.category === commodityCategoryFilter;
                const searchOk =
                    query.length === 0 ||
                    String(p.name ?? '').toLowerCase().includes(query) ||
                    String(p.category ?? '').toLowerCase().includes(query);
                return categoryOk && searchOk;
            })
            .slice(0, 5);
    }, [stats.bestSellers, commodityCategoryFilter, commoditySearch]);

    const filteredLowStockProducts = useMemo(() => {
        const query = lowStockSearch.trim().toLowerCase();
        return products
            .filter((p) => p.stock < 10 && p.stock >= 0)
            .filter((p) => (query.length === 0 ? true : p.name.toLowerCase().includes(query)))
            .slice(0, 3);
    }, [products, lowStockSearch]);

    const escapeCsv = (v: unknown) => {
        const s = v == null ? '' : String(v);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };

    const exportAnalyticsAudit = useCallback(() => {
        const rangeLabel = timeRange.replace(/\s+/g, '-');
        const header = ['Section', 'Key', 'Value'];
        const rows: string[][] = [
            ['Meta', 'Time range', timeRange],
            ['Meta', 'Exported at', new Date().toISOString()],
            ['Totals', 'Total revenue (paid, in range)', String(stats.totalRevenue)],
            ['Totals', 'Order count (paid, in range)', String(stats.paidOrderCountInRange)],
            ['Totals', 'Items sold (units)', String(stats.totalItemsSold)],
            ...stats.revenueData.map((d) => ['Revenue by day', d.name, String(d.revenue)]),
            ...stats.bestSellers.map((p: any, i: number) => [
                'High-yield commodity',
                `#${i + 1} ${p.name}`,
                `revenue=${p.revenue ?? 0}; units=${p.sales ?? 0}; category=${p.category ?? ''}`,
            ]),
        ];
        const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-audit-${rangeLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Analytics audit CSV downloaded');
    }, [stats, timeRange]);

    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

    return (
        <div className="space-y-6 pb-12">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="admin-page-title">Analytics</h1>
                    <p className="admin-page-subtitle">Sales performance and product insights.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
                        {['7 D', '30 D', '1 Y'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setTimeRange(t === '7 D' ? 'Last 7 Days' : t === '30 D' ? 'Last 30 Days' : 'Last Year')}
                                className={cn(
                                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                                    (timeRange.includes(t.replace(' ', ''))) ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-950 hover:bg-slate-50"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <select
                        value={orderPaymentFilter}
                        onChange={(e) => setOrderPaymentFilter(e.target.value as 'all' | 'paid' | 'unpaid')}
                        className="admin-select"
                    >
                        <option value="paid">Paid orders</option>
                        <option value="all">All orders</option>
                        <option value="unpaid">Unpaid only</option>
                    </select>
                    <button
                        type="button"
                        onClick={exportAnalyticsAudit}
                        className="admin-btn-secondary"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricNode
                    label="Total Revenue"
                    value={`₹${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    trend={orders.length > 0 ? '+0%' : '—'}
                    icon={IndianRupee}
                    color="emerald"
                />
                <MetricNode
                    label="Avg. Order Value"
                    value={`₹${stats.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    trend={orders.length > 0 ? '+0%' : '—'}
                    icon={Zap}
                    color="blue"
                />
                <MetricNode
                    label="Units Sold"
                    value={stats.totalItemsSold.toLocaleString()}
                    trend="—"
                    icon={Package}
                    color="purple"
                />
                <MetricNode
                    label="Low Stock Alerts"
                    value={stats.lowStockCount}
                    trend={stats.lowStockCount === 0 ? 'Optimal' : 'Review'}
                    icon={Target}
                    color="amber"
                />
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 admin-card flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
                        <div>
                            <h3 className="admin-section-heading">Revenue Over Time</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Daily revenue for the selected period</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="text-xs text-slate-500 font-medium">Revenue</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-slate-300" />
                                <span className="text-xs text-slate-500 font-medium">Cost</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.revenueData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                    dy={8}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '3 3' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cost"
                                    stroke="#cbd5e1"
                                    strokeWidth={1.5}
                                    fill="transparent"
                                    strokeDasharray="4 4"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Inventory Dynamics */}
                <div className="admin-card p-6 flex flex-col justify-between">
                    <div>
                        <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="admin-section-heading">Category Distribution</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Classification breakdown</p>
                            </div>
                        </div>
                        <div className="h-[200px] w-full relative my-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="#ffffff"
                                        strokeWidth={2}
                                    >
                                        {stats.categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-bold text-slate-800">{products.length}</span>
                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total SKUs</span>
                            </div>
                        </div>
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                            {stats.categoryData.slice(0, 4).map((cat, i) => (
                                <div key={cat.name} className="flex items-center justify-between p-2 px-3 bg-slate-50 hover:bg-slate-100/70 transition-colors rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="text-xs font-medium text-slate-700 capitalize">{cat.name}</span>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-900">{cat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Products */}
                <div className="lg:col-span-2 admin-card">
                    <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/20">
                        <div>
                            <h3 className="admin-section-heading">Top Selling Products</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Top high-revenue commodities</p>
                        </div>
                        <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    value={commoditySearch}
                                    onChange={(e) => setCommoditySearch(e.target.value)}
                                    placeholder="Search commodity name..."
                                    className="admin-input pl-8 h-8 text-xs"
                                />
                            </div>
                            <select
                                value={commodityCategoryFilter}
                                onChange={(e) => setCommodityCategoryFilter(e.target.value)}
                                className="admin-select h-8 text-xs py-0"
                            >
                                <option value="all">All Categories</option>
                                {commodityCategoryOptions.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="p-4 space-y-2">
                        {filteredBestSellers.map((product, idx) => (
                            <div key={product.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <div className="flex-shrink-0 relative">
                                    <div className="h-10 w-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
                                        <img
                                            src={getImageDisplayUrl(product.image || '') || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%23f1f5f9" width="40" height="40"/%3E%3C/svg%3E'}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="absolute -top-1.5 -left-1.5 h-4.5 w-4.5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-semibold border border-white shadow-sm">
                                        {idx + 1}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{product.name}</p>
                                        <p className="text-sm font-semibold text-emerald-600">
                                            {formatInrCompact((product as any).revenue || 0)}
                                        </p>
                                    </div>
                                    <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${((product as any).sales / ((filteredBestSellers[0] as any)?.sales || 1)) * 100}%` }}
                                            transition={{ duration: 0.8, delay: 0.1 * idx }}
                                            className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                                        <span className="capitalize">{product.category}</span>
                                        <span>{(product as any).sales} units sold</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredBestSellers.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-4">No commodities match the filters.</p>
                        )}
                    </div>
                </div>

                {/* Low Stock Alerts */}
                <div className="space-y-4">
                    <div className="admin-card p-5 bg-amber-50/40 border-amber-100/60 relative overflow-hidden">
                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <div>
                                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg w-fit border border-amber-100 mb-3">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <h3 className="text-sm font-bold text-amber-900">Low Stock Alert</h3>
                                <p className="text-amber-800/80 text-xs mt-1 leading-relaxed">
                                    {stats.lowStockCount} product{stats.lowStockCount !== 1 ? 's are' : ' is'} low in inventory.
                                </p>
                                <div className="relative mt-3">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-600/50" />
                                    <input
                                        value={lowStockSearch}
                                        onChange={(e) => setLowStockSearch(e.target.value)}
                                        placeholder="Filter low stock..."
                                        className="w-full h-8 pl-8 pr-3 rounded-lg border border-amber-200 bg-white/80 text-xs text-amber-950 placeholder:text-amber-600/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                                    />
                                </div>

                                <div className="mt-4 space-y-2">
                                    {filteredLowStockProducts.map(p => (
                                        <div key={p.id} className="p-2.5 bg-white/70 backdrop-blur-sm rounded-lg border border-amber-100 flex items-center justify-between text-xs">
                                            <span className="font-medium text-amber-950 truncate max-w-[120px]">{p.name}</span>
                                            <span className="font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-[10px]">
                                                Only {p.stock} left
                                            </span>
                                        </div>
                                    ))}
                                    {filteredLowStockProducts.length === 0 && (
                                        <p className="text-xs text-amber-800/60 text-center py-2">No low stock matches.</p>
                                    )}
                                </div>
                            </div>

                            <button 
                                onClick={() => toast.success('Triggered restock pipeline.')}
                                className="w-full mt-4 h-8 bg-amber-850 hover:bg-amber-900 text-white rounded-lg text-xs font-medium transition-all"
                            >
                                Initiate Restock
                            </button>
                        </div>
                    </div>

                    <div className="admin-card p-5 flex items-center justify-center gap-3">
                        <div className="h-9 w-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h4 className="text-xs font-semibold text-slate-800">System Integrity</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Records are secured and synced.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricNode({ label, value, trend, icon: Icon, color }: any) {
    const palette: any = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100'
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="admin-stat-card flex flex-col justify-between"
        >
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-2 rounded-lg border", palette[color])}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-0.5",
                        trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        trend === 'Optimal' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        trend === 'Review' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-100 text-slate-500'
                    )}>
                        {trend.startsWith('+') ? <ArrowUpRight className="h-2.5 w-2.5" /> : null}
                        {trend}
                    </div>
                </div>
                <p className="admin-stat-value text-xl">{value}</p>
                <p className="admin-stat-label">{label}</p>
            </div>
        </motion.div>
    );
}

function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-lg shadow-lg border border-slate-700 text-white">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-emerald-400 mt-1">₹{payload[0].value.toLocaleString()}</p>
            </div>
        );
    }
    return null;
}


function ShieldCheckIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040 12.02 12.02 0 003.826 8.99 12.032 12.032 0 007.592 2.972l.4 0 .4 0a12.032 12.032 0 007.592-2.972 12.02 12.02 0 003.826-8.99" />
        </svg>
    );
}
