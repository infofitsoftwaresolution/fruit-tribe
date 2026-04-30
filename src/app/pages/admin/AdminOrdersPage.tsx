import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useStore, Order } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import { updateOrderStatus, assignDeliveryPartner, productBelongsToSeller, getImageDisplayUrl, createManualOrder, generateOrderPaymentLink, updateOrderPaymentStatus } from '@/lib/api';
import {
    Plus, Minus, Search, Filter, MoreHorizontal, ArrowUpDown, X,
    Truck, User, Calendar, CreditCard, Package,
    ChevronRight, ExternalLink, MapPin, Phone, Mail, Clock,
    CheckCircle2, AlertCircle, ShoppingBag, TrendingUp, Info,
    Activity, Zap, ShieldCheck, Box, MoreVertical,
    FileText, Eye, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, getRoundedClass } from '@/lib/utils';
import { AdminTableSkeletonRows } from '@/app/components/admin/AdminTableSkeleton';

export function AdminOrdersPage() {
    const { updateOrder, theme } = useStore();
    const { user } = useAuth();
    const location = useLocation();
    const {
        orders: rawOrders,
        products,
        deliveryPartners: dpRows,
        refreshOrders,
        isInitialLoading: ordersLoading,
    } = useAdminData();
    const [localDraftOrders, setLocalDraftOrders] = useState<Order[]>([]);
    const orders = useMemo(() => {
        const merged = [...localDraftOrders, ...(rawOrders || []).map(mapApiOrderToOrder)];
        const seen = new Set<string>();
        return merged.filter((o) => {
            const id = String((o as any).id || '');
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }, [rawOrders, localDraftOrders]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [formData, setFormData] = useState({
        customer: '',
        email: '',
        phone: '',
        status: 'Created' as Order['status'],
        payment: 'Pending' as Order['payment'],
        fulfillment: 'Unfulfilled' as Order['fulfillment'],
        selectedProducts: [] as { productId: string | number; quantity: number }[]
    });
    const [freshEntryProductSearch, setFreshEntryProductSearch] = useState('');
    const [isPaymentEmailModalOpen, setIsPaymentEmailModalOpen] = useState(false);
    const [paymentLinkTargetOrder, setPaymentLinkTargetOrder] = useState<(Order & { userEmail?: string; userPhone?: string }) | null>(null);
    const [paymentLinkEmail, setPaymentLinkEmail] = useState('');

    const copyText = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(textarea);
                return ok;
            } catch {
                return false;
            }
        }
    }, []);

    const [activeTab, setActiveTab] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const deliveryPartners = useMemo(() => {
        if (user?.role !== 'admin') return [];
        return (dpRows || [])
            .map((p) => ({
                id: p.id,
                name: p.name,
                status: String(p.status || '').toUpperCase(),
                onlineStatus: String((p as any).onlineStatus || '').toUpperCase(),
            }))
            .filter((p) => p.status === 'ACTIVE' && p.onlineStatus === 'ONLINE');
    }, [dpRows, user?.role]);

    function extractDistanceKm(api: any): number | null {
        const firstDelivery = (api?.deliveries || [])[0] || null;
        const candidates = [
            api?.distanceKm,
            api?.deliveryDistanceKm,
            api?.shippingDistanceKm,
            firstDelivery?.distanceKm,
            firstDelivery?.distance,
            api?.shippingAddress?.distanceKm,
            api?.shippingAddress?.distance,
            api?.shippingAddress?.meta?.distanceKm,
        ];
        for (const value of candidates) {
            const num = typeof value === 'string' ? parseFloat(value) : Number(value);
            if (Number.isFinite(num) && num >= 0) return num;
        }
        return null;
    }

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
            distanceKm: extractDistanceKm(api),
            userEmail: api.user?.email || '',
            userPhone: api.user?.phone || '',
        } as any;
    }

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get('search') || '';
        setSearchQuery(q);
    }, [location.search]);

    const displayedOrders = useMemo(() => {
        let filtered = orders;
        if (user?.role === 'seller') {
            filtered = orders.filter((order) => {
                return order.itemsDetails?.some((item) => {
                    const product = products.find(
                        (p) => String(p.id) === String(item.productId),
                    );
                    if (!product) return false;
                    return productBelongsToSeller(product, user);
                });
            });
        }
        return filtered.filter(order => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                order.customer.toLowerCase().includes(q) ||
                order.id.includes(searchQuery) ||
                (order.orderNumber || '').toLowerCase().includes(q) ||
                String((order as any).userEmail || '').toLowerCase().includes(q) ||
                String((order as any).userPhone || '').toLowerCase().includes(q) ||
                (((order as any).vendorNames || []) as string[]).some((v) =>
                    v.toLowerCase().includes(q)
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

    const patchLocalOrder = useCallback((id: string, patch: Partial<Order>) => {
        setLocalDraftOrders((prev) => {
            const idx = prev.findIndex((o) => String((o as any).id) === String(id));
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...patch };
                return next;
            }
            const base = orders.find((o) => String((o as any).id) === String(id));
            if (!base) return prev;
            return [{ ...base, ...patch } as Order, ...prev];
        });
    }, [orders]);

    const handleStatusChange = useCallback(async (id: string, newStatus: Order['status']) => {
        const statusMap: Record<Order['status'], string> = {
            Created: 'CREATED', Confirmed: 'CONFIRMED', Packed: 'PACKED', Shipped: 'SHIPPED', Delivered: 'DELIVERED', Cancelled: 'CANCELLED',
        };
        const apiStatus = statusMap[newStatus];
        const current = orders.find((o) => String((o as any).id) === String(id));
        if (!current) return;
        const optimisticPatch: Partial<Order> = {
            status: newStatus,
            fulfillment: newStatus === 'Delivered' ? 'Fulfilled' : newStatus === 'Cancelled' ? 'Unfulfilled' : current.fulfillment,
            payment: newStatus === 'Delivered' && current.payment === 'Pending' ? 'Paid' : current.payment,
        };
        patchLocalOrder(id, optimisticPatch);
        try {
            await updateOrderStatus(id, apiStatus);
            void refreshOrders();
            toast.success(`Order status updated to ${newStatus}`);
        } catch (e: any) {
            patchLocalOrder(id, {
                status: current.status,
                fulfillment: current.fulfillment,
                payment: current.payment,
            });
            toast.error(e?.message || 'Failed to update order status');
        }
    }, [orders, patchLocalOrder, refreshOrders]);

    const handlePaymentStatusChange = useCallback(async (id: string, newPaymentStatus: Order['payment']) => {
        const paymentMap: Record<Order['payment'], string> = {
            Paid: 'PAID', Pending: 'PENDING', Refunded: 'REFUNDED',
        };
        const apiStatus = paymentMap[newPaymentStatus];
        const current = orders.find((o) => String((o as any).id) === String(id));
        if (!current) return;
        patchLocalOrder(id, { payment: newPaymentStatus });
        try {
            await updateOrderPaymentStatus(id, apiStatus);
            void refreshOrders();
            toast.success(`Payment status updated to ${newPaymentStatus}`);
        } catch (e: any) {
            patchLocalOrder(id, { payment: current.payment });
            toast.error(e?.message || 'Failed to update payment status');
        }
    }, [orders, patchLocalOrder, refreshOrders]);

    const handleAssignDelivery = useCallback(async (orderId: string, partnerId: string) => {
        if (!partnerId) return;
        const current = orders.find((o) => String((o as any).id) === String(orderId));
        const partnerName = deliveryPartners.find((p) => String(p.id) === String(partnerId))?.name || current?.courierName || null;
        if (current) {
            patchLocalOrder(orderId, {
                courierName: partnerName as any,
                status: current.status === 'Created' ? 'Confirmed' : current.status,
            });
        }
        try {
            await assignDeliveryPartner(orderId, partnerId);
            void refreshOrders();
            toast.success('Delivery partner assigned to order');
        } catch (e: any) {
            if (current) {
                patchLocalOrder(orderId, {
                    courierName: current.courierName as any,
                    status: current.status,
                });
            }
            toast.error(e?.message || 'Failed to assign delivery partner');
        }
    }, [deliveryPartners, orders, patchLocalOrder, refreshOrders]);

    const handleOpenModal = () => {
        setFormData({ customer: '', email: '', phone: '', status: 'Created', payment: 'Pending', fulfillment: 'Unfulfilled', selectedProducts: [] });
        setFreshEntryProductSearch('');
        setIsModalOpen(true);
    };

    const catalogForFreshEntry = useMemo(() => {
        let list = products;
        if (user?.role === 'seller') {
            list = products.filter((p) => productBelongsToSeller(p, user));
        }
        const q = freshEntryProductSearch.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.vendor || '').toLowerCase().includes(q) ||
                String(p.sku || '').toLowerCase().includes(q),
        );
    }, [products, user, freshEntryProductSearch]);

    const escapeCsvValue = (value: unknown) => {
        const str = value == null ? '' : String(value);
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const handleExportLedger = useCallback(() => {
        const rows = displayedOrders;
        if (!rows.length) {
            toast.error('No orders to export for the current filters.');
            return;
        }
        const header = [
            'Order ID',
            'Order Number',
            'Customer',
            'Date',
            'Status',
            'Payment',
            'Fulfillment',
            'Channel',
            'Vendors',
            'Line Items (qty)',
            'Total (INR)',
        ];
        const data = rows.map((o) => {
            const vendors = (((o as any).vendorNames || []) as string[]).join('; ');
            const lines =
                (o.itemsDetails || [])
                    .map((it: any) => {
                        const pr = products.find((p) => String(p.id) === String(it.productId));
                        return pr ? `${pr.name}×${it.quantity}` : `${it.productId}×${it.quantity}`;
                    })
                    .join(' | ') || String(o.items ?? '');
            return [
                o.id,
                (o as any).orderNumber || '',
                o.customer,
                o.date,
                o.status,
                o.payment,
                o.fulfillment,
                o.channel,
                vendors,
                lines,
                o.total,
            ];
        });
        const csv = [header, ...data].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${rows.length} order(s) to CSV.`);
    }, [displayedOrders, products]);

    const handleViewDetails = (order: Order) => {
        setSelectedOrder(order);
        setIsDetailOpen(true);
    };

    const handleAddProduct = useCallback((productId: string | number) => {
        const product = products.find((p) => p.id === productId || p.id === String(productId));
        const stock = Number(product?.availableStock ?? product?.stock ?? 0);
        if (product && stock <= 0) {
            toast.error('Out of stock for this product');
            return;
        }
        const max = stock > 0 ? stock : 9999;
        setFormData((prev) => {
            const existing = prev.selectedProducts.find((p) => p.productId === productId);
            if (existing) {
                if (existing.quantity >= max) {
                    toast.error('Maximum available quantity reached');
                    return prev;
                }
                return {
                    ...prev,
                    selectedProducts: prev.selectedProducts.map((p) =>
                        p.productId === productId ? { ...p, quantity: Math.min(p.quantity + 1, max) } : p,
                    ),
                };
            }
            return { ...prev, selectedProducts: [...prev.selectedProducts, { productId, quantity: 1 }] };
        });
    }, [products]);

    const handleRemoveProduct = useCallback((productId: string | number) => {
        setFormData(prev => ({ ...prev, selectedProducts: prev.selectedProducts.filter(p => p.productId !== productId) }));
    }, []);

    const maxQtyForProduct = useCallback(
        (productId: string | number) => {
            const product = products.find((p) => p.id === productId || p.id === String(productId));
            const n = product ? Number(product.availableStock ?? product.stock ?? 0) : 0;
            return n > 0 ? n : 9999;
        },
        [products],
    );

    const handleSetLineQuantity = useCallback((productId: string | number, raw: number) => {
        const max = maxQtyForProduct(productId);
        let q = Math.max(1, Math.floor(Number(raw)) || 1);
        if (max < 9999) q = Math.min(q, max);
        setFormData((prev) => ({
            ...prev,
            selectedProducts: prev.selectedProducts.map((p) => (p.productId === productId ? { ...p, quantity: q } : p)),
        }));
    }, [maxQtyForProduct]);

    const handleBumpQuantity = useCallback(
        (productId: string | number, delta: number) => {
            setFormData((prev) => {
                const line = prev.selectedProducts.find((p) => p.productId === productId);
                if (!line) return prev;
                const max = maxQtyForProduct(productId);
                let q = line.quantity + delta;
                q = Math.max(1, q);
                if (max < 9999) q = Math.min(q, max);
                return {
                    ...prev,
                    selectedProducts: prev.selectedProducts.map((p) =>
                        p.productId === productId ? { ...p, quantity: q } : p,
                    ),
                };
            });
        },
        [maxQtyForProduct],
    );

    const currentTotal = useMemo(() => {
        return formData.selectedProducts.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId || p.id === String(item.productId));
            const price = product?.discountPrice || product?.price || 0;
            return sum + (price * item.quantity);
        }, 0);
    }, [formData.selectedProducts, products]);

    const handleSubmitOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customer || !formData.email || formData.selectedProducts.length === 0) {
            toast.error('Identity (Name/Email) and payload required');
            return;
        }

        const items = formData.selectedProducts.map((item) => {
            const product = products.find(p => p.id === item.productId || p.id === String(item.productId));
            return {
                productId: String(item.productId),
                variantId: (product?.variants?.[0]?.id || String(item.productId)) as string, // Fallback to productId if no variants
                sellerId: product?.sellerId || '',
                quantity: item.quantity,
                pricePerUnit: product?.discountPrice || product?.price || 0,
            };
        });

        const shippingAddress = {
            addressLine1: (formData as any).addressLine1 || 'Direct Entry Address',
            addressLine2: (formData as any).addressLine2 || '',
            city: (formData as any).city || 'Manual City',
            state: (formData as any).state || 'Manual State',
            pincode: (formData as any).pincode || '000000',
        };

        try {
            const result = await createManualOrder({
                customerName: formData.customer,
                customerEmail: formData.email,
                customerPhone: formData.phone,
                items,
                shippingAddress,
                status: formData.status,
                paymentStatus: formData.payment,
            });

            await refreshOrders();
            toast.success(`Order #${result.orderNumber} created successfully.`);
            
            if (result.paymentLink) {
                const copied = await copyText(result.paymentLink);
                toast.success(copied ? 'Payment link generated and copied to clipboard.' : `Payment link generated: ${result.paymentLink}`);
                if (result.emailDispatch?.sent) {
                    toast.success(`Payment link email sent to ${formData.email}.`);
                } else if (result.emailDispatch?.sent === false) {
                    toast.error(`Email sending failed for ${formData.email}: ${result.emailDispatch?.error || 'Invalid email or SMTP issue'}`);
                }
            }

            setIsModalOpen(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to create manual order');
        }
    };

    const handleGeneratePaymentLink = (order: Order | any) => {
        if (!order) return;
        const currentEmail =
            String((order as any).userEmail || (order as any).user?.email || '').trim();
        setPaymentLinkTargetOrder(order as any);
        setPaymentLinkEmail(currentEmail);
        setIsPaymentEmailModalOpen(true);
    };

    const handleConfirmPaymentLinkEmail = () => {
        if (!paymentLinkTargetOrder) return;
        const editedEmail = paymentLinkEmail.trim();
        if (!editedEmail) {
            toast.error('Email is required to send payment link.');
            return;
        }
        const amountInPaise = Math.round(paymentLinkTargetOrder.total * 100);

        toast.promise(
            generateOrderPaymentLink(paymentLinkTargetOrder.id, amountInPaise, {
                name: paymentLinkTargetOrder.customer,
                email: editedEmail,
                contact: (paymentLinkTargetOrder as any).userPhone || (paymentLinkTargetOrder as any).user?.phone
            }),
            {
                loading: 'Initializing Razorpay Telemetry…',
                success: (data) => {
                    if (data.paymentLink) {
                        void copyText(data.paymentLink);
                        setIsPaymentEmailModalOpen(false);
                        if (data.emailDispatch?.sent) {
                            return `Link copied and emailed to ${editedEmail}`;
                        }
                        if (data.emailDispatch?.sent === false) {
                            return `Link copied. Email failed: ${data.emailDispatch?.error || 'invalid email or SMTP issue'}`;
                        }
                        return `Link copied: ${data.paymentLink}`;
                    }
                    return 'Payment link generated.';
                },
                error: (err) => `Link generation failed: ${err.message}`
            }
        );
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
        <div className="space-y-12 pb-20">
            {/* Ultra-Premium Header: Logistics Command Hub */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 group cursor-default">
                        <div className="h-2 w-12 bg-emerald-500 rounded-full group-hover:w-16 transition-all duration-700" />
                        <span className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.3em]">Logistics Command Hub</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase font-heading">
                        Fulfillment <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">Pipeline</span>
                    </h1>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mt-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        Real-time Transactional Telemetry & Flow Control
                    </p>
                </div>
                <div className="flex items-center gap-4 relative z-10">
                    <button
                        onClick={handleOpenModal}
                        className="h-11 px-8 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all duration-700 shadow-xl shadow-slate-900/20 active:scale-95 flex items-center gap-2 group"
                    >
                        <Plus className="h-4 w-4 transition-transform group-hover:rotate-90 duration-500" />
                        Fresh Entry
                    </button>
                </div>
            </div>

            {/* Performance Matrix: High-Contrast Discovery Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Pipeline Load', value: stats.total, icon: ShoppingBag, color: 'emerald', trend: 'Active Nodes', sub: 'In-flight orders' },
                    { label: 'Staging Area', value: stats.pending, icon: Clock, color: 'orange', trend: 'Critical Path', sub: 'Awaiting fulfillment' },
                    { label: 'Net Revenue', value: `₹${(stats.revenue / 1000).toFixed(1)}K`, icon: Zap, color: 'blue', trend: 'Verified Flow', sub: 'Settled transactions' },
                    { label: 'Unit Throughput', value: stats.vols, icon: Box, color: 'purple', trend: 'Operational', sub: 'Total units moved' }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: i * 0.1, ease: [0.23, 1, 0.32, 1] }}
                        key={stat.label}
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-700"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[4rem] group-hover:bg-emerald-50 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-8">
                                <div className={cn(
                                    "h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-700 shadow-lg",
                                    stat.color === 'emerald' ? "bg-emerald-500 text-white shadow-emerald-500/20" :
                                    stat.color === 'orange' ? "bg-orange-500 text-white shadow-orange-500/20" :
                                    stat.color === 'blue' ? "bg-blue-600 text-white shadow-blue-600/20" :
                                    "bg-purple-600 text-white shadow-purple-600/20"
                                )}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{stat.trend}</span>
                                    <div className="flex items-center justify-end gap-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Live</span>
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-1.5 font-heading">{stat.value}</h3>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                            <p className="text-[10px] font-bold text-slate-300 italic">{stat.sub}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Fulfillment Pipeline: Interactive Data Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-premium overflow-hidden relative">
                <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/30">
                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                        {['All', 'Unfulfilled', 'Unpaid', 'Open', 'Closed'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 whitespace-nowrap",
                                    activeTab === tab
                                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105"
                                        : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative group flex-1 max-w-2xl">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-emerald-500 transition-all duration-500 group-focus-within:scale-110" />
                        <input
                            type="text"
                            placeholder="Search by order ID, customer or merchant..."
                            className="w-full h-11 pl-14 pr-6 bg-white border border-slate-100 rounded-xl text-[11px] font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all duration-500 shadow-inner"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[600px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/50">
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Flow Node</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Customer Entity</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Merchant Nodes</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Fiscal State</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Logistic Phase</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Valuation</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Action Console</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {ordersLoading ? (
                                <AdminTableSkeletonRows rows={10} cols={7} />
                            ) : (
                                <AnimatePresence mode='popLayout'>
                                    {displayedOrders.map((order, idx) => {
                                        const variant = getStatusVariant(order.status);
                                        const displayId = (order as any).orderNumber || order.id;
                                        return (
                                            <motion.tr
                                                key={order.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                transition={{ duration: 0.5, delay: idx * 0.03, ease: [0.23, 1, 0.32, 1] }}
                                                className="group hover:bg-slate-50/50 transition-all duration-500 cursor-pointer relative"
                                                onClick={() => handleViewDetails(order)}
                                            >
                                                <td className="px-12 py-10">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">#{displayId}</span>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Clock className="w-3 h-3 text-slate-300" />
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{order.date}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-12 py-10">
                                                    <div className="flex items-center gap-5">
                                                        <div className="h-14 w-14 rounded-[1.5rem] bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-2xl shadow-slate-900/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 font-heading">
                                                            {order.customer.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{order.customer}</span>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <div className="h-4 w-4 rounded-md bg-emerald-50 flex items-center justify-center">
                                                                    <ExternalLink className="h-2 w-2 text-emerald-600" />
                                                                </div>
                                                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                                                                    {order.channel}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-12 py-10">
                                                    {((order as any).vendorNames || []).length > 0 ? (
                                                        <div className="flex flex-wrap gap-2 max-w-[150px]">
                                                            {(((order as any).vendorNames || []) as string[]).slice(0, 2).map((vendorName) => (
                                                                <span
                                                                    key={vendorName}
                                                                    className="inline-flex items-center px-4 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-[9px] font-black uppercase tracking-[0.1em] text-slate-600 group-hover:bg-white group-hover:border-slate-200 transition-all duration-500"
                                                                >
                                                                    {vendorName}
                                                                </span>
                                                            ))}
                                                            {(((order as any).vendorNames || []) as string[]).length > 2 && (
                                                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-900 text-[9px] font-black uppercase tracking-widest text-white shadow-lg">
                                                                    +{(((order as any).vendorNames || []) as string[]).length - 2}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">—</span>
                                                    )}
                                                </td>
                                                <td className="px-12 py-10">
                                                    <div className="flex items-center gap-4 group/select" onClick={e => e.stopPropagation()}>
                                                        <div className={cn(
                                                            "h-4 w-4 rounded-full border-4 border-white shadow-2xl transition-all duration-500", 
                                                            order.payment === 'Paid' ? 'bg-emerald-500 shadow-emerald-500/40 scale-110' :
                                                            order.payment === 'Pending' ? 'bg-amber-500 shadow-amber-500/40' : 'bg-red-500 shadow-red-500/40'
                                                        )} />
                                                        <select
                                                            value={order.payment}
                                                            onChange={(e) => handlePaymentStatusChange(order.id, e.target.value as any)}
                                                            className="bg-white text-[10px] font-black uppercase tracking-[0.15em] text-slate-900 outline-none cursor-pointer px-4 py-2 rounded-xl transition-all border border-slate-100 hover:border-slate-300 hover:shadow-lg focus:ring-4 focus:ring-emerald-500/5"
                                                        >
                                                            {['Pending', 'Paid', 'Refunded'].map(p => (
                                                                <option key={p} value={p}>{p}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="px-12 py-10">
                                                    <div className="flex items-center gap-4 group/select" onClick={e => e.stopPropagation()}>
                                                        <div className={cn(
                                                            "h-4 w-4 rounded-full border-4 border-white shadow-2xl transition-all duration-500", 
                                                            `bg-${variant.color}-500 shadow-${variant.color}-500/40`,
                                                            order.status === 'Delivered' ? 'scale-110' : ''
                                                        )} />
                                                        <select
                                                            value={order.status}
                                                            onChange={(e) => handleStatusChange(order.id, e.target.value as any)}
                                                            className="bg-white text-[10px] font-black uppercase tracking-[0.15em] text-slate-900 outline-none cursor-pointer px-4 py-2 rounded-xl transition-all border border-slate-100 hover:border-slate-300 hover:shadow-lg focus:ring-4 focus:ring-emerald-500/5"
                                                        >
                                                            {['Created', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                                                                <option key={s} value={s}>{getStatusVariant(s).label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="px-12 py-10 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xl font-black text-slate-900 tracking-tighter leading-none font-heading">₹{order.total.toLocaleString()}</span>
                                                        {typeof (order as any).distanceKm === 'number' && (
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1">
                                                                <Truck className="h-2.5 w-2.5" />
                                                                {(order as any).distanceKm.toFixed(1)} km
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-12 py-10">
                                                    <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-3">
                                                            <button
                                                                onClick={() => handleViewDetails(order)}
                                                                className="h-12 w-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-2xl transition-all duration-500 group/btn"
                                                            >
                                                                <Eye className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                                                            </button>
                                                            {order.payment !== 'Paid' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleGeneratePaymentLink(order);
                                                                    }}
                                                                    className="h-12 w-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:shadow-2xl transition-all duration-500 group/btn"
                                                                >
                                                                    <CreditCard className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {user?.role === 'admin' && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                                                            <div className="relative group/rider w-full">
                                                                {deliveryPartners.length > 0 ? (
                                                                    <select
                                                                        defaultValue=""
                                                                        onChange={(e) => {
                                                                            const partnerId = e.target.value;
                                                                            if (!partnerId) return;
                                                                            handleAssignDelivery(order.id, partnerId);
                                                                        }}
                                                                        className="w-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.12em] px-4 py-3 rounded-2xl border border-slate-800 shadow-2xl cursor-pointer hover:bg-emerald-600 transition-all duration-500 appearance-none text-center"
                                                                    >
                                                                        <option value="">Deploy Rider (Online)</option>
                                                                        {deliveryPartners.map((p) => (
                                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <div className="mx-auto min-w-[220px] bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl border border-slate-800 shadow-2xl h-12 px-6 flex items-center justify-center tracking-[0.12em]">
                                                                        No rider online
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>

                    {displayedOrders.length === 0 && !ordersLoading && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-40 text-center"
                        >
                            <div className="h-24 w-24 rounded-[3rem] bg-slate-50 flex items-center justify-center mx-auto mb-8 border border-dashed border-slate-200">
                                <Box className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter font-heading">Pipeline is empty.</h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-4 max-w-xs mx-auto opacity-60">Adjust your telemetry parameters <br />to capture transactional data.</p>
                        </motion.div>
                    )}
                </div>
            </div>
            {/* Order details side sheet: Payload Analysis */}
            {isDetailOpen && selectedOrder && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
                            onClick={() => setIsDetailOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 35, stiffness: 300, mass: 1 }}
                            className="relative h-full w-full max-w-3xl bg-white/95 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border-l border-white/20"
                        >
                            {/* Sheet Header: Static Control Node */}
                            <div className="flex-shrink-0 sticky top-0 z-20 p-12 bg-white/50 backdrop-blur-md border-b border-slate-100 flex items-center justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 bg-slate-900 rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-slate-900/20 rotate-3">
                                            <FileText className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter font-heading">
                                                Flow Node <span className="text-emerald-600">#{(selectedOrder as any).orderNumber || selectedOrder.id}</span>
                                            </h2>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Payload Analysis & Flow Control v4.5</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    {selectedOrder.payment !== 'Paid' && (
                                        <button 
                                            onClick={() => handleGeneratePaymentLink(selectedOrder)} 
                                            className="h-14 w-14 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-orange-500 hover:border-orange-500 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500 flex items-center justify-center group"
                                        >
                                            <CreditCard className="h-6 w-6 transition-transform group-hover:scale-110" />
                                        </button>
                                    )}
                                    <button onClick={() => setIsDetailOpen(false)} className="h-14 w-14 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-2xl transition-all duration-500 flex items-center justify-center group">
                                        <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto p-12 space-y-16 custom-scrollbar">
                                {/* Telemetry Matrix: Quick Stats */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Logistic Phase', value: selectedOrder.status, color: 'blue' },
                                        { label: 'Fiscal State', value: selectedOrder.payment, color: 'emerald' },
                                        { label: 'Origin Point', value: selectedOrder.channel, color: 'purple' },
                                        { label: 'Net Asset Value', value: `₹${selectedOrder.total.toLocaleString()}`, color: 'slate', highlight: true }
                                    ].map((item, i) => (
                                        <div key={i} className={cn(
                                            "p-6 rounded-[2rem] border transition-all duration-500",
                                            item.highlight ? "bg-slate-900 border-slate-800 text-white shadow-2xl shadow-slate-900/20" : "bg-slate-50 border-slate-100 hover:border-slate-300"
                                        )}>
                                            <p className={cn("text-[9px] font-black uppercase tracking-widest mb-3", item.highlight ? "text-slate-500" : "text-slate-400")}>{item.label}</p>
                                            <p className={cn("text-[13px] font-black uppercase tracking-tight font-heading", item.highlight ? "text-emerald-400" : "text-slate-900")}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Payload Composition: Items List */}
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
                                            Payload Composition
                                        </h3>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                                            {selectedOrder.itemsDetails?.length} Distinct Entities
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {selectedOrder.itemsDetails?.map((item, idx) => {
                                            const product = products.find(p => String(p.id) === String(item.productId));
                                            return (
                                                <div key={idx} className="flex items-center gap-8 p-8 rounded-[3rem] bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-[0_30px_60px_rgba(0,0,0,0.05)] transition-all duration-700 group">
                                                    <div className="h-24 w-24 rounded-[2.5rem] bg-slate-50 overflow-hidden shadow-2xl shadow-slate-900/5 group-hover:scale-105 group-hover:rotate-2 transition-all duration-700 border border-slate-100">
                                                        <img src={product?.image} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-xl font-black text-slate-900 uppercase tracking-tighter truncate font-heading">{product?.name}</p>
                                                            <p className="text-lg font-black text-slate-900 tracking-tighter font-heading">₹{((product?.discountPrice || product?.price || 0) * item.quantity).toLocaleString()}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
                                                                <Zap className="h-3 w-3 text-emerald-600" />
                                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{product?.vendor}</span>
                                                            </div>
                                                            <div className="h-5 w-[1px] bg-slate-100" />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantum: {item.quantity} {product?.unit || 'kg'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Identity & Logistics Nodes */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Identity Node */}
                                    <div className="p-10 rounded-[3.5rem] bg-slate-50 border border-slate-100 space-y-10 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-bl-[4rem] pointer-events-none transition-all duration-700 group-hover:bg-emerald-500/5" />
                                        <div className="relative z-10 flex items-center gap-5">
                                            <div className="h-16 w-16 rounded-[2rem] bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-2xl shadow-slate-900/20 font-heading">
                                                {selectedOrder.customer.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Receiver Entity</p>
                                                <p className="text-xl font-black text-slate-900 uppercase tracking-tight font-heading">{selectedOrder.customer}</p>
                                            </div>
                                        </div>
                                        <div className="relative z-10 space-y-5">
                                            <div className="flex items-center gap-5 text-slate-600 group/item cursor-default">
                                                <div className="h-10 w-10 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover/item:text-emerald-500 group-hover/item:border-emerald-500 transition-all duration-500">
                                                    <Mail className="w-5 h-5" />
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-tight">
                                                    {(selectedOrder as any).userEmail || 'NO EMAIL AVAILABLE'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-5 text-slate-600 group/item cursor-default">
                                                <div className="h-10 w-10 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover/item:text-blue-500 group-hover/item:border-blue-500 transition-all duration-500">
                                                    <Phone className="w-5 h-5" />
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-tight">
                                                    {(selectedOrder as any).userPhone || 'NO PHONE AVAILABLE'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Logistic Node */}
                                    <div className="p-10 rounded-[3.5rem] bg-slate-900 border border-slate-800 space-y-8 relative overflow-hidden group text-white">
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="h-10 w-10 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-white/10">
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Shipping Terminal</span>
                                            </div>
                                            <p className="text-[13px] font-black uppercase leading-relaxed tracking-tight group-hover:text-emerald-400 transition-colors duration-700 min-h-[80px]">
                                                {(() => {
                                                    const addr = (selectedOrder as any).shippingAddress || {};
                                                    const parts = [
                                                        addr.addressLine1 || addr.address || '',
                                                        addr.addressLine2 || '',
                                                        addr.city || '',
                                                        addr.state || '',
                                                        addr.pincode || addr.zipCode || '',
                                                    ].filter((v: string) => v && String(v).trim());
                                                    return parts.length ? parts.join(', ') : 'Terminal location undefined';
                                                })()}
                                            </p>
                                            <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                                                        <Truck className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">Carrier Unit</p>
                                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                                            {(selectedOrder as any).courierName || 'Standby for deployment'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-all duration-1000" />
                                    </div>
                                </div>

                                {/* Temporal Flow: Order Lifecycle */}
                                <div className="space-y-12 pb-12">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <div className="h-1.5 w-8 bg-blue-500 rounded-full" />
                                            Temporal Lifecycle
                                        </h3>
                                    </div>
                                    <div className="relative pl-14 space-y-14">
                                        <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-slate-100" />
                                        {[
                                            { status: 'Final Delivery', date: 'Oct 23, 2023 | 16:15 IST', active: selectedOrder.status === 'Delivered', icon: CheckCircle2, color: 'emerald' },
                                            { status: 'Logistic Transit', date: 'Oct 23, 2023 | 11:30 IST', active: ['Shipped', 'Delivered'].includes(selectedOrder.status), icon: Truck, color: 'blue' },
                                            { status: 'Node Preparation', date: 'Oct 22, 2023 | 20:30 IST', active: ['Packed', 'Shipped', 'Delivered'].includes(selectedOrder.status), icon: Package, color: 'orange' },
                                            { status: 'System Ingestion', date: `${selectedOrder.date} | 14:45 IST`, active: true, icon: ShoppingBag, color: 'slate' },
                                        ].map((step, idx) => (
                                            <div key={idx} className={cn("flex flex-col relative z-10 transition-all duration-1000", step.active ? "opacity-100 translate-x-0" : "opacity-20 translate-x-4")}>
                                                <div className={cn(
                                                    "absolute -left-[54px] top-0 h-14 w-14 rounded-[1.75rem] border-4 border-white shadow-2xl flex items-center justify-center transition-all duration-700",
                                                    step.active ? "bg-slate-900 text-white scale-110 shadow-slate-900/20" : "bg-white text-slate-200"
                                                )}>
                                                    <step.icon className={cn("h-6 w-6", step.active && step.color === 'emerald' ? "text-emerald-400" : "")} />
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-base font-black text-slate-900 uppercase tracking-tight font-heading">{step.status}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] italic">{step.date}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Control Actions: Fixed Footer */}
                            <div className="flex-shrink-0 p-12 bg-slate-50/50 backdrop-blur-md border-t border-slate-100 flex gap-6">
                                <button
                                    onClick={() => handleStatusChange(selectedOrder.id, 'Cancelled')}
                                    className="flex-1 h-18 bg-white border border-slate-200 text-slate-400 rounded-3xl hover:bg-red-50 hover:text-red-500 hover:border-red-200 font-black text-[11px] uppercase tracking-widest transition-all duration-500 hover:shadow-2xl shadow-sm"
                                >
                                    Abort Session
                                </button>
                                <button
                                    className="flex-[2] h-18 bg-slate-900 text-white rounded-3xl hover:bg-emerald-600 font-black text-[11px] uppercase tracking-widest transition-all duration-700 shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-4 group"
                                >
                                    <Zap className="w-5 h-5 text-emerald-400 transition-transform group-hover:scale-110" />
                                    Initiate Fulfillment Flow
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
            {isPaymentEmailModalOpen && paymentLinkTargetOrder && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[140] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                            onClick={() => setIsPaymentEmailModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.96 }}
                            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
                            className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Send payment link</h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Order #{(paymentLinkTargetOrder as any).orderNumber || paymentLinkTargetOrder.id}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsPaymentEmailModalOpen(false)}
                                    className="h-10 w-10 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors"
                                >
                                    <X className="h-4 w-4 mx-auto" />
                                </button>
                            </div>

                            <div className="mt-6 space-y-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                    Customer email
                                </label>
                                <input
                                    type="email"
                                    value={paymentLinkEmail}
                                    onChange={(e) => setPaymentLinkEmail(e.target.value)}
                                    placeholder="customer@example.com"
                                    className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                                />
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsPaymentEmailModalOpen(false)}
                                    className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPaymentLinkEmail}
                                    className="h-11 px-6 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                                >
                                    Send link
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
            {/* Direct Entry Node: Manual Order Generation */}
            {isModalOpen && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 md:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/70 backdrop-blur-2xl"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 50, rotateX: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 50, rotateX: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative bg-white/95 backdrop-blur-3xl rounded-[4rem] shadow-[0_40px_120px_rgba(0,0,0,0.3)] w-full max-w-4xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="flex-shrink-0 p-12 border-b border-slate-100 bg-white/50 flex items-center justify-between">
                                <div>
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase font-heading">Direct <span className="text-emerald-600">Entry</span></h2>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                                        <Activity className="w-3 h-3 text-emerald-500" />
                                        High-Tier Commercial Order Generation
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="h-14 w-14 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-2xl transition-all duration-500 flex items-center justify-center group"
                                >
                                    <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
                                {/* Customer Identity Module */}
                                <div className="space-y-8">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                        <div className="h-1.5 w-8 bg-blue-500 rounded-full" />
                                        Customer Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Name</label>
                                            <input
                                                required
                                                placeholder="Enter full customer name"
                                                value={formData.customer}
                                                onChange={e => setFormData({ ...formData, customer: e.target.value })}
                                                className="w-full h-18 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-sm font-black text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all duration-500"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                            <input
                                                required
                                                type="email"
                                                placeholder="customer@example.com"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full h-18 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-sm font-black text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all duration-500"
                                            />
                                        </div>
                                        <div className="space-y-3 md:col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                            <input
                                                required
                                                placeholder="+91 98765 43210"
                                                value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full h-18 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-sm font-black text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all duration-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Logistics Module */}
                                <div className="space-y-8">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                        <div className="h-1.5 w-8 bg-orange-500 rounded-full" />
                                        Delivery Address
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3 md:col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address Line 1</label>
                                            <input
                                                required
                                                placeholder="House/Flat, Street, Area"
                                                value={(formData as any).addressLine1 || ''}
                                                onChange={e => setFormData({ ...formData, addressLine1: e.target.value } as any)}
                                                className="w-full h-18 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-sm font-black text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all duration-500"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label>
                                            <input
                                                required
                                                placeholder="Enter city name"
                                                value={(formData as any).city || ''}
                                                onChange={e => setFormData({ ...formData, city: e.target.value } as any)}
                                                className="w-full h-18 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-sm font-black text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all duration-500"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pincode</label>
                                            <input
                                                required
                                                placeholder="Enter 6-digit pincode"
                                                value={(formData as any).pincode || ''}
                                                onChange={e => setFormData({ ...formData, pincode: e.target.value } as any)}
                                                className="w-full h-18 rounded-3xl bg-slate-50 border border-slate-100 px-8 text-sm font-black text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all duration-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Asset Selection Module */}
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
                                            Add Products
                                        </h3>
                                    </div>
                                    <div className="relative group">
                                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-emerald-500 transition-all duration-500" />
                                        <input
                                            type="text"
                                            placeholder="Search products by name, seller, or SKU..."
                                            value={freshEntryProductSearch}
                                            onChange={(e) => setFreshEntryProductSearch(e.target.value)}
                                            className="w-full h-16 pl-16 pr-8 rounded-[1.25rem] border border-slate-100 bg-slate-50 text-[13px] font-bold text-slate-900 focus:bg-white focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all duration-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {catalogForFreshEntry.map((product) => {
                                            const stock = Number(product.availableStock ?? product.stock ?? 0);
                                            const disabled = stock <= 0;
                                            return (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => handleAddProduct(product.id)}
                                                    className={cn(
                                                        'flex flex-col items-center gap-3 p-6 rounded-3xl bg-white border text-center transition-all duration-500 group relative',
                                                        disabled
                                                            ? 'border-slate-50 opacity-40 grayscale cursor-not-allowed'
                                                            : 'border-slate-100 hover:border-emerald-500 hover:shadow-2xl hover:-translate-y-1',
                                                    )}
                                                >
                                                    <div className="h-16 w-16 rounded-2xl bg-slate-50 overflow-hidden flex items-center justify-center mb-1 group-hover:scale-110 transition-all duration-700">
                                                        <img
                                                            src={getImageDisplayUrl(product.image || '')}
                                                            alt=""
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight line-clamp-1 w-full">{product.name}</p>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stock > 0 ? `Stock: ${stock}` : 'Depleted'}</span>
                                                    {!disabled && (
                                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <div className="h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                                                <Plus className="h-3 w-3 text-white" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Summary Module */}
                                {formData.selectedProducts.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="rounded-[3.5rem] bg-slate-900 p-12 space-y-10 text-white shadow-[0_40px_100px_rgba(0,0,0,0.2)] relative overflow-hidden group"
                                    >
                                        <div className="relative z-10 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-1.5 w-12 bg-emerald-500 rounded-full" />
                                                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400">Payload Manifest</p>
                                            </div>
                                            <Activity className="w-8 h-8 text-emerald-500 opacity-20 animate-pulse" />
                                        </div>
                                        <div className="relative z-10 space-y-5">
                                            {formData.selectedProducts.map(item => {
                                                const product = products.find(p => String(p.id) === String(item.productId));
                                                const maxQ = maxQtyForProduct(item.productId);
                                                return (
                                                    <div key={item.productId} className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 bg-white/5 rounded-[2.5rem] border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-500">
                                                        <div className="flex items-center gap-5 flex-1 min-w-0">
                                                            <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                                                                <Box className="w-6 h-6 text-white/20" />
                                                            </div>
                                                            <div className="truncate">
                                                                <span className="text-[13px] font-black uppercase tracking-tight block truncate">{product?.name}</span>
                                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{product?.unit || 'kg'} Unit</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 shrink-0">
                                                            <div className="flex items-center bg-black/40 rounded-2xl p-1.5 border border-white/5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleBumpQuantity(item.productId, -1)}
                                                                    disabled={item.quantity <= 1}
                                                                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all disabled:opacity-20"
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleSetLineQuantity(item.productId, Number(e.target.value))}
                                                                    className="w-16 bg-transparent text-center text-sm font-black text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleBumpQuantity(item.productId, 1)}
                                                                    disabled={maxQ < 9999 && item.quantity >= maxQ}
                                                                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all disabled:opacity-20"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleRemoveProduct(item.productId)}
                                                                className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all duration-500"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="relative z-10 pt-10 border-t border-white/5 flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Aggregate Valuation</p>
                                                <p className="text-6xl font-black text-emerald-400 tracking-tighter font-heading leading-none">₹{currentTotal.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Session Token</p>
                                                <p className="text-xs font-black text-white/60 tracking-widest">A7-X92-FLUX</p>
                                            </div>
                                        </div>
                                        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] group-hover:bg-emerald-500/20 transition-all duration-1000" />
                                    </motion.div>
                                )}
                            </form>

                            {/* Modal Footer Actions */}
                            <div className="flex-shrink-0 p-12 bg-white border-t border-slate-100 flex gap-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 h-18 bg-white border border-slate-200 text-slate-400 rounded-3xl hover:bg-slate-50 hover:text-slate-900 font-black text-[11px] uppercase tracking-widest transition-all duration-500"
                                >
                                    Abort Entry
                                </button>
                                <button
                                    onClick={handleSubmitOrder}
                                    type="submit"
                                    className="flex-[2.5] h-18 bg-slate-900 text-white rounded-3xl hover:bg-emerald-600 font-black text-[11px] uppercase tracking-widest transition-all duration-700 shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-4 group"
                                >
                                    <Zap className="w-5 h-5 text-emerald-400 transition-transform group-hover:scale-110" />
                                    Generate Flow Node
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
