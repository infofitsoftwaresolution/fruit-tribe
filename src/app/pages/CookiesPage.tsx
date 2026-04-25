import { useStore } from '@/app/context/StoreContext';

export function CookiesPage() {
  const { pages } = useStore();
  const page = pages.find((p) => p.handle === 'cookies');
  const title = page?.title?.trim() || 'Cookie Policy';
  const content = page?.content?.trim();
  const sections = content
    ? content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 pt-28 pb-16">
      <div className="max-w-4xl mx-auto px-6 md:px-10">
        <div className="space-y-3">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.28em]">Policy</p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500">Learn how cookies and similar technologies support your shopping experience.</p>
        </div>
        {sections.length > 0 ? (
          <div className="mt-8 rounded-3xl bg-white border border-slate-100 shadow-sm p-6 md:p-8 space-y-6">
            {sections.map((block, idx) => (
              <section key={idx} className="space-y-2">
                <h2 className="text-lg font-black text-slate-900">Section {idx + 1}</h2>
                <p className="whitespace-pre-line text-slate-700 leading-relaxed">{block}</p>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl bg-white border border-slate-100 shadow-sm p-6 md:p-8">
            <p className="text-slate-700 leading-relaxed">
              This page explains how cookies and similar technologies are used on our website.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

