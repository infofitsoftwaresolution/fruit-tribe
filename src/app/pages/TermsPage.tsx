import { useStore } from '@/app/context/StoreContext';

export function TermsPage() {
  const { pages } = useStore();
  const page = pages.find((p) => p.handle === 'terms');
  const title = page?.title?.trim() || 'Terms of Service';
  const content = page?.content?.trim();

  return (
    <div className="min-h-screen bg-slate-50 pt-28 pb-16">
      <div className="max-w-4xl mx-auto px-6 md:px-10">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {content ? (
          <div className="mt-8 rounded-3xl bg-white border border-slate-100 shadow-sm p-6 md:p-8">
            <p className="whitespace-pre-line text-slate-700 leading-relaxed">{content}</p>
          </div>
        ) : (
          <p className="mt-3 text-slate-600">
            These terms explain how you can use The Fruit Tribe platform and services.
          </p>
        )}
      </div>
    </div>
  );
}

