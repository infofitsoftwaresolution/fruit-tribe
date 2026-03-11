import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DeliverySidebar } from '@/app/components/delivery/DeliverySidebar';
import { DeliveryHeader } from '@/app/components/delivery/DeliveryHeader';
import { Toaster } from 'sonner';

export function DeliveryLayout() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-slate-50 relative">
            {/* Subtle background artifacts - match Admin */}
            <div className="absolute top-0 right-0 h-[500px] w-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 h-[500px] w-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="hidden md:block">
                <DeliverySidebar />
            </div>

            <div className="flex flex-1 flex-col min-w-0 min-h-0">
                <DeliveryHeader onOpenSidebar={() => setMobileNavOpen(true)} />
                <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 md:px-12 py-10 max-w-[1600px] mx-auto w-full relative z-10 scroll-smooth">
                    <Outlet />
                </main>
            </div>

            {/* Mobile sidebar drawer */}
            {mobileNavOpen && (
                <div className="fixed inset-0 z-[120] flex md:hidden">
                    <div className="w-72 max-w-full bg-slate-900 shadow-2xl h-full">
                        <DeliverySidebar />
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
    );
}
