import { Bell, Search, ExternalLink, Truck, Activity, Menu } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface DeliveryHeaderProps {
    onOpenSidebar?: () => void;
}

export function DeliveryHeader({ onOpenSidebar }: DeliveryHeaderProps) {
    const { user } = useAuth();

    const showNotifications = () => {
        toast.info('New assignment', {
            description: 'Order #FT-1005 ready for pickup.',
        });
    };

    return (
        <header className="flex h-20 items-center justify-between bg-white px-4 md:px-10 border-b border-slate-100 sticky top-0 z-[60] shadow-sm shadow-slate-950/5">
            {/* Mobile sidebar toggle + Logo + Search */}
            <div className="flex items-center gap-3 md:gap-6 flex-1 max-w-2xl">
                <button
                    type="button"
                    onClick={onOpenSidebar}
                    className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all"
                    aria-label="Open delivery navigation"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <img
                    src="/logo.png"
                    alt="The Fruit Tribe"
                    className="h-10 w-10 object-contain flex-shrink-0 rounded-xl hidden sm:block"
                />
                <div className="relative group flex-1">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search assignments, order #..."
                        className="block w-full h-12 pl-14 pr-6 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all shadow-inner"
                        readOnly
                        onClick={() => toast.info('Search coming soon')}
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-6 ml-4 md:ml-10">
                {/* Status pill - match Admin */}
                <div className="hidden xl:flex items-center gap-3 px-4 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">
                        Delivery Console
                    </span>
                </div>

                <button
                    onClick={showNotifications}
                    className="relative h-11 w-11 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-xl text-slate-500 hover:bg-slate-900 hover:text-white hover:shadow-xl transition-all group"
                >
                    <Bell className="h-5 w-5 transition-transform group-hover:rotate-12" />
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

                {/* User identity node - match Admin */}
                <button className="flex items-center gap-4 pl-2 pr-5 h-14 bg-white border border-slate-100 rounded-2xl hover:shadow-2xl hover:shadow-slate-900/10 transition-all group overflow-hidden relative">
                    <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors" />
                    <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white relative z-10">
                        <Truck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="hidden md:block text-left relative z-10">
                        <p className="text-[10px] font-black text-slate-900 leading-tight uppercase tracking-tight">
                            {user?.name || 'Delivery Partner'}
                        </p>
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">
                            Delivery Partner
                        </p>
                    </div>
                    <div className="hidden md:block ml-2 opacity-20 group-hover:opacity-100 transition-opacity">
                        <Activity className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                </button>
            </div>
        </header>
    );
}
