import { motion } from 'framer-motion';
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin, Leaf, ShieldCheck, Zap, Globe, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function Footer() {
  const { theme } = useStore();
  const { cities: deliveryCities } = useServiceableAreas();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterError, setNewsletterError] = useState('');
  const [newsletterSuccess, setNewsletterSuccess] = useState('');

  const socialLinks = [
    { icon: Facebook, href: theme.socialFacebook || '#', label: 'Facebook' },
    { icon: Instagram, href: theme.socialInstagram || '#', label: 'Instagram' },
    { icon: Twitter, href: theme.socialTwitter || '#', label: 'Twitter' },
  ];

  const quickLinks = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const categories = [
    'Tropical fruits',
    'Berries',
    'Citrus',
    'Exotic fruits',
    'Seasonal picks',
    'Organic',
  ];

  return (
    <footer className="bg-slate-950 text-white relative overflow-hidden border-t border-white/5">
      {/* Cinematic Static & Noise */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-16 mb-24">

          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-4 space-y-10"
          >
            <Link to="/" className="flex items-center gap-4 group">
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt={theme.storeName} className="h-12 w-auto object-contain" />
              ) : (
                <div className="h-12 w-12 bg-emerald-500 rounded-2xl flex items-center justify-center font-black text-white shadow-2xl transition-all rotate-3 group-hover:rotate-0">
                  {theme.storeName.charAt(0)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-black text-xl tracking-tight uppercase leading-none">{theme.storeName}</span>
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.4em] mt-1">Fresh fruits delivered</span>
              </div>
            </Link>

            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed italic max-w-sm">
              {theme.footerAboutText || 'Fresh fruit from trusted growers, delivered with care. Quality and convenience you can count on.'}
            </p>
            {deliveryCities.length > 0 && (
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                We deliver to: {deliveryCities.join(', ')}
              </p>
            )}
            <div className="flex gap-4">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={index}
                  href={social.href}
                  whileHover={{ y: -5, scale: 1.1 }}
                  className="h-12 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition-all"
                >
                  <social.icon className="w-3.5 h-3.5" />
                  {social.label}
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Quick links */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Quick links</h3>
            </div>
            <ul className="space-y-4">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link to={link.path}>
                    <motion.div
                      whileHover={{ x: 5 }}
                      className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-3 transition-colors"
                    >
                      <ArrowUpRight className="w-3 h-3 text-emerald-500/40" />
                      {link.name}
                    </motion.div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Categories</h3>
            </div>
            <ul className="space-y-4">
              {categories.map((category, index) => (
                <li key={index}>
                  <motion.div
                    whileHover={{ x: 5 }}
                    className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-3 cursor-pointer transition-colors"
                  >
                    <div className="w-1 h-1 bg-slate-800 rounded-full" />
                    {category}
                  </motion.div>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-4 space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Contact</h3>
            </div>

            <div className="space-y-6">
              {[
                { icon: MapPin, text: theme.contactAddress || 'Fresh City, Local' },
                { icon: Phone, text: theme.contactPhone || '1-800-FRUIT' },
                { icon: Mail, text: theme.contactEmail || 'hello@fruittribe.com' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ x: 5 }}
                  className="flex items-start gap-4 text-[10px] font-black text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer uppercase tracking-widest"
                >
                  <item.icon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="leading-relaxed">{item.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Newsletter */}
            <div className="pt-6">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Subscribe to our newsletter</p>
              {newsletterError && (
                <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">{newsletterError}</p>
              )}
              {newsletterSuccess && !newsletterError && (
                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">{newsletterSuccess}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="you@gmail.com"
                  value={newsletterEmail}
                  onChange={(e) => {
                    setNewsletterEmail(e.target.value);
                    setNewsletterError('');
                    setNewsletterSuccess('');
                  }}
                  className="flex-1 h-14 px-6 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="h-14 w-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all"
                  onClick={() => {
                    const value = newsletterEmail.trim();
                    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!pattern.test(value)) {
                      setNewsletterError('Please enter a valid email address.');
                      setNewsletterSuccess('');
                      return;
                    }
                    if (!value.toLowerCase().endsWith('@gmail.com')) {
                      setNewsletterError('Please use a valid Gmail address (e.g. you@gmail.com).');
                      setNewsletterSuccess('');
                      return;
                    }
                    setNewsletterError('');
                    setNewsletterSuccess('Subscribed successfully. Check your inbox soon!');
                    setNewsletterEmail('');
                  }}
                >
                  <Zap className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8"
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">
              © 2026 The Fruit Tribe. All rights reserved.
            </p>
            <div className="flex items-center gap-4 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Secure</span>
            </div>
          </div>

          <div className="flex gap-10">
            {['Privacy', 'Terms of service', 'Cookies'].map((txt, i) => (
              <motion.a
                key={i}
                whileHover={{ y: -2, textDecoration: 'underline' }}
                href="#"
                className="text-[9px] font-black text-slate-600 hover:text-white uppercase tracking-widest transition-colors"
              >
                {txt}
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}