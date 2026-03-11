import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    Wallet,
    Truck,
    LogOut,
    ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { getEffectiveApiBase } from '@/lib/api';

const sidebarItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/delivery' },
    { icon: Package, label: 'Assignments', href: '/delivery/assignments', badgeKey: 'assignments' as const },
    { icon: Wallet, label: 'Earnings', href: '/delivery/earnings' },
];

export function DeliverySidebar() {
    const location = useLocation();
    const { theme } = useStore();
    const { user, logout } = useAuth();
    const [assignmentCount, setAssignmentCount] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchCount = () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            fetch(`${getEffectiveApiBase()}/delivery/assignments`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then((res) => (res.ok ? res.json() : []))
                .then((list: any[]) => {
                    if (cancelled) return;
                    const pending = (Array.isArray(list) ? list : []).filter(
                        (a: any) => a.status !== 'DELIVERED' && a.status !== 'FAILED' && a.status !== 'CANCELLED'
                    );
                    setAssignmentCount(pending.length);
                })
                .catch(() => {
                    if (!cancelled) setAssignmentCount(0);
                });
        };
        fetchCount();
        const interval = setInterval(fetchCount, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const badges = { assignments: assignmentCount ?? 0 };

    return (
        <div className="flex h-screen w-72 flex-col bg-slate-900 text-slate-400 border-r border-slate-800 shadow-2xl relative z-50">
            {/* Store Brand / Logo Area - match Admin */}
            <div className="flex h-24 items-center gap-4 px-6 border-b border-white/5">
                <img
                    src="/logo.png"
                    alt="The Fruit Tribe"
                    className="h-12 w-12 object-contain flex-shrink-0 rounded-xl"
                />
                <div className="flex flex-col min-w-0">
                    <span className="font-black text-white text-sm tracking-tight uppercase leading-tight">
                        {theme.storeName || 'The Fruit Tribe'}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">
                        Delivery Console
                    </span>
                </div>
            </div>

            {/* Main Navigation - same structure as Admin */}
            <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar space-y-12">
                <div>
                    <h3 className="px-4 mb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Operations
                    </h3>
                    <nav className="space-y-1">
                        {sidebarItems.map((item) => {
                            const isActive =
                                item.href === '/delivery'
                                    ? location.pathname === '/delivery'
                                    : location.pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        'group relative flex items-center justify-between rounded-2xl px-4 py-3.5 transition-all duration-300',
                                        isActive
                                            ? 'bg-emerald-500/10 text-white shadow-inner'
                                            : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="delivery-active-pill"
                                            className="absolute left-0 w-1.5 h-6 bg-emerald-500 rounded-r-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                        />
                                    )}
                                    <div className="flex items-center gap-4">
                                        <item.icon
                                            className={cn(
                                                'h-5 w-5 transition-all duration-300',
                                                isActive
                                                    ? 'text-emerald-500 scale-110'
                                                    : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'
                                            )}
                                        />
                                        <span
                                            className={cn(
                                                'text-sm font-black tracking-tight',
                                                isActive ? 'text-white' : 'text-slate-400'
                                            )}
                                        >
                                            {item.label}
                                        </span>
                                    </div>
                                    {item.badgeKey != null ? (
                                        <span
                                            className={cn(
                                                'flex h-5 min-w-[20px] items-center justify-center rounded-lg px-1.5 text-[9px] font-black shadow-sm',
                                                isActive ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                                            )}
                                        >
                                            {badges[item.badgeKey]}
                                        </span>
                                    ) : null}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Bottom Section: Profile & Logout - match Admin */}
            <div className="p-6 border-t border-white/5 bg-slate-950/30">
                <div className="bg-slate-800/50 rounded-3xl p-4 mb-4 flex items-center gap-3 border border-white/5">
                    <div className="h-10 w-10 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center relative shadow-lg overflow-hidden group">
                        <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Truck className="w-5 h-5 text-emerald-500 relative z-10" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white truncate uppercase tracking-tight">
                            {user?.name || 'Delivery Partner'}
                        </p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                            Delivery Partner
                        </p>
                    </div>
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
