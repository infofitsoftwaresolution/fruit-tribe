import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';
import { STORE_PUBLIC_CONTACT, storePhoneTelHref } from '@/app/constants/storeContact';
import { useStore } from '@/app/context/StoreContext';
import { submitContactMessage } from '@/lib/api';
import { cn, getRoundedClass } from '@/lib/utils';
import { toast } from 'sonner';

export function ContactPage() {
  const { theme } = useStore();
  const [searchParams] = useSearchParams();
  const subjectFromUrl = searchParams.get('subject')?.trim() ?? '';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(formData.email.trim())) {
      toast.error('Please enter a valid email address.', {
        description: 'Use a proper email so we can reply to you.',
      });
      return;
    }
    if (!formData.message.trim()) {
      toast.error('Please enter a message.');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitContactMessage({
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });
      toast.success('Thank you for your message!', {
        description: 'We will get back to you soon.',
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error: any) {
      const subject = encodeURIComponent(formData.subject.trim() || 'Website inquiry');
      const body = encodeURIComponent(
        `Name: ${formData.name.trim()}\nEmail: ${formData.email.trim()}\n\n${formData.message.trim()}`
      );
      window.location.href = `mailto:${STORE_PUBLIC_CONTACT.email}?subject=${subject}&body=${body}`;
      toast.error(error?.message || 'Could not send message through server.', {
        description: 'Opening your email app so you can send this directly.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="pt-28 pb-12 min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              Get in touch
            </span>
          </h1>
          <p className="text-base text-slate-500 max-w-xl mx-auto">
            Have a question or feedback? We'd love to hear from you!
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div>
              <h2 className="text-xl font-black text-slate-900 mb-2">Contact Information</h2>
              <p className="text-sm text-slate-500 mb-4">
                Reach out through any of these channels. We're here to help!
              </p>
            </div>

            <div className="space-y-4">
              <motion.div
                whileHover={{ x: 4 }}
                className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-slate-100"
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">Email</h3>
                  <a
                    href={`mailto:${STORE_PUBLIC_CONTACT.email}`}
                    className="text-slate-600 text-sm hover:text-emerald-600 transition-colors"
                  >
                    {STORE_PUBLIC_CONTACT.email}
                  </a>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ x: 4 }}
                className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-slate-100"
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">Phone</h3>
                  <a
                    href={storePhoneTelHref(STORE_PUBLIC_CONTACT.phone)}
                    className="text-slate-600 text-sm hover:text-emerald-600 transition-colors block"
                  >
                    {STORE_PUBLIC_CONTACT.phone}
                  </a>
                  <p className="text-slate-600 text-sm mt-1">Mon–Sat: 9AM – 6PM IST</p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ x: 4 }}
                className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-slate-100"
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">Address</h3>
                  <p className="text-slate-600 text-sm">{STORE_PUBLIC_CONTACT.address}</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-2 mb-5">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Send us a message</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors text-sm"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors text-sm"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors text-sm"
                  placeholder="What's this about?"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors resize-none text-sm"
                  placeholder="Tell us what's on your mind..."
                />
              </div>

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full py-3 bg-emerald-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 rounded-lg disabled:opacity-70 disabled:cursor-not-allowed",
                  getRoundedClass(theme.buttonStyle)
                )}
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Sending...' : 'Send message'}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
