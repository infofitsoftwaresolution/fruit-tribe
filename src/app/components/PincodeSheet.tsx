/**
 * PincodeSheet — Mobile-first bottom sheet for pincode confirmation.
 *
 * Rules (Product Standard):
 *  - Blocks hero CTA until pincode is confirmed
 *  - Shows serviceable status in real-time (after 6 digits entered)
 *  - Tells user exactly what they get (slot, ETA) upon confirmation
 *  - No generic fallback text
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeliverySlot } from '@/lib/useDeliverySlot';

interface PincodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a serviceable pincode is confirmed */
  onConfirmed: (pincode: string) => void;
}

export function PincodeSheet({ isOpen, onClose, onConfirmed }: PincodeSheetProps) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [slotPreview, setSlotPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setAndConfirmPincode } = useDeliverySlot();

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 350);
      setInput('');
      setStatus('idle');
      setSlotPreview(null);
    }
  }, [isOpen]);

  const handleCheck = useCallback(async (pin: string) => {
    if (pin.length < 6) return;
    setStatus('loading');
    try {
      const ok = await setAndConfirmPincode(pin);
      if (ok) {
        // Compute preview slot
        const now = new Date();
        const h = now.getHours();
        let preview = 'Today, 4–6 PM';
        if (h < 9) preview = 'Today, 10 AM–12 PM';
        else if (h < 11) preview = 'Today, 12–2 PM';
        else if (h < 13) preview = 'Today, 2–4 PM';
        else if (h < 15) preview = 'Today, 4–6 PM';
        else if (h < 17) preview = 'Today, 6–8 PM';
        else preview = 'Tomorrow, 8–10 AM';
        setSlotPreview(preview);
        setStatus('ok');
      } else {
        setStatus('fail');
      }
    } catch {
      setStatus('fail');
    }
  }, [setAndConfirmPincode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    setInput(v);
    setStatus('idle');
    setSlotPreview(null);
    if (v.length === 6) handleCheck(v);
  };

  const handleConfirm = () => {
    if (status === 'ok') {
      onConfirmed(input);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-[2rem] shadow-2xl overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-12 rounded-full bg-slate-200" />
            </div>

            <div className="px-6 pb-safe pt-4 pb-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Check Delivery</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enter your 6-digit pincode</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Pincode Input */}
              <div className="relative mb-4">
                <input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={input}
                  onChange={handleChange}
                  placeholder="e.g. 560105"
                  className={cn(
                    'w-full h-14 px-5 rounded-2xl border-2 text-xl font-black text-slate-900 tracking-[0.5em] placeholder:tracking-normal placeholder:text-slate-300 placeholder:font-medium placeholder:text-base outline-none transition-colors bg-slate-50',
                    status === 'ok'   && 'border-emerald-400 bg-emerald-50/50',
                    status === 'fail' && 'border-red-400 bg-red-50/50',
                    status === 'idle' || status === 'loading' ? 'border-slate-200 focus:border-emerald-400' : '',
                  )}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {status === 'loading' && <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />}
                  {status === 'ok'      && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  {status === 'fail'    && <AlertCircle className="h-5 w-5 text-red-500" />}
                </div>
              </div>

              {/* Status feedback */}
              <AnimatePresence mode="wait">
                {status === 'ok' && slotPreview && (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-5 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-black text-emerald-800">We deliver here! 🎉</p>
                      <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                        Next slot: <span className="font-black">{slotPreview}</span>
                      </p>
                    </div>
                  </motion.div>
                )}
                {status === 'fail' && (
                  <motion.div
                    key="fail"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3"
                  >
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-black text-red-700">Not serviceable yet</p>
                      <p className="text-[11px] font-bold text-red-500 mt-0.5">
                        We're expanding fast — try a nearby pincode or check back soon.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Confirm CTA */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                disabled={status !== 'ok'}
                className={cn(
                  'w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest transition-colors shadow-lg',
                  status === 'ok'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/25'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none',
                )}
              >
                {status === 'ok' ? (
                  <>
                    Confirm — See Delivery Slot
                    <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  'Enter pincode to continue'
                )}
              </motion.button>

              {/* Suggestion chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                <p className="w-full text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Bangalore pincodes</p>
                {['560105', '560068', '560076', '560102', '560078', '560083'].map((pin) => (
                  <button
                    key={pin}
                    onClick={() => {
                      setInput(pin);
                      handleCheck(pin);
                    }}
                    className="px-3 py-1.5 text-[10px] font-black text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors tracking-wider"
                  >
                    {pin}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
