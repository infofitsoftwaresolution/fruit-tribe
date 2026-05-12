import { motion } from 'framer-motion';
import { Facebook, Instagram, Mail, Phone, MapPin, Zap, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STORE_PUBLIC_CONTACT, storePhoneTelHref } from '@/app/constants/storeContact';
import { useStore } from '@/app/context/StoreContext';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';
import { useProducts } from '@/app/hooks/useProducts';
import { useMemo, useState } from 'react';

export function Footer() {
  const { theme, products: localProducts } = useStore();
  const { products: apiProducts } = useProducts({ limit: 200, showOutOfSeason: true });
  const products = apiProducts.length > 0 ? apiProducts : localProducts;
  const { cities: deliveryCities } = useServiceableAreas();

  const socialLinks = [
    { icon: Facebook, href: theme.socialFacebook || 'https://www.facebook.com/share/18izdmkL67/', label: 'Facebook' },
    { icon: Instagram, href: theme.socialInstagram || 'https://www.instagram.com/thefruittribe?igsh=dmg1bXEydGtjcW5i', label: 'Instagram' },
  ];

  const quickLinks = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const categories = useMemo(() => {
    const names = products
      .map((p) => (p.category || '').trim())
      .filter((name): name is string => Boolean(name))
      .filter((name, idx, arr) => arr.findIndex((v) => v.toLowerCase() === name.toLowerCase()) === idx)
      .sort((a, b) => a.localeCompare(b));
    return names.slice(0, 8);
  }, [products]);

  const { address: footerAddress, phone: footerPhone, email: footerEmail } = STORE_PUBLIC_CONTACT;
  const footerPhoneHref = storePhoneTelHref(footerPhone);

  return (
    <footer className="bg-slate-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 mb-12">

          {/* Brand */}
          <div className="lg:col-span-4 space-y-6">
            <Link to="/" className="inline-flex items-center gap-3">
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt={theme.storeName} className="h-10 w-auto object-contain" />
              ) : (
                <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white shadow-md">
                  {theme.storeName.charAt(0)}
                </div>
              )}
              <span className="font-bold text-xl tracking-tight">{theme.storeName}</span>
            </Link>

            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              {theme.footerAboutText || 'Fresh fruit from trusted growers, delivered with care. Quality and convenience you can count on.'}
            </p>
            
            {deliveryCities.length > 0 && (
               <p className="text-sm text-slate-400 flex items-start gap-2">
                 <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                 <span>We deliver to: <span className="font-medium text-slate-300">{deliveryCities.join(', ')}</span></span>
               </p>
            )}

            <div className="flex gap-3 pt-2">
              {socialLinks.filter(s => s.href !== '#').map((social, index) => (
                <motion.a
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -2 }}
                  className="h-9 px-3.5 bg-slate-800 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  <social.icon className="w-3.5 h-3.5" />
                  {social.label}
                </motion.a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="lg:col-span-2 space-y-5">
            <h3 className="text-sm font-semibold text-slate-100">Quick links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link to={link.path} className="text-sm text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1 group">
                    <ArrowUpRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-emerald-400" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div className="lg:col-span-2 space-y-5">
            <h3 className="text-sm font-semibold text-slate-100">Categories</h3>
            <ul className="space-y-3">
              {categories.map((category, index) => (
                <li key={index}>
                  <Link to={`/products?categoryName=${encodeURIComponent(category)}`} className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                    {category}
                  </Link>
                </li>
              ))}
              {categories.length === 0 && (
                <li>
                  <span className="text-sm text-slate-500">No categories</span>
                </li>
              )}
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-4 space-y-5">
            <h3 className="text-sm font-semibold text-slate-100">Contact</h3>
            <ul className="space-y-4">
              <li>
                <a href={footerPhoneHref} className="flex items-start gap-3 text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                  <Phone className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                  <span className="leading-relaxed">{footerPhone}</span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-sm text-slate-400">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                  <span className="leading-relaxed">{footerAddress}</span>
                </div>
              </li>
              <li>
                <a href={`mailto:${footerEmail}`} className="flex items-start gap-3 text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                  <Mail className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                  <span className="leading-relaxed">{footerEmail}</span>
                </a>
              </li>
            </ul>

          </div>
        </div>

        {/* Footer bottom */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} {theme.storeName || 'The Fruit Tribe'}. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-4 md:gap-6 justify-center">
            {[
              { label: 'Privacy', path: '/privacy' },
              { label: 'Terms', path: '/terms' },
              { label: 'Cookies', path: '/cookies' },
            ].map((item) => (
              <Link key={item.path} to={item.path} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="https://infofitsoftware.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
          >
            Made by Infofit Software Solution
          </a>
        </div>
      </div>
    </footer>
  );
}