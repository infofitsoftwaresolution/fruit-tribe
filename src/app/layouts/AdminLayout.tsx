import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminSidebar } from '@/app/components/admin/AdminSidebar';
import { AdminHeader } from '@/app/components/admin/AdminHeader';
import { Toaster } from 'sonner';
import { AdminDataProvider } from '@/app/context/AdminDataContext';

export function AdminLayout() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const { pathname } = useLocation();
    const mainScrollRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        // Reset admin content panel scroll on each route change.
        if (mainScrollRef.current) {
            mainScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [pathname]);

    return (
        <AdminDataProvider>
        <div className="flex h-screen bg-zinc-50/70 relative overflow-hidden font-sans">

            {/* Desktop sidebar */}
            <div className="hidden md:flex flex-col h-full shrink-0 relative z-20">
                <AdminSidebar />
            </div>

            {/* Main content area */}
            <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden relative z-10">
                <AdminHeader onOpenSidebar={() => setMobileNavOpen(true)} />
                <main
                    ref={mainScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-[1400px] mx-auto w-full relative z-10 scroll-smooth custom-scrollbar"
                >
                    <Outlet />
                </main>
            </div>

            {/* Mobile sidebar drawer */}
            <AnimatePresence>
                {mobileNavOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex md:hidden"
                    >
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                            className="w-64 max-w-[80%] bg-slate-900 shadow-2xl h-full relative z-[130]"
                        >
                            <AdminSidebar />
                        </motion.div>
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            type="button"
                            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-[125]"
                            onClick={() => setMobileNavOpen(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <Toaster position="top-right" closeButton richColors theme="light" />
        </div>
        </AdminDataProvider>
    );
}
