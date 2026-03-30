import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    MapPin,
    Phone,
    Package,
    CheckCircle,
    Truck,
    XCircle,
    Loader,
    KeyRound,
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { getEffectiveApiBase } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DeliveryOrderItem {
    id: string;
    quantity: number;
    subtotal: number;
    product: { name: string; unit: string };
}

interface DeliveryAssignmentDetail {
    id: string;
    status: string | null;
    createdAt: string;
    hasActiveOtp?: boolean;
    otpGeneratedAt?: string | null;
    otpExpiresAt?: string | null;
    order: {
        id: string;
        orderNumber: string;
        payableAmount: number;
        paymentStatus: string;
        deliverySlot: string | null;
        shippingAddress: any;
        user: { firstName: string | null; lastName: string | null; phone: string | null };
        items: DeliveryOrderItem[];
    };
}

const STATUS_OPTIONS = [
    { value: 'PICKED_UP', label: 'Picked up', icon: Package },
    { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery', icon: Truck },
    { value: 'DELIVERED', label: 'Delivered', icon: CheckCircle },
    { value: 'FAILED', label: 'Failed', icon: XCircle },
] as const;

export function DeliveryAssignmentDetailPage() {
    const { user } = useAuth();
    const { id } = useParams<{ id: string }>();
    const [assignment, setAssignment] = useState<DeliveryAssignmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [generatingOtp, setGeneratingOtp] = useState(false);
    const [otpMeta, setOtpMeta] = useState<{ generatedAt: string | null; expiresAt: string | null; active: boolean }>({
        generatedAt: null,
        expiresAt: null,
        active: false,
    });
    const [otpCode, setOtpCode] = useState('');

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${getEffectiveApiBase()}/delivery/assignments/${id}`, {
                    headers: { Authorization: token ? `Bearer ${token}` : '' },
                });
                if (!res.ok) throw new Error('Failed to load assignment');
                const detail = await res.json();
                setAssignment(detail);
                setOtpMeta({
                    generatedAt: detail?.otpGeneratedAt ?? null,
                    expiresAt: detail?.otpExpiresAt ?? null,
                    active: !!detail?.hasActiveOtp,
                });
            } catch (e: any) {
                toast.error(e?.message || 'Unable to load assignment');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handleUpdateStatus = async (status: string) => {
        if (!id) return;
        if (status === 'DELIVERED') {
            const otp = otpCode.trim();
            if (!/^\d{6}$/.test(otp)) {
                toast.error('Enter a valid 6-digit OTP to complete delivery.');
                return;
            }
            setUpdating(true);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${getEffectiveApiBase()}/delivery/assignments/${id}/verify-otp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: token ? `Bearer ${token}` : '',
                    },
                    body: JSON.stringify({ otp }),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body?.message || 'Failed to verify OTP');
                setAssignment((prev) => (prev ? { ...prev, status: 'DELIVERED' } : prev));
                setOtpMeta({ generatedAt: null, expiresAt: null, active: false });
                setOtpCode('');
                toast.success(body?.message || 'Delivery completed successfully.');
            } catch (e: any) {
                toast.error(e?.message || 'Unable to verify OTP');
            } finally {
                setUpdating(false);
            }
            return;
        }

        let reason: string | undefined;
        if (status === 'FAILED') {
            reason = window.prompt('Reason for failed delivery? (e.g. customer unavailable, payment issue)') || '';
            if (!reason.trim()) {
                toast.error('Please enter a reason for failed delivery.');
                return;
            }
        }
        setUpdating(true);
        try {
            const token = localStorage.getItem('token');
            let lat: number | undefined;
            let lng: number | undefined;
            if ('geolocation' in navigator) {
                try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    });
                    lat = pos.coords.latitude;
                    lng = pos.coords.longitude;
                } catch {
                    // ignore
                }
            }
            const res = await fetch(`${getEffectiveApiBase()}/delivery/assignments/${id}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({ status, lat, lng, reason }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.message || 'Failed to update status');
            const json = body;
            setAssignment((prev) => (prev ? { ...prev, status: json.status } : prev));
            toast.success(`Status updated to ${status}`);
        } catch (e: any) {
            toast.error(e?.message || 'Unable to update status');
        } finally {
            setUpdating(false);
        }
    };

    const handleGenerateOtp = async () => {
        if (!id) return;
        setGeneratingOtp(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${getEffectiveApiBase()}/delivery/assignments/${id}/generate-otp`, {
                method: 'POST',
                headers: {
                    Authorization: token ? `Bearer ${token}` : '',
                },
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.message || 'Failed to generate OTP');
            setOtpMeta({
                generatedAt: body?.generatedAt || new Date().toISOString(),
                expiresAt: body?.expiresAt || null,
                active: true,
            });
            toast.success(body?.message || 'OTP generated successfully.');
        } catch (e: any) {
            toast.error(e?.message || 'Unable to generate OTP');
        } finally {
            setGeneratingOtp(false);
        }
    };

    if (!user || user.role !== 'delivery_partner') {
        return (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-10 text-center">
                <p className="text-sm text-slate-500">You are not logged in as a delivery partner.</p>
            </div>
        );
    }

    if (loading && !assignment) {
        return (
            <div className="flex items-center justify-center min-h-[320px]">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!assignment) {
        return (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-10 text-center">
                <p className="text-sm text-slate-500">Assignment not found.</p>
                <Link to="/delivery/assignments" className="inline-flex items-center gap-2 mt-4 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                    <ArrowLeft className="w-4 h-4" /> Back to assignments
                </Link>
            </div>
        );
    }

    const customerName =
        [assignment.order.user.firstName, assignment.order.user.lastName].filter(Boolean).join(' ') ||
        assignment.order.user.phone ||
        'Customer';
    const rawAddress = assignment.order.shippingAddress as any;
    const addressParts = [
        rawAddress?.addressLine1 || rawAddress?.address || '',
        rawAddress?.addressLine2 || '',
        rawAddress?.city || '',
        rawAddress?.state || '',
        rawAddress?.pincode || rawAddress?.zipCode || '',
    ].filter((v: string) => v && v.trim());
    const address = addressParts.length ? addressParts.join(', ') : 'Address not available';
    const encodedDestination = encodeURIComponent(address === 'Address not available' ? '' : address);
    const currentStatus = assignment.status || 'ASSIGNED';
    const normalizedCurrentStatus = String(currentStatus).toUpperCase();
    const allowedTransitions: Record<string, string[]> = {
        ASSIGNED: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'FAILED'],
        PICKED_UP: ['OUT_FOR_DELIVERY', 'FAILED'],
        OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
        FAILED: [],
        DELIVERED: [],
    };
    const canTransitionTo = (nextStatus: string) =>
        (allowedTransitions[normalizedCurrentStatus] || []).includes(nextStatus);
    const isTerminalStatus = ['DELIVERED', 'FAILED'].includes(normalizedCurrentStatus);

    return (
        <div className="space-y-10 pb-20">
            {/* Page header - match Admin */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        to="/delivery/assignments"
                        className="h-11 w-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Order
                            </span>
                            <span
                                className={cn(
                                    'px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest',
                                    currentStatus === 'DELIVERED'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : currentStatus === 'FAILED'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                )}
                            >
                                {currentStatus}
                            </span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                            #{assignment.order.orderNumber}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {customerName} • {address}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Amount
                    </p>
                    <p className="text-2xl font-black text-emerald-600">
                        ₹{Number(assignment.order.payableAmount).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">
                        Slot: {assignment.order.deliverySlot || 'Anytime'}
                    </p>
                </div>
            </div>

            {/* Actions - same button style as Admin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 h-14 rounded-2xl bg-white border border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 hover:shadow-lg transition-all"
                >
                    <MapPin className="w-5 h-5 text-emerald-500" />
                    Open in Maps
                </a>
                {assignment.order.user.phone && (
                    <a
                        href={`tel:${assignment.order.user.phone}`}
                        className="flex items-center justify-center gap-3 h-14 rounded-2xl bg-white border border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 hover:shadow-lg transition-all"
                    >
                        <Phone className="w-5 h-5 text-slate-500" />
                        Call customer
                    </a>
                )}
            </div>

            {/* Items - same card as Admin list rows */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/20">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                        Items
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {assignment.order.items.length} item{assignment.order.items.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="divide-y divide-slate-50">
                    {assignment.order.items.map((item) => (
                        <div
                            key={item.id}
                            className="p-6 flex items-center justify-between"
                        >
                            <span className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                {item.product.name} × {item.quantity} {item.product.unit}
                            </span>
                            <span className="text-sm font-black text-slate-600">
                                ₹{Number(item.subtotal).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Update status - same card + button style as Admin */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/20">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                        Update status
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Mark progress for this delivery
                    </p>
                </div>
                <div className="p-8">
                    <div className="mb-6">
                        <div className="mb-3">
                            {otpMeta.active ? (
                                <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">
                                        OTP sent
                                    </span>
                                    {otpMeta.generatedAt && (
                                        <span className="text-[9px] font-bold text-emerald-700">
                                            at {new Date(otpMeta.generatedAt).toLocaleTimeString()}
                                        </span>
                                    )}
                                    {otpMeta.expiresAt && (
                                        <span className="text-[9px] font-bold text-emerald-700">
                                            · expires {new Date(otpMeta.expiresAt).toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                                        No active OTP
                                    </span>
                                </div>
                            )}
                        </div>
                        <button
                            disabled={generatingOtp || updating || isTerminalStatus}
                            onClick={handleGenerateOtp}
                            className="w-full sm:w-auto flex items-center justify-center gap-3 h-12 px-6 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50"
                        >
                            {generatingOtp ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <KeyRound className="w-4 h-4 text-emerald-400" />
                            )}
                            Generate Customer OTP
                        </button>
                        {otpMeta.active && !isTerminalStatus && (
                            <div className="mt-4 flex flex-col sm:flex-row gap-3">
                                <input
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    inputMode="numeric"
                                    pattern="\d{6}"
                                    placeholder="Enter 6-digit OTP"
                                    className="h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-black tracking-[0.2em] text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none"
                                />
                                <button
                                    type="button"
                                    disabled={updating || otpCode.trim().length !== 6}
                                    onClick={() => handleUpdateStatus('DELIVERED')}
                                    className="h-12 px-6 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Verify OTP & Deliver
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {STATUS_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const isDelivered = opt.value === 'DELIVERED';
                            const isFailed = opt.value === 'FAILED';
                            const isAlreadyCurrent = normalizedCurrentStatus === opt.value;
                            const shouldDisable =
                                updating ||
                                isAlreadyCurrent ||
                                isTerminalStatus ||
                                opt.value === 'DELIVERED' ||
                                !canTransitionTo(opt.value);
                            return (
                                <button
                                    key={opt.value}
                                    disabled={shouldDisable}
                                    onClick={() => handleUpdateStatus(opt.value)}
                                    className={cn(
                                        'flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50',
                                        isDelivered &&
                                            'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                                        isFailed &&
                                            'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
                                        !isDelivered &&
                                            !isFailed &&
                                            'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    )}
                                >
                                    {updating ? (
                                        <Loader className="w-5 h-5 animate-spin text-slate-400" />
                                    ) : (
                                        <Icon className="w-5 h-5" />
                                    )}
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
