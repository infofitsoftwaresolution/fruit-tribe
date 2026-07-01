export function isArchivedVariantLabel(value: string | null | undefined): boolean {
    return String(value || '').trim().toLowerCase().includes('(archived)');
}

/** Parse pack weight from variant label (e.g. "10kg" → 10). */
export function parsePackQtyKg(rawValue: string | null | undefined): number {
    const label = String(rawValue ?? '').trim().toLowerCase();
    if (!label || label === 'default') return 1;
    const m = label.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams)\b/);
    if (!m) return 1;
    const rawQty = Number(m[1]);
    const unit = m[2];
    let kg = ['g', 'gm', 'grams'].includes(unit) ? rawQty / 1000 : rawQty;
    if (!Number.isFinite(kg) || kg <= 0) kg = 1;
    return kg;
}

export function sumReservedKg(
    variants: Array<{ reservedQuantity?: number | null }> | null | undefined,
): number {
    return (variants ?? []).reduce(
        (sum, v) => sum + Math.max(0, Number(v.reservedQuantity) || 0),
        0,
    );
}

/** Physical kg in warehouse minus kg reserved for pending orders (shared pool on product.stock). */
export function getProductAvailableKg(
    productStockKg: number,
    variants: Array<{ reservedQuantity?: number | null }> | null | undefined,
): number {
    const reserved = sumReservedKg(variants);
    const physical = Math.max(0, Number(productStockKg) || 0);
    return Math.max(0, physical - reserved);
}

/** How many full packs of this size can be sold (0 = out of stock). */
export function variantPacksAvailable(productAvailableKg: number, packKg: number): number {
    const pack = Math.max(0.001, packKg);
    const avail = Math.max(0, productAvailableKg);
    return Math.floor(avail / pack);
}

export function variantInStock(productAvailableKg: number, packKg: number): boolean {
    return variantPacksAvailable(productAvailableKg, packKg) > 0;
}
