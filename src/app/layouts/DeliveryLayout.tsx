import { Outlet } from 'react-router-dom';
import { DeliverySidebar } from '@/app/components/delivery/DeliverySidebar';
import { DeliveryHeader } from '@/app/components/delivery/DeliveryHeader';
import { Toaster } from 'sonner';

export function DeliveryLayout() {
    return (
        <div className="flex h-screen bg-slate-50 relative overflow-hidden">
            {/* Subtle background artifacts - match Admin */}
            <div className="absolute top-0 right-0 h-[500px] w-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 h-[500px] w-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            <DeliverySidebar />

            <div className="flex flex-1 flex-col min-w-0 min-h-0">
                <DeliveryHeader />
                <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 md:px-12 py-10 max-w-[1600px] mx-auto w-full relative z-10 scroll-smooth">
                    <Outlet />
                </main>
            </div>

            <Toaster position="top-right" closeButton richColors theme="light" />
        </div>
    );
}
