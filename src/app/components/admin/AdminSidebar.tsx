import { Link, useLocation } from 'react-router-dom';
import {
    Package,
    ShoppingCart,
    Users,
    BarChart2,
    Settings,
    Store,
    Tag,
    Globe,
    Palette,
    Percent,
    ExternalLink,
    Truck,
    Wallet,
    LayoutDashboard,
    Zap,
    LogOut,
    Sparkles,
    Bell,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useAdminData } from '@/app/context/AdminDataContext';

const sidebarItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin', roles: ['admin'] },
    { icon: Bell, label: 'Alerts', href: '/admin/alerts', roles: ['admin'] },
    { icon: Zap, label: 'Orchard HUD', href: '/admin/seller-dashboard', roles: ['seller'] },
    { icon: ShoppingCart, label: 'Orders', href: '/admin/orders', badgeKey: 'orders' as const, roles: ['admin', 'seller'] },
    { icon: Package, label: 'Catalog', href: '/admin/products', roles: ['admin', 'seller'] },
    { icon: Users, label: 'Customers', href: '/admin/customers', roles: ['admin'] },
    { icon: Store, label: 'Vendors', href: '/admin/sellers', badgeKey: 'sellers' as const, roles: ['admin'] },
    { icon: Truck, label: 'Logistics', href: '/admin/logistics', roles: ['admin'] },
    { icon: Wallet, label: 'Payouts', href: '/admin/payouts', roles: ['admin'] },
    { icon: BarChart2, label: 'Analytics', href: '/admin/analytics', roles: ['admin'] },
    { icon: Percent, label: 'Taxation', href: '/admin/taxes', roles: ['admin'] },
    { icon: Sparkles, label: 'Subscription', href: '/admin/subscription', roles: ['admin'] },
    { icon: Tag, label: 'Discounts', href: '/admin/discounts', roles: ['admin', 'seller'] },
];

const salesChannels = [
    { icon: Globe, label: 'Curation Space', href: '/admin/store', roles: ['admin'] },
    { icon: Palette, label: 'Design System', href: '/admin/themes', roles: ['admin'] },
    { icon: Settings, label: 'Settings', href: '/admin/settings', roles: ['admin'] },
];

export function AdminSidebar() {
    const location = useLocation();
    const { theme } = useStore();
    const { user, logout } = useAuth();
    const { orders, sellers } = useAdminData();

    const badges = useMemo(() => {
        const activeOrders = orders.filter(
            (o: any) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED',
        );
        return { orders: activeOrders.length, sellers: sellers.length };
    }, [orders, sellers]);

    const userRole = user?.role || 'customer';
    const settingsHref =
        userRole === 'admin' ? '/admin/settings' : '/profile';

    const filteredSidebarItems = sidebarItems.filter(item =>
        item.roles.includes(userRole)
    );

    const filteredSalesChannels = salesChannels.filter(item =>
        item.roles.includes(userRole)
    );

    const prefetchRouteModule = (href: string) => {
        switch (href) {
            case '/admin':
                void import('@/app/pages/admin/AdminDashboard');
                break;
            case '/admin/alerts':
                void import('@/app/pages/admin/AdminAlertsPage');
                break;
            case '/admin/seller-dashboard':
                void import('@/app/pages/seller/SellerDashboard');
                break;
            case '/admin/orders':
                void import('@/app/pages/admin/AdminOrdersPage');
                break;
            case '/admin/products':
                void import('@/app/pages/admin/AdminProductsPage');
                break;
            case '/admin/customers':
                void import('@/app/pages/admin/AdminCustomersPage');
                break;
            case '/admin/sellers':
                void import('@/app/pages/admin/AdminSellersPage');
                break;
            case '/admin/logistics':
                void import('@/app/pages/admin/AdminLogisticsPage');
                break;
            case '/admin/payouts':
                void import('@/app/pages/admin/AdminPayoutsPage');
                break;
            case '/admin/analytics':
                void import('@/app/pages/admin/AdminAnalyticsPage');
                break;
            case '/admin/taxes':
                void import('@/app/pages/admin/AdminTaxPage');
                break;
            case '/admin/subscription':
                void import('@/app/pages/admin/AdminSubscriptionPage');
                break;
            case '/admin/discounts':
                void import('@/app/pages/admin/AdminDiscountsPage');
                break;
            case '/admin/store':
                void import('@/app/pages/admin/store/AdminStorePage');
                break;
            case '/admin/themes':
                void import('@/app/pages/admin/store/AdminThemeEditor');
                break;
            case '/admin/settings':
                void import('@/app/pages/admin/AdminSettingsPage');
                break;
            default:
                break;
        }
    };

    return (
        <div className="flex h-screen w-64 flex-col bg-[#09090b] text-zinc-400 border-r border-zinc-800/50 select-none font-sans">
            {/* Brand Header */}
            <div className="flex h-16 items-center justify-between px-5 border-b border-zinc-800/40 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 flex items-center justify-center text-white font-bold text-sm shadow-md border border-zinc-700/30">
                        <Store className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-zinc-100 truncate leading-tight tracking-tight">
                            {theme.storeName || 'Fruit Tribe'}
                        </span>
                        <span className="text-[10px] text-zinc-500 leading-tight mt-0.5 font-bold tracking-widest uppercase">Admin</span>
                    </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
            </div>

            {/* Navigation Lists */}
            <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-6">
                <div>
                    <p className="px-3 mb-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        Workspace
                    </p>
                    <nav className="space-y-1">
                        {filteredSidebarItems.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    onMouseEnter={() => prefetchRouteModule(item.href)}
                                    onFocus={() => prefetchRouteModule(item.href)}
                                    className={cn(
                                        "group flex items-center justify-between rounded-xl px-3 py-2 border transition-all duration-200 ease-out",
                                        isActive
                                            ? "bg-zinc-800/60 border-zinc-700/50 text-zinc-50 font-semibold"
                                            : "border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon className={cn(
                                            "h-4 w-4 flex-shrink-0 transition-colors duration-200",
                                            isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"
                                        )} />
                                        <span className="text-sm tracking-wide">{item.label}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {item.badgeKey != null && badges[item.badgeKey] > 0 ? (
                                            <span className={cn(
                                                "flex h-5 min-w-[20px] items-center justify-center rounded-lg px-1.5 text-[10px] font-bold transition-colors duration-200",
                                                isActive
                                                    ? "bg-zinc-700 text-zinc-100"
                                                    : "bg-zinc-900 text-zinc-500 group-hover:bg-zinc-800/50 group-hover:text-zinc-300"
                                            )}>
                                                {badges[item.badgeKey]}
                                            </span>
                                        ) : null}
                                        {isActive && (
                                            <motion.div
                                                layoutId="sidebar-active-dot"
                                                className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                            />
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Infrastructure section */}
                {filteredSalesChannels.length > 0 && (
                    <div>
                        <p className="px-3 mb-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                            Infrastructure
                        </p>
                        <nav className="space-y-1">
                            {filteredSalesChannels.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        onMouseEnter={() => prefetchRouteModule(item.href)}
                                        onFocus={() => prefetchRouteModule(item.href)}
                                        className={cn(
                                            "group flex items-center gap-3 rounded-xl px-3 py-2 border transition-all duration-200 ease-out",
                                            isActive
                                                ? "bg-zinc-800/60 border-zinc-700/50 text-zinc-50 font-semibold"
                                                : "border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "h-4 w-4 flex-shrink-0 transition-colors duration-200",
                                            isActive ? "text-amber-400" : "text-zinc-500 group-hover:text-zinc-300"
                                        )} />
                                        <span className="text-sm tracking-wide">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                )}
            </div>

            {/* User Bottom Profile */}
            <div className="shrink-0 p-4 border-t border-zinc-850/60 bg-zinc-950/40">
                {/* User card card-premium look inside sidebar */}
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/50 mb-3 shadow-inner">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-zinc-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-[11px] font-bold text-white uppercase">
                            {user?.name?.charAt(0) || 'U'}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200 truncate leading-tight">{user?.name}</p>
                        <p className="text-[10px] text-zinc-500 capitalize leading-tight mt-0.5 font-medium">
                            {user?.role?.replace('_', ' ') || 'Admin'}
                        </p>
                    </div>
                    <Link
                        to={settingsHref}
                        className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-700/50"
                        aria-label="Settings"
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {/* View store and signout row */}
                <div className="grid grid-cols-2 gap-2">
                    <Link
                        to="/"
                        className="flex items-center justify-center gap-1.5 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-750 transition-all duration-200 text-[11px] font-semibold"
                    >
                        <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                        Store
                    </Link>
                    <button
                        onClick={logout}
                        className="flex items-center justify-center gap-1.5 h-8 rounded-lg bg-red-950/20 text-red-400 hover:bg-red-900/30 hover:text-red-300 border border-red-900/10 transition-all duration-200 text-[11px] font-semibold"
                    >
                        <LogOut className="w-3 h-3" />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
