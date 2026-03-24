import { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
    createAdminCoupon,
    getAdminCoupons,
    getCategories,
    getCouponScopes,
    updateAdminCoupon,
    updateCouponScopes,
    type AdminCoupon,
    type CouponScopeRule,
} from '@/lib/api';
import { useProducts } from '@/app/hooks/useProducts';

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
    const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
    const [scopes, setScopes] = useState<CouponScopeRule[]>([]);
    const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
    const { products } = useProducts({ limit: 500 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<AdminCoupon | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);

    const loadData = async () => {
        setLoading(true);
        try {
            const [couponData, scopeData, categoryData] = await Promise.all([
                getAdminCoupons(),
                getCouponScopes(),
                getCategories(),
            ]);
            setCoupons(couponData);
            setScopes(scopeData);
            setCategories(categoryData);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load discount data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const filteredCoupons = useMemo(
        () => coupons.filter((c) => c.code.toLowerCase().includes(search.toLowerCase())),
        [coupons, search],
    );

    const getScopeForCode = (code: string): CouponScopeRule | undefined =>
        scopes.find((s) => s.code.toUpperCase() === code.toUpperCase());

    const getScopeSummary = (scope?: CouponScopeRule) => {
        if (!scope || scope.scopeType === 'ALL') {
            return { label: 'All products', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        }
        if (scope.scopeType === 'CATEGORY') {
            const names = scope.categoryNames ?? [];
            if (names.length <= 2) {
                return {
                    label: `Category: ${names.join(', ') || 'N/A'}`,
                    tone: 'bg-blue-50 text-blue-700 border-blue-200',
                };
            }
            return {
                label: `Categories: ${names.slice(0, 2).join(', ')} +${names.length - 2}`,
                tone: 'bg-blue-50 text-blue-700 border-blue-200',
            };
        }
        const count = scope.productIds?.length ?? 0;
        return {
            label: count > 0 ? `Products: ${count}` : 'Products: N/A',
            tone: 'bg-violet-50 text-violet-700 border-violet-200',
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

    const handleArchive = async (coupon: AdminCoupon) => {
        try {
            await updateAdminCoupon(coupon.id, { isActive: false });
            toast.success(`Coupon ${coupon.code} disabled`);
            await loadData();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to disable coupon');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
            await updateCouponScopes(nextScopes);
            toast.success(editing ? 'Coupon updated' : 'Coupon created');
            setIsModalOpen(false);
            await loadData();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save coupon');
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-2xl font-black text-slate-900">Discounts</h1>
                <button onClick={openCreate} className="h-11 min-h-[44px] px-4 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add coupon
                </button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search coupon code" className="w-full h-11 min-h-[44px] pl-10 pr-3 rounded-xl border border-slate-200" />
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl overflow-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="text-left p-3">Code</th>
                            <th className="text-left p-3">Discount</th>
                            <th className="text-left p-3">Scope</th>
                            <th className="text-left p-3">Usage</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-right p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td className="p-4 text-slate-500" colSpan={6}>Loading coupons...</td></tr>
                        ) : filteredCoupons.length === 0 ? (
                            <tr><td className="p-4 text-slate-500" colSpan={6}>No coupons found.</td></tr>
                        ) : filteredCoupons.map((coupon) => {
                            const scope = getScopeForCode(coupon.code);
                            const scopeSummary = getScopeSummary(scope);
                            return (
                                <tr key={coupon.id} className="border-t border-slate-100">
                                    <td className="p-3 font-bold">{coupon.code}</td>
                                    <td className="p-3">{coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}</td>
                                    <td className="p-3">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold ${scopeSummary.tone}`}>
                                            {scopeSummary.label}
                                        </span>
                                    </td>
                                    <td className="p-3">{coupon.usedCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}</td>
                                    <td className="p-3">{coupon.isActive ? 'Active' : 'Disabled'}</td>
                                    <td className="p-3">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEdit(coupon)} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1"><Edit2 className="w-3.5 h-3.5" />Edit</button>
                                            <button onClick={() => void handleArchive(coupon)} className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-bold">Disable</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 space-y-4 max-h-[95vh] sm:max-h-[90vh] overflow-auto">
                        <h2 className="text-xl font-black">{editing ? 'Edit coupon' : 'Create coupon'}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input required value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))} placeholder="Coupon code (example: SAVE20)" className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200" />
                            <select value={form.discountType} onChange={(e) => setForm((s) => ({ ...s, discountType: e.target.value as FormState['discountType'] }))} className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200">
                                <option value="PERCENTAGE">Discount type: Percentage (%)</option>
                                <option value="FIXED">Discount type: Fixed amount (Rs)</option>
                            </select>
                            <input required type="number" min={0} value={form.discountValue} onChange={(e) => setForm((s) => ({ ...s, discountValue: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="Discount value (example: 20 for 20% OR 100 for Rs100)" className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200" />
                            <input type="number" min={0} value={form.minOrderValue} onChange={(e) => setForm((s) => ({ ...s, minOrderValue: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="Minimum cart value required (example: 499)" className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200" />
                            <input type="number" min={0} value={form.maxDiscount} onChange={(e) => setForm((s) => ({ ...s, maxDiscount: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="Maximum discount cap (optional, example: 200)" className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200" />
                            <input type="number" min={0} value={form.usageLimit} onChange={(e) => setForm((s) => ({ ...s, usageLimit: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="Total uses allowed (optional, example: 500)" className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200" />
                            <input type="date" value={form.expiryDate} onChange={(e) => setForm((s) => ({ ...s, expiryDate: e.target.value }))} className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200" />
                            <label className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200 flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))} />
                                Active
                            </label>
                        </div>
                        <p className="text-xs text-slate-500">
                            Expiry date field: choose the last valid date for this coupon (leave empty for no expiry).
                        </p>

                        <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-600">Offer scope</p>
                            <select value={form.scopeType} onChange={(e) => setForm((s) => ({ ...s, scopeType: e.target.value as FormState['scopeType'] }))} className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200 w-full">
                                <option value="ALL">Apply on all products</option>
                                <option value="CATEGORY">Apply only on selected categories</option>
                                <option value="PRODUCT">Apply only on selected products</option>
                            </select>
                            {form.scopeType === 'ALL' && (
                                <p className="text-xs text-slate-500">No extra selection needed. Coupon will work for every product.</p>
                            )}
                            {form.scopeType === 'CATEGORY' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2" aria-label="Select one or more categories for this coupon">
                                    {categories.map((cat) => (
                                        <label key={cat.id} className="text-xs border border-slate-200 rounded-lg px-2 py-1 flex items-center gap-2">
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
                                            />
                                            {cat.name}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {form.scopeType === 'PRODUCT' && (
                                <div className="max-h-48 overflow-auto grid grid-cols-1 gap-2 border border-slate-200 rounded-xl p-2" aria-label="Select one or more products for this coupon">
                                    {products.map((p) => (
                                        <label key={String(p.id)} className="text-xs flex items-center gap-2">
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
                                            />
                                            {p.name}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="h-11 min-h-[44px] px-4 rounded-xl border border-slate-200 font-bold">Cancel</button>
                            <button type="submit" className="h-11 min-h-[44px] px-4 rounded-xl bg-slate-900 text-white font-bold">Save coupon</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
