import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { getEffectiveApiBase } from '@/lib/api';
import { toast } from 'sonner';

interface DeliveryDashboardData {
  partnerId: string;
  name: string;
  onlineStatus: string;
  assignedToday: number;
  deliveredToday: number;
  pendingToday: number;
  earningsToday: number;
  codCollectedToday: number;
  distanceTodayKm: number;
}

export function DeliveryDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DeliveryDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [online, setOnline] = useState(false);

  // Background location ping when online
  useEffect(() => {
    if (!online) return;

    const interval = setInterval(async () => {
      if (!('geolocation' in navigator)) return;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        const token = localStorage.getItem('token');
        await fetch(`${getEffectiveApiBase()}/delivery/location`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
      } catch {
        // silently ignore ping failures
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [online]);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${getEffectiveApiBase()}/delivery/dashboard`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        if (!res.ok) {
          throw new Error('Failed to load dashboard');
        }
        const json = await res.json();
        setData(json);
        setOnline(json.onlineStatus === 'ONLINE');
      } catch (e: any) {
        toast.error(e?.message || 'Unable to load delivery dashboard');
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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-slate-300">No dashboard data available.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Welcome back</p>
          <h2 className="text-2xl font-black tracking-tight">{data.name}</h2>
          <p className="text-xs text-slate-400 mt-1">
            Status:{' '}
            <span className="font-semibold">
              {online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </p>
        </div>
        <button
          disabled={toggling}
          onClick={async () => {
            const next = !online;
            setToggling(true);
            try {
              let lat: number | undefined;
              let lng: number | undefined;
              if ('geolocation' in navigator) {
                try {
                  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      enableHighAccuracy: true,
                      timeout: 5000,
                    });
                  });
                  lat = pos.coords.latitude;
                  lng = pos.coords.longitude;
                } catch {
                  // ignore geolocation failures; backend accepts missing coords
                }
              }
              const token = localStorage.getItem('token');
              const res = await fetch(`${getEffectiveApiBase()}/delivery/status`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({ online: next, lat, lng }),
              });
              if (!res.ok) {
                throw new Error('Failed to update status');
              }
              setOnline(next);
              setData(prev => prev ? { ...prev, onlineStatus: next ? 'ONLINE' : 'OFFLINE' } : prev);
              toast.success(next ? 'You are now ONLINE' : 'You are now OFFLINE');
            } catch (e: any) {
              toast.error(e?.message || 'Unable to change status');
            } finally {
              setToggling(false);
            }
          }}
          className={`h-9 px-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-colors ${
            online
              ? 'bg-emerald-500 text-white border-emerald-400'
              : 'bg-slate-900 text-slate-300 border-slate-700'
          }`}
        >
          {online ? 'Go offline' : 'Go online'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Assigned today</p>
          <p className="mt-2 text-2xl font-black">{data.assignedToday}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Delivered</p>
          <p className="mt-2 text-2xl font-black text-emerald-400">{data.deliveredToday}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pending</p>
          <p className="mt-2 text-2xl font-black text-amber-300">{data.pendingToday}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Earnings today</p>
          <p className="mt-2 text-2xl font-black text-emerald-400">₹{data.earningsToday.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">COD collected</p>
          <p className="mt-2 text-2xl font-black text-sky-300">₹{data.codCollectedToday.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Distance</p>
          <p className="mt-2 text-2xl font-black">{data.distanceTodayKm.toFixed(1)} km</p>
        </div>
      </div>
    </div>
  );
}

