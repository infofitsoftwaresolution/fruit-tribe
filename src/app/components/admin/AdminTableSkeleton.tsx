import { cn } from '@/lib/utils';

/** Pulse placeholder rows for admin data tables while the API loads. */
export function AdminTableSkeletonRows({
  rows = 8,
  cols = 7,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  const widths = ['w-[72%]', 'w-[55%]', 'w-[40%]', 'w-[50%]', 'w-[35%]', 'w-[60%]', 'w-[45%]'];
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={cn('animate-pulse', className)}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-10 py-7">
              <div className={cn('h-3.5 rounded-lg bg-slate-200/80', widths[j % widths.length])} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminStatsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl animate-pulse"
        >
          <div className="h-3 w-24 rounded bg-slate-200 mb-4" />
          <div className="h-9 w-32 rounded-lg bg-slate-200/90 mb-2" />
          <div className="h-3 w-40 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
