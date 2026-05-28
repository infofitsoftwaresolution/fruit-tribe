import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { getAdminContactSubmissions, type AdminContactSubmission } from '@/lib/api';
import { getUserErrorMessage } from '@/lib/userError';

interface AdminHeaderProps {
    onOpenSidebar?: () => void;
}

export function AdminHeader({ onOpenSidebar }: AdminHeaderProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [globalSearch, setGlobalSearch] = useState('');
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [contactNotifications, setContactNotifications] = useState<AdminContactSubmission[]>([]);
    const notificationBoxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onClickAway = (event: MouseEvent) => {
            if (!notificationBoxRef.current) return;
            const target = event.target as Node | null;
            if (target && !notificationBoxRef.current.contains(target)) {
                setNotificationsOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickAway);
        return () => document.removeEventListener('mousedown', onClickAway);
    }, []);

    const loadNotifications = async () => {
        setNotificationLoading(true);
        try {
            const items = await getAdminContactSubmissions(12);
            setContactNotifications(items);
        } catch (e: any) {
            toast.error(getUserErrorMessage(e, 'Failed to load notifications'));
        } finally {
            setNotificationLoading(false);
        }
    };

    const showNotifications = async () => {
        const nextOpen = !notificationsOpen;
        setNotificationsOpen(nextOpen);
        if (nextOpen) {
            await loadNotifications();
        }
    };

    return (
        <header className="flex h-14 items-center justify-between px-3 sm:px-6 sticky top-0 z-[60] bg-white/80 backdrop-blur-md border-b border-zinc-200/40 shadow-sm shadow-zinc-100/20">
            {/* Left: mobile toggle + search */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-lg">
                <button
                    type="button"
                    onClick={onOpenSidebar}
                    className="inline-flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors flex-shrink-0"
                    aria-label="Open admin navigation"
                >
                    <Menu className="h-4 w-4" />
                </button>

                {/* Search */}
                <div className="relative group flex-1 hidden sm:block min-w-0">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="h-3.5 w-3.5 text-zinc-400 group-focus-within:text-zinc-800 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Type to search orders, products…"
                        className="block w-full h-8 pl-9 pr-3 bg-zinc-100/60 border border-zinc-200/50 rounded-xl text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-800 transition-all duration-200"
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') {
                                const query = globalSearch.trim();
                                if (!query) return;
                                navigate(`/admin/orders?search=${encodeURIComponent(query)}`);
                            }
                        }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 opacity-50 group-focus-within:opacity-0 transition-opacity">
                        <kbd className="h-4 px-1 border border-zinc-200 bg-white rounded text-[9px] text-zinc-400 font-sans font-bold">⌘K</kbd>
                    </div>
                </div>
            </div>

            {/* Right: notifications + user */}
            <div className="flex items-center gap-3 ml-4">
                {/* Notifications */}
                <div className="relative" ref={notificationBoxRef}>
                    <button
                        onClick={() => { void showNotifications(); }}
                        className="relative h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
                        aria-label="Notifications"
                    >
                        <Bell className="h-3.5 w-3.5" />
                        {contactNotifications.length > 0 && (
                            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-500 shadow-sm" />
                        )}
                    </button>
                    <AnimatePresence>
                        {notificationsOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 mt-2 w-[340px] max-w-[85vw] bg-white border border-zinc-200/50 rounded-2xl shadow-xl overflow-hidden z-[120]"
                            >
                                <div className="px-4 py-3.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                                    <p className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Contact Messages</p>
                                    <button
                                        type="button"
                                        onClick={() => { void loadNotifications(); }}
                                        className="text-xs text-zinc-600 hover:text-zinc-950 font-bold underline underline-offset-2"
                                    >
                                        Refresh
                                    </button>
                                </div>
                                <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                                    {notificationLoading ? (
                                        <div className="px-4 py-6 text-xs text-zinc-400 font-medium">Loading…</div>
                                    ) : contactNotifications.length === 0 ? (
                                        <div className="px-4 py-6 text-xs text-zinc-400 font-medium">No contact messages yet.</div>
                                    ) : (
                                        contactNotifications.map((item) => (
                                            <div key={item.id} className="px-4 py-3 border-b border-zinc-50 last:border-b-0 hover:bg-zinc-50/50 transition-colors">
                                                <p className="text-xs font-bold text-zinc-900 truncate">{item.subject}</p>
                                                <p className="text-[10px] text-zinc-400 font-semibold truncate mt-0.5">{item.name} · {item.email}</p>
                                                <p className="text-xs text-zinc-600 mt-1.5 line-clamp-2 leading-relaxed">{item.message}</p>
                                                <p className="text-[9px] text-zinc-400 mt-1 font-semibold">{new Date(item.submittedAt).toLocaleString()}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-zinc-200/80 hidden md:block" />

                {/* User */}
                <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-zinc-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="hidden md:block text-left">
                        <p className="text-xs font-bold text-zinc-900 leading-tight">{user?.name || 'Administrator'}</p>
                        <p className="text-[10px] text-zinc-400 font-semibold leading-tight capitalize mt-0.5">
                            {user?.role?.replace('_', ' ') || 'Admin'}
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
}
