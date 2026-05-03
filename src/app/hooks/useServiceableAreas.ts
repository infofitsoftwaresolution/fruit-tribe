import { useState, useEffect } from 'react';
import { getServiceableAreas } from '@/lib/api';

export function useServiceableAreas() {
  const [cities, setCities] = useState<string[]>([]);
  const [pincodes, setPincodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getServiceableAreas()
      .then((r) => {
        if (!cancelled) {
          setCities(r.cities || []);
          setPincodes(r.pincodes || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCities(['Bangalore']);
          setPincodes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isCityServiceable = (city: string) => {
    if (!city?.trim()) return false;
    if (!cities.length) return true;
    const normalized = city.trim().toLowerCase().replace(/\s+/g, ' ');
    const aliases: Record<string, string[]> = {
      bangalore: ['bengaluru', 'banglore', 'bengalooru', 'bengalore'],
      bengaluru: ['bangalore', 'banglore', 'bengalooru', 'bengalore'],
    };
    return cities.some((c) => {
      const cn = c.trim().toLowerCase();
      if (cn === normalized) return true;
      const a = aliases[cn] || [];
      const b = aliases[normalized] || [];
      return a.includes(normalized) || b.includes(cn);
    });
  };

  /** When the admin list is non-empty, checkout PIN (6 digits) must match. */
  const isPincodeServiceable = (zip: string) => {
    if (!pincodes.length) return true;
    const digits = String(zip || '').replace(/\D/g, '');
    if (digits.length !== 6) return false;
    return pincodes.includes(digits);
  };

  return { cities, pincodes, loading, isCityServiceable, isPincodeServiceable };
}
