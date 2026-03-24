import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useStore, Order, Product } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { getOrders, updateOrderStatus, getDeliveryPartners, assignDeliveryPartner } from '@/lib/api';
import { useProducts } from '@/app/hooks/useProducts';
import {
    Plus, Search, Filter, MoreHorizontal, ArrowUpDown, X,
    Printer, Truck, User, Calendar, CreditCard, Package,
    ChevronRight, ExternalLink, MapPin, Phone, Mail, Clock,
    CheckCircle2, AlertCircle, ShoppingBag, TrendingUp, Info,
    Activity, Zap, ShieldCheck, Box, Download, MoreVertical,
    FileText, Eye, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, getRoundedClass } from '@/lib/utils';

export function AdminOrdersPage() {
    const { updateOrder, theme } = useStore();
    const { user } = useAuth();
    const location = useLocation();
    const { products: productsFromApi } = useProducts({ limit: 100 });
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [formData, setFormData] = useState({
        customer: '',
        status: 'Created' as Order['status'],
        payment: 'Pending' as Order['payment'],
        fulfillment: 'Unfulfilled' as Order['fulfillment'],
        selectedProducts: [] as { productId: string | number; quantity: number }[]
    });

    const [activeTab, setActiveTab] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [deliveryPartners, setDeliveryPartners] = useState<Array<{ id: string; name: string }>>([]);

    const products = productsFromApi;

    function mapApiOrderToOrder(api: any): Order {
        const userName = api.user ? [api.user.firstName, api.user.lastName].filter(Boolean).join(' ') || api.user.email : '—';
        const statusMap: Record<string, Order['status']> = {
            CREATED: 'Created', CONFIRMED: 'Confirmed', PACKED: 'Packed', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
        };
        const paymentMap: Record<string, Order['payment']> = {
            PAID: 'Paid', PENDING: 'Pending', REFUNDED: 'Refunded',
        };
        const itemCount = api.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) ?? 0;
        const firstDelivery = (api.deliveries || [])[0] || null;
        const courierName: string | null = firstDelivery?.deliveryPartner?.name ?? null;
        const vendorNames = Array.from(
            new Set(
                (api.items || [])
                    .map((i: any) => i?.seller?.storeName)
                    .filter((v: unknown) => typeof v === 'string' && (v as string).trim().length > 0)
            )
        ) as string[];

        return {
            id: api.id,
            orderNumber: api.orderNumber,
            customer: userName,
            items: itemCount,
            date: api.createdAt ? new Date(api.createdAt).toLocaleDateString() : '—',
            total: Number(api.payableAmount ?? api.totalAmount ?? 0),
            payment: paymentMap[api.paymentStatus] || 'Pending',
            fulfillment: api.status === 'DELIVERED' ? 'Fulfilled' : 'Unfulfilled',
            status: statusMap[api.status] || 'Created',
            channel: 'Online Store',
            itemsDetails: api.items?.map((i: any) => ({ productId: i.productId, quantity: i.quantity })) ?? [],
            shippingAddress: api.shippingAddress || null,
            courierName,
            vendorNames,
        } as any;
    }

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get('search') || '';
        setSearchQuery(q);
    }, [location.search]);

    useEffect(() => {
        let cancelled = false;
        getOrders()
            .then((data) => { if (!cancelled) setOrders((data || []).map(mapApiOrderToOrder)); })
            .catch(() => { if (!cancelled) toast.error('Failed to load orders'); })
            .finally(() => { if (!cancelled) setOrdersLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Load delivery partners for admin so they can assign riders
    useEffect(() => {
        let cancelled = false;
        if (user?.role !== 'admin' && user?.role !== 'ADMIN') return;
        getDeliveryPartners()
            .then((list) => {
                if (!cancelled) {
                    setDeliveryPartners((list || []).map((p: any) => ({ id: p.id, name: p.name })));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setDeliveryPartners([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [user]);

    const displayedOrders = useMemo(() => {
        let filtered = orders;
        if (user?.role === 'seller' || user?.role === 'SELLER') {
            filtered = orders.filter(order => {
                return order.itemsDetails?.some(item => {
                    const product = products.find(p => p.id === item.productId || p.id === String(item.productId));
                    return product?.vendor === (user as any).name;
                });
            });
        }
        return filtered.filter(order => {
            const matchesSearch =
                order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.id.includes(searchQuery) ||
                (order.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (((order as any).vendorNames || []) as string[]).some((v) =>
                    v.toLowerCase().includes(searchQuery.toLowerCase())
                );
            if (!matchesSearch) return false;
            switch (activeTab) {
                case 'Unfulfilled': return order.fulfillment === 'Unfulfilled';
                case 'Unpaid': return order.payment === 'Pending';
                case 'Open': return order.status !== 'Delivered' && order.status !== 'Cancelled';
                case 'Closed': return order.status === 'Delivered' || order.status === 'Cancelled';
                default: return true;
            }
        });
    }, [orders, activeTab, searchQuery, user, products]);

    const stats = useMemo(() => {
        const baseOrders = orders;
        const activePipeline = baseOrders.filter(
            (o) => o.status !== 'Delivered' && o.status !== 'Cancelled'
        );
        const stagingArea = activePipeline.filter((o) => o.fulfillment === 'Unfulfilled');
        const revenue = baseOrders.reduce(
            (sum, o) => sum + (o.payment === 'Paid' ? o.total : 0),
            0
        );
        const volume = activePipeline.reduce((sum, o) => sum + (o.items || 0), 0);

        return {
            total: activePipeline.length,
            pending: stagingArea.length,
            revenue,
            vols: volume,
        };
    }, [orders]);

    const handleStatusChange = useCallback(async (id: string, newStatus: Order['status']) => {
        const statusMap: Record<Order['status'], string> = {
            Created: 'CREATED', Confirmed: 'CONFIRMED', Packed: 'PACKED', Shipped: 'SHIPPED', Delivered: 'DELIVERED', Cancelled: 'CANCELLED',
        };
        const apiStatus = statusMap[newStatus];
        try {
            await updateOrderStatus(id, apiStatus);
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
            toast.success(`Order status updated to ${newStatus}`);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to update order status');
        }
    }, []);

    const handleAssignDelivery = useCallback(async (orderId: string, partnerId: string) => {
        if (!partnerId) return;
        try {
            await assignDeliveryPartner(orderId, partnerId);
            toast.success('Delivery partner assigned to order');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to assign delivery partner');
        }
    }, []);

    const handleOpenModal = () => {
        setFormData({ customer: '', status: 'Created', payment: 'Pending', fulfillment: 'Unfulfilled', selectedProducts: [] });
        setIsModalOpen(true);
    };

    const handleViewDetails = (order: Order) => {
        setSelectedOrder(order);
        setIsDetailOpen(true);
    };

    const handleAddProduct = useCallback((productId: string | number) => {
        const product = products.find(p => p.id === productId || p.id === String(productId));
        if (product && product.stock <= 0) {
            toast.error('Inventory exhausted for this node');
            return;
        }
        setFormData(prev => {
            const existing = prev.selectedProducts.find(p => p.productId === productId);
            if (existing) {
                return {
                    ...prev,
                    selectedProducts: prev.selectedProducts.map(p =>
                        p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p
                    )
                };
            }
            return { ...prev, selectedProducts: [...prev.selectedProducts, { productId, quantity: 1 }] };
        });
    }, [products]);

    const handleRemoveProduct = useCallback((productId: string | number) => {
        setFormData(prev => ({ ...prev, selectedProducts: prev.selectedProducts.filter(p => p.productId !== productId) }));
    }, []);

    const currentTotal = useMemo(() => {
        return formData.selectedProducts.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId || p.id === String(item.productId));
            const price = product?.discountPrice || product?.price || 0;
            return sum + (price * item.quantity);
        }, 0);
    }, [formData.selectedProducts, products]);

    const handleSubmitOrder = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customer || formData.selectedProducts.length === 0) {
            toast.error('Identity and payload required');
            return;
        }
        const newOrderId = `temp-${Date.now()}`;
        const newOrder: Order = {
            id: newOrderId,
            customer: formData.customer,
            items: formData.selectedProducts.reduce((sum, p) => sum + p.quantity, 0),
            date: new Date().toLocaleDateString(),
            total: currentTotal,
            payment: formData.payment,
            fulfillment: formData.fulfillment,
            status: formData.status,
            channel: 'Direct Entry',
            itemsDetails: formData.selectedProducts as any,
        };
        setOrders(prev => [newOrder, ...prev]);
        toast.success(`Entry added (local). Sync with backend when order API supports manual entry.`);
        setIsModalOpen(false);
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'Created': return { color: 'blue', label: 'Processing' };
            case 'Confirmed': return { color: 'indigo', label: 'Confirmed' };
            case 'Packed': return { color: 'amber', label: 'Packed' };
            case 'Shipped': return { color: 'purple', label: 'Shipped' };
            case 'Delivered': return { color: 'emerald', label: 'Delivered' };
            case 'Cancelled': return { color: 'red', label: 'Cancelled' };
            default: return { color: 'slate', label: status };
        }
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Global Order Stream</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Fulfillment Command</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Real-time logistics and transactional telemetry.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:shadow-xl transition-all flex items-center gap-2 shadow-sm">
                        <Download className="w-4 h-4" />
                        Export Ledger
                    </button>
                    <button
                        onClick={handleOpenModal}
                        className="h-12 px-8 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Fresh Entry
                    </button>
                </div>
            </div>

            {/* Order summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Active Orders', value: stats.total, icon: ShoppingBag, color: 'emerald', trend: 'Live' },
                    { label: 'Staging Area', value: stats.pending, icon: Clock, color: 'orange', trend: 'Critical path' },
                    { label: 'Total Revenue', value: `₹${(stats.revenue / 1000).toFixed(1)}K`, icon: Zap, color: 'blue', trend: 'Verified' },
                    { label: 'Unit Volume', value: stats.vols, icon: Box, color: 'purple', trend: 'Daily throughput' }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:ring-2 ring-transparent hover:ring-emerald-500/10 transition-all"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className={cn("p-4 rounded-3xl", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 border border-slate-100 px-3 py-1 rounded-full">{stat.trend}</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{stat.value}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Order list */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/20">
                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                        {['All', 'Unfulfilled', 'Unpaid', 'Open', 'Closed'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    activeTab === tab
                                        ? "bg-slate-900 text-white shadow-lg"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative group flex-1 max-w-2xl">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by order ID or customer..."
                            className="w-full h-14 pl-14 pr-6 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Transaction ID</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Customer</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Vendor</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Fiscal State</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black">Order Status</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black text-right">Amount</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-black text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {ordersLoading ? (
                                <tr><td colSpan={7} className="px-10 py-16 text-center text-slate-400 text-sm">Loading orders...</td></tr>
                            ) : null}
                            <AnimatePresence mode='popLayout'>
                                {displayedOrders.map((order, idx) => {
                                    const variant = getStatusVariant(order.status);
                                    const displayId = (order as any).orderNumber || order.id;
                                    return (
                                        <motion.tr
                                            key={order.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                            onClick={() => handleViewDetails(order)}
                                        >
                                            <td className="px-10 py-10">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">#{displayId}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{order.date}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-xl shadow-slate-900/10 group-hover:rotate-6 transition-transform">
                                                        {order.customer.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{order.customer}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                                                            <ExternalLink className="h-2.5 w-2.5" />
                                                            {order.channel}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10">
                                                {((order as any).vendorNames || []).length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {(((order as any).vendorNames || []) as string[]).slice(0, 2).map((vendorName) => (
                                                            <span
                                                                key={vendorName}
                                                                className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-700"
                                                            >
                                                                {vendorName}
                                                            </span>
                                                        ))}
                                                        {(((order as any).vendorNames || []) as string[]).length > 2 && (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-xl bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                                                +{(((order as any).vendorNames || []) as string[]).length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">—</span>
                                                )}
                                            </td>
                                            <td className="px-10 py-10">
                                                <span className={cn(
                                                    "inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest",
                                                    order.payment === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        order.payment === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                            'bg-red-50 text-red-700 border-red-100'
                                                )}>
                                                    <div className={cn("h-2 w-2 rounded-full",
                                                        order.payment === 'Paid' ? 'bg-emerald-500' :
                                                            order.payment === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
                                                    )} />
                                                    {order.payment}
                                                </span>
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                                    <div className={cn("h-3 w-3 rounded-full border border-white shadow-sm", `bg-${variant.color}-500`)} />
                                                    <select
                                                        value={order.status}
                                                        onChange={(e) => handleStatusChange(order.id, e.target.value as any)}
                                                        className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-900 outline-none cursor-pointer hover:bg-slate-100 p-2 rounded-xl transition-all border border-transparent hover:border-slate-100"
                                                    >
                                                        {['Created', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                                                            <option key={s} value={s}>{getStatusVariant(s).label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10 text-right">
                                                <span className="text-lg font-black text-slate-900 tracking-tighter leading-none">₹{order.total.toLocaleString()}</span>
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-3">
                                                        <button
                                                            onClick={() => handleViewDetails(order)}
                                                            className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 hover:shadow-xl transition-all"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => toast.info('Printing order slip...')}
                                                            className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 hover:shadow-xl transition-all"
                                                        >
                                                            <Printer className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                    {deliveryPartners.length > 0 && (user?.role === 'admin' || user?.role === 'ADMIN') && (
                                                        <div className="mt-2">
                                                            <select
                                                                defaultValue=""
                                                                onChange={(e) => {
                                                                    const partnerId = e.target.value;
                                                                    if (!partnerId) return;
                                                                    handleAssignDelivery(order.id, partnerId);
                                                                }}
                                                                className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.18em] px-4 py-2 rounded-full border border-slate-800 shadow-lg cursor-pointer"
                                                            >
                                                                <option value="">Assign rider…</option>
                                                                {deliveryPartners.map((p) => (
                                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>

                    {displayedOrders.length === 0 && (
                        <div className="py-32 text-center">
                            <Box className="w-20 h-20 text-slate-100 mx-auto mb-6" />
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">No Orders Found</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto">No transactional nodes found matching current parameters.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Order details side sheet */}
            {isDetailOpen && selectedOrder && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsDetailOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-3xl bg-white shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Sheet Header - sticky so content is never hidden under it */}
                            <div className="flex-shrink-0 sticky top-0 z-10 p-10 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-emerald-400" />
                                        </div>
                                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                                            Payload Inspection #{(selectedOrder as any).orderNumber || selectedOrder.id}
                                        </h2>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secure Ledger Analysis v4.2</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => toast.info('Exporting PDF...')} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-400 hover:text-blue-600 hover:shadow-xl transition-all">
                                        <Download className="h-6 w-6" />
                                    </button>
                                    <button onClick={() => setIsDetailOpen(false)} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-300 hover:text-red-500 hover:shadow-xl transition-all">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto p-12 pt-10 space-y-12 custom-scrollbar bg-white">
                                {/* Order Status Grid */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-emerald-200 transition-colors">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Fulfillment</p>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selectedOrder.fulfillment}</p>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-emerald-200 transition-colors">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Fiscal State</p>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selectedOrder.payment}</p>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-emerald-200 transition-colors">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Channels</p>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selectedOrder.channel}</p>
                                    </div>
                                    <div className="p-6 bg-emerald-900 rounded-[2rem] text-white shadow-xl shadow-emerald-900/10">
                                        <p className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest mb-2">Total Value</p>
                                        <p className="text-sm font-black tracking-tight">₹{selectedOrder.total.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Items Visualization */}
                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Box className="w-4 h-4" />
                                        Cart Contents
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {selectedOrder.itemsDetails?.map((item, idx) => {
                                            const product = products.find(p => p.id === item.productId);
                                            return (
                                                <div key={idx} className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-white border border-slate-100 hover:shadow-xl hover:shadow-slate-200/20 transition-all group cursor-pointer">
                                                    <div className="h-20 w-20 rounded-[1.75rem] bg-slate-900 overflow-hidden shadow-xl shadow-slate-900/10 group-hover:scale-110 transition-transform duration-500">
                                                        <img src={product?.image} className="w-full h-full object-cover group-hover:rotate-3" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-lg font-black text-slate-900 uppercase tracking-tight truncate">{product?.name}</p>
                                                            <p className="text-sm font-black text-slate-900">₹{((product?.discountPrice || product?.price || 0) * item.quantity).toLocaleString()}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                                                                <Zap className="h-2.5 w-2.5" />
                                                                {product?.vendor}
                                                            </span>
                                                            <div className="h-4 w-[1px] bg-slate-100" />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty: {item.quantity} {product?.unit || 'kg'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Logistics Metadata */}
                                <div className="grid grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4" />
                                            Receiver Identity
                                        </h3>
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-[1.5rem] bg-slate-900 text-white flex items-center justify-center font-black text-xl">
                                                    {selectedOrder.customer.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedOrder.customer}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 italic">Verified Customer</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4 pl-2">
                                                <div className="flex items-center gap-4 text-slate-600">
                                                    <div className="h-8 w-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                                        <Mail className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-tight">{selectedOrder.customer.toLowerCase().replace(' ', '.')}@gmail.com</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-slate-600">
                                                    <div className="h-8 w-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                                        <Phone className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-tight">+91 98765 00012</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            Shipping Details
                                        </h3>
                                        <div className="p-8 bg-slate-900 rounded-[2.5rem] border border-slate-800 relative overflow-hidden group">
                                            <div className="relative z-10 space-y-4">
                                                <p className="text-[11px] md:text-xs font-black text-white uppercase leading-relaxed tracking-tight group-hover:text-emerald-400 transition-colors duration-500 break-words">
                                                    {(() => {
                                                        const addr = (selectedOrder as any).shippingAddress || {};
                                                        const parts = [
                                                            addr.addressLine1 || addr.address || '',
                                                            addr.addressLine2 || '',
                                                            addr.city || '',
                                                            addr.state || '',
                                                            addr.pincode || addr.zipCode || '',
                                                        ].filter((v: string) => v && String(v).trim());
                                                        return parts.length ? parts.join(', ') : 'Shipping address not available';
                                                    })()}
                                                </p>
                                                <div className="mt-4 flex items-center gap-3">
                                                    <div className="h-8 w-8 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400">
                                                        <Truck className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                                        {(selectedOrder as any).courierName || 'Delivery partner not assigned yet'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-700" />
                                        </div>
                                    </div>
                                </div>

                                {/* Flow Visualization */}
                                <div className="space-y-10">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Order Progress
                                    </h3>
                                    <div className="relative pl-12 space-y-12">
                                        <div className="absolute left-[23px] top-0 bottom-0 w-[1px] bg-slate-100" />
                                        {[
                                            { status: 'Final Delivery', date: 'Oct 23, 2023 at 04:15 PM', active: selectedOrder.status === 'Delivered', icon: CheckCircle2 },
                                            { status: 'Out for Delivery', date: 'Oct 23, 2023 at 11:30 AM', active: ['Shipped', 'Delivered'].includes(selectedOrder.status), icon: Truck },
                                            { status: 'Packaging Sealed', date: 'Oct 22, 2023 at 08:30 PM', active: ['Packed', 'Shipped', 'Delivered'].includes(selectedOrder.status), icon: Package },
                                            { status: 'System Entry', date: `${selectedOrder.date} at 02:45 PM`, active: true, icon: ShoppingBag },
                                        ].map((step, idx) => (
                                            <div key={idx} className={cn("flex flex-col relative z-10 transition-all duration-700", step.active ? "opacity-100" : "opacity-20")}>
                                                <div className={cn(
                                                    "absolute -left-[45px] top-0 h-11 w-11 rounded-3xl border-4 border-white shadow-xl flex items-center justify-center",
                                                    step.active ? "bg-slate-900 border-emerald-50 text-white" : "bg-white border-slate-50 text-slate-300"
                                                )}>
                                                    <step.icon className="h-5 w-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{step.status}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{step.date}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sheet Actions */}
                            <div className="flex-shrink-0 p-10 bg-slate-50 border-t border-slate-100 flex gap-6">
                                <button
                                    onClick={() => handleStatusChange(selectedOrder.id, 'Cancelled')}
                                    className="flex-1 h-16 bg-white border border-red-100 text-red-600 rounded-[2rem] hover:bg-red-50 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                                >
                                    Abort Entry
                                </button>
                                <button
                                    className="flex-[2] h-16 bg-slate-900 text-white rounded-[2rem] hover:bg-black text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-slate-900/10 flex items-center justify-center gap-3"
                                >
                                    <Zap className="w-5 h-5 text-emerald-400" />
                                    Mark as Shipped
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {/* Create order modal */}
            {isModalOpen && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="relative bg-white rounded-[4rem] shadow-2xl w-full max-w-2xl overflow-hidden"
                        >
                            <div className="p-12 border-b border-slate-50 bg-slate-50/20">
                                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Direct Entry</h2>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 italic">Manual entry for high-tier commercial orders.</p>
                            </div>

                            <form onSubmit={handleSubmitOrder} className="p-12 space-y-10 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Tag</label>
                                        <input
                                            required
                                            placeholder="Receiver Name"
                                            value={formData.customer}
                                            onChange={e => setFormData({ ...formData, customer: e.target.value })}
                                            className="w-full h-16 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-sm font-black text-slate-900 focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                            className="w-full h-16 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-[10px] font-black uppercase tracking-widest text-slate-700 focus:bg-white outline-none appearance-none transition-all"
                                        >
                                            <option value="Created">Created</option>
                                            <option value="Confirmed">Confirmed</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payload Selection</label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {products.slice(0, 6).map(product => (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => handleAddProduct(product.id)}
                                                className="flex flex-col items-center gap-4 p-6 rounded-[2.5rem] bg-white border border-slate-100 hover:border-emerald-500 hover:shadow-xl transition-all group"
                                            >
                                                <div className="h-14 w-14 rounded-2xl bg-white shadow-sm overflow-hidden p-2">
                                                    <img src={product.image} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                                </div>
                                                <p className="text-[9px] font-black text-slate-900 uppercase tracking-tight">{product.name}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {formData.selectedProducts.length > 0 && (
                                    <div className="rounded-[3rem] bg-slate-900 p-10 space-y-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden">
                                        <div className="relative z-10 flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Order Data</p>
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">Token Generated</span>
                                        </div>
                                        <div className="relative z-10 space-y-4">
                                            {formData.selectedProducts.map(item => {
                                                const product = products.find(p => p.id === item.productId);
                                                return (
                                                    <div key={item.productId} className="flex items-center justify-between p-5 bg-white/5 rounded-[2rem] border border-white/5 hover:bg-white/10 transition-colors">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center font-black text-xs">{item.quantity}</div>
                                                            <span className="text-sm font-black">{product?.name}</span>
                                                        </div>
                                                        <button type="button" onClick={() => handleRemoveProduct(item.productId)} className="p-2 text-white/20 hover:text-red-400 transition-colors">
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="relative z-10 pt-8 border-t border-white/10 flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Total Amount</p>
                                                <p className="text-5xl font-black text-emerald-400 tracking-tighter">₹{currentTotal.toLocaleString()}</p>
                                            </div>
                                            <Activity className="w-12 h-12 text-emerald-400 opacity-20 animate-pulse" />
                                        </div>
                                        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
                                    </div>
                                )}

                                <div className="pt-10 flex gap-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 h-16 border border-slate-100 text-slate-900 rounded-[2rem] hover:bg-slate-50 font-black text-[10px] uppercase tracking-widest"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] h-16 bg-slate-900 text-white rounded-[2rem] hover:bg-black font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10"
                                    >
                                        Create Order
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
