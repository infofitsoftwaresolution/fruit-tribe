import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Mail,
  RefreshCw,
  Truck,
  Clock,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import {
  getAdminContactSubmissions,
  getAdminDeliveryOverdue,
  type AdminContactSubmission,
  type AdminDeliveryOverdueItem,
} from '@/lib/api';
import { getUserErrorMessage } from '@/lib/userError';

const PAGE_SIZE = 12;

const ALERT_TABS = ['All', 'Delivery', 'Messages'] as const;
type AlertTab = (typeof ALERT_TABS)[number];

function normalizeSearch(q: string) {
  return q.trim().toLowerCase();
}

export function AdminAlertsPage() {
  const { theme } = useStore();
  const [activeTab, setActiveTab] = useState<AlertTab>('All');
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<AdminContactSubmission[]>([]);
  const [overdue, setOverdue] = useState<AdminDeliveryOverdueItem[]>([]);
  const [thresholdHours, setThresholdHours] = useState(2);
  const [hoursFilter, setHoursFilter] = useState(2);

  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [contactSearch, setContactSearch] = useState('');
  const [contactPage, setContactPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contactItems, overduePayload] = await Promise.all([
        getAdminContactSubmissions(200),
        getAdminDeliveryOverdue(hoursFilter),
      ]);
      setContacts(contactItems);
      setOverdue(overduePayload.items);
      setThresholdHours(overduePayload.thresholdHours);
    } catch (e: unknown) {
      toast.error(getUserErrorMessage(e, 'Could not load alerts.'));
    } finally {
      setLoading(false);
    }
  }, [hoursFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDeliveryPage(1);
  }, [deliverySearch, hoursFilter, overdue]);

  useEffect(() => {
    setContactPage(1);
  }, [contactSearch, contacts]);

  useEffect(() => {
    setDeliveryPage(1);
    setContactPage(1);
  }, [activeTab]);

  const showDeliverySection = activeTab === 'All' || activeTab === 'Delivery';
  const showMessagesSection = activeTab === 'All' || activeTab === 'Messages';
  const showHoursFilter = activeTab === 'All' || activeTab === 'Delivery';

  const filteredOverdue = useMemo(() => {
    const q = normalizeSearch(deliverySearch);
    if (!q) return overdue;
    return overdue.filter((row) => {
      const blob = [
        row.orderNumber,
        row.orderStatus,
        row.deliveryPartner.name,
        row.deliveryPartner.phone ?? '',
        row.customerName,
        row.customerEmail ?? '',
        row.customerPhone ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [overdue, deliverySearch]);

  const filteredContacts = useMemo(() => {
    const q = normalizeSearch(contactSearch);
    if (!q) return contacts;
    return contacts.filter((c) => {
      const blob = [c.name, c.email, c.subject, c.message].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [contacts, contactSearch]);

  const deliveryTotalPages = Math.max(1, Math.ceil(filteredOverdue.length / PAGE_SIZE));
  const contactTotalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));

  const safeDeliveryPage = Math.min(deliveryPage, deliveryTotalPages);
  const safeContactPage = Math.min(contactPage, contactTotalPages);

  const pagedOverdue = useMemo(() => {
    const start = (safeDeliveryPage - 1) * PAGE_SIZE;
    return filteredOverdue.slice(start, start + PAGE_SIZE);
  }, [filteredOverdue, safeDeliveryPage]);

  const pagedContacts = useMemo(() => {
    const start = (safeContactPage - 1) * PAGE_SIZE;
    return filteredContacts.slice(start, start + PAGE_SIZE);
  }, [filteredContacts, safeContactPage]);

  const Paginator = ({
    page,
    totalPages,
    totalItems,
    onPageChange,
    idSuffix,
  }: {
    page: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (p: number) => void;
    idSuffix: string;
  }) => {
    if (totalItems === 0) return null;
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalItems);
    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/80 text-[11px] font-bold text-slate-600">
        <span className="uppercase tracking-wider tabular-nums">
          Showing {start}–{end} of {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id={`alerts-prev-${idSuffix}`}
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 border text-[10px] font-black uppercase tracking-widest transition-all',
              page <= 1
                ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300',
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>
          <span className="text-[10px] font-black text-slate-400 tabular-nums px-1">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            id={`alerts-next-${idSuffix}`}
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 border text-[10px] font-black uppercase tracking-widest transition-all',
              page >= totalPages
                ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300',
            )}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full bg-slate-50/80 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20">
                <Bell className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase font-heading"
                  style={theme.fontFamily ? ({ fontFamily: theme.fontFamily } satisfies CSSProperties) : undefined}
                >
                  Alerts
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mt-1">
                  Customer messages & delivery SLA
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
        {/* Tab strip — matches Orders admin pattern */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6 md:mb-8">
          <div className="p-4 md:p-6 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50/30">
            <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar max-w-full">
              {ALERT_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 whitespace-nowrap',
                    activeTab === tab
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105'
                      : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-end shrink-0">
              {showHoursFilter ? (
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Overdue after
                  <select
                    value={hoursFilter}
                    onChange={(e) => setHoursFilter(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    {[1, 2, 3, 4, 6, 12].map((h) => (
                      <option key={h} value={h}>
                        {h} h
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition-all',
                  'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50',
                  loading && 'opacity-60 pointer-events-none',
                )}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
        {/* Delivery overdue */}
        {showDeliverySection ? (
        <section className="rounded-[1.5rem] border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">
                Delivery SLA
              </h2>
              <span className="text-[10px] font-black text-white bg-amber-600 px-2 py-0.5 rounded-md tabular-nums">
                {filteredOverdue.length}
              </span>
              <span className="text-[10px] font-medium text-slate-400 hidden sm:inline truncate">
                Past {thresholdHours}h · rider assigned, not delivered
              </span>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="search"
                value={deliverySearch}
                onChange={(e) => setDeliverySearch(e.target.value)}
                placeholder="Filter order, rider, phone…"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-11 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : filteredOverdue.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm font-semibold text-slate-400">
              {overdue.length === 0
                ? 'No active SLA breaches for this threshold.'
                : 'No matches — adjust search.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[640px]">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 bg-white">
                      <th className="pl-4 pr-2 py-2 font-inherit">Order</th>
                      <th className="px-2 py-2 font-inherit hidden md:table-cell">Rider</th>
                      <th className="px-2 py-2 font-inherit hidden lg:table-cell">Customer</th>
                      <th className="px-2 py-2 font-inherit">SLA</th>
                      <th className="pr-4 pl-2 py-2 font-inherit text-right w-[1%] whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedOverdue.map((row) => (
                      <tr
                        key={row.orderId}
                        className="text-[12px] sm:text-[13px] hover:bg-amber-50/50 transition-colors"
                      >
                        <td className="pl-4 pr-2 py-2.5 align-top">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                              <Truck className="w-3.5 h-3.5 text-amber-800" />
                            </span>
                            <div className="min-w-0">
                              <span className="font-black text-emerald-700 tabular-nums">{row.orderNumber}</span>
                              <span className="block text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                {row.orderStatus}
                              </span>
                            </div>
                          </div>
                          <div className="md:hidden mt-2 text-[11px] text-slate-600 pl-9 space-y-0.5">
                            <p>
                              <span className="text-slate-400">Rider:</span> {row.deliveryPartner.name}
                            </p>
                            <p>
                              <span className="text-slate-400">Customer:</span> {row.customerName}
                            </p>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 align-top hidden md:table-cell text-slate-700">
                          <span className="font-bold text-slate-900">{row.deliveryPartner.name}</span>
                          {row.deliveryPartner.phone ? (
                            <span className="block text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              {row.deliveryPartner.phone}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 align-top hidden lg:table-cell text-slate-700">
                          <span className="font-semibold">{row.customerName}</span>
                          {row.customerPhone ? (
                            <span className="block text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              {row.customerPhone}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter text-amber-900 bg-amber-100/90 px-2 py-1 rounded-md border border-amber-200/80 whitespace-nowrap">
                            <Clock className="w-3 h-3 shrink-0" />
                            {row.hoursSinceReference}h · +{row.hoursPastDue.toFixed(1)}h
                          </span>
                          <span className="block text-[9px] text-slate-400 mt-0.5 uppercase tracking-tight">
                            since {row.referenceLabel}
                          </span>
                        </td>
                        <td className="pr-4 pl-2 py-2.5 align-middle text-right">
                          <Link
                            to={`/admin/orders?search=${encodeURIComponent(row.orderNumber)}`}
                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-800"
                          >
                            Orders
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginator
                page={safeDeliveryPage}
                totalPages={deliveryTotalPages}
                totalItems={filteredOverdue.length}
                onPageChange={setDeliveryPage}
                idSuffix="delivery"
              />
            </>
          )}
        </section>
        ) : null}

        {/* Contact form messages */}
        {showMessagesSection ? (
        <section className="rounded-[1.5rem] border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 flex-wrap">
              <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
              <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">
                Customer messages
              </h2>
              <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-0.5 rounded-md tabular-nums">
                {filteredContacts.length}
              </span>
              <span className="text-[10px] font-medium text-slate-400 hidden sm:inline">Contact form</span>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="search"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Filter name, email, subject…"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm font-semibold text-slate-400">
              {contacts.length === 0 ? 'No contact submissions yet.' : 'No matches — adjust search.'}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {pagedContacts.map((c) => (
                  <li key={c.id} className="px-4 sm:px-5 py-3 hover:bg-slate-50/80 transition-colors">
                    <div className="flex gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
                          <div className="min-w-0">
                            <p className="text-[13px] font-black text-slate-900 truncate">{c.subject}</p>
                            <p className="text-[11px] font-semibold text-slate-600 truncate">
                              {c.name}{' '}
                              <span className="text-slate-400 font-medium">&lt;{c.email}&gt;</span>
                            </p>
                          </div>
                          <time
                            className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 sm:text-right"
                            dateTime={c.submittedAt}
                          >
                            {new Date(c.submittedAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </time>
                        </div>
                        <p className="text-[12px] text-slate-600 mt-1.5 line-clamp-2 leading-snug">
                          {c.message}
                        </p>
                        {c.message.length > 140 ? (
                          <details className="mt-1.5 group">
                            <summary className="list-none cursor-pointer text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-800 [&::-webkit-details-marker]:hidden">
                              <span className="group-open:hidden">Show full message</span>
                              <span className="hidden group-open:inline">Hide</span>
                            </summary>
                            <p className="text-[12px] text-slate-700 mt-2 whitespace-pre-wrap break-words border-l-2 border-emerald-200 pl-3">
                              {c.message}
                            </p>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Paginator
                page={safeContactPage}
                totalPages={contactTotalPages}
                totalItems={filteredContacts.length}
                onPageChange={setContactPage}
                idSuffix="contact"
              />
            </>
          )}
        </section>
        ) : null}
        </div>
      </div>
    </div>
  );
}
