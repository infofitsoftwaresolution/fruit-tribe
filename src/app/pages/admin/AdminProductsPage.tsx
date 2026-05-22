import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    createProduct as createProductApi,
    createCategory as createCategoryApi,
    updateProduct as updateProductApi,
    deleteProduct as deleteProductApi,
    productBelongsToSeller,
} from '@/lib/api';
import type { Product } from '@/lib/api';
import {
    Plus, Search, Filter, ArrowUpDown, Trash2,
    Download, Upload, X, Edit2, Package,
    TrendingUp, AlertTriangle, CheckCircle2,
    LayoutDashboard, MoreVertical, ExternalLink,
    Clock, Zap, ShieldCheck, ShoppingBag,
    Image as ImageIcon, ChevronRight, Ban,
    Binary, Activity, Store, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AdminTableSkeletonRows } from '@/app/components/admin/AdminTableSkeleton';
import { ImageUpload } from '@/app/components/ui/ImageUpload';
import { useLocation } from 'react-router-dom';
import { getUserErrorMessage } from '@/lib/userError';
import { buildVariantSku, normalizeVariantLabel } from '@/lib/variantPackLabel';

const PDP_META_PREFIX = '[PDP_META]';
type PdpMeta = {
    details?: string;
    storageInfo?: string;
    originStory?: string;
    faqInfo?: string;
};

function parseDescriptionWithMeta(raw?: string | null): { details: string; meta: PdpMeta } {
    if (!raw) return { details: '', meta: {} };
    const text = String(raw);
    if (!text.startsWith(PDP_META_PREFIX)) return { details: text, meta: {} };
    const payload = text.slice(PDP_META_PREFIX.length);
    try {
        const parsed = JSON.parse(payload) as { details?: string; storageInfo?: string; originStory?: string; faqInfo?: string };
        return {
            details: parsed.details || '',
            meta: {
                storageInfo: parsed.storageInfo || '',
                originStory: parsed.originStory || '',
                faqInfo: parsed.faqInfo || '',
            },
        };
    } catch {
        return { details: text, meta: {} };
    }
}

function composeDescriptionWithMeta(details: string, meta: PdpMeta): string {
    const payload = {
        details: (details || '').trim(),
        storageInfo: (meta.storageInfo || '').trim(),
        originStory: (meta.originStory || '').trim(),
        faqInfo: (meta.faqInfo || '').trim(),
    };
    return `${PDP_META_PREFIX}${JSON.stringify(payload)}`;
}

function toDateInputValue(value?: string | null): string {
    if (!value) return '';
    // Browser date inputs require yyyy-MM-dd only.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function getVariantQuantityMultiplier(label?: string | null): number {
    const text = String(label || '').trim().toLowerCase();
    if (!text) return 1;
    // Prefer explicit unit-based quantities first (e.g. "5kg", "500 g").
    const withUnit = text.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams)\b/);
    if (withUnit) {
        const amount = Number(withUnit[1]);
        const unit = withUnit[2];
        if (Number.isFinite(amount) && amount > 0) {
            if (unit === 'g' || unit === 'gm' || unit === 'grams') {
                return amount / 1000;
            }
            return amount;
        }
    }

    // Fallback: use the largest numeric token, so labels like "1 pack 5 kg"
    // resolve to 5 instead of 1.
    const nums = Array.from(text.matchAll(/\d+(?:\.\d+)?/g))
        .map((m) => Number(m[0]))
        .filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return 1;
    return Math.max(...nums);
}

export function AdminProductsPage() {
    const { user } = useAuth();
    const location = useLocation();
    const { products, categories, sellers, refreshProducts, refreshCategories, isInitialLoading: adminDataLoading } = useAdminData();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [activeCategory, setActiveCategory] = useState('All');
    const [inventoryFilter, setInventoryFilter] = useState<'All' | 'Low' | 'Out' | 'Seasonal'>('All');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [productOverrides, setProductOverrides] = useState<Record<string, Product>>({});
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        discountPrice: '',
        stock: '',
        category: 'Fruits',
        categoryId: '',
        sellerId: '',
        sku: '',
        image: '',
        images: [''],
        description: '',
        storageInfo: '',
        originStory: '',
        faqInfo: '',
        unit: 'kg',
        nutritionalInfo: '',
        origin: '',
        flashSale: false,
        expiryDate: '',
        harvestDate: '',
        isOrganic: false,
        grade: 'A' as 'A' | 'B' | 'Premium',
        isSeasonal: false,
        seasonalStart: '',
        seasonalEnd: '',
        bulkDiscountQty: '',
        bulkDiscountPrice: '',
        allowCashOnDelivery: true,
        isActive: true,
        freshnessScore: '' as string,
        ripenessStage: '',
        farmName: '',
        farmState: '',
        variants: [] as { id?: string; name: string; price: string; stock: string; sku: string; lowStockThreshold?: string; isBulkVariant?: boolean }[]
    });

    const isSeller = user?.role === 'seller';

    const effectiveProducts = useMemo(() => {
        return products
            .map((p) => productOverrides[String(p.id)] || p);
    }, [products, productOverrides]);

    const handleCreateCategory = useCallback(async () => {
        if (isCreatingCategory) return;
        const name = newCategoryName.trim();
        if (!name) {
            toast.error('Enter a category name.');
            return;
        }
        setIsCreatingCategory(true);
        try {
            const created = await createCategoryApi({ name });
            await refreshCategories();
            setFormData((prev) => ({
                ...prev,
                categoryId: String(created.id),
                category: created.name,
            }));
            setNewCategoryName('');
            toast.success(`Category "${created.name}" created.`);
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to create category'));
        } finally {
            setIsCreatingCategory(false);
        }
    }, [isCreatingCategory, newCategoryName, refreshCategories]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const focusProductId = params.get('focusProductId');
        if (!focusProductId) return;

        const target = effectiveProducts.find((p) => String(p.id) === focusProductId);
        if (!target) return;

        setSearchQuery(target.name);
        setActiveCategory('All');
        setInventoryFilter('All');
    }, [location.search, effectiveProducts]);

    // For seller users, auto-bind their own sellerId when opening the form
    useEffect(() => {
        if (!isSeller || !user || formData.sellerId) return;
        if (user.sellerId) {
            setFormData((prev) => ({ ...prev, sellerId: user.sellerId! }));
            return;
        }
        if (!sellers.length) return;
        const match = sellers.find(
            (s) =>
                s.user?.id === user.id ||
                (s.user?.email && s.user.email.toLowerCase() === (user.email || '').toLowerCase())
        );
        if (match) {
            setFormData((prev) => ({ ...prev, sellerId: match.id }));
        }
    }, [isSeller, user, sellers, formData.sellerId]);

    // Auto-resolve selected category name to categoryId after categories load.
    useEffect(() => {
        if (!categories.length) return;
        setFormData((prev) => {
            if (prev.categoryId && categories.some((c) => String(c.id) === String(prev.categoryId))) {
                return prev;
            }
            const byName = categories.find(
                (c) => String(c.name || '').trim().toLowerCase() === String(prev.category || '').trim().toLowerCase()
            );
            if (!byName) return prev;
            return { ...prev, categoryId: byName.id, category: byName.name };
        });
    }, [categories]);

    const filteredProducts = useMemo(() => {
        return effectiveProducts.filter(product => {
            if (isSeller && !productBelongsToSeller(product, user)) return false;

            const matchesSearch = !searchQuery ||
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.vendor || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.sku || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = activeCategory === 'All' || product.category === activeCategory;

            const matchesInventory = inventoryFilter === 'All' ||
                (inventoryFilter === 'Low' && (product.availableStock ?? product.stock) <= (product.lowStockThreshold ?? 5) && (product.availableStock ?? product.stock) > 0) ||
                (inventoryFilter === 'Out' && (product.availableStock ?? product.stock) === 0) ||
                (inventoryFilter === 'Seasonal' && !!product.isSeasonal);

            return matchesSearch && matchesCategory && matchesInventory;
        }).sort((a, b) => {
            if (sortOrder === 'asc') return a.price - b.price;
            return b.price - a.price;
        });
    }, [effectiveProducts, user, searchQuery, sortOrder, activeCategory, inventoryFilter, isSeller]);

    const stats = useMemo(() => {
        const base = isSeller ? effectiveProducts.filter((p) => productBelongsToSeller(p, user)) : effectiveProducts;
        return {
            total: base.length,
            lowStock: base.filter(p => p.availableStock <= (p.lowStockThreshold ?? 5) && p.availableStock > 0).length,
            outOfStock: base.filter(p => p.availableStock === 0).length,
            seasonal: base.filter(p => p.isSeasonal).length
        };
    }, [effectiveProducts, isSeller, user]);

    const escapeCsvValue = (value: unknown) => {
        const str = value == null ? '' : String(value);
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const handleExportProductsCsv = useCallback(() => {
        if (!filteredProducts.length) {
            toast.error('No products to export for the current filters.');
            return;
        }
        const header = [
            'Product ID',
            'Name',
            'SKU',
            'Category',
            'Vendor',
            'Seller ID',
            'Price (INR)',
            'Discount price',
            'Stock',
            'Unit',
            'Low stock threshold',
            'Seasonal',
            'Organic',
        ];
        const rows = filteredProducts.map((p) => [
            p.id,
            p.name,
            p.sku || '',
            p.category,
            p.vendor || '',
            p.sellerId || '',
            p.price,
            p.discountPrice ?? '',
            p.availableStock ?? p.stock,
            p.unit || 'kg',
            p.lowStockThreshold ?? '',
            p.isSeasonal ? 'Yes' : 'No',
            p.isOrganic ? 'Yes' : 'No',
        ]);
        const csv = [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `catalog-export-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filteredProducts.length} product(s) to CSV.`);
    }, [filteredProducts]);

    const handleDeleteProduct = useCallback((id: string | number, name: string) => {
        toast(`Archive ${name}?`, {
            description: user?.role === 'admin'
                ? "Archive hides it from storefront. Admin can also permanently delete."
                : "Product will be hidden from consumer storefronts.",
            action: {
                label: "Archive",
                onClick: async () => {
                    const key = String(id);
                    const current = products.find((p) => String(p.id) === key);
                    if (current) {
                        setProductOverrides((prev) => ({
                            ...prev,
                            [key]: {
                                ...current,
                                status: 'Draft',
                            },
                        }));
                    }
                    try {
                        await deleteProductApi(key);
                        void refreshProducts();
                        toast.success(`${name} archived successfully`);
                    } catch (e: any) {
                        setProductOverrides((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                        });
                        toast.error(getUserErrorMessage(e, 'Failed to archive'));
                    }
                }
            },
            cancel: user?.role === 'admin'
                ? {
                    label: 'Delete permanently',
                    onClick: () => {
                        const key = String(id);
                        toast(`Permanently delete ${name}?`, {
                            description: 'This cannot be undone.',
                            action: {
                                label: 'Delete forever',
                                onClick: async () => {
                                    try {
                                        await deleteProductApi(key, { permanent: true });
                                        setProductOverrides((prev) => {
                                            const next = { ...prev };
                                            delete next[key];
                                            return next;
                                        });
                                        void refreshProducts();
                                        toast.success(`${name} permanently deleted`);
                                    } catch (e: any) {
                                        toast.error(getUserErrorMessage(e, 'Failed to permanently delete'));
                                    }
                                },
                            },
                        });
                    },
                }
                : undefined,
        });
    }, [products, refreshProducts, user?.role]);

    const handleOpenEditModal = (product: Product) => {
        setEditingProduct(product);
        const parsedDescription = parseDescriptionWithMeta(product.description || '');
        const categoryId = categories.find(c => c.name === product.category)?.id ?? '';
        const sellerId =
            product.sellerId ??
            sellers.find((s) => s.storeName === product.vendor)?.id ??
            '';
        setFormData({
            name: product.name,
            price: product.price.toString(),
            discountPrice: product.discountPrice?.toString() || '',
            stock: String(
                product.variants?.length
                    ? product.variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0)
                    : product.stock
            ),
            category: product.category,
            categoryId,
            sellerId,
            sku: product.sku,
            image: product.image || '',
            images: product.images && product.images.length > 0 ? product.images : [''],
            description: parsedDescription.details || '',
            storageInfo: parsedDescription.meta.storageInfo || '',
            originStory: parsedDescription.meta.originStory || '',
            faqInfo: parsedDescription.meta.faqInfo || '',
            unit: product.unit || 'kg',
            nutritionalInfo: '',
            origin: '',
            flashSale: product.badge === 'Flash Sale',
            expiryDate: toDateInputValue(product.expiryDate),
            harvestDate: toDateInputValue(product.harvestDate),
            isOrganic: product.isOrganic || false,
            grade: 'A',
            isSeasonal: product.isSeasonal || false,
            seasonalStart: toDateInputValue(product.seasonalStart),
            seasonalEnd: toDateInputValue(product.seasonalEnd),
            bulkDiscountQty: product.bulkDiscountQty?.toString() || '',
            bulkDiscountPrice: product.bulkDiscountPrice?.toString() || '',
            allowCashOnDelivery: (product as any).allowCashOnDelivery !== false,
            isActive: product.status === 'Active',
            freshnessScore: product.freshnessScore != null ? String(product.freshnessScore) : '',
            ripenessStage: product.ripenessStage || '',
            farmName: product.farmName || '',
            farmState: product.farmState || '',
            variants: (product.variants || [])
                .filter((v: any) => {
                    const label = String(v?.name || v?.attributeValue || '').toLowerCase();
                    return !label.includes('(archived)');
                })
                .map((v: any) => ({
                id: v.id, 
                name: v.name || v.attributeValue, 
                price: (() => {
                    const basePrice = Number(product.price) || 0;
                    const variantPrice = Number(v.price) || 0;
                    const multiplier = getVariantQuantityMultiplier(v.name || v.attributeValue);
                    const baseTotal = basePrice * multiplier;
                    if (baseTotal <= 0 || variantPrice <= 0 || variantPrice >= baseTotal) return '';
                    const discountPct = ((baseTotal - variantPrice) / baseTotal) * 100;
                    return String(Math.round(discountPct * 100) / 100);
                })(),
                stock: String(Math.max(0, Number(v.stockQuantity ?? v.stock ?? 0))), 
                sku: v.sku || '',
                lowStockThreshold: String(v.lowStockThreshold ?? 5),
                isBulkVariant: Boolean(v.isBulkVariant),
            }))
        });
        setIsModalOpen(true);
    };

    const handleSubmitProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingProduct) return;
        const categoryId =
            (formData.categoryId && categories.some((c) => String(c.id) === String(formData.categoryId))
                ? formData.categoryId
                : undefined) ||
            categories.find(
                (c) => String(c.name || '').trim().toLowerCase() === String(formData.category || '').trim().toLowerCase()
            )?.id;
        const parsedStock = parseInt(formData.stock, 10) || 0;

        // Resolve sellerId: admins choose from dropdown; sellers get their own sellerId auto-bound
        let sellerId = formData.sellerId;
        if (!sellerId && isSeller) {
            sellerId = user?.sellerId || '';
            if (!sellerId) {
                const match = sellers.find(
                    (s) =>
                        s.user?.id === user?.id ||
                        (s.user?.email && s.user.email.toLowerCase() === (user?.email || '').toLowerCase())
                );
                if (match) sellerId = match.id;
            }
        }
        if (!sellerId) {
            toast.error('Please select a seller / vendor');
            return;
        }
        if (!categoryId) {
            toast.error('Please select a category');
            return;
        }
        const parsedBasePrice = parseFloat(formData.price) || 0;
        setIsSavingProduct(true);
        try {
            const imagePaths = formData.images.filter(Boolean).map((url) => {
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    try {
                        return new URL(url).pathname;
                    } catch {
                        return url;
                    }
                }
                return url.startsWith('/') ? url : `/${url}`;
            });
            const imagesPayload = imagePaths.length > 0
                ? imagePaths.map((imageUrl, i) => ({ imageUrl, isPrimary: i === 0 }))
                : undefined;
            const skuSeedBase = (formData.sku || formData.name || 'variant')
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'VARIANT';
            const skuSeed = editingProduct
                ? `${skuSeedBase}-${String(editingProduct.id).slice(0, 8)}`
                : skuSeedBase;
            const normalizedVariants = formData.variants
                .map((v, index) => {
                    const rawName = normalizeVariantLabel(String(v.name || '').trim(), formData.unit || 'kg');
                    const rawSku = String(v.sku || '').trim().toUpperCase();
                    const rawDiscountPct = String(v.price || '').trim();
                    const rawStock = String(v.stock || '').trim();
                    const parsedVariantStock = rawStock === '' ? NaN : parseInt(rawStock, 10);
                    const hasUserInput = !!(rawName || rawSku || rawDiscountPct || rawStock);
                    if (!hasUserInput) return null;
                    const discountPct = Math.max(0, Math.min(100, parseFloat(rawDiscountPct) || 0));
                    const multiplier = getVariantQuantityMultiplier(rawName || `Option ${index + 1}`);
                    const baseTotal = parsedBasePrice * multiplier;
                    const variantPriceOverride =
                        baseTotal > 0
                            ? discountPct > 0
                                ? Math.max(0, Number((baseTotal * (1 - discountPct / 100)).toFixed(2)))
                                : baseTotal
                            : undefined;
                    return {
                        id: v.id,
                        sku: buildVariantSku(skuSeed, rawName || `Option ${index + 1}`, index, rawSku || undefined),
                        attributeValue: rawName || `Option ${index + 1}`,
                        isBulkVariant: Boolean(v.isBulkVariant),
                        priceOverride: variantPriceOverride,
                        stockQuantity: Math.max(
                            0,
                            Number.isFinite(parsedVariantStock) ? parsedVariantStock : 0,
                        ),
                        lowStockThreshold: v.lowStockThreshold ? parseInt(v.lowStockThreshold, 10) : 5,
                    };
                })
                .filter((v): v is NonNullable<typeof v> => !!v);

            const composedDescription = composeDescriptionWithMeta(formData.description || '', {
                storageInfo: formData.storageInfo || '',
                originStory: formData.originStory || '',
                faqInfo: formData.faqInfo || '',
            });

            // Keep stock truly wired to what backend persists (variants).
            // - No variants: create one default variant from stock field.
            // - Single variant: stock field controls that variant's stock.
            let variantsPayload = normalizedVariants;
            if (normalizedVariants.length === 0) {
                variantsPayload = [{
                    sku: formData.sku || `${skuSeed}-1`,
                    attributeValue: 'Default',
                    isBulkVariant: false,
                    priceOverride: undefined,
                    stockQuantity: parsedStock,
                    lowStockThreshold: 5,
                }];
            } else if (normalizedVariants.length === 1) {
                variantsPayload = normalizedVariants.map(v => ({ ...v, stockQuantity: parsedStock }));
            }

            // If user edits top-level stock for multi-variant products, keep backend in sync by
            // applying the delta to the first variant instead of silently ignoring it.
            if (variantsPayload.length > 1) {
                const currentTotal = variantsPayload.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
                const diff = parsedStock - currentTotal;
                if (diff !== 0) {
                    const first = variantsPayload[0];
                    const nextFirstStock = Math.max(0, (first.stockQuantity || 0) + diff);
                    variantsPayload = [
                        { ...first, stockQuantity: nextFirstStock },
                        ...variantsPayload.slice(1),
                    ];
                }
            }

            // Prevent accidental "Default" variant override from masking base price.
            // Base price should represent the default pack; only explicit non-default variants override price.
            variantsPayload = variantsPayload.map((v) => {
                const label = String((v as any).attributeValue || '').trim().toLowerCase();
                const isDefaultLike = !label || label === 'default';
                if (!isDefaultLike) return v;
                return { ...v, priceOverride: undefined };
            });

            if (editingProduct) {
                const sellerName =
                    sellers.find((s) => s.id === sellerId)?.storeName ||
                    editingProduct.vendor ||
                    '';
                const optimisticProduct: Product = {
                    ...editingProduct,
                    name: formData.name,
                    category: formData.category,
                    vendor: sellerName,
                    sellerId: sellerId as string,
                    sku: formData.sku || editingProduct.sku,
                    price: parseFloat(formData.price) || editingProduct.price,
                    discountPrice: formData.discountPrice ? parseFloat(formData.discountPrice) : undefined,
                    image: imagePaths[0] || editingProduct.image,
                    images: imagePaths.length ? imagePaths : (editingProduct.images || []),
                    stock: parsedStock,
                    availableStock: parsedStock,
                    status: formData.isActive ? 'Active' : 'Draft',
                    expiryDate: formData.expiryDate || undefined,
                    harvestDate: formData.harvestDate || undefined,
                    isSeasonal: formData.isSeasonal,
                    seasonalStart: formData.seasonalStart || undefined,
                    seasonalEnd: formData.seasonalEnd || undefined,
                } as Product;
                setProductOverrides((prev) => ({ ...prev, [String(editingProduct.id)]: optimisticProduct }));
                const updatedApi = await updateProductApi(String(editingProduct.id), {
                    name: formData.name,
                    description: composedDescription,
                    basePrice: parseFloat(formData.price),
                    categoryId,
                    ...(isSeller ? {} : { sellerId: sellerId as string }),
                    harvestDate: formData.harvestDate || null,
                    expiryDate: formData.expiryDate || null,
                    isSeasonal: formData.isSeasonal,
                    isOrganic: formData.isOrganic,
                    seasonalStart: formData.seasonalStart || null,
                    seasonalEnd: formData.seasonalEnd || null,
                    bulkDiscountQty: formData.bulkDiscountQty ? parseInt(formData.bulkDiscountQty) : undefined,
                    bulkDiscountPrice: formData.bulkDiscountPrice ? parseFloat(formData.bulkDiscountPrice) : undefined,
                    allowCashOnDelivery: formData.allowCashOnDelivery,
                    freshnessScore: formData.freshnessScore ? parseInt(formData.freshnessScore) : undefined,
                    ripenessStage: formData.ripenessStage || undefined,
                    farmName: formData.farmName || undefined,
                    farmState: formData.farmState || undefined,
                    isActive: formData.isActive,
                    images: imagesPayload,
                    variants: variantsPayload,
                });
                const updated = updatedApi;
                const updatedVariantCount = updated.variants?.length ?? variantsPayload.length;
                const updatedStock = Number(updated.stock ?? variantsPayload.reduce((sum, v) => sum + (v.stockQuantity || 0), 0));
                const previousStock = Number(editingProduct.stock ?? 0);
                const stockChanged = updatedStock !== previousStock;
                toast.success(`${formData.name} updated`, {
                    description: stockChanged
                        ? `${updatedVariantCount} variant${updatedVariantCount === 1 ? '' : 's'} · ${updatedStock} total stock`
                        : 'Product details updated successfully',
                });
                setIsModalOpen(false);
                await refreshProducts();
                setProductOverrides((prev) => {
                    const next = { ...prev };
                    delete next[String(editingProduct.id)];
                    return next;
                });
            } else {
                await createProductApi({
                    name: formData.name,
                    description: composedDescription,
                    basePrice: parseFloat(formData.price),
                    sellerId: sellerId as string,
                    categoryId,
                    harvestDate: formData.harvestDate,
                    expiryDate: formData.expiryDate,
                    isSeasonal: formData.isSeasonal,
                    isOrganic: formData.isOrganic,
                    seasonalStart: formData.seasonalStart,
                    seasonalEnd: formData.seasonalEnd,
                    bulkDiscountQty: formData.bulkDiscountQty ? parseInt(formData.bulkDiscountQty) : undefined,
                    bulkDiscountPrice: formData.bulkDiscountPrice ? parseFloat(formData.bulkDiscountPrice) : undefined,
                    allowCashOnDelivery: formData.allowCashOnDelivery,
                    freshnessScore: formData.freshnessScore ? parseInt(formData.freshnessScore) : undefined,
                    ripenessStage: formData.ripenessStage || undefined,
                    farmName: formData.farmName || undefined,
                    farmState: formData.farmState || undefined,
                    variants: variantsPayload.map(v => ({
                        sku: v.sku || `SKU-${Date.now()}`,
                        attributeValue: v.attributeValue,
                        isBulkVariant: Boolean((v as any).isBulkVariant),
                        priceOverride: v.priceOverride,
                        stockQuantity: v.stockQuantity,
                        lowStockThreshold: v.lowStockThreshold,
                    })),
                    images: imagesPayload,
                });
                toast.success('New catalog entry created');
                setIsModalOpen(false);
                void refreshProducts();
            }
        } catch (err: any) {
            if (editingProduct) {
                setProductOverrides((prev) => {
                    const next = { ...prev };
                    delete next[String(editingProduct.id)];
                    return next;
                });
            }
            toast.error(getUserErrorMessage(err, 'Failed to save product'));
        } finally {
            setIsSavingProduct(false);
        }
    };

    return (
        <div className="space-y-12 pb-20 font-sans relative">
            {/* Header with improved typography and layout */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-emerald-600" />
                        </div>
                        <span className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.25em] opacity-80">Catalog Control</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter font-heading">
                        Products & Inventory
                    </h1>
                    <p className="text-slate-500 text-sm mt-3 max-w-xl leading-relaxed font-medium">
                        Manage your digital orchard's assets, monitor stock levels, and coordinate vendor supplies with surgical precision.
                    </p>
                </motion.div>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={handleExportProductsCsv}
                        className="h-11 px-5 bg-white border border-slate-100 rounded-xl text-[9px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 hover:shadow-lg transition-all duration-500 flex items-center gap-2"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                    </button>
                    <button
                        onClick={() => {
                            setEditingProduct(null);
                            setFormData({
                                name: '', price: '', discountPrice: '', stock: '', category: 'Fruits',
                                categoryId: '', sellerId: '',
                                sku: '', image: '', images: [''], description: '', storageInfo: '', originStory: '', faqInfo: '', unit: 'kg',
                                nutritionalInfo: '', origin: '', flashSale: false, expiryDate: '',
                                harvestDate: '', isOrganic: false, grade: 'A', isSeasonal: false,
                                seasonalStart: '', seasonalEnd: '', bulkDiscountQty: '', bulkDiscountPrice: '',
                                allowCashOnDelivery: true,
                                isActive: true,
                                freshnessScore: '', ripenessStage: '', farmName: '', farmState: '',
                                variants: []
                            });
                            setIsModalOpen(true);
                        }}
                        className="h-11 px-6 bg-slate-900 border border-slate-800 rounded-xl text-white hover:bg-emerald-600 hover:border-emerald-500 hover:shadow-lg transition-all duration-500 flex items-center gap-2 group"
                    >
                        <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Add Product</span>
                    </button>
                </div>
            </div>

            {/* Catalog Discovery Stats: Refined Interactive Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { id: 'All' as const, label: 'Full Catalog', value: stats.total, icon: Package, color: 'emerald', sub: 'Total Assets' },
                    { id: 'Low' as const, label: 'Critical Stock', value: stats.lowStock, icon: AlertTriangle, color: 'orange', sub: 'Action Required' },
                    { id: 'Seasonal' as const, label: 'Seasonal Hub', value: stats.seasonal, icon: Clock, color: 'blue', sub: 'Active Cycles' },
                    { id: 'Out' as const, label: 'Depleted Stock', value: stats.outOfStock, icon: Ban, color: 'red', sub: 'Immediate Restock' }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        key={stat.label + i}
                        onClick={() => setInventoryFilter(stat.id)}
                        className={cn(
                            "bg-white p-6 rounded-3xl border shadow-sm relative overflow-hidden group transition-all cursor-pointer hover:shadow-xl",
                            inventoryFilter === stat.id
                                ? cn(
                                    "ring-[8px] ring-emerald-500/5 shadow-lg scale-[1.01]",
                                    stat.color === 'emerald' && "border-emerald-500/50",
                                    stat.color === 'orange' && "border-orange-500/50",
                                    stat.color === 'blue' && "border-blue-500/50",
                                    stat.color === 'red' && "border-red-500/50",
                                )
                                : "border-slate-100 hover:border-slate-200"
                        )}
                    >
                        <div className="relative z-10">
                            <div className={cn(
                                "h-11 w-11 rounded-xl flex items-center justify-center mb-6 border transition-all duration-700 group-hover:scale-110 shadow-lg", 
                                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                stat.color === 'orange' ? "bg-orange-50 text-orange-600 border-orange-100" :
                                stat.color === 'blue' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                "bg-red-50 text-red-600 border-red-100"
                            )}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1.5 leading-none font-heading group-hover:translate-x-1 transition-transform">{stat.value}</p>
                            <div className="flex items-center justify-between">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                <span className="text-[8px] font-black text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">{stat.sub}</span>
                            </div>
                        </div>
                        
                        {/* Status Light */}
                        <div className={cn(
                            "absolute top-8 right-8 h-2 w-2 rounded-full",
                            inventoryFilter === stat.id ? "animate-ping opacity-100" : "opacity-0",
                            stat.color === 'emerald' ? "bg-emerald-500" :
                            stat.color === 'orange' ? "bg-orange-500" :
                            stat.color === 'blue' ? "bg-blue-500" :
                            "bg-red-500"
                        )} />
                    </motion.div>
                ))}
            </div>

            {/* Main Discovery Interface */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-premium overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/30">
                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar max-w-full">
                        {['All', ...categories.map(c => c.name)].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                    "px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    activeCategory === cat
                                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                        : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-center flex-1 xl:max-w-2xl">
                        <div className="relative group flex-1 w-full">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                <Search className="h-3.5 w-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by SKU, Name, or Vendor..."
                                className="w-full h-11 pl-12 pr-4 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 placeholder-slate-400 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="h-11 px-5 rounded-xl bg-white border border-slate-100 flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm group"
                        >
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-400 transition-colors" />
                            <span>Price {sortOrder === 'asc' ? 'Low-High' : 'High-Low'}</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/20">
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Detail</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Categorization</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Inventory Depth</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Cycle Status</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Valuation</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Market Status</th>
                                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Management</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {adminDataLoading && products.length === 0 ? (
                                <AdminTableSkeletonRows rows={12} cols={7} />
                            ) : (
                                <AnimatePresence mode='popLayout'>
                                    {filteredProducts.map((product, idx) => (
                                        (() => {
                                            const nowMs = Date.now();
                                            const expiryMs = product.expiryDate ? new Date(product.expiryDate).getTime() : NaN;
                                            const hasExpiry = Number.isFinite(expiryMs);
                                            const isExpired = hasExpiry && expiryMs < nowMs;
                                            const daysToExpiry = hasExpiry ? Math.ceil((expiryMs - nowMs) / 86400000) : null;
                                            const marketStatusLabel = isExpired ? 'Expired' : product.status;
                                            const isMarketActive = !isExpired && product.status === 'Active';
                                            return (
                                        <motion.tr
                                            key={product.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                                            className="group hover:bg-slate-50/50 transition-all cursor-default"
                                        >
                                            <td className="px-10 py-10">
                                                <div className="flex items-center gap-6">
                                                    <div className="h-20 w-20 rounded-[2.5rem] bg-slate-100 overflow-hidden shadow-xl border border-slate-100 group-hover:scale-105 transition-transform duration-700 relative flex-shrink-0">
                                                        <img
                                                            src={product.image}
                                                            className="w-full h-full object-cover group-hover:rotate-3 transition-transform duration-700"
                                                            alt={product.name}
                                                        />
                                                        {product.isOrganic && (
                                                            <div className="absolute top-2 right-2 h-6 w-6 bg-emerald-500 rounded-xl flex items-center justify-center border-2 border-white shadow-lg">
                                                                <Zap className="h-3 w-3 text-white fill-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-base font-black text-slate-900 uppercase tracking-tight group-hover:text-emerald-600 transition-colors truncate max-w-[240px] font-heading">{product.name}</span>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <div className="h-4 w-4 rounded-md bg-slate-100 flex items-center justify-center">
                                                                <Store className="h-2.5 w-2.5 text-slate-400" />
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest truncate">
                                                                {product.vendor}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex flex-col gap-2">
                                                    <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-[10px] font-black text-slate-900 uppercase tracking-widest w-fit border border-slate-100">
                                                        {product.category}
                                                    </span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">SKU: {product.sku}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10 text-right">
                                                <div className="flex flex-col items-end">
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn(
                                                            "text-base font-black tracking-tighter font-heading",
                                                            (product.availableStock ?? product.stock) <= (product.lowStockThreshold ?? 5) ? 'text-red-600' : 'text-slate-900'
                                                        )}>
                                                            {product.availableStock ?? product.stock} <span className="text-[10px] uppercase text-slate-400 ml-1">{product.unit}s</span>
                                                        </span>
                                                        {(product.availableStock ?? product.stock) <= (product.lowStockThreshold ?? 5) && (
                                                            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
                                                        )}
                                                    </div>
                                                    <div className="mt-2 w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(100, ((product.availableStock ?? product.stock) / (product.stock || 1)) * 100)}%` }}
                                                            className={cn(
                                                                "h-full rounded-full",
                                                                (product.availableStock ?? product.stock) <= (product.lowStockThreshold ?? 5) ? 'bg-red-500' : 'bg-emerald-500'
                                                            )} 
                                                        />
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">
                                                        Reserved: {product.reservedStock ?? 0} Units
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10 text-right">
                                                <div className="flex flex-col items-end">
                                                    {!product.isSeasonal ? (
                                                        <span className={cn(
                                                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border",
                                                            isExpired ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        )}>
                                                            <div className={cn("h-1.5 w-1.5 rounded-full", isExpired ? 'bg-red-500' : 'bg-emerald-500')} />
                                                            {isExpired ? 'Expired' : 'Stable Supply'}
                                                        </span>
                                                    ) : (() => {
                                                        const now = new Date();
                                                        const start = product.seasonalStart ? new Date(product.seasonalStart) : null;
                                                        const end = product.seasonalEnd ? new Date(product.seasonalEnd) : null;
                                                        // Keep seasonal state consistent with backend filtering:
                                                        // if either boundary is missing, treat window as open-ended.
                                                        const afterStart = !start || now >= start;
                                                        const beforeEnd = !end || now <= end;
                                                        const isInSeason = afterStart && beforeEnd;
                                                        if (isExpired) {
                                                            return (
                                                                <span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border bg-red-50 text-red-700 border-red-100">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                                                    Expired
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className={cn(
                                                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border",
                                                                isInSeason ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-700 border-slate-200'
                                                            )}>
                                                                <div className={cn("h-1.5 w-1.5 rounded-full", isInSeason ? 'bg-blue-500 animate-pulse' : 'bg-slate-500')} />
                                                                {isInSeason ? 'In Peak Season' : 'Seasonal'}
                                                            </span>
                                                        );
                                                    })()}
                                                    {product.expiryDate && (
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-[0.15em] mt-3 italic flex items-center gap-1.5",
                                                            isExpired || (daysToExpiry != null && daysToExpiry < 3) ? 'text-red-500' : 'text-slate-400'
                                                        )}>
                                                            <AlertCircle className="h-3 w-3" />
                                                            {isExpired ? 'Expired' : `${daysToExpiry}d till expiration`}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-10 py-10 text-right">
                                                <div className="flex flex-col items-end">
                                                    {product.discountPrice ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-xl font-black text-emerald-600 tracking-tighter leading-none font-heading">₹{product.discountPrice}</span>
                                                            <span className="text-[11px] line-through text-slate-300 font-black uppercase tracking-widest">₹{product.price}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xl font-black text-slate-900 tracking-tighter leading-none font-heading">₹{product.price}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex justify-center">
                                                    <span className={cn(
                                                        "px-5 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                                                        isMarketActive
                                                            ? 'bg-white text-emerald-700 border-emerald-100 shadow-sm' 
                                                            : isExpired
                                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                                : 'bg-slate-50 text-slate-400 border-slate-200'
                                                    )}>
                                                        {marketStatusLabel}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10 text-center">
                                                <div className="flex items-center justify-center gap-4">
                                                    <button
                                                        onClick={() => handleOpenEditModal(product)}
                                                        className="h-12 w-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-2xl hover:shadow-slate-900/20 transition-all duration-500 group"
                                                    >
                                                        <Edit2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteProduct(product.id, product.name)}
                                                        className="h-12 w-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-2xl hover:shadow-red-500/20 transition-all duration-500 group"
                                                    >
                                                        <Trash2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                            );
                                        })()
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>

                    {filteredProducts.length === 0 && !(adminDataLoading && products.length === 0) && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-40 text-center"
                        >
                            <div className="h-24 w-24 rounded-[3rem] bg-slate-50 flex items-center justify-center mx-auto mb-8 border border-dashed border-slate-200">
                                <ShoppingBag className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter font-heading">No assets match.</h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-4 max-w-xs mx-auto opacity-60">Adjust your categorization or filters <br />to refine the results.</p>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Product form side panel: High-Fidelity Glassmorphism */}
            {isModalOpen && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all duration-700"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200, mass: 0.8 }}
                            className="relative h-full w-full max-w-3xl bg-white shadow-[0_0_80px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden"
                        >
                            {/* Sheet Header: Premium Glass Backdrop */}
                            <div className="p-12 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="h-12 w-12 bg-slate-900 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-slate-900/20">
                                            <Package className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter font-heading">
                                                {editingProduct ? 'Update Asset' : 'New Catalog Entry'}
                                            </h2>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Matrix ID: {editingProduct?.id || 'Pending...'}</p>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="relative z-10 h-14 w-14 flex items-center justify-center bg-white border border-slate-200 rounded-[1.5rem] text-slate-300 hover:text-red-500 hover:border-red-100 hover:shadow-2xl transition-all duration-500"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitProduct} className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-12 space-y-16 custom-scrollbar bg-white relative">
                                    {/* Section 1: Basic Details */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <Zap className="w-4 h-4 text-emerald-500" />
                                            </div>
                                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Identity & Valuation</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-8">
                                            <FormInput
                                                label="Product Designation"
                                                value={formData.name}
                                                onChange={(v: string) => setFormData({ ...formData, name: v })}
                                                placeholder="e.g. Premium Alphonso Mango"
                                                required
                                            />
                                            <div className="grid grid-cols-2 gap-8">
                                                <FormInput
                                                    label="Base Value (₹)"
                                                    type="number"
                                                    value={formData.price}
                                                    onChange={(v: string) => setFormData({ ...formData, price: v })}
                                                    placeholder="0.00"
                                                    required
                                                />
                                                <FormInput
                                                    label="Offer Value (₹)"
                                                    type="number"
                                                    value={formData.discountPrice}
                                                    onChange={(v: string) => setFormData({ ...formData, discountPrice: v })}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Stock & Category */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <Activity className="w-4 h-4 text-blue-500" />
                                            </div>
                                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Logistics & Categorization</h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-8">
                                            <FormInput
                                                label="Total Units"
                                                type="number"
                                                value={formData.stock}
                                                onChange={(v: string) => setFormData({ ...formData, stock: v })}
                                                placeholder="0"
                                                required
                                            />
                                            <FormSelect
                                                label="Unit Metric"
                                                value={formData.unit}
                                                onChange={(v: string) => setFormData({ ...formData, unit: v })}
                                                options={[
                                                    { label: 'Kilogram (kg)', value: 'kg' },
                                                    { label: 'Piece (pc)', value: 'piece' },
                                                    { label: 'Dozen (doz)', value: 'dozen' },
                                                    { label: 'Box (bx)', value: 'box' }
                                                ]}
                                            />
                                            <FormSelect
                                                label="Classification"
                                                value={formData.categoryId || formData.category}
                                                onChange={(v: string) => {
                                                    const cat = categories.find(c => c.id === v || c.name === v);
                                                    setFormData({
                                                        ...formData,
                                                        categoryId: cat ? String(cat.id) : '',
                                                        category: cat?.name || v,
                                                    });
                                                }}
                                                options={categories.length ? categories.map(c => ({ label: c.name, value: c.id })) : [
                                                    { label: 'Fruits', value: 'Fruits' }, { label: 'Vegetables', value: 'Vegetables' }
                                                ]}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <input
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                placeholder="Create new category (e.g. Dry Fruits)"
                                                className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCreateCategory}
                                                disabled={isCreatingCategory}
                                                className="h-11 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                            >
                                                {isCreatingCategory ? 'Creating…' : 'Create category'}
                                            </button>
                                        </div>
                                        {!isSeller && (
                                            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                                <FormSelect
                                                    label={editingProduct ? 'Assigned Vendor' : 'Assigned Vendor — required'}
                                                    value={formData.sellerId}
                                                    onChange={(v: string) => setFormData({ ...formData, sellerId: v })}
                                                    options={[
                                                        { label: sellers.length ? 'Select merchant provider...' : 'Synchronizing vendors...', value: '' },
                                                        ...sellers.map(s => ({ label: s.storeName, value: s.id }))
                                                    ]}
                                                />
                                                <p className="mt-4 text-[9px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                                                    Merchant ownership determines storefront visibility and order fulfillment pipeline.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Section 3: Attributes */}
                                    <div className="grid grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                                Safety & Type
                                            </h3>
                                            <div className="space-y-4">
                                                <ToggleItem
                                                    label="Certified Organic"
                                                    checked={formData.isOrganic}
                                                    onChange={(v: boolean) => setFormData({ ...formData, isOrganic: v })}
                                                    color="emerald"
                                                />
                                                <ToggleItem
                                                    label="Active Season"
                                                    checked={formData.isSeasonal}
                                                    onChange={(v: boolean) => setFormData({ ...formData, isSeasonal: v })}
                                                    color="blue"
                                                />
                                                <ToggleItem
                                                    label="Flash Market"
                                                    checked={formData.flashSale}
                                                    onChange={(v: boolean) => setFormData({ ...formData, flashSale: v })}
                                                    color="orange"
                                                />
                                                <ToggleItem
                                                    label="COD Clearance"
                                                    checked={formData.allowCashOnDelivery !== false}
                                                    onChange={(v: boolean) => setFormData({ ...formData, allowCashOnDelivery: v })}
                                                    color="emerald"
                                                />
                                                <ToggleItem
                                                    label="Publish to Storefront"
                                                    checked={formData.isActive}
                                                    onChange={(v: boolean) => setFormData({ ...formData, isActive: v })}
                                                    color="emerald"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-8">
                                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                                <Binary className="w-4 h-4 text-indigo-500" />
                                                Quality Matrix
                                            </h3>
                                            <FormSelect
                                                label="Yield Grade"
                                                value={formData.grade}
                                                onChange={(v: string) => setFormData({ ...formData, grade: v as any })}
                                                options={[
                                                    { label: 'Grade A (Pristine)', value: 'A' },
                                                    { label: 'Grade B (Standard)', value: 'B' },
                                                    { label: 'Premium / Reserve', value: 'Premium' }
                                                ]}
                                            />
                                            <FormInput
                                                label="Expiration Cycle"
                                                type="date"
                                                value={formData.expiryDate}
                                                onChange={(v: string) => setFormData({ ...formData, expiryDate: v })}
                                            />
                                            <FormInput
                                                label="Harvest Timestamp"
                                                type="date"
                                                value={formData.harvestDate}
                                                onChange={(v: string) => setFormData({ ...formData, harvestDate: v })}
                                            />
                                        </div>
                                    </div>

                                    {/* Section 4: Product Page Content */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <AlertCircle className="w-4 h-4 text-emerald-500" />
                                            </div>
                                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Product Page Content</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-8">
                                            <FormTextarea
                                                label="Product Details"
                                                value={formData.description}
                                                onChange={(v: string) => setFormData({ ...formData, description: v })}
                                                placeholder="Main product details shown in Product Details tab."
                                            />
                                            <FormTextarea
                                                label="Storage & Usage"
                                                value={formData.storageInfo}
                                                onChange={(v: string) => setFormData({ ...formData, storageInfo: v })}
                                                placeholder="How customers should store and use this product."
                                            />
                                            <FormTextarea
                                                label="Origin Story"
                                                value={formData.originStory}
                                                onChange={(v: string) => setFormData({ ...formData, originStory: v })}
                                                placeholder="Farm origin story and sourcing details."
                                            />
                                            <FormTextarea
                                                label="FAQ"
                                                value={formData.faqInfo}
                                                onChange={(v: string) => setFormData({ ...formData, faqInfo: v })}
                                                placeholder="FAQs for this product (you can write Q/A text)."
                                            />
                                        </div>
                                    </div>

                                    {/* Section 5: Freshness Intelligence */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                                <Zap className="w-4 h-4 text-emerald-500" />
                                            </div>
                                            <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em]">Freshness Intelligence</h3>
                                        </div>
                                        <div className="p-10 bg-emerald-50/20 border border-emerald-100 rounded-[3rem] space-y-10 relative overflow-hidden">
                                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/5 blur-[60px]" />
                                            
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">
                                                    Freshness Index (1-5)
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    {[1, 2, 3, 4, 5].map((score) => {
                                                        const current = parseInt(formData.freshnessScore) || 0;
                                                        return (
                                                            <button
                                                                key={score}
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, freshnessScore: String(score) })}
                                                                className={cn(
                                                                    "h-14 w-14 rounded-2xl border-2 text-base font-black transition-all duration-500 font-heading",
                                                                    current === score
                                                                        ? "bg-emerald-600 border-emerald-600 text-white shadow-[0_10px_25px_rgba(5,150,105,0.3)] scale-110"
                                                                        : "bg-white border-slate-100 text-slate-300 hover:border-emerald-300 hover:text-emerald-500"
                                                                )}
                                                            >
                                                                {score}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-8">
                                                <FormSelect
                                                    label="Ripeness State"
                                                    value={formData.ripenessStage}
                                                    onChange={(v: string) => setFormData({ ...formData, ripenessStage: v })}
                                                    options={[
                                                        { label: 'Not Defined', value: '' },
                                                        { label: 'Unripe / Green', value: 'Unripe' },
                                                        { label: 'Ripening', value: 'Ripening' },
                                                        { label: 'Ready for Intake', value: 'Ripe & Ready' },
                                                        { label: 'Peak Flavor', value: 'Peak Ripe' },
                                                        { label: 'Over-ripe', value: 'Over-ripe' },
                                                    ]}
                                                />
                                                <FormInput
                                                    label="Origin State"
                                                    value={formData.farmState}
                                                    onChange={(v: string) => setFormData({ ...formData, farmState: v })}
                                                    placeholder="e.g. Karnataka"
                                                />
                                            </div>
                                            <FormInput
                                                label="Farm Source Designation"
                                                value={formData.farmName}
                                                onChange={(v: string) => setFormData({ ...formData, farmName: v })}
                                                placeholder="e.g. Fruit Tribe Orchard"
                                            />
                                        </div>
                                    </div>

                                    {/* Section 6: Variants */}
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                    <Binary className="w-4 h-4 text-slate-900" />
                                                </div>
                                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Product Variants</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    variants: [...formData.variants, { name: '', price: '', stock: '', sku: '', lowStockThreshold: '5', isBulkVariant: false }]
                                                })}
                                                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-3 shadow-xl shadow-slate-900/10"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Append Variant
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            {formData.variants.map((variant, i) => (
                                                <motion.div 
                                                    key={i} 
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="p-10 bg-slate-50/50 border border-slate-100 rounded-[2.5rem] relative group/var hover:bg-white hover:shadow-2xl transition-all duration-700"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const n = [...formData.variants];
                                                            n.splice(i, 1);
                                                            setFormData({ ...formData, variants: n });
                                                        }}
                                                        className="absolute top-8 right-8 h-10 w-10 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-slate-300 hover:text-red-500 hover:border-red-100 transition-all opacity-0 group-hover/var:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                        <FormInput
                                                            label="Descriptor (Size/Weight)"
                                                            value={variant.name}
                                                            onChange={(v: string) => {
                                                                const n = [...formData.variants];
                                                                n[i].name = v;
                                                                setFormData({ ...formData, variants: n });
                                                            }}
                                                            placeholder="1kg / 12 units"
                                                        />
                                                        <FormInput
                                                            label="SKU ID"
                                                            value={variant.sku}
                                                            onChange={(v: string) => {
                                                                const n = [...formData.variants];
                                                                n[i].sku = v;
                                                                setFormData({ ...formData, variants: n });
                                                            }}
                                                            placeholder="Auto"
                                                        />
                                                        <FormInput
                                                            label="Variant Discount (%)"
                                                            type="number"
                                                            value={variant.price}
                                                            onChange={(v: string) => {
                                                                const n = [...formData.variants];
                                                                if (v === '') {
                                                                    n[i].price = '';
                                                                } else {
                                                                    n[i].price = String(Math.max(0, Math.min(100, Number(v))));
                                                                }
                                                                setFormData({ ...formData, variants: n });
                                                            }}
                                                            placeholder="Discount on base price (e.g. 10)"
                                                        />
                                                        <div className="grid grid-cols-2 gap-8">
                                                            <FormInput
                                                                label="Variant Stock"
                                                                type="number"
                                                                value={variant.stock}
                                                                onChange={(v: string) => {
                                                                    const n = [...formData.variants];
                                                                    n[i].stock = v === '' ? '' : String(Math.max(0, Number(v)));
                                                                    setFormData({ ...formData, variants: n });
                                                                }}
                                                                placeholder="0"
                                                            />
                                                            <FormInput
                                                                label="Low Alert"
                                                                type="number"
                                                                value={variant.lowStockThreshold || ''}
                                                                onChange={(v: string) => {
                                                                    const n = [...formData.variants];
                                                                    n[i].lowStockThreshold = v;
                                                                    setFormData({ ...formData, variants: n });
                                                                }}
                                                                placeholder="5"
                                                            />
                                                        </div>
                                                        {Number(variant.stock) === 0 && (
                                                            <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                                                This pack has 0 stock — it will be hidden on the shop until you set stock here.
                                                            </p>
                                                        )}
                                                        <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
                                                            <div>
                                                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.15em]">Bulk Variant</p>
                                                                <p className="text-[10px] text-emerald-600">Enable to show under bulk section and tier pricing.</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const n = [...formData.variants];
                                                                    n[i].isBulkVariant = !n[i].isBulkVariant;
                                                                    setFormData({ ...formData, variants: n });
                                                                }}
                                                                className={cn(
                                                                    'h-8 px-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
                                                                    variant.isBulkVariant
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : 'bg-white border border-emerald-200 text-emerald-700',
                                                                )}
                                                            >
                                                                {variant.isBulkVariant ? 'ON' : 'OFF'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                            {formData.variants.length === 0 && (
                                                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[3.5rem] bg-slate-50/50">
                                                    <Binary className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No variants mapped for this asset.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Section 7: Visual Assets */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <ImageIcon className="w-4 h-4 text-emerald-500" />
                                            </div>
                                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Visual Identification</h3>
                                        </div>
                                        <ImageUpload
                                            value={formData.images.filter(Boolean)}
                                            onChange={(urls) => setFormData({
                                                ...formData,
                                                images: urls,
                                                image: urls[0] || ''
                                            })}
                                            maxFiles={6}
                                        />
                                    </div>
                                </div>

                                {/* Action Console */}
                                <div className="p-12 bg-slate-50 border-t border-slate-100 flex gap-6 shadow-2xl relative z-10">
                                    <button
                                        type="button"
                                        disabled={isSavingProduct}
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 h-20 bg-white border border-slate-200 text-slate-900 rounded-[2rem] hover:bg-slate-100 text-[11px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 duration-500"
                                    >
                                        Cancel Cycle
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingProduct}
                                        className="flex-[2] h-20 bg-slate-900 text-white rounded-[2rem] hover:bg-emerald-600 text-[11px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-slate-900/20 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95 duration-500"
                                    >
                                        {isSavingProduct ? 'Synchronizing...' : editingProduct ? 'Commit Changes' : 'Initialize Asset'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

// Helper Components for Premium Forms
function FormInput({ label, type = 'text', value, onChange, placeholder, required }: any) {
    return (
        <div className="space-y-3 group/field">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 group-focus-within/field:text-emerald-500 transition-colors">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input
                    type={type}
                    required={required}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full h-16 px-8 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-[13px] font-bold text-slate-900 placeholder:text-slate-300 focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500/50 focus:bg-white outline-none transition-all duration-500 shadow-inner"
                    placeholder={placeholder}
                />
            </div>
        </div>
    );
}

function FormSelect({ label, value, onChange, options }: any) {
    return (
        <div className="space-y-3 group/field">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 group-focus-within/field:text-emerald-500 transition-colors">
                {label}
            </label>
            <div className="relative">
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full h-16 px-8 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-[11px] font-black text-slate-900 focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500/50 focus:bg-white outline-none transition-all duration-500 shadow-inner appearance-none cursor-pointer uppercase tracking-widest"
                >
                    {options.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                    <ChevronRight className="h-4 w-4 rotate-90" />
                </div>
            </div>
        </div>
    );
}

function FormTextarea({ label, value, onChange, placeholder }: any) {
    return (
        <div className="space-y-3 group/field">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 group-focus-within/field:text-emerald-500 transition-colors">
                {label}
            </label>
            <div className="relative">
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full min-h-[130px] px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-[13px] font-semibold text-slate-900 placeholder:text-slate-300 focus:ring-[12px] focus:ring-emerald-500/5 focus:border-emerald-500/50 focus:bg-white outline-none transition-all duration-500 shadow-inner resize-y"
                    placeholder={placeholder}
                />
            </div>
        </div>
    );
}

function ToggleItem({ label, checked, onChange, color }: any) {
    const colors: any = {
        emerald: 'bg-emerald-500 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
        blue: 'bg-blue-500 ring-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
        orange: 'bg-orange-500 ring-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
    };

    return (
        <label className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] cursor-pointer group hover:bg-white hover:border-emerald-200 hover:shadow-xl transition-all duration-500">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">{label}</span>
            <div className="relative">
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={e => onChange(e.target.checked)}
                />
                <div className={cn(
                    "w-14 h-8 rounded-full transition-all duration-500",
                    checked ? colors[color] : 'bg-slate-200'
                )} />
                <div className={cn(
                    "absolute left-1.5 top-1.5 w-5 h-5 rounded-full bg-white shadow-lg transition-transform duration-500",
                    checked ? 'translate-x-6' : 'translate-x-0'
                )} />
            </div>
        </label>
    );
}
