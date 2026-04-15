/**
 * useDeliverySlot — Pincode-aware delivery intelligence hook.
 *
 * Responsibilities:
 *  - Persist pincode in localStorage
 *  - Fetch serviceable pincodes from backend (GET /settings/serviceable-areas)
 *  - Resolve delivery ETA + slot string based on current time
 *  - Provide countdown to slot cut-off
 *  - Expose actions: setAndConfirmPincode, clearPincode
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getServiceableAreas } from '@/lib/api';

const PINCODE_KEY = 'ft_delivery_pincode';
const SERVICEABLE_KEY = 'ft_serviceable_pincodes';
const SERVICEABLE_TTL_MS = 5 * 60 * 1000; // 5 min cache

export interface DeliverySlot {
  /** Human-readable ETA: "Today by 6:00 PM" */
  etaLabel: string;
  /** Short slot label for hero: "Today, 4–6 PM" */
  slotLabel: string;
  /** ISO string for next slot cutoff (used for countdown) */
  cutoffAt: string;
  /** Seconds remaining until cutoff */
  cutoffSecondsLeft: number;
  /** Formatted countdown "hh:mm:ss" */
  cutoffDisplay: string;
  /** Is the chosen pincode serviceable? */
  isServiceable: boolean;
}

export interface UseDeliverySlotReturn {
  pincode: string | null;
  slot: DeliverySlot | null;
  isLoading: boolean;
  isServiceable: boolean | null; // null = not checked yet
  setAndConfirmPincode: (pin: string) => Promise<boolean>;
  clearPincode: () => void;
}

// ---------------------------------------------------------------------------
// Slot resolution logic (time-of-day aware, no backend needed)
// ---------------------------------------------------------------------------

interface SlotWindow {
  label: string;       // "4–6 PM"
  etaLabel: string;    // "Today by 6:00 PM"
  cutoffHour: number;  // order by hour (24h) to get this slot
  cutoffMin: number;
  slotEndHour: number; // display end hour (24h)
}

const TODAY_SLOTS: SlotWindow[] = [
  { label: '10 AM–12 PM', etaLabel: 'Today by 12:00 PM', cutoffHour: 9,  cutoffMin: 0,  slotEndHour: 12 },
  { label: '12–2 PM',     etaLabel: 'Today by 2:00 PM',  cutoffHour: 11, cutoffMin: 0,  slotEndHour: 14 },
  { label: '2–4 PM',      etaLabel: 'Today by 4:00 PM',  cutoffHour: 13, cutoffMin: 0,  slotEndHour: 16 },
  { label: '4–6 PM',      etaLabel: 'Today by 6:00 PM',  cutoffHour: 15, cutoffMin: 0,  slotEndHour: 18 },
  { label: '6–8 PM',      etaLabel: 'Today by 8:00 PM',  cutoffHour: 17, cutoffMin: 0,  slotEndHour: 20 },
];

const TOMORROW_SLOT: Omit<SlotWindow, 'cutoffHour' | 'cutoffMin'> = {
  label: '8–10 AM',
  etaLabel: 'Tomorrow by 10:00 AM',
  slotEndHour: 10,
};

function resolveSlot(now: Date): { etaLabel: string; slotLabel: string; cutoffAt: Date } {
  const h = now.getHours();
  const m = now.getMinutes();

  for (const slot of TODAY_SLOTS) {
    if (h < slot.cutoffHour || (h === slot.cutoffHour && m < slot.cutoffMin)) {
      // We're before this slot's cutoff — offer it
      const cutoff = new Date(now);
      cutoff.setHours(slot.cutoffHour, slot.cutoffMin, 0, 0);
      return { etaLabel: slot.etaLabel, slotLabel: `Today, ${slot.label}`, cutoffAt: cutoff };
    }
  }

  // After all today slots — offer tomorrow 8–10 AM, cutoff at midnight
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return {
    etaLabel: TOMORROW_SLOT.etaLabel,
    slotLabel: `Tomorrow, ${TOMORROW_SLOT.label}`,
    cutoffAt: midnight,
  };
}

function secsToDisplay(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

// ---------------------------------------------------------------------------
// Serviceable Pincode Resolution
// ---------------------------------------------------------------------------

let _serviceableCacheAt = 0;
let _serviceableCache: string[] = [];

async function fetchServiceablePincodes(): Promise<string[]> {
  // Return in-memory cache if fresh
  if (Date.now() - _serviceableCacheAt < SERVICEABLE_TTL_MS && _serviceableCache.length > 0) {
    return _serviceableCache;
  }
  // Try sessionStorage cache
  try {
    const raw = sessionStorage.getItem(SERVICEABLE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { at: number; pins: string[] };
      if (Date.now() - parsed.at < SERVICEABLE_TTL_MS) {
        _serviceableCache = parsed.pins;
        _serviceableCacheAt = parsed.at;
        return parsed.pins;
      }
    }
  } catch { /* ignore */ }

  try {
    const data = await getServiceableAreas();
    const pins = data.pincodes ?? [];
    _serviceableCache = pins;
    _serviceableCacheAt = Date.now();
    sessionStorage.setItem(SERVICEABLE_KEY, JSON.stringify({ at: _serviceableCacheAt, pins }));
    return pins;
  } catch {
    // Backend down → treat any 6-digit pincode as serviceable (graceful degradation)
    return [];
  }
}

function checkPinServiceable(pin: string, serviceablePins: string[]): boolean {
  if (!pin || pin.length !== 6) return false;
  // No pincodes configured → accept any valid 6-digit code (graceful)
  if (serviceablePins.length === 0) return true;
  return serviceablePins.includes(pin);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDeliverySlot(): UseDeliverySlotReturn {
  const [pincode, setPincode] = useState<string | null>(() => localStorage.getItem(PINCODE_KEY));
  const [isServiceable, setIsServiceable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [slot, setSlot] = useState<DeliverySlot | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recompute slot every second
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

  // When pincode or serviceability changes, recheck
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!pincode || isServiceable !== true) { setSlot(null); return; }

    recomputeSlot(true);
    timerRef.current = setInterval(() => recomputeSlot(true), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pincode, isServiceable, recomputeSlot]);

  // On mount: if pincode already saved, verify it
  useEffect(() => {
    const saved = localStorage.getItem(PINCODE_KEY);
    if (!saved) return;
    setIsLoading(true);
    fetchServiceablePincodes().then((pins) => {
      const ok = checkPinServiceable(saved, pins);
      setIsServiceable(ok);
      setIsLoading(false);
    });
  }, []);

  const setAndConfirmPincode = useCallback(async (pin: string): Promise<boolean> => {
    const cleaned = pin.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) return false;
    setIsLoading(true);
    const pins = await fetchServiceablePincodes();
    const ok = checkPinServiceable(cleaned, pins);
    if (ok) {
      localStorage.setItem(PINCODE_KEY, cleaned);
      setPincode(cleaned);
    }
    setIsServiceable(ok);
    setIsLoading(false);
    return ok;
  }, []);

  const clearPincode = useCallback(() => {
    localStorage.removeItem(PINCODE_KEY);
    setPincode(null);
    setIsServiceable(null);
    setSlot(null);
  }, []);

  return { pincode, slot, isLoading, isServiceable, setAndConfirmPincode, clearPincode };
}
