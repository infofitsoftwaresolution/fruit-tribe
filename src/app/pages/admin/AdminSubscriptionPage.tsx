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
        toast.info('Form reset to defaults — click Save to apply.');
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
        <div className="space-y-6 pb-12 max-w-4xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="admin-page-title">Subscriptions</h1>
                    <p className="admin-page-subtitle">Configure plans, catalog box varieties, delivery, and marketing copy.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (!draft.enabled) {
                                toast.info('Turn on subscription page toggle first, then save to preview.');
                                return;
                            }
                            const base = window.location.href.split('#')[0];
                            window.open(`${base}#/subscription`, '_blank', 'noopener,noreferrer');
                        }}
                        className="admin-btn-secondary"
                    >
                        <ExternalLink className="w-4 h-4" />
                        View Live Page
                    </button>
                    <button
                        type="button"
                        onClick={resetToDefaults}
                        className="admin-btn-secondary"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset Defaults
                    </button>
                    <button
                        type="button"
                        disabled={!isDirty || saving}
                        onClick={handleSave}
                        className="admin-btn-primary bg-emerald-600 hover:bg-emerald-700 border-none"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Visibility Toggle */}
            <div className="admin-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <span className="admin-section-label">Storefront Integration</span>
                    <p className="text-base font-semibold text-slate-900 mt-0.5">Show subscription page on website</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                        When disabled, visitors will not see subscription options in navigation. Opening /subscription will redirect to the home page.
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={draft.enabled}
                    onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
                    className={cn(
                        'relative h-7 w-[3.5rem] shrink-0 rounded-full transition-colors focus:outline-none',
                        draft.enabled ? 'bg-emerald-500' : 'bg-slate-200',
                    )}
                >
                    <span
                        className={cn(
                            'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                            draft.enabled ? 'translate-x-[1.65rem]' : 'translate-x-0',
                        )}
                    />
                </button>
            </div>

            {/* Hero Copy */}
            <section className="admin-card p-5 space-y-4">
                <h2 className="admin-section-heading">Hero Banner Copy</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Promo Tagline / Badge"
                        value={draft.badgeLabel}
                        onChange={(v) => setDraft((d) => ({ ...d, badgeLabel: v }))}
                    />
                    <Field
                        label="Headline Prefix"
                        value={draft.heroPrefix}
                        onChange={(v) => setDraft((d) => ({ ...d, heroPrefix: v }))}
                    />
                    <div className="sm:col-span-2">
                        <Field
                            label="Gradient Headline Focus"
                            value={draft.heroGradientText}
                            onChange={(v) => setDraft((d) => ({ ...d, heroGradientText: v }))}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Sub-headline Description</label>
                        <textarea
                            value={draft.heroSubtitle}
                            onChange={(e) => setDraft((d) => ({ ...d, heroSubtitle: e.target.value }))}
                            rows={2}
                            className="admin-input h-auto py-2"
                        />
                    </div>
                </div>
            </section>

            {/* Plans */}
            <section className="admin-card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="admin-section-heading">Subscription Plans</h2>
                    <button
                        type="button"
                        onClick={addPlan}
                        className="admin-btn-secondary h-8 text-xs px-2.5"
                    >
                        <Plus className="w-3.5 h-3.5" /> 
                        Add Plan
                    </button>
                </div>
                
                <div className="space-y-6">
                    {draft.plans.map((plan, i) => (
                        <div key={plan.id + i} className="border border-slate-100 rounded-lg p-4 space-y-3 bg-slate-50/30">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-slate-400">Plan #{i + 1}</span>
                                {draft.plans.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removePlan(i)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        aria-label="Remove plan"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Plan ID (Internal)" value={plan.id} onChange={(v) => updatePlan(i, { id: v })} />
                                <Field label="Plan Name" value={plan.name} onChange={(v) => updatePlan(i, { name: v })} />
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Price (₹)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={plan.price}
                                        onChange={(e) => updatePlan(i, { price: Number(e.target.value) || 0 })}
                                        className="admin-input"
                                    />
                                </div>
                                <Field
                                    label="Period Label (e.g. per month)"
                                    value={plan.period}
                                    onChange={(v) => updatePlan(i, { period: v })}
                                />
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Billing Frequency</label>
                                    <select
                                        value={plan.frequency}
                                        onChange={(e) => updatePlan(i, { frequency: e.target.value as SubscriptionFrequency })}
                                        className="admin-select w-full"
                                    >
                                        {FREQUENCIES.map((f) => (
                                            <option key={f} value={f}>
                                                {f}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="sm:col-span-2 flex items-center pt-2">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={plan.popular}
                                            onChange={(e) => updatePlan(i, { popular: e.target.checked })}
                                            className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500/20"
                                        />
                                        Highlight Plan (Tribe Favorite Badge)
                                    </label>
                                </div>
                            </div>
                            
                            <Field
                                label="Short Summary"
                                value={plan.description}
                                onChange={(v) => updatePlan(i, { description: v })}
                            />
                            
                            <div>
                                <label className="text-xs font-semibold text-slate-500 block mb-1">Plan Features (One per line)</label>
                                <textarea
                                    value={plan.features.join('\n')}
                                    onChange={(e) =>
                                        updatePlan(i, {
                                            features: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
                                        })
                                    }
                                    rows={3}
                                    className="admin-input h-auto py-2 font-mono text-xs"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Box Varieties */}
            <section className="admin-card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="admin-section-heading">Box Fruit Varieties</h2>
                    <button 
                        type="button" 
                        onClick={addFruit} 
                        className="admin-btn-secondary h-8 text-xs px-2.5"
                    >
                        <Plus className="w-3.5 h-3.5" /> 
                        Add Variety
                    </button>
                </div>
                
                <div className="space-y-2">
                    {draft.fruits.map((f, i) => (
                        <div key={i} className="flex gap-2 items-center p-2 rounded-lg border border-slate-100 bg-slate-50/50">
                            <input
                                value={f.name}
                                onChange={(e) => updateFruit(i, { name: e.target.value })}
                                className="admin-input flex-1 min-w-[120px] h-8 text-xs"
                                placeholder="Variety Name"
                            />
                            <input
                                value={f.category}
                                onChange={(e) => updateFruit(i, { category: e.target.value })}
                                className="admin-input w-28 h-8 text-xs"
                                placeholder="Category"
                            />
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={f.score}
                                onChange={(e) => updateFruit(i, { score: Number(e.target.value) || 0 })}
                                className="admin-input w-20 h-8 text-xs"
                                title="Freshness Score"
                            />
                            <button 
                                type="button" 
                                onClick={() => removeFruit(i)} 
                                className="p-1.5 hover:bg-slate-200 rounded text-red-500"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Modal Customizations & Delivery */}
            <section className="admin-card p-5 space-y-4">
                <h2 className="admin-section-heading">Checkout Modal & Schedule</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Modal Eyebrow Tag"
                        value={draft.customizeEyebrow}
                        onChange={(v) => setDraft((d) => ({ ...d, customizeEyebrow: v }))}
                    />
                    <Field
                        label="Modal Headline Title"
                        value={draft.customizeTitle}
                        onChange={(v) => setDraft((d) => ({ ...d, customizeTitle: v }))}
                    />
                    <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Modal Subtitle Description</label>
                        <textarea
                            value={draft.customizeSubtitle}
                            onChange={(e) => setDraft((d) => ({ ...d, customizeSubtitle: e.target.value }))}
                            rows={2}
                            className="admin-input h-auto py-2"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Available Delivery Days (comma-separated)</label>
                        <input
                            value={deliveryDaysString}
                            onChange={(e) => setDeliveryDaysFromInput(e.target.value)}
                            className="admin-input"
                            placeholder="Monday, Wednesday, Friday"
                        />
                    </div>
                </div>
            </section>

            {/* Benefits Marketing */}
            <section className="admin-card p-5 space-y-4">
                <h2 className="admin-section-heading">Feature/Benefits Marketing Cards (3 Slots)</h2>
                <div className="space-y-4">
                    {draft.benefits.map((b, i) => (
                        <div key={i} className="grid gap-3 sm:grid-cols-2 p-4 border border-slate-100 rounded-lg bg-slate-50/20">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 block mb-1">Icon Representation</label>
                                <select
                                    value={b.icon}
                                    onChange={(e) => updateBenefit(i, { icon: e.target.value as SubscriptionBenefitConfig['icon'] })}
                                    className="admin-select w-full"
                                >
                                    {BENEFIT_ICONS.map((ic) => (
                                        <option key={ic} value={ic}>
                                            {ic}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 block mb-1">Visual Theme / Color</label>
                                <select
                                    value={b.color}
                                    onChange={(e) => updateBenefit(i, { color: e.target.value as SubscriptionBenefitConfig['color'] })}
                                    className="admin-select w-full"
                                >
                                    {BENEFIT_COLORS.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <Field label="Benefit Title" value={b.title} onChange={(v) => updateBenefit(i, { title: v })} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-xs font-semibold text-slate-500 block mb-1">Benefit Description</label>
                                <textarea
                                    value={b.desc}
                                    onChange={(e) => updateBenefit(i, { desc: e.target.value })}
                                    rows={2}
                                    className="admin-input h-auto py-2"
                                />
                            </div>
                        </div>
                    ))}
                </div>
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
        <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 block">{label}</label>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="admin-input"
            />
        </div>
    );
}

