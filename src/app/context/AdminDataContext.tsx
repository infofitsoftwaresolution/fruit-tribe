import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import {
    getCategories,
    getCustomers,
    getDeliveryPartners,
    getOrdersCached,
    getProducts,
    getSellers,
    invalidateProductsListCache,
    mapApiProductToProduct,
    type Category,
    type Product,
} from '@/lib/api';

type DeliveryPartnerRow = {
    id: string;
    name: string;
    phone: string;
    vehicle: string | null;
    status: string;
    user?: { email: string };
};

type AdminDataContextValue = {
    bootstrapped: boolean;
    isInitialLoading: boolean;
    orders: any[];
    customers: any[];
    sellers: any[];
    categories: Category[];
    products: Product[];
    deliveryPartners: DeliveryPartnerRow[];
    refreshOrders: () => Promise<void>;
    refreshCustomers: () => Promise<void>;
    refreshSellers: () => Promise<void>;
    refreshCategories: () => Promise<void>;
    refreshProducts: () => Promise<void>;
    refreshDeliveryPartners: () => Promise<void>;
    refreshAll: () => Promise<void>;
};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
    const [bootstrapped, setBootstrapped] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [sellers, setSellers] = useState<any[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartnerRow[]>([]);

    const loadAll = useCallback(async () => {
        const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
            try {
                return await p;
            } catch {
                return fallback;
            }
        };
        const [o, c, s, cat, pr, dp] = await Promise.all([
            safe(getOrdersCached(), []),
            safe(getCustomers(), []),
            safe(getSellers(), []),
            safe(getCategories(), []),
            safe(getProducts({ limit: 500, page: 1, showOutOfSeason: true, includeInactive: true }), { data: [] as any[], meta: null as any }),
            safe(getDeliveryPartners(), []),
        ]);
        setOrders(Array.isArray(o) ? o : []);
        setCustomers(Array.isArray(c) ? c : []);
        setSellers(Array.isArray(s) ? s : []);
        setCategories(Array.isArray(cat) ? cat : []);
        setProducts((pr?.data ?? []).map(mapApiProductToProduct));
        setDeliveryPartners(Array.isArray(dp) ? dp : []);
        setBootstrapped(true);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setIsInitialLoading(true);
        loadAll()
            .catch(() => {
                /* pages may show errors */
            })
            .finally(() => {
                if (!cancelled) setIsInitialLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [loadAll]);

    const refreshOrders = useCallback(async () => {
        try {
            const o = await getOrdersCached({ forceRefresh: true });
            setOrders(Array.isArray(o) ? o : []);
        } catch {
            /* keep cached snapshot on 403/network errors */
        }
    }, []);

    const refreshCustomers = useCallback(async () => {
        try {
            const c = await getCustomers();
            setCustomers(Array.isArray(c) ? c : []);
        } catch {
            /* keep cached snapshot */
        }
    }, []);

    const refreshSellers = useCallback(async () => {
        try {
            const s = await getSellers();
            setSellers(Array.isArray(s) ? s : []);
        } catch {
            /* keep cached snapshot */
        }
    }, []);

    const refreshCategories = useCallback(async () => {
        try {
            const cat = await getCategories();
            setCategories(Array.isArray(cat) ? cat : []);
        } catch {
            /* keep cached snapshot */
        }
    }, []);

    const refreshProducts = useCallback(async () => {
        try {
            invalidateProductsListCache();
            const pr = await getProducts({ limit: 500, page: 1, showOutOfSeason: true, includeInactive: true });
            setProducts((pr?.data ?? []).map(mapApiProductToProduct));
        } catch {
            /* keep cached snapshot */
        }
    }, []);

    const refreshDeliveryPartners = useCallback(async () => {
        try {
            const dp = await getDeliveryPartners();
            setDeliveryPartners(Array.isArray(dp) ? dp : []);
        } catch {
            /* keep cached snapshot */
        }
    }, []);

    const refreshAll = useCallback(async () => {
        await loadAll();
    }, [loadAll]);

    const value = useMemo<AdminDataContextValue>(
        () => ({
            bootstrapped,
            isInitialLoading,
            orders,
            customers,
            sellers,
            categories,
            products,
            deliveryPartners,
            refreshOrders,
            refreshCustomers,
            refreshSellers,
            refreshCategories,
            refreshProducts,
            refreshDeliveryPartners,
            refreshAll,
        }),
        [
            bootstrapped,
            isInitialLoading,
            orders,
            customers,
            sellers,
            categories,
            products,
            deliveryPartners,
            refreshOrders,
            refreshCustomers,
            refreshSellers,
            refreshCategories,
            refreshProducts,
            refreshDeliveryPartners,
            refreshAll,
        ],
    );

    return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

if (typeof window !== 'undefined') {
    (window as any).__ADMIN_CONTEXT_CREATED__ = ((window as any).__ADMIN_CONTEXT_CREATED__ || 0) + 1;
    console.log(`[AdminDataContext] Context instance #${(window as any).__ADMIN_CONTEXT_CREATED__} created`);
}

export function useAdminData(): AdminDataContextValue {
    const ctx = useContext(AdminDataContext);
    if (!ctx) {
        throw new Error('useAdminData must be used within AdminDataProvider');
    }
    return ctx;
}
