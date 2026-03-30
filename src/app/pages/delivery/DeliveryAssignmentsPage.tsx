import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { getEffectiveApiBase } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Assignment {
    id: string;
    status: string | null;
    createdAt: string;
    order: {
        id: string;
        orderNumber: string;
        payableAmount: number;
        paymentStatus: string;
        deliverySlot: string | null;
        shippingAddress: any;
        user: {
            firstName: string | null;
            lastName: string | null;
            phone: string | null;
        };
    };
}

export function DeliveryAssignmentsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${getEffectiveApiBase()}/delivery/assignments`, {
                    headers: { Authorization: token ? `Bearer ${token}` : '' },
                });
                if (!res.ok) throw new Error('Failed to load assignments');
                const json = await res.json();
                setAssignments(json);
            } catch (e: any) {
                toast.error(e?.message || 'Unable to load assignments');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const activeAssignments = assignments.filter((a) => !['DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED'].includes(String(a.status || '').toUpperCase()));
    const historyAssignments = assignments.filter((a) => ['DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED'].includes(String(a.status || '').toUpperCase()));

    if (!user || user.role !== 'delivery_partner') {
        return (
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-10 text-center">
                <p className="text-sm text-slate-500">You are not logged in as a delivery partner.</p>
            </div>
        );
    }

    if (loading && assignments.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[320px]">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20">
            {/* Page header - match Admin */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Package className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            Operations
                        </span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
                        Assignments
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">
                        Orders assigned to you. Active jobs and completed history are shown below.
                    </p>
                </div>
            </div>

            {assignments.length === 0 ? (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="py-20 text-center">
                        <Package className="h-12 w-12 text-slate-100 mx-auto mb-4" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            No assignments right now.
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2">
                            You will see orders here when admin assigns them to you.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/20">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                            Active assignments
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {activeAssignments.length} order{activeAssignments.length !== 1 ? 's' : ''} to deliver
                        </p>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {activeAssignments.length === 0 && (
                            <div className="py-10 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    No active assignments right now.
                                </p>
                            </div>
                        )}
                        {activeAssignments.map((a, i) => {
                            const name =
                                [a.order.user.firstName, a.order.user.lastName].filter(Boolean).join(' ') ||
                                a.order.user.phone ||
                                'Customer';
                            const rawAddress = a.order.shippingAddress as any;
                            const addressParts = [
                                rawAddress?.addressLine1 || rawAddress?.address || '',
                                rawAddress?.addressLine2 || '',
                                rawAddress?.city || '',
                                rawAddress?.state || '',
                                rawAddress?.pincode || rawAddress?.zipCode || '',
                            ].filter((v: string) => v && v.trim());
                            const address = addressParts.length ? addressParts.join(', ') : 'Address not available';
                            const status = a.status || 'ASSIGNED';
                            return (
                                <motion.div
                                    key={a.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 * i }}
                                    className="p-6 flex items-center gap-5 hover:bg-slate-50/50 transition-all group cursor-pointer"
                                    onClick={() => navigate(`/delivery/assignments/${a.id}`)}
                                >
                                    <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center font-black text-slate-600 group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                                        {name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                                #{a.order.orderNumber}
                                            </span>
                                            <span
                                                className={cn(
                                                    'px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest leading-none',
                                                    status === 'DELIVERED'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : status === 'FAILED'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                )}
                                            >
                                                {status}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">
                                            {name} • {address}
                                        </p>
                                        <p className="text-[9px] text-slate-400 mt-0.5">
                                            Slot: {a.order.deliverySlot || 'Anytime'}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-black text-slate-900">
                                            ₹{Number(a.order.payableAmount).toLocaleString()}
                                        </p>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1 mt-1">
                                            Open <ArrowRight className="h-3 w-3" />
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}

            {historyAssignments.length > 0 && (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/20">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                            Assignment history
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {historyAssignments.length} completed/closed assignment{historyAssignments.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {historyAssignments.map((a, i) => {
                            const name =
                                [a.order.user.firstName, a.order.user.lastName].filter(Boolean).join(' ') ||
                                a.order.user.phone ||
                                'Customer';
                            const rawAddress = a.order.shippingAddress as any;
                            const addressParts = [
                                rawAddress?.addressLine1 || rawAddress?.address || '',
                                rawAddress?.addressLine2 || '',
                                rawAddress?.city || '',
                                rawAddress?.state || '',
                                rawAddress?.pincode || rawAddress?.zipCode || '',
                            ].filter((v: string) => v && v.trim());
                            const address = addressParts.length ? addressParts.join(', ') : 'Address not available';
                            const status = a.status || 'ASSIGNED';
                            return (
                                <motion.div
                                    key={a.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.03 * i }}
                                    className="p-6 flex items-center gap-5 hover:bg-slate-50/50 transition-all group cursor-pointer"
                                    onClick={() => navigate(`/delivery/assignments/${a.id}`)}
                                >
                                    <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center font-black text-slate-600">
                                        {name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                                #{a.order.orderNumber}
                                            </span>
                                            <span
                                                className={cn(
                                                    'px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest leading-none',
                                                    status === 'DELIVERED'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-red-100 text-red-700'
                                                )}
                                            >
                                                {status}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">
                                            {name} • {address}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-black text-slate-900">
                                            ₹{Number(a.order.payableAmount).toLocaleString()}
                                        </p>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1 mt-1">
                                            View <ArrowRight className="h-3 w-3" />
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
