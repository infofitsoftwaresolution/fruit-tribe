/**
 * Matches backend `SettingsService.calculateDeliveryFeeByDistance`:
 * first slab where distance <= upToKm, else last slab fee, else flat fallback.
 */
export function computeDeliveryFeeByDistanceKm(
    distanceKm: number,
    rules: Array<{ upToKm: number; fee: number }> | undefined | null,
    flatFallback: number,
    mode?: 'SLAB' | 'PER_KM',
    perKmRate?: number,
): number {
    const d = Number(distanceKm);
    if (!Number.isFinite(d) || d < 0) return flatFallback;
    const normalizedMode = String(mode || 'SLAB').toUpperCase() === 'PER_KM' ? 'PER_KM' : 'SLAB';
    if (normalizedMode === 'PER_KM') {
        let rate = Number(perKmRate);
        // Backward compatibility for legacy admin input: when a "1 km => ₹X" slab exists,
        // use it as per-km rate if explicit rate is missing/too low.
        if (!Number.isFinite(rate) || rate <= 1) {
            const legacyOneKm = (rules ?? []).find(
                (r) => Number(r?.upToKm) === 1 && Number.isFinite(Number(r?.fee)) && Number(r?.fee) > 0,
            );
            if (legacyOneKm) rate = Number(legacyOneKm.fee);
        }
        if (Number.isFinite(rate) && rate > 0) {
            return Math.ceil(d * rate);
        }
        return flatFallback;
    }
    const defaultRules = [
        { upToKm: 3, fee: 20 },
        { upToKm: 8, fee: 40 },
        { upToKm: 15, fee: 60 },
        { upToKm: 9999, fee: 90 },
    ];
    const sourceRules = (rules ?? []).length > 0 ? (rules ?? []) : defaultRules;
    const sorted = sourceRules
        .filter(
            (r) =>
                Number.isFinite(r.upToKm) &&
                r.upToKm > 0 &&
                Number.isFinite(r.fee) &&
                r.fee >= 0,
        )
        .sort((a, b) => a.upToKm - b.upToKm);
    if (sorted.length === 0) return flatFallback;
    const matched = sorted.find((r) => d <= r.upToKm);
    if (matched) return Number(matched.fee);
    return Number(sorted[sorted.length - 1].fee);
}
