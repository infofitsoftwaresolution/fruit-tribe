import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { getServiceableAreas } from '@/lib/api';

const PINCODE_KEY = 'ft_delivery_pincode';
const SERVICEABLE_KEY = 'ft_serviceable_pincodes';
const SERVICEABLE_TTL_MS = 5 * 60 * 1000;

export interface DeliverySlot {
  etaLabel: string;
  slotLabel: string;
  cutoffAt: string;
  cutoffSecondsLeft: number;
  cutoffDisplay: string;
  isServiceable: boolean;
}

interface DeliveryContextType {
  pincode: string | null;
  slot: DeliverySlot | null;
  isLoading: boolean;
  isServiceable: boolean | null;
  setAndConfirmPincode: (pin: string) => Promise<boolean>;
  clearPincode: () => void;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

// --- Internal Logic ---
interface SlotWindow {
  label: string;
  etaLabel: string;
  cutoffHour: number;
  cutoffMin: number;
  slotEndHour: number;
}

const TODAY_SLOTS: SlotWindow[] = [
  { label: '10 AM–12 PM', etaLabel: 'Today by 12:00 PM', cutoffHour: 9,  cutoffMin: 0,  slotEndHour: 12 },
  { label: '12–2 PM',     etaLabel: 'Today by 2:00 PM',  cutoffHour: 11, cutoffMin: 0,  slotEndHour: 14 },
  { label: '2–4 PM',      etaLabel: 'Today by 4:00 PM',  cutoffHour: 13, cutoffMin: 0,  slotEndHour: 16 },
  { label: '4–6 PM',      etaLabel: 'Today by 6:00 PM',  cutoffHour: 15, cutoffMin: 0,  slotEndHour: 18 },
  { label: '6–8 PM',      etaLabel: 'Today by 8:00 PM',  cutoffHour: 17, cutoffMin: 0,  slotEndHour: 20 },
];

const TOMORROW_SLOT = { label: '8–10 AM', etaLabel: 'Tomorrow by 10:00 AM' };

function resolveSlot(now: Date) {
  const h = now.getHours();
  const m = now.getMinutes();
  for (const slot of TODAY_SLOTS) {
    if (h < slot.cutoffHour || (h === slot.cutoffHour && m < slot.cutoffMin)) {
      const cutoff = new Date(now);
      cutoff.setHours(slot.cutoffHour, slot.cutoffMin, 0, 0);
      return { etaLabel: slot.etaLabel, slotLabel: `Today, ${slot.label}`, cutoffAt: cutoff };
    }
  }
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return { etaLabel: TOMORROW_SLOT.etaLabel, slotLabel: `Tomorrow, ${TOMORROW_SLOT.label}`, cutoffAt: midnight };
}

function secsToDisplay(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

// --- Provider ---
export function DeliveryProvider({ children }: { children: ReactNode }) {
  const [pincode, setPincode] = useState<string | null>(() => localStorage.getItem(PINCODE_KEY));
  const [isServiceable, setIsServiceable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [slot, setSlot] = useState<DeliverySlot | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recomputeSlot = useCallback((serviceable: boolean) => {
    if (!serviceable) { setSlot(null); return; }
    const now = new Date();
    const resolved = resolveSlot(now);
    const secsLeft = Math.max(0, Math.floor((resolved.cutoffAt.getTime() - now.getTime()) / 1000));
    setSlot({
      etaLabel: resolved.etaLabel,
      slotLabel: resolved.slotLabel,
      cutoffAt: resolved.cutoffAt.toISOString(),
      cutoffSecondsLeft: secsLeft,
      cutoffDisplay: secsToDisplay(secsLeft),
      isServiceable: true,
    });
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!pincode || isServiceable !== true) { setSlot(null); return; }
    recomputeSlot(true);
    timerRef.current = setInterval(() => recomputeSlot(true), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pincode, isServiceable, recomputeSlot]);

  useEffect(() => {
    const fetchAndVerify = async () => {
      const saved = localStorage.getItem(PINCODE_KEY);
      if (!saved) return;
      setIsLoading(true);
      try {
        const data = await getServiceableAreas();
        const pins = data.pincodes ?? [];
        const ok = pins.length === 0 || pins.includes(saved);
        setIsServiceable(ok);
      } catch {
        setIsServiceable(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndVerify();
  }, []);

  const setAndConfirmPincode = async (pin: string) => {
    const cleaned = pin.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) return false;
    setIsLoading(true);
    try {
      const data = await getServiceableAreas();
      const pins = data.pincodes ?? [];
      const ok = pins.length === 0 || pins.includes(cleaned);
      if (ok) {
        localStorage.setItem(PINCODE_KEY, cleaned);
        setPincode(cleaned);
      }
      setIsServiceable(ok);
      return ok;
    } catch {
      setIsServiceable(true);
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const clearPincode = () => {
    localStorage.removeItem(PINCODE_KEY);
    setPincode(null);
    setIsServiceable(null);
    setSlot(null);
  };

  return (
    <DeliveryContext.Provider value={{ pincode, slot, isLoading, isServiceable, setAndConfirmPincode, clearPincode }}>
      {children}
    </DeliveryContext.Provider>
  );
}

if (typeof window !== 'undefined') {
  (window as any).__DELIVERY_CONTEXT_CREATED__ = ((window as any).__DELIVERY_CONTEXT_CREATED__ || 0) + 1;
  console.log(`[DeliveryContext] Context instance #${(window as any).__DELIVERY_CONTEXT_CREATED__} created`);
}

export function useDeliverySlot() {
  const context = useContext(DeliveryContext);
  if (!context) {
    console.warn('[DeliveryContext] useDeliverySlot called outside Provider or Context mismatch detected.');
    // Return a dummy object to stop the hard crash so we can see the UI
    return {
      pincode: null,
      slot: null,
      isLoading: false,
      isServiceable: null,
      setAndConfirmPincode: async () => false,
      clearPincode: () => {},
    } as DeliveryContextType;
  }
  return context;
}
