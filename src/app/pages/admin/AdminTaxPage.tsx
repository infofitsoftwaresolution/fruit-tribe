import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Percent, Save, AlertCircle, Info, ShieldCheck,
    Globe, Zap, ArrowUpRight, History, Download,
    Briefcase, Activity, Landmark
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

    return (
        <div className="space-y-10 pb-20 max-w-5xl">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Landmark className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Tax Settings</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Tax Management</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Set tax rates by product category.</p>
                </motion.div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={openChangeLogs}
                        className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        <History className="w-4 h-4" />
                        Change Logs
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadLedger}
                        className="h-12 px-8 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                    >
                        Download Ledger
                    </button>
                </div>
            </div>

            {/* Compliance Quick Check */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Network Compliance', status: 'Active', color: 'emerald', icon: ShieldCheck },
                    { label: 'Fiscal Updates', status: 'Verified', color: 'blue', icon: Globe },
                    { label: 'Platform Fee', status: '12%', color: 'purple', icon: Briefcase }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                        <div className={cn("p-3 rounded-2xl", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{stat.status}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Tax rate table */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tax Rates</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Rates used during checkout</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase">Live</span>
                    </div>
                </div>

                <div className="divide-y divide-slate-50">
                    <AnimatePresence mode='popLayout'>
                        {categories.map((category, idx) => (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                key={category}
                                className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:bg-slate-50/50 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="h-20 w-20 rounded-[2rem] bg-slate-900 flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-slate-900/10 group-hover:rotate-6 group-hover:scale-110 transition-all duration-500">
                                        <Percent className="h-8 w-8 text-emerald-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter tracking-tight">{category}</h3>
                                            <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black rounded-md text-slate-400 uppercase tracking-widest">Default</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Applied at checkout</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={editingRates[category]}
                                            onChange={(e) => handleRateChange(category, e.target.value)}
                                            className="w-44 h-16 rounded-3xl bg-white border border-slate-100 px-8 text-xl font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm pr-12 text-center"
                                            placeholder="0.00"
                                        />
                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">%</span>
                                    </div>
                                    <button
                                        onClick={() => handleSave(category)}
                                        disabled={parseFloat(editingRates[category]) === taxRates[category]}
                                        className="h-16 w-16 bg-slate-900 text-white rounded-3xl hover:bg-black disabled:opacity-30 disabled:hover:bg-slate-900 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center active:scale-95 group/btn"
                                    >
                                        <Save className="h-6 w-6 group-hover/btn:scale-110 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button className="w-full sm:w-auto px-10 h-14 bg-white border border-slate-200 rounded-[2rem] text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">
                        Bulk Update Rates
                    </button>
                    <button className="w-full sm:w-auto px-10 h-14 bg-emerald-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20">
                        Save All Rates
                    </button>
                </div>
            </div>

            {/* Compliance note */}
            {logModalOpen &&
                createPortal(
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <button
                            type="button"
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            aria-label="Close"
                            onClick={() => setLogModalOpen(false)}
                        />
                        <div className="relative bg-white rounded-[2rem] border border-slate-100 shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Tax rate change log</h2>
                                <button
                                    type="button"
                                    onClick={() => setLogModalOpen(false)}
                                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 text-sm font-bold"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 space-y-2 text-sm">
                                {changelog.length === 0 ? (
                                    <p className="text-slate-500 text-center py-8">No changes recorded yet. Saving a category rate creates an entry here.</p>
                                ) : (
                                    changelog.map((e, i) => (
                                        <div
                                            key={`${e.ts}-${i}`}
                                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                                        >
                                            <p className="font-black text-slate-900">{e.category}</p>
                                            <p className="text-slate-600 mt-1">
                                                {e.from}% → {e.to}%
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1 font-mono">{e.ts}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 rounded-[3rem] p-12 border border-amber-100 relative overflow-hidden flex flex-col md:flex-row gap-10"
            >
                <div className="relative z-10 flex-shrink-0">
                    <div className="p-6 bg-white rounded-[2.5rem] shadow-sm text-amber-600 flex items-center justify-center">
                        <AlertCircle className="w-10 h-10" />
                    </div>
                </div>
                <div className="relative z-10 space-y-4">
                    <h3 className="text-2xl font-black text-amber-900 uppercase tracking-tight">Tax Compliance Note</h3>
                    <p className="text-amber-800/80 text-sm font-bold leading-relaxed max-w-2xl italic">
                        Tax rates are applied automatically at checkout. Please keep these values aligned with your local tax rules.
                    </p>
                    <div className="flex items-center gap-3 mt-4">
                        <Zap className="w-4 h-4 text-amber-600" />
                        <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Changes are tracked in logs</span>
                    </div>
                </div>
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-amber-200/40 rounded-full blur-[100px] pointer-events-none" />
            </motion.div>
        </div>
    );
}
