import { useCallback, useEffect, useMemo, useState } from 'react';
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
  X
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

const ALERT_TABS = ['All', 'Delivery Breach', 'Messages'] as const;
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

  const showDeliverySection = activeTab === 'All' || activeTab === 'Delivery Breach';
  const showMessagesSection = activeTab === 'All' || activeTab === 'Messages';
  const showHoursFilter = activeTab === 'All' || activeTab === 'Delivery Breach';

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs font-medium text-slate-500">
        <span>
          Showing {start}–{end} of {totalItems} entries
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id={`alerts-prev-${idSuffix}`}
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="admin-btn-secondary h-8 px-2.5 text-xs py-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>
          <span className="text-xs text-slate-400 px-1">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            id={`alerts-next-${idSuffix}`}
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="admin-btn-secondary h-8 px-2.5 text-xs py-0"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Alerts</h1>
          <p className="admin-page-subtitle">Monitor customer messages and logistics SLA alerts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showHoursFilter ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              SLA Breach threshold
              <select
                value={hoursFilter}
                onChange={(e) => setHoursFilter(Number(e.target.value))}
                className="admin-select py-0"
              >
                {[1, 2, 3, 4, 6, 12].map((h) => (
                  <option key={h} value={h}>
                    {h} Hours
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="admin-btn-secondary"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-1.5 p-1 bg-white rounded-lg border border-slate-200 w-fit">
        {ALERT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-950 hover:bg-slate-50',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {/* Delivery overdue */}
        {showDeliverySection ? (
          <div className="admin-card">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/20">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <h2 className="admin-section-heading">Logistics SLA Exceptions</h2>
                <span className="admin-badge-red font-semibold py-0 text-[10px]">
                  {filteredOverdue.length}
                </span>
                <span className="text-xs text-slate-400 hidden md:inline truncate">
                  Rider assigned &gt; {thresholdHours}h ago, undelivered
                </span>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="search"
                  value={deliverySearch}
                  onChange={(e) => setDeliverySearch(e.target.value)}
                  placeholder="Filter by order or rider..."
                  className="admin-input pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-4 space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded bg-slate-100" />
                ))}
              </div>
            ) : filteredOverdue.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No active SLA exceptions for this threshold.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="admin-th">Order Ref</th>
                        <th className="admin-th">Delivery Rider</th>
                        <th className="admin-th">Customer</th>
                        <th className="admin-th">SLA Timer</th>
                        <th className="admin-th text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedOverdue.map((row) => (
                        <tr
                          key={row.orderId}
                          className="admin-tr"
                        >
                          <td className="admin-td">
                            <div className="flex items-center gap-2">
                              <span className="h-7 w-7 items-center justify-center rounded bg-amber-50 text-amber-700 flex border border-amber-100 shrink-0">
                                <Truck className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <span className="font-semibold text-slate-900">{row.orderNumber}</span>
                                <span className="block text-[10px] text-slate-400 uppercase">
                                  {row.orderStatus}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="admin-td">
                            <span className="font-semibold text-slate-800">{row.deliveryPartner.name}</span>
                            {row.deliveryPartner.phone ? (
                              <span className="block text-xs text-slate-400 mt-0.5">
                                {row.deliveryPartner.phone}
                              </span>
                            ) : null}
                          </td>
                          <td className="admin-td">
                            <span className="font-medium text-slate-700">{row.customerName}</span>
                            {row.customerPhone ? (
                              <span className="block text-xs text-slate-400 mt-0.5">
                                {row.customerPhone}
                              </span>
                            ) : null}
                          </td>
                          <td className="admin-td">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 whitespace-nowrap">
                              <Clock className="w-3 h-3 shrink-0" />
                              {row.hoursSinceReference}h elapsed (+{row.hoursPastDue.toFixed(1)}h)
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5 capitalize">
                              since {row.referenceLabel}
                            </span>
                          </td>
                          <td className="admin-td text-right">
                            <Link
                              to={`/admin/orders?search=${encodeURIComponent(row.orderNumber)}`}
                              className="admin-btn-ghost h-8 text-xs px-2"
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
          </div>
        ) : null}

        {/* Contact form messages */}
        {showMessagesSection ? (
          <div className="admin-card">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/20">
              <div className="flex items-center gap-2 flex-wrap">
                <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                <h2 className="admin-section-heading">Contact Inquiries</h2>
                <span className="admin-badge-emerald font-semibold py-0 text-[10px]">
                  {filteredContacts.length}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">Storefront contact form submissions</span>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="search"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Filter inquiries..."
                  className="admin-input pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 rounded bg-slate-100" />
                ))}
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No contact form submissions recorded.
              </div>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {pagedContacts.map((c) => (
                    <li key={c.id} className="p-4 hover:bg-slate-50/30 transition-colors">
                      <div className="flex gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950 truncate">{c.subject}</p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {c.name}{' '}
                                <span className="text-slate-400 font-medium">&lt;{c.email}&gt;</span>
                              </p>
                            </div>
                            <time
                              className="text-xs text-slate-400 font-medium shrink-0 sm:text-right"
                              dateTime={c.submittedAt}
                            >
                              {new Date(c.submittedAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </time>
                          </div>
                          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                            {c.message}
                          </p>
                          {c.message.length > 140 ? (
                            <details className="mt-1.5 group">
                              <summary className="list-none cursor-pointer text-xs font-semibold text-emerald-600 hover:text-emerald-800 [&::-webkit-details-marker]:hidden">
                                <span className="group-open:hidden">Read full message</span>
                                <span className="hidden group-open:inline">Hide details</span>
                              </summary>
                              <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap break-words border-l-2 border-slate-200 pl-3 leading-relaxed">
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
