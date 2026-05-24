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
import { getUserErrorMessage } from '@/lib/userError';

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
        const dp = firstDelivery?.deliveryPartner;
        const courierName: string | null = dp?.name ?? null;
        const deliveryPartnerId: string | null =
            dp?.id != null && String(dp.id).trim() !== '' ? String(dp.id) : null;
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
            itemsDetails: api.items?.map((i: any) => ({
                productId: i.productId,
                quantity: Number(i.quantity || 0),
                pricePerUnit: Number(i.pricePerUnit ?? 0),
                subtotal: Number(i.subtotal ?? (Number(i.pricePerUnit || 0) * Number(i.quantity || 0))),
                productName: String(i?.product?.name || ''),
                productImage: String(i?.product?.images?.[0]?.imageUrl || ''),
                variantName: String(i?.variant?.attributeValue || ''),
                vendorName: String(i?.seller?.storeName || ''),
            })) ?? [],
            shippingAddress: api.shippingAddress || null,
            courierName,
            deliveryPartnerId,
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

    const patchLocalOrder = useCallback((id: string, patch: any) => {
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
            toast.error(getUserErrorMessage(e, 'Failed to update order status'));
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
            toast.error(getUserErrorMessage(e, 'Failed to update payment status'));
        }
    }, [orders, patchLocalOrder, refreshOrders]);

    const handleAssignDelivery = useCallback(async (orderId: string, partnerId: string) => {
        if (!partnerId) return;
        const current = orders.find((o) => String((o as any).id) === String(orderId)) as any;
        const partnerName = deliveryPartners.find((p) => String(p.id) === String(partnerId))?.name || current?.courierName || null;
        if (current) {
            patchLocalOrder(orderId, {
                courierName: partnerName as any,
                deliveryPartnerId: partnerId as any,
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
                    deliveryPartnerId: (current as any).deliveryPartnerId ?? null,
                    status: current.status,
                });
            }
            toast.error(getUserErrorMessage(e, 'Failed to assign delivery partner'));
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
            toast.error(getUserErrorMessage(err, 'Failed to create manual order'));
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
        <div className="space-y-6 pb-20">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="admin-panel-page-title">Orders</h1>
                    <p className="admin-panel-page-subtitle">Manage and track all customer orders</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleOpenModal}
                        className="admin-panel-btn-primary h-9 px-4 rounded-xl text-xs font-bold"
                    >
                        <Plus className="h-4 w-4" />
                        New Order
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Active Orders', value: stats.total, icon: ShoppingBag, color: 'emerald', sub: 'In-flight orders' },
                    { label: 'Awaiting Fulfillment', value: stats.pending, icon: Clock, color: 'orange', sub: 'Not yet dispatched' },
                    { label: 'Net Revenue', value: `₹${(stats.revenue / 1000).toFixed(1)}K`, icon: Zap, color: 'blue', sub: 'Settled transactions' },
                    { label: 'Total Units', value: stats.vols, icon: Box, color: 'purple', sub: 'Units in pipeline' }
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        className="admin-panel-stat-card"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={cn(
                                "h-9 w-9 rounded-xl flex items-center justify-center border",
                                stat.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-700' :
                                stat.color === 'orange' ? 'bg-amber-500/10 border-amber-500/15 text-amber-700' :
                                stat.color === 'blue' ? 'bg-blue-500/10 border-blue-500/15 text-blue-700' :
                                'bg-purple-500/10 border-purple-500/15 text-purple-700'
                            )}>
                                <stat.icon className="w-4 h-4" />
                            </div>
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>
                        <p className="admin-panel-stat-value">{stat.value}</p>
                        <p className="admin-panel-stat-label">{stat.label}</p>
                        <p className="text-xs text-zinc-400 mt-1 font-medium">{stat.sub}</p>
                    </motion.div>
                ))}
            </div>

            {/* Orders table */}
            <div className="admin-panel-card">
                <div className="p-4 md:p-6 border-b border-zinc-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200/50 overflow-x-auto no-scrollbar">
                        {['All', 'Unfulfilled', 'Unpaid', 'Open', 'Closed'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 whitespace-nowrap",
                                    activeTab === tab
                                        ? "bg-white text-zinc-900 shadow-sm"
                                        : "text-zinc-500 hover:text-zinc-700"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Search + export */}
                    <div className="flex items-center gap-2 flex-1 max-w-xl">
                        <div className="relative group flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search by order, customer, or vendor…"
                                className="admin-panel-input pl-10 h-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button onClick={handleExportLedger} className="admin-panel-btn-secondary flex-shrink-0 h-10 px-4 rounded-xl text-xs font-bold">
                            Export CSV
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-200/50 bg-zinc-50/50">
                                <th className="admin-panel-th">Order</th>
                                <th className="admin-panel-th">Customer</th>
                                <th className="admin-panel-th">Vendor(s)</th>
                                <th className="admin-panel-th">Payment</th>
                                <th className="admin-panel-th">Status</th>
                                <th className="admin-panel-th text-right">Total</th>
                                <th className="admin-panel-th text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
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
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 8 }}
                                                transition={{ duration: 0.25, delay: idx * 0.03 }}
                                                className="admin-panel-tr cursor-pointer"
                                                onClick={() => handleViewDetails(order)}
                                            >
                                                <td className="admin-panel-td">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-zinc-900 hover:text-emerald-600 transition-colors">#{displayId}</span>
                                                        <span className="text-xs text-zinc-400 mt-1 flex items-center gap-1 font-medium">
                                                            <Clock className="w-3 h-3 text-zinc-450" />
                                                            {order.date}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="admin-panel-td">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-8 w-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 border border-zinc-800">
                                                            {order.customer.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-zinc-800 leading-snug">{order.customer}</span>
                                                            <span className="text-xs text-zinc-400 font-medium leading-none mt-0.5">{order.channel}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="admin-panel-td" onClick={e => e.stopPropagation()}>
                                                    {((order as any).vendorNames || []).length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {(((order as any).vendorNames || []) as string[]).slice(0, 2).map((vendorName) => (
                                                                <span
                                                                    key={vendorName}
                                                                    className="admin-panel-badge-zinc text-[10px]"
                                                                >
                                                                    {vendorName}
                                                                </span>
                                                            ))}
                                                            {(((order as any).vendorNames || []) as string[]).length > 2 && (
                                                                <span className="admin-panel-badge-zinc text-[10px]">
                                                                    +{(((order as any).vendorNames || []) as string[]).length - 2}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-zinc-350 font-medium">—</span>
                                                    )}
                                                </td>
                                                <td className="admin-panel-td">
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <div className={cn(
                                                            "h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(0,0,0,0.15)]", 
                                                            order.payment === 'Paid' ? 'bg-emerald-500 shadow-emerald-500/40' :
                                                            order.payment === 'Pending' ? 'bg-amber-500 shadow-amber-500/40' : 'bg-red-500 shadow-red-500/40'
                                                        )} />
                                                        <select
                                                            value={order.payment}
                                                            onChange={(e) => handlePaymentStatusChange(order.id, e.target.value as any)}
                                                            className="h-8 px-2 py-0 rounded-xl border border-zinc-200/60 bg-zinc-55 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-800 transition-all cursor-pointer font-semibold"
                                                        >
                                                            {['Pending', 'Paid', 'Refunded'].map(p => (
                                                                <option key={p} value={p}>{p}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="admin-panel-td">
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <div className={cn(
                                                            "h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(0,0,0,0.15)]", 
                                                            variant.color === 'emerald' ? 'bg-emerald-500 shadow-emerald-500/40' :
                                                            variant.color === 'amber' ? 'bg-amber-500 shadow-amber-500/40' :
                                                            variant.color === 'blue' ? 'bg-blue-500 shadow-blue-500/40' :
                                                            variant.color === 'indigo' ? 'bg-indigo-500 shadow-indigo-500/40' :
                                                            variant.color === 'purple' ? 'bg-purple-500 shadow-purple-500/40' :
                                                            'bg-red-500 shadow-red-500/40'
                                                        )} />
                                                        <select
                                                            value={order.status}
                                                            onChange={(e) => handleStatusChange(order.id, e.target.value as any)}
                                                            className="h-8 px-2 py-0 rounded-xl border border-zinc-200/60 bg-zinc-55 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-800 transition-all cursor-pointer font-semibold"
                                                        >
                                                            {['Created', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                                                                <option key={s} value={s}>{getStatusVariant(s).label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="admin-panel-td text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-bold text-zinc-900 tracking-tight">₹{order.total.toLocaleString()}</span>
                                                        {typeof (order as any).distanceKm === 'number' && (
                                                            <span className="text-xs text-zinc-400 flex items-center gap-1 mt-1 font-semibold">
                                                                <Truck className="h-3.5 w-3.5 text-zinc-450" />
                                                                {(order as any).distanceKm.toFixed(1)} km
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="admin-panel-td">
                                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                onClick={() => handleViewDetails(order)}
                                                                title="View Details"
                                                                className="h-8 w-8 flex items-center justify-center bg-white border border-zinc-200 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all shadow-sm"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            {order.payment !== 'Paid' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleGeneratePaymentLink(order);
                                                                    }}
                                                                    title="Payment Link"
                                                                    className="h-8 w-8 flex items-center justify-center bg-white border border-zinc-200 rounded-xl text-zinc-500 hover:text-orange-600 hover:bg-zinc-100 transition-all shadow-sm"
                                                                >
                                                                    <CreditCard className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {user?.role === 'admin' && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                                                            <div className="relative w-full max-w-[180px] shrink-0">
                                                                {(() => {
                                                                    const assignedIdRaw = (order as any).deliveryPartnerId as string | null | undefined;
                                                                    const assignedName = (order as any).courierName as string | null | undefined;
                                                                    const merged: typeof deliveryPartners = [...deliveryPartners];
                                                                    if (assignedIdRaw && !merged.some((p) => String(p.id) === String(assignedIdRaw))) {
                                                                        merged.unshift({
                                                                            id: assignedIdRaw,
                                                                            name: assignedName || 'Assigned rider',
                                                                            status: 'ACTIVE',
                                                                            onlineStatus: 'OFFLINE',
                                                                        });
                                                                    }
                                                                    const currentValue = assignedIdRaw
                                                                        ? String(assignedIdRaw)
                                                                        : assignedName
                                                                          ? String(merged.find((p) => p.name === assignedName)?.id ?? '')
                                                                          : '';
                                                                    if (merged.length === 0) {
                                                                        return (
                                                                            <span className="text-[11px] text-zinc-400 font-semibold">No rider online</span>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <select
                                                                            value={currentValue}
                                                                            onChange={(e) => {
                                                                                const partnerId = e.target.value;
                                                                                if (!partnerId) return;
                                                                                handleAssignDelivery(order.id, partnerId);
                                                                            }}
                                                                            className="w-full h-8 px-2 py-0 rounded-xl border border-zinc-200/60 bg-zinc-55 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-800 transition-all cursor-pointer font-semibold"
                                                                        >
                                                                            {!currentValue ? (
                                                                                <option value="">Deploy Rider (Online)</option>
                                                                            ) : null}
                                                                            {merged.map((p) => (
                                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    );
                                                                })()}
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
                        <div className="py-20 text-center">
                            <div className="h-16 w-16 bg-zinc-50 rounded-2xl border border-zinc-200/50 flex items-center justify-center mx-auto mb-4">
                                <Box className="w-8 h-8 text-zinc-350" />
                            </div>
                            <h3 className="text-base font-bold text-zinc-900 tracking-tight">No orders found</h3>
                            <p className="text-xs text-zinc-400 mt-1 font-semibold">Try adjusting your filters or search terms.</p>
                        </div>
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
                            {/* Sheet header */}
                            <div className="flex-shrink-0 sticky top-0 z-20 px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">
                                            Order #{(selectedOrder as any).orderNumber || selectedOrder.id}
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-0.5">Order details &amp; status management</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {selectedOrder.payment !== 'Paid' && (
                                        <button 
                                            onClick={() => handleGeneratePaymentLink(selectedOrder)} 
                                            className="admin-btn-icon"
                                            title="Generate payment link"
                                        >
                                            <CreditCard className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button onClick={() => setIsDetailOpen(false)} className="admin-btn-icon">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto p-12 space-y-16 custom-scrollbar">
                                {/* Order quick stats */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Status', value: selectedOrder.status },
                                        { label: 'Payment', value: selectedOrder.payment },
                                        { label: 'Channel', value: selectedOrder.channel },
                                        { label: 'Total', value: `₹${selectedOrder.total.toLocaleString()}`, highlight: true }
                                    ].map((item, i) => (
                                        <div key={i} className={cn(
                                            "p-4 rounded-xl border",
                                            item.highlight ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-100"
                                        )}>
                                            <p className={cn("text-xs font-medium mb-1.5", item.highlight ? "text-slate-400" : "text-slate-500")}>{item.label}</p>
                                            <p className={cn("text-sm font-semibold", item.highlight ? "text-emerald-400" : "text-slate-900")}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Order items */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="admin-section-heading">Order Items</h3>
                                        <span className="admin-badge-slate">
                                            {selectedOrder.itemsDetails?.length} item{selectedOrder.itemsDetails?.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {selectedOrder.itemsDetails?.map((item, idx) => {
                                            const product = products.find(p => String(p.id) === String(item.productId));
                                            const productName = String((item as any).productName || product?.name || 'Unknown Product');
                                            const productImage = String((item as any).productImage || product?.image || '');
                                            const variantName = String((item as any).variantName || '').trim();
                                            const vendorName = String((item as any).vendorName || product?.vendor || 'Store');
                                            const qty = Number((item as any).quantity || 0);
                                            const unitPrice = Number((item as any).pricePerUnit || 0);
                                            const subtotal = Number((item as any).subtotal || (unitPrice * qty));
                                            return (
                                                <div key={idx} className="flex items-center gap-8 p-8 rounded-[3rem] bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-[0_30px_60px_rgba(0,0,0,0.05)] transition-all duration-700 group">
                                                    <div className="h-24 w-24 rounded-[2.5rem] bg-slate-50 overflow-hidden shadow-2xl shadow-slate-900/5 group-hover:scale-105 group-hover:rotate-2 transition-all duration-700 border border-slate-100">
                                                        <img src={productImage} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-xl font-black text-slate-900 uppercase tracking-tighter truncate font-heading">{productName}</p>
                                                            <p className="text-lg font-black text-slate-900 tracking-tighter font-heading">₹{subtotal.toLocaleString()}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
                                                                <Zap className="h-3 w-3 text-emerald-600" />
                                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{vendorName}</span>
                                                            </div>
                                                            <div className="h-5 w-[1px] bg-slate-100" />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                Quantum: {qty} × ₹{unitPrice || 0}
                                                                {variantName ? ` · ${variantName}` : ''}
                                                            </span>
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
