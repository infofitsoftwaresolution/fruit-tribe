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
    Shield,
    LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { getOrders, getSellers } from '@/lib/api';

const sidebarItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin', roles: ['super_admin', 'admin', 'ADMIN'] },
    { icon: Zap, label: 'Orchard HUD', href: '/admin/seller-dashboard', roles: ['seller', 'SELLER'] },
    { icon: ShoppingCart, label: 'Orders', href: '/admin/orders', badgeKey: 'orders' as const, roles: ['super_admin', 'admin', 'ADMIN', 'seller', 'SELLER'] },
    { icon: Package, label: 'Catalog', href: '/admin/products', roles: ['super_admin', 'admin', 'ADMIN', 'seller', 'SELLER'] },
    { icon: Users, label: 'Customers', href: '/admin/customers', roles: ['super_admin', 'admin', 'ADMIN'] },
    { icon: Store, label: 'Vendors', href: '/admin/sellers', badgeKey: 'sellers' as const, roles: ['super_admin', 'admin', 'ADMIN'] },
    { icon: Truck, label: 'Logistics', href: '/admin/logistics', roles: ['super_admin', 'admin', 'ADMIN'] },
    { icon: Wallet, label: 'Payouts', href: '/admin/payouts', roles: ['super_admin', 'admin', 'ADMIN'] },
    { icon: BarChart2, label: 'Analytics', href: '/admin/analytics', roles: ['super_admin', 'admin', 'ADMIN'] },
    { icon: Percent, label: 'Taxation', href: '/admin/taxes', roles: ['super_admin', 'admin', 'ADMIN'] },
    { icon: Tag, label: 'Discounts', href: '/admin/discounts', roles: ['super_admin', 'admin', 'ADMIN', 'seller', 'SELLER'] },
];

const salesChannels = [
    { icon: Globe, label: 'Curation Space', href: '/admin/store', roles: ['super_admin', 'admin'] },
    { icon: Palette, label: 'Design System', href: '/admin/themes', roles: ['super_admin', 'admin'] },
    { icon: Settings, label: 'Settings', href: '/admin/settings', roles: ['super_admin', 'admin'] },
];

export function AdminSidebar() {
    const location = useLocation();
    const { theme } = useStore();
    const { user, logout } = useAuth();
    const [orderCount, setOrderCount] = useState<number | null>(null);
    const [sellerCount, setSellerCount] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchCounts = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            getOrders()
                .then((data) => {
                    if (cancelled) return;
                    const list = Array.isArray(data) ? data : [];
                    // Count only active (non-delivered, non-cancelled) orders so badge reflects open workload.
                    const active = list.filter(
                        (o: any) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED',
                    );
                    setOrderCount(active.length);
                })
                .catch(() => {
                    if (!cancelled) setOrderCount(0);
                });

            getSellers()
                .then((data) => {
                    if (!cancelled) setSellerCount((data || []).length);
                })
                .catch(() => {
                    if (!cancelled) setSellerCount(0);
                });
        };

        fetchCounts();
        const interval = setInterval(fetchCounts, 120000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const userRole = user?.role || 'customer';
    const badges = { orders: orderCount ?? 0, sellers: sellerCount ?? 0 };

    const filteredSidebarItems = sidebarItems.filter(item =>
        item.roles.includes(userRole)
    );

    const filteredSalesChannels = salesChannels.filter(item =>
        item.roles.includes(userRole)
    );

    return (
        <div className="flex h-screen w-72 flex-col bg-slate-900 text-slate-400 border-r border-slate-800 shadow-2xl relative z-50">
            {/* Store Brand / Premium Logo Area */}
            <div className="flex h-24 items-center gap-4 px-6 border-b border-white/5">
                <img
                    src="/logo.png"
                    alt="The Fruit Tribe"
                    className="h-12 w-12 object-contain flex-shrink-0 rounded-xl"
                />
                <div className="flex flex-col min-w-0">
                    <span className="font-black text-white text-sm tracking-tight uppercase leading-tight">{theme.storeName || 'The Fruit Tribe'}</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Management Console</span>
                </div>
            </div>

            {/* Main Navigation with Premium Hover States */}
            <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar space-y-12">
                <div>
                    <h3 className="px-4 mb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Core Operations</h3>
                    <nav className="space-y-1">
                        {filteredSidebarItems.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "group relative flex items-center justify-between rounded-2xl px-4 py-3.5 transition-all duration-300",
                                        isActive
                                            ? "bg-emerald-500/10 text-white shadow-inner"
                                            : "hover:bg-white/5 text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-pill"
                                            className="absolute left-0 w-1.5 h-6 bg-emerald-500 rounded-r-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                        />
                                    )}
                                    <div className="flex items-center gap-4">
                                        <item.icon className={cn(
                                            "h-5 w-5 transition-all duration-300",
                                            isActive ? "text-emerald-500 scale-110" : "text-slate-500 group-hover:text-slate-300 group-hover:scale-110"
                                        )} />
                                        <span className={cn("text-sm font-black tracking-tight", isActive ? "text-white" : "text-slate-400")}>
                                            {item.label}
                                        </span>
                                    </div>
                                    {item.badgeKey != null ? (
                                        <span className={cn(
                                            "flex h-5 min-w-[20px] items-center justify-center rounded-lg px-1.5 text-[9px] font-black shadow-sm",
                                            isActive ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"
                                        )}>
                                            {badges[item.badgeKey]}
                                        </span>
                                    ) : null}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Sales Channels / Design Settings */}
                {filteredSalesChannels.length > 0 && (
                    <div>
                        <h3 className="px-4 mb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Digital Presence</h3>
                        <nav className="space-y-1">
                            {filteredSalesChannels.map((item) => (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "group flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-300",
                                        location.pathname === item.href ? "bg-white/10 text-white" : "hover:bg-white/5 text-slate-400"
                                    )}
                                >
                                    <item.icon className="h-5 w-5 text-slate-500 group-hover:text-amber-500 transition-colors" />
                                    <span className="text-sm font-black tracking-tight">{item.label}</span>
                                </Link>
                            ))}
                        </nav>
                    </div>
                )}
            </div>

            {/* Bottom Section: Profile & Logout */}
            <div className="p-6 border-t border-white/5 bg-slate-950/30">
                <div className="bg-slate-800/50 rounded-3xl p-4 mb-4 flex items-center gap-3 border border-white/5">
                    <div className="h-10 w-10 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center relative shadow-lg overflow-hidden group">
                        <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-xs font-black text-white relative z-10">{user?.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white truncate uppercase tracking-tight">{user?.name}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{user?.role.replace('_', ' ')}</p>
                    </div>
                                    <Link
                                        to="/admin/settings"
                                        className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors"
                                        aria-label="Settings"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Link
                        to="/"
                        className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Live
                    </Link>
                    <button
                        onClick={logout}
                        className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/0 hover:shadow-red-500/20"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Exit
                    </button>
                </div>
            </div>
        </div>
    );
}
