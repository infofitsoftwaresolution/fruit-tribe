import { Bell, Search, ExternalLink, Command, Shield, Zap, Activity, Menu } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, KeyboardEvent } from 'react';

interface AdminHeaderProps {
    onOpenSidebar?: () => void;
}

export function AdminHeader({ onOpenSidebar }: AdminHeaderProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [globalSearch, setGlobalSearch] = useState('');

    const showNotifications = () => {
        toast.info('New order #1005', {
            description: 'Customer: Alice Smith • 2m ago',
        });
        setTimeout(() => {
            toast.success('Low stock alert', {
                description: 'Alphonso Mango: fewer than 5 left',
            });
        }, 500);
    };

    return (
        <header className="flex h-16 items-center justify-between px-4 md:px-6 sticky top-0 z-[60] backdrop-blur-xl bg-white/70 border-b border-slate-100/50 shadow-sm">
            {/* Mobile sidebar toggle */}
            <div className="flex items-center gap-4 flex-1 max-w-2xl">
                <button
                    type="button"
                    onClick={onOpenSidebar}
                    className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                    aria-label="Open admin navigation"
                >
                    <Menu className="h-4 w-4" />
                </button>
                
                {/* Global Command Center */}
                <div className="relative group flex-1 hidden sm:block">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <Search className="h-3.5 w-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search anything..."
                        className="block w-full h-10 pl-11 pr-4 bg-slate-50/50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all"
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
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 opacity-40 group-focus-within:opacity-100 transition-opacity">
                        <kbd className="h-5 px-1 border border-slate-200 bg-white rounded-md text-[9px] font-black text-slate-400 shadow-sm flex items-center justify-center">
                            ⌘
                        </kbd>
                        <kbd className="h-5 px-1 border border-slate-200 bg-white rounded-md text-[9px] font-black text-slate-400 shadow-sm flex items-center justify-center">
                            K
                        </kbd>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-6 ml-6">
                {/* Live Status Pulsar */}
                <div className="hidden xl:flex items-center gap-2.5 px-3 py-1.5 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Network Live</span>
                </div>

                <div className="h-8 w-[1px] bg-slate-100 hidden md:block" />

                {/* Notifications Node */}
                <button
                    onClick={showNotifications}
                    className="relative h-10 w-10 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-slate-500 hover:bg-slate-900 hover:text-white hover:shadow-xl transition-all duration-500 group"
                >
                    <Bell className="h-4 w-4 transition-transform group-hover:rotate-12" />
                    <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white shadow-sm animate-bounce" />
                </button>

                {/* User Identity Node */}
                <button className="flex items-center gap-3 pl-1.5 pr-4 h-11 bg-white border border-slate-100 rounded-xl hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors" />
                    <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-[10px] font-black shadow-lg relative z-10 transition-transform group-hover:scale-105 duration-500">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="hidden md:block text-left relative z-10">
                        <p className="text-[10px] font-black text-slate-900 leading-tight uppercase tracking-tight">{user?.name || 'Administrator'}</p>
                        <p className="text-[7px] font-black text-emerald-600 uppercase tracking-[0.2em] mt-0.5 opacity-80">{user?.role?.replace('_', ' ') || 'Guest'}</p>
                    </div>
                    <div className="hidden md:block ml-1 transition-all group-hover:translate-x-0.5 duration-500">
                        <Zap className="h-3 w-3 text-emerald-500 fill-emerald-500/10" />
                    </div>
                </button>
            </div>
        </header>
    );
}
