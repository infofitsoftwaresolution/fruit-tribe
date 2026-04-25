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
    LogOut,
    Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useAdminData } from '@/app/context/AdminDataContext';

const sidebarItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin', roles: ['admin'] },
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

    return (
        <div className="flex h-screen w-64 flex-col bg-slate-900 text-slate-400 border-r border-white/5 shadow-2xl relative z-50 overflow-hidden">
            {/* Ambient Background Glows inside sidebar */}
            <div className="absolute top-0 -left-20 h-40 w-40 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 -right-20 h-40 w-40 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

            {/* Store Brand / Premium Logo Area */}
            <div className="flex h-20 items-center gap-3 px-4 relative z-10">
                <div className="relative group">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img
                        src="/logo.png"
                        alt="The Fruit Tribe"
                        className="h-10 w-10 object-contain flex-shrink-0 rounded-xl relative z-10 shadow-lg"
                    />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-black text-white text-sm tracking-tight uppercase leading-tight font-heading">{theme.storeName || 'Fruit Tribe'}</span>
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-0.5 opacity-80">Orchard Control</span>
                </div>
            </div>

            {/* Main Navigation with Premium Hover States */}
            <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar relative z-10 space-y-10">
                <div>
                    <h3 className="px-4 mb-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-50">Operations</h3>
                    <nav className="space-y-1">
                        {filteredSidebarItems.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "group relative flex items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-500",
                                        isActive
                                            ? "bg-white/5 text-white shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-white/5"
                                            : "hover:bg-white/[0.03] text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-500 border",
                                            isActive 
                                                ? "bg-emerald-500/20 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                                                : "bg-slate-800/50 border-white/5 text-slate-500 group-hover:bg-slate-800 group-hover:text-slate-300"
                                        )}>
                                            <item.icon className={cn("h-4 w-4", isActive && "animate-pulse")} />
                                        </div>
                                        <span className={cn("text-[10px] font-black tracking-tight uppercase", isActive ? "text-white" : "text-slate-400")}>
                                            {item.label}
                                        </span>
                                    </div>
                                    
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-pill"
                                            className="absolute right-2 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,1)]"
                                        />
                                    )}

                                    {item.badgeKey != null && badges[item.badgeKey] > 0 ? (
                                        <span className={cn(
                                            "flex h-4 min-w-[16px] items-center justify-center rounded-md px-1 text-[8px] font-black shadow-sm",
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

                {/* Digital Presence / System Sections */}
                {filteredSalesChannels.length > 0 && (
                    <div>
                        <h3 className="px-4 mb-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-50">Infrastructure</h3>
                        <nav className="space-y-1">
                            {filteredSalesChannels.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        className={cn(
                                            "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500",
                                            isActive ? "bg-white/5 text-white border border-white/5" : "hover:bg-white/[0.03] text-slate-400 hover:text-slate-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-500 border",
                                            isActive 
                                                ? "bg-amber-500/20 border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                                                : "bg-slate-800/50 border-white/5 text-slate-500 group-hover:text-amber-500"
                                        )}>
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        <span className="text-[10px] font-black tracking-tight uppercase">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                )}
            </div>

            {/* Bottom Section: Profile & Logout */}
            <div className="p-4 border-t border-white/5 bg-slate-950/40 relative z-10">
                <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-3 mb-3 flex items-center gap-2 border border-white/5 shadow-2xl">
                    <div className="h-8 w-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center relative shadow-lg overflow-hidden group">
                        <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-[10px] font-black text-white relative z-10 uppercase">{user?.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-white truncate uppercase tracking-tight">{user?.name}</p>
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.15em] mt-0.5">{user?.role.replace('_', ' ')}</p>
                    </div>
                    <Link
                        to={settingsHref}
                        className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all border border-transparent hover:border-white/10"
                        aria-label="Settings"
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Link
                        to="/"
                        className="flex items-center justify-center gap-2 h-9 rounded-xl bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all text-[8px] font-black uppercase tracking-[0.2em] border border-white/5"
                    >
                        <ExternalLink className="w-3 h-3" />
                        View
                    </Link>
                    <button
                        onClick={logout}
                        className="flex items-center justify-center gap-2 h-9 rounded-xl bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[8px] font-black uppercase tracking-[0.2em] shadow-lg shadow-red-500/0 hover:shadow-red-500/20 border border-red-500/10 hover:border-red-500"
                    >
                        <LogOut className="w-3 h-3" />
                        Exit
                    </button>
                </div>
            </div>
        </div>
    );
}
