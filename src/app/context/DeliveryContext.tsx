import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode, useMemo } from 'react';
import { getServiceableAreas } from '@/lib/api';
import { useStore } from '@/app/context/StoreContext';

const PINCODE_KEY = 'ft_delivery_pincode';

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
}

function parseTime(timeStr: string): { h: number; m: number } | null {
  const match = timeStr.trim().match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2] || '0', 10);
  const ampm = match[3]?.toLowerCase();
  
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return { h, m };
}

function parseSlotToWindow(slot: string): SlotWindow[] {
  // Typical formats: "8am - 10am", "10:00 AM - 12:00 PM", "Today · 4pm - 6pm"
  const clean = slot.split('·').pop() || slot;
  const parts = clean.split(/[–-]/);
  if (parts.length < 2) return [];

  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  if (!start || !end) return [];

  // Cutoff logic:
  // For narrow slots (e.g. 2h window), cutoff is start - 1h.
  // For wide slots (e.g. > 4h window), cutoff is end - 2h.
  const duration = (end.h * 60 + end.m) - (start.h * 60 + start.m);
  let cutoffH, cutoffM;
  
  if (duration > 240) { // > 4 hours
    cutoffH = end.h - 2;
    cutoffM = end.m;
  } else {
    cutoffH = start.h - 1;
    cutoffM = start.m;
  }
  
  if (cutoffH < 0) { cutoffH = 23; cutoffM = 0; }

  const isToday = slot.toLowerCase().includes('today') || !slot.toLowerCase().includes('tomorrow');
  
  return [{
    label: clean.trim(),
    etaLabel: `${isToday ? 'Today' : 'Tomorrow'} by ${parts[1].trim()}`,
    cutoffHour: cutoffH,
    cutoffMin: cutoffM,
  }];
}

function resolveSlot(now: Date, customSlots: string[]) {
  const h = now.getHours();
  const m = now.getMinutes();

  const windows: SlotWindow[] = [];
  if (customSlots.length > 0) {
    customSlots.forEach(s => {
      // Only process "Today" slots for immediate delivery logic
      if (s.toLowerCase().includes('tomorrow')) return;
      windows.push(...parseSlotToWindow(s));
    });
  }

  // Sort windows by cutoff
  windows.sort((a, b) => (a.cutoffHour * 60 + a.cutoffMin) - (b.cutoffHour * 60 + b.cutoffMin));

  for (const win of windows) {
    if (h < win.cutoffHour || (h === win.cutoffHour && m < win.cutoffMin)) {
      const cutoff = new Date(now);
      cutoff.setHours(win.cutoffHour, win.cutoffMin, 0, 0);
      return { etaLabel: win.etaLabel, slotLabel: win.label, cutoffAt: cutoff };
    }
  }

  // Fallback to "Tomorrow" if all today slots passed or none defined
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  let tomorrowLabel = 'Tomorrow, 8–10 AM';
  const firstTomorrow = customSlots.find(s => s.toLowerCase().includes('tomorrow'));
  if (firstTomorrow) {
    tomorrowLabel = firstTomorrow;
  } else if (customSlots.length > 0) {
    // If no explicit tomorrow slot, use the first today slot as tomorrow's label
    tomorrowLabel = `Tomorrow, ${customSlots[0].split('·').pop() || customSlots[0]}`;
  }

  return { 
    etaLabel: tomorrowLabel.includes('by') ? tomorrowLabel : `Tomorrow by morning`, 
    slotLabel: tomorrowLabel, 
    cutoffAt: tomorrow 
  };
}

function secsToDisplay(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

// --- Provider ---
export function DeliveryProvider({ children }: { children: ReactNode }) {
  const { preferences } = useStore();
  const [pincode, setPincode] = useState<string | null>(() => {
     if (typeof window !== 'undefined') return localStorage.getItem(PINCODE_KEY);
     return null;
  });
  const [isServiceable, setIsServiceable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [slot, setSlot] = useState<DeliverySlot | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const customSlots = useMemo(() => preferences.deliverySlots ?? [], [preferences.deliverySlots]);

  const recomputeSlot = useCallback((serviceable: boolean) => {
    if (!serviceable) { setSlot(null); return; }
    const now = new Date();
    const resolved = resolveSlot(now, customSlots);
    const secsLeft = Math.max(0, Math.floor((resolved.cutoffAt.getTime() - now.getTime()) / 1000));
    setSlot({
      etaLabel: resolved.etaLabel,
      slotLabel: resolved.slotLabel,
      cutoffAt: resolved.cutoffAt.toISOString(),
      cutoffSecondsLeft: secsLeft,
      cutoffDisplay: secsToDisplay(secsLeft),
      isServiceable: true,
    });
  }, [customSlots]);

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
        // Soft fail
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
