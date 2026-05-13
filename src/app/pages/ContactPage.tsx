import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock } from 'lucide-react';
import { STORE_PUBLIC_CONTACT, storePhoneTelHref } from '@/app/constants/storeContact';
import { toast } from 'sonner';

export function ContactPage() {
  const [searchParams] = useSearchParams();
  const subjectFromUrl = searchParams.get('subject')?.trim() ?? '';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  useEffect(() => {
    if (!subjectFromUrl) return;
    setFormData((prev) => ({
      ...prev,
      subject: subjectFromUrl,
      message: prev.message.trim()
        ? prev.message
        : `I'd like to discuss: ${subjectFromUrl}`,
    }));
  }, [subjectFromUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;&#10;    if (!emailPattern.test(formData.email.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!formData.message.trim()) {
      toast.error('Please enter a message.');
      return;
    }
    toast.success('Thank you for your message! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const contactInfo = [
    {
      icon: Mail,
      label: 'Email us',
      value: STORE_PUBLIC_CONTACT.email,
      href: `mailto:${STORE_PUBLIC_CONTACT.email}`,
      sub: 'We reply within 24 hours',
    },
    {
      icon: Phone,
      label: 'Call us',
      value: STORE_PUBLIC_CONTACT.phone,
      href: storePhoneTelHref(STORE_PUBLIC_CONTACT.phone),
      sub: 'Mon–Sat, 9 AM – 6 PM IST',
    },
    {
      icon: MapPin,
      label: 'Our address',
      value: STORE_PUBLIC_CONTACT.address,
      href: undefined,
      sub: 'Visit us anytime',
    },
  ];

  return (
    <div className="min-h-screen bg-white pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
            Get in touch
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
            We'd love to hear from you
          </h1>
          <p className="mt-4 text-base text-slate-500 max-w-xl leading-relaxed">
            Have a question, feedback, or bulk inquiry? Send us a message and we'll respond promptly.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-10">

          {/* Contact information sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            {contactInfo.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {item.label}
                  </p>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="text-sm font-semibold text-slate-900 hover:text-emerald-600 transition-colors block truncate"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}

            {/* Business hours card */}
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                  Business hours
                </p>
                <p className="text-sm font-semibold text-emerald-900">Mon – Sat</p>
                <p className="text-xs text-emerald-700 mt-0.5">9:00 AM – 6:00 PM IST</p>
              </div>
            </div>
          </motion.div>

          {/* Contact form */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-3"
          >
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Send us a message</h2>
                  <p className="text-xs text-slate-400">Fill out the form and we'll respond within 24 hours.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-2">
                      Full name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="Your name"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-2">
                      Email address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-xs font-semibold text-slate-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    placeholder="What's this about?"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-semibold text-slate-700 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="Tell us what's on your mind..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full h-12 bg-emerald-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  Send message
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
