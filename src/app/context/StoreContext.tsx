import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { getStoreSettings } from '@/lib/api';

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
    name: string;
    price: number;
    quantity: number;
    image: string;
    vendor: string;
    stock?: number; // for validation when updating quantity
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
    clearCart: () => void;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    subscription: TribeSubscription | null;
    setSubscription: (sub: TribeSubscription | null) => void;
}

// --- Initial Data: products come from API (database), not hardcoded ---
const INITIAL_PRODUCTS: Product[] = [];

const INITIAL_ORDERS: Order[] = [
    {
        id: '1001',
        customer: 'John Doe',
        items: 3,
        date: new Date().toLocaleDateString(),
        total: 2500,
        payment: 'Paid',
        fulfillment: 'Unfulfilled',
        status: 'Created',
        channel: 'Online Store',
        itemsDetails: [
            { productId: 1, quantity: 2 },
            { productId: 2, quantity: 1 }
        ]
    },
    {
        id: '1002',
        customer: 'Jane Smith',
        items: 1,
        date: 'Yesterday',
        total: 499,
        payment: 'Paid',
        fulfillment: 'Fulfilled',
        status: 'Delivered',
        channel: 'Online Store',
        itemsDetails: [
            { productId: 1, quantity: 1 }
        ]
    },
    // Add a past order for John Doe for testing history
    {
        id: '1003',
        customer: 'John Doe',
        items: 2,
        date: '2023-10-15',
        total: 898,
        payment: 'Paid',
        fulfillment: 'Fulfilled',
        status: 'Delivered',
        channel: 'Online Store',
        itemsDetails: [
            { productId: 4, quantity: 2 }
        ]
    },
];

const INITIAL_CUSTOMERS: Customer[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', orders: 12, spent: 45000, joined: 'Jan 12, 2023', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', orders: 5, spent: 12500, joined: 'Mar 05, 2023', status: 'Active' },
];

const INITIAL_THEME: ThemeSettings = {
    storeName: 'The Fruit Tribe',
    logoUrl: '/logo.png',
    heroTitle: 'Fresh From Our Fields',
    heroSubtitle: 'Hand-picked premium fruits delivered straight to your doorstep within 24 hours.',
    heroImage: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=2070&auto=format&fit=crop',
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
    contactPhone: '+1 (555) 123-4567',
    contactEmail: 'hello@fruittribe.com',
    contactAddress: '123 Orchard Lane, Fresh Valley, FV 90210',
    footerAboutText: 'Dedicated to bringing the finest, orchard-fresh fruits directly to your table with love and care.',
    socialFacebook: 'https://facebook.com',
    socialInstagram: 'https://instagram.com',
    socialTwitter: 'https://twitter.com'
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
    googleAnalyticsId: 'UA-12345678-1',
    deliveryFeeRules: [
        { upToKm: 3, fee: 20 },
        { upToKm: 8, fee: 40 },
        { upToKm: 15, fee: 60 },
        { upToKm: 9999, fee: 90 },
    ],
};

const INITIAL_PAGES: Page[] = [
    { id: '1', title: 'About Us', handle: 'about', content: 'We are a group of farmers...', updatedAt: '2023-11-20', status: 'Active' },
    { id: '2', title: 'Contact Us', handle: 'contact', content: 'Get in touch with us...', updatedAt: '2023-11-21', status: 'Active' },
    { id: '3', title: 'Terms of Service', handle: 'terms', content: 'Our terms and conditions...', updatedAt: '2023-10-05', status: 'Active' },
    { id: '4', title: 'Privacy Policy', handle: 'privacy', content: 'How we handle your data...', updatedAt: '2023-10-05', status: 'Active' },
];

// --- Context & Provider ---

export const StoreContext = createContext<StoreContextType | undefined>(undefined);

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
        return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    });

    const [customers, setCustomers] = useState<Customer[]>(() => {
        const saved = localStorage.getItem('store_customers');
        return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    });

    const [theme, setTheme] = useState<ThemeSettings>(() => {
        const saved = localStorage.getItem('store_theme');
        if (!saved) return INITIAL_THEME;
        const parsed = JSON.parse(saved);
        return {
            ...INITIAL_THEME,
            ...parsed,
            seasonal: { ...INITIAL_THEME.seasonal, ...parsed.seasonal }
        };
    });

    const [taxRates, setTaxRates] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('store_tax_rates');
        return saved ? { ...INITIAL_TAX_RATES, ...JSON.parse(saved) } : INITIAL_TAX_RATES;
    });

    const [preferences, setPreferences] = useState<StorePreferences>(() => {
        const saved = localStorage.getItem('store_preferences');
        return saved ? { ...INITIAL_PREFERENCES, ...JSON.parse(saved) } : INITIAL_PREFERENCES;
    });

    const [pages, setPages] = useState<Page[]>(() => {
        const saved = localStorage.getItem('store_pages');
        return saved ? JSON.parse(saved) : INITIAL_PAGES;
    });


    const [cartItems, setCartItems] = useState<CartItem[]>(() => {
        const saved = localStorage.getItem('store_cart');
        return saved ? JSON.parse(saved) : [];
    });

    const [subscription, setSubscription] = useState<TribeSubscription | null>(() => {
        const saved = localStorage.getItem('store_subscription');
        return saved ? JSON.parse(saved) : null;
    });

    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Hydrate theme, preferences, delivery settings from backend so admin updates persist
    useEffect(() => {
        let cancelled = false;
        getStoreSettings()
            .then((data) => {
                if (cancelled) return;
                if (data.theme && typeof data.theme === 'object') {
                    setTheme((prev) => ({
                        ...INITIAL_THEME,
                        ...prev,
                        ...data.theme as Partial<ThemeSettings>,
                        seasonal: { ...INITIAL_THEME.seasonal, ...(prev.seasonal ?? {}), ...((data.theme as any)?.seasonal ?? {}) },
                    }));
                }
                if (data.preferences && typeof data.preferences === 'object') {
                    setPreferences((prev) => ({ ...INITIAL_PREFERENCES, ...prev, ...data.preferences as Partial<StorePreferences> }));
                }
                if (typeof data.deliveryCharge === 'number' && data.deliveryCharge >= 0) {
                    setPreferences((prev) => ({ ...prev, deliveryCharge: data.deliveryCharge }));
                }
                if (Array.isArray((data as any).deliveryFeeRules)) {
                    setPreferences((prev) => ({ ...prev, deliveryFeeRules: (data as any).deliveryFeeRules }));
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const handleAddToCart = useCallback((product: Product, quantity: number = 1) => {
        const desiredQty = Math.max(1, Math.floor(quantity));
        if (product.stock <= 0) {
            toast.error(`${product.name} is currently out of stock`);
            return;
        }

        setCartItems(prevItems => {
            const existingItem = prevItems.find(item => item.id === product.id);
            const currentQty = existingItem?.quantity ?? 0;
            const maxStock = product.availableStock ?? product.stock;
            const newQty = Math.min(currentQty + desiredQty, maxStock);

            if (currentQty >= maxStock) {
                toast.error(`Only ${maxStock} units available in stock`);
                return prevItems;
            }

            if (existingItem) {
                const updatedItems = prevItems.map(item =>
                    item.id === product.id ? { ...item, quantity: newQty } : item
                );
                const added = newQty - currentQty;
                toast.success(`Updated ${existingItem.name} quantity to ${newQty} (added ${added})`);
                return updatedItems;
            } else {
                toast.success(`${product.name} added to cart (${newQty} units)!`);
                return [...prevItems, {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: newQty,
                    image: product.image,
                    vendor: product.vendor,
                    stock: product.stock
                }];
            }
        });
        setIsCartOpen(true);
    }, []);

    const handleUpdateQuantity = useCallback((productId: string | number, change: number) => {
        setCartItems(prevItems => prevItems.map(item => {
            if (item.id === productId) {
                const newQuantity = item.quantity + change;
                const maxStock = item.stock ?? 999;
                if (change > 0 && newQuantity > maxStock) {
                    toast.error(`Only ${maxStock} units available in stock`);
                    return item;
                }
                return { ...item, quantity: Math.max(0, newQuantity) };
            }
            return item;
        }).filter(item => item.quantity > 0));
    }, []);

    const handleRemoveItem = useCallback((productId: string | number) => {
        setCartItems(prevItems => {
            const item = prevItems.find(i => i.id === productId);
            if (item) toast.error(`${item.name} removed from cart`);
            return prevItems.filter(i => i.id !== productId);
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
