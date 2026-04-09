import { Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';

export function PrivacyPage() {
  const { pages } = useStore();
  const page = pages.find((p) => p.handle === 'privacy');
  const title = page?.title?.trim() || 'Privacy Policy';
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
          <>
            <p className="mt-3 text-slate-600">
              We value your privacy and handle your data responsibly. This page explains what we collect,
              why we collect it, and how we keep it safe.
            </p>
            <div className="mt-10 space-y-7 text-slate-700 leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold text-slate-900">Contact us</h2>
                <p>
                  For privacy-related questions, please visit the <Link to="/contact" className="text-emerald-600 hover:text-emerald-700">Contact page</Link>.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

