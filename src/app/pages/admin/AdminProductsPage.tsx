import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useAdminData } from '@/app/context/AdminDataContext';
import {
    createProduct as createProductApi,
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
    Binary, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/app/components/ui/ImageUpload';
import { useLocation } from 'react-router-dom';

function toDateInputValue(value?: string | null): string {
    if (!value) return '';
    // Browser date inputs require yyyy-MM-dd only.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

export function AdminProductsPage() {
    const { user } = useAuth();
    const location = useLocation();
    const { products, categories, sellers, refreshProducts } = useAdminData();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [activeCategory, setActiveCategory] = useState('All');
    const [inventoryFilter, setInventoryFilter] = useState<'All' | 'Low' | 'Out'>('All');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
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
        variants: [] as { id?: string; name: string; price: string; stock: string; sku: string; lowStockThreshold?: string }[]
    });

    const isSeller = user?.role === 'seller';

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const focusProductId = params.get('focusProductId');
        if (!focusProductId) return;

        const target = products.find((p) => String(p.id) === focusProductId);
        if (!target) return;

        setSearchQuery(target.name);
        setActiveCategory('All');
        setInventoryFilter('All');
    }, [location.search, products]);

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

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            if (isSeller && !productBelongsToSeller(product, user)) return false;

            const matchesSearch = !searchQuery ||
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.vendor || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.sku || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = activeCategory === 'All' || product.category === activeCategory;

            const matchesInventory = inventoryFilter === 'All' ||
                (inventoryFilter === 'Low' && (product.availableStock ?? product.stock) <= (product.lowStockThreshold ?? 5) && (product.availableStock ?? product.stock) > 0) ||
                (inventoryFilter === 'Out' && (product.availableStock ?? product.stock) === 0);

            return matchesSearch && matchesCategory && matchesInventory;
        }).sort((a, b) => {
            if (sortOrder === 'asc') return a.price - b.price;
            return b.price - a.price;
        });
    }, [products, user, searchQuery, sortOrder, activeCategory, inventoryFilter, isSeller]);

    const stats = useMemo(() => {
        const base = isSeller ? products.filter((p) => productBelongsToSeller(p, user)) : products;
        return {
            total: base.length,
            lowStock: base.filter(p => p.availableStock <= (p.lowStockThreshold ?? 5) && p.availableStock > 0).length,
            outOfStock: base.filter(p => p.availableStock === 0).length,
            seasonal: base.filter(p => p.isSeasonal).length
        };
    }, [products, isSeller, user]);

    const handleDeleteProduct = useCallback((id: string | number, name: string) => {
        toast(`Archive ${name}?`, {
            description: "Product will be hidden from consumer storefronts.",
            action: {
                label: "Archive",
                onClick: async () => {
                    try {
                        await deleteProductApi(String(id));
                        await refreshProducts();
                        toast.success(`${name} archived successfully`);
                    } catch (e: any) {
                        toast.error(e?.message || 'Failed to archive');
                    }
                }
            },
        });
    }, [refreshProducts]);

    const handleOpenEditModal = (product: Product) => {
        setEditingProduct(product);
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
            description: product.description || '',
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
            variants: product.variants?.map((v: any) => ({ 
                id: v.id, 
                name: v.name || v.attributeValue, 
                price: String(v.price), 
                stock: String(v.stockQuantity ?? v.stock), 
                sku: v.sku || '',
                lowStockThreshold: String(v.lowStockThreshold ?? 5)
            })) || []
        });
        setIsModalOpen(true);
    };

    const handleSubmitProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingProduct) return;
        const categoryId = formData.categoryId || categories.find(c => c.name === formData.category)?.id;
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
            const normalizedVariants = formData.variants
                .map(v => ({
                    id: v.id,
                    sku: v.sku,
                    attributeValue: v.name,
                    priceOverride: parseFloat(v.price) || undefined,
                    stockQuantity: parseInt(v.stock, 10) || 0,
                    lowStockThreshold: v.lowStockThreshold ? parseInt(v.lowStockThreshold, 10) : 5,
                }))
                .filter(v => v.sku || v.attributeValue);

            // Keep stock truly wired to what backend persists (variants).
            // - No variants: create one default variant from stock field.
            // - Single variant: stock field controls that variant's stock.
            let variantsPayload =
                normalizedVariants.length === 0
                    ? [{
                        sku: formData.sku || `SKU-${Date.now()}`,
                        attributeValue: 'Default',
                        priceOverride: undefined,
                        stockQuantity: parsedStock,
                        lowStockThreshold: 5,
                    }]
                    : normalizedVariants.length === 1
                        ? normalizedVariants.map(v => ({ ...v, stockQuantity: parsedStock }))
                        : normalizedVariants;

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

            if (editingProduct) {
                const updated = await updateProductApi(String(editingProduct.id), {
                    name: formData.name,
                    description: formData.description || undefined,
                    basePrice: parseFloat(formData.price),
                    categoryId,
                    ...(isSeller ? {} : { sellerId: sellerId as string }),
                    harvestDate: formData.harvestDate || null,
                    expiryDate: formData.expiryDate || null,
                    isSeasonal: formData.isSeasonal,
                    seasonalStart: formData.seasonalStart || null,
                    seasonalEnd: formData.seasonalEnd || null,
                    bulkDiscountQty: formData.bulkDiscountQty ? parseInt(formData.bulkDiscountQty) : undefined,
                    bulkDiscountPrice: formData.bulkDiscountPrice ? parseFloat(formData.bulkDiscountPrice) : undefined,
                    allowCashOnDelivery: formData.allowCashOnDelivery,
                    isActive: editingProduct.status === 'Active',
                    images: imagesPayload,
                    variants: variantsPayload,
                });
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
                void refreshProducts();
            } else {
                await createProductApi({
                    name: formData.name,
                    description: formData.description || undefined,
                    basePrice: parseFloat(formData.price),
                    sellerId: sellerId as string,
                    categoryId,
                    harvestDate: formData.harvestDate,
                    expiryDate: formData.expiryDate,
                    isSeasonal: formData.isSeasonal,
                    seasonalStart: formData.seasonalStart,
                    seasonalEnd: formData.seasonalEnd,
                    bulkDiscountQty: formData.bulkDiscountQty ? parseInt(formData.bulkDiscountQty) : undefined,
                    bulkDiscountPrice: formData.bulkDiscountPrice ? parseFloat(formData.bulkDiscountPrice) : undefined,
                    allowCashOnDelivery: formData.allowCashOnDelivery,
                    variants: variantsPayload.map(v => ({
                        sku: v.sku || `SKU-${Date.now()}`,
                        attributeValue: v.attributeValue,
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
            toast.error(err?.message || 'Failed to save product');
        } finally {
            setIsSavingProduct(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ShoppingBag className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Product Management</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Products & Inventory</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg">Add products, update stock, and manage catalog details.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => toast.info('Exporting global catalog...')}
                        className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Export Products
                    </button>
                    <button
                        onClick={() => {
                            setEditingProduct(null);
                            setFormData({
                                name: '', price: '', discountPrice: '', stock: '', category: 'Fruits',
                                categoryId: '', sellerId: '',
                                sku: '', image: '', images: [''], description: '', unit: 'kg',
                                nutritionalInfo: '', origin: '', flashSale: false, expiryDate: '',
                                harvestDate: '', isOrganic: false, grade: 'A', isSeasonal: false,
                                seasonalStart: '', seasonalEnd: '', bulkDiscountQty: '', bulkDiscountPrice: '', allowCashOnDelivery: true, 
                                variants: []
                            });
                            setIsModalOpen(true);
                        }}
                        className="h-12 px-8 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Product
                    </button>
                </div>
            </div>

            {/* Catalog Discovery Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { id: 'All' as const, label: 'All Products', value: stats.total, icon: Package, color: 'emerald' },
                    { id: 'Low' as const, label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'orange' },
                    { id: 'All' as const, label: 'Seasonal products', value: stats.seasonal, icon: Clock, color: 'blue', secondary: true },
                    { id: 'Out' as const, label: 'Out of Stock', value: stats.outOfStock, icon: Ban, color: 'red' }
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label + i}
                        onClick={() => !stat.secondary && setInventoryFilter(stat.id)}
                        className={cn(
                            "bg-white p-7 rounded-[2.5rem] border shadow-sm relative overflow-hidden group transition-all cursor-pointer",
                            !stat.secondary && inventoryFilter === stat.id 
                                ? "ring-2 ring-emerald-500 border-emerald-100 shadow-md scale-[1.02]" 
                                : "border-slate-100 hover:border-slate-200 hover:shadow-md"
                        )}
                    >
                        <div className="relative z-10">
                            <div className={cn(
                                "p-4 rounded-3xl w-fit mb-6 shadow-sm", 
                                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                                stat.color === 'orange' ? "bg-orange-50 text-orange-600" :
                                stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                                "bg-red-50 text-red-600"
                            )}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1 leading-none">{stat.value}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        </div>
                        {inventoryFilter === stat.id && !stat.secondary && (
                            <div className="absolute top-4 right-6">
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                                    stat.color === 'emerald' ? "bg-emerald-500 text-white" :
                                    stat.color === 'orange' ? "bg-orange-500 text-white" :
                                    "bg-red-500 text-white"
                                )}>
                                    Filtered
                                </span>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Main Discovery Interface */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50/20">
                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar max-w-full">
                        {['All', ...categories.map(c => c.name)].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    activeCategory === cat
                                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-center flex-1 lg:max-w-2xl">
                        <div className="relative group flex-1 w-full">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Locate entity by Name, SKU or Merchant..."
                                className="w-full h-14 pl-14 pr-6 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="h-14 px-6 rounded-2xl bg-white border border-slate-100 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm group"
                        >
                            <ArrowUpDown className="w-4 h-4 text-slate-300 group-active:scale-95 transition-transform" />
                            Value {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 bg-slate-50/50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Stock</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence mode='popLayout'>
                                {filteredProducts.map((product, idx) => (
                                    <motion.tr
                                        key={product.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group hover:bg-slate-50/50 transition-all"
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="h-16 w-16 rounded-[2rem] bg-slate-900 overflow-hidden shadow-2xl shadow-slate-900/10 group-hover:scale-110 transition-transform duration-700 relative">
                                                    <img
                                                        src={product.image}
                                                        className="w-full h-full object-cover group-hover:rotate-6 transition-transform duration-700"
                                                        alt={product.name}
                                                    />
                                                    {product.isOrganic && (
                                                        <div className="absolute top-1 right-1 h-4 w-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                                                            <Zap className="h-2 w-2 text-white fill-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">{product.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                                                        <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                                                        {product.vendor}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{product.category}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SKU: {product.sku}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-sm font-black tracking-tight",
                                                        (product.availableStock ?? product.stock) <= (product.lowStockThreshold ?? 5) ? 'text-orange-600' : 'text-slate-900'
                                                    )}>
                                                        {product.availableStock ?? product.stock} / {product.stock} Available
                                                    </span>
                                                    {(product.availableStock ?? product.stock) <= (product.lowStockThreshold ?? 5) && (
                                                        <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                    Reserved: {product.reservedStock ?? 0} {product.unit}s • Total: {product.stock}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex flex-col items-end">
                                                {!product.isSeasonal ? (
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                                        Stable
                                                    </span>
                                                ) : (() => {
                                                    const now = new Date();
                                                    const start = product.seasonalStart ? new Date(product.seasonalStart) : null;
                                                    const end = product.seasonalEnd ? new Date(product.seasonalEnd) : null;
                                                    const isInSeason = start && end && now >= start && now <= end;
                                                    return (
                                                        <span className={cn(
                                                            "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 leading-none",
                                                            isInSeason ? 'text-blue-600' : 'text-orange-500'
                                                        )}>
                                                            <Clock className="w-2.5 h-2.5" />
                                                            {isInSeason ? 'In Season' : 'Paused'}
                                                        </span>
                                                    );
                                                })()}
                                                {product.expiryDate && (
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-widest mt-2 italic",
                                                        new Date(product.expiryDate).getTime() - new Date().getTime() < 86400000 * 3 ? 'text-red-500' : 'text-slate-400'
                                                    )}>
                                                        {Math.ceil((new Date(product.expiryDate).getTime() - new Date().getTime()) / 86400000)}d shelf life
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex flex-col items-end">
                                                {product.discountPrice ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-lg font-black text-emerald-600 tracking-tighter leading-none">₹{product.discountPrice}</span>
                                                        <span className="text-[10px] line-through text-slate-300 font-bold uppercase tracking-widest mt-1">₹{product.price}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-lg font-black text-slate-900 tracking-tighter leading-none">₹{product.price}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex justify-center">
                                                <span className={cn(
                                                    "px-4 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all",
                                                    product.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                                                )}>
                                                    {product.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <button
                                                    onClick={() => handleOpenEditModal(product)}
                                                    className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 hover:shadow-xl transition-all"
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(product.id, product.name)}
                                                    className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-red-500 hover:shadow-xl transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>

                    {filteredProducts.length === 0 && (
                        <div className="py-32 text-center">
                            <ShoppingBag className="w-20 h-20 text-slate-100 mx-auto mb-6" />
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">No Products Found</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto">No products match your filters.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Product form side panel */}
            {isModalOpen && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-3xl bg-white shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Sheet Header */}
                            <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                            <Package className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                                            {editingProduct ? 'Edit Product' : 'Add New Product'}
                                        </h2>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product images</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-300 hover:text-red-500 hover:shadow-xl transition-all">
                                    <X className="h-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitProduct} className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar bg-white">
                                    {/* Section 1: Basic Details */}
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Zap className="w-4 h-4" />
                                            Basic Details
                                        </h3>
                                        <div className="grid grid-cols-1 gap-6">
                                            <FormInput
                                                label="Product name"
                                                value={formData.name}
                                                onChange={(v: string) => setFormData({ ...formData, name: v })}
                                                placeholder="e.g. Premium Alphonso Mango"
                                                required
                                            />
                                            <div className="grid grid-cols-2 gap-6">
                                                <FormInput
                                                    label="Price (₹)"
                                                    type="number"
                                                    value={formData.price}
                                                    onChange={(v: string) => setFormData({ ...formData, price: v })}
                                                    placeholder="0.00"
                                                    required
                                                />
                                                <FormInput
                                                    label="Discount Price (₹)"
                                                    type="number"
                                                    value={formData.discountPrice}
                                                    onChange={(v: string) => setFormData({ ...formData, discountPrice: v })}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Stock & Category */}
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            Stock & Category
                                        </h3>
                                        <div className="grid grid-cols-3 gap-6">
                                            <FormInput
                                                label="Stock"
                                                type="number"
                                                value={formData.stock}
                                                onChange={(v: string) => setFormData({ ...formData, stock: v })}
                                                placeholder="0"
                                                required
                                            />
                                            <FormSelect
                                                label="Unit"
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
                                                label="Category"
                                                value={formData.categoryId || formData.category}
                                                onChange={(v: string) => {
                                                    const cat = categories.find(c => c.id === v || c.name === v);
                                                    setFormData({ ...formData, categoryId: v, category: cat?.name || v });
                                                }}
                                                options={categories.length ? categories.map(c => ({ label: c.name, value: c.id })) : [
                                                    { label: 'Fruits', value: 'Fruits' }, { label: 'Vegetables', value: 'Vegetables' }
                                                ]}
                                            />
                                        </div>
                                        {!isSeller && (
                                            <div className="mt-6">
                                                <FormSelect
                                                    label={editingProduct ? 'Vendor (seller)' : 'Vendor (seller) — required'}
                                                    value={formData.sellerId}
                                                    onChange={(v: string) => setFormData({ ...formData, sellerId: v })}
                                                    options={[
                                                        { label: sellers.length ? 'Select vendor…' : 'Loading vendors…', value: '' },
                                                        ...sellers.map(s => ({ label: s.storeName, value: s.id }))
                                                    ]}
                                                />
                                                <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Which merchant owns this catalog row (storefront and orders).
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Section 3: Product Options */}
                                    <div className="grid grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4" />
                                                Product Options
                                            </h3>
                                            <div className="space-y-4">
                                                <ToggleItem
                                                    label="Organic Product"
                                                    checked={formData.isOrganic}
                                                    onChange={(v: boolean) => setFormData({ ...formData, isOrganic: v })}
                                                    color="emerald"
                                                />
                                                <ToggleItem
                                                    label="Seasonal Product"
                                                    checked={formData.isSeasonal}
                                                    onChange={(v: boolean) => setFormData({ ...formData, isSeasonal: v })}
                                                    color="blue"
                                                />
                                                <ToggleItem
                                                    label="Flash Sale"
                                                    checked={formData.flashSale}
                                                    onChange={(v: boolean) => setFormData({ ...formData, flashSale: v })}
                                                    color="orange"
                                                />
                                                <ToggleItem
                                                    label="Available for Cash on Delivery"
                                                    checked={formData.allowCashOnDelivery !== false}
                                                    onChange={(v: boolean) => setFormData({ ...formData, allowCashOnDelivery: v })}
                                                    color="emerald"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Activity className="w-4 h-4" />
                                                Quality Matrix
                                            </h3>
                                            <FormSelect
                                                label="Orchard Grade"
                                                value={formData.grade}
                                                onChange={(v: string) => setFormData({ ...formData, grade: v as any })}
                                                options={[
                                                    { label: 'Grade A (Pristine)', value: 'A' },
                                                    { label: 'Grade B (Standard)', value: 'B' },
                                                    { label: 'Premium / Reserve', value: 'Premium' }
                                                ]}
                                            />
                                            <FormInput
                                                label="Expiry Date"
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

                                    {/* Section 4: Seasonal Dates */}
                                    {formData.isSeasonal && (
                                        <div className="space-y-6">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-blue-500" />
                                                Seasonal Dates
                                            </h3>
                                            <div className="grid grid-cols-2 gap-6 p-8 bg-blue-50/30 border border-blue-100 rounded-[2.5rem]">
                                                <FormInput
                                                    label="Season Start"
                                                    type="date"
                                                    value={formData.seasonalStart}
                                                    onChange={(v: string) => setFormData({ ...formData, seasonalStart: v })}
                                                />
                                                <FormInput
                                                    label="Season End"
                                                    type="date"
                                                    value={formData.seasonalEnd}
                                                    onChange={(v: string) => setFormData({ ...formData, seasonalEnd: v })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 5: Sell in bulk — admin/seller configure bulk pricing */}
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            Sell in bulk
                                        </h3>
                                        <p className="text-[10px] text-slate-500 -mt-2">Min quantity and price per unit for bulk purchase. Leave empty to disable.</p>
                                        <div className="grid grid-cols-2 gap-6 p-8 bg-emerald-50/20 border border-emerald-100 rounded-[2.5rem]">
                                            <FormInput
                                                label="Threshold Quantity (Units)"
                                                type="number"
                                                value={formData.bulkDiscountQty}
                                                onChange={(v: string) => setFormData({ ...formData, bulkDiscountQty: v })}
                                                placeholder="e.g. 5"
                                            />
                                            <FormInput
                                                label="Bulk Price (₹ / Unit)"
                                                type="number"
                                                value={formData.bulkDiscountPrice}
                                                onChange={(v: string) => setFormData({ ...formData, bulkDiscountPrice: v })}
                                                placeholder="e.g. 400"
                                            />
                                        </div>
                                    </div>

                                    {/* Section 6: Variants */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Binary className="w-4 h-4 text-emerald-500" />
                                                Product Variants
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    variants: [...formData.variants, { name: '', price: '', stock: '', sku: '', lowStockThreshold: '5' }]
                                                })}
                                                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add variant
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {formData.variants.map((variant, i) => (
                                                <div key={i} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl relative group/var">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const n = [...formData.variants];
                                                            n.splice(i, 1);
                                                            setFormData({ ...formData, variants: n });
                                                        }}
                                                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/var:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
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
                                                            label="Value Offset (₹)"
                                                            type="number"
                                                            value={variant.price}
                                                            onChange={(v: string) => {
                                                                const n = [...formData.variants];
                                                                n[i].price = v;
                                                                setFormData({ ...formData, variants: n });
                                                            }}
                                                            placeholder="0.00"
                                                        />
                                                        <FormInput
                                                            label="Stock"
                                                            type="number"
                                                            value={variant.stock}
                                                            onChange={(v: string) => {
                                                                const n = [...formData.variants];
                                                                n[i].stock = v;
                                                                setFormData({ ...formData, variants: n });
                                                            }}
                                                            placeholder="0"
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
                                                            label="Low Stock Alert"
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
                                                </div>
                                            ))}
                                            {formData.variants.length === 0 && (
                                                <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50">
                                                    <Binary className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No variants added yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Section 6: Visual Assets */}
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

                                {/* Decision Footer */}
                                <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4 shadow-2xl relative z-10">
                                    <button
                                        type="button"
                                    disabled={isSavingProduct}
                                        onClick={() => setIsModalOpen(false)}
                                    className="flex-1 h-16 bg-white border border-slate-200 text-slate-900 rounded-[2rem] hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                    disabled={isSavingProduct}
                                    className="flex-1 h-16 bg-slate-900 text-white rounded-[2rem] hover:bg-black text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                    {isSavingProduct ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
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
        <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label} {required && '*'}</label>
            <input
                type={type}
                required={required}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-sm"
                placeholder={placeholder}
            />
        </div>
    );
}

function FormSelect({ label, value, onChange, options }: any) {
    return (
        <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-700 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-sm appearance-none cursor-pointer uppercase tracking-tight"
            >
                {options.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

function ToggleItem({ label, checked, onChange, color }: any) {
    const colors: any = {
        emerald: 'bg-emerald-500 ring-emerald-500/20',
        blue: 'bg-blue-500 ring-blue-500/20',
        orange: 'bg-orange-500 ring-orange-500/20'
    };

    return (
        <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer group hover:bg-white hover:border-emerald-100 transition-all">
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{label}</span>
            <div className="relative">
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={e => onChange(e.target.checked)}
                />
                <div className={cn(
                    "w-12 h-7 rounded-full transition-all duration-300",
                    checked ? colors[color] : 'bg-slate-200'
                )} />
                <div className={cn(
                    "absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300",
                    checked ? 'translate-x-5' : 'translate-x-0'
                )} />
            </div>
        </label>
    );
}
