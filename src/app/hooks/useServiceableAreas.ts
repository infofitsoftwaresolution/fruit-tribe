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
    const normalized = city.trim().toLowerCase();
    return cities.some((c) => c.toLowerCase() === normalized);
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
