import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Percent, Save, AlertCircle, Info, ShieldCheck,
    Globe, Zap, ArrowUpRight, History, Download,
    Briefcase, Activity, Landmark, X
} from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateStoreSettings } from '@/lib/api';

const TAX_CHANGELOG_KEY = 'tax_rate_changelog_v1';

type TaxChangelogEntry = { ts: string; category: string; from: number; to: number };

function readTaxChangelog(): TaxChangelogEntry[] {
    try {
        const raw = localStorage.getItem(TAX_CHANGELOG_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function appendTaxChangelog(entry: TaxChangelogEntry) {
    try {
        const prev = readTaxChangelog();
        prev.unshift(entry);
        localStorage.setItem(TAX_CHANGELOG_KEY, JSON.stringify(prev.slice(0, 300)));
    } catch {
        /* ignore */
    }
}

export function AdminTaxPage() {
    const { taxRates, updateTaxRate, preferences } = useStore();
    const { orders, products } = useAdminData();
    const [editingRates, setEditingRates] = useState<Record<string, string>>(
        Object.keys(taxRates).reduce((acc, cat) => ({ ...acc, [cat]: taxRates[cat].toString() }), {})
    );
    const [logModalOpen, setLogModalOpen] = useState(false);
    const [changelog, setChangelog] = useState<TaxChangelogEntry[]>(() => readTaxChangelog());

    const handleRateChange = useCallback((category: string, value: string) => {
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setEditingRates(prev => ({ ...prev, [category]: value }));
        }
    }, []);

    const handleSave = useCallback(async (category: string) => {
        const numValue = parseFloat(editingRates[category]);
        if (isNaN(numValue)) {
            toast.error('Numerical input required');
            return;
        }
        const prev = taxRates[category] ?? 0;
        const nextTaxRates = { ...taxRates, [category]: numValue };
        if (prev !== numValue) {
            appendTaxChangelog({
                ts: new Date().toISOString(),
                category,
                from: prev,
                to: numValue,
            });
            setChangelog(readTaxChangelog());
        }
        updateTaxRate(category, numValue);
        try {
            await updateStoreSettings({
                preferences: {
                    ...preferences,
                    taxRates: nextTaxRates,
                },
            });
            toast.success(`Tax rate updated for ${category}`);
        } catch {
            updateTaxRate(category, prev);
            toast.error('Failed to persist tax rate. Reverted local change.');
        }
    }, [editingRates, updateTaxRate, taxRates, preferences]);

    const escapeCsvValue = (value: unknown) => {
        const str = value == null ? '' : String(value);
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const handleDownloadLedger = useCallback(() => {
        const rows: (string | number)[][] = [
            ['Tax ledger (estimated line tax from category rates × paid order items)'],
            ['Generated (ISO)', new Date().toISOString()],
            [],
            ['Category', 'Current rate %'],
            ...Object.keys(taxRates).map((c) => [c, taxRates[c]]),
            [],
            [
                'Order number',
                'Order date',
                'Payment status',
                'Product ID',
                'Line subtotal (INR)',
                'Category',
                'Rate %',
                'Estimated tax (INR)',
            ],
        ];

        for (const o of orders) {
            if (String(o.paymentStatus || '').toUpperCase() !== 'PAID') continue;
            const dateStr = o.createdAt ? new Date(o.createdAt).toISOString() : '';
            const items = o.items;
            if (!Array.isArray(items) || !items.length) continue;
            for (const item of items) {
                const pid = item.productId;
                const pr = products.find((p) => String(p.id) === String(pid));
                const cat = pr?.category || 'Unknown';
                const rate = taxRates[cat] ?? taxRates[Object.keys(taxRates)[0]] ?? 0;
                const sub = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);
                const tax = sub * (Number(rate) / 100);
                rows.push([
                    o.orderNumber || o.id,
                    dateStr,
                    String(o.paymentStatus || ''),
                    String(pid ?? ''),
                    sub.toFixed(2),
                    cat,
                    String(rate),
                    tax.toFixed(2),
                ]);
            }
        }

        const csv = rows.map((r) => r.map(escapeCsvValue).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tax-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Tax ledger CSV downloaded');
    }, [orders, products, taxRates]);

    const openChangeLogs = useCallback(() => {
        setChangelog(readTaxChangelog());
        setLogModalOpen(true);
    }, []);

    const categories = useMemo(() => Object.keys(taxRates), [taxRates]);

    const handleBulkUpdateRates = useCallback(() => {
        const raw = window.prompt('Enter tax rate (%) to apply to all categories');
        if (raw == null) return;
        const trimmed = raw.trim();
        if (!trimmed.length) {
            toast.error('Tax rate is required.');
            return;
        }
        const value = Number(trimmed);
        if (!Number.isFinite(value) || value < 0) {
            toast.error('Enter a valid non-negative number.');
            return;
        }
        const normalized = String(value);
        setEditingRates((prev) => {
            const next = { ...prev };
            for (const category of categories) next[category] = normalized;
            return next;
        });
        toast.success('Applied rate to all categories. Click Save All Rates to persist.');
    }, [categories]);

    const handleSaveAllRates = useCallback(async () => {
        const parsedRates: Record<string, number> = {};
        for (const category of categories) {
            const parsed = Number(editingRates[category]);
            if (!Number.isFinite(parsed) || parsed < 0) {
                toast.error(`Invalid rate for ${category}.`);
                return;
            }
            parsedRates[category] = parsed;
        }

        const previousTaxRates = { ...taxRates };
        for (const category of categories) {
            updateTaxRate(category, parsedRates[category]);
        }

        try {
            await updateStoreSettings({
                preferences: {
                    ...preferences,
                    taxRates: parsedRates,
                },
            });

            let changeLogged = false;
            for (const category of categories) {
                const from = previousTaxRates[category] ?? 0;
                const to = parsedRates[category];
                if (from === to) continue;
                appendTaxChangelog({
                    ts: new Date().toISOString(),
                    category,
                    from,
                    to,
                });
                changeLogged = true;
            }
            if (changeLogged) setChangelog(readTaxChangelog());
            toast.success('All tax rates saved.');
        } catch {
            for (const category of categories) {
                updateTaxRate(category, previousTaxRates[category] ?? 0);
            }
            toast.error('Failed to persist all tax rates. Reverted local changes.');
        }
    }, [categories, editingRates, taxRates, updateTaxRate, preferences]);

    return (
        <div className="space-y-6 pb-12 max-w-4xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="admin-page-title">Taxation</h1>
                    <p className="admin-page-subtitle">Configure tax percentage rules across catalog product categories.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={openChangeLogs}
                        className="admin-btn-secondary"
                    >
                        <History className="w-4 h-4" />
                        Change Logs
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadLedger}
                        className="admin-btn-primary bg-slate-900 hover:bg-slate-850"
                    >
                        <Download className="w-4 h-4" />
                        Download Ledger
                    </button>
                </div>
            </div>

            {/* Quick stats check */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Fiscal Compliance', status: 'Active', color: 'emerald', icon: ShieldCheck },
                    { label: 'Fiscal Updates', status: 'Verified', color: 'blue', icon: Globe },
                    { label: 'Platform GST Rate', status: '18%', color: 'purple', icon: Landmark }
                ].map((stat, i) => (
                    <div
                        key={stat.label}
                        className="admin-card p-4 flex items-center gap-3"
                    >
                        <div className={cn("p-2 rounded-lg border", 
                            stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            stat.color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            'bg-purple-50 text-purple-600 border-purple-100'
                        )}>
                            <stat.icon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-sm font-semibold text-slate-800">{stat.status}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tax rates table */}
            <div className="admin-card">
                <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex items-center justify-between">
                    <div>
                        <h3 className="admin-section-heading">Category Tax Rates</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Category-specific rates applied on checkout</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full">
                        <Activity className="h-3 w-3 text-emerald-600" />
                        <span className="text-[10px] font-semibold text-emerald-700 uppercase">Live</span>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    <AnimatePresence mode='popLayout'>
                        {categories.map((category, idx) => (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.03 }}
                                key={category}
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                        <Percent className="h-4.5 w-4.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-slate-900 capitalize">{category}</h3>
                                            <span className="admin-badge-slate text-[9px] px-1.5 py-0">Default</span>
                                        </div>
                                        <p className="text-xs text-slate-400">Checkout applicability enabled</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="relative flex items-center">
                                        <input
                                            type="text"
                                            value={editingRates[category]}
                                            onChange={(e) => handleRateChange(category, e.target.value)}
                                            className="admin-input w-28 pr-6 text-center font-medium"
                                            placeholder="0.00"
                                        />
                                        <span className="absolute right-2.5 text-slate-400 font-medium text-xs">%</span>
                                    </div>
                                    <button
                                        onClick={() => handleSave(category)}
                                        disabled={parseFloat(editingRates[category]) === taxRates[category]}
                                        className="admin-btn-icon h-9 w-9 bg-slate-900 text-white hover:bg-black hover:text-white border-none disabled:opacity-20 flex items-center justify-center"
                                        title="Save Rate"
                                    >
                                        <Save className="h-4 w-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <div className="p-4 bg-slate-50/40 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleBulkUpdateRates}
                        className="w-full sm:w-auto admin-btn-secondary"
                    >
                        Bulk Update Rates
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveAllRates}
                        className="w-full sm:w-auto admin-btn-primary bg-emerald-600 hover:bg-emerald-700 border-none"
                    >
                        Save All Rates
                    </button>
                </div>
            </div>

            {/* Logs Modal */}
            {logModalOpen &&
                createPortal(
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <button
                            type="button"
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            aria-label="Close"
                            onClick={() => setLogModalOpen(false)}
                        />
                        <div className="relative bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full max-h-[75vh] flex flex-col overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="font-semibold text-slate-900">Tax Rate Logs</h2>
                                <button
                                    type="button"
                                    onClick={() => setLogModalOpen(false)}
                                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 space-y-2.5 custom-scrollbar">
                                {changelog.length === 0 ? (
                                    <p className="text-slate-400 text-center py-8 text-xs">No tax rate change logs recorded.</p>
                                ) : (
                                    changelog.map((e, i) => (
                                        <div
                                            key={`${e.ts}-${i}`}
                                            className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                                        >
                                            <p className="font-semibold text-slate-800 capitalize">{e.category}</p>
                                            <p className="text-slate-500 mt-0.5">
                                                {e.from}% changed to {e.to}%
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1 font-mono">{new Date(e.ts).toLocaleString()}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}

            {/* Compliance warning banner */}
            <div className="bg-amber-50/40 rounded-xl p-5 border border-amber-100/60 flex items-start gap-4">
                <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-600 flex-shrink-0">
                    <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-amber-900">Tax Compliance Protocol</h3>
                    <p className="text-xs text-amber-800 leading-relaxed max-w-2xl">
                        Tax rules are computed automatically at checkout. Ensure updates reflect active regional government mandates. Every rate change is logged locally for compliance auditing.
                    </p>
                </div>
            </div>
        </div>
    );
}

