import { useState } from 'react';
import { motion } from 'motion/react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn, getRoundedClass } from '@/lib/utils';
import type { ThemeSettings } from '@/app/context/StoreContext';

type BulkInquiryFormProps = {
  productName: string;
  theme: ThemeSettings;
  className?: string;
};

export function BulkInquiryForm({ productName, theme, className }: BulkInquiryFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: `I want to order a larger quantity than the bulk pack for "${productName}". Please contact me with availability and pricing.`,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;&#10;    if (!emailPattern.test(formData.email.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!formData.message.trim()) {
      toast.error('Please enter a short message.');
      return;
    }
    toast.success('Thank you — we will reach out soon!', {
      description: 'Our team will follow up about your bulk order.',
    });
    setFormData((prev) => ({
      ...prev,
      name: '',
      email: '',
      phone: '',
      message: `I want to order a larger quantity than the bulk pack for "${productName}". Please contact me with availability and pricing.`,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className={cn('rounded-2xl sm:rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 sm:p-6', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-800">Larger order?</h3>
        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
          Need more than the bulk pack? Send a message and we will arrange pricing and delivery.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="bulk-inquiry-name" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Name
            </label>
            <input
              id="bulk-inquiry-name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="bulk-inquiry-email" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              id="bulk-inquiry-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div>
          <label htmlFor="bulk-inquiry-phone" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Phone <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="bulk-inquiry-phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            placeholder="Phone number"
          />
        </div>
        <div>
          <label htmlFor="bulk-inquiry-message" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Message
          </label>
          <textarea
            id="bulk-inquiry-message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none"
          />
        </div>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            'w-full py-2.5 sm:py-3 bg-emerald-600 text-white font-semibold text-sm shadow-md hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 rounded-xl',
            getRoundedClass(theme.buttonStyle)
          )}
        >
          <Send className="w-4 h-4" />
          Send request
        </motion.button>
      </form>
    </div>
  );
}
