/**
 * Free delivery when admin rules match:
 * - Both min order (₹) and max distance (km) set → order must meet ₹ AND be within km.
 * - Only min order set → free above that subtotal (legacy).
 * - Only max km set → free within that distance for any order size.
 */
export function qualifiesForFreeDelivery(
    orderValue: number | undefined | null,
    distanceKm: number | undefined | null,
    freeThreshold?: number,
    freeWithinKm?: number,
): boolean {
    const threshold = Number(freeThreshold) || 0;
    const withinKm = Number(freeWithinKm) || 0;
    const order = Number(orderValue);
    const dist = Number(distanceKm);

    if (threshold > 0 && withinKm > 0) {
        return (
            Number.isFinite(order) &&
            order >= threshold &&
            Number.isFinite(dist) &&
            dist >= 0 &&
            dist <= withinKm
        );
    }
    if (threshold > 0 && withinKm <= 0) {
        return Number.isFinite(order) && order >= threshold;
    }
    if (threshold <= 0 && withinKm > 0) {
        return Number.isFinite(dist) && dist >= 0 && dist <= withinKm;
    }
    return false;
}

/** Customer-facing hint for cart / promos. */
export function formatFreeDeliveryHint(freeThreshold?: number, freeWithinKm?: number): string | null {
    const threshold = Number(freeThreshold) || 0;
    const withinKm = Number(freeWithinKm) || 0;
    if (threshold > 0 && withinKm > 0) {
        return `Free delivery on orders ₹${threshold}+ within ${withinKm} km`;
    }
    if (threshold > 0) {
        return `Free delivery on orders ₹${threshold} and above`;
    }
    if (withinKm > 0) {
        return `Free delivery within ${withinKm} km`;
    }
    return null;
}

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
    orderValue?: number,
    freeThreshold?: number,
    freeWithinKm?: number,
): number {
    if (qualifiesForFreeDelivery(orderValue, distanceKm, freeThreshold, freeWithinKm)) {
        return 0;
    }
    const d = Number(distanceKm);
    if (!Number.isFinite(d) || d < 0) return flatFallback;
    const normalizedMode = String(mode || 'SLAB').toUpperCase() === 'PER_KM' ? 'PER_KM' : 'SLAB';
    if (normalizedMode === 'PER_KM') {
        let rate = Number(perKmRate);
        // Backward compatibility for legacy admin input: when a "1 km => ₹X" slab exists,
        // use it only if explicit rate is missing or non-positive.
        if (!Number.isFinite(rate) || rate <= 0) {
            const legacyOneKm = (rules ?? []).find(
                (r) => Number(r?.upToKm) === 1 && Number.isFinite(Number(r?.fee)) && Number(r?.fee) > 0,
            );
            if (legacyOneKm) rate = Number(legacyOneKm.fee);
        }
        if (Number.isFinite(rate) && rate > 0) {
            return Math.round(d * rate * 100) / 100;
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
