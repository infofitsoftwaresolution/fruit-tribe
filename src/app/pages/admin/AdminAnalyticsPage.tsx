import { useMemo, useState, useCallback } from 'react';
import { useStore } from '@/app/context/StoreContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import {
    TrendingUp, Users, Package, AlertTriangle,
    ArrowUpRight, ArrowDownRight, IndianRupee, ShoppingBag,
    ChevronRight, Info, Calendar, Download, Zap,
    Activity, Target, PieChart as PieIcon, BarChart3, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

        // Include orders within range and optional payment filter
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

        // Revenue over time: group orders by date
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
            days.forEach((d, i) => revenueData.push({ name: d, revenue: 0, orders: 0, cost: 0 }));
        }

        const catMap: Record<string, number> = {};
        products.forEach(p => {
            catMap[p.category] = (catMap[p.category] || 0) + 1;
        });
        const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

        // Best sellers: from order items aggregated by product
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
        <div className="space-y-10 pb-20">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Statistical Insight</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Growth Analytics</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Clear insights into your sales and performance.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white border border-slate-100 p-1.5 rounded-2xl flex items-center shadow-sm">
                        {['7 D', '30 D', '1 Y'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setTimeRange(t === '7 D' ? 'Last 7 Days' : t === '30 D' ? 'Last 30 Days' : 'Last Year')}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    (timeRange.includes(t.replace(' ', ''))) ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <select
                        value={orderPaymentFilter}
                        onChange={(e) => setOrderPaymentFilter(e.target.value as 'all' | 'paid' | 'unpaid')}
                        className="h-12 px-3 rounded-2xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600"
                    >
                        <option value="paid">Paid only</option>
                        <option value="all">All payments</option>
                        <option value="unpaid">Unpaid only</option>
                    </select>
                    <button
                        type="button"
                        onClick={exportAnalyticsAudit}
                        className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Audit
                    </button>
                </div>
            </div>

            {/* Metric Clusters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricNode
                    label="Gross Yield"
                    value={`₹${stats.totalRevenue.toFixed(2)}`}
                    trend={orders.length > 0 ? '+0%' : '—'}
                    icon={IndianRupee}
                    color="emerald"
                />
                <MetricNode
                    label="Basket Velocity"
                    value={`₹${stats.avgOrderValue.toFixed(2)}`}
                    trend={orders.length > 0 ? '+0%' : '—'}
                    icon={Zap}
                    color="blue"
                />
                <MetricNode
                    label="Unit Throughput"
                    value={stats.totalItemsSold}
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

            {/* Strategic Visualization Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue & Volatility Chart */}
                <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Financial Performance Flow</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Real-time revenue versus overhead simulation</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Revenue</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-slate-200" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Cost</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-10 h-[450px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.revenueData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }}
                                    dy={15}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '5 5' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#10b981"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cost"
                                    stroke="#e2e8f0"
                                    strokeWidth={2}
                                    fill="transparent"
                                    strokeDasharray="5 5"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Inventory Dynamics */}
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
                    <div>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Inventory Distribution</h3>
                                <p className="text-emerald-400/60 text-[10px] font-black uppercase tracking-widest mt-1">Classification Breakdown</p>
                            </div>
                            <PieIcon className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div className="h-[280px] w-full relative mb-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={75}
                                        outerRadius={95}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {stats.categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-4xl font-black text-white tracking-tighter">{products.length}</span>
                                <span className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest">Global SKUs</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {stats.categoryData.slice(0, 4).map((cat, i) => (
                                <div key={cat.name} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="text-xs font-black uppercase tracking-tight text-white/80">{cat.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-white">{cat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
                </div>
            </div>

            {/* Performance Ledger & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Performing Commodities */}
                <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">High-Yield Commodities</h3>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="relative md:col-span-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        value={commoditySearch}
                                        onChange={(e) => setCommoditySearch(e.target.value)}
                                        placeholder="Search commodity name/category"
                                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm"
                                    />
                                </div>
                                <select
                                    value={commodityCategoryFilter}
                                    onChange={(e) => setCommodityCategoryFilter(e.target.value)}
                                    className="h-10 px-3 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600"
                                >
                                    <option value="all">All Categories</option>
                                    {commodityCategoryOptions.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button
                            type="button"
                            title="Download commodity audit (same as Analytics Audit)"
                            onClick={exportAnalyticsAudit}
                            className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors ml-4"
                        >
                            <BarChart3 className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-8">
                        <div className="space-y-6">
                            {filteredBestSellers.map((product, idx) => (
                                <div key={product.id} className="group flex items-center gap-6 p-4 rounded-3xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                                    <div className="flex-shrink-0 relative">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-900 overflow-hidden shadow-lg group-hover:scale-110 transition-transform duration-500">
                                            <img
                                                src={getImageDisplayUrl(product.image || '') || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="56" height="56"%3E%3Crect fill="%231e293b" width="56" height="56"/%3E%3C/svg%3E'}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="absolute -top-2 -left-2 h-6 w-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md">
                                            #{idx + 1}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">{product.name}</p>
                                            <p className="text-xs font-black text-emerald-600">
                                                {formatInrCompact((product as any).revenue || 0)}
                                            </p>
                                        </div>
                                        <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${((product as any).sales / ((filteredBestSellers[0] as any)?.sales || 1)) * 100}%` }}
                                                transition={{ duration: 1, delay: 0.2 * idx }}
                                                className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{product.category}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{(product as any).sales} Units Dispatched</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredBestSellers.length === 0 && (
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No commodities match selected filters.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stock Criticality Protocol */}
                <div className="space-y-6">
                    <div className="bg-amber-50 rounded-[3rem] p-10 border border-amber-100 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="p-4 bg-white rounded-3xl w-fit shadow-sm mb-8 text-amber-600">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black text-amber-900 uppercase tracking-tight">Low stock alert</h3>
                            <p className="text-amber-800/60 text-xs font-bold mt-2 leading-relaxed">{stats.lowStockCount} product{stats.lowStockCount !== 1 ? 's' : ''} {stats.lowStockCount === 1 ? 'is' : 'are'} running low on stock. Consider reordering soon.</p>
                            <div className="relative mt-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-700/50" />
                                <input
                                    value={lowStockSearch}
                                    onChange={(e) => setLowStockSearch(e.target.value)}
                                    placeholder="Filter low stock products"
                                    className="w-full h-10 pl-8 pr-3 rounded-xl border border-amber-200 bg-white/70 text-xs font-semibold text-amber-900 placeholder:text-amber-700/60"
                                />
                            </div>

                            <div className="mt-8 space-y-4">
                                {filteredLowStockProducts.map(p => (
                                    <div key={p.id} className="p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-amber-100 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-amber-900 uppercase tracking-tight">{p.name}</span>
                                        <span className="text-[10px] font-black text-red-600 uppercase">Only {p.stock} Left</span>
                                    </div>
                                ))}
                                {filteredLowStockProducts.length === 0 && (
                                    <p className="text-[10px] font-black text-amber-900/60 uppercase tracking-widest">No low-stock items match this filter.</p>
                                )}
                            </div>

                            <button className="w-full mt-8 h-12 bg-amber-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-amber-950/20 active:scale-95">
                                Automated Restock
                            </button>
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
                    </div>

                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] flex flex-col items-center text-center">
                        <div className="h-16 w-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 mb-6">
                            <ShieldCheckIcon className="w-8 h-8" />
                        </div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">System Reliability</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 px-4 italic leading-relaxed">
                            "Data sets are curated and verified against blockchain hash-ledgers automatically."
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricNode({ label, value, trend, icon: Icon, color }: any) {
    const palette: any = {
        emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-500/20 border-emerald-100',
        blue: 'bg-blue-50 text-blue-600 ring-blue-500/20 border-blue-100',
        purple: 'bg-purple-50 text-purple-600 ring-purple-500/20 border-purple-100',
        amber: 'bg-amber-50 text-amber-600 ring-amber-500/20 border-amber-100'
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-10">
                    <div className={cn("p-4 rounded-[1.5rem] border transition-all duration-500 group-hover:scale-110", palette[color])}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                        trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' :
                            trend === 'Optimal' ? 'bg-emerald-500 text-white shadow-lg' :
                                trend === 'Review' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                    )}>
                        {trend.startsWith('+') ? <ArrowUpRight className="h-2.5 w-2.5" /> : trend === 'Optimal' ? <Activity className="h-2.5 w-2.5" /> : trend === 'Review' ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
                        {trend}
                    </div>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{value}</p>
                </div>
            </div>
            <div className={cn("absolute -right-8 -bottom-8 w-32 h-32 blur-[40px] opacity-10 transition-opacity group-hover:opacity-20", `bg-${color === 'emerald' ? 'emerald' : color === 'blue' ? 'blue' : color === 'purple' ? 'purple' : 'amber'}-400`)} />
        </motion.div>
    );
}

function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 p-5 rounded-3xl shadow-2xl border border-white/10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{label} Analysis</p>
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-8">
                        <span className="text-[10px] font-bold text-white/60">Revenue:</span>
                        <span className="text-sm font-black text-emerald-500">₹{payload[0].value.toLocaleString()}</span>
                    </div>
                </div>
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
