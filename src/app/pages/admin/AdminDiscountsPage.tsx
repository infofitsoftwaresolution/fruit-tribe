import { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2, Tag, Calendar, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
    createAdminCoupon,
    getAdminCoupons,
    getCouponScopes,
    updateAdminCoupon,
    updateCouponScopes,
    deleteAdminCoupon,
    type AdminCoupon,
    type CouponScopeRule,
} from '@/lib/api';
import { useAdminData } from '@/app/context/AdminDataContext';
import { getUserErrorMessage } from '@/lib/userError';
import { cn } from '@/lib/utils';

type FormState = {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number | '';
    minOrderValue: number | '';
    maxDiscount: number | '';
    expiryDate: string;
    usageLimit: number | '';
    isActive: boolean;
    scopeType: 'ALL' | 'CATEGORY' | 'PRODUCT';
    categoryNames: string[];
    productIds: string[];
};

const EMPTY_FORM: FormState = {
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    minOrderValue: '',
    maxDiscount: '',
    expiryDate: '',
    usageLimit: '',
    isActive: true,
    scopeType: 'ALL',
    categoryNames: [],
    productIds: [],
};

export function AdminDiscountsPage() {
    const { products, categories } = useAdminData();
    const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
    const [scopes, setScopes] = useState<CouponScopeRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
    const [discountTypeFilter, setDiscountTypeFilter] = useState<'all' | 'PERCENTAGE' | 'FIXED'>('all');
    const [scopeFilter, setScopeFilter] = useState<'all' | 'ALL' | 'CATEGORY' | 'PRODUCT'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<AdminCoupon | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [isSavingCoupon, setIsSavingCoupon] = useState(false);

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [couponData, scopeData] = await Promise.all([getAdminCoupons(), getCouponScopes()]);
            setCoupons(couponData);
            setScopes(scopeData);
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to load discount data'));
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const filteredCoupons = useMemo(() => {
        const q = search.trim().toLowerCase();
        return coupons.filter((c) => {
            const scope = scopes.find((s) => s.code.toUpperCase() === c.code.toUpperCase());
            const searchOk = q.length === 0 || c.code.toLowerCase().includes(q);
            const statusOk =
                statusFilter === 'all' ? true : statusFilter === 'active' ? c.isActive : !c.isActive;
            const typeOk = discountTypeFilter === 'all' || c.discountType === discountTypeFilter;
            const scopeOk = scopeFilter === 'all' || (scope?.scopeType ?? 'ALL') === scopeFilter;
            return searchOk && statusOk && typeOk && scopeOk;
        });
    }, [coupons, search, statusFilter, discountTypeFilter, scopeFilter, scopes]);

    const getScopeForCode = (code: string): CouponScopeRule | undefined =>
        scopes.find((s) => s.code.toUpperCase() === code.toUpperCase());

    const getScopeSummary = (scope?: CouponScopeRule) => {
        if (!scope || scope.scopeType === 'ALL') {
            return { label: 'All Products', tone: 'admin-badge-emerald' };
        }
        if (scope.scopeType === 'CATEGORY') {
            const names = scope.categoryNames ?? [];
            if (names.length <= 2) {
                return {
                    label: `Category: ${names.join(', ') || 'N/A'}`,
                    tone: 'admin-badge-blue',
                };
            }
            return {
                label: `Categories: ${names.slice(0, 2).join(', ')} +${names.length - 2}`,
                tone: 'admin-badge-blue',
            };
        }
        const count = scope.productIds?.length ?? 0;
        const productNames = (scope?.productIds ?? [])
            .map((id) => products.find((p) => String(p.id) === String(id))?.name)
            .filter((name): name is string => Boolean(name));
        return {
            label:
                count > 0
                    ? productNames.length > 0
                        ? `Products: ${productNames.slice(0, 2).join(', ')}${productNames.length > 2 ? ` +${productNames.length - 2}` : ''}`
                        : `Products: ${count}`
                    : 'Products: N/A',
            tone: 'admin-badge-purple',
        };
    };

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEdit = (coupon: AdminCoupon) => {
        const scope = getScopeForCode(coupon.code);
        setEditing(coupon);
        setForm({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minOrderValue: coupon.minOrderValue ?? '',
            maxDiscount: coupon.maxDiscount ?? '',
            expiryDate: coupon.expiryDate ? coupon.expiryDate.slice(0, 10) : '',
            usageLimit: coupon.usageLimit ?? '',
            isActive: coupon.isActive,
            scopeType: scope?.scopeType ?? 'ALL',
            categoryNames: scope?.categoryNames ?? [],
            productIds: scope?.productIds ?? [],
        });
        setIsModalOpen(true);
    };

    const handleDisable = async (coupon: AdminCoupon) => {
        try {
            await updateAdminCoupon(coupon.id, { isActive: false });
            toast.success(`Coupon ${coupon.code} disabled`);
            await loadData(true);
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to disable coupon'));
        }
    };

    const handleEnable = async (coupon: AdminCoupon) => {
        try {
            await updateAdminCoupon(coupon.id, { isActive: true });
            toast.success(`Coupon ${coupon.code} enabled`);
            await loadData(true);
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to enable coupon'));
        }
    };

    const handleDelete = (coupon: AdminCoupon) => {
        toast(`Delete coupon "${coupon.code}"?`, {
            description: 'This cannot be undone.',
            action: {
                label: 'Delete',
                onClick: async () => {
                    try {
                        await deleteAdminCoupon(coupon.id);
                        toast.success(`Coupon ${coupon.code} deleted`);
                        await loadData(true);
                    } catch (e: any) {
                        toast.error(getUserErrorMessage(e, 'Failed to delete coupon'));
                    }
                },
            },
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingCoupon) return;
        setIsSavingCoupon(true);
        try {
            const body = {
                code: form.code.trim().toUpperCase(),
                discountType: form.discountType,
                discountValue: Number(form.discountValue),
                minOrderValue: form.minOrderValue === '' ? 0 : Number(form.minOrderValue),
                maxDiscount: form.maxDiscount === '' ? null : (Number(form.maxDiscount) > 0 ? Number(form.maxDiscount) : null),
                expiryDate: form.expiryDate || null,
                usageLimit: form.usageLimit === '' ? null : (Number(form.usageLimit) > 0 ? Number(form.usageLimit) : null),
                isActive: form.isActive,
            };
            const saved = editing
                ? await updateAdminCoupon(editing.id, body)
                : await createAdminCoupon(body);

            const nextScopes = scopes.filter((s) => s.code.toUpperCase() !== saved.code.toUpperCase());
            nextScopes.push({
                code: saved.code.toUpperCase(),
                scopeType: form.scopeType,
                categoryNames: form.scopeType === 'CATEGORY' ? form.categoryNames : [],
                productIds: form.scopeType === 'PRODUCT' ? form.productIds : [],
            });
            setCoupons((prev) => {
                const idx = prev.findIndex((c) => String(c.id) === String(saved.id));
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = saved;
                    return next;
                }
                return [saved, ...prev];
            });
            await updateCouponScopes(nextScopes);
            setScopes(nextScopes);
            setIsModalOpen(false);
            toast.success(editing ? 'Coupon updated' : 'Coupon created');
            await loadData(true);
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to save coupon'));
        } finally {
            setIsSavingCoupon(false);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="admin-page-title">Discounts</h1>
                    <p className="admin-page-subtitle">Configure promotions, coupons, and cart scope limits.</p>
                </div>
                <div>
                    <button 
                        onClick={openCreate} 
                        className="admin-btn-primary bg-emerald-600 hover:bg-emerald-700 border-none"
                    >
                        <Plus className="w-4 h-4" />
                        Create Coupon
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative sm:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)} 
                        placeholder="Search coupon code..." 
                        className="admin-input pl-9" 
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'disabled')}
                    className="admin-select"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                    <option value="disabled">Disabled Only</option>
                </select>
                <select
                    value={discountTypeFilter}
                    onChange={(e) => setDiscountTypeFilter(e.target.value as 'all' | 'PERCENTAGE' | 'FIXED')}
                    className="admin-select"
                >
                    <option value="all">All Types</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                </select>
                <select
                    value={scopeFilter}
                    onChange={(e) => setScopeFilter(e.target.value as 'all' | 'ALL' | 'CATEGORY' | 'PRODUCT')}
                    className="admin-select"
                >
                    <option value="all">All Scopes</option>
                    <option value="ALL">All Products</option>
                    <option value="CATEGORY">Selected Categories</option>
                    <option value="PRODUCT">Selected Products</option>
                </select>
            </div>

            {/* Coupons Table */}
            <div className="admin-card">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="admin-th">Coupon Code</th>
                                <th className="admin-th">Discount Offer</th>
                                <th className="admin-th">Scope</th>
                                <th className="admin-th">Redemptions</th>
                                <th className="admin-th">Status</th>
                                <th className="admin-th text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td className="admin-td text-center py-8 text-slate-400" colSpan={6}>
                                        Loading coupons...
                                    </td>
                                </tr>
                            ) : filteredCoupons.length === 0 ? (
                                <tr>
                                    <td className="admin-td text-center py-8 text-slate-400" colSpan={6}>
                                        No discount coupons configured.
                                    </td>
                                </tr>
                            ) : filteredCoupons.map((coupon) => {
                                const scope = getScopeForCode(coupon.code);
                                const scopeSummary = getScopeSummary(scope);
                                return (
                                    <tr key={coupon.id} className="admin-tr">
                                        <td className="admin-td font-semibold text-slate-900">
                                            <div className="flex items-center gap-2">
                                                <Tag className="w-3.5 h-3.5 text-slate-400" />
                                                <span>{coupon.code}</span>
                                            </div>
                                        </td>
                                        <td className="admin-td">
                                            <span className="font-medium text-slate-700">
                                                {coupon.discountType === 'PERCENTAGE' 
                                                    ? `${coupon.discountValue}% Off` 
                                                    : `₹${coupon.discountValue} Off`}
                                            </span>
                                        </td>
                                        <td className="admin-td">
                                            <span className={scopeSummary.tone}>
                                                {scopeSummary.label}
                                            </span>
                                        </td>
                                        <td className="admin-td text-slate-600 font-medium">
                                            {coupon.usedCount}
                                            {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' (Unlimited)'}
                                        </td>
                                        <td className="admin-td">
                                            <span className={coupon.isActive ? 'admin-badge-emerald' : 'admin-badge-slate'}>
                                                {coupon.isActive ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="admin-td">
                                            <div className="flex justify-end gap-1.5">
                                                <button 
                                                    type="button" 
                                                    onClick={() => openEdit(coupon)} 
                                                    className="admin-btn-ghost h-8 text-xs px-2.5"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                    Edit
                                                </button>
                                                {coupon.isActive ? (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => void handleDisable(coupon)} 
                                                        className="admin-btn h-8 text-xs px-2.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:text-amber-800"
                                                    >
                                                        Disable
                                                    </button>
                                                ) : (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => void handleEnable(coupon)} 
                                                        className="admin-btn h-8 text-xs px-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800"
                                                    >
                                                        Enable
                                                    </button>
                                                )}
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleDelete(coupon)} 
                                                    className="admin-btn-danger h-8 text-xs px-2.5"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Coupon Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form 
                        onSubmit={handleSubmit} 
                        className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editing ? `Edit Coupon: ${editing.code}` : 'Create Discount Coupon'}
                            </h2>
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600">Coupon Code</label>
                                    <input 
                                        required 
                                        value={form.code} 
                                        onChange={(e) => setForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))} 
                                        placeholder="SAVE20" 
                                        className="admin-input" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600">Discount Type</label>
                                    <select 
                                        value={form.discountType} 
                                        onChange={(e) => setForm((s) => ({ ...s, discountType: e.target.value as FormState['discountType'] }))} 
                                        className="admin-select w-full"
                                    >
                                        <option value="PERCENTAGE">Percentage (%)</option>
                                        <option value="FIXED">Fixed Amount (₹)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600">Discount Value</label>
                                    <input 
                                        required 
                                        type="number" 
                                        min={0} 
                                        value={form.discountValue} 
                                        onChange={(e) => setForm((s) => ({ ...s, discountValue: e.target.value === '' ? '' : Number(e.target.value) }))} 
                                        placeholder="20" 
                                        className="admin-input" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600">Min. Order Value (₹)</label>
                                    <input 
                                        type="number" 
                                        min={0} 
                                        value={form.minOrderValue} 
                                        onChange={(e) => setForm((s) => ({ ...s, minOrderValue: e.target.value === '' ? '' : Number(e.target.value) }))} 
                                        placeholder="499" 
                                        className="admin-input" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600">Max Discount Limit (₹)</label>
                                    <input 
                                        type="number" 
                                        min={0} 
                                        value={form.maxDiscount} 
                                        onChange={(e) => setForm((s) => ({ ...s, maxDiscount: e.target.value === '' ? '' : Number(e.target.value) }))} 
                                        placeholder="200" 
                                        className="admin-input" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600">Max Total Uses</label>
                                    <input 
                                        type="number" 
                                        min={0} 
                                        value={form.usageLimit} 
                                        onChange={(e) => setForm((s) => ({ ...s, usageLimit: e.target.value === '' ? '' : Number(e.target.value) }))} 
                                        placeholder="500" 
                                        className="admin-input" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600">Expiry Date</label>
                                    <input 
                                        type="date" 
                                        value={form.expiryDate} 
                                        onChange={(e) => setForm((s) => ({ ...s, expiryDate: e.target.value }))} 
                                        className="admin-input" 
                                    />
                                </div>
                                <div className="flex items-end pb-1.5">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={form.isActive} 
                                            onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))} 
                                            className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500/20"
                                        />
                                        Active and Redeemable
                                    </label>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex gap-2">
                                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <p className="text-[11px] text-slate-500 leading-normal">
                                    Leave Max Uses and Expiry Date blank if you want this coupon to remain valid indefinitely and have unlimited redemptions.
                                </p>
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="text-xs font-semibold text-slate-600">Offer Scope & Applicability</label>
                                <select 
                                    value={form.scopeType} 
                                    onChange={(e) => setForm((s) => ({ ...s, scopeType: e.target.value as FormState['scopeType'] }))} 
                                    className="admin-select w-full"
                                >
                                    <option value="ALL">Apply on all products</option>
                                    <option value="CATEGORY">Apply only on selected categories</option>
                                    <option value="PRODUCT">Apply only on selected products</option>
                                </select>
                                
                                {form.scopeType === 'ALL' && (
                                    <p className="text-[11px] text-slate-400">Coupon will work across every product category in catalog.</p>
                                )}
                                
                                {form.scopeType === 'CATEGORY' && (
                                    <div className="grid grid-cols-2 gap-2 border border-slate-100 rounded-lg p-3 max-h-32 overflow-y-auto bg-slate-50/30">
                                        {categories.map((cat) => (
                                            <label key={cat.id} className="text-xs text-slate-600 flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.categoryNames.includes(cat.name.toLowerCase())}
                                                    onChange={(e) => {
                                                        const key = cat.name.toLowerCase();
                                                        setForm((s) => ({
                                                            ...s,
                                                            categoryNames: e.target.checked ? [...s.categoryNames, key] : s.categoryNames.filter((v) => v !== key),
                                                        }));
                                                    }}
                                                    className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500/20"
                                                />
                                                <span className="capitalize">{cat.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                
                                {form.scopeType === 'PRODUCT' && (
                                    <div className="max-h-36 overflow-y-auto grid grid-cols-1 gap-1.5 border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                                        {products.length === 0 && (
                                            <p className="text-[11px] text-slate-400">
                                                No products loaded yet. Refresh products and try again.
                                            </p>
                                        )}
                                        {products.map((p) => (
                                            <label key={String(p.id)} className="text-xs text-slate-600 flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.productIds.includes(String(p.id))}
                                                    onChange={(e) => {
                                                        const id = String(p.id);
                                                        setForm((s) => ({
                                                            ...s,
                                                            productIds: e.target.checked ? [...s.productIds, id] : s.productIds.filter((v) => v !== id),
                                                        }));
                                                    }}
                                                    className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500/20"
                                                />
                                                <span>{p.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="admin-btn-secondary"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSavingCoupon} 
                                className="admin-btn-primary"
                            >
                                {isSavingCoupon ? 'Saving...' : 'Save Coupon'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

interface XProps {
    className?: string;
}

function X({ className }: XProps) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

