import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { getEffectiveApiBase } from '@/lib/api';
import { toast } from 'sonner';

interface EarningsSummary {
  today: { earnings: number; deliveries: number };
  week: { earnings: number };
  month: { earnings: number };
}

interface CodSummary {
  collectedToday: number;
  submittedToday: number;
  pendingToday: number;
}

export function DeliveryEarningsPage() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [cod, setCod] = useState<CodSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: token ? `Bearer ${token}` : '' };

        const [earningsRes, codRes] = await Promise.all([
          fetch(`${getEffectiveApiBase()}/delivery/earnings/summary`, { headers }),
          fetch(`${getEffectiveApiBase()}/delivery/cod/summary`, { headers }),
        ]);

        if (!earningsRes.ok) throw new Error('Failed to load earnings');
        if (!codRes.ok) throw new Error('Failed to load COD summary');

        setEarnings(await earningsRes.json());
        setCod(await codRes.json());
      } catch (e: any) {
        toast.error(e?.message || 'Unable to load earnings data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (!user || user.role !== 'delivery_partner') {
    return <div className="text-sm text-slate-300">You are not logged in as a delivery partner.</div>;
  }

  if (loading && !earnings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!earnings || !cod) {
    return <div className="text-sm text-slate-300">No earnings data available yet.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Earnings overview
        </p>
        <h2 className="text-2xl font-black tracking-tight">Your payouts</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Today
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-400">
            ₹{earnings.today.earnings.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {earnings.today.deliveries} deliveries
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            This week
          </p>
          <p className="mt-2 text-2xl font-black">
            ₹{earnings.week.earnings.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            This month
          </p>
          <p className="mt-2 text-2xl font-black">
            ₹{earnings.month.earnings.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          COD summary (today)
        </p>
        <div className="flex justify-between text-sm text-slate-200">
          <span>Collected</span>
          <span>₹{cod.collectedToday.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-200">
          <span>Submitted</span>
          <span>₹{cod.submittedToday.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-amber-300">
          <span>Pending</span>
          <span>₹{cod.pendingToday.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

