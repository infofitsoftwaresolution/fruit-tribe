import { useState, useCallback, useMemo, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Save, ExternalLink, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useStore } from '@/app/context/StoreContext';
import { updateStoreSettings } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
    getDefaultSubscriptionPageConfig,
    mergeSubscriptionPageConfig,
    type SubscriptionPageConfig,
    type SubscriptionPlanConfig,
    type SubscriptionFruitConfig,
    type SubscriptionBenefitConfig,
    type SubscriptionFrequency,
} from '@/app/config/subscriptionPageConfig';

const FREQUENCIES: SubscriptionFrequency[] = ['Weekly', 'Bi-weekly', 'Monthly'];
const BENEFIT_ICONS: SubscriptionBenefitConfig['icon'][] = ['gift', 'truck', 'calendar'];
const BENEFIT_COLORS: SubscriptionBenefitConfig['color'][] = ['emerald', 'blue', 'purple'];

function cloneConfig(c: SubscriptionPageConfig): SubscriptionPageConfig {
    return JSON.parse(JSON.stringify(c)) as SubscriptionPageConfig;
}

export function AdminSubscriptionPage() {
    const { preferences, updatePreferences } = useStore();
    const mergedBase = useMemo(
        () => mergeSubscriptionPageConfig(preferences.subscriptionPage),
        [preferences.subscriptionPage],
    );

    const [draft, setDraft] = useState<SubscriptionPageConfig>(() => cloneConfig(mergedBase));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraft(cloneConfig(mergedBase));
    }, [mergedBase]);

    const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(mergedBase), [draft, mergedBase]);

    const handleSave = useCallback(async () => {
        if (draft.plans.some((p) => !p.id.trim() || !p.name.trim())) {
            toast.error('Each plan needs an ID and name.');
            return;
        }
        const ids = new Set(draft.plans.map((p) => p.id.trim()));
        if (ids.size !== draft.plans.length) {
            toast.error('Plan IDs must be unique.');
            return;
        }
        const normalized = mergeSubscriptionPageConfig(draft);
        setSaving(true);
        try {
            updatePreferences({ subscriptionPage: normalized });
            await updateStoreSettings({
                preferences: { ...preferences, subscriptionPage: normalized } as Record<string, unknown>,
            });
            setDraft(cloneConfig(normalized));
            toast.success('Subscription page saved', { description: 'Synced to store settings for all visitors.' });
        } catch {
            updatePreferences({ subscriptionPage: normalized });
            setDraft(cloneConfig(normalized));
            toast.warning('Saved locally only', { description: 'Could not sync to server; storefront on this browser is updated.' });
        } finally {
            setSaving(false);
        }
    }, [draft, preferences, updatePreferences]);

    const resetToDefaults = () => {
        setDraft(cloneConfig(getDefaultSubscriptionPageConfig()));
        toast.info('Form reset to factory defaults — click Save to apply.');
    };

    const updatePlan = (index: number, patch: Partial<SubscriptionPlanConfig>) => {
        setDraft((d) => {
            const plans = [...d.plans];
            plans[index] = { ...plans[index], ...patch };
            return { ...d, plans };
        });
    };

    const addPlan = () => {
        setDraft((d) => ({
            ...d,
            plans: [
                ...d.plans,
                {
                    id: `plan-${Date.now()}`,
                    name: 'New Plan',
                    price: 999,
                    period: 'per month',
                    frequency: 'Monthly',
                    description: 'Description',
                    features: ['Feature one', 'Feature two'],
                    popular: false,
                },
            ],
        }));
    };

    const removePlan = (index: number) => {
        setDraft((d) => ({
            ...d,
            plans: d.plans.length <= 1 ? d.plans : d.plans.filter((_, i) => i !== index),
        }));
    };

    const updateFruit = (index: number, patch: Partial<SubscriptionFruitConfig>) => {
        setDraft((d) => {
            const fruits = [...d.fruits];
            fruits[index] = { ...fruits[index], ...patch };
            return { ...d, fruits };
        });
    };

    const addFruit = () => {
        setDraft((d) => ({
            ...d,
            fruits: [...d.fruits, { name: 'New variety', category: 'Fruits', score: 90 }],
        }));
    };

    const removeFruit = (index: number) => {
        setDraft((d) => ({ ...d, fruits: d.fruits.filter((_, i) => i !== index) }));
    };

    const updateBenefit = (index: number, patch: Partial<SubscriptionBenefitConfig>) => {
        setDraft((d) => {
            const benefits = [...d.benefits];
            benefits[index] = { ...benefits[index], ...patch };
            return { ...d, benefits };
        });
    };

    const deliveryDaysString = draft.deliveryDays.join(', ');
    const setDeliveryDaysFromInput = (raw: string) => {
        const days = raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        setDraft((d) => ({ ...d, deliveryDays: days.length ? days : d.deliveryDays }));
    };

    return (
        <div className="space-y-10 pb-20 max-w-5xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Subscription</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Subscription page</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg">
                        Control plans, box options, delivery days, and marketing copy for the public subscription page.
                    </p>
                </motion.div>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (!draft.enabled) {
                                toast.info('Turn on “Show subscription page on website” below, then save, to preview.');
                                return;
                            }
                            const base = window.location.href.split('#')[0];
                            window.open(`${base}#/subscription`, '_blank', 'noopener,noreferrer');
                        }}
                        className="h-12 px-5 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                    >
                        <ExternalLink className="w-4 h-4" />
                        View live page
                    </button>
                    <button
                        type="button"
                        onClick={resetToDefaults}
                        className="h-12 px-5 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset form
                    </button>
                    <button
                        type="button"
                        disabled={!isDirty || saving}
                        onClick={handleSave}
                        className="h-12 px-8 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-black disabled:opacity-40 flex items-center gap-2 shadow-xl"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Storefront</p>
                    <p className="text-lg font-black text-slate-900 mt-1">Show subscription page on website</p>
                    <p className="text-sm text-slate-500 mt-0.5 max-w-xl">
                        When off, customers won’t see Subscription in the nav or promos; opening /subscription sends them home.
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={draft.enabled}
                    onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
                    className={cn(
                        'relative h-10 w-[4.5rem] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
                        draft.enabled ? 'bg-emerald-500' : 'bg-slate-300',
                    )}
                >
                    <span
                        className={cn(
                            'absolute top-1 left-1 h-8 w-8 rounded-full bg-white shadow transition-transform',
                            draft.enabled ? 'translate-x-[2.15rem]' : 'translate-x-0',
                        )}
                    />
                </button>
            </div>

            {/* Hero */}
            <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Hero</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field
                        label="Badge label"
                        value={draft.badgeLabel}
                        onChange={(v) => setDraft((d) => ({ ...d, badgeLabel: v }))}
                    />
                    <Field
                        label="Hero prefix (line before gradient)"
                        value={draft.heroPrefix}
                        onChange={(v) => setDraft((d) => ({ ...d, heroPrefix: v }))}
                    />
                    <Field
                        label="Gradient headline"
                        value={draft.heroGradientText}
                        onChange={(v) => setDraft((d) => ({ ...d, heroGradientText: v }))}
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Subtitle</label>
                    <textarea
                        value={draft.heroSubtitle}
                        onChange={(e) => setDraft((d) => ({ ...d, heroSubtitle: e.target.value }))}
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                </div>
            </section>

            {/* Plans */}
            <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Plans</h2>
                    <button
                        type="button"
                        onClick={addPlan}
                        className="text-xs font-black uppercase text-emerald-600 flex items-center gap-1 hover:underline"
                    >
                        <Plus className="w-4 h-4" /> Add plan
                    </button>
                </div>
                <div className="space-y-8">
                    {draft.plans.map((plan, i) => (
                        <div key={plan.id + i} className="border border-slate-100 rounded-2xl p-6 space-y-3 bg-slate-50/50">
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Plan {i + 1}</span>
                                {draft.plans.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removePlan(i)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                        aria-label="Remove plan"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="ID (internal)" value={plan.id} onChange={(v) => updatePlan(i, { id: v })} />
                                <Field label="Name" value={plan.name} onChange={(v) => updatePlan(i, { name: v })} />
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Price (INR)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={plan.price}
                                        onChange={(e) => updatePlan(i, { price: Number(e.target.value) || 0 })}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    />
                                </div>
                                <Field
                                    label='Period label (e.g. "per week")'
                                    value={plan.period}
                                    onChange={(v) => updatePlan(i, { period: v })}
                                />
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Billing frequency</label>
                                    <select
                                        value={plan.frequency}
                                        onChange={(e) => updatePlan(i, { frequency: e.target.value as SubscriptionFrequency })}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                                    >
                                        {FREQUENCIES.map((f) => (
                                            <option key={f} value={f}>
                                                {f}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer md:col-span-2">
                                    <input
                                        type="checkbox"
                                        checked={plan.popular}
                                        onChange={(e) => updatePlan(i, { popular: e.target.checked })}
                                        className="rounded border-slate-300 text-emerald-600"
                                    />
                                    Highlight as “Tribe Favorite”
                                </label>
                            </div>
                            <Field
                                label="Short description"
                                value={plan.description}
                                onChange={(v) => updatePlan(i, { description: v })}
                            />
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Features (one per line)</label>
                                <textarea
                                    value={plan.features.join('\n')}
                                    onChange={(e) =>
                                        updatePlan(i, {
                                            features: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
                                        })
                                    }
                                    rows={4}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Fruits */}
            <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Box varieties</h2>
                    <button type="button" onClick={addFruit} className="text-xs font-black uppercase text-emerald-600 flex items-center gap-1">
                        <Plus className="w-4 h-4" /> Add variety
                    </button>
                </div>
                <div className="space-y-2">
                    {draft.fruits.map((f, i) => (
                        <div key={i} className="flex flex-wrap gap-2 items-center p-3 rounded-xl border border-slate-100">
                            <input
                                value={f.name}
                                onChange={(e) => updateFruit(i, { name: e.target.value })}
                                className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Name"
                            />
                            <input
                                value={f.category}
                                onChange={(e) => updateFruit(i, { category: e.target.value })}
                                className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Category"
                            />
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={f.score}
                                onChange={(e) => updateFruit(i, { score: Number(e.target.value) || 0 })}
                                className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                title="Freshness score"
                            />
                            <button type="button" onClick={() => removeFruit(i)} className="p-2 text-red-500 ml-auto">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Modal copy + delivery days */}
            <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Customize modal & delivery</h2>
                <Field
                    label="Eyebrow"
                    value={draft.customizeEyebrow}
                    onChange={(v) => setDraft((d) => ({ ...d, customizeEyebrow: v }))}
                />
                <Field
                    label="Modal title"
                    value={draft.customizeTitle}
                    onChange={(v) => setDraft((d) => ({ ...d, customizeTitle: v }))}
                />
                <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Modal subtitle</label>
                    <textarea
                        value={draft.customizeSubtitle}
                        onChange={(e) => setDraft((d) => ({ ...d, customizeSubtitle: e.target.value }))}
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Delivery days (comma-separated)</label>
                    <input
                        value={deliveryDaysString}
                        onChange={(e) => setDeliveryDaysFromInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                        placeholder="Monday, Wednesday, Friday"
                    />
                </div>
            </section>

            {/* Benefits */}
            <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Bottom benefits (3 cards)</h2>
                {draft.benefits.map((b, i) => (
                    <div key={i} className="grid gap-3 md:grid-cols-2 p-4 border border-slate-100 rounded-xl">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Icon</label>
                            <select
                                value={b.icon}
                                onChange={(e) => updateBenefit(i, { icon: e.target.value as SubscriptionBenefitConfig['icon'] })}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                            >
                                {BENEFIT_ICONS.map((ic) => (
                                    <option key={ic} value={ic}>
                                        {ic}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Color</label>
                            <select
                                value={b.color}
                                onChange={(e) => updateBenefit(i, { color: e.target.value as SubscriptionBenefitConfig['color'] })}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                            >
                                {BENEFIT_COLORS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Field label="Title" value={b.title} onChange={(v) => updateBenefit(i, { title: v })} />
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Description</label>
                            <textarea
                                value={b.desc}
                                onChange={(e) => updateBenefit(i, { desc: e.target.value })}
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                            />
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{label}</label>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
        </div>
    );
}
