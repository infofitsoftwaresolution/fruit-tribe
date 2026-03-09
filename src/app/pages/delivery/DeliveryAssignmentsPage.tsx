import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { getEffectiveApiBase } from '@/lib/api';
import { toast } from 'sonner';

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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${getEffectiveApiBase()}/delivery/assignments`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
        if (!res.ok) {
          throw new Error('Failed to load assignments');
        }
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

  if (!user || user.role !== 'delivery_partner') {
    return (
      <div className="text-sm text-slate-300">
        You are not logged in as a delivery partner.
      </div>
    );
  }

  if (loading && assignments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return <div className="text-sm text-slate-300">No active assignments right now.</div>;
  }

  return (
    <div className="space-y-4">
      {assignments.map((a) => {
        const name =
          [a.order.user.firstName, a.order.user.lastName].filter(Boolean).join(' ') ||
          a.order.user.phone ||
          'Customer';
        return (
          <Link
            key={a.id}
            to={`/delivery/assignments/${a.id}`}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-2 hover:border-emerald-500/80 transition-colors"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Order
                </p>
                <p className="text-sm font-black">#{a.order.orderNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Amount
                </p>
                <p className="font-black text-emerald-400">
                  ₹{Number(a.order.payableAmount).toFixed(2)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              {name} • {(a.order.shippingAddress as any)?.addressLine1 || 'Address not available'}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.18em]">
              Slot: {a.order.deliverySlot || 'Anytime'} • Status: {a.status || 'ASSIGNED'}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

