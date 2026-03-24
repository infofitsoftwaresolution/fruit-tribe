import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/app/context/StoreContext';
import {
    getOrders,
    getWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    getDeliveryPartners,
    createDeliveryPartner,
    updateDeliveryPartner,
    deleteDeliveryPartner,
} from '@/lib/api';
import {
    Truck, MapPin, Navigation, Clock, CheckCircle2,
    AlertCircle, Search, Filter, MoreHorizontal,
    ChevronRight, Map as MapIcon, Calendar, User,
    TrendingUp, Shield, Smartphone, Zap, Activity,
    Box, ExternalLink, Signal, Globe, Navigation2,
    X, MoreVertical, Plus, Warehouse as WarehouseIcon, UserCircle, Edit2, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Delivery {
    id: string;
    orderId: string;
    orderNumber?: string;
    partner: string;
    status: string;
    destination: string;
    eta: string;
    contact: string;
    type: string;
    priority: string;
}

function mapApiDeliveryToDelivery(d: any, order: any): Delivery {
    const addr = order?.shippingAddress && typeof order.shippingAddress === 'object'
        ? order.shippingAddress
        : {};
    const destination = [addr.addressLine1, addr.city, addr.state].filter(Boolean).join(', ') || '—';
    return {
        id: d.id,
        orderId: order?.id ?? d.orderId,
        orderNumber: order?.orderNumber,
        partner: 'Carrier',
        status: d.status === 'DELIVERED' ? 'Delivered' : d.status === 'IN_TRANSIT' ? 'In Transit' : d.status || 'Pending',
        destination,
        eta: d.estimatedDelivery ? new Date(d.estimatedDelivery).toLocaleDateString() : '—',
        contact: '—',
        type: 'Standard',
        priority: 'Normal',
    };
}

type SectionTab = 'deliveries' | 'warehouses' | 'staff';

export function AdminLogisticsPage() {
    const { theme } = useStore();
    const [sectionTab, setSectionTab] = useState<SectionTab>('deliveries');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Active');
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; address: string; latitude: number | string; longitude: number | string; isActive: boolean }>>([]);
    const [deliveryPartners, setDeliveryPartners] = useState<Array<{ id: string; name: string; phone: string; vehicle: string | null; status: string; user?: { email: string } }>>([]);
    const [warehouseModal, setWarehouseModal] = useState<{ open: boolean; editing?: { id: string; name: string; address: string; latitude: number; longitude: number; isActive: boolean } }>({ open: false });
    const [staffModal, setStaffModal] = useState<{ open: boolean; editing?: { id: string; name: string; phone: string; email: string; vehicle: string; status: string } }>({ open: false });
    const [warehouseForm, setWarehouseForm] = useState({ name: '', address: '', latitude: '', longitude: '', isActive: true });
    const [staffForm, setStaffForm] = useState({ name: '', phone: '', email: '', vehicle: '', status: 'ACTIVE' });

    useEffect(() => {
        let cancelled = false;
        getOrders()
            .then((orders: any[]) => {
                if (cancelled) return;
                const list: Delivery[] = [];
                (orders || []).forEach((order) => {
                    (order.deliveries || []).forEach((d: any) => list.push(mapApiDeliveryToDelivery(d, order)));
                });
                setDeliveries(list);
            })
            .catch(() => { if (!cancelled) setDeliveries([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (sectionTab !== 'warehouses') return;
        getWarehouses(false).then(setWarehouses).catch(() => setWarehouses([]));
    }, [sectionTab]);

    useEffect(() => {
        if (sectionTab !== 'staff') return;
        getDeliveryPartners().then(setDeliveryPartners).catch(() => setDeliveryPartners([]));
    }, [sectionTab]);

    const filteredDeliveries = useMemo(() => {
        return deliveries.filter(d => {
            const matchesSearch = d.id.includes(searchQuery) || d.orderId.includes(searchQuery) || (d.orderNumber || '').includes(searchQuery);
            if (!matchesSearch) return false;
            if (activeTab === 'Active') return ['In Transit', 'Out for Delivery', 'Pending'].includes(d.status);
            if (activeTab === 'Completed') return d.status === 'Delivered';
            if (activeTab === 'Hyperlocal') return d.type === 'Hyperlocal';
            if (activeTab === 'Delayed') return d.status === 'Delayed';
            return true;
        });
    }, [deliveries, searchQuery, activeTab]);

    const statsFromData = useMemo(() => [
        { label: 'Active Fleet', value: String(deliveries.filter(d => !['Delivered'].includes(d.status)).length), icon: Truck, color: 'emerald', trend: 'Live' },
        { label: 'Network Latency', value: '—', icon: Clock, color: 'blue', trend: 'Optimal' },
        { label: 'Delivery success', value: deliveries.length ? `${Math.round((deliveries.filter(d => d.status === 'Delivered').length / deliveries.length) * 100)}%` : '0%', icon: CheckCircle2, color: 'purple', trend: 'Verified' },
        { label: 'Total Consignments', value: String(deliveries.length), icon: Signal, color: 'orange', trend: 'All time' }
    ], [deliveries]);

    const handleSaveWarehouse = async () => {
        const lat = parseFloat(warehouseForm.latitude);
        const lng = parseFloat(warehouseForm.longitude);
        if (!warehouseForm.name.trim() || !warehouseForm.address.trim() || isNaN(lat) || isNaN(lng)) {
            toast.error('Name, address, and valid lat/lng required');
            return;
        }
        try {
            if (warehouseModal.editing) {
                await updateWarehouse(warehouseModal.editing.id, { ...warehouseForm, latitude: lat, longitude: lng });
                toast.success('Warehouse updated');
            } else {
                await createWarehouse({ name: warehouseForm.name, address: warehouseForm.address, latitude: lat, longitude: lng, isActive: warehouseForm.isActive });
                toast.success('Warehouse added');
            }
            setWarehouseModal({ open: false });
            setWarehouseForm({ name: '', address: '', latitude: '', longitude: '', isActive: true });
            getWarehouses(false).then(setWarehouses).catch(() => {});
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save warehouse');
        }
    };

    const handleSaveStaff = async () => {
        if (!staffForm.name.trim() || !staffForm.phone.trim() || !staffForm.email.trim()) {
            toast.error('Name, phone and email required');
            return;
        }
        try {
            if (staffModal.editing) {
                await updateDeliveryPartner(staffModal.editing.id, { name: staffForm.name, phone: staffForm.phone, email: staffForm.email, vehicle: staffForm.vehicle || undefined, status: staffForm.status });
                toast.success('Delivery partner updated. If this staff had no login before, we have emailed them a temporary password.');
            } else {
                await createDeliveryPartner({ name: staffForm.name, phone: staffForm.phone, email: staffForm.email, vehicle: staffForm.vehicle || undefined, status: staffForm.status });
                toast.success('Delivery partner added. We emailed them a temporary password.');
            }
            setStaffModal({ open: false });
            setStaffForm({ name: '', phone: '', email: '', vehicle: '', status: 'ACTIVE' });
            getDeliveryPartners().then(setDeliveryPartners).catch(() => {});
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        }
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Navigation2 className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Delivery Operations</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Logistics Overview</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Track deliveries, staff, and warehouses in one place.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:shadow-xl transition-all flex items-center gap-2 shadow-sm">
                        <Globe className="w-4 h-4" />
                        Delivery Map
                    </button>
                    <button
                        onClick={() => toast.info('Opening dispatch...')}
                        className="h-12 px-8 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center gap-2"
                    >
                        <Zap className="h-4 w-4 text-emerald-400" />
                        Open Dispatch
                    </button>
                </div>
            </div>

            {/* Section tabs: Deliveries | Warehouses | Delivery staff */}
            <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
                {(['deliveries', 'warehouses', 'staff'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setSectionTab(tab)}
                        className={cn(
                            'px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                            sectionTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        )}
                    >
                        {tab === 'deliveries' && 'Deliveries'}
                        {tab === 'warehouses' && 'Warehouses'}
                        {tab === 'staff' && 'Delivery staff'}
                    </button>
                ))}
            </div>

            {sectionTab === 'warehouses' && (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <WarehouseIcon className="w-5 h-5 text-emerald-500" />
                                Warehouses
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">Used for checkout distance &amp; ETA. Add warehouse addresses (lat/lng).</p>
                        </div>
                        <button onClick={() => { setWarehouseModal({ open: true }); setWarehouseForm({ name: '', address: '', latitude: '', longitude: '', isActive: true }); }} className="h-12 px-6 rounded-2xl bg-slate-900 text-white text-sm font-black flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Add warehouse
                        </button>
                    </div>
                    <div className="p-8 grid gap-4 min-h-[300px]">
                        {warehouses.length === 0 ? (
                            <p className="text-slate-400 text-sm py-8">No warehouses yet. Add one to enable distance/ETA at checkout.</p>
                        ) : (
                            warehouses.map((w) => (
                                <div key={w.id} className="flex items-center justify-between p-6 rounded-2xl border border-slate-100 hover:border-emerald-100 transition-all">
                                    <div>
                                        <p className="font-black text-slate-900">{w.name}</p>
                                        <p className="text-sm text-slate-500 mt-1">{w.address}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Lat: {Number(w.latitude).toFixed(4)}, Lng: {Number(w.longitude).toFixed(4)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setWarehouseModal({ open: true, editing: { id: w.id, name: w.name, address: w.address, latitude: Number(w.latitude), longitude: Number(w.longitude), isActive: w.isActive } }); setWarehouseForm({ name: w.name, address: w.address, latitude: String(w.latitude), longitude: String(w.longitude), isActive: w.isActive }); }} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-emerald-600"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={async () => { if (confirm('Remove this warehouse?')) { try { await deleteWarehouse(w.id); toast.success('Warehouse removed'); getWarehouses(false).then(setWarehouses); } catch (e: any) { toast.error(e?.message); } } }} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {sectionTab === 'staff' && (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <UserCircle className="w-5 h-5 text-emerald-500" />
                                In-house delivery staff
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">People who deliver your products.</p>
                        </div>
                        <button onClick={() => { setStaffModal({ open: true }); setStaffForm({ name: '', phone: '', vehicle: '', status: 'ACTIVE' }); }} className="h-12 px-6 rounded-2xl bg-slate-900 text-white text-sm font-black flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Add delivery staff
                        </button>
                    </div>
                    <div className="p-8 grid gap-4 min-h-[300px]">
                        {deliveryPartners.length === 0 ? (
                            <p className="text-slate-400 text-sm py-8">No delivery staff yet. Add in-house delivery people.</p>
                        ) : (
                            deliveryPartners.map((dp) => (
                                <div key={dp.id} className="flex items-center justify-between p-6 rounded-2xl border border-slate-100 hover:border-emerald-100 transition-all">
                                    <div>
                                        <p className="font-black text-slate-900">{dp.name}</p>
                                        <p className="text-sm text-slate-500 mt-1">{dp.phone}</p>
                                        {dp.user?.email && <p className="text-xs text-slate-400 mt-0.5">{dp.user.email}</p>}
                                        {dp.vehicle && <p className="text-[10px] text-slate-400 mt-1">Vehicle: {dp.vehicle}</p>}
                                        <span className={cn('inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase', dp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{dp.status}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setStaffModal({ open: true, editing: { id: dp.id, name: dp.name, phone: dp.phone, vehicle: dp.vehicle || '', status: dp.status, email: dp.user?.email || '' } }); setStaffForm({ name: dp.name, phone: dp.phone, email: dp.user?.email || '', vehicle: dp.vehicle || '', status: dp.status }); }} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-emerald-600"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={async () => { if (confirm('Remove this delivery partner?')) { try { await deleteDeliveryPartner(dp.id); toast.success('Removed'); getDeliveryPartners().then(setDeliveryPartners); } catch (e: any) { toast.error(e?.message); } } }} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {sectionTab === 'deliveries' && (
            <>
            {/* Logistics Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsFromData.map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:ring-2 ring-transparent hover:ring-emerald-500/10 transition-all cursor-default"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className={cn("p-4 rounded-3xl", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 border border-slate-100 px-3 py-1 rounded-full uppercase tracking-tighter">{stat.trend}</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{stat.value}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Delivery list */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/20">
                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                        {['Active', 'Completed', 'Hyperlocal', 'Delayed'].map((tab) => (
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
                            placeholder="Track by order ID or tracking number..."
                            className="w-full h-14 pl-14 pr-6 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-8 grid gap-4 min-h-[500px]">
                    {loading ? (
                        <div className="py-16 text-center text-slate-400 text-sm">Loading deliveries...</div>
                    ) : filteredDeliveries.length > 0 ? (
                        filteredDeliveries.map((delivery, idx) => (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={delivery.id}
                                onClick={() => setSelectedDelivery(delivery)}
                                className="group flex flex-col md:flex-row md:items-center gap-8 p-8 rounded-[2.5rem] bg-white border border-slate-100 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-slate-200/40 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-2 bg-slate-50 group-hover:bg-emerald-500 transition-colors" />

                                <div className="flex items-center gap-6 min-w-[240px]">
                                    <div className={cn(
                                        "h-20 w-20 rounded-[1.75rem] flex items-center justify-center relative shadow-xl shadow-slate-900/5 transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110",
                                        delivery.status === 'Out for Delivery' ? 'bg-orange-600 text-white' :
                                            delivery.status === 'Delivered' ? 'bg-emerald-600 text-white' :
                                                'bg-slate-900 text-white'
                                    )}>
                                        <Truck className="w-8 h-8" />
                                        {delivery.type === 'Hyperlocal' && (
                                            <div className="absolute -right-3 -top-3 h-8 w-8 bg-emerald-400 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
                                                <Zap className="h-4 w-4 text-emerald-900 fill-emerald-900" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-lg font-black text-slate-900 uppercase tracking-tighter group-hover:text-emerald-600 transition-colors">{delivery.id.slice(0, 8)}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Order #{delivery.orderNumber || delivery.orderId}</p>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <MapPin className="w-4 h-4 text-emerald-500" />
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{delivery.destination}</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <span className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                            <Shield className="w-3 h-3 text-slate-300" />
                                            {delivery.partner}
                                        </span>
                                        <div className="h-4 w-[1px] bg-slate-100" />
                                        <span className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                                            <Clock className="w-3 h-3 text-emerald-500" />
                                            ETA: {delivery.eta}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden xl:block px-8 border-r border-slate-50">
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2 italic">{delivery.status}</p>
                                        <div className="flex gap-1.5 justify-end">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className={cn("h-1.5 w-6 rounded-full transition-all duration-1000",
                                                    delivery.status === 'Delivered' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                                                        delivery.status === 'Out for Delivery' && i <= 4 ? 'bg-orange-500' :
                                                            delivery.status === 'In Transit' && i <= 2 ? 'bg-blue-500' : 'bg-slate-100'
                                                )} />
                                            ))}
                                        </div>
                                    </div>
                                    <button className="h-14 px-8 rounded-2xl bg-slate-900 text-white hover:bg-black transition-all shadow-xl shadow-slate-900/10 flex items-center gap-3 active:scale-95">
                                        <Smartphone className="w-4 h-4 text-emerald-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Contact</span>
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="py-32 text-center">
                            <Box className="w-20 h-20 text-slate-100 mx-auto mb-6" />
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">No Deliveries Found</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto">No deliveries found.</p>
                        </div>
                    )}
                </div>
            </div>
            </>
            )}

            {/* Delivery details panel */}
            {selectedDelivery && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setSelectedDelivery(null)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Panel Header */}
                            <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                            <Signal className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                                            Delivery: {selectedDelivery.id}
                                        </h2>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Details</p>
                                </div>
                                <button onClick={() => setSelectedDelivery(null)} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-300 hover:text-red-500 hover:shadow-xl transition-all">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
                                {/* Carrier Profile */}
                                <div className="grid grid-cols-4 gap-4">
                                    {[
                                        { label: 'Delivery type', value: selectedDelivery.type, icon: Zap, color: 'emerald' },
                                        { label: 'Priority', value: selectedDelivery.priority, icon: TrendingUp, color: 'blue' },
                                        { label: 'Carrier ETA', value: selectedDelivery.eta, icon: Clock, color: 'purple' },
                                        { label: 'Signal', value: 'High', icon: Signal, color: 'orange' }
                                    ].map((stat, i) => (
                                        <div key={i} className="p-5 bg-slate-50 rounded-[1.75rem] border border-slate-100 text-center hover:border-emerald-200 transition-colors">
                                            <stat.icon className={cn("w-5 h-5 mx-auto mb-3", `text-${stat.color}-500`)} />
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{stat.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Simulation Map Viz */}
                                <div className="relative group">
                                    <div className="aspect-[16/10] bg-slate-900 rounded-[3rem] overflow-hidden relative shadow-2xl border-4 border-slate-50">
                                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80')] bg-cover opacity-30 grayscale group-hover:grayscale-0 transition-all duration-1000 scale-110 group-hover:scale-100" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                                            <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-[0_0_50px_rgba(16,185,129,0.4)] ring-8 ring-emerald-500/20 mb-6 animate-bounce">
                                                <Navigation className="w-12 h-12" />
                                            </div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-2">Delivery Map Preview</h3>
                                            <p className="text-[10px] font-medium text-emerald-400/60 uppercase tracking-widest italic animate-pulse tracking-widest">Loading...</p>
                                        </div>

                                        {/* HUD Overlay Elements */}
                                        <div className="absolute top-8 left-8 p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hidden md:block">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                                                <p className="text-[9px] font-black text-white uppercase tracking-widest">Active Link</p>
                                            </div>
                                            <p className="text-[10px] text-white/40 font-mono">LAT: 19.0760 N <br /> LON: 72.8777 E</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Event Propagation Ledger */}
                                <div className="space-y-8">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Activity className="w-4 h-4" />
                                        Delivery status
                                    </h3>
                                    <div className="relative pl-12 space-y-10">
                                        <div className="absolute left-[23px] top-0 bottom-0 w-[1px] bg-slate-100" />
                                        {[
                                            { status: 'Target Destination', time: 'Just now', icon: MapPin, active: selectedDelivery.status === 'Out for Delivery', done: false, color: 'emerald' },
                                            { status: 'Out for delivery', time: '14 mins ago', icon: Truck, active: true, done: selectedDelivery.status === 'Delivered', color: 'blue' },
                                            { status: 'Shipped', time: '1 hr ago', icon: Box, active: true, done: true, color: 'purple' },
                                            { status: 'Order placed', time: '2 hrs ago', icon: Zap, active: true, done: true, color: 'slate' },
                                        ].map((step, idx) => (
                                            <div key={idx} className={cn("flex flex-col relative z-10 transition-all duration-700", step.active ? "opacity-100" : "opacity-20")}>
                                                <div className={cn(
                                                    "absolute -left-[45px] top-0 h-11 w-11 rounded-3xl border-4 border-white shadow-xl flex items-center justify-center",
                                                    step.active ? `bg-slate-900 text-${step.color}-400` : "bg-white text-slate-300"
                                                )}>
                                                    <step.icon className="h-5 w-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{step.status}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{step.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Panel Actions */}
                            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-6">
                                <button className="h-16 w-16 bg-white border border-slate-200 rounded-3xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm flex items-center justify-center">
                                    <MoreVertical className="w-6 h-6" />
                                </button>
                                <button
                                    className="flex-1 h-16 bg-slate-900 text-white rounded-[2rem] hover:bg-black text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-slate-900/10 flex items-center justify-center gap-3"
                                >
                                    <Smartphone className="w-5 h-5 text-emerald-400" />
                                    Send Update to Rider
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {/* Warehouse add/edit modal */}
            {warehouseModal.open && createPortal(
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md" onClick={() => setWarehouseModal({ open: false })}>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-100" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-900 mb-6">{warehouseModal.editing ? 'Edit warehouse' : 'Add warehouse'}</h3>
                        <div className="space-y-4">
                            <input placeholder="Name" value={warehouseForm.name} onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900" />
                            <textarea placeholder="Address" value={warehouseForm.address} onChange={e => setWarehouseForm({ ...warehouseForm, address: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 min-h-[80px]" />
                            <input type="number" step="any" placeholder="Latitude" value={warehouseForm.latitude} onChange={e => setWarehouseForm({ ...warehouseForm, latitude: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900" />
                            <input type="number" step="any" placeholder="Longitude" value={warehouseForm.longitude} onChange={e => setWarehouseForm({ ...warehouseForm, longitude: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900" />
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button type="button" onClick={() => setWarehouseModal({ open: false })} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold">Cancel</button>
                            <button type="button" onClick={handleSaveWarehouse} className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold">Save</button>
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}

            {/* Delivery staff add/edit modal */}
            {staffModal.open && createPortal(
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md" onClick={() => setStaffModal({ open: false })}>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-100" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-900 mb-2">{staffModal.editing ? 'Edit delivery staff' : 'Add delivery staff'}</h3>
                        {!staffModal.editing && (
                            <p className="text-[11px] text-slate-500 mb-4">
                                We will create a delivery login for this staff member and email them a temporary password.
                            </p>
                        )}
                        <div className="space-y-4">
                            <input placeholder="Name" value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900" />
                            <input placeholder="Phone" value={staffForm.phone} onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900" />
                            <input placeholder="Email (used for login)" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900" />
                            <input placeholder="Vehicle (optional)" value={staffForm.vehicle} onChange={e => setStaffForm({ ...staffForm, vehicle: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900" />
                            <select value={staffForm.status} onChange={e => setStaffForm({ ...staffForm, status: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900">
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button type="button" onClick={() => setStaffModal({ open: false })} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold">Cancel</button>
                            <button type="button" onClick={handleSaveStaff} className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold">Save</button>
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}
        </div>
    );
}
