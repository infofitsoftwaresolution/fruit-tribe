import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    getWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
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
import { buildOpenStreetMapEmbedSrc, OpenStreetMapEmbed } from '@/app/components/OpenStreetMapEmbed';
import { getUserErrorMessage } from '@/lib/userError';

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
    const { orders, deliveryPartners, refreshDeliveryPartners, isInitialLoading: bootstrapLoading } = useAdminData();
    const [sectionTab, setSectionTab] = useState<SectionTab>('deliveries');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Active');
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const deliveries = useMemo(() => {
        const list: Delivery[] = [];
        (orders || []).forEach((order: any) => {
            (order.deliveries || []).forEach((d: any) => list.push(mapApiDeliveryToDelivery(d, order)));
        });
        return list;
    }, [orders]);
    const loading = bootstrapLoading;
    const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; address: string; latitude: number | string; longitude: number | string; isActive: boolean }>>([]);
    const [warehouseModal, setWarehouseModal] = useState<{ open: boolean; editing?: { id: string; name: string; address: string; latitude: number; longitude: number; isActive: boolean } }>({ open: false });
    const [staffModal, setStaffModal] = useState<{ open: boolean; editing?: { id: string; name: string; phone: string; email: string; vehicle: string; status: string } }>({ open: false });
    const [warehouseForm, setWarehouseForm] = useState({ name: '', address: '', latitude: '', longitude: '', isActive: true });
    const [staffForm, setStaffForm] = useState({ name: '', phone: '', email: '', vehicle: '', status: 'ACTIVE' });
    const [isSavingWarehouse, setIsSavingWarehouse] = useState(false);
    const [isSavingStaff, setIsSavingStaff] = useState(false);
    const [openingMap, setOpeningMap] = useState(false);
    const [deliveryMapModal, setDeliveryMapModal] = useState<{
        embedSrc: string;
        warehouses: Array<{ id: string; name: string; lat: number; lng: number }>;
    } | null>(null);
    const hasLoadedWarehouses = useRef(false);
    const deliveriesPanelRef = useRef<HTMLDivElement>(null);

    const openDeliveryMap = async () => {
        if (openingMap) return;
        setOpeningMap(true);
        try {
            let list = warehouses;
            if (list.length === 0) {
                list = await getWarehouses(false).catch(() => []);
                setWarehouses(list);
                hasLoadedWarehouses.current = true;
            }
            const candidates = list.filter((w) => w.isActive !== false);
            const source = candidates.length > 0 ? candidates : list;
            const whPoints = source
                .map((w) => ({
                    id: w.id,
                    name: w.name,
                    lat: Number(w.latitude),
                    lng: Number(w.longitude),
                }))
                .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lng));
            if (whPoints.length === 0) {
                toast.error('Add at least one warehouse with latitude and longitude in the Warehouses tab.');
                setSectionTab('warehouses');
                return;
            }
            const embedSrc = buildOpenStreetMapEmbedSrc(whPoints.map((w) => ({ lat: w.lat, lng: w.lng })));
            if (!embedSrc) {
                toast.error('Could not build map for these coordinates.');
                return;
            }
            setDeliveryMapModal({ embedSrc, warehouses: whPoints });
        } catch {
            toast.error('Could not load warehouses. Try again.');
        } finally {
            setOpeningMap(false);
        }
    };

    const openDispatch = () => {
        setSectionTab('deliveries');
        setActiveTab('Active');
        setSearchQuery('');
        window.setTimeout(() => {
            deliveriesPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    };

    useEffect(() => {
        if (sectionTab !== 'warehouses') return;
        if (hasLoadedWarehouses.current) return;
        hasLoadedWarehouses.current = true;
        getWarehouses(false).then(setWarehouses).catch(() => setWarehouses([]));
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
        if (isSavingWarehouse) return;
        const lat = parseFloat(warehouseForm.latitude);
        const lng = parseFloat(warehouseForm.longitude);
        if (!warehouseForm.name.trim() || !warehouseForm.address.trim() || isNaN(lat) || isNaN(lng)) {
            toast.error('Name, address, and valid lat/lng required');
            return;
        }
        setIsSavingWarehouse(true);
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
            void getWarehouses(false).then(setWarehouses).catch(() => {});
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to save warehouse'));
        } finally {
            setIsSavingWarehouse(false);
        }
    };

    const handleSaveStaff = async () => {
        if (isSavingStaff) return;
        if (!staffForm.name.trim() || !staffForm.phone.trim() || !staffForm.email.trim()) {
            toast.error('Name, phone and email required');
            return;
        }
        setIsSavingStaff(true);
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
            void refreshDeliveryPartners();
        } catch (e: any) {
            const msg = getUserErrorMessage(e, 'Failed to save');
            const normalized = msg.toLowerCase();
            if (normalized.includes('phone number is already') || normalized.includes('phone already')) {
                toast.error('This phone number is already used. Please enter a different phone.');
                return;
            }
            if (normalized.includes('email is already') || normalized.includes('email already')) {
                toast.error('This email is already used. Please enter a different email.');
                return;
            }
            if (normalized.includes('already exists') || normalized.includes('already registered') || normalized.includes('unique constraint')) {
                toast.error('This delivery staff already exists. Please use unique details.');
                return;
            }
            toast.error(msg || 'Failed to save');
        } finally {
            setIsSavingStaff(false);
        }
    };

    const promptRemoveWarehouse = (w: { id: string; name: string }) => {
        toast(`Remove warehouse “${w.name}”?`, {
            description: 'Checkout distance and ETA will no longer use this location.',
            action: {
                label: 'Remove',
                onClick: async () => {
                    try {
                        await deleteWarehouse(w.id);
                        toast.success('Warehouse removed');
                        void getWarehouses(false).then(setWarehouses);
                    } catch (e: any) {
                        toast.error(getUserErrorMessage(e, 'Failed to remove warehouse'));
                    }
                },
            },
        });
    };

    const promptRemoveDeliveryPartner = (dp: { id: string; name: string }) => {
        toast(`Remove delivery partner “${dp.name}”?`, {
            description: 'They lose delivery app access; linked logins revert to the customer role.',
            action: {
                label: 'Remove',
                onClick: async () => {
                    try {
                        await deleteDeliveryPartner(dp.id);
                        toast.success('Delivery partner removed');
                        void refreshDeliveryPartners();
                    } catch (e: any) {
                        toast.error(getUserErrorMessage(e, 'Failed to remove'));
                    }
                },
            },
        });
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="admin-page-title">Logistics</h1>
                    <p className="admin-page-subtitle">Track deliveries, manage warehouses and delivery staff</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => void openDeliveryMap()}
                        disabled={openingMap}
                        className="admin-btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Globe className="w-4 h-4" />
                        {openingMap ? 'Loading…' : 'Delivery Map'}
                    </button>
                    <button
                        type="button"
                        onClick={openDispatch}
                        className="admin-btn-primary"
                    >
                        <Zap className="h-4 w-4" />
                        Open Dispatch
                    </button>
                </div>
            </div>

            {/* Section tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-lg border border-slate-100 w-fit">
                {(['deliveries', 'warehouses', 'staff'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setSectionTab(tab)}
                        className={cn(
                            'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                            sectionTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        {tab === 'deliveries' && 'Deliveries'}
                        {tab === 'warehouses' && 'Warehouses'}
                        {tab === 'staff' && 'Delivery Staff'}
                    </button>
                ))}
            </div>

            {sectionTab === 'warehouses' && (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <div>
                            <h2 className="admin-section-heading flex items-center gap-2">
                                <WarehouseIcon className="w-5 h-5 text-emerald-500" />
                                Warehouses
                            </h2>
                            <p className="text-slate-500 text-xs mt-0.5">Used for checkout distance &amp; ETA. Add warehouse addresses (lat/lng).</p>
                        </div>
                        <button onClick={() => { setWarehouseModal({ open: true }); setWarehouseForm({ name: '', address: '', latitude: '', longitude: '', isActive: true }); }} className="admin-btn-primary">
                            <Plus className="w-4 h-4" /> Add Warehouse
                        </button>
                    </div>
                    <div className="p-6 grid gap-4 min-h-[200px]">
                        {warehouses.length === 0 ? (
                            <p className="text-slate-400 text-xs py-8 text-center">No warehouses yet. Add one to enable distance/ETA at checkout.</p>
                        ) : (
                            warehouses.map((w) => (
                                <div key={w.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-emerald-100 transition-all duration-200">
                                    <div>
                                        <p className="font-semibold text-slate-900">{w.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{w.address}</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Lat: {Number(w.latitude).toFixed(4)}, Lng: {Number(w.longitude).toFixed(4)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setWarehouseModal({ open: true, editing: { id: w.id, name: w.name, address: w.address, latitude: Number(w.latitude), longitude: Number(w.longitude), isActive: w.isActive } }); setWarehouseForm({ name: w.name, address: w.address, latitude: String(w.latitude), longitude: String(w.longitude), isActive: w.isActive }); }} className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                                        <button
                                            type="button"
                                            onClick={() => promptRemoveWarehouse(w)}
                                            className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-50 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {sectionTab === 'staff' && (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <div>
                            <h2 className="admin-section-heading flex items-center gap-2">
                                <UserCircle className="w-5 h-5 text-emerald-500" />
                                In-house Delivery Staff
                            </h2>
                            <p className="text-slate-500 text-xs mt-0.5">People who deliver your products.</p>
                        </div>
                        <button onClick={() => { setStaffModal({ open: true }); setStaffForm({ name: '', phone: '', email: '', vehicle: '', status: 'ACTIVE' }); }} className="admin-btn-primary">
                            <Plus className="w-4 h-4" /> Add Staff
                        </button>
                    </div>
                    <div className="p-6 grid gap-4 min-h-[200px]">
                        {deliveryPartners.length === 0 ? (
                            <p className="text-slate-400 text-xs py-8 text-center">No delivery staff yet. Add in-house delivery people.</p>
                        ) : (
                            deliveryPartners.map((dp) => (
                                <div key={dp.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-emerald-100 transition-all duration-200">
                                    <div>
                                        <p className="font-semibold text-slate-900">{dp.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{dp.phone}</p>
                                        {dp.user?.email && <p className="text-xs text-slate-400 mt-0.5">{dp.user.email}</p>}
                                        {dp.vehicle && <p className="text-[11px] text-slate-400 mt-1">Vehicle: {dp.vehicle}</p>}
                                        <span className={cn('inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', dp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200')}>{dp.status}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setStaffModal({ open: true, editing: { id: dp.id, name: dp.name, phone: dp.phone, vehicle: dp.vehicle || '', status: dp.status, email: dp.user?.email || '' } }); setStaffForm({ name: dp.name, phone: dp.phone, email: dp.user?.email || '', vehicle: dp.vehicle || '', status: dp.status }); }} className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                                        <button
                                            type="button"
                                            onClick={() => promptRemoveDeliveryPartner(dp)}
                                            className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-50 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {sectionTab === 'deliveries' && (
            <>
            <div ref={deliveriesPanelRef} className="scroll-mt-24" />
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsFromData.map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        key={stat.label}
                        className="admin-stat-card"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={cn(
                                "h-9 w-9 rounded-lg flex items-center justify-center",
                                stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                                stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                                stat.color === 'purple' ? 'bg-purple-50 text-purple-600' :
                                'bg-orange-50 text-orange-600'
                            )}>
                                <stat.icon className="w-4 h-4" />
                            </div>
                            <span className="text-xs text-slate-400 border border-slate-100 px-2 py-0.5 rounded-full">{stat.trend}</span>
                        </div>
                        <p className="admin-stat-value">{stat.value}</p>
                        <p className="admin-stat-label">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Delivery list */}
            <div className="admin-card">
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-lg border border-slate-100 overflow-x-auto no-scrollbar">
                        {['Active', 'Completed', 'Hyperlocal', 'Delayed'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150 whitespace-nowrap",
                                    activeTab === tab
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative group flex-1 max-w-xl">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 focus:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Track by order ID or tracking number..."
                            className="admin-input pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-6 grid gap-4 min-h-[300px]">
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
                                className="group flex flex-col md:flex-row md:items-center gap-6 p-4 rounded-xl bg-white border border-slate-100 hover:border-emerald-500/20 hover:shadow-sm transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 group-hover:bg-emerald-500 transition-colors" />

                                <div className="flex items-center gap-4 min-w-[200px]">
                                    <div className={cn(
                                        "h-10 w-10 rounded-lg flex items-center justify-center relative border shadow-sm",
                                        delivery.status === 'Out for Delivery' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                            delivery.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                'bg-slate-50 text-slate-700 border-slate-200'
                                    )}>
                                        <Truck className="w-5 h-5" />
                                        {delivery.type === 'Hyperlocal' && (
                                            <div className="absolute -right-1.5 -top-1.5 h-4.5 w-4.5 bg-emerald-500 rounded-full flex items-center justify-center border border-white shadow-sm">
                                                <Zap className="h-2.5 w-2.5 text-white fill-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">ID: {delivery.id.slice(0, 8)}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Order #{delivery.orderNumber || delivery.orderId}</p>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                        <p className="text-xs font-medium text-slate-700">{delivery.destination}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="admin-badge-slate text-[10px]">
                                            {delivery.partner}
                                        </span>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            ETA: {delivery.eta}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 justify-between md:justify-end">
                                    <div className="text-right hidden xl:block pr-4 border-r border-slate-100">
                                        <p className="text-xs font-semibold text-slate-900 mb-1">{delivery.status}</p>
                                        <div className="flex gap-1 justify-end">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className={cn("h-1 w-4 rounded-full transition-all duration-300",
                                                    delivery.status === 'Delivered' ? 'bg-emerald-500' :
                                                        delivery.status === 'Out for Delivery' && i <= 4 ? 'bg-orange-500' :
                                                            delivery.status === 'In Transit' && i <= 2 ? 'bg-blue-500' : 'bg-slate-100'
                                                )} />
                                            ))}
                                        </div>
                                    </div>
                                    <button className="admin-btn-secondary text-xs">
                                        <Smartphone className="w-3.5 h-3.5" />
                                        <span>Contact</span>
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="py-20 text-center">
                            <Box className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-sm font-semibold text-slate-900">No Deliveries Found</h3>
                            <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">No deliveries found for current filters.</p>
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
                            <button type="button" disabled={isSavingWarehouse} onClick={handleSaveWarehouse} className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-70 disabled:cursor-not-allowed">{isSavingWarehouse ? 'Saving...' : 'Save'}</button>
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
                            <button type="button" disabled={isSavingStaff} onClick={handleSaveStaff} className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-70 disabled:cursor-not-allowed">{isSavingStaff ? 'Saving...' : 'Save'}</button>
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}

            {deliveryMapModal &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
                        onClick={() => setDeliveryMapModal(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-slate-100 flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 sm:p-8 border-b border-slate-100 flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Warehouse map</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Same OpenStreetMap view as checkout and customer tracking.{' '}
                                        {deliveryMapModal.warehouses.length > 1
                                            ? 'Area covers all warehouses; locations are listed below.'
                                            : 'Pin shows the warehouse coordinates.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDeliveryMapModal(null)}
                                    className="p-3 rounded-2xl border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors shrink-0"
                                    aria-label="Close map"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                                <div className="rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner bg-slate-50">
                                    <OpenStreetMapEmbed
                                        title="Warehouse locations map"
                                        src={deliveryMapModal.embedSrc}
                                        className="w-full min-h-[280px] h-[min(55vh,480px)] border-0"
                                    />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                        Warehouse coordinates
                                    </p>
                                    <ul className="space-y-2">
                                        {deliveryMapModal.warehouses.map((w) => (
                                            <li
                                                key={w.id}
                                                className="flex flex-wrap items-baseline justify-between gap-2 text-sm rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                                            >
                                                <span className="font-bold text-slate-900">{w.name}</span>
                                                <span className="font-mono text-xs text-slate-600">
                                                    {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </motion.div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
