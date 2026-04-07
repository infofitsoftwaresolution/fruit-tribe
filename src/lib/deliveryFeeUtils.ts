/**
 * Matches backend `SettingsService.calculateDeliveryFeeByDistance`:
 * first slab where distance <= upToKm, else last slab fee, else flat fallback.
 */
export function computeDeliveryFeeByDistanceKm(
    distanceKm: number,
    rules: Array<{ upToKm: number; fee: number }> | undefined | null,
    flatFallback: number,
): number {
    const d = Number(distanceKm);
    if (!Number.isFinite(d) || d < 0) return flatFallback;
    const sorted = (rules ?? [])
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
