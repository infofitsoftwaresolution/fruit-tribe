import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  pincodes: string[];
  className?: string;
  /** Compact = single summary line + expandable list */
  variant?: 'default' | 'compact';
};

/** Renders serviceable PIN codes without a long comma-separated wall of text. */
export function ServiceablePincodesHint({ pincodes, className, variant = 'default' }: Props) {
  if (!pincodes?.length) return null;

  const sorted = [...pincodes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const preview = sorted.slice(0, 4);
  const rest = sorted.length - preview.length;

  if (variant === 'compact') {
    return (
      <div className={cn('rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3', className)}>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Service area · {sorted.length} PIN{sorted.length === 1 ? '' : 's'}
        </p>
        <details className="group">
          <summary className="cursor-pointer list-none text-xs font-bold text-slate-700 flex items-center justify-between gap-2">
            <span>
              {preview.join(' · ')}
              {rest > 0 ? ` · +${rest} more` : ''}
            </span>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest shrink-0 group-open:hidden">
              View all
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 hidden group-open:inline">
              Hide
            </span>
          </summary>
          <div className="mt-3 max-h-36 overflow-y-auto rounded-xl border border-white bg-white p-3 shadow-inner">
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
              {sorted.map((pin) => (
                <li
                  key={pin}
                  className="font-mono text-xs font-bold text-slate-800 tabular-nums py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-100"
                >
                  {pin}
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3', className)}>
      <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-2 flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        We deliver to {sorted.length} PIN code{sorted.length === 1 ? '' : 's'}
      </p>
      <div className="max-h-32 overflow-y-auto rounded-xl bg-white/80 border border-emerald-100/80 p-3">
        <ul className="flex flex-wrap gap-2 justify-start">
          {sorted.map((pin) => (
            <li
              key={pin}
              className="font-mono text-xs font-bold text-emerald-900 tabular-nums px-2.5 py-1 rounded-lg bg-white border border-emerald-100 shadow-sm"
            >
              {pin}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
