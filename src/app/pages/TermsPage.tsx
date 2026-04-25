import { useStore } from '@/app/context/StoreContext';
import { Link } from 'react-router-dom';
import { ShieldCheck, ChevronRight } from 'lucide-react';

export function TermsPage() {
  const { pages } = useStore();
  const page = pages.find((p) => p.handle === 'terms');
  const title = page?.title?.trim() || 'Terms of Service';
  const content = page?.content?.trim();

  return (
    <div className="min-h-screen bg-white pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-8">
          <Link to="/" className="hover:text-slate-600 transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-600">{title}</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Legal</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-slate-500">
            Last updated: January 2026. Please read these terms carefully before using The Fruit Tribe platform.
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate max-w-none">
          {content ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 md:p-8">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{content}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {[
                {
                  heading: '1. Acceptance of Terms',
                  text: 'By accessing or using The Fruit Tribe platform, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our services.',
                },
                {
                  heading: '2. Use of the Platform',
                  text: 'You may use The Fruit Tribe platform for lawful purposes only. You agree not to use the platform in any way that could damage, disable, overburden, or impair our servers or networks.',
                },
                {
                  heading: '3. Orders and Payments',
                  text: 'All orders placed on the platform are subject to availability and acceptance. Prices are listed in Indian Rupees (INR) and include applicable taxes. Payments are processed securely through our payment partners.',
                },
                {
                  heading: '4. Delivery',
                  text: 'We deliver to select serviceable pincodes. Delivery timelines are estimates and may vary due to factors outside our control. We are not liable for delays caused by external factors.',
                },
                {
                  heading: '5. Refunds & Returns',
                  text: 'If you receive damaged or spoiled produce, please contact us within 24 hours of delivery. We will arrange a replacement or refund at our discretion after reviewing your claim.',
                },
                {
                  heading: '6. Account Responsibility',
                  text: 'You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately if you suspect any unauthorised use of your account.',
                },
                {
                  heading: '7. Contact',
                  text: 'For questions about these terms, please reach out through our Contact page.',
                },
              ].map((section) => (
                <div key={section.heading} className="border-b border-slate-100 pb-6 last:border-0">
                  <h2 className="text-base font-semibold text-slate-900 mb-2">{section.heading}</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{section.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap gap-4">
          <Link to="/privacy" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
            Privacy Policy →
          </Link>
          <Link to="/cookies" className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
            Cookie Policy →
          </Link>
          <Link to="/contact" className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
            Contact us →
          </Link>
        </div>
      </div>
    </div>
  );
}
