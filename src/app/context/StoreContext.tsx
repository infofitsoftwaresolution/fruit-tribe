import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getStoreSettings } from '@/lib/api';
import { getEffectiveUnitPrice, getEffectiveUnitPriceFromCartItem, getRetailUnitReference } from '@/lib/pricing';
import type { Product as CatalogProduct } from '@/lib/api';
import type { SubscriptionPageConfig } from '@/app/config/subscriptionPageConfig';

export type { SubscriptionPageConfig } from '@/app/config/subscriptionPageConfig';

// --- Types ---

export interface Product {
    id: string | number;
    name: string;
    price: number;
    discountPrice?: number;
    category: string;
    stock: number; // For backward compatibility, mapped to available_quantity if possible
    availableStock: number;
    reservedStock: number;
    lowStockThreshold?: number;
    image: string;
    images?: string[];
    vendor: string;
    status: 'Active' | 'Archived' | 'Draft';
    sku: string;
    description?: string;
    unit?: string; // kg, piece, dozen
    nutritionalInfo?: string;
    origin?: string;
    tags?: string[];
    badge?: string;
    harvestDate?: string;
    expiryDate?: string;
    isSeasonal?: boolean;
    seasonalStart?: string;
    seasonalEnd?: string;
    seasonalMonths?: string[];
    bulkDiscountQty?: number;
    bulkDiscountPrice?: number;
    bulkDiscountTiers?: Array<{ qty: number; totalPrice: number; unitPrice?: number; sku?: string; label?: string }>;
    allowCashOnDelivery?: boolean;
    isOrganic?: boolean;
    grade?: 'A' | 'B' | 'Premium';
    variants?: {
        name: string;
        price: number;
        stock: number;
        availableStock: number;
        reservedStock: number;
        sku: string;
        isBulkVariant?: boolean;
    }[];
}

export interface Order {
    /** Internal UUID from the database */
    id: string;
    /** Human-facing order number (e.g. FT-1234); may be undefined for legacy/local orders */
    orderNumber?: string;
    customer: string;
    items: number;
    date: string;
    total: number;
    payment: 'Paid' | 'Pending' | 'Refunded';
    fulfillment: 'Fulfilled' | 'Unfulfilled' | 'Restocked';
    status: 'Created' | 'Confirmed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled';
    channel: 'Online Store' | 'POS';
    itemsDetails?: { productId: number; quantity: number }[];
    distanceKm?: number | null;
}

export interface Customer {
    id: number;
    name: string;
    email: string;
    orders: number;
    spent: number;
    joined: string;
    status: 'Active' | 'VIP' | 'Inactive';
}

export interface ThemeSettings {
    // General
    authBackgroundImage?: string;
    logoUrl?: string;
    faviconUrl?: string;
    storeName: string;
    announcementBar: string;
    primaryColor: string;
    accentColor: string;
    heroTextColor?: string;
    sectionTitleColor?: string;
    sectionSubtitleColor?: string;
    fontFamily?: 'Inter' | 'Roboto' | 'Outfit' | 'Playfair Display';
    baseFontSize?: 'Small' | 'Medium' | 'Large';
    buttonStyle?: 'Rounded' | 'Square' | 'Pill';
    layoutSpacing?: 'Compact' | 'Normal' | 'Loose';
    isDarkMode?: boolean;

    // Seasonal
    seasonal?: {
        active: boolean;
        type: 'Winter' | 'Autumn' | 'Spring' | 'Summer';
        showEffects: boolean;
        customBanner?: string;
    };

    // Hero Section
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string;

    // About Page
    aboutHeroTitle?: string;
    aboutHeroSubtitle?: string;
    aboutStoryTitle?: string;
    aboutStoryText?: string;
    aboutPageImage?: string;

    // About Section (Home Page Features)
    aboutSectionTitle?: string;
    aboutSectionSubtitle?: string;
    aboutFeature1Title?: string;
    aboutFeature1Desc?: string;
    aboutFeature2Title?: string;
    aboutFeature2Desc?: string;
    aboutFeature3Title?: string;
    aboutFeature3Desc?: string;
    aboutFeature4Title?: string;
    aboutFeature4Desc?: string;
    aboutFeature5Title?: string;
    aboutFeature5Desc?: string;
    aboutFeature6Title?: string;
    aboutFeature6Desc?: string;

    // Parallax Banner
    parallaxTitle?: string;
    parallaxTitlePart2?: string;
    parallaxSubtitle?: string;
    parallaxBannerImage?: string;

    // Sections
    showFeaturedProducts?: boolean;
    featuredProductsTitle?: string;
    featuredProductsSubtitle?: string;

    showHowItWorks?: boolean;
    howItWorksTitle?: string;
    howItWorksSubtitle?: string;

    showSeasonalHighlights?: boolean;
    seasonalHighlightsTitle?: string;
    seasonalHighlightsSubtitle?: string;
    seasonalSpecialTitle?: string;
    seasonalSpecialDesc?: string;

    showSpecialOffers?: boolean;
    specialOffersTitle?: string;
    specialOffersSubtitle?: string;

    showTestimonials?: boolean;
    testimonialsTitle?: string;
    testimonialsSubtitle?: string;

    showRecipes?: boolean;
    recipesSectionTitle?: string;
    recipesSectionSubtitle?: string;

    whyChooseUsTitle?: string;
    whyChooseUsSubtitle?: string;

    showStats?: boolean;
    statsSectionTitle?: string;
    statsSectionSubtitle?: string;

    showNewsletter?: boolean;
    newsletterTitle?: string;
    newsletterSubtitle?: string;
    newsletterBackgroundImage?: string;

    // Contact & Footer
    contactPhone?: string;
    contactEmail?: string;
    contactAddress?: string;
    footerAboutText?: string;
    socialFacebook?: string;
    socialTwitter?: string;
    socialInstagram?: string;
    socialLinkedIn?: string;
    // Special Offers cards (home page)
    specialOffer1Title?: string;
    specialOffer1Subtitle?: string;
    specialOffer1Description?: string;
    specialOffer2Title?: string;
    specialOffer2Subtitle?: string;
    specialOffer2Description?: string;
    specialOffer3Title?: string;
    specialOffer3Subtitle?: string;
    specialOffer3Description?: string;
}

export interface CartItem {
    id: string | number;
    productId?: string | number;
    name: string;
    /** Effective unit price for the current quantity tier (retail or bulk). */
    price: number;
    quantity: number;
    image: string;
    vendor: string;
    stock?: number; // for validation when updating quantity
    /** Retail unit price (for bulk tier recalculation when quantity changes). */
    retailUnitPrice?: number;
    bulkDiscountQty?: number;
    bulkDiscountPrice?: number;
    bulkDiscountTiers?: Array<{ qty: number; totalPrice: number; unitPrice?: number; sku?: string; label?: string }>;
    selectedVariantId?: string;
    selectedVariantSku?: string;
    selectedVariantName?: string;
    selectedVariantPackQty?: number;
    selectedVariantPackUnit?: string;
}

export interface Page {
    id: string;
    title: string;
    handle: string;
    content: string;
    updatedAt: string;
    status: 'Active' | 'Hidden';
}

export interface StorePreferences {
    homepageTitle: string;
    homepageMetaDescription: string;
    googleAnalyticsId?: string;
    facebookPixelId?: string;
    socialShareImage?: string;
    /** Razorpay Key ID (public, used on checkout for payment UI) */
    razorpayKeyId?: string;
    /** Razorpay Key Secret (private, backend only) */
    razorpayKeySecret?: string;
    /** Delivery charge in INR (admin-configurable) */
    deliveryCharge?: number;
    /** Distance-based delivery fee slabs (admin-configurable) */
    deliveryFeeRules?: Array<{ upToKm: number; fee: number }>;
    /** Delivery fee mode: slab-based or per-km rate based. */
    deliveryFeeMode?: 'SLAB' | 'PER_KM';
    /** Per-km shipping rate used when deliveryFeeMode = PER_KM. */
    deliveryPerKmRate?: number;
    /** Free delivery for orders >= this amount. */
    freeDeliveryThreshold?: number;
    /** Standard platform/handling fee per order. */
    platformFee?: number;
    /** Available delivery time slots for checkout selection (admin configurable). */
    deliverySlots?: string[];
    /** Public subscription page copy, plans, fruits, and benefits (admin Subscription section) */
    subscriptionPage?: SubscriptionPageConfig;
}

export interface TribeSubscription {
    id: string;
    planName: string;
    price: number;
    frequency: 'Weekly' | 'Bi-weekly' | 'Monthly';
    items: string[];
    nextDelivery: string;
    status: 'Active' | 'Paused' | 'Cancelled';
    customizations?: string[];
    /** Backend order created at signup (after successful payment). */
    orderId?: string;
    orderNumber?: string;
}

interface StoreContextType {
    products: Product[];
    orders: Order[];
    customers: Customer[];
    theme: ThemeSettings;
    preferences: StorePreferences;
    pages: Page[];
    cartItems: CartItem[];
    isCartOpen: boolean;
    setIsCartOpen: (open: boolean) => void;
    addProduct: (product: Omit<Product, 'id'>) => void;
    updateProduct: (id: string | number, product: Partial<Product>) => void;
    deleteProduct: (id: string | number) => void;
    updateOrder: (id: string, order: Partial<Order>) => void;
    addOrder: (order: Order) => void;
    updateTheme: (settings: Partial<ThemeSettings>) => void;
    updatePreferences: (prefs: Partial<StorePreferences>) => void;
    updatePage: (id: string, updates: Partial<Page>) => void;
    addPage: (page: Omit<Page, 'id' | 'updatedAt'>) => void;
    deletePage: (id: string) => void;
    taxRates: Record<string, number>;
    updateTaxRate: (category: string, rate: number) => void;
    handleAddToCart: (product: Product, quantity?: number) => void;
    handleUpdateQuantity: (id: string | number, change: number) => void;
    handleRemoveItem: (id: string | number) => void;
    /** Align cart line retail/bulk fields with the live catalog (call when API products load). */
    syncCartPricingFromCatalog: (catalog: CatalogProduct[]) => void;
    clearCart: () => void;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    subscription: TribeSubscription | null;
    setSubscription: (sub: TribeSubscription | null) => void;
}

function parseCartLineTarget(target: string | number): { id: string; variantKey?: string } {
    const raw = String(target);
    if (!raw.includes('::')) return { id: raw };
    const [id, variantKey] = raw.split('::');
    return { id, variantKey: variantKey || undefined };
}

// --- Initial Data: products come from API (database), not hardcoded ---
const INITIAL_PRODUCTS: Product[] = [];

const INITIAL_ORDERS: Order[] = [];

const INITIAL_CUSTOMERS: Customer[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', orders: 12, spent: 45000, joined: 'Jan 12, 2023', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', orders: 5, spent: 12500, joined: 'Mar 05, 2023', status: 'Active' },
];

const INITIAL_THEME: ThemeSettings = {
    storeName: 'The Fruit Tribe',
    logoUrl: '/logo.png',
    heroTitle: 'Fresh From Our Fields',
    heroSubtitle: 'Hand-picked premium fruits delivered straight to your doorstep within 24 hours.',
    heroImage: '/images/hero.png',
    primaryColor: '#10b981', // emerald-500
    accentColor: '#f97316', // orange-500
    announcementBar: 'Free shipping on all orders over ₹500!',
    fontFamily: 'Outfit',
    baseFontSize: 'Medium',
    buttonStyle: 'Pill',
    layoutSpacing: 'Normal',
    isDarkMode: false,
    seasonal: {
        active: false,
        type: 'Summer',
        showEffects: true
    },
    showFeaturedProducts: true,
    showHowItWorks: true,
    showSeasonalHighlights: true,
    seasonalHighlightsTitle: 'Seasonal Favorites',
    seasonalHighlightsSubtitle: 'Discover the freshest fruits of the season, handpicked for peak flavor',
    showSpecialOffers: true,
    showTestimonials: true,
    showRecipes: true,
    showStats: true,
    showNewsletter: true,
    contactPhone: '9934722416',
    contactEmail: 'thefruittribes@gmail.com',
    contactAddress: '706, Mahaveer Palatium, Sarjapur, Bangalore - 560105',
    footerAboutText: 'Dedicated to bringing the finest, orchard-fresh fruits directly to your table with love and care.',
    socialFacebook: 'https://www.facebook.com/profile.php?id=61572059034902',
    socialInstagram: 'https://www.instagram.com/thefruittribe?igsh=bWpmNGltZzN1anB6',
    socialTwitter: ''
};

const INITIAL_TAX_RATES: Record<string, number> = {
    'Fruits': 5.0,
    'Vegetables': 2.0,
    'Dairy': 8.0,
    'Tropical': 5.0,
    'Berries': 5.0,
    'Citrus': 5.0,
};

const INITIAL_PREFERENCES: StorePreferences = {
    homepageTitle: 'The Fruit Tribe | Fresh Tropical Fruits Delivered',
    homepageMetaDescription: 'Order fresh, organic, and hand-picked tropical fruits directly from the farm. Same-day delivery available.',
    deliveryCharge: 0,
    deliveryFeeRules: [
        { upToKm: 3, fee: 20 },
        { upToKm: 8, fee: 40 },
        { upToKm: 15, fee: 60 },
        { upToKm: 9999, fee: 90 },
    ],
    deliveryFeeMode: 'SLAB',
    deliveryPerKmRate: 10,
    platformFee: 0,
};

const INITIAL_PAGES: Page[] = [
    { id: '1', title: 'About Us', handle: 'about', content: 'We are a group of farmers...', updatedAt: '2023-11-20', status: 'Active' },
    { id: '2', title: 'Contact Us', handle: 'contact', content: 'Get in touch with us...', updatedAt: '2023-11-21', status: 'Active' },
    {
        id: '3',
        title: 'Terms of Service',
        handle: 'terms',
        content:
            'Using our service\n' +
            'By using The Fruit Tribe, you agree to provide accurate account and delivery details.\n\n' +
            'Orders and payments\n' +
            'Pricing and availability may change based on stock and service area.\n\n' +
            'Cancellations and refunds\n' +
            'Refunds depend on order status, product condition, and support review.',
        updatedAt: '2023-10-05',
        status: 'Active',
    },
    {
        id: '4',
        title: 'Privacy Policy',
        handle: 'privacy',
        content:
            'Information we collect\n' +
            'We collect account, order, and delivery details to fulfill your orders.\n\n' +
            'How we use information\n' +
            'We use your data for account verification, order processing, and support.\n\n' +
            'Data security\n' +
            'We apply reasonable security controls to protect your information.',
        updatedAt: '2023-10-05',
        status: 'Active',
    },
    {
        id: '5',
        title: 'Cookie Policy',
        handle: 'cookies',
        content:
            'What are cookies?\n' +
            'Cookies are small files stored on your device to improve site experience.\n\n' +
            'How we use cookies\n' +
            'We use cookies for login sessions, cart continuity, and basic analytics.\n\n' +
            'Managing cookies\n' +
            'You can manage cookies in your browser settings at any time.',
        updatedAt: '2023-10-05',
        status: 'Active',
    },
];

// --- Context & Provider ---

export const StoreContext = createContext<StoreContextType | undefined>(undefined);

function safeParseJson<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function StoreProvider({ children }: { children: ReactNode }) {
    // Initialize state from LocalStorage or default
    const [products, setProducts] = useState<Product[]>(() => {
        const saved = localStorage.getItem('store_products');
        if (!saved) return INITIAL_PRODUCTS;
        try {
            const parsed: Product[] = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : INITIAL_PRODUCTS;
        } catch {
            return INITIAL_PRODUCTS;
        }
    });

    const [orders, setOrders] = useState<Order[]>(() => {
        const saved = localStorage.getItem('store_orders');
        return safeParseJson<Order[]>(saved, INITIAL_ORDERS);
    });

    const [customers, setCustomers] = useState<Customer[]>(() => {
        const saved = localStorage.getItem('store_customers');
        return safeParseJson<Customer[]>(saved, INITIAL_CUSTOMERS);
    });

    const [theme, setTheme] = useState<ThemeSettings>(() => {
        const saved = localStorage.getItem('store_theme');
        if (!saved) return INITIAL_THEME;
        const parsed = safeParseJson<Partial<ThemeSettings>>(saved, {});
        return {
            ...INITIAL_THEME,
            ...parsed,
            seasonal: { ...INITIAL_THEME.seasonal, ...(parsed.seasonal ?? {}) }
        };
    });

    const [taxRates, setTaxRates] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('store_tax_rates');
        return saved ? { ...INITIAL_TAX_RATES, ...safeParseJson<Record<string, number>>(saved, {}) } : INITIAL_TAX_RATES;
    });

    const [preferences, setPreferences] = useState<StorePreferences>(() => {
        const saved = localStorage.getItem('store_preferences');
        return saved ? { ...INITIAL_PREFERENCES, ...safeParseJson<Partial<StorePreferences>>(saved, {}) } : INITIAL_PREFERENCES;
    });

    const [pages, setPages] = useState<Page[]>(() => {
        const saved = localStorage.getItem('store_pages');
        return safeParseJson<Page[]>(saved, INITIAL_PAGES);
    });

    // Backfill required legal pages for older localStorage snapshots.
    useEffect(() => {
        setPages((prev) => {
            const existingHandles = new Set(prev.map((p) => p.handle));
            const required = INITIAL_PAGES.filter((p) =>
                ['privacy', 'terms', 'cookies'].includes(p.handle) && !existingHandles.has(p.handle)
            );
            if (!required.length) return prev;
            return [...prev, ...required];
        });
    }, []);


    const [cartItems, setCartItems] = useState<CartItem[]>(() => {
        const saved = localStorage.getItem('store_cart');
        return safeParseJson<CartItem[]>(saved, []);
    });

    const [subscription, setSubscription] = useState<TribeSubscription | null>(() => {
        const saved = localStorage.getItem('store_subscription');
        return safeParseJson<TribeSubscription | null>(saved, null);
    });

    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const lastStoreSettingsRefreshRef = useRef(0);

    const refreshStoreSettings = useCallback(async () => {
        const data = await getStoreSettings();
        if (data.theme && typeof data.theme === 'object') {
            setTheme((prev) => ({
                ...INITIAL_THEME,
                ...prev,
                ...data.theme as Partial<ThemeSettings>,
                seasonal: { ...INITIAL_THEME.seasonal, ...(prev.seasonal ?? {}), ...((data.theme as any)?.seasonal ?? {}) },
            }));
        }
        setPreferences((prev) => {
            const next = { ...INITIAL_PREFERENCES, ...prev };
            if (data.preferences && typeof data.preferences === 'object') {
                Object.assign(next, data.preferences as Partial<StorePreferences>);
            }
            const rawTaxRates = (data.preferences as any)?.taxRates;
            if (rawTaxRates && typeof rawTaxRates === 'object') {
                const normalizedTaxRates: Record<string, number> = {};
                for (const [category, rate] of Object.entries(rawTaxRates as Record<string, unknown>)) {
                    const parsedRate = Number(rate);
                    if (!Number.isFinite(parsedRate) || parsedRate < 0) continue;
                    normalizedTaxRates[String(category)] = parsedRate;
                }
                if (Object.keys(normalizedTaxRates).length > 0) {
                    setTaxRates((prevRates) => ({ ...prevRates, ...normalizedTaxRates }));
                }
            }
            if (typeof data.deliveryCharge === 'number' && data.deliveryCharge >= 0) {
                next.deliveryCharge = data.deliveryCharge;
            }
            if (Array.isArray((data as any).deliveryFeeRules)) {
                next.deliveryFeeRules = (data as any).deliveryFeeRules;
            }
            if (typeof (data as any).deliveryFeeMode === 'string') {
                next.deliveryFeeMode = String((data as any).deliveryFeeMode).toUpperCase() === 'PER_KM' ? 'PER_KM' : 'SLAB';
            }
            if (typeof (data as any).deliveryPerKmRate === 'number' && (data as any).deliveryPerKmRate >= 0) {
                next.deliveryPerKmRate = (data as any).deliveryPerKmRate;
            }
            if (typeof (data as any).freeDeliveryThreshold === 'number' && (data as any).freeDeliveryThreshold >= 0) {
                next.freeDeliveryThreshold = (data as any).freeDeliveryThreshold;
            }
            if (typeof (data as any).platformFee === 'number' && (data as any).platformFee >= 0) {
                next.platformFee = (data as any).platformFee;
            }
            return next;
        });
    }, []);

    // Hydrate once and refresh on tab focus/visibility so admin delivery updates propagate.
    useEffect(() => {
        const throttledRefresh = async () => {
            const now = Date.now();
            if (now - lastStoreSettingsRefreshRef.current < 15_000) return;
            lastStoreSettingsRefreshRef.current = now;
            try {
                await refreshStoreSettings();
            } catch {
                // Silent failure: existing local snapshot remains usable.
            }
        };

        void throttledRefresh();

        const onFocus = () => { void throttledRefresh(); };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                void throttledRefresh();
            }
        };

        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [refreshStoreSettings]);

    const handleAddToCart = useCallback((product: Product, quantity: number = 1) => {
        const desiredQty = Math.max(1, Math.floor(quantity));
        if (product.stock <= 0) {
            toast.error(`${product.name} is currently out of stock`);
            return;
        }

        const selectedVariantSku = String((product as any).__selectedVariantSku || '').trim();
        const selectedVariantId = String((product as any).__selectedVariantId || '').trim();
        const hasVariants = Array.isArray((product as any).variants) && (product as any).variants.length > 0;
        if (hasVariants && !selectedVariantId) {
            toast.error(`Please select a valid pack for ${product.name}`);
            return;
        }
        const selectedVariantName = String((product as any).__selectedVariantName || '').trim();
        const selectedVariantPackQtyRaw = Number((product as any).__selectedVariantPackQty);
        const selectedVariantPackQty = Number.isFinite(selectedVariantPackQtyRaw) && selectedVariantPackQtyRaw > 0
            ? selectedVariantPackQtyRaw
            : undefined;
        const selectedVariantPackUnit = String((product as any).__selectedVariantPackUnit || '').trim().toLowerCase() || undefined;

        setCartItems(prevItems => {
            const recalcProductUnitPrices = (items: CartItem[], productId: string | number): CartItem[] => {
                const pid = String(productId);
                const totalQtyForProduct = items
                    .filter((i) => String(i.id) === pid)
                    .reduce((sum, i) => sum + Math.max(0, Number(i.quantity) || 0), 0);
                return items.map((i) => {
                    if (String(i.id) !== pid) return i;
                    const nextPrice =
                        i.retailUnitPrice != null || i.bulkDiscountQty != null || (i.bulkDiscountTiers?.length || 0) > 0
                            ? getEffectiveUnitPriceFromCartItem(i, totalQtyForProduct)
                            : i.price;
                    return { ...i, price: nextPrice };
                });
            };
            const selectedVariantKey = selectedVariantId || selectedVariantSku;
            const existingItem = prevItems.find(
                item =>
                    String(item.id) === String(product.id) &&
                    (
                        selectedVariantKey
                            ? (
                                String(item.selectedVariantId || '') === selectedVariantKey ||
                                String(item.selectedVariantSku || '') === selectedVariantKey
                            )
                            : (!item.selectedVariantId && !item.selectedVariantSku)
                    )
            );
            const currentQty = existingItem?.quantity ?? 0;
            const maxStock = product.availableStock ?? product.stock;
            const newQty = Math.min(currentQty + desiredQty, maxStock);

            if (currentQty >= maxStock) {
                toast.error(`Only ${maxStock} units available in stock`);
                return prevItems;
            }

            const matchedVariant = selectedVariantId
                ? (product.variants || []).find((v: any) => String((v as any)?.id || '') === selectedVariantId)
                : selectedVariantSku
                    ? (product.variants || []).find((v: any) => String(v?.sku || '') === selectedVariantSku)
                    : null;
            const hasExplicitVariant = Boolean(selectedVariantId || selectedVariantSku);
            const explicitSelectedPrice = hasExplicitVariant ? Number((product as any).price) : NaN;
            const variantRetailRef = hasExplicitVariant
                ? (Number.isFinite(explicitSelectedPrice) && explicitSelectedPrice > 0
                    ? explicitSelectedPrice
                    : Number((matchedVariant as any)?.price ?? NaN))
                : null;
            // For explicitly selected variants, preserve that exact variant price.
            // Do not let generic retail reference fallback to default/min variant.
            const unitPrice = variantRetailRef != null
                ? variantRetailRef
                : getEffectiveUnitPrice(product, newQty);
            const retailRef = variantRetailRef != null
                ? variantRetailRef
                : getRetailUnitReference(product);
            const resolvedVariantName = selectedVariantName || String((matchedVariant as any)?.name || '').trim();
            if (existingItem) {
                const updatedItems = prevItems.map(item =>
                    String(item.id) === String(product.id) &&
                    (
                        selectedVariantKey
                            ? (
                                String(item.selectedVariantId || '') === selectedVariantKey ||
                                String(item.selectedVariantSku || '') === selectedVariantKey
                            )
                            : (!item.selectedVariantId && !item.selectedVariantSku)
                    )
                        ? {
                            ...item,
                            quantity: newQty,
                            price: unitPrice,
                            retailUnitPrice: retailRef,
                            bulkDiscountQty: product.bulkDiscountQty,
                            bulkDiscountPrice: product.bulkDiscountPrice,
                            bulkDiscountTiers: (product as any).bulkDiscountTiers,
                            selectedVariantId: selectedVariantId || (matchedVariant?.id ? String((matchedVariant as any).id) : undefined),
                            selectedVariantSku: selectedVariantSku || (matchedVariant?.sku ? String((matchedVariant as any).sku) : undefined),
                            selectedVariantName: resolvedVariantName || undefined,
                            selectedVariantPackQty,
                            selectedVariantPackUnit,
                        }
                        : item
                );
                const added = newQty - currentQty;
                toast.success(`Updated ${existingItem.name} quantity to ${newQty} (added ${added})`);
                return recalcProductUnitPrices(updatedItems, product.id);
            } else {
                toast.success(`${product.name} added to cart (${newQty} units)!`);
                return recalcProductUnitPrices([...prevItems, {
                    id: product.id,
                    productId: product.id,
                    name: product.name,
                    price: unitPrice,
                    quantity: newQty,
                    image: product.image,
                    vendor: product.vendor,
                    stock: product.stock,
                    retailUnitPrice: retailRef,
                    bulkDiscountQty: product.bulkDiscountQty,
                    bulkDiscountPrice: product.bulkDiscountPrice,
                    bulkDiscountTiers: (product as any).bulkDiscountTiers,
                    selectedVariantId: selectedVariantId || (matchedVariant?.id ? String((matchedVariant as any).id) : undefined),
                    selectedVariantSku: selectedVariantSku || (matchedVariant?.sku ? String((matchedVariant as any).sku) : undefined),
                    selectedVariantName: resolvedVariantName || undefined,
                    selectedVariantPackQty,
                    selectedVariantPackUnit,
                }], product.id);
            }
        });
    }, []);

    const handleUpdateQuantity = useCallback((productId: string | number, change: number) => {
        const target = parseCartLineTarget(productId);
        setCartItems(prevItems => {
            const nextItems = prevItems.map(item => {
            const sameId = String(item.id) === target.id;
            const sameVariant = target.variantKey == null
                ? true
                : (
                    String(item.selectedVariantId || '') === String(target.variantKey || '') ||
                    String(item.selectedVariantSku || '') === String(target.variantKey || '')
                );
            if (sameId && sameVariant) {
                const newQuantity = item.quantity + change;
                const maxStock = item.stock ?? 999;
                if (change > 0 && newQuantity > maxStock) {
                    toast.error(`Only ${maxStock} units available in stock`);
                    return item;
                }
                const q = Math.max(0, newQuantity);
                return { ...item, quantity: q };
            }
            return item;
        }).filter(item => item.quantity > 0);
            const totalQtyForProduct = nextItems
                .filter((i) => String(i.id) === target.id)
                .reduce((sum, i) => sum + Math.max(0, Number(i.quantity) || 0), 0);
            return nextItems.map((i) => {
                if (String(i.id) !== target.id) return i;
                const nextPrice =
                    i.retailUnitPrice != null || i.bulkDiscountQty != null || (i.bulkDiscountTiers?.length || 0) > 0
                        ? getEffectiveUnitPriceFromCartItem(i, totalQtyForProduct)
                        : i.price;
                return { ...i, price: nextPrice };
            });
        });
    }, []);

    const handleRemoveItem = useCallback((productId: string | number) => {
        const target = parseCartLineTarget(productId);
        setCartItems(prevItems => {
            const item = prevItems.find((i) => {
                const sameId = String(i.id) === target.id;
                const sameVariant = target.variantKey == null
                    ? true
                    : (
                        String(i.selectedVariantId || '') === String(target.variantKey || '') ||
                        String(i.selectedVariantSku || '') === String(target.variantKey || '')
                    );
                return sameId && sameVariant;
            });
            if (item) toast.error(`${item.name} removed from cart`);
            return prevItems.filter((i) => {
                const sameId = String(i.id) === target.id;
                const sameVariant = target.variantKey == null
                    ? true
                    : (
                        String(i.selectedVariantId || '') === String(target.variantKey || '') ||
                        String(i.selectedVariantSku || '') === String(target.variantKey || '')
                    );
                return !(sameId && sameVariant);
            });
        });
    }, []);

    const syncCartPricingFromCatalog = useCallback((catalog: CatalogProduct[]) => {
        if (!catalog?.length) return;
        const byId = new Map(catalog.map((p) => [String(p.id), p]));
        setCartItems((items) => {
            const mapped = items.map((item) => {
                const p = byId.get(String(item.id));
                if (!p) return item;
                const matchedVariant = item.selectedVariantId
                    ? (p.variants || []).find((v: any) => String((v as any).id || '') === String(item.selectedVariantId))
                    : item.selectedVariantSku
                        ? (p.variants || []).find((v: any) => String(v.sku) === String(item.selectedVariantSku))
                        : null;
                const maxStock = matchedVariant
                    ? Number((matchedVariant as any).availableStock ?? (matchedVariant as any).stock ?? item.stock ?? 999)
                    : (p.availableStock ?? p.stock ?? item.stock ?? 999);
                const q = Math.min(Math.max(0, Math.floor(item.quantity)), Math.max(0, maxStock));
                const unitPrice = (item.selectedVariantId || item.selectedVariantSku)
                    ? (matchedVariant
                        ? Number((matchedVariant as any).price ?? item.price)
                        : Number(item.price))
                    : getEffectiveUnitPrice(
                        {
                            price: p.price,
                            bulkDiscountQty: p.bulkDiscountQty,
                            bulkDiscountPrice: p.bulkDiscountPrice,
                            variants: p.variants,
                        },
                        q,
                    );
                return {
                    ...item,
                    quantity: q,
                    price: unitPrice,
                    retailUnitPrice: (item.selectedVariantId || item.selectedVariantSku)
                        ? (matchedVariant ? Number((matchedVariant as any).price ?? item.retailUnitPrice ?? item.price) : (item.retailUnitPrice ?? item.price))
                        : getRetailUnitReference(p),
                    bulkDiscountQty: p.bulkDiscountQty,
                    bulkDiscountPrice: p.bulkDiscountPrice,
                    bulkDiscountTiers: (p as any).bulkDiscountTiers,
                    stock: maxStock,
                    selectedVariantName: matchedVariant?.name || item.selectedVariantName,
                    selectedVariantId: (matchedVariant as any)?.id ? String((matchedVariant as any).id) : item.selectedVariantId,
                    selectedVariantSku: (matchedVariant as any)?.sku ? String((matchedVariant as any).sku) : item.selectedVariantSku,
                };
            });
            return mapped.map((item) => {
                const pid = String(item.id);
                const totalQtyForProduct = mapped
                    .filter((i) => String(i.id) === pid)
                    .reduce((sum, i) => sum + Math.max(0, Number(i.quantity) || 0), 0);
                if (!(item.retailUnitPrice != null || item.bulkDiscountQty != null || (item.bulkDiscountTiers?.length || 0) > 0)) {
                    return item;
                }
                return { ...item, price: getEffectiveUnitPriceFromCartItem(item, totalQtyForProduct) };
            });
        });
    }, []);

    const clearCart = useCallback(() => setCartItems([]), []);

    // Actions
    const addProduct = useCallback((product: Omit<Product, 'id'>) => {
        const newProduct = { ...product, id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` };
        setProducts(prev => [newProduct, ...prev]);
    }, []);

    const updateProduct = useCallback((id: string | number, updates: Partial<Product>) => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }, []);

    const deleteProduct = useCallback((id: string | number) => {
        setProducts(prev => prev.filter(p => p.id !== id));
    }, []);

    const updateOrder = useCallback((id: string, updates: Partial<Order>) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    }, []);

    const addOrder = useCallback((order: Order) => {
        setOrders(prev => [order, ...prev]);
        if (order.itemsDetails) {
            setProducts(prevProducts => prevProducts.map(p => {
                const orderedItem = order.itemsDetails?.find(item => item.productId === p.id);
                if (orderedItem) {
                    return { ...p, stock: Math.max(0, p.stock - orderedItem.quantity) };
                }
                return p;
            }));
        }
    }, []);

    const updateTheme = useCallback((updates: Partial<ThemeSettings>) => {
        setTheme(prev => ({ ...prev, ...updates }));
        toast.success('Theme settings updated!');
    }, []);

    const updateTaxRate = useCallback((category: string, rate: number) => {
        setTaxRates(prev => ({ ...prev, [category]: rate }));
    }, []);

    const updatePreferences = useCallback((updates: Partial<StorePreferences>) => {
        setPreferences(prev => ({ ...prev, ...updates }));
    }, []);

    const updatePage = useCallback((id: string, updates: Partial<Page>) => {
        setPages(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString().split('T')[0] } : p));
    }, []);

    const addPage = useCallback((page: Omit<Page, 'id' | 'updatedAt'>) => {
        const newPage: Page = {
            ...page,
            id: Math.random().toString(36).substr(2, 9),
            updatedAt: new Date().toISOString().split('T')[0]
        };
        setPages(prev => [newPage, ...prev]);
    }, []);

    const deletePage = useCallback((id: string) => {
        setPages(prev => prev.filter(p => p.id !== id));
    }, []);

    // Persist to LocalStorage on changes
    useEffect(() => {
        try {
            localStorage.setItem('store_products', JSON.stringify(products));
            localStorage.setItem('store_orders', JSON.stringify(orders));
            localStorage.setItem('store_customers', JSON.stringify(customers));
            localStorage.setItem('store_theme', JSON.stringify(theme));
            localStorage.setItem('store_preferences', JSON.stringify(preferences));
            localStorage.setItem('store_pages', JSON.stringify(pages));
            localStorage.setItem('store_tax_rates', JSON.stringify(taxRates));
            localStorage.setItem('store_cart', JSON.stringify(cartItems));
            localStorage.setItem('store_subscription', JSON.stringify(subscription));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }, [products, orders, customers, theme, preferences, pages, taxRates, cartItems, subscription]);

    const value = useMemo(() => ({
        products,
        orders,
        customers,
        theme,
        preferences,
        pages,
        cartItems,
        isCartOpen,
        setIsCartOpen,
        addProduct,
        updateProduct,
        deleteProduct,
        updateOrder,
        addOrder,
        updateTheme,
        updatePreferences,
        updatePage,
        addPage,
        deletePage,
        taxRates,
        updateTaxRate,
        handleAddToCart,
        handleUpdateQuantity,
        handleRemoveItem,
        syncCartPricingFromCatalog,
        clearCart,
        isEditing,
        setIsEditing,
        subscription,
        setSubscription
    }), [
        products,
        orders,
        customers,
        theme,
        preferences,
        pages,
        cartItems,
        isCartOpen,
        setIsCartOpen,
        addProduct,
        updateProduct,
        deleteProduct,
        updateOrder,
        addOrder,
        updateTheme,
        updatePreferences,
        updatePage,
        addPage,
        deletePage,
        taxRates,
        updateTaxRate,
        handleAddToCart,
        handleUpdateQuantity,
        handleRemoveItem,
        syncCartPricingFromCatalog,
        clearCart,
        isEditing,
        setIsEditing,
        subscription,
        setSubscription
    ]);

    return (
        <StoreContext.Provider value={value}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const context = useContext(StoreContext);
    if (context === undefined) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
}
