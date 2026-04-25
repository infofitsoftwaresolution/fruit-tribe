import { useStore } from '@/app/context/StoreContext';
import { Link } from 'react-router-dom';
import { Cookie, ChevronRight } from 'lucide-react';

export function CookiesPage() {
  const { pages } = useStore();
  const page = pages.find((p) => p.handle === 'cookies');
  const title = page?.title?.trim() || 'Cookie Policy';
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
              <Cookie className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Legal</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-slate-500">
            Last updated: January 2026. This page explains how we use cookies and similar technologies on our website.
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
                heading: '1. What Are Cookies?',
                text: 'Cookies are small text files stored on your device when you visit a website. They help us recognise you on return visits, remember your preferences, and understand how you use our site.',
              },
              {
                heading: '2. Types of Cookies We Use',
                text: 'We use essential cookies (required for the site to function), functional cookies (to remember your preferences such as cart items and location), and analytics cookies (to help us understand traffic patterns and improve our service).',
              },
              {
                heading: '3. Essential Cookies',
                text: 'These cookies are necessary for the website to function properly. They include cookies for maintaining your session, keeping items in your cart, and remembering your delivery pincode.',
              },
              {
                heading: '4. Analytics Cookies',
                text: 'We may use analytics tools to collect anonymous information about how visitors interact with our website. This helps us improve performance and content. No personally identifiable information is included in analytics data.',
              },
              {
                heading: '5. Managing Cookies',
                text: 'You can control and delete cookies through your browser settings. Disabling essential cookies may affect the functionality of the website, including your ability to add items to your cart or complete a checkout.',
              },
              {
                heading: '6. Contact',
                text: 'If you have any questions about our Cookie Policy, please reach out through our Contact page.',
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
          <Link to="/privacy" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
            Privacy Policy →
          </Link>
          <Link to="/terms" className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
            Terms of Service →
          </Link>
          <Link to="/contact" className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
            Contact us →
          </Link>
        </div>
      </div>
    </div>
  );
}
