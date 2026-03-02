import { useState, useEffect } from 'react';
import { getServiceableAreas } from '@/lib/api';

export function useServiceableAreas() {
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getServiceableAreas()
      .then((r) => { if (!cancelled) setCities(r.cities || []); })
      .catch(() => { if (!cancelled) setCities(['Bangalore']); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isCityServiceable = (city: string) => {
    if (!city?.trim()) return false;
    const normalized = city.trim().toLowerCase();
    return cities.some((c) => c.toLowerCase() === normalized);
  };

  return { cities, loading, isCityServiceable };
}
