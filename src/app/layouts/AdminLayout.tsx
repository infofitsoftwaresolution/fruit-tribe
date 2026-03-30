import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '@/app/components/admin/AdminSidebar';
import { AdminHeader } from '@/app/components/admin/AdminHeader';
import { Toaster } from 'sonner';
import { AdminDataProvider } from '@/app/context/AdminDataContext';

export function AdminLayout() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <AdminDataProvider>
        <div className="flex h-screen bg-slate-50 relative overflow-hidden">
            {/* Subtle background artifacts for premium feel */}
            <div className="absolute top-0 right-0 h-[500px] w-[1000px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 h-[500px] w-[1000px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="hidden md:flex flex-col h-full shrink-0">
                <AdminSidebar />
            </div>

            <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
                <AdminHeader onOpenSidebar={() => setMobileNavOpen(true)} />
                <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 md:px-12 py-10 max-w-[1600px] mx-auto w-full relative z-10 scroll-smooth custom-scrollbar">
                    <Outlet />
                </main>
            </div>

            {/* Mobile sidebar drawer */}
            {mobileNavOpen && (
                <div className="fixed inset-0 z-[120] flex md:hidden">
                    <div className="w-72 max-w-full bg-slate-900 shadow-2xl h-full">
                        <AdminSidebar />
                    </div>
                    <button
                        type="button"
                        className="flex-1 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setMobileNavOpen(false)}
                    />
                </div>
            )}

            <Toaster position="top-right" closeButton richColors theme="light" />
        </div>
        </AdminDataProvider>
    );
}
