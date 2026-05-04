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
import { useDeliverySlot } from '@/app/context/DeliveryContext';
import { useServiceableAreas } from '@/app/hooks/useServiceableAreas';

interface PincodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a serviceable pincode is confirmed */
  onConfirmed: (pincode: string) => void;
}

export function PincodeSheet({ isOpen, onClose, onConfirmed }: PincodeSheetProps) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingResolveAfterAreasLoadRef = useRef(false);
  const { setAndConfirmPincode, slot, applyConfirmedPincodeSync } = useDeliverySlot();
  const {
    pincodes: serviceablePincodes,
    cities: serviceableCities,
    isPincodeServiceable,
    loading: areasLoading,
  } = useServiceableAreas();

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen) {
      pendingResolveAfterAreasLoadRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 350);
      setInput('');
      setStatus('idle');
    }
  }, [isOpen]);

  const handleCheck = useCallback(async (pin: string) => {
    if (pin.length < 6) return;
    setStatus('loading');
    try {
      const ok = await setAndConfirmPincode(pin);
      if (ok) {
        setStatus('ok');
      } else {
        setStatus('fail');
      }
    } catch {
      setStatus('fail');
    }
  }, [setAndConfirmPincode]);

  /** When service areas were still loading, finish validation the moment the list is ready (no extra delay). */
  useEffect(() => {
    if (!isOpen || areasLoading || !pendingResolveAfterAreasLoadRef.current) return;
    if (input.length !== 6) {
      pendingResolveAfterAreasLoadRef.current = false;
      return;
    }
    pendingResolveAfterAreasLoadRef.current = false;
    if (serviceablePincodes.length > 0) {
      if (!isPincodeServiceable(input)) setStatus('fail');
      else {
        setStatus('ok');
        applyConfirmedPincodeSync(input);
      }
    } else {
      void handleCheck(input);
    }
  }, [
    areasLoading,
    isOpen,
    input,
    serviceablePincodes,
    isPincodeServiceable,
    applyConfirmedPincodeSync,
    handleCheck,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    setInput(v);
    pendingResolveAfterAreasLoadRef.current = false;
    if (v.length < 6) {
      setStatus('idle');
      return;
    }
    if (areasLoading) {
      setStatus('loading');
      pendingResolveAfterAreasLoadRef.current = true;
      return;
    }
    if (serviceablePincodes.length > 0) {
      if (!isPincodeServiceable(v)) setStatus('fail');
      else {
        setStatus('ok');
        applyConfirmedPincodeSync(v);
      }
      return;
    }
    void handleCheck(v);
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
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
        />
      )}
      {isOpen && (
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
              {status === 'ok' && slot ? (
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
                      Next slot: <span className="font-black">{slot.slotLabel}</span>
                    </p>
                  </div>
                </motion.div>
              ) : status === 'fail' ? (
                <motion.div
                  key="fail"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3"
                >
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-red-700">Not deliverable</p>
                    <p className="text-[11px] font-bold text-red-500 mt-0.5">
                      This PIN is not in our service list. Try a listed pincode or check back when we expand.
                    </p>
                  </div>
                </motion.div>
              ) : null}
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
            {serviceablePincodes.length > 0 && (
              <div className="mt-4">
                <p className="w-full text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 px-1">
                  {serviceableCities[0] ? `${serviceableCities[0]} Pincodes` : 'Serviceable Pincodes'}
                </p>
                <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1 py-1 custom-scrollbar">
                  {serviceablePincodes.map((pin) => (
                    <button
                      key={pin}
                      onClick={() => {
                        setInput(pin);
                        setStatus('ok');
                        applyConfirmedPincodeSync(pin);
                      }}
                      className="px-3 py-1.5 text-[10px] font-black text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors tracking-wider"
                    >
                      {pin}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
