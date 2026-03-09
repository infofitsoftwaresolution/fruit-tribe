import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

export function DeliveryLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <header className="px-4 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-slate-900/80">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">Fruit Tribes</p>
          <h1 className="text-lg font-black tracking-tight">Delivery Console</h1>
        </div>
      </header>
      <main className="flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

