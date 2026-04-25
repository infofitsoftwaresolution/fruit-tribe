import { useStore } from '@/app/context/StoreContext';
import { Link } from 'react-router-dom';
import { Lock, ChevronRight } from 'lucide-react';

export function PrivacyPage() {
  const { pages } = useStore();
  const page = pages.find((p) => p.handle === 'privacy');
  const title = page?.title?.trim() || 'Privacy Policy';
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
              <Lock className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Legal</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-slate-500">
            Last updated: January 2026. We are committed to protecting your privacy and handling your data responsibly.
          </p>
        </div>

        {/* Content */}
        {content ? (
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 md:p-8">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{content}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {[
              {
                heading: '1. Information We Collect',
                text: 'We collect information you provide directly to us, including your name, email address, phone number, and delivery address when you create an account or place an order. We also collect usage data automatically, such as pages visited and device type.',
              },
              {
                heading: '2. How We Use Your Information',
                text: 'We use your information to process orders, send delivery updates, provide customer support, improve our services, and send promotional communications if you have opted in.',
              },
              {
                heading: '3. Information Sharing',
                text: 'We do not sell or rent your personal information. We may share your information with delivery partners and payment processors solely to fulfil your orders. These parties are obligated to keep your information secure.',
              },
              {
                heading: '4. Data Security',
                text: 'We implement industry-standard security measures to protect your data. All payment transactions are encrypted using SSL technology. However, no method of transmission over the internet is 100% secure.',
              },
              {
                heading: '5. Cookies',
                text: 'We use cookies and similar tracking technologies to enhance your experience. You can control cookie preferences through your browser settings. For more details, see our Cookie Policy.',
              },
              {
                heading: '6. Your Rights',
                text: 'You have the right to access, update, or delete your personal information at any time. You can do this through your account settings or by contacting us directly.',
              },
              {
                heading: '7. Contact Us',
                text: 'If you have questions about this Privacy Policy or how we handle your data, please visit our Contact page. We will respond within 24 hours.',
              },
            ].map((section) => (
              <div key={section.heading} className="border-b border-slate-100 pb-6 last:border-0">
                <h2 className="text-base font-semibold text-slate-900 mb-2">{section.heading}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{section.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap gap-4">
          <Link to="/terms" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
            Terms of Service →
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
