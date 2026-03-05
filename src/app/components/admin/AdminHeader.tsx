import { Bell, Search, ExternalLink, Command, Shield, Zap, Activity } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, KeyboardEvent } from 'react';

export function AdminHeader() {
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
        <header className="flex h-20 items-center justify-between bg-white px-10 border-b border-slate-100 sticky top-0 z-[60] shadow-sm shadow-slate-950/5">
            {/* Logo + Global Command */}
            <div className="flex items-center gap-6 flex-1 max-w-2xl">
                <img src="/logo.png" alt="The Fruit Tribe" className="h-10 w-10 object-contain flex-shrink-0 rounded-xl hidden sm:block" />
                <div className="relative group flex-1">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search orders, products, customers..."
                        className="block w-full h-12 pl-14 pr-6 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all shadow-inner"
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
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1">
                        <kbd className="h-6 px-1.5 border border-slate-200 bg-white rounded-lg text-[10px] font-black text-slate-300 shadow-sm flex items-center justify-center">
                            ⌘
                        </kbd>
                        <kbd className="h-6 px-1.5 border border-slate-200 bg-white rounded-lg text-[10px] font-black text-slate-300 shadow-sm flex items-center justify-center">
                            K
                        </kbd>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 ml-10">
                {/* System Pulsar */}
                <div className="hidden xl:flex items-center gap-3 px-4 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">All systems running</span>
                </div>

                {/* Notifications Node */}
                <button
                    onClick={showNotifications}
                    className="relative h-11 w-11 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-xl text-slate-500 hover:bg-slate-900 hover:text-white hover:shadow-xl transition-all group"
                >
                    <Bell className="h-5 w-5 transition-transform group-hover:rotate-12" />
                    <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 border-2 border-white shadow-sm" />
                </button>

                <div className="h-8 w-[1px] bg-slate-100 hidden sm:block" />

                <Link
                    to="/"
                    target="_blank"
                    className="hidden lg:flex items-center gap-2 px-5 h-11 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-900 hover:text-white hover:shadow-xl transition-all uppercase tracking-widest"
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View store
                </Link>

                {/* Merchant Identity Node */}
                <button className="flex items-center gap-4 pl-2 pr-5 h-14 bg-white border border-slate-100 rounded-2xl hover:shadow-2xl hover:shadow-slate-900/10 transition-all group overflow-hidden relative">
                    <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors" />
                    <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-black shadow-lg relative z-10">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="hidden md:block text-left relative z-10">
                        <p className="text-[10px] font-black text-slate-900 leading-tight uppercase tracking-tight">{user?.name || 'Administrator'}</p>
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">{user?.role?.replace('_', ' ') || 'Guest'}</p>
                    </div>
                    <div className="hidden md:block ml-2 opacity-20 group-hover:opacity-100 transition-opacity">
                        <Zap className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                </button>
            </div>
        </header>
    );
}
