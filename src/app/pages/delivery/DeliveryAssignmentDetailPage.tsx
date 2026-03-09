import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { getEffectiveApiBase } from '@/lib/api';
import { toast } from 'sonner';

interface DeliveryOrderItem {
  id: string;
  quantity: number;
  subtotal: number;
  product: {
    name: string;
    unit: string;
  };
}

interface DeliveryAssignmentDetail {
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
    items: DeliveryOrderItem[];
  };
}

export function DeliveryAssignmentDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [assignment, setAssignment] = useState<DeliveryAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${getEffectiveApiBase()}/delivery/assignments/${id}`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
        if (!res.ok) {
          throw new Error('Failed to load assignment');
        }
        const json = await res.json();
        setAssignment(json);
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
      // Try to capture current GPS, but do not block if it fails.
      let lat: number | undefined;
      let lng: number | undefined;
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          },
          () => {
            // ignore errors; server accepts null
          },
        );
      }
      const res = await fetch(`${getEffectiveApiBase()}/delivery/assignments/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ status, lat, lng, reason }),
      });
      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      const json = await res.json();
      setAssignment((prev) => (prev ? { ...prev, status: json.status } : prev));
      toast.success(`Status updated to ${status}`);
    } catch (e: any) {
      toast.error(e?.message || 'Unable to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (!user || user.role !== 'delivery_partner') {
    return <div className="text-sm text-slate-300">You are not logged in as a delivery partner.</div>;
  }

  if (loading && !assignment) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!assignment) {
    return <div className="text-sm text-slate-300">Assignment not found.</div>;
  }

  const customerName =
    [assignment.order.user.firstName, assignment.order.user.lastName].filter(Boolean).join(' ') ||
    assignment.order.user.phone ||
    'Customer';

  const address = (assignment.order.shippingAddress as any)?.addressLine1 || 'Address not available';
  const encodedDestination = encodeURIComponent(address);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Order</p>
          <h2 className="text-xl font-black">#{assignment.order.orderNumber}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {customerName} • {address}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Amount</p>
          <p className="text-2xl font-black text-emerald-400">
            ₹{Number(assignment.order.payableAmount).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-11 rounded-full bg-emerald-500 text-sm font-bold text-white flex items-center justify-center"
        >
          Open in Maps
        </a>
        {assignment.order.user.phone && (
          <a
            href={`tel:${assignment.order.user.phone}`}
            className="flex-1 h-11 rounded-full bg-slate-800 text-sm font-bold text-slate-100 flex items-center justify-center"
          >
            Call Customer
          </a>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Items
        </p>
        {assignment.order.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm text-slate-200">
            <span>
              {item.product.name} × {item.quantity} {item.product.unit}
            </span>
            <span>₹{Number(item.subtotal).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Update status
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={updating}
            onClick={() => handleUpdateStatus('PICKED_UP')}
            className="h-11 rounded-full bg-slate-800 text-xs font-black uppercase tracking-[0.2em]"
          >
            Picked up
          </button>
          <button
            disabled={updating}
            onClick={() => handleUpdateStatus('OUT_FOR_DELIVERY')}
            className="h-11 rounded-full bg-slate-800 text-xs font-black uppercase tracking-[0.2em]"
          >
            Out for delivery
          </button>
          <button
            disabled={updating}
            onClick={() => handleUpdateStatus('DELIVERED')}
            className="h-11 rounded-full bg-emerald-500 text-xs font-black uppercase tracking-[0.2em] text-white"
          >
            Delivered
          </button>
          <button
            disabled={updating}
            onClick={() => handleUpdateStatus('FAILED')}
            className="h-11 rounded-full bg-red-600/80 text-xs font-black uppercase tracking-[0.2em] text-white"
          >
            Failed
          </button>
        </div>
      </div>
    </div>
  );
}

